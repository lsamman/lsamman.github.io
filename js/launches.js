/*
 * launches.js: distant rocket launches in the background sky.
 *
 * Real vehicles only (Falcon 9, Falcon Heavy, Starship, Atlas V, Vulcan,
 * New Glenn), launched from a "coast" 260-380 km away, beyond the horizon.
 * Nothing is sped up: a flight takes ~8-9 real minutes, like watching
 * from a long way off.
 *
 * How it works:
 *   - Each flight integrates a smooth gravity turn: speed builds up while the
 *     flight-path angle eases over from vertical. Its 3D position is projected onto the screen,
 *     including Earth's curvature, so it rises from behind the skyline, arcs
 *     over and sinks back toward the horizon as it heads downrange.
 *   - What the exhaust does depends on altitude, like the real atmosphere:
 *       below ~35 km    thick air: a narrow smoke/condensation trail that spreads slowly
 *       above ~40 km    near vacuum: exhaust balloons out tens of km wide
 *     ...and what you can SEE depends on the light (real sun position, js/sun.js):
 *       night        engine flames are points; exhaust stays dark
 *       day          a faint point plus the low smoke trail (upper stages: no trail)
 *       dawn / dusk  exhaust above Earth's shadow is sunlit: a warm contrail
 *                    low down, and the glowing "jellyfish" plume up high
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
  var DEG = Math.PI / 180;

  var PUFF_EVERY = 0.6;      // seconds between exhaust "puffs" from a burning engine
  var MAX_PUFFS = 800;
  var PLUME_LIFE = 260;      // seconds a sunlit plume puff lingers
  var SMOKE_LIFE = 160;      // seconds a daytime smoke puff lingers
  var TAIL_SAMPLES = 10;     // recent positions kept for the short glowing tail (thick air only)

  // Ascent model (a smooth gravity turn), tuned to a typical Falcon 9 to low
  // Earth orbit: ~70 km up and ~80 km downrange at staging (T+2:30), orbit
  // insertion around 200 km at T+8:40. The other vehicles are close enough
  // at this distance.
  //   speed  builds up during the first-stage burn, holds through staging,
  //          then the upper stage accelerates to orbital speed
  //   angle  stays vertical for 8 s, then eases over (no sudden pitch kick)
  //          and flattens out exponentially toward horizontal
  var TRAJ_DT = 0.5;         // seconds per precomputed step
  var TRAJ_END = 1200;       // seconds of trajectory to precompute

  function speedAt(t) {      // km/s
    if (t <= 155) return 2.2 * Math.pow(t / 155, 1.8);
    if (t <= 166) return 2.2;
    return Math.min(7.8, 2.2 + 5.4 * Math.pow((t - 166) / 354, 1.2));
  }

  function buildTrajectory(tau) {
    var n = Math.ceil(TRAJ_END / TRAJ_DT) + 1;
    var A = new Float32Array(n), S = new Float32Array(n);
    var alt = 0, rng = 0;
    for (var i = 0; i < n; i++) {
      A[i] = alt; S[i] = rng;
      var t = (i + 0.5) * TRAJ_DT;
      var u = t < 8 ? 0 : (t - 8) * (t - 8) / (t - 8 + 30);   // eases in from 0
      var gamma = 90 * Math.exp(-u / tau) * DEG;              // flight-path angle
      var v = speedAt(t);
      alt += v * Math.sin(gamma) * TRAJ_DT;
      rng += v * Math.cos(gamma) * TRAJ_DT;
    }
    return { A: A, S: S };
  }

  var traj = buildTrajectory(95);

  function sample(arr, t) {
    if (t <= 0) return 0;
    var x = t / TRAJ_DT, i = Math.floor(x);
    if (i >= arr.length - 1) return arr[arr.length - 1];
    return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
  }
  function altAt(t) { return sample(traj.A, t); }
  function rangeAt(t) { return sample(traj.S, t); }

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
  //   burns    [[start, end, power?], ...] seconds after liftoff; power scales
  //            brightness for that window (e.g. 3 of 33 engines = 0.12)
  //   bright   flame brightness multiplier
  //   sep      time it separates from the stack (then flies ballistically)
  //   boost    [start, end] of a boostback burn (back toward the coast)
  //   entry    { alt, dur, power } entry burn, lit when it falls back to `alt` km
  //   landing  { power } landing burn, lit a few km up (usually hidden below
  //            the horizon from this far away, just like in real life)
  //   lat      sideways drift after separation, km/s (side boosters, SRBs)
  //   flash    staging flash at this time
  //   hotStage Starship: ship lights while still attached and vents through the interstage
  // ---------------------------------------------------------------------------
  var F9_ENTRY = { alt: 64, dur: 20, power: 0.85 };    // 3 engines at full throttle: a bright "star" relighting
  var F9_LANDING = { power: 0.2 };                      // 1 engine

  var VEHICLES = {
    'Falcon 9': { weight: 40, build: function (rng) {
      return [
        // ~60% return to the coast (boostback); the rest land on a droneship downrange
        { fuel: 'kero', bright: 1.1, burns: [[0, 155]], sep: 158, boost: rng() < 0.6 ? [170, 206] : null,
          entry: F9_ENTRY, landing: F9_LANDING },
        { fuel: 'mvac', bright: 1, burns: [[166, 520]] }
      ];
    } },
    'Falcon Heavy': { weight: 10, build: function (rng) {
      var coreRecovered = rng() < 0.5;
      return [
        { fuel: 'kero', bright: 1.1, burns: [[0, 150]], sep: 152, lat: -0.012, boost: [163, 197], entry: F9_ENTRY, landing: F9_LANDING },
        { fuel: 'kero', bright: 1.1, burns: [[0, 150]], sep: 152, lat: 0.012, boost: [163, 197], entry: F9_ENTRY, landing: F9_LANDING },
        { fuel: 'kero', bright: 1.1, burns: [[0, 185]], sep: 188,
          entry: coreRecovered ? { alt: 70, dur: 26, power: 0.85 } : null, landing: coreRecovered ? F9_LANDING : null },
        { fuel: 'mvac', bright: 1, burns: [[196, 520]] }
      ];
    } },
    'Starship': { weight: 15, build: function () {
      return [
        // Super Heavy: 33 engines, down to the 3 centre engines for hot staging.
        // The ship's exhaust hitting the booster's dome lights it up briefly.
        { fuel: 'methalox', bright: 2.4, burns: [[0, 158], [158, 159, 0.12], [159, 162, 0.45], [162, 166, 0.12]],
          sep: 162, boost: [169, 214], boostBright: 1.3, landing: { power: 0.5 } },   // no entry burn; caught by the tower
        { fuel: 'methalox', bright: 0.95, burns: [[159, 520]], flash: 159, hotStage: true }
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
        // Lands on a ship far downrange: no boostback, but entry + landing burns.
        { fuel: 'methalox', bright: 1.7, burns: [[0, 190]], sep: 193,
          entry: { alt: 60, dur: 24, power: 0.7 }, landing: { power: 0.25 } },
        { fuel: 'hydrolox', bright: 1, burns: [[200, 900]] }
      ];
    } }
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var enabled = true;
  // Several flights can be in the sky at once. `launch` is the one currently
  // being simulated or drawn (the helper functions below work on it).
  var flights = [];
  var launch = null;
  var MAX_ASCENDING = 6;      // at most this many rockets climbing at the same time
  var ASCENT_END = 420;       // seconds: after this a flight is just plumes and landing boosters
  var nextIn = 2 + Math.random() * 3;   // seconds until the next liftoff
  function nextGap() { return 30 + rng() * 40; }   // ~30-70 seconds between liftoffs
  var rng = Math.random;

  // Scratch object for projections (avoids garbage every frame).
  var pt = { x: 0, y: 0, d: 0, el: 0 };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  function pickVehicle() {
    var total = 0, k;
    for (k in VEHICLES) total += VEHICLES[k].weight;
    var r = rng() * total;
    for (k in VEHICLES) { r -= VEHICLES[k].weight; if (r <= 0) return k; }
    return 'Falcon 9';
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
    traj = buildTrajectory(90 + rng() * 12);   // each flight's turn is a little different
    launch = {
      traj: traj,
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
      b.dyn = [];              // burns that start in flight (entry, landing): [start, end, power]
      b.entryDone = false;
      b.landingOn = false;
      launch.bodies.push(b);
    }
    flights.push(launch);
  }

  // Point the shared helpers at one flight.
  function use(L) { launch = L; traj = L.traj; }

  // Flame power right now (0 = off): window power x body brightness.
  function burnPower(b, t) {
    var i, w;
    for (i = 0; i < b.burns.length; i++) {
      w = b.burns[i];
      if (t >= w[0] && t < w[1]) return b.bright * (w.length > 2 ? w[2] : 1);
    }
    if (b.boost && t >= b.boost[0] && t < b.boost[1]) return b.boostBright || b.bright;
    for (i = 0; i < b.dyn.length; i++) {
      w = b.dyn[i];
      if (t >= w[0] && t < w[1]) return b.bright * w[2];
    }
    return 0;
  }

  var DRAG_K = 0.11;   // gives a booster a terminal speed of ~0.3 km/s at sea level

  // Free flight after separation: gravity, drag in thick air, and burns.
  function flyFree(b, t, dt) {
    b.vAlt -= G * dt;

    if (b.boost && t >= b.boost[0] && t < b.boost[1]) {
      b.vS -= b.boostDecel * dt;     // flip and burn back toward the coast
      b.vAlt += 0.004 * dt;          // a little lofting
    }

    var speed = Math.sqrt(b.vAlt * b.vAlt + b.vS * b.vS + b.vLat * b.vLat) || 1e-6;
    var decel = DRAG_K * Math.exp(-Math.max(0, b.alt) / 7.2) * speed * speed;   // air drag

    // Entry burn: on the way down, back into the upper atmosphere.
    if (b.entry && !b.entryDone && b.vAlt < 0 && b.alt <= b.entry.alt) {
      b.entryDone = true;
      b.dyn.push([t, t + b.entry.dur, b.entry.power]);
    }
    for (var i = 0; i < b.dyn.length; i++) {
      if (t >= b.dyn[i][0] && t < b.dyn[i][1]) decel += 0.035;   // retro thrust
    }

    // Landing burn: a "hoverslam" sized to stop right at the surface.
    if (b.landing && !b.landingOn && b.vAlt < 0 && b.alt <= 2.6) {
      b.landingOn = true;
      b.dyn.push([t, t + 60, b.landing.power]);
    }
    if (b.landingOn) decel = Math.max(decel, speed * speed / (2 * Math.max(0.05, b.alt)) + G);

    var f = Math.min(1, decel * dt / speed);   // never reverse the velocity
    b.vAlt -= b.vAlt * f;
    b.vS -= b.vS * f;
    b.vLat -= b.vLat * f;

    b.alt += b.vAlt * dt;
    b.s += b.vS * dt;
    b.lat += b.vLat * dt;
    if (b.alt <= 0.02) {
      b.dead = true;   // touchdown (or splashdown for expendable stages)
      b.level = 0;
    }
  }

  // Starship hot staging: the ship lights while still attached, and its
  // exhaust blasts out sideways through the vented interstage: a ring of
  // glowing gas that's left behind as the stack climbs away.
  function hotStagingRing(b, t) {
    // Direction of travel (in the altitude/downrange plane) and its perpendicular.
    var dA = altAt(t + 0.5) - altAt(t - 0.5), dS = rangeAt(t + 0.5) - rangeAt(t - 0.5);
    var m = Math.sqrt(dA * dA + dS * dS) || 1;
    var pA = dS / m, pS = -dA / m;
    for (var k = 0; k < 12; k++) {
      var th = (k / 12) * Math.PI * 2 + rng() * 0.4;
      var v = 0.35 + rng() * 0.35;                    // km/s outward
      launch.puffs.push({
        alt: b.alt, s: b.s, lat: b.lat, age: 0, fuel: 'methalox', grow: 2.2, soft: 0.45,
        tint: PLUME_TINTS[(rng() * PLUME_TINTS.length) | 0], drift: 0,
        va: Math.sin(th) * pA * v, vs: Math.sin(th) * pS * v, vl: Math.cos(th) * v,
        glow: 2.4                                      // hot: glows by itself for a moment
      });
    }
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
        // Separation: keep the current velocity, then fly freely.
        b.free = true;
        b.vAlt = (altAt(t + 0.5) - altAt(t - 0.5));
        b.vS = (rangeAt(t + 0.5) - rangeAt(t - 0.5));
        b.vLat = b.latV;
        if (b.boost) b.boostDecel = (b.vS * 1.35) / (b.boost[1] - b.boost[0]);
      }
    } else {
      flyFree(b, t, dt);
      if (b.dead) return;
    }

    // Flame fades on/off quickly instead of popping.
    var power = burnPower(b, t);
    b.power = power > 0 ? power : (b.power || 0);
    b.level = clamp(b.level + (power > 0 ? 4 : -2.5) * dt, 0, 1);

    // Staging flash, and Starship's hot-staging ring (three pulses as it vents).
    if (b.flash && !b.flashDone && t >= b.flash) {
      b.flashDone = true;
      b.ringPulses = b.hotStage ? 3 : 0;
      b.ringT = 0;
      launch.flashes.push({ alt: b.alt, s: b.s, lat: b.lat, age: 0, life: 1.6 });
    }
    if (b.ringPulses > 0) {
      b.ringT -= dt;
      if (b.ringT <= 0) { hotStagingRing(b, t); b.ringPulses--; b.ringT = 0.9; }
    }

    // Exhaust puffs while burning.
    if (b.level > 0.3 && b.alt > 0.6) {
      b.puffT -= dt;
      if (b.puffT <= 0) {
        var turning = b.free && b.boost && t >= b.boost[0] && t < b.boost[1] + 2;
        var retro = b.free && !turning;    // entry/landing burn: exhaust thrown forward, fans out
        // Boosters almost hover while turning around, so puffs would pile up
        // in one spot; emit them less often.
        b.puffT = turning ? PUFF_EVERY * 2.6 : retro ? PUFF_EVERY * 1.5 : PUFF_EVERY;
        launch.puffs.push({
          alt: b.alt, s: b.s, lat: b.lat, age: 0,
          fuel: b.fuel,
          grow: turning ? 1.35 : retro ? 1.6 : 1,
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
    if (enabled) {
      nextIn -= dt;
      var ascending = 0, inView = 0;
      for (var k = 0; k < flights.length; k++) {
        if (flights[k].t < ASCENT_END) ascending++;
        if (flights[k].t < ASCENT_END - 60) inView++;   // still has a good while left in the sky
      }
      // Always keep a rocket in the sky: if the last one is about to leave, launch another now
      if (!inView) { start(); nextIn = nextGap(); }
      else if (nextIn <= 0 && ascending < MAX_ASCENDING) { start(); nextIn = nextGap(); }
    }
    for (var j = flights.length - 1; j >= 0; j--) {
      use(flights[j]);
      if (updateFlight(flights[j], dt)) flights.splice(j, 1);
    }
  }

  // Advance one flight; returns true when it's completely finished.
  function updateFlight(L, dt) {
    L.t += dt;
    var t = L.t;

    var anyAlive = false;
    for (var i = 0; i < L.bodies.length; i++) {
      var b = L.bodies[i];
      updateBody(b, t, dt);
      // Gone below the horizon (Earth's curvature): nothing more to see.
      if (!b.dead && t > 200 && elevation(L, b) < -0.01) b.dead = true;
      var lastBurn = b.boost ? b.boost[1] : b.burns[b.burns.length - 1][1];
      var awaitingBurns = b.free && (b.entry || b.landing);   // still to come down and land
      if (!b.dead && (t < lastBurn + 5 || b.level > 0 || awaitingBurns)) anyAlive = true;
    }

    // Age the puffs and flashes; wind drifts them slowly sideways.
    for (var p = L.puffs.length - 1; p >= 0; p--) {
      var q = L.puffs[p];
      q.age += dt;
      q.lat += q.drift * dt;
      if (q.va !== undefined) {           // hot-staging gas: thrown outward, then slows
        q.alt += q.va * dt; q.s += q.vs * dt; q.lat += q.vl * dt;
        var damp = Math.exp(-dt / 3);
        q.va *= damp; q.vs *= damp; q.vl *= damp;
      }
      if (q.age > PLUME_LIFE) L.puffs.splice(p, 1);
    }
    for (var f = L.flashes.length - 1; f >= 0; f--) {
      L.flashes[f].age += dt;
      if (L.flashes[f].age > L.flashes[f].life) L.flashes.splice(f, 1);
    }

    if (!anyAlive) L.done = true;
    return L.done && !L.puffs.length;
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
    for (var j = 0; j < flights.length; j++) {
      use(flights[j]);
      drawFlight(ctx, view, flights[j]);
    }
  }

  function drawFlight(ctx, view, L) {
    var W = view.W, H = view.H, P = view.P;
    var V = { W: W, H: H, k: Math.max(W, H * 1.2) / FOV, horizon: H * HORIZON };

    var dep = -view.sunElev;                                   // degrees the sun is below the horizon
    var shadowH = shadowHeight(dep);
    var twilight = dep > 0 ? smoothstep(0.6, 4, dep) : 0;      // sky dark enough to see lit plumes
    var dayness = clamp(P.day, 0, 1);
    var smokeVis = smoothstep(0.35, 0.85, dayness);
    var i, b, q, c;

    // 1) Daytime smoke trail. Only forms in thick air (below ~35 km), so
    //    upper stages, which light up near vacuum, never leave one.
    if (smokeVis > 0.01) {
      for (i = 0; i < L.puffs.length; i++) {
        q = L.puffs[i];
        var fs = FUEL[q.fuel].smoke;
        if (!fs || q.alt > 35 || q.age > SMOKE_LIFE) continue;
        c = project(V, L, q.alt, q.s, q.lat);
        if (c.el < -0.02) continue;
        var rs = (0.2 + q.age * 0.006 * (q.fuel === 'srb' ? 1.6 : 1)) / c.d * V.k;
        var thin = 1 - smoothstep(22, 35, q.alt);            // thins out with altitude
        var as = 0.32 * fs * smokeVis * thin * (1 - q.age / SMOKE_LIFE) / (1 + rs / 6);
        if (as < 0.004) continue;
        ctx.fillStyle = rgba([226, 229, 234], as);
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(0.8, rs), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'lighter';

    // 2) Twilight: exhaust above Earth's shadow catches the sun (we're in the dark).
    //    Low down it's a narrow trail lit by reddened, low sunlight; above
    //    ~40 km the exhaust balloons out into the blue-white "jellyfish".
    if (twilight > 0.01) {
      var dim = 1 - 0.55 * dayness;
      for (i = 0; i < L.puffs.length; i++) {
        q = L.puffs[i];
        if (q.alt < shadowH) continue;            // still in Earth's shadow: dark
        var F2 = FUEL[q.fuel];
        var hi = smoothstep(32, 85, q.alt);       // 0 = thick air, 1 = near vacuum
        if (hi < 0.05 && !F2.smoke) continue;     // clean upper-stage exhaust makes no low trail
        var r0 = 0.15 + 5 * hi;                   // plume size right behind the engine
        var growth = 0.004 + 0.085 * hi * q.grow; // how fast it spreads (thin air: fast)
        var rk = Math.min(40, r0 + q.age * growth);
        c = project(V, L, q.alt, q.s, q.lat);
        if (c.el < -0.01) continue;
        var rp = rk / c.d * V.k;
        var edge = smoothstep(shadowH, shadowH + 6, q.alt);   // soft edge at the shadow line
        var life = 1 - q.age / PLUME_LIFE;
        var ap = (q.soft || 1) * (hi > 0.05 ? 0.045 * F2.plume : 0.07 * (0.4 + 0.6 * F2.smoke)) *
                 twilight * dim * edge * life / (1 + rp / (hi > 0.05 ? 10 : 5));
        if (ap < 0.003) continue;
        // Colour: warm sunset light on the low trail, blue-white ice up high.
        var tint = hi > 0.5 ? q.tint : [255, 196 + 40 * hi * 2, 160 + 90 * hi * 2];
        ctx.fillStyle = rgba([Math.round(tint[0]), Math.round(tint[1]), Math.round(tint[2])], ap);
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(1, rp), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2b) Hot gas from Starship's hot staging glows orange on its own for a
    //     couple of seconds, at any time of day (faint in daylight).
    for (i = 0; i < L.puffs.length; i++) {
      q = L.puffs[i];
      if (!q.glow || q.age > q.glow) continue;
      c = project(V, L, q.alt, q.s, q.lat);
      if (c.el < -0.01) continue;
      var gl = 1 - q.age / q.glow;
      var rg = (0.4 + q.age * 1.6) / c.d * V.k;
      var ag = 0.32 * gl * gl * (1 - 0.7 * dayness);
      ctx.fillStyle = rgba([255, 168, 96], ag);
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(1, rg), 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) Flames: a short glowing tail plus a bright point with a halo.
    var pointDim = 1 - 0.55 * dayness;
    for (i = 0; i < L.bodies.length; i++) {
      b = L.bodies[i];
      if (b.level <= 0.01 || b.dead) continue;
      var F = FUEL[b.fuel];
      var bright = b.power || b.bright;
      c = project(V, L, b.alt, b.s, b.lat);
      b.sx = c.x; b.sy = c.y;   // remembered for Launches.current()
      if (c.el < -0.01) continue;
      var x = c.x, y = c.y;
      var distF = clamp(300 / c.d, 0.3, 1.3);
      var ext = clamp(c.el / 0.05, 0.3, 1);       // dimmer through thick air near the horizon
      var a = 1.6 * F.point * bright * b.level * distF * ext * pointDim;   // boosted so launches stand out
      if (a < 0.01) continue;

      // Tail: the long afterburning flame you only get in thick air.
      if (b.tail.length >= 6 && b.alt < 40) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(F.glow, Math.min(0.7, a * 0.5) * (1 - smoothstep(25, 40, b.alt)));
        ctx.beginPath();
        for (var k = 0; k < b.tail.length; k += 3) {
          var tp = project(V, L, b.tail[k], b.tail[k + 1], b.tail[k + 2]);
          if (k === 0) ctx.moveTo(tp.x, tp.y); else ctx.lineTo(tp.x, tp.y);
        }
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Halo + core
      var r = 5 + 14 * Math.min(a, 1.5);
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(F.core, Math.min(1, a)));
      g.addColorStop(0.25, rgba(F.glow, Math.min(1, a * 0.45)));
      g.addColorStop(1, rgba(F.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = rgba([255, 250, 240], Math.min(1, a * 1.2));
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
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
      try { update(dt); } catch (e) { flights = []; launch = null; }
    },
    draw: function (ctx, view) {
      try { draw(ctx, view); } catch (e) { ctx.globalCompositeOperation = 'source-over'; }
    },
    // Start a launch now. `skip` fast-forwards that many seconds (for testing).
    launchNow: function (name, skip) {
      start(name);
      var mine = launch, n = Math.round((skip || 0) / 0.2);
      for (var i = 0; i < n && flights.indexOf(mine) >= 0; i++) update(0.2);
      if (flights.indexOf(mine) >= 0) use(mine);
    },
    setEnabled: function (on) {
      enabled = !!on;
      if (!enabled) { flights = []; launch = null; }
      else nextIn = Math.min(nextIn, 2 + Math.random() * 3);
    },
    isEnabled: function () { return enabled; },
    // The most recent flight (for testing/debugging).
    current: function () {
      if (!flights.length) return null;
      use(flights[flights.length - 1]);
      return {
        vehicle: launch.vehicle, t: launch.t,
        bodies: launch.bodies.map(function (b) {
          return { fuel: b.fuel, alt: +b.alt.toFixed(1), level: +b.level.toFixed(2), power: +(b.power || 0).toFixed(2),
                   x: Math.round(b.sx || 0), y: Math.round(b.sy || 0), dead: b.dead };
        })
      };
    },
    // Fast-forward the current flight until test(body) is true for some body (testing aid).
    advanceUntil: function (test, maxSeconds) {
      var mine = flights[flights.length - 1];
      for (var n = 0; mine && flights.indexOf(mine) >= 0 && n < (maxSeconds || 900) / 0.2; n++) {
        for (var i = 0; i < mine.bodies.length; i++) if (test(mine.bodies[i], mine.t)) return true;
        update(0.2);
      }
      return false;
    },
    vehicles: function () { return Object.keys(VEHICLES); }
  };
})();
