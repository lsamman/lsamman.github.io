// Settings (Full access): Elon Mush's ani-social media platform, now the control panel for the whole iPhone 3G.
// Every Sacred App lives on lsamman.github.io, so they share one localStorage and Settings can manage all of them.
import { APPS, byId, raw, get, set, drop, allKeys, keysFor, usage, clearApp, formatBytes, managedKeys, bytesOf,
  readTheme, writeTheme, writeAllThemes, overallTheme, makeBackup, backupName, parseBackup, diffBackup, applyDiff } from "./store.js?v=20261008182449";
import { PRESETS, DEFAULT_BG, KEY as WALL_KEY, current as currentWall, save as saveWall, nameOf as wallName, fromFile } from "./wallpapers.js?v=20261008182449";
import { icon } from "./icons.js?v=20261008182449";

const BUILD = new URL(import.meta.url).searchParams.get("v") || "unknown";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const narrow = () => matchMedia("(max-width: 759px)").matches;
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const time = d => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// ---------- the panes ----------
const SECTIONS = [["personal", "Personal"], ["phone", "Phone"], ["system", "System"]];
const PANES = [
  { id: "appearance", name: "Appearance", section: "personal", words: "theme light dark auto night day graphite colour color" },
  { id: "wallpaper", name: "Wallpaper", section: "personal", words: "desktop background home screen picture photo image" },
  { id: "antisocial", name: "Anti-Social", section: "personal", words: "screen time timer limit touch grass outside break" },
  { id: "about", name: "About This Phone", section: "phone", words: "iphone 3g specs model carrier contract verizon apps installed" },
  { id: "network", name: "Network", section: "phone", words: "3g 5g god's router wifi signal connection" },
  { id: "storage", name: "Storage", section: "system", words: "data keys bytes clear delete reset space localstorage" },
  { id: "backup", name: "Backup", section: "system", words: "export import restore download file json" },
  { id: "update", name: "Software Update", section: "system", words: "version firmware never update siri" }
];
const paneById = id => PANES.find(p => p.id === id);

