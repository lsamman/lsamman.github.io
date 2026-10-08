/*
 * rain.js — a perpetual rainstorm seen through a window.
 *
 * A full-screen canvas sits just above the city but behind the whole GUI (it's the glass): streaks of rain
 * fall outside, and beads of water collect on the pane, slide down in
 * stop-and-go jerks, leave trails and merge. Big drops landing on the glass
 * tap out a sound through Sound.tap() (js/audio.js).
 *
 * Seasonal: from November to February the rain turns to snow (a blowing
 * snowstorm with distant white mist; the city gets snow on its roofs through
 * Scene.setSnow). From March to October it rains. The menu can switch between
 * them until the season changes; ?weather=snow or ?weather=rain in the address
 * forces one.
 *
 * window.RainFX
 *   RainFX.setEnabled(bool)        RainFX.isEnabled()
 *   RainFX.setReducedMotion(bool)  (no streaks, a few still beads, no taps)
 *   RainFX.weather()               'rain' | 'snow'
 *   RainFX.setWeather(w)           switch until the season changes
 *
 * Preference: 'xmb.rain' (shared with the rain sound). Fails silently without
 * canvas support.
 */
(function () {
  'use strict';

  var MAX_DPR = 2;
  var MAX_DROPS = 110;
  var STREAKS_PER_MEGAPIXEL = 150;   // streak count scales with the screen
  var SPAWN_PER_SECOND = 9;

  var canvas = null, ctx = null;
  var W = 0, H = 0, dpr = 1;
  var enabled = true, reduced = false, hidden = false;
  var rafId = 0, lastTime = 0, spawnAcc = 0;
  var drops = [], streaks = [], trails = [];
  var sprite = null, SPRITE = 64;
  var mistSprite = null, mist = [];
  var hue = 200;
  var weather = seasonWeather(), clock = 0;
  var flakes = [], snowMist = [], flakeSprite = null, snowMistSprite = null;

  // Nov, Dec, Jan, Feb are snow; every other month is rain.
  function naturalWeather() {
    var month = new Date().getMonth();   // 0 = January
    return (month >= 10 || month <= 1) ? 'snow' : 'rain';
  }

  // The weather switch in the menu is a temporary override: it is saved as
  // "<choice>@<season it was made in>" and stops counting once the season
  // changes, so the sky always returns to what the date says.
  // ?weather=snow or ?weather=rain in the address wins over everything.
  function seasonWeather() {
    try {
      var m = /[?&]weather=(snow|rain)\b/.exec(window.location.search);
      if (m) return m[1];
    } catch (e) {}
    var nat = naturalWeather();
    try {
      var o = /^(snow|rain)@(snow|rain)$/.exec(window.localStorage.getItem('xmb.weather') || '');
      if (o && o[2] === nat) return o[1];
      if (o) window.localStorage.removeItem('xmb.weather');
    } catch (e) {}
    return nat;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function readEnabled() {
    try { return window.localStorage.getItem('xmb.rain') !== 'off'; } catch (e) { return true; }
  }

  // One water bead, pre-rendered: dark rim, clear centre, bright highlight.
  function makeSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    var g = c.getContext('2d');
    if (!g) return null;
    var r = SPRITE / 2;
    var body = g.createRadialGradient(r, r * 1.1, r * 0.2, r, r, r);
    body.addColorStop(0, 'rgba(200,225,255,0.10)');
    body.addColorStop(0.7, 'rgba(160,190,230,0.14)');
    body.addColorStop(0.92, 'rgba(10,20,35,0.45)');
    body.addColorStop(1, 'rgba(10,20,35,0)');
    g.fillStyle = body;
    g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
    // light refracted through the bottom of the bead
    var glow = g.createRadialGradient(r, r * 1.35, 0, r, r * 1.35, r * 0.7);
    glow.addColorStop(0, 'rgba(255,255,255,0.28)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(r, r, r * 0.9, 0, Math.PI * 2); g.fill();
    // specular highlight, top left
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.ellipse(r * 0.68, r * 0.62, r * 0.17, r * 0.11, -0.6, 0, Math.PI * 2); g.fill();
    return c;
  }

  // One soft puff of mist.
  function makeMistSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    if (!g) return null;
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(165,185,210,0.55)');
    grad.addColorStop(1, 'rgba(165,185,210,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  // Slow banks of rain-mist drifting in the distance, low over the city.
  function makeMist() {
    mist = [];
    var n = Math.max(6, Math.min(16, Math.round(W / 130)));
    for (var i = 0; i < n; i++) {
      mist.push({
        x: rnd(-200, W + 200), y: H * rnd(0.45, 0.85),
        r: rnd(180, 420), a: rnd(0.12, 0.3),
        v: rnd(4, 14) * (Math.random() < 0.5 ? -1 : 1)
      });
    }
  }

  // Soft round flake and a big soft puff of mist, pre-rendered.
  function makeSoftSprite(size, stops) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    if (!g) return null;
    var r = size / 2;
    var grad = g.createRadialGradient(r, r, 0, r, r, r);
    for (var i = 0; i < stops.length; i++) grad.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function makeFlakes() {
    var n = Math.round(520 * (W * H) / 1e6);
    n = Math.max(220, Math.min(800, n));
    if (reduced) n = Math.round(n / 4);
    flakes = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random();                 // 0 far .. 1 near
      flakes.push({
        x: rnd(-60, W + 60), y: rnd(-20, H),
        z: z,
        r: 1.6 + z * z * 7,
        v: 40 + z * 130,                     // fall speed
        ph: rnd(0, 6.28),                    // swirl phase
        sw: rnd(0.6, 1.8)                    // swirl speed
      });
    }
    // drifting banks of mist, thickest low down toward the horizon
    snowMist = [];
    for (var k = 0; k < 12; k++) {
      snowMist.push({
        x: rnd(-0.3, 1.1) * W, y: H * rnd(0.30, 0.92),
        w: W * rnd(0.5, 1.0), h: H * rnd(0.18, 0.34),
        v: rnd(6, 26) * (Math.random() < 0.8 ? -1 : 1),
        a: rnd(0.12, 0.28)
      });
    }
  }

  function drawSnow(dt) {
    // faint cold cast over the whole pane
    ctx.fillStyle = 'rgba(200,215,240,0.05)';
    ctx.fillRect(0, 0, W, H);

    // distant white mist
    for (var q = 0; q < snowMist.length; q++) {
      var b = snowMist[q];
      if (!reduced) {
        b.x += b.v * dt;
        if (b.x > W * 1.4) b.x = -b.w; else if (b.x < -b.w * 1.4) b.x = W;
      }
      ctx.globalAlpha = b.a;
      ctx.drawImage(snowMistSprite, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }
    var fog = ctx.createLinearGradient(0, H * 0.45, 0, H);
    fog.addColorStop(0, 'rgba(225,233,246,0)');
    fog.addColorStop(1, 'rgba(225,233,246,0.26)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = fog;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);

    // blowing snow: gusting wind pushes the flakes sideways, each one swirls
    var gust = Math.sin(clock * 0.21) * 0.5 + Math.sin(clock * 0.57) * 0.25 + 0.9;
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      if (!reduced) {
        f.y += (f.v + Math.sin(clock * f.sw + f.ph) * 30) * dt;
        f.x += (-(70 + f.z * 190) * gust + Math.cos(clock * f.sw * 1.3 + f.ph) * 40) * dt;
        if (f.y - f.r > H) { f.y = -f.r - rnd(0, 40); f.x = rnd(-60, W + 160); }
        if (f.x < -80) f.x = W + rnd(0, 80);
      }
      ctx.globalAlpha = 0.35 + f.z * 0.65;
      var sz = f.r * 2;
      ctx.drawImage(flakeSprite, f.x - f.r, f.y - f.r, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function makeStreaks() {
    var n = Math.round(STREAKS_PER_MEGAPIXEL * (W * H) / 1e6);
    n = Math.max(60, Math.min(260, n));
    streaks = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random();                 // 0 far .. 1 near
      streaks.push({
        x: rnd(-100, W + 100), y: rnd(-H, H),
        z: z,
        len: 12 + z * 46,
        v: 500 + z * 900
      });
    }
  }

  function newDrop(x, y, tapOK) {
    var big = Math.random() < 0.28;
    var r = big ? rnd(5, 11) : rnd(1.4, 4);
    var d = {
      x: x, y: y, r: r,
      vy: 0,
      slide: big && Math.random() < 0.8,   // some big drops get heavy enough to run
      wait: rnd(0.4, 3),                   // seconds before it lets go
      life: 0,
      age: rnd(25, 70)                     // the pane slowly dries and the bead fades
    };
    drops.push(d);
    if (tapOK && big && !reduced && window.Sound && Sound.tap) {
      Sound.tap(Math.min(1, r / 11), (x / W) * 2 - 1);
    }
    return d;
  }

  function seed() {
    drops = []; trails = [];
    if (weather === 'snow') return;
    var n = reduced ? 16 : 45;
    for (var i = 0; i < n; i++) newDrop(rnd(0, W), rnd(0, H), false).wait = rnd(0, 6);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (weather === 'snow') makeFlakes(); else { makeStreaks(); makeMist(); }
    seed();
  }

  function updateDrops(dt) {
    if (weather === 'snow') return;
    if (!reduced) {
      spawnAcc += dt * SPAWN_PER_SECOND;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        if (drops.length < MAX_DROPS) newDrop(rnd(0, W), rnd(0, H), true);
      }
    }
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.life += dt;
      if (reduced) continue;
      if (d.life > d.age) { drops.splice(i, 1); continue; }
      if (!d.slide) continue;
      d.wait -= dt;
      if (d.wait > 0) { d.vy = 0; continue; }
      // stop-and-go: accelerate, then stick again at random
      d.vy = Math.min(d.vy + (60 + d.r * 14) * dt, 70 + d.r * 22);
      var dy = d.vy * dt;
      d.y += dy;
      d.x += rnd(-8, 8) * dt;
      if (Math.random() < dt * 1.2) { d.wait = rnd(0.3, 1.6); d.vy = 0; }
      trails.push({ x: d.x, y: d.y - dy, y2: d.y, w: d.r * 0.7, a: 0.22 });
      // merge with a bead below
      for (var j = 0; j < drops.length; j++) {
        var o = drops[j];
        if (o === d) continue;
        var ddx = o.x - d.x, ddy = o.y - d.y;
        if (ddx * ddx + ddy * ddy < Math.pow((o.r + d.r) * 0.7, 2)) {
          var big = o.r > d.r ? o : d, small = big === o ? d : o;
          big.r = Math.min(12, Math.sqrt(big.r * big.r + small.r * small.r * 0.8));
          big.slide = true; big.wait = Math.min(big.wait, 0.1);
          drops.splice(drops.indexOf(small), 1);
          if (small === d) { i--; }
          break;
        }
      }
      if (d.y - d.r > H) {
        var k = drops.indexOf(d);
        if (k >= 0) drops.splice(k, 1);
      }
    }
    if (trails.length > 600) trails.splice(0, trails.length - 600);
    for (var t = trails.length - 1; t >= 0; t--) {
      trails[t].a -= dt * 0.1;
      if (trails[t].a <= 0) trails.splice(t, 1);
    }
  }

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    clock += dt;
    if (weather === 'snow') { drawSnow(dt); return; }

    // faint cool cast over the whole pane
    ctx.fillStyle = 'rgba(40,60,90,0.03)';
    ctx.fillRect(0, 0, W, H);

    // condensation near the bottom edge
    var fog = ctx.createLinearGradient(0, H * 0.7, 0, H);
    fog.addColorStop(0, 'rgba(150,175,205,0)');
    fog.addColorStop(1, 'rgba(150,175,205,0.10)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);

    // distant rain-mist: a haze over the skyline plus slow drifting banks
    var haze = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.9);
    haze.addColorStop(0, 'rgba(150,170,195,0)');
    haze.addColorStop(0.6, 'rgba(150,170,195,0.14)');
    haze.addColorStop(1, 'rgba(150,170,195,0.04)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * 0.3, W, H * 0.6);
    if (mistSprite) {
      for (var m = 0; m < mist.length; m++) {
        var p = mist[m];
        if (!reduced) {
          p.x += p.v * dt;
          if (p.x < -p.r - 100) p.x = W + p.r + 100;
          else if (p.x > W + p.r + 100) p.x = -p.r - 100;
        }
        ctx.globalAlpha = p.a;
        ctx.drawImage(mistSprite, p.x - p.r, p.y - p.r * 0.45, p.r * 2, p.r * 0.9);
      }
      ctx.globalAlpha = 1;
    }

    // rain falling outside
    if (!reduced) {
      var slant = 0.22;
      ctx.lineCap = 'round';
      for (var i = 0; i < streaks.length; i++) {
        var s = streaks[i];
        s.y += s.v * dt;
        s.x -= s.v * slant * dt;
        if (s.y - s.len > H) { s.y = -rnd(0, 80); s.x = rnd(-100, W + 100); }
        ctx.strokeStyle = 'hsla(' + hue + ',25%,82%,' + (0.05 + s.z * 0.2).toFixed(3) + ')';
        ctx.lineWidth = 0.6 + s.z * 1.1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len * slant, s.y - s.len);
        ctx.stroke();
      }
    }

    // wet trails left by running drops
    ctx.lineCap = 'butt';
    for (var t = 0; t < trails.length; t++) {
      var tr = trails[t];
      ctx.strokeStyle = 'rgba(190,215,245,' + tr.a.toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.8, tr.w);
      ctx.beginPath();
      ctx.moveTo(tr.x, tr.y);
      ctx.lineTo(tr.x, tr.y2);
      ctx.stroke();
    }

    // beads of water on the glass
    for (var j = 0; j < drops.length; j++) {
      var d = drops[j];
      var fade = reduced ? 1 : Math.min(1, d.life / 0.3, (d.age - d.life) / 4);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade;
      var sz = d.r * 2;
      // beads that are sliding stretch a little
      var stretch = d.vy > 5 ? 1.25 : 1.1;
      ctx.drawImage(sprite, d.x - d.r, d.y - d.r * stretch, sz, sz * stretch);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    rafId = 0;
    if (!enabled || hidden) return;
    var dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
    lastTime = now;
    updateDrops(dt);
    draw(dt);
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (!rafId && ctx && enabled && !hidden) {
      lastTime = 0;
      canvas.style.display = 'block';
      rafId = window.requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function init() {
    if (window.Scene && Scene.setSnow) Scene.setSnow(weather === 'snow');   // roofs, whatever the weather switch says
    canvas = document.getElementById('rain');
    if (!canvas || !canvas.getContext) return;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;
    sprite = makeSprite();
    mistSprite = makeMistSprite();
    flakeSprite = makeSoftSprite(32, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
    snowMistSprite = makeSoftSprite(256, [[0, 'rgba(235,241,250,1)'], [0.5, 'rgba(235,241,250,0.45)'], [1, 'rgba(235,241,250,0)']]);
    if (!sprite || !mistSprite || !flakeSprite || !snowMistSprite) { ctx = null; return; }
    enabled = readEnabled();
    reduced = document.documentElement.classList.contains('reduce-motion');
    var accent = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hue'));
    if (isFinite(accent)) hue = accent;
    hidden = !!document.hidden;
    resize();
    var timer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(resize, 150);
    });
    document.addEventListener('visibilitychange', function () {
      hidden = !!document.hidden;
      if (hidden) stop(); else start();
    });
    if (enabled) start(); else canvas.style.display = 'none';
  }

  window.RainFX = {
    setEnabled: function (on) {
      enabled = !!on;
      if (!ctx) return;
      if (enabled) { seed(); start(); }
      else { stop(); canvas.style.display = 'none'; }
    },
    isEnabled: function () { return enabled; },
    weather: function () { return weather; },
    // Switch between rain and snow until the season changes. Returns the new weather.
    setWeather: function (w) {
      if (w !== 'rain' && w !== 'snow') return weather;
      var nat = naturalWeather();
      try {
        if (w === nat) window.localStorage.removeItem('xmb.weather');
        else window.localStorage.setItem('xmb.weather', w + '@' + nat);
      } catch (e) {}
      if (w === weather) return weather;
      weather = w;
      if (window.Scene && Scene.setSnow) Scene.setSnow(weather === 'snow');
      if (window.Sound && Sound.refreshWeather) Sound.refreshWeather();
      if (ctx) { resize(); if (enabled) start(); }
      return weather;
    },
    setReducedMotion: function (b) {
      b = !!b;
      if (b === reduced) return;
      reduced = b;
      if (ctx) { if (weather === 'snow') makeFlakes(); seed(); if (!enabled || !rafId) { if (enabled) start(); } }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
