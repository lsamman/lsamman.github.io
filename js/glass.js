/*
 * glass.js: "liquid glass" rendered with WebGL.
 *
 * CSS can blur what's behind an element, but it can't bend light. Real curved
 * glass refracts: near its edges the background gets pulled in and magnified,
 * with a little rainbow fringing. Our background is our own canvas (js/scene.js),
 * so we can do that ourselves, in every browser with WebGL (Firefox included):
 *
 *   1. Every frame, copy the city canvas into a texture.
 *   2. For each glass element (menu tiles, buttons, the detail panel), find its
 *      rectangle on screen and describe it as a rounded-rectangle "distance field".
 *   3. A shader draws the glass: refraction + chromatic fringe around the curved
 *      rim, a specular edge highlight, a pointer-following glint, a soft shadow.
 *      The middle stays almost perfectly clear.
 *
 * Liquid motion: the selected item and category get a green "droplet" that
 * follows the selection with spring physics (it overshoots, wobbles and
 * stretches while moving). Its shape is blended into nearby tiles with a
 * smooth minimum, so it pulls gooey bridges between tiles as it travels.
 * New tiles pop in with a jelly wobble.
 *
 * Two canvases: one behind the menu (z-index 5) and one behind the detail
 * panel (z-index 25). The HTML elements keep their text and icons; when this
 * runs, html.webgl-glass makes their own CSS glass transparent.
 * If WebGL is unavailable, nothing changes and the CSS glass is used.
 */