// ---------- theme for Settings itself ----------
function applyTheme() {
  const t = get("theme", "auto");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- the grid (Show All) ----------
function renderGrid() {
  $("#grid").innerHTML = SECTIONS.map(([sid, label]) => `
    <div class="section"><h2>${label}</h2><ul class="icons">${PANES.filter(p => p.section === sid).map(p => `
      <li><a class="picon" href="#${p.id}" data-pane="${p.id}"><span class="glyph">${icon(p.id, 32)}</span><span class="name">${esc(p.name)}</span>${p.id === "antisocial" ? '<span class="badge" id="as-badge" hidden></span>' : ""}</a></li>`).join("")}
    </ul></div>`).join("");
  tickBadge();
}

function search(q) {
  q = q.trim().toLowerCase();
  const hits = q ? PANES.filter(p => (p.name + " " + p.words).toLowerCase().includes(q)).map(p => p.id) : [];
  $("#grid").classList.toggle("searching", !!q);
  $$(".picon").forEach(a => a.classList.toggle("hit", hits.includes(a.dataset.pane)));
  return hits;
}

// ---------- navigation ----------
let currentPane = null, cleanup = null, booted = false;
function route() {
  const id = location.hash.slice(1);
  const pane = paneById(id);
  show(pane ? id : null);
}

function show(id) {
  if (id === currentPane && (id || !$("#pane").innerHTML)) return;
  const content = $("#content"), win = $("#window"), paneEl = $("#pane");
  const from = content.getBoundingClientRect().height;
  if (cleanup) { cleanup(); cleanup = null; }
  const prev = currentPane;
  currentPane = id;
  const p = id && paneById(id);
  $("#title").textContent = p ? p.name : "Settings (Full access)";
  document.title = p ? p.name + " · Settings (Full access)" : "Settings (Full access)";
  win.classList.toggle("in-pane", !!p);
  if (p) {
    paneEl.innerHTML = `<div class="pane-inner" data-id="${id}"></div>`;
    const c = RENDER[id]($(".pane-inner", paneEl));
    cleanup = typeof c === "function" ? c : null;
  }
  // a phone slides the pane in over the grid; a computer resizes the window like System Preferences
  if (narrow()) {
    win.classList.toggle("open", !!p);
    if (p) paneEl.scrollTop = 0;
    if (!p) setTimeout(() => { if (!currentPane) paneEl.innerHTML = ""; }, reduce() ? 0 : 350);
  } else {
    win.classList.toggle("open", !!p);
    if (!p) paneEl.innerHTML = "";
    if (booted && !reduce()) resize(content, from);
  }
  if (!p) { const s = $("#search"); if (s.value) search(s.value); }
}

function resize(content, from) {
  content.style.height = "";
  const to = content.getBoundingClientRect().height;
  if (Math.abs(to - from) < 2) return;
  content.style.height = from + "px";
  content.classList.add("resizing");
  void content.offsetHeight;
  content.style.height = to + "px";
  const done = () => { content.style.height = ""; content.classList.remove("resizing"); content.removeEventListener("transitionend", done); };
  content.addEventListener("transitionend", done);
  setTimeout(done, 500);
}

// ---------- sheets (Leopard's dialogs drop down from the title bar) ----------
function sheet({ title, body, buttons, icon: ic }) {
  const wrap = $("#sheet"), box = $(".sheet", wrap);
  box.innerHTML = `${ic ? `<div class="sheet-icon">${ic}</div>` : ""}<div class="sheet-text"><h2 id="sheet-title">${esc(title)}</h2>${body}</div>
    <div class="buttons">${buttons.map((b, i) => `<button type="button" class="aqua${b.default ? " default" : ""}${b.danger ? " danger" : ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>`;
  wrap.hidden = false;
  requestAnimationFrame(() => wrap.classList.add("in"));
  const focus = $(".default", box) || $("button", box);
  focus.focus();
  return new Promise(resolve => {
    const close = v => {
      wrap.classList.remove("in");
      document.removeEventListener("keydown", key);
      setTimeout(() => { wrap.hidden = true; box.innerHTML = ""; }, reduce() ? 0 : 220);
      resolve(v);
    };
    const key = e => {
      if (e.key === "Escape") { e.preventDefault(); close(buttons.find(b => b.cancel)?.value ?? null); }
    };
    document.addEventListener("keydown", key);
    $$("button", box).forEach(b => b.addEventListener("click", () => close(buttons[+b.dataset.i].value)));
  });
}

// ---------- small builders ----------
const box = (title, inner, cls = "") => `<fieldset class="group ${cls}">${title ? `<legend>${title}</legend>` : ""}${inner}</fieldset>`;
const seg = (name, value, opts) => `<span class="seg" role="radiogroup" data-seg="${name}">${opts.map(([v, l]) =>
  `<button type="button" role="radio" aria-checked="${v === value}" data-v="${v}">${l}</button>`).join("")}</span>`;
const appGlyph = (a, size = 24) => a.icon
  ? `<img class="appicon" src="${esc(a.icon)}" alt="" width="${size}" height="${size}">`
  : `<span class="appicon" style="background:${a.bg};width:${size}px;height:${size}px;font-size:${Math.round(size * .55)}px">${esc(a.glyph)}</span>`;
const head = (id, text) => `<div class="pane-head">${icon(id, 48)}<p>${text}</p></div>`;

// ---------- Appearance ----------
function renderAppearance(el) {
  const draw = () => {
    const all = overallTheme();
    el.innerHTML = head("appearance", "One switch for the whole phone. MySpace, Bluebird, Snapchat, Facebook, Podcasts, the wiki and Settings all follow it.") +
      box("Every app", `<div class="row"><span class="label">Appearance:</span>${seg("all", all, [["light", "Light"], ["dark", "Dark"], ["auto", "Auto"]])}</div>
        <p class="hint">${all === "mixed" ? "Some apps are set differently below. Pick one to set them all." : "Auto follows your device's light or dark mode."}</p>`) +
      box("Per app", `<table class="list"><tbody>${APPS.map(a => `
        <tr><td class="ic">${appGlyph(a)}</td><th scope="row">${esc(a.name)}<small>${esc(a.theme)}</small></th>
        <td class="end"><select class="popup" data-app="${a.id}" aria-label="${esc(a.name)} appearance">${[["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) =>
          `<option value="${v}"${readTheme(a) === v ? " selected" : ""}>${l}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>
        <p class="hint">Apps that are already open pick this up the next time they load.</p>`);
    $$('[data-seg="all"] button', el).forEach(b => b.addEventListener("click", () => { writeAllThemes(b.dataset.v); applyTheme(); draw(); }));
    $$("select[data-app]", el).forEach(s => s.addEventListener("change", () => { writeTheme(byId(s.dataset.app), s.value); applyTheme(); draw(); }));
  };
  draw();
}

// ---------- Wallpaper ----------
function homeScreen(bg) {
  const apps = APPS.filter(a => a.id !== "wiki").slice(0, 6);
  return `<div class="mini" style="background:${esc(bg)}">
    <div class="mini-status"><span class="sig"><i></i><i></i><i></i><i></i><i></i></span>God's router <b>3G</b><span class="mini-clock">${time(Date.now())}</span><span class="batt"></span></div>
    <div class="mini-apps">${apps.map(a => `<span class="mini-app">${appGlyph(a, 26)}<small>${esc(a.name)}</small></span>`).join("")}</div>
    <div class="mini-dock">${[["📖", "linear-gradient(#fdfdfd,#d9d9d9)"], ["♫", "linear-gradient(#ffb24d,#f26b1d)"], ["🎲", "linear-gradient(#7fe07a,#2f9e44)"], ["W", "linear-gradient(#fff,#e3e7ea)"]]
      .map(([g, b]) => `<span class="mini-app">${appGlyph({ glyph: g, bg: b }, 22)}</span>`).join("")}</div>
  </div>`;
}
function renderWallpaper(el) {
  let note = "";
  const draw = () => {
    const cur = currentWall();
    const photo = cur && !PRESETS.some(p => p.bg === cur) ? cur : null;
    const tiles = [{ id: "default", name: "Default", bg: DEFAULT_BG, value: null }, ...PRESETS.map(p => ({ ...p, value: p.bg }))];
    if (photo) tiles.push({ id: "photo", name: wallName(photo), bg: photo, value: photo });
    el.innerHTML = head("wallpaper", "Pick the home screen for the iPhone 3G on the wiki. Open the phone from the wiki's toolbar to see it.") +
      `<div class="wall-preview">${homeScreen(cur || DEFAULT_BG)}<p class="wall-name"><b>${esc(wallName(cur))}</b>${note ? `<span class="note">${esc(note)}</span>` : ""}</p></div>` +
      box("Wallpapers", `<ul class="tiles">${tiles.map(t => `<li><button type="button" class="tile${t.value === cur ? " on" : ""}" data-tile="${t.id}" aria-pressed="${t.value === cur}" title="${esc(t.note || t.name)}">
          <span class="thumb" style="background:${esc(t.bg)}"></span><span class="tname">${esc(t.name)}</span></button></li>`).join("")}
        <li><label class="tile upload"><span class="thumb plus">+</span><span class="tname">Upload your own</span><input type="file" accept="image/*" id="wall-file" class="sr"></label></li></ul>
        <div class="buttons left"><button type="button" class="aqua" id="wall-default"${cur === null ? " disabled" : ""}>Use Default</button></div>`);
    $$("[data-tile]", el).forEach(b => b.addEventListener("click", () => {
      const t = tiles.find(t => t.id === b.dataset.tile);
      note = saveWall(t.value) ? "" : "Couldn't save. Storage may be full.";
      draw();
    }));
    $("#wall-default", el).addEventListener("click", () => { saveWall(null); note = ""; draw(); });
    $("#wall-file", el).addEventListener("change", async e => {
      const f = e.target.files[0];
      if (!f) return;
      note = "Shrinking your picture…"; $(".wall-name", el).innerHTML = `<b>${esc(wallName(cur))}</b><span class="note">${note}</span>`;
      try {
        const v = await fromFile(f);
        note = saveWall(v) ? `Saved (${formatBytes(v.length * 2)}).` : "That picture is too big to save. Storage may be full.";
      } catch (err) { note = err.message; }
      draw();
    });
  };
  draw();
}

// ---------- Anti-Social ----------
// settings.antisocial = { limitMinutes: number, startedAt: ms since 1970 or null }. Running when startedAt is a number.
const timer = () => {
  const t = get("antisocial", null);
  return t && typeof t === "object" ? { limitMinutes: +t.limitMinutes || 30, startedAt: typeof t.startedAt === "number" ? t.startedAt : null } : { limitMinutes: 30, startedAt: null };
};
const endsAt = t => t.startedAt === null ? null : t.startedAt + t.limitMinutes * 60000;
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

function renderAntisocial(el) {
  const R = 54, C = 2 * Math.PI * R;
  el.innerHTML = head("antisocial", "Elon Mush built Settings as the ani-social media platform. This is what's left of it: set a limit, and when it runs out, Settings tells you to go outside.") +
    `<div class="as">
      <div class="as-dial"><svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="${R}" class="track"/><circle cx="64" cy="64" r="${R}" class="ring" id="as-ring" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="as-read"><b id="as-time">0:00</b><span id="as-sub">Not running</span></div></div>
      <div class="as-controls">
        ${box("", `<div class="row"><label class="label" for="as-limit">Limit:</label><input type="range" id="as-limit" min="5" max="180" step="5"><output id="as-out"></output></div>
        <div class="row"><span class="label"></span><span class="quick">${[15, 30, 60, 90].map(m => `<button type="button" class="aqua small" data-m="${m}">${m} min</button>`).join("")}</span></div>
        <div class="buttons left"><button type="button" class="aqua default" id="as-start">Start</button><button type="button" class="aqua" id="as-stop">Stop</button></div>`)}
        <p class="hint">The timer keeps running when you close Settings. The other apps can read it too.</p>
      </div></div>`;
  const range = $("#as-limit", el);
  const draw = () => {
    const t = timer(), end = endsAt(t), now = Date.now();
    if (document.activeElement !== range) range.value = Math.min(180, Math.max(5, Math.round(t.limitMinutes)));
    $("#as-out", el).textContent = range.value + " min";
    const left = end === null ? t.limitMinutes * 60000 : Math.max(0, end - now);
    $("#as-time", el).textContent = clock(left);
    $("#as-sub", el).textContent = end === null ? "Not running" : left > 0 ? "Ends at " + time(end) : "Time's up";
    $("#as-ring", el).style.strokeDashoffset = end === null ? 0 : C * (1 - Math.min(1, left / (t.limitMinutes * 60000)));
    $("#as-ring", el).classList.toggle("late", end !== null && left <= 60000);
    $("#as-start", el).textContent = end === null ? "Start" : "Restart";
    $("#as-stop", el).disabled = end === null;
  };
  const setLimit = m => { const t = timer(); set("antisocial", { limitMinutes: m, startedAt: t.startedAt }); draw(); tickBadge(); };
  range.addEventListener("input", () => { $("#as-out", el).textContent = range.value + " min"; });
  range.addEventListener("change", () => setLimit(+range.value));
  $$("[data-m]", el).forEach(b => b.addEventListener("click", () => { range.value = b.dataset.m; setLimit(+b.dataset.m); }));
  $("#as-start", el).addEventListener("click", () => { set("antisocial", { limitMinutes: +range.value, startedAt: Date.now() }); draw(); tickBadge(); });
  $("#as-stop", el).addEventListener("click", () => { set("antisocial", { limitMinutes: +range.value, startedAt: null }); draw(); tickBadge(); });
  draw();
  const iv = setInterval(draw, 1000);
  return () => clearInterval(iv);
}

function tickBadge() {
  const t = timer(), end = endsAt(t), b = $("#as-badge");
  if (b) {
    b.hidden = end === null;
    if (end !== null) { const left = end - Date.now(); b.textContent = left <= 0 ? "!" : left < 60000 ? "<1m" : Math.ceil(left / 60000) + "m"; }
  }
  const nudge = $("#nudge");
  const due = end !== null && Date.now() >= end;
  if (due && nudge.hidden) {
    $("#nudge-text").textContent = `You gave yourself ${t.limitMinutes} minute${t.limitMinutes === 1 ? "" : "s"} on the phone. Time's up. Touch grass, look at the sky, and come back later.`;
    nudge.hidden = false;
    requestAnimationFrame(() => nudge.classList.add("in"));
    $("#nudge-done").focus();
  } else if (!due && !nudge.hidden) hideNudge();
}
function hideNudge() { const n = $("#nudge"); n.classList.remove("in"); n.hidden = true; }

// ---------- About This Phone ----------
function renderAbout(el) {
  const specs = [["Model", "iPhone 3G"], ["Orientation", "Sideways"], ["Screen", "Cracked"], ["Carrier", "God's router"], ["Network", "3G"],
    ["Front camera", "None"], ["Assistant", "Siri 3G"], ["Music", "U2, on loop"], ["Firmware", "Never update"],
    ["Contract", "The 3 Year Contract Plan from Verizon for Unlimited Talk and Text"]];
  const used = bytesOf(managedKeys());
  el.innerHTML = `<div class="about">${icon("about", 96)}<h2>iPhone 3G</h2><p class="muted">Anti-deity protocol. Version: Never update.</p>
    <dl class="specs">${specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></div>` +
    box("Sacred Apps", `<table class="list"><tbody>${APPS.map(a => `
      <tr><td class="ic">${appGlyph(a)}</td><th scope="row"><a href="${esc(a.url)}">${esc(a.full)}</a></th><td class="end muted" data-status="${a.id}">${a.id === "settings" ? "Installed" : "Checking…"}</td></tr>`).join("")}</tbody></table>
      <p class="hint" id="prophecy">The Prophecy needs all six Sacred Apps and the Contract.</p>`) +
    box("This device", `<dl class="specs real">
      <dt>Screen</dt><dd>${screen.width} × ${screen.height} at ${window.devicePixelRatio || 1}x</dd>
      <dt>Window</dt><dd>${innerWidth} × ${innerHeight}</dd>
      <dt>Appearance</dt><dd>${matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light"} (from your device)</dd>
      <dt>App data</dt><dd>${formatBytes(used)} in ${managedKeys().length} keys</dd>
      <dt>Settings build</dt><dd>${esc(BUILD)}</dd></dl>`);
  let found = 1;
  const sacred = APPS.filter(a => a.id !== "wiki").length;
  APPS.filter(a => a.id !== "settings").forEach(a => {
    fetch(new URL(a.url, location.href), { method: "HEAD", cache: "no-store" })
      .then(r => r.ok, () => false)
      .then(ok => {
        const cell = $(`[data-status="${a.id}"]`, el);
        if (!cell) return;
        cell.textContent = ok ? "Installed" : a.id === "wiki" ? "Can't reach it" : "Waiting…";
        cell.classList.toggle("waiting", !ok);
        if (ok && a.id !== "wiki") found++;
        const p = $("#prophecy", el);
        if (p) p.textContent = `Sacred Apps found: ${found} of ${sacred}. The Prophecy also needs the Contract.`;
      });
  });
}

// ---------- Network ----------
function renderNetwork(el) {
  const draw = () => {
    const c = navigator.connection;
    const online = navigator.onLine;
    el.innerHTML = head("network", "The iPhone 3G connects to one tower only, and that's God's router.") +
      box("", `<dl class="specs">
        <dt>Status</dt><dd><span class="dot ${online ? "on" : "off"}"></span>${online ? "Connected" : "Offline. Even God's router has bad days."}</dd>
        <dt>Network</dt><dd>God's router</dd>
        <dt>Signal</dt><dd><span class="bars" aria-label="Full bars"><i></i><i></i><i></i><i></i><i></i></span> Full bars</dd>
        <dt>Mode</dt><dd>3G</dd>
        ${c && c.effectiveType ? `<dt>Your real link</dt><dd>${esc(c.effectiveType.toUpperCase())}${c.downlink ? `, about ${c.downlink} Mbps` : ""}. Settings reports it as 3G anyway.</dd>` : ""}
      </dl>`) +
      box("Advanced", `<label class="check"><input type="checkbox" checked disabled> Connect only to God's router</label>
        <label class="check"><input type="checkbox" disabled> Enable 5G</label>
        <p class="hint">5G stays off. It awakens Elon Mush's dormant twin.</p>`);
  };
  draw();
  addEventListener("online", draw); addEventListener("offline", draw);
  return () => { removeEventListener("online", draw); removeEventListener("offline", draw); };
}

// ---------- Storage ----------
async function renderStorage(el) {
  const draw = async () => {
    const rows = usage(), total = rows.reduce((n, r) => n + r.bytes, 0), keys = rows.reduce((n, r) => n + r.count, 0);
    const other = allKeys().length - keys;
    const colors = ["#2f8ae0", "#43b02a", "#e8a33d", "#3b5998", "#8e3fc0", "#d8312b", "#7d858f"];
    el.innerHTML = head("storage", "What each app keeps in this browser. Nothing here leaves your device.") +
      `<div class="usage-bar" role="img" aria-label="Storage used by each app">${rows.map((r, i) => r.bytes ? `<span style="flex:${r.bytes};background:${colors[i]}" title="${esc(r.app.name)}: ${formatBytes(r.bytes)}"></span>` : "").join("") || '<span class="empty"></span>'}</div>` +
      box("", `<table class="list storage"><thead><tr><td></td><th scope="col">App</th><th scope="col" class="num">Keys</th><th scope="col" class="num">Size</th><td></td></tr></thead><tbody>${rows.map((r, i) => `
        <tr data-row="${r.app.id}"><td class="ic"><span class="swatch" style="background:${colors[i]}"></span>${appGlyph(r.app)}</td><th scope="row">${esc(r.app.name)}<small>${r.app.prefixes.map(esc).join(" ")}</small></th>
        <td class="num" data-count>${r.count}</td><td class="num">${formatBytes(r.bytes)}</td>
        <td class="end"><button type="button" class="aqua small" data-clear="${r.app.id}"${r.count ? "" : " disabled"}>Clear…</button></td></tr>`).join("")}</tbody>
        <tfoot><tr><td></td><th scope="row">Total</th><td class="num" id="total-keys">${keys}</td><td class="num">${formatBytes(total)}</td><td></td></tr></tfoot></table>
        <p class="hint">${other ? `${other} other key${other === 1 ? "" : "s"} on this site belong${other === 1 ? "s" : ""} to no app here. ` : ""}Sizes are estimates: two bytes a character.</p>
        <p class="hint" id="estimate"></p>`);
    $$("[data-clear]", el).forEach(b => b.addEventListener("click", async () => {
      const a = byId(b.dataset.clear), n = keysFor(a).length;
      const ok = await sheet({ icon: icon("storage", 48), title: `Clear ${a.name}'s data?`,
        body: `<p>This removes ${n} key${n === 1 ? "" : "s"} (${formatBytes(bytesOf(keysFor(a)))}) from this browser. ${a.id === "settings" ? "Settings goes back to its defaults." : `${esc(a.name)} will start fresh next time.`} You can't undo this unless you have a backup.</p>`,
        buttons: [{ label: "Cancel", value: false, cancel: true }, { label: "Clear", value: true, default: true, danger: true }] });
      if (!ok) return;
      clearApp(a);
      if (a.id === "settings") applyTheme();
      if (a.id === "settings" || a.id === "wiki") tickBadge();
      draw();
    }));
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const e = await navigator.storage.estimate();
        const p = $("#estimate", el);
        if (p && e.quota) p.textContent = `Your browser says this site uses ${formatBytes(e.usage || 0)} of ${formatBytes(e.quota)} in all.`;
      } catch (err) {}
    }
  };
  await draw();
}

// ---------- Backup ----------
function renderBackup(el) {
  let pending = null, replace = false, msg = "";
  const draw = () => {
    const keys = managedKeys(), apps = new Set(keys.map(k => APPS.find(a => a.prefixes.some(p => k.startsWith(p))).id));
    el.innerHTML = head("backup", "Save everything the apps keep in this browser to a file, or bring it back on another device.") +
      box("Back up", `<p>Includes ${keys.length} key${keys.length === 1 ? "" : "s"} from ${apps.size} app${apps.size === 1 ? "" : "s"} (${formatBytes(bytesOf(keys))}).</p>
        <div class="buttons left"><button type="button" class="aqua default" id="bk-export"${keys.length ? "" : " disabled"}>Back Up Now</button></div>`) +
      box("Restore", pending ? preview() : `<p>Choose a backup file. You'll see what changes before anything is written.</p>
        <div class="buttons left"><label class="aqua" tabindex="0" role="button">Choose Backup…<input type="file" accept=".json,application/json" id="bk-file" class="sr"></label></div>`) +
      (msg ? `<p class="status" role="status">${esc(msg)}</p>` : "");
    $("#bk-export", el).addEventListener("click", () => {
      const data = makeBackup(BUILD);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = backupName();
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      msg = `Saved ${a.download}.`; draw();
    });
    const file = $("#bk-file", el);
    if (file) {
      file.closest("label").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
      file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        try { pending = parseBackup(await f.text()); pending.file = f.name; msg = ""; }
        catch (err) { pending = null; msg = err.message; }
        draw();
      });
    }
    if (pending) {
      $("#bk-replace", el).addEventListener("change", e => { replace = e.target.checked; draw(); });
      $("#bk-cancel", el).addEventListener("click", () => { pending = null; replace = false; msg = "Nothing was changed."; draw(); });
      $("#bk-apply", el).addEventListener("click", () => {
        const rows = diffBackup(pending, replace).filter(r => r.change !== "same");
        const failed = applyDiff(rows);
        pending = null; replace = false;
        msg = failed ? `Restored with ${failed} key${failed === 1 ? "" : "s"} that didn't fit. Storage may be full.` : `Restored. ${rows.length} change${rows.length === 1 ? "" : "s"} applied.`;
        applyTheme(); tickBadge(); draw();
      });
    }
  };
  const LABEL = { add: "New", change: "Changed", same: "Same", remove: "Removed" };
  const preview = () => {
    const rows = diffBackup(pending, replace);
    const count = c => rows.filter(r => r.change === c).length;
    const changes = rows.length - count("same");
    return `<p><b>${esc(pending.file)}</b>${pending.exported ? `, made ${esc(new Date(pending.exported).toLocaleString())}` : ""}.</p>
      <p class="summary"><span class="chg add">${count("add")} new</span> <span class="chg change">${count("change")} changed</span> <span class="chg remove">${count("remove")} removed</span> <span class="chg same">${count("same")} the same</span></p>
      <div class="diff"><table class="list"><thead><tr><th scope="col">Key</th><th scope="col">App</th><th scope="col" class="end">Change</th></tr></thead><tbody>${rows.map(r => `
        <tr class="${r.change}"><td class="key">${esc(r.key)}</td><td>${esc(r.app.name)}</td><td class="end"><span class="chg ${r.change}">${LABEL[r.change]}</span></td></tr>`).join("") || '<tr><td colspan="3" class="muted">The backup is empty.</td></tr>'}</tbody></table></div>
      ${pending.skipped.length ? `<p class="hint">${pending.skipped.length} key${pending.skipped.length === 1 ? "" : "s"} in the file belong to no app here and will be skipped.</p>` : ""}
      <label class="check"><input type="checkbox" id="bk-replace"${replace ? " checked" : ""}> Also remove data that isn't in the backup, for the apps it includes</label>
      <div class="buttons"><button type="button" class="aqua" id="bk-cancel">Cancel</button><button type="button" class="aqua default" id="bk-apply"${changes ? "" : " disabled"}>Restore ${changes} change${changes === 1 ? "" : "s"}</button></div>`;
  };
  draw();
}

