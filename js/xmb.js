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
  }

  // ---------- The Settings category (built in) ------------------------------

  var settingsCat = {
    id: "settings", label: "Settings", icon: "assets/icons/settings.svg", isSettings: true,
    items: [
      { id: "music", title: "Background music", summary: "Generated jungle, made live in your browser",
        value: function () { return Sound.isMusicOn() ? "on" : "off"; },
        change: function () { Sound.setMusic(!Sound.isMusicOn()); syncMute(); } },
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

  var cats = SITE.categories.concat([settingsCat]);
  var selCat = 0;
  var selItem = cats.map(function () { return 0; });   // remembers the item position in each category
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
    var cat = cats[selCat];
    catTitle.textContent = cat.label;
    itemList.innerHTML = "";
    itemEls = cat.items.map(function (item, i) {
      var li = document.createElement("li");
      li.className = "item" + (animate ? " enter" : "");
      li.innerHTML = '<div class="face"><div class="ico"><img alt=""></div><div class="text"><span class="title"></span><span class="sub"></span></div></div>';
      var face = li.querySelector(".face");
      if (animate) face.style.animationDelay = Math.min(i, 6) * 45 + "ms";
      li.querySelector(".ico img").src = item.icon || cat.icon;
      li.querySelector(".title").textContent = item.title;
      li.querySelector(".sub").textContent = item.summary || item.subtitle || "";
      if (item.value) {
        var v = document.createElement("span");
        v.className = "value";
        face.appendChild(v);
      }
      li.addEventListener("click", function () {
        if (i === selItem[selCat]) activate();
        else { selItem[selCat] = i; Sound.play("move"); position(); }
      });
      addTilt(face);
      itemList.appendChild(li);
      return li;
    });
    refreshValues();
  }

  function refreshValues() {
    var cat = cats[selCat];
    itemEls.forEach(function (li, i) {
      var v = li.querySelector(".value");
      if (v) v.textContent = cat.items[i].value();
    });
  }

  // Tiles squish and lean toward wherever you press them, like soft glass
  function addTilt(face) {
    face.addEventListener("pointerdown", function (e) {
      if (reduceMotion) return;
      var r = face.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;    // -0.5 .. 0.5
      var y = (e.clientY - r.top) / r.height - 0.5;
      face.style.setProperty("--tx", (x * 6).toFixed(1) + "px");
      face.style.setProperty("--ty", (y * 4).toFixed(1) + "px");
      face.style.setProperty("--sx", "0.975");
      face.style.setProperty("--sy", "0.94");
    });
    function release() {
      ["--tx", "--ty", "--sx", "--sy"].forEach(function (p) { face.style.removeProperty(p); });
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

  function position() {
    var m = metrics();
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

    var s = selItem[selCat];
    var selY = m.barY + m.catSel + m.titleH + 8;
    itemEls.forEach(function (el, i) {
      var y;
      if (i === s) y = selY;
      else if (i > s) y = selY + m.selTile + m.gap + (i - s - 1) * (m.tile + m.gap);
      else y = m.barY - m.gap * 2 - (s - i) * (m.tile + m.gap);   // earlier items slide up above the row
      el.style.transform = "translate(" + left + "px," + y + "px)";
      el.classList.toggle("sel", i === s);
      el.classList.toggle("above", i < s);
      el.classList.toggle("dim", i > s);
    });
  }

  // ---------- Moving around ------------------------------------------------

  function setCat(i) {
    i = Math.max(0, Math.min(cats.length - 1, i));
    if (i === selCat) return;
    selCat = i;
    Sound.play("move");
    buildItems(true);
    position();
    glitch();
  }

  function moveItem(d) {
    var n = cats[selCat].items.length;
    var i = Math.max(0, Math.min(n - 1, selItem[selCat] + d));
    if (i === selItem[selCat]) return;
    selItem[selCat] = i;
    Sound.play("move");
    position();
  }

  function activate() {
    var cat = cats[selCat];
    var item = cat.items[selItem[selCat]];
    if (!item) return;
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
    if (k === "ArrowLeft" || k === "a") setCat(selCat - 1);
    else if (k === "ArrowRight" || k === "d") setCat(selCat + 1);
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

  var touch = null;
  document.getElementById("xmb").addEventListener("touchstart", function (e) {
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  document.getElementById("xmb").addEventListener("touchend", function (e) {
    if (!touch) return;
    var dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;   // a tap: the click handler deals with it
    if (Math.abs(dx) > Math.abs(dy)) setCat(selCat - Math.sign(dx));
    else moveItem(-Math.sign(dy) * Math.max(1, Math.round(Math.abs(dy) / 90)));
  }, { passive: true });

  // ---------- Mute button, clock, glass highlight, start screen ------------

  function syncMute() {
    muteBtn.classList.toggle("off", !Sound.isMusicOn());
    muteBtn.setAttribute("aria-pressed", String(!Sound.isMusicOn()));
  }
  muteBtn.addEventListener("click", function () {
    Sound.setMusic(!Sound.isMusicOn());
    syncMute();
    if (cats[selCat].isSettings) refreshValues();
  });

  function tickClock() {
    var now = new Date();
    document.querySelector(".clock-time").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    document.querySelector(".clock-date").textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  }

  // Glass highlight: the soft shine on each glass surface follows the pointer.
  var GLASS = ".cat, .face, .panel, #mute, .btn, #lightbox button";
  document.addEventListener("pointermove", function (e) {
    var el = e.target.closest && e.target.closest(GLASS);
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
    el.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
  }, { passive: true });

  function start() {
    if (started) return;
    started = true;
    Sound.unlock().then(function () { Sound.play("start"); syncMute(); });
    splash.classList.add("leaving");
    document.body.classList.add("started");
    buildItems(true);
    position();
    setTimeout(function () { splash.remove(); }, 750);
    setTimeout(function () { window.Detail.route(); }, 450);   // open a shared link like #/projects/project-1
  }
  splash.addEventListener("click", start);
  splash.addEventListener("touchend", function (e) { e.preventDefault(); start(); });

  // ---------- Setup -------------------------------------------------------

  document.querySelectorAll("[data-site-name]").forEach(function (n) { n.textContent = SITE.name; });
  document.querySelectorAll("[data-site-tagline]").forEach(function (n) { n.textContent = SITE.tagline || ""; });
  document.title = SITE.name + " · Résumé";
  if (window.matchMedia && matchMedia("(pointer: coarse)").matches) {
    document.getElementById("hint").textContent = "swipe to browse · tap twice to open";
    splash.querySelector(".splash-hint").textContent = "tap anywhere. go on.";
  }

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
      if (ci < 0) return;
      var ii = cats[ci].items.findIndex(function (it) { return it.id === itemId; });
      selItem[ci] = Math.max(0, ii);
      if (ci !== selCat) { selCat = ci; buildItems(false); }
      position();
    },
    // The visible tile faces, for the detail page's turnstile animation
    faces: function () {
      return Array.prototype.map.call(itemList.querySelectorAll(".face"), function (f) { return f; });
    }
  };
})();
