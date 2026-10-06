/*
 * audio.js — live-synthesized sound for the XMB / Frutiger Aero resume site.
 *
 * Everything you hear is generated in real time with the Web Audio API:
 * no audio files, nothing copyrighted. Load with a classic <script> tag;
 * it exposes a single global object: window.Sound
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
  var musicBus = null;     // ambient music goes here (used for 2s fades)
  var reverbIn = null;     // send into the convolution reverb
  var lfo = null;          // slow LFO that sweeps the music filters
  var lfoDepth = null;     // how far (in Hz) the LFO moves each filter
  var noiseBuffer = null;  // 1s of white noise, reused for 'swoosh'

  var MUSIC_LEVEL = 0.22;  // music is background: much quieter than sfx
  var FADE_TIME = 2;       // seconds for music fade in/out

  // Music scheduler state
  var musicPlaying = false;   // is the scheduler running (or fading in)?
  var schedulerId = null;     // setInterval handle
  var stopTimeoutId = null;   // pending "fully stop after fade-out" timer
  var nextChordTime = 0;      // AudioContext time of the next chord
  var nextSparkleTime = 0;    // AudioContext time of the next sparkle
  var chordIndex = 0;

  var LOOKAHEAD = 1.5;        // schedule this many seconds ahead
  var TICK_MS = 200;          // how often the scheduler wakes up

  // Chord loop: Fmaj7 -> Em7 -> Dm9 -> Cmaj7 (MIDI note numbers).
  // Not taken from any existing tune — just lush, common 7th/9th voicings.
  var CHORDS = [
    [41, 53, 57, 60, 64],      // Fmaj7  : F2  F3 A3 C4 E4
    [40, 52, 55, 59, 62],      // Em7    : E2  E3 G3 B3 D4
    [38, 50, 53, 57, 64],      // Dm9    : D2  D3 F3 A3 E4
    [36, 48, 52, 55, 59, 62]   // Cmaj7(9): C2 C3 E3 G3 B3 D4
  ];
  var CHORD_LEN = 7;          // seconds between chord starts
  var CHORD_ATTACK = 3;       // slow swell in
  var CHORD_RELEASE = 4;      // slow fade out (overlaps the next chord)

  // C major pentatonic, high octave, for the glassy "sparkle" notes.
  var SPARKLE_NOTES = [84, 86, 88, 91, 93, 96, 98, 100];

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

  /* ------------------------------------------------------------------ */
  /* 4. Build the audio graph (once, on first unlock)                    */
  /* ------------------------------------------------------------------ */
  /*
   *   sfx  ---> sfxBus ---+
   *                       +--> master --> compressor --> speakers
   *   music --> musicBus -+       ^
   *     \__________________ reverb (convolver) --+
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

    // Reverb: send -> convolver -> return -> master
    reverbIn = ctx.createGain();
    var convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(4, 3);
    var reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.6;
    reverbIn.connect(convolver);
    convolver.connect(reverbOut);
    reverbOut.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    var sfxSend = ctx.createGain();   // a touch of reverb on sfx
    sfxSend.gain.value = 0.25;
    sfxBus.connect(sfxSend);
    sfxSend.connect(reverbIn);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;           // starts silent; faded in by setMusic
    musicBus.connect(master);
    var musicSend = ctx.createGain();  // music is quite "wet"
    musicSend.gain.value = 0.7;
    musicBus.connect(musicSend);
    musicSend.connect(reverbIn);

    // One slow LFO (one cycle every ~20s) shared by every music voice filter.
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05;
    lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 500;         // +/- 500 Hz cutoff sweep
    lfo.connect(lfoDepth);
    lfo.start();

    noiseBuffer = makeNoise(1);
  }

  /* ------------------------------------------------------------------ */
  /* 5. Ambient music                                                    */
  /* ------------------------------------------------------------------ */

  // One pad voice: sine + detuned triangle -> lowpass (LFO swept) -> pan -> musicBus
  function scheduleVoice(midi, start, dur, level, pan) {
    var freq = midiToHz(midi);
    var end = start + dur;

    var osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    osc1.detune.value = -5;

    var osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq;
    osc2.detune.value = 6;

    var mix2 = ctx.createGain();       // triangle a bit quieter than the sine
    mix2.gain.value = 0.5;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;
    lfoDepth.connect(filter.frequency);

    var env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(level, start + CHORD_ATTACK);
    env.gain.setValueAtTime(level, end - CHORD_RELEASE);
    env.gain.linearRampToValueAtTime(0, end);

    var panner = makePanner(pan);

    osc1.connect(filter);
    osc2.connect(mix2);
    mix2.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(musicBus);

    osc1.start(start);
    osc2.start(start);
    osc1.stop(end + 0.05);
    osc2.stop(end + 0.05);

    // When finished, unhook everything (including the shared LFO link).
    osc2.onended = function () {
      try { lfoDepth.disconnect(filter.frequency); } catch (e) { /* ignore */ }
      var nodes = [osc1, osc2, mix2, filter, env, panner];
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch (e) { /* ignore */ }
      }
    };
  }

  function scheduleChord(time) {
    var chord = CHORDS[chordIndex % CHORDS.length];
    var dur = CHORD_LEN + CHORD_RELEASE;   // overlaps into the next chord
    for (var i = 0; i < chord.length; i++) {
      // Spread notes across the stereo field; the bass stays centred.
      var pan = i === 0 ? 0 : (i % 2 ? -1 : 1) * (0.25 + 0.1 * i);
      pan = Math.max(-0.8, Math.min(0.8, pan));
      var level = i === 0 ? 0.09 : 0.06;
      scheduleVoice(chord[i], time, dur, level, pan);
    }
    chordIndex++;
  }

  // A soft, high glass-chime note with a long reverb tail.
  function scheduleSparkle(time) {
    var midi = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
    var freq = midiToHz(midi);
    var dur = 3;

    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    var env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.035, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    var panner = makePanner(Math.random() * 1.4 - 0.7);
    var wet = ctx.createGain();       // extra reverb send for a long tail
    wet.gain.value = 1.2;

    osc.connect(env);
    env.connect(panner);
    panner.connect(musicBus);
    env.connect(wet);
    wet.connect(reverbIn);

    osc.start(time);
    osc.stop(time + dur + 0.05);
    cleanupWhenDone(osc, [osc, env, panner, wet]);
  }

  // Called every TICK_MS: schedule anything due within the lookahead window.
  function schedulerTick() {
    if (!ctx) return;
    var horizon = ctx.currentTime + LOOKAHEAD;

    // If we fell behind (e.g. tab was throttled), jump forward instead of
    // trying to play a backlog of notes all at once.
    if (nextChordTime < ctx.currentTime) nextChordTime = ctx.currentTime + 0.1;
    if (nextSparkleTime < ctx.currentTime) nextSparkleTime = ctx.currentTime + 1 + Math.random() * 3;

    while (nextChordTime < horizon) {
      scheduleChord(nextChordTime);
      nextChordTime += CHORD_LEN;
    }
    while (nextSparkleTime < horizon) {
      scheduleSparkle(nextSparkleTime);
      nextSparkleTime += 3 + Math.random() * 6;   // every 3-9 seconds
    }
  }

  function startScheduler() {
    if (schedulerId !== null || !ctx) return;
    schedulerTick();
    schedulerId = window.setInterval(schedulerTick, TICK_MS);
  }

  function stopScheduler() {
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
  }

  function startMusic() {
    if (!ctx || !unlocked) return;
    if (stopTimeoutId !== null) {          // cancel a pending fade-out stop
      window.clearTimeout(stopTimeoutId);
      stopTimeoutId = null;
    }
    if (!musicPlaying) {
      musicPlaying = true;
      nextChordTime = Math.max(nextChordTime, ctx.currentTime + 0.1);
      nextSparkleTime = ctx.currentTime + 2 + Math.random() * 3;
    }
    rampTo(musicBus.gain, MUSIC_LEVEL, FADE_TIME);
    if (!document.hidden) startScheduler();
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
    }, FADE_TIME * 1000 + 50);
  }

  // Pause scheduling while the tab is hidden; resume when visible again.
  document.addEventListener('visibilitychange', function () {
    try {
      if (document.hidden) {
        stopScheduler();
      } else if (musicPlaying && stopTimeoutId === null) {
        startScheduler();
      }
    } catch (e) { /* never throw */ }
  });

  /* ------------------------------------------------------------------ */
  /* 6. Sound effects                                                    */
  /* ------------------------------------------------------------------ */

  // Generic short tone with a fast attack and exponential decay.
  function tone(freq, start, dur, peak, type, pan) {
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    var panner = makePanner(pan || 0);
    osc.connect(env);
    env.connect(panner);
    panner.connect(sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    cleanupWhenDone(osc, [osc, env, panner]);
    return osc;
  }

  // A glassy bell = fundamental + inharmonic partial (ratio ~2.76).
  function bell(freq, start, dur, peak, pan) {
    tone(freq, start, dur, peak, 'sine', pan);
    tone(freq * 2.76, start, dur * 0.5, peak * 0.3, 'sine', pan);
    tone(freq * 5.4, start, dur * 0.25, peak * 0.1, 'sine', pan);
  }

  var SFX = {
    // Short soft tick for moving through the menu.
    move: function (t) {
      tone(1320, t, 0.06, 0.12, 'sine');
      tone(2640, t, 0.03, 0.03, 'triangle');
    },

    // Bright, rising glassy chime (~0.6s).
    open: function (t) {
      bell(midiToHz(88), t, 0.6, 0.16, -0.2);         // E6
      bell(midiToHz(95), t + 0.07, 0.55, 0.13, 0.2);  // B6
    },

    // Softer, descending version of 'open'.
    close: function (t) {
      bell(midiToHz(83), t, 0.5, 0.11, 0.2);          // B5
      bell(midiToHz(76), t + 0.07, 0.5, 0.09, -0.2);  // E5
    },

    // Airy whoosh: noise through a sweeping band-pass, panned across (~0.5s).
    swoosh: function (t) {
      var dur = 0.5;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.55);
      bp.frequency.exponentialRampToValueAtTime(900, t + dur);
      var env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.4);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      var panner = makePanner(-0.6);
      if (panner.pan) panner.pan.linearRampToValueAtTime(0.6, t + dur);
      src.connect(bp);
      bp.connect(env);
      env.connect(panner);
      panner.connect(sfxBus);
      src.start(t);
      src.stop(t + dur + 0.05);
      cleanupWhenDone(src, [src, bp, env, panner]);
    },

    // Pleasant boot chime: rising Cmaj9 arpeggio over a soft pad (~1.5s).
    start: function (t) {
      var notes = [72, 76, 79, 83, 86];   // C5 E5 G5 B5 D6
      for (var i = 0; i < notes.length; i++) {
        var pan = (i / (notes.length - 1)) * 1.2 - 0.6;
        bell(midiToHz(notes[i]), t + i * 0.11, 1.4 - i * 0.1, 0.12, pan);
      }
      // Warm pad underneath
      tone(midiToHz(48), t, 1.5, 0.08, 'triangle', 0);
      tone(midiToHz(55), t + 0.05, 1.5, 0.05, 'sine', 0);
      tone(midiToHz(64), t + 0.1, 1.5, 0.04, 'sine', 0);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 7. Public API                                                       */
  /* ------------------------------------------------------------------ */

  window.Sound = {
    unlock: function () {
      try {
        if (!AC) return Promise.resolve();
        if (!ctx) buildGraph();
        var afterResume = function () {
          unlocked = true;
          if (prefs.music && !musicPlaying) startMusic();
        };
        if (ctx.state === 'suspended' && ctx.resume) {
          return ctx.resume().then(afterResume, function () { /* ignore */ });
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
    }
  };
})();
