/*
 * launches.js: distant rocket launches in the background sky.
 *
 * Real vehicles only (Falcon 9, Falcon Heavy, Starship, Atlas V, Vulcan,
 * New Glenn), launched from a "coast" 260-380 km away, beyond the horizon.
 * Nothing is sped up: a flight takes ~8-9 real minutes, like watching
 * from a long way off.
 *
 * How it works:
 *   - Each vehicle follows a typical ascent profile (altitude + downrange
 *     distance over time). Its 3D position is projected onto the screen,
 *     including Earth's curvature, so it rises from behind the skyline, arcs
 *     over and sinks back toward the horizon as it heads downrange.
 *   - What you see depends on the light:
 *       night        engine flames are bright points, the exhaust stays dark
 *       day          a faint point plus a grey smoke trail low down
 *       dawn / dusk  exhaust above Earth's shadow is lit by the sun and
 *                    balloons out into the glowing "jellyfish" plume
 *   - Staging is modelled per vehicle: SRB jettison, Falcon boostback burns,
 *     Starship hot staging, the near-invisible hydrogen Centaur upper stage...
 *
 * js/scene.js calls Launches.update(dt) every frame and Launches.draw(...)
 * between the sky and the city. Also exposed for fun/testing:
 *   Launches.launchNow("Starship", 200)  start one (optionally fast-forwarded by N seconds)
 *   Launches.setEnabled(false)            turn launches off
 *   Launches.current()                    { vehicle, t } of the flight in progress
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var R_EARTH = 6371;        // km
  var G = 0.0098;            // gravity, km/s²
  var FOV = 1.25;            // radians shown across the screen width (~72°)
  var HORIZON = 0.74;        // horizon height, fraction of screen height (matches the sun in scene.js)
  var SUNRISE = 6.6, SUNSET = 18.7;   // hours (rocket lighting only)
  var DEG = Math.PI / 180;

  var PUFF_EVERY = 0.6;      // seconds between exhaust "puffs" from a burning engine
  var MAX_PUFFS = 800;
  var PLUME_LIFE = 260;      // seconds a sunlit plume puff lingers
  var SMOKE_LIFE = 160;      // seconds a daytime smoke puff lingers
  var TAIL_SAMPLES = 18;     // recent positions kept for the short glowing tail

  // Typical ascent profile: time (s) -> altitude (km) and downrange distance (km).
  // Roughly a Falcon 9 to low Earth orbit; the other vehicles are close enough
  // at this distance. Beyond the end it keeps going at orbital speed.
  var PT = [0, 20, 40, 60, 80, 100, 120, 150, 180, 220, 270, 330, 400, 470, 540];
  var PA = [0, 1.5, 5, 11, 20, 31, 43, 65, 85, 110, 135, 160, 180, 195, 205];
  var PS = [0, 0.1, 0.8, 3, 8, 16, 28, 60, 100, 170, 280, 450, 680, 950, 1250];

  // How each propellant looks.
  //   core/glow   colours of the flame point and its halo
  //   point       flame brightness at night (hydrogen burns almost invisibly)
  //   smoke       daytime smoke trail strength (solids are smoky, methane is clean)
  //   plume       how strongly the exhaust lights up in twilight
  var FUEL = {
    kero:     { core: [255, 226, 170], glow: [255, 150, 60],  point: 1.0,  smoke: 0.9, plume: 1.0 },
    srb:      { core: [255, 240, 210], glow: [255, 175, 90],  point: 1.3,  smoke: 1.7, plume: 1.0 },
    methalox: { core: [240, 238, 255], glow: [255, 175, 120], point: 0.95, smoke: 0.3, plume: 1.0 },
    mvac:     { core: [255, 232, 200], glow: [255, 170, 100], point: 0.45, smoke: 0,   plume: 1.0 },
    hydrolox: { core: [215, 228, 255], glow: [150, 180, 255], point: 0.12, smoke: 0,   plume: 0.75 }
  };

  // Sunlit exhaust is mostly white-blue ice; a few puffs get a faint tint.
  var PLUME_TINTS = [[200, 225, 255], [215, 235, 255], [228, 216, 255], [195, 240, 246]];

  // ---------------------------------------------------------------------------
  // Vehicles. Each returns a list of "bodies" (things that can burn).
  //   burns  [[start, end], ...] in seconds after liftoff
  //   bright flame brightness multiplier
  //   sep    time it separates from the stack (then falls ballistically)
  //   boost  [start, end] of a boostback burn after separation (recoverable boosters)
  //   lat    sideways drift after separation, km/s (side boosters, SRBs)
  //   flash  hot-staging flash at this time
  // ---------------------------------------------------------------------------
  var VEHICLES = {
    'Falcon 9': { weight: 40, build: function (rng) {
      return [
        { fuel: 'kero', bright: 1.1, burns: [[0, 155]], sep: 158, boost: rng() < 0.6 ? [170, 206] : null },
        { fuel: 'mvac', bright: 1, burns: [[166, 520]] }
      ];
    } },
    'Falcon Heavy': { weight: 10, build: function () {
      return [
        { fuel: 'kero', bright: 1.1, burns: [[0, 150]], sep: 152, lat: -0.012, boost: [163, 197] },
        { fuel: 'kero', bright: 1.1, burns: [[0, 150]], sep: 152, lat: 0.012, boost: [163, 197] },
        { fuel: 'kero', bright: 1.1, burns: [[0, 185]], sep: 188 },
        { fuel: 'mvac', bright: 1, burns: [[196, 520]] }
      ];
    } },
    'Starship': { weight: 15, build: function () {
      return [
        { fuel: 'methalox', bright: 2.4, burns: [[0, 160]], sep: 161, boost: [168, 214], boostBright: 1.3 },
        { fuel: 'methalox', bright: 0.95, burns: [[160, 520]], flash: 160 }
      ];
    } },
    'Atlas V': { weight: 12, build: function (rng) {
      var list = [{ fuel: 'kero', bright: 1.1, burns: [[0, 253]], sep: 256 }];
      var n = rng() < 0.5 ? 2 : 4;   // common configurations
      for (var i = 0; i < n; i++) {
        list.push({ fuel: 'srb', bright: 0.55, burns: [[0, 95]], sep: 98, lat: (i % 2 ? 1 : -1) * 0.004 * (1 + (i >> 1)) });
      }
      list.push({ fuel: 'hydrolox', bright: 1, burns: [[263, 900]] });   // Centaur: nearly invisible
      return list;
    } },
    'Vulcan': { weight: 10, build: function (rng) {
      var list = [{ fuel: 'methalox', bright: 1.3, burns: [[0, 300]], sep: 303 }];
      var n = rng() < 0.5 ? 2 : 4;
      for (var i = 0; i < n; i++) {
        list.push({ fuel: 'srb', bright: 0.6, burns: [[0, 90]], sep: 93, lat: (i % 2 ? 1 : -1) * 0.004 * (1 + (i >> 1)) });
      }
      list.push({ fuel: 'hydrolox', bright: 1, burns: [[312, 900]] });   // Centaur V
      return list;
    } },
    'New Glenn': { weight: 13, build: function () {
      return [
        { fuel: 'methalox', bright: 1.7, burns: [[0, 190]], sep: 193 },   // lands far downrange: no boostback
        { fuel: 'hydrolox', bright: 1, burns: [[200, 900]] }
      ];
    } }
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var enabled = true;
  var launch = null;          // the flight in progress
  var nextIn = 12 + Math.random() * 14;   // seconds until the next liftoff
  var rng = Math.random;

  // Scratch object for projections (avoids garbage every frame).
  var pt = { x: 0, y: 0, d: 0, el: 0 };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // Linear interpolation in the ascent profile; extrapolates past the end.
  function prof(t, ys, extrapolate) {
    if (t <= 0) return 0;
    var n = PT.length;
    if (t >= PT[n - 1]) {
      if (!extrapolate) return ys[n - 1];
      var slope = (ys[n - 1] - ys[n - 2]) / (PT[n - 1] - PT[n - 2]);
      return ys[n - 1] + slope * (t - PT[n - 1]);
    }
    for (var i = 1; i < n; i++) {
      if (t <= PT[i]) {
        var f = (t - PT[i - 1]) / (PT[i] - PT[i - 1]);
        return ys[i - 1] + (ys[i] - ys[i - 1]) * f;
      }
    }
    return ys[n - 1];
  }
  function altAt(t) { return prof(t, PA, false) + Math.max(0, t - 540) * 0.01; }
  function rangeAt(t) { return prof(t, PS, true); }

  function pickVehicle() {
    var total = 0, k;
    for (k in VEHICLES) total += VEHICLES[k].weight;
    var r = rng() * total;
    for (k in VEHICLES) { r -= VEHICLES[k].weight; if (r <= 0) return k; }
    return 'Falcon 9';
  }

  // Degrees the sun is below the horizon (negative = sun is up).
  function sunDepression(h) {
    if (h >= SUNRISE && h <= SUNSET) return -Math.min(h - SUNRISE, SUNSET - h) * 14;
    var hrs = h < SUNRISE ? SUNRISE - h : h - SUNSET;
    if (hrs > 12) hrs = 24 - hrs;
    return hrs * 14;
  }

  // Altitude (km) of Earth's shadow overhead for a given sun depression.
  function shadowHeight(dep) {
    if (dep <= 0) return -1e9;
    return R_EARTH * (1 / Math.cos(Math.min(dep, 60) * DEG) - 1);
  }

  // ---------------------------------------------------------------------------
  // Starting a flight
  // ---------------------------------------------------------------------------
  function start(name) {
    if (!VEHICLES[name]) name = pickVehicle();
    var dir = rng() < 0.65 ? 1 : -1;         // heads right (more often) or left across the view
    var heading = (40 + rng() * 32) * DEG;   // angle between our line of sight and its ground track
    launch = {
      vehicle: name,
      t: 0,
      az0: (-6 + rng() * 30) * DEG * (dir > 0 ? 1 : 0.6),   // where the pad is (right of the menu, mostly)
      D: 260 + rng() * 120,                                    // km to the pad
      sinH: Math.sin(heading), cosH: Math.cos(heading), dir: dir,
      bodies: [],
      puffs: [],
      flashes: [],
      done: false
    };
    var defs = VEHICLES[name].build(rng);
    for (var i = 0; i < defs.length; i++) {
      var b = defs[i];
      b.latV = b.lat || 0;     // sideways drift speed after separation (km/s)
      b.alt = 0; b.s = 0; b.lat = 0;
      b.free = false;          // true once separated (ballistic)
      b.dead = false;
      b.level = 0;             // current flame level 0..1 (fades on/off)
      b.puffT = rng() * PUFF_EVERY;
      b.tail = [];
      b.tailT = 0;
      b.flashDone = false;
      launch.bodies.push(b);
    }
  }

  function burningAt(b, t) {
    for (var i = 0; i < b.burns.length; i++) {
      if (t >= b.burns[i][0] && t < b.burns[i][1]) return true;
    }
    return !!(b.boost && t >= b.boost[0] && t < b.boost[1]);
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------
  function updateBody(b, t, dt) {
    if (b.dead) return;

    if (!b.free) {
      // Still riding the ascent profile.
      b.alt = altAt(t);
      b.s = rangeAt(t);
      if (b.sep && t >= b.sep) {
        // Separation: keep the current velocity, then fall ballistically.
        b.free = true;
        b.vAlt = (altAt(t + 0.5) - altAt(t - 0.5));
        b.vS = (rangeAt(t + 0.5) - rangeAt(t - 0.5));
        b.vLat = b.latV;
        if (b.boost) b.boostDecel = (b.vS * 1.35) / (b.boost[1] - b.boost[0]);
      }
    } else {
      b.vAlt -= G * dt;
      if (b.boost && t >= b.boost[0] && t < b.boost[1]) {
        b.vS -= b.boostDecel * dt;     // flip and burn back toward the coast
        b.vAlt += 0.004 * dt;          // a little lofting
      }
      b.alt += b.vAlt * dt;
      b.s += b.vS * dt;
      b.lat += b.vLat * dt;
      if (b.alt < 0) b.dead = true;
    }

    // Flame fades on/off quickly instead of popping.
    var on = burningAt(b, t) && !b.dead;
    b.level = clamp(b.level + (on ? 4 : -2.5) * dt, 0, 1);

    // Hot-staging flash (Starship).
    if (b.flash && !b.flashDone && t >= b.flash) {
      b.flashDone = true;
      launch.flashes.push({ alt: b.alt, s: b.s, lat: b.lat, age: 0, life: 1.6 });
    }

    // Exhaust puffs while burning.
    if (b.level > 0.3 && b.alt > 0.6) {
      b.puffT -= dt;
      if (b.puffT <= 0) {
        var boosting = b.boost && t >= b.boost[0];
        // Boostback boosters almost hover while turning around, so puffs would
        // pile up in one spot; emit them less often.
        b.puffT = boosting ? PUFF_EVERY * 2.6 : PUFF_EVERY;
        launch.puffs.push({
          alt: b.alt, s: b.s, lat: b.lat, age: 0,
          fuel: b.fuel,
          grow: boosting ? 1.35 : 1,   // boostback exhaust fans out wider
          tint: PLUME_TINTS[(rng() * PLUME_TINTS.length) | 0],
          drift: (rng() - 0.5) * 0.004
        });
        if (launch.puffs.length > MAX_PUFFS) launch.puffs.shift();
      }
    }

    // Recent positions for the short glowing tail.
    b.tailT -= dt;
    if (b.tailT <= 0) {
      b.tailT = 0.25;
      b.tail.push(b.alt, b.s, b.lat);
      if (b.tail.length > TAIL_SAMPLES * 3) b.tail.splice(0, 3);
    }
  }

  function update(dt) {
    if (!launch) {
      if (!enabled) return;
      nextIn -= dt;
      if (nextIn <= 0) start();
      return;
    }
    var L = launch;
    L.t += dt;
    var t = L.t;

    var anyAlive = false;
    for (var i = 0; i < L.bodies.length; i++) {
      var b = L.bodies[i];
      updateBody(b, t, dt);
      // Gone below the horizon (Earth's curvature): nothing more to see.
      if (!b.dead && t > 200 && elevation(L, b) < -0.01) b.dead = true;
      var lastBurn = b.boost ? b.boost[1] : b.burns[b.burns.length - 1][1];
      if (!b.dead && (t < lastBurn + 5 || b.level > 0)) anyAlive = true;
    }

    // Age the puffs and flashes; wind drifts them slowly sideways.
    for (var p = L.puffs.length - 1; p >= 0; p--) {
      var q = L.puffs[p];
      q.age += dt;
      q.lat += q.drift * dt;
      if (q.age > PLUME_LIFE) L.puffs.splice(p, 1);
    }
    for (var f = L.flashes.length - 1; f >= 0; f--) {
      L.flashes[f].age += dt;
      if (L.flashes[f].age > L.flashes[f].life) L.flashes.splice(f, 1);
    }

    if (!anyAlive) L.done = true;
    if (L.done && !L.puffs.length) {
      launch = null;
      nextIn = 45 + rng() * 110;   // a minute or two between launches
    }
  }

  // Angle of a body above the horizon as seen by us (radians).
  function elevation(L, b) {
    var across = b.s * L.sinH * L.dir + b.lat * L.cosH;
    var away = L.D + b.s * L.cosH - b.lat * L.sinH * L.dir;
    var dist = Math.sqrt(across * across + away * away);
    return Math.atan2(b.alt - dist * dist / (2 * R_EARTH), dist);
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  // World position (altitude, downrange, sideways; km) -> screen position.
  function project(V, L, alt, s, lat) {
    var across = s * L.sinH * L.dir + lat * L.cosH;
    var away = L.D + s * L.cosH - lat * L.sinH * L.dir;
    var dist = Math.sqrt(across * across + away * away);
    var hEff = alt - dist * dist / (2 * R_EARTH);   // Earth's curvature hides distant objects
    var el = Math.atan2(hEff, dist);
    pt.x = V.W / 2 + (L.az0 + Math.atan2(across, away)) * V.k;
    pt.y = V.horizon - el * V.k;
    pt.d = Math.sqrt(dist * dist + alt * alt);
    pt.el = el;
    return pt;
  }

  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }

  function draw(ctx, view) {
    var L = launch;
    if (!L) return;
    var W = view.W, H = view.H, P = view.P;
    var V = { W: W, H: H, k: Math.max(W, H * 1.2) / FOV, horizon: H * HORIZON };

    var dep = sunDepression(view.hour);
    var shadowH = shadowHeight(dep);
    var twilight = dep > 0 ? smoothstep(0.6, 4, dep) : 0;      // sky dark enough to see lit plumes
    var dayness = clamp(P.day, 0, 1);
    var smokeVis = smoothstep(0.35, 0.85, dayness);
    var i, b, q, c;

    // 1) Daytime smoke trail (low altitude only), drawn normally.
    if (smokeVis > 0.01) {
      for (i = 0; i < L.puffs.length; i++) {
        q = L.puffs[i];
        var fs = FUEL[q.fuel].smoke;
        if (!fs || q.alt > 32 || q.age > SMOKE_LIFE) continue;
        c = project(V, L, q.alt, q.s, q.lat);
        if (c.el < -0.02) continue;
        var rs = (0.14 + q.age * 0.006 * (q.fuel === 'srb' ? 1.6 : 1)) / c.d * V.k;
        var as = 0.2 * fs * smokeVis * (1 - q.age / SMOKE_LIFE) / (1 + rs / 6);
        if (as < 0.004) continue;
        ctx.fillStyle = rgba([226, 229, 234], as);
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(0.8, rs), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'lighter';

    // 2) Twilight "jellyfish": exhaust above Earth's shadow catches the sun.
    if (twilight > 0.01) {
      var dim = 1 - 0.55 * dayness;
      for (i = 0; i < L.puffs.length; i++) {
        q = L.puffs[i];
        if (q.alt < shadowH) continue;            // still in Earth's shadow: dark
        var fp = FUEL[q.fuel].plume;
        // Exhaust expands far more in thin air: tens of km wide up high.
        var growth = 0.003 + Math.max(0, q.alt - 28) * 0.0024 * q.grow;
        var rk = Math.min(40, 0.2 + q.age * growth);
        c = project(V, L, q.alt, q.s, q.lat);
        if (c.el < -0.01) continue;
        var rp = rk / c.d * V.k;
        // Fade in just above the shadow line, fade out with age and size.
        var edge = smoothstep(shadowH, shadowH + 6, q.alt);
        var ap = 0.045 * fp * twilight * dim * edge * (1 - q.age / PLUME_LIFE) / (1 + rp / 10);
        if (ap < 0.003) continue;
        ctx.fillStyle = rgba(q.tint, ap);
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(1, rp), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3) Flames: a short glowing tail plus a bright point with a halo.
    var pointDim = 1 - 0.8 * dayness;
    for (i = 0; i < L.bodies.length; i++) {
      b = L.bodies[i];
      if (b.level <= 0.01 || b.dead) continue;
      var F = FUEL[b.fuel];
      var bright = (b.boost && b.free ? (b.boostBright || 0.9) : b.bright);
      c = project(V, L, b.alt, b.s, b.lat);
      if (c.el < -0.01) continue;
      var x = c.x, y = c.y;
      var distF = clamp(300 / c.d, 0.3, 1.3);
      var ext = clamp(c.el / 0.05, 0.3, 1);       // dimmer through thick air near the horizon
      var a = F.point * bright * b.level * distF * ext * pointDim;
      if (a < 0.01) continue;

      // Tail
      if (b.tail.length >= 6) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = rgba(F.glow, Math.min(0.5, a * 0.35));
        ctx.beginPath();
        for (var k = 0; k < b.tail.length; k += 3) {
          var tp = project(V, L, b.tail[k], b.tail[k + 1], b.tail[k + 2]);
          if (k === 0) ctx.moveTo(tp.x, tp.y); else ctx.lineTo(tp.x, tp.y);
        }
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Halo + core
      var r = 3 + 9 * Math.min(a, 1.5);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(F.core, Math.min(1, a)));
      g.addColorStop(0.25, rgba(F.glow, Math.min(1, a * 0.45)));
      g.addColorStop(1, rgba(F.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = rgba([255, 250, 240], Math.min(1, a * 1.2));
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }

    // 4) Staging flashes
    for (i = 0; i < L.flashes.length; i++) {
      var fl = L.flashes[i];
      c = project(V, L, fl.alt, fl.s, fl.lat);
      var life = fl.age / fl.life;
      var af = (1 - life) * (1 - life) * (0.9 - 0.6 * dayness);
      var rf = 6 + 26 * life;
      var gf = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rf);
      gf.addColorStop(0, rgba([255, 240, 220], af));
      gf.addColorStop(0.4, rgba([255, 170, 110], af * 0.4));
      gf.addColorStop(1, rgba([255, 170, 110], 0));
      ctx.fillStyle = gf;
      ctx.fillRect(c.x - rf, c.y - rf, rf * 2, rf * 2);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.Launches = {
    update: function (dt) {
      try { update(dt); } catch (e) { launch = null; }
    },
    draw: function (ctx, view) {
      try { draw(ctx, view); } catch (e) { ctx.globalCompositeOperation = 'source-over'; }
    },
    // Start a launch now. `skip` fast-forwards that many seconds (for testing).
    launchNow: function (name, skip) {
      start(name);
      var n = Math.round((skip || 0) / 0.2);
      for (var i = 0; i < n && launch; i++) update(0.2);
    },
    setEnabled: function (on) {
      enabled = !!on;
      if (!enabled) launch = null;
      else if (!launch) nextIn = Math.min(nextIn, 10 + Math.random() * 10);
    },
    isEnabled: function () { return enabled; },
    current: function () { return launch ? { vehicle: launch.vehicle, t: launch.t } : null; },
    vehicles: function () { return Object.keys(VEHICLES); }
  };
})();
