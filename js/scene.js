/*
 * scene.js — dark, gritty city skyline background with a day/night cycle.
 *
 * Draws on a full-screen <canvas>, back to front:
 *   1. sky gradient (colours follow the time of day)
 *   2. stars, moon and sun
 *   3. far city layer (hazy, low contrast) + a fog band near the horizon
 *   4. near city layer (dark, detailed) + lit windows + red warning lights
 *   5. thin "ribbon of lines" waves tinted by the UI accent hue
 *   6. a vertical vignette that darkens the top and bottom edges
 *
 * Public API (attached to window):
 *   Scene.init(canvas)           start drawing on the canvas
 *   Scene.setHue(h)              accent hue 0-360 (tweens over ~1s)
 *   Scene.setReducedMotion(b)    slow waves, no flicker, no blinking
 *   Scene.setPaused(b)           stop / resume the animation loop
 *   Scene.setTimeOfDay(mode)     'auto' | 'dawn' | 'day' | 'dusk' | 'night'
 *
 * Performance notes:
 *   - The two city layers and the window grid are pre-rendered to offscreen
 *     canvases. They are only re-drawn when their colours actually change
 *     (at most ~10x per second during a transition, about once a minute in
 *     'auto' mode), so a normal frame is just a handful of drawImage calls.
 *   - Windows that switch on/off are patched into the window canvas one at a
 *     time instead of re-drawing the whole grid.
 *
 * Plain script, no libraries, no modules. Everything lives inside an IIFE
 * so only `window.Scene` leaks into the global scope.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  var MAX_DPR = 2;               // cap devicePixelRatio to keep 4K screens cheap
  var DEFAULT_HUE = 100;         // Xbox-ish green
  var HUE_TWEEN_SECONDS = 1.0;   // how long setHue() takes to blend
  var TOD_TWEEN_SECONDS = 1.5;   // how long setTimeOfDay() takes to blend
  var REDUCED_SPEED = 0.2;       // reduced motion => waves move 5x slower
  var CITY_SEED = 360;           // fixed seeds => same skyline on every visit
  var STAR_SEED = 2005;
  var MOON_SEED = 77;
  var MAX_STARS = 220;
  var RIBBON_STEP = 8;           // horizontal distance (CSS px) between wave points
  var RETINT_INTERVAL = 0.1;     // min seconds between city layer re-draws
  var WINDOW_BAKE_INTERVAL = 0.2;// min seconds between full window re-draws
  var CLOCK_CHECK_MS = 60000;    // 'auto' mode re-reads the clock every minute
  var WINDOW_FADE_SECONDS = 0.6; // fade time when a window toggles on/off
  var GLOW_PAD = 1;              // size (CSS px) of the glow around lit windows

  // Representative hour used for each forced time-of-day mode.
  var FORCED_HOURS = { dawn: 5.7, day: 13, dusk: 19.3, night: 23 };   // dawn/dusk = sun ~4° below the horizon

  // ---------------------------------------------------------------------------
  // Colour palettes (keyframes). Colours are [r, g, b], 0-255.
  //   sky0/sky1/sky2 = top / middle / horizon of the sky gradient
  //   haze  = fog band colour,  hazeA = its strength
  //   far / near = building silhouette colours
  //   rim  = light catching the roof edges,  rimA = its strength
  //   sun  = sun colour,  sunA = sun visibility
  //   starA / moonA = star and moon visibility
  //   lit  = fraction of windows that are lit
  //   glow = strength of the glow around lit windows
  //   lights = visibility of the red aircraft warning lights
  //   day  = 0 at night, 1 in daytime (used for glass reflections etc.)
  // ---------------------------------------------------------------------------
  var NIGHT = {
    sky0: [4, 6, 14], sky1: [9, 13, 28], sky2: [24, 30, 52],
    haze: [28, 32, 52], hazeA: 0.35,
    far: [20, 24, 40], near: [7, 8, 14],
    rim: [70, 84, 120], rimA: 0.25,
    sun: [255, 200, 150], sunA: 0,
    starA: 1, moonA: 1, lit: 0.6, glow: 1, lights: 1, day: 0
  };
  var DAWN = {
    sky0: [22, 18, 44], sky1: [70, 40, 78], sky2: [200, 110, 86],
    haze: [150, 88, 96], hazeA: 0.4,
    far: [52, 36, 60], near: [14, 11, 22],
    rim: [255, 150, 100], rimA: 0.6,
    sun: [255, 170, 110], sunA: 1,
    starA: 0.25, moonA: 0.2, lit: 0.25, glow: 0.55, lights: 0.8, day: 0.4
  };
  var DAY = {
    sky0: [48, 56, 68], sky1: [78, 88, 100], sky2: [118, 124, 132],
    haze: [110, 116, 124], hazeA: 0.45,
    far: [66, 72, 82], near: [28, 31, 38],
    rim: [150, 156, 166], rimA: 0.12,
    sun: [235, 232, 220], sunA: 0.35,
    starA: 0, moonA: 0, lit: 0.05, glow: 0, lights: 0.12, day: 1
  };
  var DUSK = {
    sky0: [16, 12, 36], sky1: [74, 34, 68], sky2: [220, 100, 62],
    haze: [168, 78, 72], hazeA: 0.4,
    far: [52, 30, 48], near: [12, 9, 18],
    rim: [255, 130, 70], rimA: 0.65,
    sun: [255, 140, 80], sunA: 1,
    starA: 0.35, moonA: 0.25, lit: 0.35, glow: 0.6, lights: 0.9, day: 0.35
  };

  // Which palette applies at which hour. Between two keyframes the colours
  // are blended smoothly. 0h and 24h are the same, so it wraps at midnight.
  var KEYFRAMES = [
    { h: 0, p: NIGHT },
    { h: 4.5, p: NIGHT },
    { h: 6, p: DAWN },
    { h: 8.5, p: DAY },
    { h: 16.5, p: DAY },
    { h: 19, p: DUSK },
    { h: 21, p: NIGHT },
    { h: 24, p: NIGHT }
  ];

  // Cyber City neon: pink, cyan, yellow, violet, blue.
  var NEON = [[255, 62, 190], [58, 228, 255], [255, 230, 90], [176, 96, 255], [80, 130, 255]];
  var CITY_TINT = [62, 32, 128];   // far buildings lean deep violet

  // Window light colours: 4 warm tones, 2 cool fluorescent tones, then
  // index 6 = the accent hue (filled in at bake time).
  var WINDOW_COLOURS = [
    'rgb(255,206,120)', 'rgb(255,190,92)', 'rgb(255,222,150)', 'rgb(240,176,84)',
    'rgb(214,230,255)', 'rgb(190,218,240)',
    ''
  ];
  var ACCENT_INDEX = 6;

  // Wave ribbons. Each one is a sum of sine waves (like the old waves.js),
  // plus a "twist" wave that makes the ribbon flip over like a real ribbon.
  // freq = waves across the screen, speed = radians per second,
  // amp = height as a fraction of the screen height.
  var RIBBONS = [
    {
      base: 0.64, thickness: 0.07,
      fillA: 0.06, edgeA: 0.30, edgeW: 1.3, hairA: 0.12,
      waves: [
        { freq: 1.1, speed: 0.35, amp: 0.048, phase: 0.0 },
        { freq: 2.3, speed: -0.22, amp: 0.020, phase: 1.7 },
        { freq: 0.5, speed: 0.12, amp: 0.032, phase: 3.1 }
      ],
      twist: { freq: 0.7, speed: 0.18, phase: 0.3 }
    },
    {
      base: 0.68, thickness: 0.10,
      fillA: 0.04, edgeA: 0.22, edgeW: 1.0, hairA: 0.09,
      waves: [
        { freq: 0.8, speed: -0.28, amp: 0.056, phase: 2.2 },
        { freq: 1.9, speed: 0.31, amp: 0.016, phase: 0.6 },
        { freq: 3.1, speed: 0.18, amp: 0.008, phase: 4.0 }
      ],
      twist: { freq: 0.5, speed: -0.14, phase: 1.9 }
    },
    {
      base: 0.72, thickness: 0.06,
      fillA: 0.05, edgeA: 0.18, edgeW: 1.0, hairA: 0.08,
      waves: [
        { freq: 1.4, speed: 0.24, amp: 0.040, phase: 4.4 },
        { freq: 0.6, speed: -0.15, amp: 0.036, phase: 1.1 }
      ],
      twist: { freq: 0.9, speed: 0.22, phase: 4.0 }
    }
  ];
  // Where the extra hairline strands sit inside a ribbon (-1 = top edge, 1 = bottom).
  var STRANDS = [-0.6, -0.2, 0.2, 0.6];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var canvas = null;
  var ctx = null;
  var W = 0;        // canvas size in CSS pixels
  var H = 0;
  var dpr = 1;
  var unit = 1;     // building scale factor, based on the screen width
  var farNeon = []; // neon trim for the far buildings (Cyber City style)

  var rafId = 0;
  var lastTime = 0;   // timestamp of the previous frame (ms)
  var clock = 0;      // seconds since start (twinkle, blinking, throttling)
  var waveTime = 0;   // seconds of "wave time" (slower in reduced motion)
  var hasDrawn = false;
  var resizeTimer = 0;

  var userPaused = false;
  var tabHidden = false;
  var reducedMotion = false;

  // Hue tween: blend from `hueFrom` to `hueTo` as `hueProgress` goes 0 -> 1.
  var hue = DEFAULT_HUE;
  var hueFrom = DEFAULT_HUE;
  var hueTo = DEFAULT_HUE;
  var hueProgress = 1;

  // Time-of-day tween, same idea but in hours (0-24).
  var todMode = 'auto';
  var hour = 12;
  var hourFrom = 12;
  var hourTo = 12;
  var hourProgress = 1;
  var lastClockCheck = 0;

  // Offscreen canvases: { canvas, ctx, key, t }. `key` describes the colours
  // the layer was last drawn with; `t` is when (in `clock` seconds).
  var farLayer = null;
  var nearLayer = null;
  var winLayer = null;

  // City geometry (rebuilt on resize).
  var farShapes = [];
  var nearShapes = [];
  var farWindows = [];      // { x, y, s, th }
  var nearWindows = [];     // { x, y, w, h, th, ci, flip }
  var windowBuckets = [];   // nearWindows grouped by colour index
  var warningLights = [];   // { x, y } tips of the tallest antennas

  var winAnims = [];        // windows currently fading on/off
  var toggleTimer = 3;      // seconds until the next random window toggle

  // Colours the window canvas was last baked with (live window patches reuse them).
  var bakeStyle = { unlit: 'rgb(0,0,0)', colours: WINDOW_COLOURS.slice(), glowA: 0, litA: 1, lit: 0.6 };

  var stars = [];
  var moonSprite = null;
  var moonSize = 0;

  var ribbonMid = null;     // reusable arrays for the wave maths
  var ribbonHalf = null;
  var ribbonCount = 0;

  var vignetteTop = null;   // cached gradients (rebuilt on resize)
  var vignetteBottom = null;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Smooth ease-in-out curve (0 -> 1).
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  // Shortest signed distance from hue a to hue b (350 -> 10 is +20, not -340).
  function hueDelta(a, b) {
    return ((b - a) % 360 + 540) % 360 - 180;
  }

  // Same for hours on a 24h clock (23 -> 1 is +2).
  function hourDelta(a, b) {
    return ((b - a) % 24 + 36) % 24 - 12;
  }

  function mixRGB(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function rgb(c) {
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  }

  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }

  // Seeded pseudo-random number generator ("mulberry32"). Calling
  // mulberry32(seed) returns a function that gives the same sequence of
  // numbers in [0, 1) every time for the same seed.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The visitor's local time as a fractional hour, e.g. 18:30 -> 18.5.
  function localHour() {
    var d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  function targetHour() {
    return todMode === 'auto' ? sunHour() : FORCED_HOURS[todMode];
  }

  // ---------------------------------------------------------------------------
  // Real sun -> "scene hour"
  // The palettes above are laid out on a clock (dawn at 6, dusk at 19...).
  // Real sunrise and sunset move with the seasons and with where the visitor
  // is, so in 'auto' mode we place the sky on that clock using the sun's real
  // elevation (js/sun.js), not the wall clock.
  // ---------------------------------------------------------------------------
  var MORNING_E = [-18, -6, 0, 6, 15], MORNING_H = [4.5, 5.5, 6.2, 7.0, 8.5];
  var EVENING_E = [15, 6, 0, -6, -18], EVENING_H = [16.5, 18.0, 18.8, 19.6, 21];

  // Piecewise-linear lookup; xs may be increasing or decreasing.
  function table(x, xs, ys) {
    var up = xs[xs.length - 1] > xs[0];
    if (up ? x <= xs[0] : x >= xs[0]) return ys[0];
    for (var i = 1; i < xs.length; i++) {
      if (up ? x <= xs[i] : x >= xs[i]) {
        return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      }
    }
    return ys[ys.length - 1];
  }

  function sunHour() {
    if (!window.Sun) return localHour();
    var p = window.Sun.position();
    if (p.elev >= 15) {
      var ha15 = window.Sun.hourAngleAt(15) || 1;
      return 12.5 + clamp(p.ha / ha15, -1, 1) * 4;          // daytime: 8.5 .. 16.5
    }
    if (p.elev > -18) {
      return p.ha < 0 ? table(p.elev, MORNING_E, MORNING_H) : table(p.elev, EVENING_E, EVENING_H);
    }
    var h = localHour();                                   // full night
    if (h > 4.5 && h < 12) return 4.5;
    if (h >= 12 && h < 21) return 21;
    return h;
  }

  // The reverse: sun elevation (degrees) implied by a scene hour. Used for the
  // sun disc and rocket-plume lighting, so forced previews behave too.
  function sunElevAtHour(h) {
    h = ((h % 24) + 24) % 24;
    if (h >= 8.5 && h <= 16.5) return 15 + 40 * Math.sin(Math.PI * (h - 8.5) / 8);
    if (h > 4.5 && h < 8.5) return table(h, MORNING_H, MORNING_E);
    if (h > 16.5 && h < 21) return table(h, EVENING_H, EVENING_E);
    return -25;
  }

  // Blend two palettes: arrays are colours, numbers are plain values.
  function mixPalette(a, b, t) {
    var out = {};
    for (var k in a) {
      if (!Object.prototype.hasOwnProperty.call(a, k)) continue;
      out[k] = (typeof a[k] === 'number') ? lerp(a[k], b[k], t) : mixRGB(a[k], b[k], t);
    }
    return out;
  }

  // Palette for any hour of the day, blended from the keyframes.
  // Dark World: whatever the hour, the sky stays the deep navy-violet void of
  // Deltarune's Dark World. Only the city's lighting still follows the clock.
  var DARK_SKY = { sky0: [0, 0, 0], sky1: [0, 0, 1], sky2: [1, 1, 3], haze: [26, 14, 56] };   // jet black: only light from the scene tints it
  function darkWorld(P) {
    P.sky0 = DARK_SKY.sky0;
    P.sky1 = DARK_SKY.sky1;
    P.sky2 = DARK_SKY.sky2;
    P.haze = mixRGB(P.haze, DARK_SKY.haze, 0.7);
    P.hazeA = 0.22;
    P.starA = Math.max(P.starA, 0.9);
    P.sunA *= 0.3;
    P.moonA = 0;
    P.day *= 0.25;
    return P;
  }

  function paletteAt(h) {
    return darkWorld(mixPalette(NIGHT, NIGHT, 0));   // always dark, whatever the hour
  }

  function rawPaletteAt(h) {
    h = ((h % 24) + 24) % 24;
    for (var i = 0; i < KEYFRAMES.length - 1; i++) {
      var a = KEYFRAMES[i];
      var b = KEYFRAMES[i + 1];
      if (h <= b.h) {
        var t = (h - a.h) / (b.h - a.h);
        return mixPalette(a.p, b.p, smooth(clamp(t, 0, 1)));
      }
    }
    return mixPalette(NIGHT, NIGHT, 0);
  }

  // Make an offscreen canvas for one of the pre-rendered layers.
  function makeLayer() {
    var c = document.createElement('canvas');
    var x = null;
    try { x = c.getContext('2d'); } catch (e) { x = null; }
    return x ? { canvas: c, ctx: x, key: '', t: 0 } : null;
  }

  // ---------------------------------------------------------------------------
  // City generation
  // ---------------------------------------------------------------------------
  // Buildings are stored as a list of simple shapes:
  //   { r: [x, y, w, h] }        a rectangle
  //   { p: [x1, y1, x2, y2...] } a polygon
  // All polygons are listed in the same (clockwise) order as rectangles, so
  // the whole layer can be filled in one go without holes where shapes overlap.
  function addRect(list, x, y, w, h) {
    list.push({ r: [x, y, w, h] });
  }

  function addPoly(list, pts) {
    list.push({ p: pts });
  }

  // Fill all shapes of a layer as one path. `dy` shifts everything down
  // (used to draw the roof-edge rim light).
  function fillShapes(c, shapes, dy) {
    c.beginPath();
    for (var i = 0; i < shapes.length; i++) {
      var s = shapes[i];
      if (s.r) {
        c.rect(s.r[0], s.r[1] + dy, s.r[2], s.r[3]);
      } else {
        var p = s.p;
        c.moveTo(p[0], p[1] + dy);
        for (var j = 2; j < p.length; j += 2) c.lineTo(p[j], p[j + 1] + dy);
        c.closePath();
      }
    }
    c.fill();
  }

  // Turn a building { x, w, h, tall } into shapes. Also records the parts
  // that can hold windows (b.bodies) and the antenna tip (b.tip).
  function shapeBuilding(b, rng, detailed) {
    var u = unit;
    var ground = H + 2;          // extend a little below the screen edge
    var top = H - b.h;
    var s = b.shapes = [];
    b.bodies = [];
    b.tip = null;

    var roofX = b.x;
    var roofW = b.w;
    var roofY = top;
    var kind = rng();

    if (detailed && kind < 0.28 && b.w > 30 * u) {
      // Stepped setbacks: the main block plus 1-2 narrower tiers on top.
      addRect(s, b.x, top, b.w, ground - top);
      b.bodies.push({ x: b.x, y: top, w: b.w, h: b.h });
      var tiers = rng() < 0.5 ? 2 : 1;
      for (var t = 0; t < tiers; t++) {
        var tw = roofW * (0.55 + rng() * 0.25);
        var tx = roofX + (roofW - tw) * (0.25 + rng() * 0.5);
        var th = b.h * (0.06 + rng() * 0.1);
        roofY -= th;
        addRect(s, tx, roofY, tw, th + 1);
        b.bodies.push({ x: tx, y: roofY, w: tw, h: th });
        roofX = tx;
        roofW = tw;
      }
    } else if (kind < (detailed ? 0.4 : 0.12) && !b.tall) {
      // Slanted roof (a few of them): one side higher than the other. No rooftop extras.
      var slant = Math.min(b.w * (0.2 + rng() * 0.3), b.h * 0.3);
      var leftHigh = rng() < 0.5;
      addPoly(s, [
        b.x, ground,
        b.x, leftHigh ? top - slant : top,
        b.x + b.w, leftHigh ? top : top - slant,
        b.x + b.w, ground
      ]);
      b.bodies.push({ x: b.x, y: top, w: b.w, h: b.h });
      return;
    } else {
      // Flat roof, sometimes with a slightly wider ledge (parapet) on top.
      addRect(s, b.x, top, b.w, ground - top);
      b.bodies.push({ x: b.x, y: top, w: b.w, h: b.h });
      if (rng() < 0.5) {
        var lip = Math.max(1, 2 * u);
        addRect(s, b.x - u, top - lip, b.w + 2 * u, lip + 1);
        roofY = top - lip;
      }
    }

    // Rooftop boxes (machinery rooms, vents).
    if (rng() < 0.4) {
      var boxes = rng() < 0.5 ? 2 : 1;
      for (var i = 0; i < boxes; i++) {
        var bw = roofW * (0.12 + rng() * 0.18);
        var bh = (3 + rng() * 6) * u;
        var bx = roofX + rng() * (roofW - bw);
        addRect(s, bx, roofY - bh, bw, bh + 1);
      }
    }

    // Water tank on little legs with a pointy cap.
    if (detailed && rng() < 0.22 && roofW > 20 * u) {
      var tankW = 8 * u + 2;
      var legH = 4 * u;
      var legW = Math.max(1, u);
      var tankX = clamp(roofX + roofW * (0.15 + rng() * 0.6) - tankW / 2, roofX, roofX + roofW - tankW);
      var tankH = tankW * 0.9;
      var tankTop = roofY - legH - tankH;
      addRect(s, tankX + tankW * 0.1, roofY - legH, legW, legH + 1);
      addRect(s, tankX + tankW * 0.9 - legW, roofY - legH, legW, legH + 1);
      addRect(s, tankX, tankTop, tankW, tankH);
      addPoly(s, [tankX - 0.5 * u, tankTop + 0.5, tankX + tankW / 2, tankTop - tankW * 0.4, tankX + tankW + 0.5 * u, tankTop + 0.5]);
    }

    // Antenna (always on the tall towers), sometimes on top of a spire.
    if (b.tall || (detailed && rng() < 0.1) || (!detailed && rng() < 0.08)) {
      var cx = roofX + roofW / 2;
      var baseY = roofY;
      if (b.tall && rng() < 0.55) {
        var sw = roofW * 0.35;
        var sh = H * (0.04 + rng() * 0.04);
        addPoly(s, [cx - sw / 2, roofY + 1, cx, roofY - sh, cx + sw / 2, roofY + 1]);
        baseY = roofY - sh * 0.85;
      }
      var aw = Math.max(1, 1.4 * u);
      var ah = H * (0.03 + rng() * 0.04);
      addRect(s, cx - aw / 2, baseY - ah, aw, ah + 2);
      b.tip = { x: cx, y: baseY - ah };
    }
  }

  // Pick a window colour index: ~2% accent, ~28% cool white-blue, rest warm.
  function pickWindowColour(rng) {
    var r = rng();
    if (r < 0.02) return ACCENT_INDEX;
    if (r < 0.16) return 4;
    if (r < 0.30) return 5;
    return Math.floor(rng() * 4);
  }

  // A grid of windows for each body of a near building.
  function addNearWindows(b, rng) {
    var u = unit;
    var cw = Math.round(clamp(7 * u * (0.8 + rng() * 0.5), 5, 16));   // cell width
    var ch = Math.round(clamp(10 * u * (0.85 + rng() * 0.4), 7, 20)); // cell height (one floor)
    var gapX = Math.max(3, Math.round(cw * 0.4));  // >= 3 so glows never overlap
    var gapY = Math.max(3, Math.round(ch * 0.35));
    if (rng() < 0.2) cw *= 2;                      // some buildings have wide windows
    var ww = cw - gapX;
    var wh = ch - gapY;
    var dim = rng() < 0.12;                        // a few mostly-dark buildings

    for (var i = 0; i < b.bodies.length; i++) {
      var body = b.bodies[i];
      var mx = Math.max(3, Math.round(body.w * 0.08));
      var cols = Math.floor((body.w - 2 * mx + gapX) / cw);
      if (cols < 1) continue;
      var startX = Math.round(body.x + (body.w - (cols * cw - gapX)) / 2);
      var y0 = Math.round(body.y + Math.max(ch * 0.6, 4));
      var rows = Math.floor((body.y + body.h - ch * 0.5 - y0 + gapY) / ch);

      for (var r = 0; r < rows; r++) {
        // Half of the windows share a per-floor value, so whole office floors
        // tend to light up together. The overall share of lit windows still
        // matches litFraction because both values are uniform in [0, 1).
        var floorR = rng();
        for (var c = 0; c < cols; c++) {
          var th = rng() < 0.55 ? floorR : rng();
          if (dim) th = 0.4 + th * 0.6;
          var win = {
            x: startX + c * cw, y: y0 + r * ch, w: ww, h: wh,
            th: th, ci: pickWindowColour(rng), flip: false
          };
          nearWindows.push(win);
          windowBuckets[win.ci].push(win);
        }
      }
    }
  }

  // Tiny, sparse windows for the far layer.
  function addFarWindows(b, rng) {
    var cell = Math.max(4, Math.round(6 * unit));
    var size = Math.max(1, Math.round(1.4 * unit));
    for (var y = H - b.h + cell; y < H - cell; y += cell) {
      for (var x = b.x + cell * 0.6; x < b.x + b.w - cell * 0.6; x += cell) {
        if (rng() < 0.3) farWindows.push({ x: Math.round(x), y: Math.round(y), s: size, th: rng() });
      }
    }
  }

  // Neon trim on a far building: glowing vertical strips, a sign block,
  // a stripe or two across the facade, and sometimes a glowing orb on a mast.
  function addFarNeon(b, rng) {
    var u = unit;
    var top = H - b.h;
    var col = Math.floor(rng() * NEON.length);
    var col2 = (col + 1 + Math.floor(rng() * (NEON.length - 1))) % NEON.length;
    var sx = Math.max(2, Math.round(2.4 * u));
    // glowing edge strips down the sides
    if (rng() < 0.7) farNeon.push({ x: Math.round(b.x), y: top, w: sx, h: b.h * (0.4 + rng() * 0.6), c: col });
    if (rng() < 0.5) farNeon.push({ x: Math.round(b.x + b.w - sx), y: top, w: sx, h: b.h * (0.3 + rng() * 0.6), c: col2 });
    // a centre strip, sometimes
    if (rng() < 0.35) farNeon.push({ x: Math.round(b.x + b.w * (0.3 + rng() * 0.4)), y: top + 4 * u, w: sx, h: b.h * (0.3 + rng() * 0.5), c: col2 });
    // horizontal bands
    var bands = Math.floor(rng() * 3);
    for (var i = 0; i < bands; i++) {
      farNeon.push({ x: Math.round(b.x), y: Math.round(top + b.h * (0.12 + rng() * 0.7)), w: b.w, h: Math.max(2, Math.round(1.8 * u)), c: rng() < 0.5 ? col : col2, dim: true });
    }
    // a sign: a bright block of "text" on the facade
    if (rng() < 0.35 && b.w > 30 * u) {
      var sw = b.w * (0.3 + rng() * 0.3);
      farNeon.push({ x: Math.round(b.x + (b.w - sw) / 2), y: Math.round(top + b.h * (0.1 + rng() * 0.3)), w: sw, h: Math.round(5 * u), c: col2, sign: true });
    }
    // an orb on a thin mast
    if (rng() < 0.25) {
      var mx = Math.round(b.x + b.w * (0.25 + rng() * 0.5));
      var mh = H * (0.03 + rng() * 0.05);
      farNeon.push({ x: mx, y: top - mh, w: Math.max(1, Math.round(u)), h: mh, c: col, mast: true });
      farNeon.push({ x: mx, y: top - mh, r: 2.2 * u + 1, c: col2, orb: true });
    }
  }

  function generateCity() {
    var rng = mulberry32(CITY_SEED);
    unit = clamp(W / 1400, 0.42, 1.8);
    var u = unit;
    var x, w, h, i, b;

    // --- Far layer: shorter-ish, packed tightly, slight overlaps allowed.
    farShapes = [];
    farWindows = [];
    farNeon = [];
    var nrng = mulberry32(CITY_SEED + 7);   // own sequence: the near city stays unchanged
    x = -rng() * 30 * u;
    while (x < W + 10) {
      w = (36 + rng() * 70) * u;
      h = H * (0.2 + 0.34 * Math.pow(rng(), 0.8));   // taller than before: the neon towers show above the near city
      b = { x: x, w: w, h: h, tall: false };
      shapeBuilding(b, rng, false);
      Array.prototype.push.apply(farShapes, b.shapes);
      addFarWindows(b, rng);
      addFarNeon(b, nrng);
      x += w + (rng() * 10 - 4) * u;
    }

    // --- Near layer: first pick positions and sizes (no overlaps, so
    // windows never end up on a neighbour's wall).
    var near = [];
    x = -rng() * 40 * u;
    while (x < W + 10) {
      w = (42 + rng() * 80) * u;
      h = H * (0.09 + 0.28 * Math.pow(rng(), 1.2));
      near.push({ x: x, w: w, h: h, tall: false });
      x += w + rng() * 12 * u;
    }

    // A few tall towers spread across the screen (~45-53% of the height,
    // plus spire/antenna they reach roughly 55-60%).
    var targets = [0.2, 0.52, 0.8];
    for (i = 0; i < targets.length; i++) {
      var best = null;
      var bestDist = Infinity;
      for (var j = 0; j < near.length; j++) {
        var d = Math.abs(near[j].x + near[j].w / 2 - targets[i] * W);
        if (d < bestDist && !near[j].tall) { bestDist = d; best = near[j]; }
      }
      if (best) {
        best.tall = true;
        best.h = H * (0.45 + 0.08 * rng());
      }
    }

    // Then build shapes and windows.
    nearShapes = [];
    nearWindows = [];
    windowBuckets = [];
    for (i = 0; i < WINDOW_COLOURS.length; i++) windowBuckets.push([]);
    var tips = [];
    for (i = 0; i < near.length; i++) {
      b = near[i];
      shapeBuilding(b, rng, true);
      Array.prototype.push.apply(nearShapes, b.shapes);
      addNearWindows(b, rng);
      if (b.tip) tips.push(b.tip);
    }

    // Red warning lights go on the 3 highest antenna tips.
    tips.sort(function (a, c) { return a.y - c.y; });
    warningLights = tips.slice(0, 3);
  }

  // ---------------------------------------------------------------------------
  // Stars and moon
  // ---------------------------------------------------------------------------
  function makeStars() {
    var rng = mulberry32(STAR_SEED);
    stars = [];
    for (var i = 0; i < MAX_STARS; i++) {
      var big = rng();
      stars.push({
        x: rng(),
        y: Math.pow(rng(), 1.3) * 0.6,   // more stars higher up
        s: big < 0.85 ? 1 : (big < 0.95 ? 1.5 : 2),
        a: 0.35 + rng() * 0.65,
        sp: 0.6 + rng() * 1.8,
        ph: rng() * Math.PI * 2
      });
    }
  }

  // Moon age as a fraction of the lunar cycle (0 = new, 0.5 = full).
  function moonPhase() {
    var synodic = 29.530588853;
    var knownNew = Date.UTC(2000, 0, 6, 18, 14);
    var days = (Date.now() - knownNew) / 86400000;
    var age = ((days % synodic) + synodic) % synodic;
    return age / synodic;
  }

  // Pre-render the moon (with its real current phase) to a small canvas.
  function buildMoon() {
    var r = Math.round(clamp(Math.min(W, H) * 0.025, 9, 26));
    moonSize = r * 2 + 4;
    var c = document.createElement('canvas');
    c.width = Math.ceil(moonSize * dpr);
    c.height = Math.ceil(moonSize * dpr);
    var m = null;
    try { m = c.getContext('2d'); } catch (e) { m = null; }
    if (!m) { moonSprite = null; return; }
    m.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = moonSize / 2;

    // Disc.
    m.fillStyle = '#e4e8f0';
    m.beginPath();
    m.arc(cx, cx, r, 0, Math.PI * 2);
    m.fill();

    // A few soft craters ('source-atop' keeps them inside the disc).
    var rng = mulberry32(MOON_SEED);
    m.globalCompositeOperation = 'source-atop';
    m.fillStyle = 'rgba(120,130,150,0.18)';
    for (var i = 0; i < 6; i++) {
      m.beginPath();
      m.arc(cx + (rng() - 0.5) * r * 1.2, cx + (rng() - 0.5) * r * 1.2, r * (0.08 + rng() * 0.18), 0, Math.PI * 2);
      m.fill();
    }

    // Cut away the shadowed part with an offset circle. Waxing moons are lit
    // on the right, waning on the left. Never fully dark: always a crescent.
    var k = moonPhase();
    var side = k < 0.5 ? -1 : 1;
    var offset = Math.max(0.35 * r, 2 * r * (k < 0.5 ? k * 2 : (1 - k) * 2));
    if (offset < 1.95 * r) {
      m.globalCompositeOperation = 'destination-out';
      m.fillStyle = '#000';
      m.beginPath();
      m.arc(cx + side * offset, cx, r * 1.02, 0, Math.PI * 2);
      m.fill();
    }
    m.globalCompositeOperation = 'source-over';
    moonSprite = c;
  }

  // ---------------------------------------------------------------------------
  // Resize handling
  // ---------------------------------------------------------------------------
  function sizeLayer(layer) {
    layer.canvas.width = Math.round(W * dpr);
    layer.canvas.height = Math.round(H * dpr);
    layer.key = '';   // force a re-draw
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);

    // The backing store is bigger than the CSS size on high-DPI screens;
    // a setTransform(dpr...) in render() lets us keep drawing in CSS pixels.
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    sizeLayer(farLayer);
    sizeLayer(nearLayer);
    sizeLayer(winLayer);

    generateCity();
    buildMoon();
    winAnims = [];

    ribbonCount = Math.ceil(W / RIBBON_STEP) + 1;
    ribbonMid = new Float32Array(ribbonCount);
    ribbonHalf = new Float32Array(ribbonCount);

    vignetteTop = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    vignetteTop.addColorStop(0, 'rgba(0,0,0,0.5)');
    vignetteTop.addColorStop(1, 'rgba(0,0,0,0)');
    vignetteBottom = ctx.createLinearGradient(0, H * 0.6, 0, H);
    vignetteBottom.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteBottom.addColorStop(1, 'rgba(0,0,0,0.6)');

    // When paused, draw one frame so the resized canvas isn't blank.
    if (!isRunning()) render(true);
  }

  // Wait until the user stops dragging the window before rebuilding the city.
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  }

  // ---------------------------------------------------------------------------
  // Pre-rendered layers
  // ---------------------------------------------------------------------------
  function clearLayer(layer) {
    var c = layer.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  // Far layer: flat hazy silhouettes + tiny dim windows.
  function renderFar(P) {
    var c = clearLayer(farLayer);
    var fill = mixRGB(P.far, CITY_TINT, 0.6);
    var neon = 0.65 + 0.35 * (1 - P.day);          // neon is strongest after dark
    var edgePx = Math.max(2, Math.round(2.2 * unit));

    // Neon roofline: draw the shapes in pink, then the body colour over them, a pixel or two lower.
    c.fillStyle = 'rgba(' + NEON[0].join(',') + ',' + (0.9 * neon).toFixed(3) + ')';
    fillShapes(c, farShapes, 0);
    c.fillStyle = rgb(fill);
    fillShapes(c, farShapes, edgePx);

    // Neon trim, additive so it glows against the dark facades.
    c.globalCompositeOperation = 'lighter';
    for (var n = 0; n < farNeon.length; n++) {
      var s = farNeon[n];
      var rgbc = NEON[s.c].join(',');
      if (s.orb) {
        var g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        g.addColorStop(0, 'rgba(' + rgbc + ',' + (0.9 * neon).toFixed(3) + ')');
        g.addColorStop(0.25, 'rgba(' + rgbc + ',' + (0.35 * neon).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + rgbc + ',0)');
        c.fillStyle = g;
        c.fillRect(s.x - s.r * 4, s.y - s.r * 4, s.r * 8, s.r * 8);
        continue;
      }
      var a = s.mast ? 0.7 : s.dim ? 0.55 : s.sign ? 0.9 : 1;
      // soft halo, then the bright core
      c.fillStyle = 'rgba(' + rgbc + ',' + (a * 0.3 * neon).toFixed(3) + ')';
      c.fillRect(s.x - 3, s.y - 3, s.w + 6, s.h + 6);
      c.fillStyle = 'rgba(' + rgbc + ',' + (a * neon).toFixed(3) + ')';
      c.fillRect(s.x, s.y, s.w, s.h);
      if (s.sign) {                               // gaps make the sign read as lettering
        c.fillStyle = rgb(fill);
        for (var gx = s.x + 3; gx < s.x + s.w - 2; gx += 6) c.fillRect(gx, s.y + 1, 2, s.h - 2);
      }
    }
    c.globalCompositeOperation = 'source-over';

    // Little windows in neon colours.
    if (P.lit > 0.01) {
      c.globalAlpha = 0.3 + 0.4 * (1 - P.day);
      for (var i = 0; i < farWindows.length; i++) {
        var w = farWindows[i];
        if (w.th < P.lit) {
          c.fillStyle = rgb(NEON[Math.floor(w.th * 997) % NEON.length]);
          c.fillRect(w.x, w.y, w.s, w.s);
        }
      }
      c.globalAlpha = 1;
    }
  }

  // Near layer: draw everything in the rim colour, then again in the building
  // colour shifted down a pixel or two. What's left is a lit edge on every roof.
  function renderNear(P) {
    var c = clearLayer(nearLayer);
    var rimPx = Math.max(1, Math.round(1.5 * unit));
    c.fillStyle = rgb(mixRGB(P.near, P.rim, P.rimA));
    fillShapes(c, nearShapes, 0);
    c.fillStyle = rgb(P.near);
    fillShapes(c, nearShapes, rimPx);
  }

  function isLit(w) {
    return (w.th < bakeStyle.lit) !== w.flip;
  }

  // Draw every near window into the window canvas.
  function bakeWindows(P) {
    var c = clearLayer(winLayer);
    var s = bakeStyle;
    var i, j, list, w;

    s.lit = P.lit;
    // Unlit glass: building colour with a hint of sky reflection (more by day).
    s.unlit = rgb(mixRGB(P.near, P.sky1, 0.08 + 0.25 * P.day));
    s.glowA = 0.18 * P.glow;
    s.litA = 0.55 + 0.4 * (1 - P.day);
    s.colours[ACCENT_INDEX] = 'hsl(' + hue.toFixed(1) + ',80%,62%)';

    // 1) Every window gets dark glass underneath.
    c.fillStyle = s.unlit;
    for (i = 0; i < nearWindows.length; i++) {
      w = nearWindows[i];
      c.fillRect(w.x, w.y, w.w, w.h);
    }

    // 2) Lit windows, one colour at a time: a soft glow rect then the light.
    for (j = 0; j < windowBuckets.length; j++) {
      list = windowBuckets[j];
      c.fillStyle = s.colours[j];
      if (s.glowA > 0.004) {
        c.globalAlpha = s.glowA;
        for (i = 0; i < list.length; i++) {
          w = list[i];
          if (isLit(w)) c.fillRect(w.x - GLOW_PAD, w.y - GLOW_PAD, w.w + 2 * GLOW_PAD, w.h + 2 * GLOW_PAD);
        }
      }
      c.globalAlpha = s.litA;
      for (i = 0; i < list.length; i++) {
        w = list[i];
        if (isLit(w)) c.fillRect(w.x, w.y, w.w, w.h);
      }
    }
    c.globalAlpha = 1;
  }

  // Re-draw a single window in place (used for the on/off fades).
  // `amount` 0 = dark, 1 = fully lit. Windows are spaced so that their glow
  // areas never overlap, so clearing one never touches a neighbour.
  function drawWindowLive(w, amount) {
    var c = winLayer.ctx;
    var s = bakeStyle;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(w.x - GLOW_PAD, w.y - GLOW_PAD, w.w + 2 * GLOW_PAD, w.h + 2 * GLOW_PAD);
    c.globalAlpha = 1;
    c.fillStyle = s.unlit;
    c.fillRect(w.x, w.y, w.w, w.h);
    if (amount > 0) {
      c.fillStyle = s.colours[w.ci];
      if (s.glowA > 0.004) {
        c.globalAlpha = s.glowA * amount;
        c.fillRect(w.x - GLOW_PAD, w.y - GLOW_PAD, w.w + 2 * GLOW_PAD, w.h + 2 * GLOW_PAD);
      }
      c.globalAlpha = s.litA * amount;
      c.fillRect(w.x, w.y, w.w, w.h);
    }
    c.globalAlpha = 1;
  }

  // Bring the offscreen layers up to date if their colours changed.
  // `force` skips the throttling (used for single frames while paused).
  function updateLayers(P, force) {
    var farKey = rgb(P.far) + '|' + P.lit.toFixed(2) + '|' + P.day.toFixed(2);
    if (farKey !== farLayer.key && (force || farLayer.key === '' || clock - farLayer.t >= RETINT_INTERVAL)) {
      renderFar(P);
      farLayer.key = farKey;
      farLayer.t = clock;
    }

    var nearKey = rgb(P.near) + '|' + rgb(mixRGB(P.near, P.rim, P.rimA));
    if (nearKey !== nearLayer.key && (force || nearLayer.key === '' || clock - nearLayer.t >= RETINT_INTERVAL)) {
      renderNear(P);
      nearLayer.key = nearKey;
      nearLayer.t = clock;
    }

    var winKey = rgb(mixRGB(P.near, P.sky1, 0.08 + 0.25 * P.day)) + '|' + P.lit.toFixed(3) + '|' +
      P.glow.toFixed(2) + '|' + P.day.toFixed(2) + '|' + Math.round(hue / 2);
    if (winKey !== winLayer.key && (force || winLayer.key === '' || clock - winLayer.t >= WINDOW_BAKE_INTERVAL)) {
      bakeWindows(P);
      winLayer.key = winKey;
      winLayer.t = clock;
    }

    // Windows that are mid-fade are patched in on top of the baked grid.
    for (var i = 0; i < winAnims.length; i++) {
      drawWindowLive(winAnims[i].w, winAnims[i].amt);
    }
  }

  // ---------------------------------------------------------------------------
  // Window whimsy: every few seconds a few random windows switch on or off.
  // ---------------------------------------------------------------------------
  function findAnim(w) {
    for (var i = 0; i < winAnims.length; i++) {
      if (winAnims[i].w === w) return i;
    }
    return -1;
  }

  function toggleRandomWindows() {
    var n = 1 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var w = nearWindows[Math.floor(Math.random() * nearWindows.length)];
      if (!w) continue;
      var existing = findAnim(w);
      var current = existing >= 0 ? winAnims[existing].amt : (isLit(w) ? 1 : 0);
      if (existing >= 0) winAnims.splice(existing, 1);
      w.flip = !w.flip;
      winAnims.push({ w: w, from: current, to: isLit(w) ? 1 : 0, t: 0, amt: current });
    }
  }

  function updateWindowAnims(dt) {
    for (var i = winAnims.length - 1; i >= 0; i--) {
      var a = winAnims[i];
      a.t = reducedMotion ? 1 : Math.min(1, a.t + dt / WINDOW_FADE_SECONDS);
      a.amt = lerp(a.from, a.to, smooth(a.t));
      if (a.t >= 1) {
        // Draw the final state once more, then stop tracking it.
        if (winLayer) drawWindowLive(a.w, a.amt);
        winAnims.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Sky, stars, sun, moon
  // ---------------------------------------------------------------------------
  function drawSky(P) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(P.sky0));
    g.addColorStop(0.45, rgb(P.sky1));
    g.addColorStop(0.82, rgb(P.sky2));
    g.addColorStop(1, rgb(P.sky2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // The Dark Fountain, as in the game: a colossal geyser of glowing cyan-blue,
  // like a frozen flame, with sweeping light and dark blue streaks and curling
  // tendrils at its sides. It stands in the far right, climbing out of the top of
  // the screen. Drawn small in flat colours and scaled up, for the pixel-art look.
  var fountainCv = null, fountainCtx = null, FOUNTAIN_PX = 3;
  var FT = { sky: 'rgb(150,238,255)', light: 'rgb(98,214,255)', mid: 'rgb(54,160,247)', dark: 'rgb(30,86,222)', deep: 'rgb(22,48,170)' };

  function drawFountain(P, now) {
    var tt = now / 1000;
    var Wf = W * 0.5;                                     // the geyser is far away: tall and slim, not wide
    var cx = W * 0.8;
    var baseY = H * 0.78;
    var span = W * 0.3;                                   // width of the strip it is drawn into
    var x0 = Math.round(cx - span / 2);
    var cw = Math.ceil(span / FOUNTAIN_PX), ch = Math.ceil(H / FOUNTAIN_PX);
    if (!fountainCv) {
      fountainCv = document.createElement('canvas');
      fountainCtx = fountainCv.getContext('2d');
    }
    if (!fountainCtx) return;
    if (fountainCv.width !== cw || fountainCv.height !== ch) { fountainCv.width = cw; fountainCv.height = ch; }
    var g = fountainCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.setTransform(1 / FOUNTAIN_PX, 0, 0, 1 / FOUNTAIN_PX, -x0 / FOUNTAIN_PX, 0);

    var lean = W * 0.012;
    // outline profile: wide at the foot, pinching in the middle, bulging again overhead
    function half(y) {
      var f = clamp((baseY - y) / baseY, 0, 1.1);          // 0 at the foot .. 1 at the top
      return Wf * (0.115 - 0.045 * Math.sin(Math.min(f, 1) * Math.PI * 0.85) + 0.02 * f) +
             (Math.sin(y * 0.021 + tt * 2.2) * 0.007 + Math.sin(y * 0.047 + tt * 3.1) * 0.003) * Wf;   // ripples running up the sides
    }
    function mid(y) {
      var f = clamp((baseY - y) / baseY, 0, 1.1);
      return cx - lean * f + Math.sin(tt * 0.5 + f * 3) * Wf * 0.008;   // the whole column sways
    }
    function body(inset, shiftX, y1) {                      // the column as a path, optionally narrower / shifted
      g.beginPath();
      var y;
      g.moveTo(mid(baseY) - half(baseY) * inset + shiftX, baseY);
      for (y = baseY; y >= y1; y -= 12) g.lineTo(mid(y) - half(y) * inset + shiftX, y);
      for (y = y1; y <= baseY; y += 12) g.lineTo(mid(y) + half(y) * inset + shiftX, y);
      g.closePath();
    }

    // the whole column in mid blue, then lighter cores inside it
    g.fillStyle = FT.mid;
    body(1, 0, -20);
    g.fill();
    g.fillStyle = FT.light;
    body(0.78, -Wf * 0.012, -20);
    g.fill();
    g.fillStyle = FT.sky;
    body(0.5, -Wf * 0.02, -20);
    g.fill();

    // dark blue shadow down the right-hand edge
    g.fillStyle = FT.dark;
    g.beginPath();
    var y;
    for (y = baseY; y >= -20; y -= 12) (y === baseY ? g.moveTo : g.lineTo).call(g, mid(y) + half(y), y);
    for (y = -20; y <= baseY; y += 12) g.lineTo(mid(y) + half(y) * (0.8 + 0.08 * Math.sin(y * 0.02 + tt * 1.8)), y);
    g.closePath();
    g.fill();
    g.fillStyle = FT.deep;
    g.beginPath();
    for (y = baseY; y >= -20; y -= 12) (y === baseY ? g.moveTo : g.lineTo).call(g, mid(y) + half(y), y);
    for (y = -20; y <= baseY; y += 12) g.lineTo(mid(y) + half(y) * 0.93, y);
    g.closePath();
    g.fill();

    // a sweeping streak: a crescent running from (xa,ya) to (xb,yb) bulging to one side
    function streak(xa, ya, xb, yb, bulge, thick, fill) {
      var mx = (xa + xb) / 2, my = (ya + yb) / 2;
      var dx = yb - ya, dy = xa - xb;                        // normal to the chord
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dx / len, ny = dy / len;
      g.fillStyle = fill;
      g.beginPath();
      g.moveTo(xa, ya);
      g.quadraticCurveTo(mx + nx * bulge, my + ny * bulge, xb, yb);
      g.quadraticCurveTo(mx + nx * (bulge - thick), my + ny * (bulge - thick), xa, ya);
      g.closePath();
      g.fill();
    }
    // licks of light and dark folds pouring upward: each one rides up the
    // column, swinging across it as it climbs, and loops back in at the foot
    var LICKS = [
      [0.00, -0.55, 0.030, 0.012, FT.sky], [0.17, -0.15, 0.025, 0.009, FT.sky],
      [0.33, -0.35, -0.02, 0.008, FT.light], [0.50, 0.25, 0.018, 0.007, FT.mid],
      [0.62, 0.35, -0.02, 0.010, FT.dark], [0.80, -0.65, 0.022, 0.009, FT.sky],
      [0.90, 0.05, -0.015, 0.008, FT.light]
    ];
    var climb = baseY + H * 0.45, len = H * 0.36;
    for (var k = 0; k < LICKS.length; k++) {
      var L = LICKS[k];
      var p = (tt * 0.045 + L[0]) % 1;                   // 0 at the foot .. 1 gone out of the top
      var yb = baseY + H * 0.1 - p * climb;              // leading tip
      var ya = yb + len;                                 // tail
      var swing = Math.sin(tt * 0.7 + k * 1.9) * 0.25;
      var xa = mid(ya) + half(ya) * (L[1] - 0.25 + swing * 0.5);
      var xb = mid(yb) + half(yb) * (L[1] + 0.35 + swing);
      streak(xa, ya, xb, yb, Wf * L[2], Wf * L[3], L[4]);
    }

    // curling tendrils flicking off the sides, high up
    var hk = Math.sin(tt * 1.4) * Wf * 0.012, hk2 = Math.sin(tt * 1.1 + 2) * Wf * 0.01;
    var cu = Math.sin(tt * 0.9) * Wf * 0.006;
    streak(mid(H * 0.34) - half(H * 0.34) + Wf * 0.01, H * 0.36, mid(H * 0.2) - half(H * 0.2) - Wf * 0.035 + hk, H * 0.17 + hk2, -Wf * 0.02 - cu, Wf * 0.008, FT.dark);
    streak(mid(H * 0.3) + half(H * 0.3) - Wf * 0.01, H * 0.33, mid(H * 0.16) + half(H * 0.16) + Wf * 0.03 - hk2, H * 0.13 + hk, Wf * 0.02 + cu, Wf * 0.007, FT.deep);
    streak(mid(H * 0.5) - half(H * 0.5), H * 0.52, mid(H * 0.42) - half(H * 0.42) - Wf * 0.02 - hk, H * 0.4, -Wf * 0.01, Wf * 0.005, FT.mid);

    // flat bright rim where it meets the ground
    g.fillStyle = FT.light;
    g.fillRect(mid(baseY) - half(baseY) * 1.15, baseY - 3, half(baseY) * 2.3, 6);

    // soft cyan glow in the sky around it
    var halo = ctx.createRadialGradient(cx, H * 0.4, 0, cx, H * 0.4, W * 0.42);
    var pulse = 0.85 + 0.15 * Math.sin(tt * 0.8);
    halo.addColorStop(0, 'rgba(60,170,255,' + (0.42 * pulse).toFixed(3) + ')');
    halo.addColorStop(0.45, 'rgba(40,120,240,0.16)');
    halo.addColorStop(1, 'rgba(60,170,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - W * 0.45, 0, W * 0.9, H);

    // drawn pixel-sharp, slightly veiled so it sits far away
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(fountainCv, x0, 0, cw * FOUNTAIN_PX, ch * FOUNTAIN_PX);
    ctx.restore();

    // specks of light rising around it and fading out as they climb
    for (var s = 0; s < 22; s++) {
      var up = (tt * (0.03 + 0.02 * ((s * 37) % 7) / 7) + s / 22) % 1;
      var sy = baseY - up * baseY * 1.05;
      var sx = mid(sy) + Math.sin(s * 12.9 + tt * 0.6) * (half(sy) + span * 0.12);
      ctx.fillStyle = 'rgba(160,230,255,' + (0.85 * (1 - up)).toFixed(3) + ')';
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
    }
  }

  // Ambient light: the sky is jet black, and everything bright in the scene
  // spills a little light into it. The city's glow rises off the skyline, the
  // neon trim and window lights colour the air above them, and the fountain's
  // cyan glow is added in drawFountain.
  function drawAmbient(P, now) {
    var tt = now / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // light pollution rising off the whole skyline
    var city = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.75);
    city.addColorStop(0, 'rgba(60,30,120,0)');
    city.addColorStop(0.7, 'rgba(70,34,130,0.13)');
    city.addColorStop(1, 'rgba(110,60,170,0.20)');
    ctx.fillStyle = city;
    ctx.fillRect(0, H * 0.18, W, H * 0.57);
    // neon glow above each lit building, in its own colour
    for (var i = 0; i < farNeon.length; i++) {
      var s = farNeon[i];
      if (s.orb || s.mast || s.dim) continue;
      var c = NEON[s.c];
      var r = Math.max(60 * unit, s.h * 0.55);
      var cxn = s.x + s.w / 2, cyn = s.y + Math.min(s.h, H * 0.1) * 0.5;
      var g = ctx.createRadialGradient(cxn, cyn, 0, cxn, cyn, r);
      var flick = 0.85 + 0.15 * Math.sin(tt * 0.9 + i * 1.7);
      g.addColorStop(0, 'rgba(' + c.join(',') + ',' + (0.13 * flick).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + c.join(',') + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(cxn - r, cyn - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function drawStars(P) {
    if (P.starA < 0.01) return;
    var count = Math.min(MAX_STARS, Math.round(W * H / 9000));
    ctx.fillStyle = '#dfe6ff';
    for (var i = 0; i < count; i++) {
      var s = stars[i];
      var twinkle = reducedMotion ? 0.85 : 0.65 + 0.35 * Math.sin(clock * s.sp + s.ph);
      // Fade stars out towards the (hazier) horizon.
      ctx.globalAlpha = clamp(P.starA * s.a * twinkle * (1 - s.y * 0.9), 0, 1);
      ctx.fillRect(Math.round(s.x * W), Math.round(s.y * H), s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawMoon(P) {
    if (P.moonA < 0.01 || !moonSprite) return;
    // The moon drifts across the sky during the night (18h -> 6h).
    var mh = hour >= 12 ? hour - 18 : hour + 6;   // 0 at 18h, 6 at midnight, 12 at 6h
    mh = clamp(mh, 0, 12);
    var x = W * (0.82 - (mh / 12) * 0.6);
    var y = H * (0.1 + 0.07 * Math.abs(mh - 6) / 6);

    var glowR = moonSize * 2.5;
    var g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    g.addColorStop(0, 'rgba(190,205,235,' + (0.12 * P.moonA).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(190,205,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);

    ctx.globalAlpha = P.moonA;
    ctx.drawImage(moonSprite, x - moonSize / 2, y - moonSize / 2, moonSize, moonSize);
    ctx.globalAlpha = 1;
  }

  function drawSun(P) {
    if (P.sunA < 0.01) return;
    // Elevation from the scene hour (see sunElevAtHour): 0 at the horizon, 1 high up.
    var elev = sunElevAtHour(hour);
    if (elev < -3) return;
    var e = clamp(elev / 45, -0.08, 1);
    var x = W * clamp(0.15 + (hour - 6) / 13 * 0.7, 0.05, 0.95);  // left at dawn, right at dusk
    var horizonY = H * 0.74;
    var y = horizonY - Math.max(e, 0) * (horizonY - H * 0.12);
    var low = 1 - clamp(e, 0, 1);   // 1 when the sun is near the horizon

    // Big soft glow: wide and warm when low, small and faint when high.
    var glowR = Math.max(W, H) * (0.18 + 0.32 * low);
    var g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    var ga = 0.32 * P.sunA * (0.5 + 0.5 * low);
    g.addColorStop(0, rgba(P.sun, ga));
    g.addColorStop(0.35, rgba(P.sun, ga * 0.35));
    g.addColorStop(1, rgba(P.sun, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);

    // The disc itself (the city layers drawn later hide its lower part).
    var r = clamp(Math.min(W, H) * 0.035, 12, 40);
    ctx.globalAlpha = P.sunA * (0.25 + 0.6 * low);
    ctx.fillStyle = rgb(mixRGB(P.sun, [255, 240, 220], 1 - low));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Fog band near the horizon, drawn between the far and near city layers.
  function drawHaze(P) {
    var top = H * 0.42;
    var g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, rgba(P.haze, 0));
    g.addColorStop(0.55, rgba(P.haze, P.hazeA));
    g.addColorStop(1, rgba(P.haze, P.hazeA * 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
  }

  // Slowly blinking red aircraft warning lights on the tallest antennas.
  function drawWarningLights(P) {
    if (P.lights < 0.02) return;
    var size = Math.max(2, Math.round(2 * unit));
    var glowR = 5 * unit + 3;
    ctx.fillStyle = '#ff2a1f';
    for (var i = 0; i < warningLights.length; i++) {
      var L = warningLights[i];
      var a;
      if (reducedMotion) {
        a = 0.85;   // steady, no blinking
      } else {
        var s = 0.5 + 0.5 * Math.sin(clock * 2.2 + i * 1.7);
        a = s * s * s;   // mostly off, with a slow soft pulse
      }
      a *= P.lights;
      if (a < 0.01) continue;
      ctx.globalAlpha = 0.25 * a;
      ctx.beginPath();
      ctx.arc(L.x, L.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillRect(L.x - size / 2, L.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Wave ribbons
  // ---------------------------------------------------------------------------
  // Fill ribbonMid / ribbonHalf for one ribbon at the current wave time.
  function computeRibbon(rb) {
    var t = waveTime;
    var TAU = Math.PI * 2;
    for (var k = 0; k < ribbonCount; k++) {
      var nx = Math.min(k * RIBBON_STEP, W) / W;   // 0 at the left edge, 1 at the right
      var y = rb.base * H;
      for (var i = 0; i < rb.waves.length; i++) {
        var w = rb.waves[i];
        y += Math.sin(nx * w.freq * TAU + t * w.speed + w.phase) * w.amp * H;
      }
      // cos() of the twist goes negative too, so the edges cross over:
      // that's what makes it look like a ribbon flipping in 3D.
      var tw = rb.twist;
      var twist = Math.cos(nx * tw.freq * TAU + t * tw.speed + tw.phase);
      ribbonMid[k] = y;
      ribbonHalf[k] = rb.thickness * H * 0.5 * twist;
    }
  }

  function ribbonX(k) {
    return Math.min(k * RIBBON_STEP, W);
  }

  function drawRibbons() {
    var colour = 'hsl(' + hue.toFixed(1) + ',55%,68%)';
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.lineJoin = 'round';
    var n = ribbonCount;
    var k, j;

    for (var r = 0; r < RIBBONS.length; r++) {
      var rb = RIBBONS[r];
      computeRibbon(rb);

      // 1) Very faint fill band: along the top edge, back along the bottom.
      ctx.globalAlpha = rb.fillA;
      ctx.beginPath();
      ctx.moveTo(ribbonX(0), ribbonMid[0] - ribbonHalf[0]);
      for (k = 1; k < n; k++) ctx.lineTo(ribbonX(k), ribbonMid[k] - ribbonHalf[k]);
      for (k = n - 1; k >= 0; k--) ctx.lineTo(ribbonX(k), ribbonMid[k] + ribbonHalf[k]);
      ctx.closePath();
      ctx.fill();

      // 2) The two edges as thin lines.
      ctx.globalAlpha = rb.edgeA;
      ctx.lineWidth = rb.edgeW;
      ctx.beginPath();
      ctx.moveTo(ribbonX(0), ribbonMid[0] - ribbonHalf[0]);
      for (k = 1; k < n; k++) ctx.lineTo(ribbonX(k), ribbonMid[k] - ribbonHalf[k]);
      ctx.moveTo(ribbonX(0), ribbonMid[0] + ribbonHalf[0]);
      for (k = 1; k < n; k++) ctx.lineTo(ribbonX(k), ribbonMid[k] + ribbonHalf[k]);
      ctx.stroke();

      // 3) Hairline strands inside the ribbon ("wireframe" look).
      ctx.globalAlpha = rb.hairA;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (j = 0; j < STRANDS.length; j++) {
        var f = STRANDS[j];
        ctx.moveTo(ribbonX(0), ribbonMid[0] + ribbonHalf[0] * f);
        for (k = 1; k < n; k++) ctx.lineTo(ribbonX(k), ribbonMid[k] + ribbonHalf[k] * f);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  // Advance all timers and tweens by `dt` seconds.
  function step(dt) {
    clock += dt;
    waveTime += dt * (reducedMotion ? REDUCED_SPEED : 1);

    if (hueProgress < 1) {
      hueProgress = Math.min(1, hueProgress + dt / HUE_TWEEN_SECONDS);
      hue = hueFrom + hueDelta(hueFrom, hueTo) * smooth(hueProgress);
      hue = ((hue % 360) + 360) % 360;
    }

    if (hourProgress < 1) {
      hourProgress = Math.min(1, hourProgress + dt / TOD_TWEEN_SECONDS);
      hour = hourFrom + hourDelta(hourFrom, hourTo) * smooth(hourProgress);
      hour = ((hour % 24) + 24) % 24;
    }

    // 'auto' mode: follow the real clock, re-checked once a minute.
    if (todMode === 'auto' && Date.now() - lastClockCheck >= CLOCK_CHECK_MS) {
      lastClockCheck = Date.now();
      if (hourProgress >= 1) {
        hour = hourFrom = hourTo = sunHour();
      } else {
        hourTo = sunHour();
      }
    }

    // Random window toggles (not in reduced motion).
    if (!reducedMotion && nearWindows.length) {
      toggleTimer -= dt;
      if (toggleTimer <= 0) {
        toggleRandomWindows();
        toggleTimer = 2 + Math.random() * 4;
      }
    }
    updateWindowAnims(dt);

    // Distant rocket launches (js/launches.js).
    // (rocket launches are switched off)
  }

  // Draw one full frame.
  function render(force) {
    if (!ctx || W === 0 || H === 0 || !farLayer) return;
    var P = paletteAt(hour);

    updateLayers(P, force);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    drawSky(P);
    drawStars(P);
    drawSun(P);
    drawAmbient(P, Date.now());
    drawFountain(P, Date.now());
    ctx.drawImage(farLayer.canvas, 0, 0, W, H);
    drawHaze(P);
    ctx.drawImage(nearLayer.canvas, 0, 0, W, H);
    ctx.drawImage(winLayer.canvas, 0, 0, W, H);
    drawWarningLights(P);
    drawRibbons();

    // Vertical vignette: darken the top and bottom edges.
    ctx.fillStyle = vignetteTop;
    ctx.fillRect(0, 0, W, H * 0.35);
    ctx.fillStyle = vignetteBottom;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    hasDrawn = true;
  }

  function frame(now) {
    rafId = 0;
    if (!isRunning()) return;
    // Delta time in seconds; clamp it so a long stall doesn't cause a big jump.
    var dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    dt = clamp(dt, 0, 0.1);

    step(dt);
    render(false);
    rafId = window.requestAnimationFrame(frame);
  }

  function isRunning() {
    return !!ctx && !userPaused && !tabHidden;
  }

  function start() {
    if (!rafId && isRunning()) {
      lastTime = 0;
      rafId = window.requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function onVisibilityChange() {
    tabHidden = !!document.hidden;
    if (tabHidden) {
      stop();
    } else {
      lastClockCheck = 0;   // re-read the clock straight away
      start();
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.Scene = {
    init: function (el) {
      if (canvas || !el || !el.getContext) return;
      var c = null;
      try { c = el.getContext('2d'); } catch (e) { c = null; }
      if (!c) return;   // no 2D canvas support: fail silently

      farLayer = makeLayer();
      nearLayer = makeLayer();
      winLayer = makeLayer();
      if (!farLayer || !nearLayer || !winLayer) {
        farLayer = nearLayer = winLayer = null;
        return;
      }
      canvas = el;
      ctx = c;

      // Start at the right time of day immediately (no tween on load).
      hour = hourFrom = hourTo = targetHour();
      hourProgress = 1;
      lastClockCheck = Date.now();

      makeStars();
      tabHidden = !!document.hidden;
      resize();

      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibilityChange);

      render(true);
      start();
    },

    setHue: function (h) {
      h = Number(h);
      if (!isFinite(h)) return;
      h = ((h % 360) + 360) % 360;
      if (!hasDrawn || !isRunning()) {
        // Not animating: jump straight there.
        hue = hueFrom = hueTo = h;
        hueProgress = 1;
        if (hasDrawn) render(true);
        return;
      }
      hueFrom = hue;
      hueTo = h;
      hueProgress = 0;
    },

    setReducedMotion: function (b) {
      reducedMotion = !!b;
      if (reducedMotion) updateWindowAnims(0);   // finish any fades instantly
    },

    setPaused: function (b) {
      userPaused = !!b;
      if (userPaused) stop(); else start();
    },

    setTimeOfDay: function (mode) {
      if (mode !== 'auto' && !Object.prototype.hasOwnProperty.call(FORCED_HOURS, mode)) mode = 'auto';
      todMode = mode;
      lastClockCheck = Date.now();
      var target = targetHour();
      if (!hasDrawn || !isRunning()) {
        // Before the first frame (or while paused): jump straight there.
        hour = hourFrom = hourTo = target;
        hourProgress = 1;
        if (hasDrawn) render(true);
        return;
      }
      hourFrom = hour;
      hourTo = target;
      hourProgress = 0;
    }
  };
})();
