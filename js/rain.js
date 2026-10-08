/*
 * rain.js — a perpetual rainstorm seen through a window.
 *
 * A full-screen canvas sits just above the city but behind the whole GUI (it's the glass): streaks of rain
 * fall outside, and beads of water collect on the pane, slide down in
 * stop-and-go jerks, leave trails and merge. Big drops landing on the glass
 * tap out a sound through Sound.tap() (js/audio.js).
 *
 * window.RainFX
 *   RainFX.setEnabled(bool)        RainFX.isEnabled()
 *   RainFX.setReducedMotion(bool)  (no streaks, a few still beads, no taps)
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
    var n = reduced ? 16 : 45;
    for (var i = 0; i < n; i++) newDrop(rnd(0, W), rnd(0, H), false).wait = rnd(0, 6);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    makeStreaks();
    makeMist();
    seed();
  }

  function updateDrops(dt) {
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
    canvas = document.getElementById('rain');
    if (!canvas || !canvas.getContext) return;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;
    sprite = makeSprite();
    mistSprite = makeMistSprite();
    if (!sprite) { ctx = null; return; }
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
    setReducedMotion: function (b) {
      b = !!b;
      if (b === reduced) return;
      reduced = b;
      if (ctx) { seed(); if (!enabled || !rafId) { if (enabled) start(); } }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