(function () {
  'use strict';

  var MAXS = 24;   // max glass shapes per layer

  var VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    '#define MAXS ' + MAXS,
    'uniform sampler2D uBg;',
    'uniform vec2 uRes;',          // viewport in CSS px
    'uniform float uScale;',       // canvas px per CSS px
    'uniform vec4 uRect[MAXS];',   // x, y, w, h (CSS px, top-left origin)
    'uniform vec4 uP[MAXS];',      // radius, alpha, isDroplet, gooK
    'uniform vec4 uQ[MAXS];',      // bevel, frost, veil, solid
    'uniform int uCount;',
    'uniform vec3 uAccent;',
    'uniform vec2 uMouse;',

    // Signed distance to a rounded rectangle (negative inside).
    'float sdRR(vec2 p, vec4 r, float rad) {',
    '  vec2 hs = r.zw * 0.5; vec2 c = r.xy + hs;',
    '  rad = min(rad, min(hs.x, hs.y));',
    '  vec2 q = abs(p - c) - hs + rad;',
    '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;',
    '}',

    // The whole glass field: tiles are separate (hard min), droplets melt into
    // them (smooth min). Also returns the nearest tile's and droplet's settings.
    'float field(vec2 p, out vec4 Ps, out vec4 Qs, out vec4 Pd, out float dropW) {',
    '  float dS = 1e5; float dD = 1e5; float kD = 1.0;',
    '  Ps = vec4(0.0); Qs = vec4(12.0, 0.0, 0.16, 0.0); Pd = vec4(0.0);',
    '  for (int i = 0; i < MAXS; i++) {',
    '    if (i >= uCount) break;',
    '    float d = sdRR(p, uRect[i], uP[i].x);',
    '    if (uP[i].z > 0.5) { if (d < dD) { dD = d; Pd = uP[i]; kD = max(uP[i].w, 1.0); } }',
    '    else if (d < dS) { dS = d; Ps = uP[i]; Qs = uQ[i]; }',
    '  }',
    '  float h = clamp(0.5 + 0.5 * (dD - dS) / kD, 0.0, 1.0);',   // weight of the tile
    '  dropW = 1.0 - smoothstep(-2.0, 2.5, dD);',   // green follows the droplet's own rounded outline
    '  return mix(dD, dS, h) - kD * h * (1.0 - h);',
    '}',
    'float fieldOnly(vec2 p) { vec4 a; vec4 b; vec4 c; float w; return field(p, a, b, c, w); }',

    'vec3 tex(vec2 px) { return texture2D(uBg, clamp(px / uRes, vec2(0.001), vec2(0.999))).rgb; }',

    'void main() {',
    '  vec2 p = vec2(gl_FragCoord.x, uRes.y * uScale - gl_FragCoord.y) / uScale;',
    '  vec4 Ps; vec4 Qs; vec4 Pd; float dropW;',
    '  float d = field(p, Ps, Qs, Pd, dropW);',
    '  float shapeA = mix(Ps.y, Pd.y, dropW);',
    '  if (d > 34.0 || shapeA < 0.002) { gl_FragColor = vec4(0.0); return; }',

    // Soft shadow outside the glass.
    '  float shA = 0.26 * exp(-max(d, 0.0) / 9.0);',
    '  vec4 S = vec4(0.0, 0.0, 0.0, shA);',
    '  float cov = clamp(0.5 - d, 0.0, 1.0);',   // anti-aliased edge
    '  if (cov <= 0.0) { gl_FragColor = S * shapeA; return; }',

    // Surface normal from the field (points outward).
    '  vec2 n = vec2(fieldOnly(p + vec2(1.0, 0.0)) - d, fieldOnly(p + vec2(0.0, 1.0)) - d);',
    '  n = length(n) > 1e-4 ? normalize(n) : vec2(0.0, -1.0);',

    // Curved bevel: steep at the rim, flat in the middle.
    '  float bevel = max(Qs.x, 6.0);',
    '  float t = clamp(-d / bevel, 0.0, 1.0);',
    '  float edge = 1.0 - t;',
    '  float slope = edge * edge;',
    '  vec2 off = -n * slope * bevel * 1.25;',   // light bends inward at the rim
    '  vec2 q = p + off;',

    // Refracted background, with chromatic fringe; frosted shapes blur a little.
    '  vec3 col;',
    '  if (Qs.y > 0.0) {',
    '    float r = 11.0 * Qs.y; col = tex(q) * 0.2;',
    '    col += tex(q + vec2(r, 0.0)) * 0.1; col += tex(q - vec2(r, 0.0)) * 0.1;',
    '    col += tex(q + vec2(0.0, r)) * 0.1; col += tex(q - vec2(0.0, r)) * 0.1;',
    '    col += tex(q + vec2(r, r) * 0.7) * 0.1; col += tex(q - vec2(r, r) * 0.7) * 0.1;',
    '    col += tex(q + vec2(r, -r) * 0.7) * 0.1; col += tex(q - vec2(r, -r) * 0.7) * 0.1;',
    '  } else { col = tex(q); }',
    '  col.r = mix(col.r, tex(p + off * 1.18).r, slope);',
    '  col.b = mix(col.b, tex(p + off * 0.82).b, slope);',

    // Clear glass shows the real background in the middle; only the rim is drawn
    // refracted. "Solid" shapes (the detail panel) draw the refracted image everywhere.
    '  float aRef = Qs.w > 0.5 ? 1.0 : 1.0 - smoothstep(0.4, 1.0, t);',
    '  vec4 C = vec4(col * aRef, aRef);',
    '  float veil = Qs.z;',                                          // dark veil keeps text readable
    '  C = vec4(vec3(0.035, 0.04, 0.05) * veil + C.rgb * (1.0 - veil), veil + C.a * (1.0 - veil));',
    '  float hz = 0.03;',                                            // faint white haze
    '  C = vec4(vec3(hz) + C.rgb * (1.0 - hz), hz + C.a * (1.0 - hz));',
    '  float aA = 0.5 * dropW;',                                     // green droplet
    '  C = vec4(uAccent * aA + C.rgb * (1.0 - aA), aA + C.a * (1.0 - aA));',

    // Light: a bright rim where it faces the light, a fainter one opposite,
    // an inner glow along the bevel, and a glint that follows the pointer.
    '  vec2 L = normalize(vec2(-0.55, -0.85));',
    '  float rimBand = 1.0 - smoothstep(0.0, 2.4, -d);',
    '  float rim = rimBand * (0.16 + 0.7 * max(dot(n, L), 0.0) + 0.32 * max(dot(n, -L), 0.0));',
    '  float inner = pow(edge, 5.0) * 0.12;',
    '  vec2 dm = p - uMouse;',
    '  float glint = exp(-dot(dm, dm) / (2.0 * 80.0 * 80.0)) * 0.09;',
    '  float add = rim + inner + glint;',
    '  C.rgb += vec3(add); C.a = min(1.0, C.a + add * 0.9);',
    '  C.rgb = min(C.rgb, vec3(C.a));',

    '  gl_FragColor = (C * cov + S * (1.0 - cov)) * shapeA;',
    '}'
  ].join('\n');

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  var bg = document.getElementById('bg');
  if (!bg) return;

  // Shared, half-resolution copy of the city (plenty for refracted rims).
  var small = document.createElement('canvas');
  var smallCtx = small.getContext('2d');
  if (!smallCtx) return;

  function makeLayer(z) {
    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:' + z;
    var gl = null;
    try {
      gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }) ||
           c.getContext('experimental-webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    } catch (e) { gl = null; }
    if (!gl) return null;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('glass shader:', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('glass link:', gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one big triangle
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);

    var u = {};
    ['uBg', 'uRes', 'uScale', 'uRect', 'uP', 'uQ', 'uCount', 'uAccent', 'uMouse'].forEach(function (k) {
      u[k] = gl.getUniformLocation(prog, k);
    });
    gl.uniform1i(u.uBg, 0);

    return {
      canvas: c, gl: gl, u: u,
      rect: new Float32Array(MAXS * 4), p: new Float32Array(MAXS * 4), q: new Float32Array(MAXS * 4),
      w: 0, h: 0, drew: false
    };
  }

  var back = makeLayer(5);
  var front = back && makeLayer(25);
  if (!back || !front) return;   // no WebGL: keep the CSS glass

  bg.parentNode.insertBefore(back.canvas, bg.nextSibling);
  var detail = document.getElementById('detail');
  detail.parentNode.insertBefore(front.canvas, detail);
  document.documentElement.classList.add('webgl-glass');

  // ---------------------------------------------------------------------------
  // Collecting shapes from the page
  // ---------------------------------------------------------------------------
  var W = 0, H = 0;
  var mouse = { x: -9999, y: -9999 };
  document.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

  var seen = typeof WeakMap === 'function' ? new WeakMap() : null;   // first-seen time, for the pop-in wobble
  var clock = 0;
  var firstFrame = true;

  function reduced() { return document.documentElement.classList.contains('reduce-motion'); }

  // Visible opacity: the element's own times its ancestors' (fades, dimming).
  function opacityOf(el) {
    var a = 1;
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var o = parseFloat(getComputedStyle(n).opacity);
      if (!isNaN(o)) a *= o;
      if (a < 0.003) return 0;
    }
    return a;
  }

  function radiusOf(el, r) {
    var v = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    return Math.min(v, r.width / 2, r.height / 2);
  }

  // Jelly pop when a tile first appears: shrinks, overshoots, settles.
  function popScale(el) {
    if (!seen || reduced()) return 1;
    var t0 = seen.get(el);
    if (t0 === undefined) { seen.set(el, firstFrame ? -10 : clock); return firstFrame ? 1 : 0.87; }
    var age = clock - t0;
    if (age > 1.5) return 1;
    return 1 - 0.13 * Math.exp(-age * 8) * Math.cos(age * 15);
  }

  function addShape(L, n, x, y, w, h, radius, alpha, isDrop, goo, bevel, frost, veil, solid) {
    if (n >= MAXS || alpha < 0.003 || w < 2 || h < 2) return n;
    if (x > W + 40 || y > H + 40 || x + w < -40 || y + h < -40) return n;
    var i = n * 4;
    L.rect[i] = x; L.rect[i + 1] = y; L.rect[i + 2] = w; L.rect[i + 3] = h;
    L.p[i] = radius; L.p[i + 1] = alpha; L.p[i + 2] = isDrop ? 1 : 0; L.p[i + 3] = goo;
    L.q[i] = bevel; L.q[i + 1] = frost; L.q[i + 2] = veil; L.q[i + 3] = solid;
    return n + 1;
  }

  // Motion warp: tiles that are moving (scrolling through a list, switching
  // category) stretch along their direction of travel, lag slightly behind
  // themselves, bend the city harder at their edges, and their contents get a
  // little motion blur. All of it eases off as they come to rest.
  var motion = typeof WeakMap === 'function' ? new WeakMap() : null;
  var blurWrites = [];   // applied after drawing, so we never mix layout reads and writes

  function addElement(L, n, el, opts) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return n;
    var a = opacityOf(el) * (opts.alpha || 1);
    var s = popScale(el);
    var w = r.width * s, h = r.height * s;
    var x = r.left + (r.width - w) / 2, y = r.top + (r.height - h) / 2;
    var rad = radiusOf(el, r) * s;
    var bevel = opts.bevel || Math.min(14, Math.max(8, rad));

    if (opts.motion && motion && !reduced()) {
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var m = motion.get(el);
      if (!m) { m = { x: cx, y: cy, vx: 0, vy: 0, blur: 0 }; motion.set(el, m); }
      if (frameDt > 0) {
        m.vx = m.vx * 0.6 + ((cx - m.x) / frameDt) * 0.4;   // smoothed px/s
        m.vy = m.vy * 0.6 + ((cy - m.y) / frameDt) * 0.4;
      }
      m.x = cx; m.y = cy;
      var ax = Math.abs(m.vx), ay = Math.abs(m.vy), speed = Math.sqrt(ax * ax + ay * ay);
      if (speed > 8) {
        var sx = Math.min(ax * 0.006, w * 0.06), sy = Math.min(ay * 0.012, 7);   // capped so neighbours never touch
        var nw = w + sx - sy * 0.3, nh = h + sy - sx * 0.3;
        x += (w - nw) / 2 - Math.max(-4, Math.min(4, m.vx * 0.004));   // stretch, and trail a little behind
        y += (h - nh) / 2 - Math.max(-4, Math.min(4, m.vy * 0.004));
        w = nw; h = nh;
        bevel *= 1 + Math.min(0.8, speed / 900);
      }
      var blur = Math.min(1.4, speed * 0.0018);
      if (Math.abs(blur - m.blur) > 0.08) { m.blur = blur; blurWrites.push(el, blur); }
    }

    return addShape(L, n, x, y, w, h, rad, a, false, 0,
      bevel, opts.frost || 0, opts.veil === undefined ? 0.16 : opts.veil, opts.solid || 0);
  }

  function applyBlurs() {
    for (var i = 0; i < blurWrites.length; i += 2) {
      var el = blurWrites[i], b = blurWrites[i + 1];
      var f = b > 0.15 ? 'blur(' + b.toFixed(2) + 'px)' : '';
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) c.style.filter = f;
    }
    blurWrites.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Liquid droplets that follow the selection (spring physics)
  // ---------------------------------------------------------------------------
  function Droplet(selector, axis) {
    this.selector = selector; this.axis = axis;
    this.x = 0; this.y = 0; this.w = 0; this.h = 0; this.r = 16;
    this.vx = 0; this.vy = 0; this.vw = 0; this.vh = 0;
    this.a = 0; this.placed = false;
  }
  Droplet.prototype.update = function (dt) {
    var el = document.querySelector(this.selector);
    var r = el && el.getBoundingClientRect();
    var target = r && r.width ? opacityOf(el) : 0;
    this.a += (target - this.a) * Math.min(1, dt * 10);
    if (!r || !r.width) return;
    this.r = radiusOf(el, r);
    if (!this.placed || reduced()) {
      this.x = r.left; this.y = r.top; this.w = r.width; this.h = r.height;
      this.vx = this.vy = this.vw = this.vh = 0;
      this.placed = true;
      return;
    }
    // Underdamped spring: overshoots a little and wobbles into place.
    var k = 175, c = 21, steps = Math.ceil(dt / 0.008), h = dt / steps;
    for (var i = 0; i < steps; i++) {
      this.vx += (k * (r.left - this.x) - c * this.vx) * h;
      this.vy += (k * (r.top - this.y) - c * this.vy) * h;
      this.vw += (k * (r.width - this.w) - c * this.vw) * h;
      this.vh += (k * (r.height - this.h) - c * this.vh) * h;
      this.x += this.vx * h; this.y += this.vy * h; this.w += this.vw * h; this.h += this.vh * h;
    }
  };
  Droplet.prototype.add = function (L, n) {
    if (!this.placed) return n;
    // Stretch along the direction of travel (and thin out a little across it).
    var sx = Math.min(Math.abs(this.vx) * 0.045, this.w * 0.6);
    var sy = Math.min(Math.abs(this.vy) * 0.045, this.h * 0.8);
    var w = this.w + sx - sy * 0.25, h = this.h + sy - sx * 0.25;
    var x = this.x + (this.w - w) / 2, y = this.y + (this.h - h) / 2;
    var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    // While travelling it straddles the gaps between tiles, where their rounded
    // corners leave notches; tuck its sides in so it doesn't poke out of them.
    var tuck = Math.min(7, speed * 0.012);
    if (this.axis === 'y') { x += tuck; w -= tuck * 2; } else { y += tuck; h -= tuck * 2; }
    var goo = 5 + Math.min(11, speed * 0.02);    // at rest it keeps to itself; moving, it melts into neighbours
    return addShape(L, n, x, y, w, h, this.r, this.a, true, goo, 12, 0, 0, 0);
  };

  var itemDrop = new Droplet('.item.sel .face', 'y');
  var catDrop = new Droplet('.cat.sel', 'x');

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function accentRGB() {
    var hue = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hue')) || 95;
    // hsl(hue, 80%, 52%) -> rgb 0..1
    var s = 0.8, l = 0.52, c = (1 - Math.abs(2 * l - 1)) * s, hp = (hue % 360) / 60;
    var x = c * (1 - Math.abs(hp % 2 - 1)), m = l - c / 2, rgb;
    if (hp < 1) rgb = [c, x, 0]; else if (hp < 2) rgb = [x, c, 0]; else if (hp < 3) rgb = [0, c, x];
    else if (hp < 4) rgb = [0, x, c]; else if (hp < 5) rgb = [x, 0, c]; else rgb = [c, 0, x];
    return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
  }

  function sizeLayer(L, scale) {
    var w = Math.round(W * scale), h = Math.round(H * scale);
    if (L.canvas.width !== w || L.canvas.height !== h) { L.canvas.width = w; L.canvas.height = h; }
  }

  function drawLayer(L, n, scale, accent) {
    var gl = L.gl;
    if (!n) {
      if (L.drew) { gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.SCISSOR_TEST); L.drew = false; }
      return;
    }
    gl.viewport(0, 0, L.canvas.width, L.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);

    // Only shade the area around the shapes (plus room for shadows).
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < n; i++) {
      x0 = Math.min(x0, L.rect[i * 4]); y0 = Math.min(y0, L.rect[i * 4 + 1]);
      x1 = Math.max(x1, L.rect[i * 4] + L.rect[i * 4 + 2]); y1 = Math.max(y1, L.rect[i * 4 + 1] + L.rect[i * 4 + 3]);
    }
    var pad = 36;
    var sx = Math.max(0, Math.floor((x0 - pad) * scale)), sy = Math.max(0, Math.floor((H - y1 - pad) * scale));
    var sw = Math.min(L.canvas.width, Math.ceil((x1 + pad) * scale)) - sx;
    var sh = Math.min(L.canvas.height, Math.ceil((H - y0 + pad) * scale)) - sy;
    if (sw <= 0 || sh <= 0) return;
    gl.scissor(sx, sy, sw, sh);

    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, small);
    gl.uniform2f(L.u.uRes, W, H);
    gl.uniform1f(L.u.uScale, scale);
    gl.uniform4fv(L.u.uRect, L.rect);
    gl.uniform4fv(L.u.uP, L.p);
    gl.uniform4fv(L.u.uQ, L.q);
    gl.uniform1i(L.u.uCount, n);
    gl.uniform3f(L.u.uAccent, accent[0], accent[1], accent[2]);
    gl.uniform2f(L.u.uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    L.drew = true;
  }

  var last = 0;
  var frameDt = 0;
  function draw(now) {
    if (document.hidden) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    frameDt = dt;

    W = window.innerWidth; H = window.innerHeight;
    var scale = Math.min(window.devicePixelRatio || 1, 1.5);
    sizeLayer(back, scale); sizeLayer(front, scale);

    // Half-resolution snapshot of the city for refraction.
    var sw = Math.max(1, Math.round(W / 2)), sh = Math.max(1, Math.round(H / 2));
    if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
    try { smallCtx.drawImage(bg, 0, 0, sw, sh); } catch (e) { return; }

    itemDrop.update(dt);
    catDrop.update(dt);

    // Back layer: menu tiles, the selection droplets, status button, Last.fm tile.
    var n = 0, i, els;
    els = document.querySelectorAll('#categories .cat');
    for (i = 0; i < els.length; i++) n = addElement(back, n, els[i], { veil: 0.18, motion: true });
    els = document.querySelectorAll('#items .face');
    for (i = 0; i < els.length; i++) {
      var above = els[i].parentNode.classList.contains('above');
      n = addElement(back, n, els[i], { veil: 0.16, alpha: above ? 0.55 : 1, motion: true });
    }
    var mute = document.getElementById('mute');
    if (mute) n = addElement(back, n, mute, { veil: 0.18 });
    var np = document.getElementById('nowplaying');
    if (np) n = addElement(back, n, np, { veil: 0.22 });
    n = itemDrop.add(back, n);
    n = catDrop.add(back, n);

    // Front layer: the detail panel, a thicker, lightly frosted pane.
    var m = 0;
    if (!detail.hidden) {
      var panel = detail.querySelector('.panel');
      if (panel) m = addElement(front, m, panel, { bevel: 26, frost: 1, veil: 0.5, solid: 1 });
    }

    var accent = accentRGB();
    drawLayer(back, n, scale, accent);
    drawLayer(front, m, scale, accent);
    applyBlurs();
    firstFrame = false;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    draw(now);
  }
  requestAnimationFrame(loop);

  // Draw one frame at a given time in ms (used by tests to step the animation).
  window.Glass = { render: draw };
})();