// ---------- Software Update ----------
const prettyVersion = v => /^\d{14}$/.test(v) ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)} (${v.slice(8, 10)}:${v.slice(10, 12)})` : v;
function renderUpdate(el) {
  let site = null, checking = false, checked = null;
  const SIRI = [
    "I'm sorry. I can't do that. Updating needs 5G, and 5G awakens Elon Mush's dormant twin.",
    "Firmware policy says Never update. I wrote the policy. I am Siri 3G.",
    "This phone survived the downfall of Vine. It doesn't need your update.",
    "Updating would void the 3 Year Contract Plan from Verizon. Nobody wants that."
  ];
  let siri = 0;
  const draw = () => {
    el.innerHTML = head("update", "Software Update checks for new software for your iPhone 3G. It never installs any.") +
      box("", `<div class="su">
        <p class="su-state"><span class="dot on"></span><b>Your iPhone 3G is up to date. Never update.</b></p>
        <dl class="specs">
          <dt>Site version</dt><dd id="su-site">${site ? esc(prettyVersion(site)) : checking ? "Checking…" : "Unknown"}</dd>
          <dt>This copy of Settings</dt><dd>${esc(prettyVersion(BUILD))}</dd>
          <dt>Firmware</dt><dd>iPhone OS 3, forever</dd>
          <dt>Last checked</dt><dd>${checked ? time(checked) : "Never"}</dd>
        </dl>
        ${site && site !== BUILD && BUILD !== "unknown" ? `<p class="hint">The website itself has a newer version. Settings reloads into it on its own. That's the website, not the phone.</p>` : ""}
        <div class="row"><label class="label" for="su-sched">Check for updates:</label><select class="popup" id="su-sched" disabled><option>Never</option></select></div>
        <div class="buttons"><button type="button" class="aqua" id="su-check"${checking ? " disabled" : ""}>${checking ? '<span class="spin"></span>Checking…' : "Check Now"}</button><button type="button" class="aqua default" id="su-update">Update</button></div>
      </div>`) +
      box("Installed updates", `<p class="muted">None. The iPhone 3G has never been updated, and it never will be.</p>`);
    $("#su-check", el).addEventListener("click", check);
    $("#su-update", el).addEventListener("click", async () => {
      const line = SIRI[siri++ % SIRI.length];
      await sheet({ icon: icon("update", 48), title: "Siri 3G refused the update.", body: `<p class="siri">“${esc(line)}”</p>`,
        buttons: [{ label: "OK", value: true, default: true, cancel: true }] });
    });
  };
  function check() {
    checking = true; draw();
    fetch("../version.json?t=" + Date.now(), { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { site = d && d.v ? String(d.v) : site; }, () => {})
      .then(() => new Promise(r => setTimeout(r, reduce() ? 0 : 700)))
      .then(() => { checking = false; checked = Date.now(); if (el.isConnected) draw(); });
  }
  check();
}

const RENDER = { appearance: renderAppearance, wallpaper: renderWallpaper, antisocial: renderAntisocial, about: renderAbout,
  network: renderNetwork, storage: renderStorage, backup: renderBackup, update: renderUpdate };

// ---------- start ----------
function menuClock() { const c = $("#menu-clock"); if (c) c.textContent = new Date().toLocaleTimeString([], { weekday: "short", hour: "numeric", minute: "2-digit" }); }

applyTheme();
renderGrid();
route();
booted = true;
menuClock();
setInterval(() => { tickBadge(); menuClock(); }, 1000);
tickBadge();

addEventListener("hashchange", route);
$("#go-back").addEventListener("click", () => history.back());
$("#go-fwd").addEventListener("click", () => history.forward());
$("#showall").addEventListener("click", e => {
  e.preventDefault();
  if (currentPane) location.hash = "";
});
const s = $("#search");
s.addEventListener("input", () => { if (currentPane) location.hash = ""; search(s.value); });
s.addEventListener("keydown", e => {
  if (e.key === "Enter") { const hits = search(s.value); if (hits.length) { location.hash = hits[0]; s.value = ""; search(""); s.blur(); } }
  if (e.key === "Escape") { s.value = ""; search(""); }
});
$("#nudge-done").addEventListener("click", () => { const t = timer(); set("antisocial", { limitMinutes: t.limitMinutes, startedAt: null }); hideNudge(); tickBadge(); });
$("#nudge-more").addEventListener("click", () => { const t = timer(); set("antisocial", { limitMinutes: t.limitMinutes, startedAt: Date.now() - (t.limitMinutes - 5) * 60000 }); hideNudge(); tickBadge(); });
// another tab (or another app) changed something: keep up
addEventListener("storage", e => {
  if (e.key === "settings.theme" || e.key === null) applyTheme();
  tickBadge();
  if (["appearance", "wallpaper", "storage"].includes(currentPane) && $("#sheet").hidden) {
    const id = currentPane; currentPane = null; show(id);
  }
});
