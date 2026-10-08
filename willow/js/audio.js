/*
 * audio.js — live-synthesized sound for the dark, Xbox-360-dashboard-style
 * resume site.
 *
 * Everything you hear is generated in real time with the Web Audio API:
 * no audio files, no samples, nothing copyrighted. The music is an original
 * "atmospheric jungle" loop (~170 BPM breakbeats, sub bass, pads, Rhodes).
 * Load with a classic <script> tag; it exposes a single global object:
 * window.Sound
 *
 *   Sound.unlock()      -> Promise. Call from a click/keypress (browsers
 *                          only allow audio after a user gesture).
 *   Sound.play(name)    -> 'move' | 'open' | 'close' | 'swoosh' | 'start'
 *   Sound.setMusic(on)  / Sound.isMusicOn()
 *   Sound.setVolume(v)  / Sound.getVolume()   (v = 0..1)
 *   Sound.setSfx(on)    / Sound.isSfxOn()
 *
 * Preferences are remembered in localStorage ('xmb.music', 'xmb.volume', 'xmb.sfx').
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. Preferences (localStorage, always wrapped in try/catch)          */
  /* ------------------------------------------------------------------ */

  function readPref(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  function writePref(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (e) { /* storage blocked (private mode etc.) — ignore */ }
  }

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0.5;
    return Math.min(1, Math.max(0, v));
  }

  var prefs = {
    music: readPref('xmb.music', 'on') !== 'off',
    sfx: readPref('xmb.sfx', 'on') !== 'off',
    rain: readPref('xmb.rain', 'on') !== 'off',
    volume: clamp01(readPref('xmb.volume', '0.5'))
  };

  /* ------------------------------------------------------------------ */
  /* 2. Audio graph state                                                */
  /* ------------------------------------------------------------------ */

  var AC = window.AudioContext || window.webkitAudioContext || null;

  var ctx = null;          // the AudioContext (created on unlock)
  var unlocked = false;    // true once unlock() has succeeded
  var master = null;       // master volume gain
  var sfxBus = null;       // all sound effects go here
  var musicBus = null;     // all music goes here (used for 2s fades)
  var reverbIn = null;     // send into the sfx reverb
  var musicVerbIn = null;  // send into the (bigger, darker) music reverb
  var delayIn = null;      // send into the dotted-8th feedback delay
  var drumIn = null;       // every drum hit goes here (the "drum bus")
  var drumFilter = null;   // lowpass on the drum bus (swept open on drops)
  var padSend = null;      // pads -> music reverb (heavy)
  var rhodesVerb = null;   // Rhodes -> music reverb
  var rhodesEcho = null;   // Rhodes -> delay
  var crackleIn = null;    // vinyl crackle layer input
  var crackleSrc = null;   // the looping crackle source while music runs
  var crackleBuffer = null;
  var lfo = null;          // slow LFO that sweeps the pad filters
  var lfoDepth = null;     // how far (in Hz) the LFO moves each filter
  var noiseBuffer = null;  // 2s of white noise, shared by every noise sound

  var rainBus = null;      // the rainstorm layer (its own fader, not the music's)
  var rainSrc = null;      // the looping rain noise source
  var rainBuffer = null;
  var lastTapTime = 0;     // rate limit for window-pane taps

  var RAIN_LEVEL = 0.2;    // rain sits under the music (MUSIC_LEVEL)
  var TRACK_URL = (window.SOUND_BASE || '') + 'assets/audio/neverending-night.mp3';   // pages in a subfolder set SOUND_BASE = '../'
  var TRACK_LEVEL = 0.5;   // the looping song (the synth is only a fallback)
  var trackBuffer = null;
  var trackSrc = null;
  var trackState = 'idle'; // idle | loading | ready | failed
  var MUSIC_LEVEL = 0.22;  // music is background: much quieter than sfx
  var FADE_TIME = 2;       // seconds for music fade in/out

  // Music scheduler state
  var musicPlaying = false;   // is the scheduler running (or fading in)?
  var schedulerId = null;     // setInterval handle
  var stopTimeoutId = null;   // pending "fully stop after fade-out" timer

  var LOOKAHEAD = 0.25;       // schedule this many seconds ahead
  var TICK_MS = 25;           // how often the scheduler wakes up

  // Tempo: everything runs on a grid of 16th notes.
  var BPM = 170;
  var SIXTEENTH = 60 / BPM / 4;   // seconds per 16th note (~0.088s)
  var BAR = SIXTEENTH * 16;       // seconds per bar (~1.41s)
  var SWING = 0.12;               // odd 16ths are pushed late by this fraction

  // Where we are in the song
  var nextStepTime = 0;   // AudioContext time of the next 16th step
  var step = 0;           // 0..15 inside the current bar
  var bar = 0;            // bars since the music started
  var sectionIndex = 0;   // which entry of SECTIONS we are in
  var sectionBar = 0;     // bar number inside the current section
  var patternIndex = 0;   // which drum pattern is playing
  var fillKind = null;    // fill for the current bar (or null)
  var rhodesPlan = {};    // step -> list of Rhodes notes for this bar

  // Song structure (in bars). After the last section we jump back to LOOP_TO.
  var SECTIONS = [
    { name: 'intro', bars: 8 },       // pads + crackle + filtered hats
    { name: 'full', bars: 16 },       // breaks + sub + pads
    { name: 'breakdown', bars: 8 },   // drums drop out, pads + Rhodes
    { name: 'full2', bars: 16 }       // breaks come back with variations
  ];
  var LOOP_TO = 2;                    // loop: breakdown -> full2 -> breakdown ...

  // Chord loop, 2 bars each: Fm9 -> Dbmaj7 -> Ebsus2/4 -> Cm7 (MIDI notes).
  // `root` is the sub bass note; `notes` is the pad voicing.
  var CHORDS = [
    { root: 41, notes: [53, 56, 60, 63, 67] },   // Fm9      : F3 Ab3 C4 Eb4 G4
    { root: 37, notes: [49, 53, 56, 60, 65] },   // Dbmaj7   : Db3 F3 Ab3 C4 F4
    { root: 39, notes: [51, 58, 63, 65, 68] },   // Ebsus2/4 : Eb3 Bb3 Eb4 F4 Ab4
    { root: 36, notes: [48, 55, 58, 63, 67] }    // Cm7      : C3 G3 Bb3 Eb4 G4
  ];

  // Original 2-bar breakbeats (16 steps per bar, one string per bar).
  //   kick : X = hard, x = soft
  //   snare: X = backbeat, x = medium, g = ghost note
  //   hat  : x = closed, - = soft closed, o = open
  var PATTERNS = [
    { // "roller"
      kick:  ['X.........X.....', '..X...x...X.....'],
      snare: ['....X..g.g..X..g', '.g..X.g.....X.g.'],
      hat:   ['x-x-x-x-x-x-x-x-', 'x-x-x-x-x-x-x-o-']
    },
    { // "stepper"
      kick:  ['X.X.......X.....', '.......X..X...x.'],
      snare: ['....X.....g.X...', 'g...X..g..g.X.gg'],
      hat:   ['x.x-x.x-x.x-x.x-', 'x-x-x.x-x-x-x.o.']
    },
    { // "skippy"
      kick:  ['X.....X..X......', 'X.X.....x..X....'],
      snare: ['....X.g....gX...', '.g..X..g.g..X..g'],
      hat:   ['-x-x-x-x-x-x-x-x', 'x-x-x-x--x-x-ox-']
    },
    { // "heavy" — sparse, lets the sub breathe
      kick:  ['X..........X....', '..X.....X.X.....'],
      snare: ['....X.......X...', '.g..X..g....X.g.'],
      hat:   ['x.x.x.x.x.x.x.x.', 'x.x.x-x.x.x.x-o.']
    }
  ];

  // Fills replace the end of a bar, starting at this step.
  var FILL_START = { stutter: 12, chop: 8, roll: 8 };

  // Sub bass rhythm for the two bars of each chord: [step, length in 16ths].
  var SUB_PATTERN = [
    [[0, 10], [10, 6]],             // first bar: long root, then a pickup
    [[0, 6], [7, 3], [11, 5]]       // second bar: busier; last note may glide
  ];

  // Mix levels (before the music fader)
  var PAD_LEVEL = 0.012;      // per saw — there are 15 of them per chord
  var PAD_ATTACK = 1.2;
  var PAD_RELEASE = 2;
  var SUB_LEVEL = 0.32;
  var RHODES_LEVEL = 0.08;

  function midiToHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  /* ------------------------------------------------------------------ */
  /* 3. Small helpers                                                    */
  /* ------------------------------------------------------------------ */

  // Smoothly move an AudioParam to a value over `time` seconds.
  function rampTo(param, value, time) {
    var now = ctx.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + Math.max(0.01, time));
    } catch (e) {
      param.value = value;
    }
  }

  // Create a stereo panner if the browser supports it; otherwise a plain gain.
  function makePanner(pan) {
    if (ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.value = pan;
      return p;
    }
    return ctx.createGain();
  }

  // Disconnect a list of nodes once the given source has finished playing.
  // This keeps the audio graph from growing forever.
  function cleanupWhenDone(source, nodes) {
    source.onended = function () {
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch (e) { /* already gone */ }
      }
    };
  }

  // A percussive envelope: very fast attack, exponential decay to silence.
  function envPerc(param, t, peak, attack, dur) {
    peak = Math.max(0.0002, peak);   // exponential ramps can't touch 0
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  // Small random velocity changes so the drums don't sound like a machine gun.
  function human(v) {
    return v * (0.9 + Math.random() * 0.2);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Build a reverb "impulse response": stereo noise that decays over time.
  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buf;
  }

  function makeNoise(seconds) {
    var length = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Vinyl crackle: soft hiss plus sparse random clicks, stereo, made to loop.
  function makeCrackle(seconds) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var lp = 0;
      // Hiss: white noise through a simple one-pole lowpass (darker, softer).
      for (var i = 0; i < length; i++) {
        lp += 0.08 * ((Math.random() * 2 - 1) - lp);
        data[i] = lp * 0.15;
      }
      // Clicks: short decaying spikes at random places, mostly tiny.
      var clicks = Math.floor(seconds * 9);
      for (var c = 0; c < clicks; c++) {
        var pos = Math.floor(Math.random() * (length - 200));
        var amp = (0.06 + Math.pow(Math.random(), 3) * 0.45) * (Math.random() < 0.5 ? -1 : 1);
        var len = 20 + Math.floor(Math.random() * 60);
        for (var j = 0; j < len; j++) {
          data[pos + j] += amp * Math.exp(-j / (len / 5));
        }
      }
    }
    return buf;
  }

  // tanh without relying on Math.tanh (very old browsers).
  function tanh(x) {
    var e = Math.exp(2 * x);
    return (e - 1) / (e + 1);
  }

  // Soft saturation curve for a WaveShaper (warm, rounded grit).
  function makeSaturationCurve(amount) {
    var n = 2048;
    var curve = new Float32Array(n);
    var norm = tanh(amount);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = tanh(amount * x) / norm;
    }
    return curve;
  }

  // "Bit-crush" curve: a staircase that rounds the signal to a few levels.
  function makeCrushCurve(bits) {
    var n = 4096;
    var curve = new Float32Array(n);
    var steps = Math.pow(2, bits) / 2;
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  // A burst of filtered noise (snares, hats, clicks, ticks...).
  // Returns the filter so the caller can sweep it if wanted.
  function noiseHit(t, dur, type, freq, q, peak, dest, pan) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    var env = ctx.createGain();
    envPerc(env.gain, t, peak, 0.002, dur);
    src.connect(filter);
    filter.connect(env);
    var nodes = [src, filter, env];
    if (pan) {
      var panner = makePanner(pan);
      env.connect(panner);
      panner.connect(dest);
      nodes.push(panner);
    } else {
      env.connect(dest);
    }
    // Start somewhere random in the shared noise so hits don't all sound identical.
    var offset = Math.max(0, Math.random() * (noiseBuffer.duration - dur - 0.1));
    src.start(t, offset);
    src.stop(t + dur + 0.02);
    cleanupWhenDone(src, nodes);
    return filter;
  }

  // A short oscillator hit whose pitch slides from f0 to f1 (kicks, bodies).
  function oscHit(t, type, f0, f1, sweep, dur, peak, dest, pan) {
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + sweep);
    var env = ctx.createGain();
    envPerc(env.gain, t, peak, 0.002, dur);
    osc.connect(env);
    var nodes = [osc, env];
    if (pan) {
      var panner = makePanner(pan);
      env.connect(panner);
      panner.connect(dest);
      nodes.push(panner);
    } else {
      env.connect(dest);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
    cleanupWhenDone(osc, nodes);
    return osc;
  }

  // Two-operator FM "ping": a metallic, bell-like tone.
  function fmPing(t, carrierHz, modHz, index, dur, peak, dest, pan) {
    var car = ctx.createOscillator();
    car.frequency.value = carrierHz;
    var mod = ctx.createOscillator();
    mod.frequency.value = modHz;
    var modGain = ctx.createGain();
    modGain.gain.value = index;
    var env = ctx.createGain();
    envPerc(env.gain, t, peak, 0.002, dur);
    var panner = makePanner(pan || 0);
    mod.connect(modGain);
    modGain.connect(car.frequency);
    car.connect(env);
    env.connect(panner);
    panner.connect(dest);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.02);
    mod.stop(t + dur + 0.02);
    cleanupWhenDone(car, [car, mod, modGain, env, panner]);
  }

  /* ------------------------------------------------------------------ */
  /* 4. Build the audio graph (once, on first unlock)                    */
  /* ------------------------------------------------------------------ */
  /*
   *   sfx  ------------------------> sfxBus ---+--> master --> compressor --> speakers
   *                                  \__ sfx reverb __^
   *
   *   drums --> drumIn --> saturate --+--------------+--> drumFilter --> musicBus
   *                                   +--> bit-crush -+
   *   sub, pads, Rhodes, crackle -------------------------------------> musicBus
   *   pads / Rhodes --> music reverb ---------------------------------> musicBus
   *   Rhodes --> dotted-8th delay ------------------------------------> musicBus
   *
   *   musicBus is the music fader (fades in/out over 2s) --> master
   */
  function buildGraph() {
    ctx = new AC();

    // A gentle compressor on the very end protects against loud peaks.
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = prefs.volume;
    master.connect(comp);

    // Sfx reverb: send -> convolver -> return -> master
    reverbIn = ctx.createGain();
    var convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(2, 3);
    var reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.5;
    reverbIn.connect(convolver);
    convolver.connect(reverbOut);
    reverbOut.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    var sfxSend = ctx.createGain();   // just a touch of room on sfx
    sfxSend.gain.value = 0.15;
    sfxBus.connect(sfxSend);
    sfxSend.connect(reverbIn);

    // Music fader. Everything musical (including its reverb) ends up here.
    musicBus = ctx.createGain();
    musicBus.gain.value = 0;           // starts silent; faded in by setMusic
    musicBus.connect(master);

    // Big dark music reverb (its return goes into musicBus so it fades too).
    musicVerbIn = ctx.createGain();
    var musicConvolver = ctx.createConvolver();
    musicConvolver.buffer = makeImpulse(5, 2.5);
    var musicVerbTone = ctx.createBiquadFilter();   // darken the tail
    musicVerbTone.type = 'lowpass';
    musicVerbTone.frequency.value = 4000;
    var musicVerbOut = ctx.createGain();
    musicVerbOut.gain.value = 0.8;
    musicVerbIn.connect(musicConvolver);
    musicConvolver.connect(musicVerbTone);
    musicVerbTone.connect(musicVerbOut);
    musicVerbOut.connect(musicBus);

    // Feedback delay synced to a dotted 8th (3 sixteenths).
    delayIn = ctx.createGain();
    var delay = ctx.createDelay(1);
    delay.delayTime.value = SIXTEENTH * 3;
    var delayTone = ctx.createBiquadFilter();       // each echo gets darker
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2200;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    var delayOut = ctx.createGain();
    delayOut.gain.value = 0.6;
    delayIn.connect(delay);
    delay.connect(delayTone);
    delayTone.connect(feedback);
    feedback.connect(delay);
    delayTone.connect(delayOut);
    delayOut.connect(musicBus);

    // Drum bus: saturation, then a blend of clean + crushed, then a lowpass.
    drumIn = ctx.createGain();
    var saturate = ctx.createWaveShaper();
    saturate.curve = makeSaturationCurve(2.2);
    saturate.oversample = '2x';
    var crush = ctx.createWaveShaper();
    crush.curve = makeCrushCurve(5);   // ~5-bit staircase = lo-fi grit
    var cleanMix = ctx.createGain();
    cleanMix.gain.value = 0.75;
    var crushMix = ctx.createGain();
    crushMix.gain.value = 0.35;
    drumFilter = ctx.createBiquadFilter();
    drumFilter.type = 'lowpass';
    drumFilter.frequency.value = 1200;
    drumFilter.Q.value = 1;
    var drumOut = ctx.createGain();
    drumOut.gain.value = 0.6;          // drums sit lowish in the mix
    var drumVerb = ctx.createGain();
    drumVerb.gain.value = 0.12;        // a little space, not a wash
    drumIn.connect(saturate);
    saturate.connect(cleanMix);
    saturate.connect(crush);
    crush.connect(crushMix);
    cleanMix.connect(drumFilter);
    crushMix.connect(drumFilter);
    drumFilter.connect(drumOut);
    drumOut.connect(musicBus);
    drumOut.connect(drumVerb);
    drumVerb.connect(musicVerbIn);

    // Shared effect sends used by the pad and Rhodes voices.
    padSend = ctx.createGain();
    padSend.gain.value = 0.9;          // pads are very wet
    padSend.connect(musicVerbIn);
    rhodesVerb = ctx.createGain();
    rhodesVerb.gain.value = 0.6;
    rhodesVerb.connect(musicVerbIn);
    rhodesEcho = ctx.createGain();
    rhodesEcho.gain.value = 0.35;
    rhodesEcho.connect(delayIn);

    // Vinyl crackle layer: highpass so it never muddies the bass.
    crackleIn = ctx.createBiquadFilter();
    crackleIn.type = 'highpass';
    crackleIn.frequency.value = 250;
    var crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.6;
    crackleIn.connect(crackleGain);
    crackleGain.connect(musicBus);

    // One slow LFO (one cycle every ~16s) shared by every pad filter.
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 350;         // +/- 350 Hz cutoff sweep
    lfo.connect(lfoDepth);
    lfo.start();

    // Rain layer: its own fader into master, so the music fade never touches it.
    rainBus = ctx.createGain();
    rainBus.gain.value = 0;
    rainBus.connect(master);

    noiseBuffer = makeNoise(2);
    crackleBuffer = makeCrackle(7);
  }

  /* ------------------------------------------------------------------ */
  /* 5. Music: synth drum kit                                            */
  /* ------------------------------------------------------------------ */

  // Kick: sine with a fast pitch drop (~150 -> 45 Hz) plus a tiny click.
  function kick(t, vel, pitch) {
    vel = human(vel);
    pitch = pitch || 1;
    oscHit(t, 'sine', 150 * pitch, 45 * pitch, 0.1, 0.38, 0.95 * vel, drumIn, 0);
    noiseHit(t, 0.012, 'highpass', 2500, 0.7, 0.25 * vel, drumIn, 0);
  }

  // Snare: band-passed noise + a short ~190 Hz triangle body.
  // Quiet (ghost) hits are also shorter, which keeps them tight.
  function snare(t, vel, pitch) {
    vel = human(vel);
    pitch = pitch || 1;
    var len = 0.06 + 0.12 * Math.min(1, vel);
    noiseHit(t, len, 'bandpass', 1900 * pitch, 0.9, 0.7 * vel, drumIn, -0.08);
    noiseHit(t, len * 0.6, 'highpass', 5000, 0.7, 0.2 * vel, drumIn, -0.08);
    oscHit(t, 'triangle', 205 * pitch, 180 * pitch, 0.04, 0.09, 0.5 * vel, drumIn, 0);
  }

  // Hi-hat: very short high-passed noise (longer when open).
  function hat(t, vel, open) {
    vel = human(vel);
    noiseHit(t, open ? 0.22 : 0.035, 'highpass', 7500, 0.8,
      (open ? 0.18 : 0.25) * vel, drumIn, 0.25);
  }

  // Ride / shimmer: airy noise tail plus a quiet metallic FM ping.
  function ride(t, vel) {
    vel = human(vel);
    noiseHit(t, 0.7, 'bandpass', 8500, 0.6, 0.09 * vel, drumIn, -0.3);
    fmPing(t, 3200, 4630, 2500, 0.45, 0.03 * vel, drumIn, -0.3);
  }

  // One step of a fill. Fills use straight (un-swung) time and 32nd notes.
  function playFill(time, kind) {
    var n = step - FILL_START[kind];   // position inside the fill (0, 1, 2...)
    var t32 = SIXTEENTH / 2;           // one 32nd note
    var i, j;
    if (kind === 'stutter') {
      // 4 steps -> 8 retriggered snares, getting louder and a little higher.
      if (n === 0) kick(time, 0.8);
      for (i = 0; i < 2; i++) {
        j = n * 2 + i;
        snare(time + i * t32, 0.3 + j * 0.06, 1 + j * 0.04);
      }
    } else if (kind === 'chop') {
      // 8 steps of "chopped" break: hit, gap, rolls, pitched-up stutter.
      if (n === 0) {
        kick(time, 1);
      } else if (n === 2 || n === 3) {
        snare(time, 0.5, 1);
        snare(time + t32, 0.35, 1.05);
      } else if (n === 4) {
        kick(time, 0.9);
        snare(time, 0.75, 1.1);
      } else if (n === 5) {
        kick(time + t32, 0.6);         // a retriggered kick, slightly late
      } else if (n >= 6) {
        for (i = 0; i < 2; i++) {
          snare(time + i * t32, 0.45 + (n - 6) * 0.15 + i * 0.05,
            1.25 + (n - 6) * 0.1 + i * 0.05);
        }
      }
      // n === 1 stays silent on purpose: that gap is the "chop".
    } else if (kind === 'roll') {
      // 8 steps -> 16 snares, a crescendo that rises in pitch.
      if (n === 0) kick(time, 0.8);
      for (i = 0; i < 2; i++) {
        j = n * 2 + i;
        snare(time + i * t32, 0.15 + j * 0.04, 1 + j * 0.03);
      }
    }
  }

  // Drums for one step. `time` is straight, `t` includes the swing.
  function scheduleDrums(time, t, section) {
    if (fillKind && step >= FILL_START[fillKind]) {
      playFill(time, fillKind);
      return;
    }
    var p = PATTERNS[patternIndex];
    var half = bar % 2;                     // which bar of the 2-bar pattern
    var k = p.kick[half].charAt(step);
    var s = p.snare[half].charAt(step);
    var h = p.hat[half].charAt(step);

    if (section === 'intro') {
      // Just filtered hats in the second half of the intro.
      if (sectionBar >= 4) {
        if (h === 'x') hat(t, 0.5, false);
        else if (h === '-') hat(t, 0.3, false);
      }
      return;
    }

    if (section === 'breakdown') {
      // First half: no drums at all. Second half: soft ride + ghost snares.
      if (sectionBar >= 4) {
        if (step % 4 === 2) ride(t, 0.5);
        if (s === 'g') snare(t, 0.16, 1);
      }
      return;
    }

    // Full sections: the whole break.
    if (k === 'X') kick(t, 1);
    else if (k === 'x') kick(t, 0.7);

    if (s === 'X') snare(t, 0.8, 1);
    else if (s === 'x') snare(t, 0.5, 1);
    else if (s === 'g') snare(t, 0.15 + Math.random() * 0.08, 1);

    if (h === 'x') hat(t, 0.5, false);
    else if (h === '-') hat(t, 0.28, false);
    else if (h === 'o') hat(t, 0.45, true);

    // A soft ride shimmer: on every other downbeat, more often in full2.
    if (step === 0 && half === 0) ride(t, 0.4);
    if (section === 'full2' && step % 8 === 6) ride(t, 0.3);
  }

  /* ------------------------------------------------------------------ */
  /* 6. Music: sub bass, pads, Rhodes                                    */
  /* ------------------------------------------------------------------ */

  function currentChord() {
    return CHORDS[Math.floor(bar / 2) % CHORDS.length];
  }

  // Sub bass: pure sine + a little 2nd harmonic. Can glide to another note.
  function subNote(t, midi, len, glideTo) {
    var f = midiToHz(midi);
    var end = t + len;

    var osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f, t);

    var osc2 = ctx.createOscillator();   // 2nd harmonic, helps small speakers
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f * 2, t);

    if (glideTo !== null) {
      var f2 = midiToHz(glideTo);
      osc1.frequency.setValueAtTime(f, t + len * 0.4);
      osc1.frequency.exponentialRampToValueAtTime(f2, end);
      osc2.frequency.setValueAtTime(f * 2, t + len * 0.4);
      osc2.frequency.exponentialRampToValueAtTime(f2 * 2, end);
    }

    var g2 = ctx.createGain();
    g2.gain.value = 0.12;

    var env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(SUB_LEVEL, t + 0.01);
    env.gain.setValueAtTime(SUB_LEVEL, end - 0.04);
    env.gain.linearRampToValueAtTime(0, end);

    osc1.connect(env);
    osc2.connect(g2);
    g2.connect(env);
    env.connect(musicBus);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(end + 0.02);
    osc2.stop(end + 0.02);
    cleanupWhenDone(osc1, [osc1, osc2, g2, env]);
  }

  function scheduleSub(time) {
    var half = bar % 2;
    var notes = SUB_PATTERN[half];
    for (var i = 0; i < notes.length; i++) {
      if (notes[i][0] !== step) continue;
      var midi = currentChord().root;
      // Now and then jump up an octave in the second bar.
      if (half === 1 && i === 1 && Math.random() < 0.3) midi += 12;
      // The last note before a chord change sometimes glides to the next root.
      var glideTo = null;
      if (half === 1 && i === notes.length - 1 && Math.random() < 0.4) {
        glideTo = CHORDS[(Math.floor(bar / 2) + 1) % CHORDS.length].root;
      }
      subNote(time, midi, notes[i][1] * SIXTEENTH, glideTo);
    }
  }

  // Pad: 3 detuned saws per chord note -> lowpass (LFO swept) -> slow envelope.
  // The flat saws go left, the sharp ones right: a wide stereo pad.
  function schedulePad(chord, time, section) {
    var end = time + BAR * 2;
    var stopAt = end + PAD_RELEASE + 0.05;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = section === 'intro' ? 650 : section === 'breakdown' ? 1100 : 850;
    filter.Q.value = 0.7;
    lfoDepth.connect(filter.frequency);

    var env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(PAD_LEVEL, time + PAD_ATTACK);
    env.gain.setValueAtTime(PAD_LEVEL, end);
    env.gain.linearRampToValueAtTime(0, end + PAD_RELEASE);

    var left = makePanner(-0.75);
    var right = makePanner(0.75);
    left.connect(filter);
    right.connect(filter);
    filter.connect(env);
    env.connect(musicBus);
    env.connect(padSend);

    var nodes = [filter, env, left, right];
    var detunes = [-12, 0, 12];
    var last = null;
    for (var n = 0; n < chord.notes.length; n++) {
      var freq = midiToHz(chord.notes[n]);
      for (var d = 0; d < detunes.length; d++) {
        var osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detunes[d] + (Math.random() * 4 - 2);
        osc.connect(detunes[d] < 0 ? left : detunes[d] > 0 ? right : filter);
        osc.start(time);
        osc.stop(stopAt);
        nodes.push(osc);
        last = osc;
      }
    }

    // All saws stop together: when the last one ends, unhook everything
    // (including the link from the shared LFO).
    last.onended = function () {
      try { lfoDepth.disconnect(filter.frequency); } catch (e) { /* ignore */ }
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch (e) { /* ignore */ }
      }
    };
  }

  // Rhodes-like electric piano: 2-operator FM whose brightness decays fast.
  function rhodesNote(t, midi, vel) {
    var f = midiToHz(midi);
    var dur = 2.4;

    var car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = f;

    var mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = f;           // 1:1 ratio = warm, piano-ish
    var modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 2.2 * vel, t);
    modGain.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.8);

    var env = ctx.createGain();
    envPerc(env.gain, t, RHODES_LEVEL * vel, 0.006, dur);

    var panner = makePanner(Math.random() * 1.2 - 0.6);

    mod.connect(modGain);
    modGain.connect(car.frequency);
    car.connect(env);
    env.connect(panner);
    panner.connect(musicBus);
    panner.connect(rhodesVerb);
    panner.connect(rhodesEcho);

    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.05);
    mod.stop(t + dur + 0.05);
    cleanupWhenDone(car, [car, mod, modGain, env, panner]);
  }

  // Decide (once per bar) whether the Rhodes plays, and what.
  function planRhodes(section) {
    rhodesPlan = {};
    var prob = 0.3;
    if (section === 'breakdown') prob = 0.8;
    if (section === 'intro') prob = sectionBar >= 2 ? 0.3 : 0;
    if (Math.random() >= prob) return;

    // Chord tones, one octave up.
    var notes = currentChord().notes;
    var tones = [];
    for (var i = 0; i < notes.length; i++) tones.push(notes[i] + 12);

    if (section === 'breakdown' || Math.random() < 0.4) {
      // A few single notes, loosely arpeggiated.
      var steps = pick([[2, 6, 10], [0, 3, 6, 9], [6, 10, 14], [2, 11]]);
      for (var s = 0; s < steps.length; s++) rhodesPlan[steps[s]] = [pick(tones)];
    } else {
      // A stab: 3 chord tones together on an offbeat.
      var start = Math.floor(Math.random() * 2);
      rhodesPlan[pick([6, 10, 14])] = [tones[start], tones[start + 2], tones[start + 3]];
    }
  }

  /* ------------------------------------------------------------------ */
  /* 7. Music: arrangement + lookahead scheduler                         */
  /* ------------------------------------------------------------------ */

  // Drum bus filter moves at the start of each section.
  function startOfSection(time, section) {
    var f = drumFilter.frequency;
    f.cancelScheduledValues(time);
    if (section === 'intro') {
      f.setValueAtTime(700, time);
      f.linearRampToValueAtTime(1600, time + BAR * 8);
    } else if (section === 'breakdown') {
      f.setValueAtTime(5000, time);
      f.exponentialRampToValueAtTime(1800, time + BAR);
    } else {
      // The breaks come back in: sweep the filter wide open over 2 bars.
      f.setValueAtTime(350, time);
      f.exponentialRampToValueAtTime(9000, time + BAR * 2);
    }
  }

  // Pick the next drum pattern (sometimes keep the current one rolling).
  function choosePattern(section) {
    if (Math.random() < 0.4) return;
    var choices = section === 'full' ? 3 : PATTERNS.length;   // full2 uses all
    var next = Math.floor(Math.random() * choices);
    if (next === patternIndex) next = (next + 1) % choices;
    patternIndex = next;
  }

  function chooseFill(section) {
    var isLast = sectionBar === SECTIONS[sectionIndex].bars - 1;
    if (section === 'intro') return isLast ? 'stutter' : null;
    if (section === 'breakdown') return isLast ? 'roll' : null;
    if ((sectionBar + 1) % 8 === 0) return Math.random() < 0.6 ? 'chop' : 'roll';
    if ((sectionBar + 1) % 4 === 0) return 'stutter';
    if (section === 'full2' && Math.random() < 0.12) return 'stutter';
    return null;
  }

  function startOfBar(time, section) {
    if (sectionBar === 0) startOfSection(time, section);

    // Last bar of the breakdown: open the drum filter a little for the roll.
    if (section === 'breakdown' && sectionBar === SECTIONS[sectionIndex].bars - 1) {
      drumFilter.frequency.cancelScheduledValues(time);
      drumFilter.frequency.setValueAtTime(1800, time);
      drumFilter.frequency.exponentialRampToValueAtTime(4000, time + BAR);
    }

    if (bar % 2 === 0) schedulePad(currentChord(), time, section);
    if (bar % 2 === 0) choosePattern(section);
    fillKind = chooseFill(section);
    planRhodes(section);
  }

  // Schedule everything that happens on the current 16th step.
  function scheduleStep(time) {
    var section = SECTIONS[sectionIndex].name;
    if (step === 0) startOfBar(time, section);

    var t = time + ((step % 2) ? SIXTEENTH * SWING : 0);   // shuffle odd steps

    scheduleDrums(time, t, section);
    if (section === 'full' || section === 'full2') scheduleSub(time);

    var notes = rhodesPlan[step];
    if (notes) {
      for (var i = 0; i < notes.length; i++) {
        rhodesNote(t + i * 0.012, notes[i], 0.6 + Math.random() * 0.3);   // tiny strum
      }
    }
  }

  // Move the counters forward by one 16th note.
  function advanceStep() {
    step++;
    if (step < 16) return;
    step = 0;
    bar++;
    sectionBar++;
    if (sectionBar >= SECTIONS[sectionIndex].bars) {
      sectionBar = 0;
      sectionIndex++;
      if (sectionIndex >= SECTIONS.length) sectionIndex = LOOP_TO;
    }
  }

  function resetArrangement() {
    step = 0;
    bar = 0;
    sectionIndex = 0;
    sectionBar = 0;
    patternIndex = 0;
    fillKind = null;
    rhodesPlan = {};
  }

  // Called every TICK_MS: schedule every step due within the lookahead window.
  function schedulerTick() {
    if (!ctx) return;
    // If we fell behind (e.g. tab was throttled), jump forward instead of
    // trying to play a backlog of notes all at once.
    if (nextStepTime < ctx.currentTime - 0.05) nextStepTime = ctx.currentTime + 0.05;
    var horizon = ctx.currentTime + LOOKAHEAD;
    while (nextStepTime < horizon) {
      try {
        scheduleStep(nextStepTime);
      } catch (e) { /* never throw — skip this step */ }
      advanceStep();
      nextStepTime += SIXTEENTH;
    }
  }

  // The crackle loop runs whenever the scheduler runs.
  function startCrackle() {
    if (crackleSrc || !crackleBuffer) return;
    try {
      crackleSrc = ctx.createBufferSource();
      crackleSrc.buffer = crackleBuffer;
      crackleSrc.loop = true;
      crackleSrc.connect(crackleIn);
      crackleSrc.start(ctx.currentTime + 0.01, Math.random() * crackleBuffer.duration * 0.9);
    } catch (e) {
      crackleSrc = null;
    }
  }

  function stopCrackle() {
    if (!crackleSrc) return;
    try { crackleSrc.stop(); } catch (e) { /* ignore */ }
    try { crackleSrc.disconnect(); } catch (e) { /* ignore */ }
    crackleSrc = null;
  }

  function startScheduler() {
    if (schedulerId !== null || !ctx) return;
    startCrackle();
    schedulerTick();
    schedulerId = window.setInterval(schedulerTick, TICK_MS);
  }

  function stopScheduler() {
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
    stopCrackle();
  }

  /* The background song: an mp3 looped seamlessly through Web Audio.
     If it can't be loaded, the synthesized jungle music plays instead. */
  function loadTrack() {
    if (trackState !== 'idle') return;
    trackState = 'loading';
    var ver = (document.querySelector('script[src*="audio.js"]') || {}).src || '';
    var q = (ver.match(/\?v=\d+/) || [''])[0];
    window.fetch(TRACK_URL + q)
      .then(function (r) { if (!r.ok) throw new Error('track ' + r.status); return r.arrayBuffer(); })
      .then(function (data) {
        return new Promise(function (ok, bad) { ctx.decodeAudioData(data, ok, bad); });
      })
      .then(function (buf) {
        trackBuffer = buf;
        trackState = 'ready';
        if (musicPlaying && stopTimeoutId === null) playTrack();
      })
      .then(null, function () {
        trackState = 'failed';
        if (musicPlaying && stopTimeoutId === null) rampTo(musicBus.gain, MUSIC_LEVEL, FADE_TIME);
        if (musicPlaying && stopTimeoutId === null && !document.hidden) startScheduler();
      });
  }

  function playTrack() {
    if (trackSrc || !trackBuffer) return;
    stopScheduler();                       // the track replaces the synth
    trackSrc = ctx.createBufferSource();
    trackSrc.buffer = trackBuffer;
    trackSrc.loop = true;
    trackSrc.connect(musicBus);
    trackSrc.start(ctx.currentTime + 0.05);
  }

  function stopTrack() {
    if (!trackSrc) return;
    try { trackSrc.stop(); } catch (e) { /* ignore */ }
    try { trackSrc.disconnect(); } catch (e) { /* ignore */ }
    trackSrc = null;
  }

  function startMusic() {
    if (!ctx || !unlocked) return;
    if (stopTimeoutId !== null) {          // cancel a pending fade-out stop
      window.clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
    if (!musicPlaying) {
      musicPlaying = true;
      resetArrangement();                  // always start from the intro
      nextStepTime = ctx.currentTime + 0.1;
    }
    if (trackState === 'idle') loadTrack();
    rampTo(musicBus.gain, trackState === 'failed' ? MUSIC_LEVEL : TRACK_LEVEL, FADE_TIME);
    if (trackState === 'ready') playTrack();
    else if (trackState === 'failed' && !document.hidden) startScheduler();
  }

  function stopMusic() {
    if (!ctx || !musicPlaying) return;
    rampTo(musicBus.gain, 0, FADE_TIME);
    if (stopTimeoutId !== null) window.clearTimeout(stopTimeoutId);
    // After the fade finishes, stop scheduling new notes.
    stopTimeoutId = window.setTimeout(function () {
      stopTimeoutId = null;
      musicPlaying = false;
      stopScheduler();
      stopTrack();
    }, FADE_TIME * 1000 + 50);
  }

  // Pause scheduling while the tab is hidden; resume when visible again.
  document.addEventListener('visibilitychange', function () {
    try {
      if (document.hidden) {
        stopScheduler();
      } else if (musicPlaying && stopTimeoutId === null && trackState === 'failed') {
        startScheduler();
      }
    } catch (e) { /* never throw */ }
  });


  /* ------------------------------------------------------------------ */
  /* 7b. Rain: a steady storm bed under the music                        */
  /* ------------------------------------------------------------------ */

  // Stereo pink noise (-3 dB/octave, like real rain's broad spectrum); each side
  // is different so the rain is wide, and it loops.
  function makeRainNoise(seconds) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < length; i++) {
        var w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  // Nov-Feb the weather is snow (same rule as js/rain.js, which can also force it with ?weather=).
  function isSnowSeason() {
    if (window.RainFX && RainFX.weather) return RainFX.weather() === 'snow';
    var m = new Date().getMonth();
    return m >= 10 || m <= 1;
  }

  function startRain() {
    if (!ctx || !unlocked || !rainBus) return;
    if (!rainSrc) {
      if (!rainBuffer) rainBuffer = makeRainNoise(6);
      rainSrc = ctx.createBufferSource();
      rainSrc.buffer = rainBuffer;
      rainSrc.loop = true;

      if (isSnowSeason()) {
        // Snow: no hiss of drops, just a soft muted wind. Two low band-passed
        // layers whose levels and pitch drift slowly, like gusts around a corner.
        var windLP = ctx.createBiquadFilter();
        windLP.type = 'lowpass';
        windLP.frequency.value = 520;
        var windBP = ctx.createBiquadFilter();
        windBP.type = 'bandpass';
        windBP.frequency.value = 260;
        windBP.Q.value = 0.8;
        var windGain = ctx.createGain();
        windGain.gain.value = 0.5;
        rainSrc.connect(windLP);
        windLP.connect(windBP);
        windBP.connect(windGain);
        windGain.connect(rainBus);

        var gustW = ctx.createOscillator();
        gustW.type = 'sine';
        gustW.frequency.value = 0.09;
        var gustWDepth = ctx.createGain();
        gustWDepth.gain.value = 0.28;
        gustW.connect(gustWDepth);
        gustWDepth.connect(windGain.gain);
        var gustF = ctx.createGain();
        gustF.gain.value = 140;
        gustW.connect(gustF);
        gustF.connect(windBP.frequency);
        gustW.start();
        rainSrc._gust = gustW;
        rainSrc.start(0, Math.random() * 5);
        rampTo(rainBus.gain, RAIN_LEVEL * 0.8, FADE_TIME);
        return;
      }

      // A rounded spectrum: warm low rumble, a full body in the low mids,
      // soft patter in the upper mids and only a little air on top.
      var gains = [];
      [
        ['lowpass', 220, 0.7, 0.9],      // distant rumble
        ['bandpass', 600, 0.6, 1.6],     // body of the downpour
        ['bandpass', 1800, 0.7, 0.8],    // patter
        ['lowpass', 4200, 0.5, 0.18]     // a touch of air, rolled off
      ].forEach(function (b) {
        var f = ctx.createBiquadFilter();
        f.type = b[0];
        f.frequency.value = b[1];
        f.Q.value = b[2];
        var g = ctx.createGain();
        g.gain.value = b[3];
        rainSrc.connect(f);
        f.connect(g);
        g.connect(rainBus);
        gains.push(g);
      });
      var hissGain = gains[2];

      // Gusts: a slow LFO nudges the hiss level up and down.
      var gust = ctx.createOscillator();
      gust.type = 'sine';
      gust.frequency.value = 0.07;
      var gustDepth = ctx.createGain();
      gustDepth.gain.value = 0.2;
      gust.connect(gustDepth);
      gustDepth.connect(hissGain.gain);
      gust.start();
      rainSrc._gust = gust;

      rainSrc.start(0, Math.random() * 5);
    }
    rampTo(rainBus.gain, RAIN_LEVEL, FADE_TIME);
  }

  function stopRain() {
    if (!ctx || !rainBus || !rainSrc) return;
    rampTo(rainBus.gain, 0, FADE_TIME);
    var src = rainSrc;
    rainSrc = null;
    window.setTimeout(function () {
      try { src.stop(); src._gust.stop(); } catch (e) { /* ignore */ }
    }, FADE_TIME * 1000 + 100);
  }

  // One drop tapping the glass: a soft little tick. `size` 0..1, `pan` -1..1.
  function glassTap(size, pan) {
    var t = ctx.currentTime;
    if (t - lastTapTime < 0.12) return;      // at most ~8 a second
    lastTapTime = t;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loopStart = 0;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800 + Math.random() * 1400;
    bp.Q.value = 1.5 + Math.random() * 2;
    var g = ctx.createGain();
    var peak = 0.1 + 0.25 * size;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03 + 0.03 * size);
    var p = makePanner(pan);
    src.connect(bp);
    bp.connect(g);
    g.connect(p);
    p.connect(rainBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.1);
    cleanupWhenDone(src, [src, bp, g, p]);
  }

  /* ------------------------------------------------------------------ */
  /* 8. Sound effects                                                    */
  /* ------------------------------------------------------------------ */

  // Short digital "blip": oscillator -> lowpass -> fast envelope -> sfxBus.
  function blip(freq, start, dur, peak, type, cutoff, pan) {
    var osc = ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.8;
    var env = ctx.createGain();
    envPerc(env.gain, start, peak, 0.004, dur);
    var panner = makePanner(pan || 0);
    osc.connect(lp);
    lp.connect(env);
    env.connect(panner);
    panner.connect(sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    cleanupWhenDone(osc, [osc, lp, env, panner]);
  }

  // A chord stab of detuned saws with a closing filter (used by 'start').
  // `mult` shifts the whole chord (2 = an octave up).
  function stab(notes, start, dur, peak, cutoff, mult) {
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.25, start + dur);
    var env = ctx.createGain();
    envPerc(env.gain, start, peak, 0.005, dur);
    filter.connect(env);
    env.connect(sfxBus);

    var nodes = [filter, env];
    var last = null;
    for (var i = 0; i < notes.length; i++) {
      for (var d = -1; d <= 1; d += 2) {
        var osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToHz(notes[i]) * mult;
        osc.detune.value = d * 8;
        osc.connect(filter);
        osc.start(start);
        osc.stop(start + dur + 0.05);
        nodes.push(osc);
        last = osc;
      }
    }
    cleanupWhenDone(last, nodes);
  }

  var SFX = {
    // Low-mid "thock" for moving through the menu (~60ms).
    move: function (t) {
      noiseHit(t, 0.025, 'bandpass', 2600, 1.2, 0.1, sfxBus, 0);
      oscHit(t, 'sine', 210, 120, 0.04, 0.06, 0.25, sfxBus, 0);
    },

    // Crisp rising two-note digital blip with a tiny echo (~0.3s).
    open: function (t) {
      blip(midiToHz(57), t, 0.1, 0.05, 'triangle', 1500, 0);        // A3 body
      blip(midiToHz(69), t, 0.11, 0.07, 'square', 2200, -0.15);     // A4
      blip(midiToHz(76), t + 0.075, 0.16, 0.075, 'square', 2600, 0.15); // E5
      // tiny delay
      blip(midiToHz(69), t + 0.11, 0.1, 0.02, 'square', 1600, 0.4);
      blip(midiToHz(76), t + 0.185, 0.12, 0.022, 'square', 1800, -0.4);
    },

    // Softer, descending version of 'open'.
    close: function (t) {
      blip(midiToHz(76), t, 0.09, 0.05, 'triangle', 1800, 0.15);    // E5
      blip(midiToHz(69), t + 0.07, 0.14, 0.05, 'square', 1400, -0.15); // A4
      // tiny delay
      blip(midiToHz(69), t + 0.17, 0.1, 0.015, 'square', 1100, 0.35);
    },

    // Airy "blade" whoosh: noise through a sweeping band-pass, panned L -> R.
    swoosh: function (t) {
      var dur = 0.4;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(700, t);
      bp.frequency.exponentialRampToValueAtTime(5200, t + dur * 0.5);
      bp.frequency.exponentialRampToValueAtTime(1400, t + dur);
      var hp = ctx.createBiquadFilter();   // keeps it thin and "bladey"
      hp.type = 'highpass';
      hp.frequency.value = 400;
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.45);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var panner = makePanner(-0.8);
      if (panner.pan) {
        panner.pan.setValueAtTime(-0.8, t);
        panner.pan.linearRampToValueAtTime(0.8, t + dur);
      }
      src.connect(bp);
      bp.connect(hp);
      hp.connect(env);
      env.connect(panner);
      panner.connect(sfxBus);
      src.start(t);
      src.stop(t + dur + 0.05);
      cleanupWhenDone(src, [src, bp, hp, env, panner]);
    },

    // Deep, slightly glitchy boot sting (~1.5s): noise riser -> sub drop +
    // a minor chord stab with a couple of stuttered retriggers.
    start: function (t) {
      var hit = t + 0.42;

      // 1. Filtered noise riser leading into the hit.
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3;
      bp.frequency.setValueAtTime(250, t);
      bp.frequency.exponentialRampToValueAtTime(3500, hit);
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.14, hit - 0.01);
      env.gain.linearRampToValueAtTime(0.0001, hit + 0.02);
      src.connect(bp);
      bp.connect(env);
      env.connect(sfxBus);
      src.start(t);
      src.stop(hit + 0.05);
      cleanupWhenDone(src, [src, bp, env]);

      // 2. Sub drop + a dull thump on the hit.
      oscHit(hit, 'sine', 120, 32, 0.8, 1.05, 0.5, sfxBus, 0);
      noiseHit(hit, 0.03, 'lowpass', 1800, 0.7, 0.25, sfxBus, 0);

      // 3. F minor (add9) stab: two short stutters (one an octave up),
      //    a third retrigger, then the full stab rings out.
      var chord = [53, 56, 60, 67];   // F3 Ab3 C4 G4
      stab(chord, hit, 0.05, 0.035, 2600, 1);
      stab(chord, hit + 0.07, 0.04, 0.025, 2200, 2);
      stab(chord, hit + 0.12, 0.04, 0.03, 2000, 1);
      stab(chord, hit + 0.18, 0.9, 0.035, 2400, 1);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 9. Public API                                                       */
  /* ------------------------------------------------------------------ */

  window.Sound = {
    unlock: function () {
      try {
        if (!AC) return Promise.resolve();
        if (!ctx) buildGraph();
        var afterResume = function () {
          unlocked = true;
          if (prefs.music && !musicPlaying) startMusic();
          if (prefs.rain) startRain();
        };
        if (ctx.state === 'suspended' && ctx.resume) {
          return ctx.resume().then(afterResume, function () { /* ignore */ })
            .then(null, function () { /* ignore */ });
        }
        afterResume();
        return Promise.resolve();
      } catch (e) {
        return Promise.resolve();
      }
    },

    play: function (name) {
      try {
        if (!ctx || !unlocked || !prefs.sfx) return;
        if (ctx.state !== 'running') return;
        var fn = SFX[name];
        if (fn) fn(ctx.currentTime + 0.01);
      } catch (e) { /* never throw */ }
    },

    setMusic: function (on) {
      prefs.music = !!on;
      writePref('xmb.music', prefs.music ? 'on' : 'off');
      try {
        if (prefs.music) startMusic(); else stopMusic();
      } catch (e) { /* never throw */ }
    },

    isMusicOn: function () {
      return prefs.music;
    },

    setVolume: function (v) {
      prefs.volume = clamp01(v);
      writePref('xmb.volume', prefs.volume);
      try {
        if (master) rampTo(master.gain, prefs.volume, 0.15);
      } catch (e) { /* never throw */ }
    },

    getVolume: function () {
      return prefs.volume;
    },

    setSfx: function (on) {
      prefs.sfx = !!on;
      writePref('xmb.sfx', prefs.sfx ? 'on' : 'off');
    },

    isSfxOn: function () {
      return prefs.sfx;
    },

    setRain: function (on) {
      prefs.rain = !!on;
      writePref('xmb.rain', prefs.rain ? 'on' : 'off');
      try {
        if (prefs.rain) startRain(); else stopRain();
      } catch (e) { /* never throw */ }
    },

    // The weather switched between rain and snow: restart the weather sound in the new style.
    refreshWeather: function () {
      try {
        if (ctx && unlocked && prefs.rain && rainSrc) {
          var old = rainSrc;
          rainSrc = null;
          try { old.disconnect(); old._gust.stop(); old.stop(); } catch (e) { /* ignore */ }
          startRain();
        }
      } catch (e) { /* never throw */ }
    },

    isRainOn: function () {
      return prefs.rain;
    },

    // A raindrop landing on the glass. size 0..1, pan -1 (left) .. 1 (right).
    tap: function (size, pan) {
      try {
        if (!ctx || !unlocked || !prefs.rain || !rainSrc || ctx.state !== 'running' || isSnowSeason()) return;
        glassTap(size || 0.5, Math.max(-1, Math.min(1, pan || 0)));
      } catch (e) { /* never throw */ }
    }
  };
})();
