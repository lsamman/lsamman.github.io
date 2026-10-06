/*
 * waves.js — animated "PS3 XMB meets Frutiger Aero" background.
 *
 * Draws on a full-screen <canvas>:
 *   1. a sky gradient (the page background)
 *   2. a soft lens-flare glow in the upper-left, plus faint flare rings
 *   3. three translucent wave ribbons across the middle of the screen
 *   4. glassy bubbles drifting slowly upward
 *
 * Public API (attached to window):
 *   Waves.init(canvas)          start drawing on the canvas
 *   Waves.setHue(hue)           smoothly tween the palette to a new hue (0-360)
 *   Waves.setReducedMotion(b)   calmer mode: slow waves, no new bubbles, static flare
 *   Waves.setPaused(b)          pause / resume the animation loop
 *
 * Plain script, no libraries, no modules. Everything lives inside an IIFE
 * so only `window.Waves` leaks into the global scope.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  var DEFAULT_HUE = 200;        // sky blue / aqua
  var HUE_TWEEN_SECONDS = 1.5;  // how long setHue() takes to blend colours
  var BUBBLE_COUNT = 18;
  var MAX_DPR = 2;              // cap devicePixelRatio to keep 4K screens cheap
  var REDUCED_SPEED = 0.2;      // reduced motion => waves move 5x slower
  var RIBBON_STEP = 8;          // horizontal distance (CSS px) between wave points

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var canvas = null;
  var ctx = null;
  var width = 0;   // canvas size in CSS pixels
  var height = 0;
  var dpr = 1;

  var rafId = 0;
  var lastTime = 0;      // timestamp of the previous frame (ms)
  var waveTime = 0;      // seconds of "wave time" (slows down in reduced motion)
  var flareTime = 0;     // seconds of flare time (frozen in reduced motion)

  var userPaused = false;
  var tabHidden = false;
  var reducedMotion = false;

  // Hue tween: we blend from `hueFrom` to `hueTo` as `hueProgress` goes 0 -> 1.
  var hue = DEFAULT_HUE;
  var hueFrom = DEFAULT_HUE;
  var hueTo = DEFAULT_HUE;
  var hueProgress = 1;

  var bubbles = [];

  // Each ribbon is described by a few sine waves that get added together.
  // freq = how many waves across the screen, speed = radians per second,
  // amp = height as a fraction of the screen height.
  var ribbons = [
    {
      base: 0.52, thickness: 0.10, alpha: 0.22,
      waves: [
        { freq: 1.1, speed: 0.35, amp: 0.060, phase: 0.0 },
        { freq: 2.3, speed: -0.22, amp: 0.025, phase: 1.7 },
        { freq: 0.5, speed: 0.12, amp: 0.040, phase: 3.1 }
      ],
      thickWave: { freq: 1.6, speed: 0.25, phase: 0.4 }
    },
    {
      base: 0.56, thickness: 0.14, alpha: 0.14,
      waves: [
        { freq: 0.8, speed: -0.28, amp: 0.070, phase: 2.2 },
        { freq: 1.9, speed: 0.31, amp: 0.020, phase: 0.6 },
        { freq: 3.1, speed: 0.18, amp: 0.010, phase: 4.0 }
      ],
      thickWave: { freq: 1.1, speed: -0.2, phase: 2.0 }
    },
    {
      base: 0.60, thickness: 0.08, alpha: 0.10,
      waves: [
        { freq: 1.4, speed: 0.24, amp: 0.050, phase: 4.4 },
        { freq: 0.6, speed: -0.15, amp: 0.045, phase: 1.1 }
      ],
      thickWave: { freq: 2.0, speed: 0.3, phase: 5.2 }
    }
  ];

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Build an "hsla(...)" colour string.
  function hsla(h, s, l, a) {
    return 'hsla(' + h.toFixed(1) + ',' + s + '%,' + l + '%,' + a + ')';
  }

  // Smooth ease-in-out curve for the hue tween.
  function easeInOut(t) {
    return t * t * (3 - 2 * t);
  }

  // Shortest signed distance from hue a to hue b (e.g. 350 -> 10 is +20, not -340).
  function hueDelta(a, b) {
    var d = ((b - a) % 360 + 540) % 360 - 180;
    return d;
  }

  // ---------------------------------------------------------------------------
  // Resize handling
  // ---------------------------------------------------------------------------
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;

    // The backing store is bigger than the CSS size on high-DPI screens...
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // ...and this transform lets us keep drawing in CSS pixels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // If bubbles ended up outside the new screen, put them back inside.
    for (var i = 0; i < bubbles.length; i++) {
      if (bubbles[i].x > width + 50) bubbles[i].x = rand(0, width);
    }

    // When paused, draw one frame so the resized canvas isn't blank.
    if (!isRunning()) draw();
  }

  // Bubbles are smaller on small screens.
  function bubbleScale() {
    return clamp(Math.min(width, height) / 900, 0.55, 1.2);
  }

  // ---------------------------------------------------------------------------
  // Bubbles
  // ---------------------------------------------------------------------------
  // Give a bubble a fresh random size/speed. `anywhere` = scatter over the
  // whole screen (used at startup); otherwise start just below the bottom.
  function resetBubble(b, anywhere) {
    var scale = bubbleScale();
    b.r = rand(3, 20) * scale;  // radius 3-20 => 6-40px across (scaled)
    b.x = rand(0, width);
    b.y = anywhere ? rand(0, height) : height + b.r + rand(0, 60);
    b.speed = rand(12, 30) * (0.6 + b.r / 40);  // px per second, bigger = a bit faster
    b.swayAmp = rand(6, 22);                     // px of side-to-side drift
    b.swayFreq = rand(0.3, 0.8);                 // sway cycles per second-ish
    b.swayPhase = rand(0, Math.PI * 2);
    b.baseX = b.x;
    b.age = 0;
    b.alpha = rand(0.5, 1);
    b.active = true;
  }

  function createBubbles() {
    bubbles = [];
    for (var i = 0; i < BUBBLE_COUNT; i++) {
      var b = {};
      resetBubble(b, true);
      bubbles.push(b);
    }
  }

  function updateBubbles(dt) {
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      if (!b.active) {
        // Inactive bubbles wait off-screen until reduced motion is turned off.
        if (!reducedMotion) resetBubble(b, false);
        continue;
      }
      b.age += dt;
      b.y -= b.speed * dt;
      b.x = b.baseX + Math.sin(b.age * b.swayFreq * Math.PI * 0.5 + b.swayPhase) * b.swayAmp;

      // Floated off the top: respawn at the bottom (or go dormant if reduced motion).
      if (b.y < -b.r * 2) {
        if (reducedMotion) {
          b.active = false;
        } else {
          resetBubble(b, false);
        }
      }
    }
  }

  function drawBubbles() {
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      if (!b.active) continue;
      var x = b.x, y = b.y, r = b.r, a = b.alpha;

      // Body: mostly clear in the middle, tinted towards the edge (like glass).
      var body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      body.addColorStop(0, hsla(hue, 80, 95, 0.05 * a));
      body.addColorStop(0.7, hsla(hue, 70, 75, 0.10 * a));
      body.addColorStop(1, hsla(hue, 80, 85, 0.28 * a));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Thin rim.
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * a).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Specular highlight dot, upper-left.
      ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * a).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.14, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Tiny secondary reflection, lower-right (only worth it on bigger bubbles).
      if (r > 10) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x + r * 0.45, y + r * 0.5, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Background sky
  // ---------------------------------------------------------------------------
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, hsla(hue, 75, 38, 1));       // deeper sky at the top
    g.addColorStop(0.55, hsla(hue + 5, 70, 60, 1)); // mid
    g.addColorStop(1, hsla(hue + 10, 65, 84, 1));   // bright, misty horizon
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  // ---------------------------------------------------------------------------
  // Lens flare
  // ---------------------------------------------------------------------------
  function drawFlare() {
    var size = Math.max(width, height);

    // The glow centre drifts in a slow little circle and "breathes" in size.
    var cx = width * 0.18 + Math.sin(flareTime * 0.07) * width * 0.03;
    var cy = height * 0.14 + Math.cos(flareTime * 0.05) * height * 0.03;
    var breathe = 1 + Math.sin(flareTime * 0.4) * 0.08;
    var r = size * 0.45 * breathe;

    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, 'rgba(255,255,255,0.55)');
    glow.addColorStop(0.15, hsla(hue - 10, 100, 92, 0.30));
    glow.addColorStop(0.5, hsla(hue, 90, 80, 0.08));
    glow.addColorStop(1, hsla(hue, 90, 80, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Faint rings placed along a line from the flare towards the screen centre,
    // which is how real lens flares line up.
    var dx = width * 0.5 - cx;
    var dy = height * 0.5 - cy;
    var rings = [
      { t: 0.35, r: size * 0.045, a: 0.10 },
      { t: 0.62, r: size * 0.025, a: 0.08 },
      { t: 0.95, r: size * 0.07, a: 0.05 }
    ];
    for (var i = 0; i < rings.length; i++) {
      var ring = rings[i];
      var rx = cx + dx * ring.t;
      var ry = cy + dy * ring.t;
      var rr = ring.r * breathe;
      var rg = ctx.createRadialGradient(rx, ry, rr * 0.6, rx, ry, rr);
      rg.addColorStop(0, hsla(hue + 20, 100, 90, 0));
      rg.addColorStop(0.8, hsla(hue + 20, 100, 92, ring.a));
      rg.addColorStop(1, hsla(hue + 20, 100, 92, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // Wave ribbons
  // ---------------------------------------------------------------------------
  // Height of a ribbon's top edge at horizontal position x (in CSS px).
  function ribbonTop(rb, x) {
    var u = x / width;  // 0 at the left edge, 1 at the right
    var y = rb.base * height;
    for (var i = 0; i < rb.waves.length; i++) {
      var w = rb.waves[i];
      y += Math.sin(u * w.freq * Math.PI * 2 + waveTime * w.speed + w.phase) * w.amp * height;
    }
    return y;
  }

  // Thickness of the ribbon at x — it swells and pinches along its length.
  function ribbonThickness(rb, x) {
    var u = x / width;
    var tw = rb.thickWave;
    var s = Math.sin(u * tw.freq * Math.PI * 2 + waveTime * tw.speed + tw.phase);
    return rb.thickness * height * (0.55 + 0.45 * s);
  }

  function drawRibbons() {
    var tops = [];
    var bottoms = [];

    for (var r = 0; r < ribbons.length; r++) {
      var rb = ribbons[r];
      tops.length = 0;
      bottoms.length = 0;

      // Sample both edges across the screen (plus a little past each side).
      var minY = Infinity, maxY = -Infinity;
      for (var x = -RIBBON_STEP; x <= width + RIBBON_STEP; x += RIBBON_STEP) {
        var top = ribbonTop(rb, x);
        var bottom = top + ribbonThickness(rb, x);
        tops.push(x, top);
        bottoms.push(x, bottom);
        if (top < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
      }

      // Vertical gradient: bright white at the top edge fading into the hue.
      var g = ctx.createLinearGradient(0, minY, 0, maxY);
      g.addColorStop(0, 'rgba(255,255,255,' + rb.alpha + ')');
      g.addColorStop(0.5, hsla(hue, 90, 85, rb.alpha * 0.6));
      g.addColorStop(1, hsla(hue, 80, 70, rb.alpha * 0.15));

      // Fill: walk along the top edge left->right, then the bottom edge right->left.
      ctx.beginPath();
      ctx.moveTo(tops[0], tops[1]);
      var i;
      for (i = 2; i < tops.length; i += 2) ctx.lineTo(tops[i], tops[i + 1]);
      for (i = bottoms.length - 2; i >= 0; i -= 2) ctx.lineTo(bottoms[i], bottoms[i + 1]);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();

      // Thin bright highlight along the top edge.
      ctx.beginPath();
      ctx.moveTo(tops[0], tops[1]);
      for (i = 2; i < tops.length; i += 2) ctx.lineTo(tops[i], tops[i + 1]);
      ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.6, rb.alpha * 2.2).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  function updateHue(dt) {
    if (hueProgress >= 1) return;
    hueProgress = Math.min(1, hueProgress + dt / HUE_TWEEN_SECONDS);
    hue = hueFrom + hueDelta(hueFrom, hueTo) * easeInOut(hueProgress);
    hue = ((hue % 360) + 360) % 360;
  }

  function update(dt) {
    updateHue(dt);
    waveTime += dt * (reducedMotion ? REDUCED_SPEED : 1);
    if (!reducedMotion) flareTime += dt;
    updateBubbles(dt * (reducedMotion ? REDUCED_SPEED : 1));
  }

  function draw() {
    if (!ctx || width === 0 || height === 0) return;
    drawSky();
    drawFlare();
    drawRibbons();
    drawBubbles();
  }

  function frame(now) {
    rafId = 0;
    // Delta time in seconds; clamp it so a long stall doesn't cause a big jump.
    var dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    dt = clamp(dt, 0, 0.1);

    update(dt);
    draw();
    rafId = window.requestAnimationFrame(frame);
  }

  function isRunning() {
    return rafId !== 0;
  }

  // Start or stop the loop depending on the pause flags.
  function syncLoop() {
    var shouldRun = ctx && !userPaused && !tabHidden;
    if (shouldRun && !isRunning()) {
      lastTime = 0; // so the first frame after resuming has dt = 0
      rafId = window.requestAnimationFrame(frame);
    } else if (!shouldRun && isRunning()) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function onVisibilityChange() {
    tabHidden = document.hidden === true;
    syncLoop();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.Waves = {
    init: function (el) {
      try {
        if (!el || typeof el.getContext !== 'function') return;
        var context = el.getContext('2d');
        if (!context) return;

        // If init is called twice, stop the old loop first.
        if (isRunning()) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }

        canvas = el;
        ctx = context;
        resize();
        createBubbles();

        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', onVisibilityChange);
        tabHidden = document.hidden === true;

        draw();      // draw immediately so there's no blank first frame
        syncLoop();
      } catch (e) {
        // Fail silently: the page still works without the animated background.
        ctx = null;
      }
    },

    setHue: function (h) {
      h = Number(h);
      if (!isFinite(h)) return;
      hueFrom = hue;
      hueTo = ((h % 360) + 360) % 360;
      hueProgress = 0;
      // If the loop isn't running, jump straight to the new colour.
      if (!isRunning()) {
        hue = hueTo;
        hueProgress = 1;
        draw();
      }
    },

    setReducedMotion: function (on) {
      reducedMotion = !!on;
    },

    setPaused: function (on) {
      userPaused = !!on;
      syncLoop();
    }
  };
})();
