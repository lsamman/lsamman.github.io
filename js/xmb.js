/*
 * The menu: a row of category tiles and a column of item tiles under the
 * selected one. Handles keyboard, mouse, scroll wheel and touch swipes, the
 * built-in Settings category, the clock, the mute button and the start screen.
 *
 * Content comes from js/content.js (window.SITE). You shouldn't need to edit this file.
 */

(function () {
  var SITE = window.SITE;
  var Sound = window.Sound || { play: function () {}, unlock: function () { return Promise.resolve(); }, setMusic: function () {}, isMusicOn: function () { return false; }, setSfx: function () {}, isSfxOn: function () { return false; }, setVolume: function () {}, getVolume: function () { return 0; } };
  var Launches = window.Launches || { isEnabled: function () { return false; }, setEnabled: function () {} };
  var Scene = window.Scene || { init: function () {}, setHue: function () {}, setReducedMotion: function () {}, setTimeOfDay: function () {} };

  var catBar = document.getElementById("categories");
  var catTitle = document.getElementById("cat-title");
  var itemList = document.getElementById("items");
  var muteBtn = document.getElementById("mute");
  var splash = document.getElementById("splash");
  var root = document.documentElement;

  // ---------- Saved preferences --------------------------------------------

  function load(key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  var THEMES = [
    { name: "Green", hue: 95 }, { name: "Orange", hue: 26 }, { name: "Blue", hue: 205 },
    { name: "Magenta", hue: 318 }, { name: "Red", hue: 356 }
  ];
  var TIMES = ["auto", "dawn", "day", "dusk", "night"];
  var VOLUMES = [0, 0.25, 0.5, 0.75, 1];

  var themeIndex = Math.max(0, THEMES.findIndex(function (t) { return t.name === load("xmb.theme", "Green"); }));
  var timeIndex = Math.max(0, TIMES.indexOf(load("xmb.time", "auto")));
  var systemReduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reduceMotion = load("xmb.motion", systemReduced ? "on" : "off") === "on";

  function applyTheme() {
    var hue = THEMES[themeIndex].hue;
    root.style.setProperty("--hue", hue);
    Scene.setHue(hue);
  }
  function applyMotion() {
    root.classList.toggle("reduce-motion", reduceMotion);
    Scene.setReducedMotion(reduceMotion);
    if (window.RainFX) RainFX.setReducedMotion(reduceMotion);
  }

  // ---------- The Settings category (built in) ------------------------------

  var settingsCat = {
    id: "settings", label: "Settings", icon: "assets/icons/settings.svg", isSettings: true,
    items: [
      { id: "music", title: "Background music", summary: "Neverending Night, on a loop",
        value: function () { return Sound.isMusicOn() ? "on" : "off"; },
        change: function () { Sound.setMusic(!Sound.isMusicOn()); syncMute(); } },
      { id: "rain", title: "Rain", summary: "A perpetual storm on the window",
        value: function () { return Sound.isRainOn() ? "on" : "off"; },
        change: function () {
          var on = !Sound.isRainOn();
          Sound.setRain(on);
          if (window.RainFX) RainFX.setEnabled(on);
          syncMute();
        } },
      { id: "sfx", title: "Sound effects", summary: "Menu clicks and blips",
        value: function () { return Sound.isSfxOn() ? "on" : "off"; },
        change: function () { Sound.setSfx(!Sound.isSfxOn()); } },
      { id: "volume", title: "Volume", summary: "Select again to change",
        value: function () { return Math.round(Sound.getVolume() * 100) + "%"; },
        change: function () {
          var v = Sound.getVolume();
          var i = VOLUMES.findIndex(function (x) { return x > v + 0.01; });
          Sound.setVolume(i === -1 ? VOLUMES[0] : VOLUMES[i]);
        } },
      { id: "time", title: "Time of day", summary: "auto follows your clock",
        value: function () { return TIMES[timeIndex]; },
        change: function () { timeIndex = (timeIndex + 1) % TIMES.length; save("xmb.time", TIMES[timeIndex]); Scene.setTimeOfDay(TIMES[timeIndex]); } },
      { id: "launches", title: "Rocket launches", summary: "Real vehicles, launching from the distant coast",
        value: function () { return Launches.isEnabled() ? "on" : "off"; },
        change: function () { Launches.setEnabled(!Launches.isEnabled()); save("xmb.launches", Launches.isEnabled() ? "on" : "off"); } },
      { id: "theme", title: "Accent colour", summary: "Tiles, highlights and city lights",
        value: function () { return THEMES[themeIndex].name.toLowerCase(); },
        change: function () { themeIndex = (themeIndex + 1) % THEMES.length; save("xmb.theme", THEMES[themeIndex].name); applyTheme(); } },
      { id: "motion", title: "Reduce motion", summary: "Calmer animations",
        value: function () { return reduceMotion ? "on" : "off"; },
        change: function () { reduceMotion = !reduceMotion; save("xmb.motion", reduceMotion ? "on" : "off"); applyMotion(); } }
    ]
  };

  // Main row: categories in a group collapse into one tab (see `groups` in content.js)
  var backItem = { id: "__back", title: "Back", icon: "assets/icons/back.svg", back: true };
  var cats = [];
  var placed = {};
  SITE.categories.forEach(function (cat) {
    var group = (SITE.groups || []).find(function (g) { return g.members.indexOf(cat.id) >= 0; });
    if (!group) { cats.push(cat); return; }
    if (placed[group.id]) return;
    var entry = { id: group.id, label: group.label, icon: group.icon, isGroup: true, items: [] };
    group.members.forEach(function (id) {
      var m = SITE.categories.find(function (c) { return c.id === id; });
      if (m) entry.items.push({ id: m.id, title: m.label, icon: m.icon, folder: m,
        summary: m.items.length + (m.items.length === 1 ? " entry" : " entries") });
    });
    placed[group.id] = entry;
    cats.push(entry);
  });
  cats.push(settingsCat);
  var selCat = 0;
  var folder = null;      // the folder open inside a group tab, if any
  var selItem = {};       // remembers the item position in each list, by list id

  // What the item column is showing: a category, or a folder opened inside a group
  function view() {
    if (folder) return { id: folder.id, label: folder.label, icon: folder.icon, items: [backItem].concat(folder.items) };
    return cats[selCat];
  }
  function sel() { var v = selItem[view().id]; return v == null ? (folder ? 1 : 0) : v; }
  function setSel(i) { selItem[view().id] = i; }
  var catEls = [], itemEls = [];
  var started = false;

  // ---------- Building the menu --------------------------------------------

  function buildCategories() {
    catBar.innerHTML = "";
    catEls = cats.map(function (cat, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat";
      b.innerHTML = '<img alt=""><span></span>';
      b.querySelector("img").src = cat.icon;
      b.querySelector("span").textContent = cat.label;
      b.addEventListener("click", function () { setCat(i); });
      catBar.appendChild(b);
      return b;
    });
  }

  function buildItems(animate) {
    var cat = view();
    catTitle.textContent = cat.label;
    itemList.innerHTML = "";
    itemEls = cat.items.map(function (item, i) {
      var li = document.createElement("li");
      li.className = "item" + (animate ? " enter" : "");
      li.innerHTML = '<div class="face"><div class="ico"><img alt=""></div><div class="text"><span class="title"></span><span class="sub"></span></div></div>';
      var face = li.querySelector(".face");
      if (animate) face.style.animationDelay = Math.min(i, 6) * 45 + "ms";
      li.querySelector(".ico img").src = item.photo || item.icon || cat.icon;
      if (item.photo) li.querySelector(".ico").classList.add("photo");
      li.querySelector(".title").textContent = item.title;
      li.querySelector(".sub").textContent = item.summary || item.subtitle || "";
      if (item.value) {
        var v = document.createElement("span");
        v.className = "value";
        face.appendChild(v);
      }
      li.addEventListener("click", function () {
        if (i === sel()) activate();
        else { setSel(i); Sound.play("move"); position(); }
      });
      addTilt(face);
      itemList.appendChild(li);
      return li;
    });
    refreshValues();
  }

  function refreshValues() {
    var cat = view();
    itemEls.forEach(function (li, i) {
      var v = li.querySelector(".value");
      if (v) v.textContent = cat.items[i].value();
    });
  }

  // Tiles tilt toward wherever you press them, like the 360 dashboard
  function addTilt(face) {
    face.addEventListener("pointerdown", function (e) {
      if (reduceMotion) return;
      var r = face.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;    // -0.5 .. 0.5
      var y = (e.clientY - r.top) / r.height - 0.5;
      face.style.setProperty("--ry", (x * 14).toFixed(1) + "deg");
      face.style.setProperty("--rx", (-y * 18).toFixed(1) + "deg");
      face.style.setProperty("--press", "0.97");
    });
    function release() {
      face.style.removeProperty("--ry");
      face.style.removeProperty("--rx");
      face.style.removeProperty("--press");
    }
    face.addEventListener("pointerup", release);
    face.addEventListener("pointerleave", release);
    face.addEventListener("pointercancel", release);
  }

  function glitch() {
    if (reduceMotion) return;
    [catTitle, itemList].forEach(function (el) {
      el.classList.remove("glitch");
      void el.offsetWidth;   // restart the animation
      el.classList.add("glitch");
    });
  }

  // ---------- Layout: where everything sits on screen ----------------------

  function metrics() {
    var w = window.innerWidth, h = window.innerHeight, small = w <= 640;
    var catSel = small ? 52 : 64;
    return {
      small: small,
      catTile: small ? 40 : 48, catSel: catSel,
      catGap: small ? 6 : 8,                              // space between category tiles
      anchorX: small ? 16 + catSel / 2 : Math.max(110, w * 0.15),   // centre of the selected category
      barY: small ? h * 0.15 : h * 0.2,                   // top of the category row
      titleH: small ? 52 : 70,
      tile: small ? 48 : 54, selTile: small ? 68 : 80,
      gap: 6
    };
  }

  // Where item i sits (top edge) when item s is selected.
  function itemY(i, s, m) {
    var selY = m.barY + m.catSel + m.titleH + 8;
    if (i === s) return selY;
    if (i > s) return selY + m.selTile + m.gap + (i - s - 1) * (m.tile + m.gap);
    return m.barY - m.gap * 2 - (s - i) * (m.tile + m.gap);   // earlier items slide up above the row
  }

  // Lay everything out. `p` is the item position: normally the selected index,
  // but while a finger drags the list it's fractional (e.g. 2.4), so the list
  // glides continuously between the resting layouts instead of jumping.
  function position(p) {
    var m = metrics();
    if (typeof p !== "number") p = sel();
    var left = m.anchorX - m.catSel / 2;   // shared left edge for title + items

    catEls.forEach(function (el, i) {
      var size = i === selCat ? m.catSel : m.catTile;
      // Categories before the selected one sit to its left; after it, to the right
      var k = Math.abs(i - selCat);
      var offset = k === 0 ? 0 : m.catSel / 2 + m.catGap + m.catTile / 2 + (k - 1) * (m.catTile + m.catGap);
      var x = m.anchorX + (i < selCat ? -offset : offset);
      var y = m.barY + (m.catSel - size) / 2;
      el.style.setProperty("--size", size + "px");
      el.style.transform = "translate(" + (x - size / 2) + "px," + y + "px)";
      el.classList.toggle("sel", i === selCat);
      el.style.opacity = i < selCat - 2 ? "0" : "";
    });

    catTitle.style.transform = "translate(" + left + "px," + (m.barY + m.catSel + 6) + "px)";

    var n = itemEls.length;
    var s0 = Math.max(0, Math.min(n - 1, Math.floor(p))), s1 = Math.max(0, Math.min(n - 1, Math.ceil(p)));
    var f = p - Math.floor(p);
    var over = p < 0 ? p : p > n - 1 ? p - (n - 1) : 0;   // rubber-band past either end
    var s = Math.max(0, Math.min(n - 1, Math.round(p)));
    itemEls.forEach(function (el, i) {
      var y = itemY(i, s0, m) + (itemY(i, s1, m) - itemY(i, s0, m)) * f - over * (m.tile + m.gap);
      el.style.transform = "translate(" + left + "px," + y + "px)";
      el.classList.toggle("sel", i === s);
      el.classList.toggle("above", i < s);
      el.classList.toggle("dim", i > s);
    });
  }

  // ---------- Moving around ------------------------------------------------

  function setCat(i) {
    i = Math.max(0, Math.min(cats.length - 1, i));
    if (i === selCat && !folder) return;
    folder = null;
    if (i === selCat) { Sound.play("move"); buildItems(true); position(); glitch(); return; }
    selCat = i;
    Sound.play("move");
    buildItems(true);
    position();
    glitch();
  }

  function moveItem(d) {
    var n = view().items.length;
    var i = Math.max(0, Math.min(n - 1, sel() + d));
    if (i === sel()) return;
    setSel(i);
    Sound.play("move");
    position();
  }

  function enterFolder(f) {
    folder = f;
    Sound.play("open");
    buildItems(true);
    position();
    glitch();
  }

  function leaveFolder() {
    if (!folder) return;
    folder = null;
    Sound.play("move");
    buildItems(true);
    position();
    glitch();
  }

  function activate() {
    var cat = view();
    var item = cat.items[sel()];
    if (!item) return;
    if (item.back) { leaveFolder(); return; }
    if (item.folder) { enterFolder(item.folder); return; }
    if (cat.isSettings) {
      item.change();
      Sound.play("open");
      refreshValues();
      return;
    }
    window.Detail.show(cat.id, item.id);
  }

  // ---------- Input: keyboard, wheel, touch -------------------------------

  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!started) { start(); e.preventDefault(); return; }
    if (window.Detail.isOpen()) return;
    var k = e.key;
    if (k === "ArrowLeft" || k === "a") { if (folder) leaveFolder(); else setCat(selCat - 1); }
    else if (k === "ArrowRight" || k === "d") { if (!folder) setCat(selCat + 1); }
    else if (k === "Escape" || k === "Backspace") { if (!folder) return; leaveFolder(); }
    else if (k === "ArrowUp" || k === "w") moveItem(-1);
    else if (k === "ArrowDown" || k === "s") moveItem(1);
    else if (k === "Enter" || k === " ") activate();
    else return;
    e.preventDefault();
  });

  var wheelLock = 0;
  document.getElementById("xmb").addEventListener("wheel", function (e) {
    e.preventDefault();
    var now = Date.now();
    if (now < wheelLock) return;
    var horizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    var d = horizontal ? (e.deltaX || e.deltaY) : e.deltaY;
    if (Math.abs(d) < 4) return;
    wheelLock = now + 150;
    if (horizontal) setCat(selCat + Math.sign(d)); else moveItem(Math.sign(d));
  }, { passive: false });

  // Touch: the list follows your finger and glides to the nearest item when
  // you let go, carrying on a little further if you flick. Sideways drags
  // slide the category row the same way.
  var xmbEl = document.getElementById("xmb");
  var touch = null;
  var suppressClickUntil = 0;

  function rubber(v, lo, hi) {   // resist past the ends, like iOS
    if (v < lo) return lo - (1 - 1 / (1 + (lo - v) * 0.6)) / 0.6;
    if (v > hi) return hi + (1 - 1 / (1 + (v - hi) * 0.6)) / 0.6;
    return v;
  }

  xmbEl.addEventListener("touchstart", function (e) {
    if (!started || window.Detail.isOpen()) return;
    var t = e.touches[0];
    touch = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, axis: null,
              p0: sel(), p: sel(), v: 0, lastT: performance.now(), lastPos: 0 };
  }, { passive: true });

  xmbEl.addEventListener("touchmove", function (e) {
    if (!touch) return;
    var t = e.touches[0], m = metrics();
    var dx = t.clientX - touch.x0, dy = t.clientY - touch.y0;
    if (!touch.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;    // still could be a tap
      touch.axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
      xmbEl.classList.add("dragging");
    }
    var now = performance.now(), dt = Math.max(1, now - touch.lastT);
    var pos = touch.axis === "y" ? dy : dx;
    touch.v = touch.v * 0.6 + ((pos - touch.lastPos) / dt) * 0.4;   // px per ms, smoothed
    touch.lastPos = pos; touch.lastT = now;

    if (touch.axis === "y") {
      var n = itemEls.length;
      var p = rubber(touch.p0 - dy / (m.tile + m.gap), 0, n - 1);
      var s = Math.max(0, Math.min(n - 1, Math.round(p)));
      if (s !== sel()) { setSel(s); Sound.play("move"); }
      touch.p = p;
      position(p);
    } else {
      var step = m.catTile + m.catGap;
      var lim = (dx > 0 ? selCat : cats.length - 1 - selCat) * step + step * 0.5;
      var x = Math.sign(dx) * Math.min(Math.abs(dx), lim + (Math.abs(dx) > lim ? (Math.abs(dx) - lim) * 0.25 : 0));
      catBar.style.transform = "translateX(" + x + "px)";
      itemList.style.opacity = String(1 - Math.min(0.6, Math.abs(dx) / 260));
    }
  }, { passive: true });

  function endTouch() {
    if (!touch) return;
    var tc = touch, m = metrics();
    touch = null;
    xmbEl.classList.remove("dragging");
    if (!tc.axis) return;                       // a tap: the click handler deals with it
    suppressClickUntil = Date.now() + 350;      // a drag shouldn't also count as a click

    if (tc.axis === "y") {
      var n = itemEls.length;
      var flick = -tc.v * 160 / (m.tile + m.gap);     // carry on in the direction of the flick
      var target = Math.max(0, Math.min(n - 1, Math.round(tc.p + flick)));
      if (target !== sel()) Sound.play("move");
      setSel(target);
      position();                                // transitions glide it home
    } else {
      var step = m.catTile + m.catGap;
      var dx = tc.lastPos;
      var steps = Math.round(-(dx + tc.v * 140) / step);
      if (!steps && Math.abs(dx) > 30) steps = -Math.sign(dx);
      catBar.style.transform = "";
      itemList.style.opacity = "";
      if (steps) setCat(selCat + steps);
    }
  }
  xmbEl.addEventListener("touchend", endTouch, { passive: true });
  xmbEl.addEventListener("touchcancel", endTouch, { passive: true });

  // Swallow the click a browser may still send after a drag.
  xmbEl.addEventListener("click", function (e) {
    if (Date.now() < suppressClickUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // ---------- Mute button, clock, film grain, start screen ----------------

  function syncMute() {
    var silent = !Sound.isMusicOn() && !Sound.isRainOn();
    muteBtn.classList.toggle("off", silent);
    muteBtn.setAttribute("aria-pressed", String(silent));
  }
  muteBtn.addEventListener("click", function () {
    // Mute silences music and rain together; unmute brings both back.
    var on = !Sound.isMusicOn() && !Sound.isRainOn();
    Sound.setMusic(on);
    Sound.setRain(on);
    syncMute();
    if (cats[selCat].isSettings) refreshValues();
  });

  function tickClock() {
    var now = new Date();
    document.querySelector(".clock-time").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    document.querySelector(".clock-date").textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  }

  // A small tile of random noise, repeated across the screen as film grain
  function makeGrain() {
    try {
      var c = document.createElement("canvas");
      c.width = c.height = 160;
      var g = c.getContext("2d");
      var img = g.createImageData(160, 160);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      document.getElementById("grain").style.backgroundImage = "url(" + c.toDataURL() + ")";
    } catch (e) {}
  }

  function start() {
    if (started) return;
    started = true;
    Sound.unlock().then(function () { Sound.play("start"); syncMute(); });
    splash.classList.add("leaving");
    document.body.classList.add("started");
    buildItems(true);
    position();
    setTimeout(function () { splash.remove(); }, 600);
    setTimeout(function () { window.Detail.route(); }, 450);   // open a shared link like #/projects/project-1
  }
  splash.addEventListener("click", start);
  splash.addEventListener("touchend", function (e) { e.preventDefault(); start(); });

  // ---------- Setup -------------------------------------------------------

  document.querySelectorAll("[data-site-name]").forEach(function (n) { n.textContent = SITE.name; });
  document.querySelectorAll("[data-site-tagline]").forEach(function (n) { n.textContent = SITE.tagline || ""; });
  document.title = "Dreamliner.web";
  if (window.matchMedia && matchMedia("(pointer: coarse)").matches) {
    document.getElementById("hint").textContent = "swipe to browse · tap twice to open";
    splash.querySelector(".splash-hint").textContent = "tap anywhere. go on.";
  }

  makeGrain();
  // Saved choices go in before init so the first frame is already right (no tween on load)
  Scene.setTimeOfDay(TIMES[timeIndex]);
  applyTheme();
  applyMotion();
  Launches.setEnabled(load("xmb.launches", "on") === "on");
  Scene.init(document.getElementById("bg"));
  buildCategories();
  buildItems(false);
  position();
  syncMute();
  tickClock();
  setInterval(tickClock, 1000);
  window.addEventListener("resize", position);
  splash.focus();

  // ---------- Public API (used by detail.js) -------------------------------

  window.XMB = {
    // Jump to a category/item (used when opening from a link)
    select: function (catId, itemId) {
      var ci = cats.findIndex(function (c) { return c.id === catId; });
      var f = null;
      if (ci < 0) {   // maybe it lives in a folder inside a group tab
        ci = cats.findIndex(function (c) {
          return c.isGroup && c.items.some(function (it) { if (it.folder.id === catId) { f = it.folder; return true; } });
        });
      }
      if (ci < 0) return;
      var items = f ? f.items : cats[ci].items;
      var ii = Math.max(0, items.findIndex(function (it) { return it.id === itemId; }));
      var rebuild = ci !== selCat || f !== folder;
      selCat = ci; folder = f;
      setSel(f ? ii + 1 : ii);          // folders have a Back tile first
      if (rebuild) buildItems(false);
      position();
    },
    // The visible tile faces, for the detail page's turnstile animation
    faces: function () {
      return Array.prototype.map.call(itemList.querySelectorAll(".face"), function (f) { return f; });
    }
  };
})();
