/*
 * The XMB-style menu: a row of categories and a column of items under the
 * selected one. Handles keyboard, mouse, scroll wheel and touch swipes, the
 * built-in Settings category, the clock, the mute button and the start screen.
 *
 * Content comes from js/content.js (window.SITE). You shouldn't need to edit this file.
 */

(function () {
  var SITE = window.SITE;
  var Sound = window.Sound || { play: function () {}, unlock: function () { return Promise.resolve(); }, setMusic: function () {}, isMusicOn: function () { return false; }, setSfx: function () {}, isSfxOn: function () { return false; }, setVolume: function () {}, getVolume: function () { return 0; } };
  var Waves = window.Waves || { init: function () {}, setHue: function () {}, setReducedMotion: function () {} };

  var catBar = document.getElementById("categories");
  var itemList = document.getElementById("items");
  var muteBtn = document.getElementById("mute");
  var splash = document.getElementById("splash");
  var root = document.documentElement;

  // ---------- Saved preferences --------------------------------------------

  function load(key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  // Like the PS3, the "Auto" theme changes colour with the month
  var MONTH_HUES = [205, 285, 135, 190, 150, 175, 200, 225, 260, 25, 35, 345];
  var THEMES = [
    { name: "Auto (by month)", hue: null },
    { name: "Sky", hue: 205 }, { name: "Aqua", hue: 178 }, { name: "Lime", hue: 115 },
    { name: "Violet", hue: 268 }, { name: "Rose", hue: 335 }, { name: "Amber", hue: 32 }
  ];
  var VOLUMES = [0, 0.25, 0.5, 0.75, 1];

  var themeIndex = Math.max(0, THEMES.findIndex(function (t) { return t.name === load("xmb.theme", "Sky"); }));
  var systemReduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reduceMotion = load("xmb.motion", systemReduced ? "on" : "off") === "on";

  function applyTheme() {
    var t = THEMES[themeIndex];
    var hue = t.hue == null ? MONTH_HUES[new Date().getMonth()] : t.hue;
    root.style.setProperty("--hue", hue);
    Waves.setHue(hue);
  }
  function applyMotion() {
    root.classList.toggle("reduce-motion", reduceMotion);
    Waves.setReducedMotion(reduceMotion);
  }

  // ---------- The Settings category (built in) ------------------------------

  var SETTINGS_ICON = "assets/icons/settings.svg";
  var settingsCat = {
    id: "settings", label: "Settings", icon: SETTINGS_ICON, isSettings: true,
    items: [
      { id: "music", title: "Background music", summary: "Generated ambient music",
        value: function () { return Sound.isMusicOn() ? "On" : "Off"; },
        change: function () { Sound.setMusic(!Sound.isMusicOn()); syncMute(); } },
      { id: "sfx", title: "Sound effects", summary: "Menu clicks and chimes",
        value: function () { return Sound.isSfxOn() ? "On" : "Off"; },
        change: function () { Sound.setSfx(!Sound.isSfxOn()); } },
      { id: "volume", title: "Volume", summary: "Press again to change",
        value: function () { return Math.round(Sound.getVolume() * 100) + "%"; },
        change: function () {
          var v = Sound.getVolume();
          var i = VOLUMES.findIndex(function (x) { return x > v + 0.01; });
          Sound.setVolume(i === -1 ? VOLUMES[0] : VOLUMES[i]);
        } },
      { id: "theme", title: "Theme colour", summary: "Background colour",
        value: function () { return THEMES[themeIndex].name; },
        change: function () { themeIndex = (themeIndex + 1) % THEMES.length; save("xmb.theme", THEMES[themeIndex].name); applyTheme(); } },
      { id: "motion", title: "Reduce motion", summary: "Calmer animations",
        value: function () { return reduceMotion ? "On" : "Off"; },
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
      b.setAttribute("aria-label", cat.label);
      b.addEventListener("click", function () { if (i !== selCat) { setCat(i); } });
      catBar.appendChild(b);
      return b;
    });
  }

  function buildItems(animate) {
    var cat = cats[selCat];
    itemList.innerHTML = "";
    itemEls = cat.items.map(function (item, i) {
      var li = document.createElement("li");
      li.className = "item" + (animate ? " enter" : "");
      if (animate) li.style.animationDelay = Math.min(i, 6) * 40 + "ms";
      li.innerHTML = '<div class="tile"><img alt=""></div><div class="text"><span class="title"></span><span class="sub"></span></div>';
      li.querySelector(".tile img").src = item.icon || cat.icon;
      li.querySelector(".title").textContent = item.title;
      li.querySelector(".sub").textContent = item.summary || item.subtitle || "";
      if (item.value) {
        var v = document.createElement("span");
        v.className = "value";
        li.appendChild(v);
      }
      li.addEventListener("click", function () {
        if (i === selItem[selCat]) activate();
        else { selItem[selCat] = i; Sound.play("move"); position(); }
      });
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

  // ---------- Layout: where everything sits on screen ----------------------

  function metrics() {
    var w = window.innerWidth, h = window.innerHeight, small = w <= 640;
    return {
      anchorX: small ? 64 : Math.max(150, w * 0.22),   // x of the selected category's centre
      barY: small ? h * 0.2 : h * 0.26,                // top of the category row
      catGap: small ? 92 : 140,
      selTile: small ? 56 : 70, tile: small ? 42 : 52,
      belowBar: small ? 108 : 138,                     // distance from bar to the selected item
      itemGap: small ? 58 : 70,
      selItemH: small ? 84 : 100
    };
  }

  function position() {
    var m = metrics();

    catEls.forEach(function (el, i) {
      var x = m.anchorX + (i - selCat) * m.catGap;
      el.style.transform = "translate(" + x + "px," + m.barY + "px)";
      el.classList.toggle("sel", i === selCat);
      el.style.opacity = i === selCat ? "" : Math.abs(i - selCat) > 4 ? "0" : "";
    });

    var s = selItem[selCat];
    var selY = m.barY + m.belowBar;
    itemEls.forEach(function (el, i) {
      var y, tileW = i === s ? m.selTile : m.tile;
      if (i === s) y = selY;
      else if (i > s) y = selY + m.selItemH + (i - s - 1) * m.itemGap;
      else y = m.barY - 16 - (s - i) * m.itemGap;          // earlier items slide up above the bar, like the PS3
      el.style.transform = "translate(" + (m.anchorX - tileW / 2) + "px," + y + "px)";
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

  // ---------- Mute button, clock, start screen ----------------------------

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
    document.querySelector(".clock-date").textContent = now.toLocaleDateString(undefined, { day: "numeric", month: "numeric" });
    document.querySelector(".clock-time").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function start() {
    if (started) return;
    started = true;
    Sound.unlock().then(function () { Sound.play("start"); syncMute(); });
    splash.classList.add("leaving");
    document.body.classList.add("started");
    buildItems(true);
    position();
    setTimeout(function () { splash.remove(); }, 1000);
    setTimeout(function () { window.Detail.route(); }, 500);   // open a shared link like #/projects/project-1
  }
  splash.addEventListener("click", start);
  splash.addEventListener("touchend", function (e) { e.preventDefault(); start(); });

  // ---------- Setup -------------------------------------------------------

  document.querySelectorAll("[data-site-name]").forEach(function (n) { n.textContent = SITE.name; });
  document.querySelectorAll("[data-site-tagline]").forEach(function (n) { n.textContent = SITE.tagline || ""; });
  document.title = SITE.name + " · Résumé";
  if (window.matchMedia && matchMedia("(pointer: coarse)").matches) {
    document.getElementById("hint").textContent = "Swipe to browse · tap twice to open";
  }

  Waves.init(document.getElementById("bg"));
  applyTheme();
  applyMotion();
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
    // The on-screen icon tile for an item, so the detail animation can start/end there
    tileFor: function (catId, itemId) {
      if (cats[selCat].id === catId) {
        var ii = cats[selCat].items.findIndex(function (it) { return it.id === itemId; });
        if (itemEls[ii]) return itemEls[ii].querySelector(".tile");
      }
      var ci = cats.findIndex(function (c) { return c.id === catId; });
      return catEls[ci] ? catEls[ci].querySelector("img") : null;
    }
  };
})();
