// Twitter: Bluebird Variant (with no limits). An X client from before the X, named for the Sacred App
// from The Legend Of Chris. No character limit, no auto-correct, never update.
// X's API isn't open to a plain web page, so Bluebird posts through X's own share page (one tab per part),
// shows tweets and profiles through X's embeds, and keeps favorites, drafts and saved tweets on this device.
import { ACCOUNTS, CANON, TRENDS, BOOT_LINES } from "./canon.js?v=20261007170436";

const view = document.getElementById("view");
const $ = (sel, root = document) => root.querySelector(sel);
const LIMIT = 280;   // X's limit for most accounts. Bluebird has none, so long tweets become a thread.

// ---------- storage (keeps working with defaults if storage is blocked) ----------
const PREFIX = "bluebird.";
function get(key, fallback) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
  catch (e) { return fallback; }
}
function set(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {} }

// ---------- helpers ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const len = s => [...s].length;
function linkify(text) {
  return esc(text)
    .replace(/(^|\s)@(\w{1,15})/g, '$1<a href="https://x.com/$2" target="_blank" rel="noopener">@$2</a>')
    .replace(/(^|\s)#(\w+)/g, '$1<a href="#/compose/%23$2">#$2</a>');
}
function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "less than a minute ago";
  if (s < 3600) return `about ${Math.round(s / 60)} minutes ago`;
  if (s < 86400) return `about ${Math.round(s / 3600)} hours ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500);
}
const notice = html => `<div class="notice">${html}</div>`;

// Split a tweet with no limits into parts X will take, at word boundaries, numbered "(1/3)".
export function split(text, max = LIMIT) {
  text = text.trim();
  if (len(text) <= max) return text ? [text] : [];
  let n = 2;
  for (;;) {
    const room = max - ` (${n}/${n})`.length;
    const parts = [];
    let cur = "";
    for (const word of text.split(/(\s+)/)) {
      if (len(cur + word) <= room) { cur += word; continue; }
      if (cur.trim()) parts.push(cur.trim());
      cur = word.trimStart();
      while (len(cur) > room) { parts.push([...cur].slice(0, room).join("")); cur = [...cur].slice(room).join(""); }
    }
    if (cur.trim()) parts.push(cur.trim());
    if (parts.length <= n) return parts.map((p, i) => `${p} (${i + 1}/${parts.length})`);
    n = parts.length;
  }
}
const intent = text => "https://x.com/intent/post?text=" + encodeURIComponent(text);

// ---------- X embeds (widgets.js), loaded only when needed ----------
let widgets;
function loadWidgets() {
  widgets ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js"; s.async = true;
    s.onload = () => (window.twttr && twttr.ready ? twttr.ready(resolve) : reject(new Error("no twttr")));
    s.onerror = () => { widgets = null; reject(new Error("X's embed script didn't load")); };
    document.head.appendChild(s);
  });
  return widgets;
}
const darkNow = () => document.documentElement.dataset.theme === "dark" ||
  (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

async function embedTweet(id, el) {
  el.innerHTML = `<p class="empty">Fetching from X…</p>`;
  try {
    await loadWidgets();
    const node = document.createElement("div");
    const made = await twttr.widgets.createTweet(id, node, { theme: darkNow() ? "dark" : "light", dnt: true, align: "center" });
    el.innerHTML = "";
    if (made) el.appendChild(node);
    else el.innerHTML = `<p class="empty">X wouldn't show that tweet. It may be deleted, private or age-restricted. <a href="https://x.com/i/status/${esc(id)}" target="_blank" rel="noopener">Open it on X</a></p>`;
  } catch (e) {
    el.innerHTML = `<p class="empty">${esc(e.message)}. A content blocker may be stopping it. <a href="https://x.com/i/status/${esc(id)}" target="_blank" rel="noopener">Open it on X</a></p>`;
  }
}
async function embedProfile(handle, el) {
  el.innerHTML = `<p class="empty">Fetching @${esc(handle)} from X…</p>`;
  const open = `<a href="https://x.com/${esc(handle)}" target="_blank" rel="noopener">Open @${esc(handle)} on X</a>`;
  try {
    await loadWidgets();
    const node = document.createElement("div");
    await twttr.widgets.createTimeline({ sourceType: "profile", screenName: handle }, node,
      { theme: darkNow() ? "dark" : "light", dnt: true, height: 640, chrome: "noheader nofooter" });
    el.innerHTML = `<p class="row"><span class="muted">X only shows profile timelines to people signed in to X in this browser.</span> ${open}</p>`;
    el.appendChild(node);
  } catch (e) {
    el.innerHTML = `<p class="empty">${esc(e.message)}. ${open}</p>`;
  }
}

// Accepts a tweet link (x.com, twitter.com, mobile., fxtwitter…), a bare tweet ID, or an @handle.
function parseLookup(q) {
  q = q.trim();
  const m = q.match(/(?:twitter|x|fxtwitter|vxtwitter|fixupx)\.com\/(?:#!\/)?(\w{1,15})\/status(?:es)?\/(\d+)/i);
  if (m) return { tweet: m[2], handle: m[1] };
  if (/^\d{6,25}$/.test(q)) return { tweet: q };
  const h = q.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter|x)\.com\/(\w{1,15})\/?$/i) || q.match(/^@?(\w{1,15})$/);
  if (h) return { handle: h[1] };
  return null;
}

// ---------- pieces ----------
function avatar(acc) {
  return `<div class="av" style="background:${esc(acc.color)}" aria-hidden="true">${esc(acc.mark)}</div>`;
}
function tweet(t) {
  const acc = ACCOUNTS[t.by];
  const fav = get("favs", []).includes(t.id);
  return `<li class="tw" data-id="${esc(t.id)}">${avatar(acc)}<div>
    <span class="who">${esc(acc.name)}</span><span class="handle">@${esc(t.by)}</span>${acc.note ? `<span class="ver">${esc(acc.note)}</span>` : ""}
    <p class="text">${linkify(t.text)}</p>
    <div class="meta"><span>${esc(t.when)} from iPhone 3G</span>
      <button type="button" data-reply="${esc(t.by)}">Reply</button>
      <button type="button" data-rt="${esc(t.id)}">Retweet</button>
      <button type="button" class="fav${fav ? " on" : ""}" data-fav="${esc(t.id)}" aria-pressed="${fav}">${fav ? "★ Favorited" : "☆ Favorite"}</button></div>
  </div></li>`;
}
function myTweet(p) {
  return `<li class="tw mine">${`<div class="av" aria-hidden="true"><img src="img/bird.svg" alt="" style="width:36px"></div>`}<div>
    <span class="who">You</span><span class="handle">@baller</span>
    <p class="text">${linkify(p.text)}</p>
    <div class="meta"><span>${ago(p.at)} from Bluebird${p.parts > 1 ? ` · sent as ${p.parts} parts` : ""}</span>
      <button type="button" data-again="${p.at}">Post again</button></div>
  </div></li>`;
}

function composeBox(text = "") {
  return `<form class="compose" id="compose">
    <label class="q" for="tw-text"><span>What's happening?</span><span class="counter inf" id="counter" title="Bluebird Variant: with no limits">∞</span></label>
    <textarea id="tw-text" maxlength="100000" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off"
      placeholder="Type with intention. There is no auto-correct.">${esc(text)}</textarea>
    <div class="row" style="justify-content:space-between">
      <span class="limits" id="limits">No limits. X has some, so long tweets go up as a thread.</span>
      <span class="row"><button class="btn" type="button" id="draft">Save draft</button><button class="btn primary" type="submit" id="post">Tweet</button></span>
    </div>
    <ul class="parts" id="parts" hidden></ul>
  </form>`;
}
function wireCompose() {
  const f = $("#compose"); if (!f) return;
  const ta = $("#tw-text"), lim = $("#limits"), partsEl = $("#parts");
  const update = () => {
    const n = len(ta.value.trim()), parts = split(ta.value);
    lim.textContent = !n ? "No limits. X has some, so long tweets go up as a thread."
      : parts.length > 1 ? `${n} characters. X would stop you at ${LIMIT}, so this goes up as ${parts.length} tweets.`
      : `${n} characters. Fits in one tweet.`;
    partsEl.hidden = true;
  };
  ta.addEventListener("input", update); update();
  $("#draft").onclick = () => {
    const text = ta.value.trim(); if (!text) return toast("Nothing to save. Mean something first.");
    set("drafts", [{ text, at: Date.now() }, ...get("drafts", [])].slice(0, 100));
    ta.value = ""; update(); counts(); toast("Saved to your Nest.");
  };
  f.onsubmit = e => {
    e.preventDefault();
    const text = ta.value.trim(), parts = split(text);
    if (!parts.length) return toast("Even \"baller\" must be typed with intention.");
    set("posted", [{ text, at: Date.now(), parts: parts.length }, ...get("posted", [])].slice(0, 200));
    if (parts.length === 1) {
      window.open(intent(parts[0]), "_blank", "noopener");
      ta.value = ""; update(); toast("Sent to X. Finish posting in the new tab."); counts();
      if (location.hash.startsWith("#/compose")) location.hash = "#/";
      else route();
      return;
    }
    partsEl.innerHTML = parts.map((p, i) => `<li><span class="n">${i + 1}/${parts.length}</span><p>${esc(p)}</p>
      <button class="btn small${i === 0 ? " primary" : ""}" type="button" data-part="${i}">Post</button></li>`).join("");
    partsEl.hidden = false;
    lim.textContent = `X has limits. Post these ${parts.length} in order; after the first, reply to yourself on X to keep the thread together.`;
    partsEl.onclick = ev => {
      const b = ev.target.closest("[data-part]"); if (!b) return;
      window.open(intent(parts[+b.dataset.part]), "_blank", "noopener");
      b.textContent = "Posted"; b.classList.remove("primary");
      const next = partsEl.querySelector(`[data-part="${+b.dataset.part + 1}"]`);
      if (next) next.classList.add("primary");
    };
  };
}

// Timeline buttons: reply, retweet (the 2009 way: RT @handle), favorite (a star, not a heart).
view.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.reply) return openCompose(`@${b.dataset.reply} `);
  if (b.dataset.rt) { const t = CANON.find(x => x.id === b.dataset.rt); return openCompose(`RT @${t.by}: ${t.text}`); }
  if (b.dataset.again) { const p = get("posted", []).find(x => String(x.at) === b.dataset.again); return p && openCompose(p.text); }
  if (b.dataset.fav) {
    const id = b.dataset.fav, favs = get("favs", []), on = !favs.includes(id);
    set("favs", on ? [...favs, id] : favs.filter(x => x !== id));
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "★ Favorited" : "☆ Favorite";
    counts();
  }
});
function openCompose(text) {
  const ta = $("#tw-text");
  if (ta) { ta.value = text; ta.dispatchEvent(new Event("input")); ta.focus(); ta.setSelectionRange(text.length, text.length); scrollTo({ top: 0, behavior: "smooth" }); }
  else location.hash = "#/compose/" + encodeURIComponent(text);
}

// ---------- pages ----------
function home() {
  const tab = get("homeTab", "canon"), posted = get("posted", []);
  view.innerHTML = composeBox() + `<div class="tabs" role="tablist">
      <button type="button" data-tab="canon" class="${tab === "canon" ? "on" : ""}">The Canon</button>
      <button type="button" data-tab="mine" class="${tab === "mine" ? "on" : ""}">Your tweets${posted.length ? ` (${posted.length})` : ""}</button></div>
    <ul class="timeline">${tab === "canon" ? CANON.map(tweet).join("")
      : posted.length ? posted.map(myTweet).join("") : `<li class="empty">Nothing yet. What's happening?</li>`}</ul>`;
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { set("homeTab", b.dataset.tab); home(); });
  wireCompose();
}

function compose(text) {
  view.innerHTML = `<h1>Tweet</h1><p class="sub">From your iPhone 3G, with no limits.</p>` + composeBox(text);
  wireCompose();
  const ta = $("#tw-text"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}

function lookup(q = "") {
  view.innerHTML = `<h1>Look up</h1><p class="sub">Paste a link to a tweet (x.com or twitter.com), or an @handle.</p>
    <form class="field" id="lk"><input id="lk-q" type="search" placeholder="https://x.com/… or @handle" value="${esc(q)}" autocomplete="off" spellcheck="false" aria-label="Tweet link or handle">
    <button class="btn primary" type="submit">Look up</button></form>
    <div class="embed" id="embed"></div>`;
  const run = () => {
    const raw = $("#lk-q").value, p = parseLookup(raw), out = $("#embed");
    if (!raw.trim()) { out.innerHTML = ""; return; }
    if (!p) { out.innerHTML = `<p class="empty">That isn't a tweet link or a handle.</p>`; return; }
    if (location.hash !== "#/lookup/" + encodeURIComponent(raw.trim())) history.replaceState(null, "", "#/lookup/" + encodeURIComponent(raw.trim()));
    if (p.tweet) {
      out.innerHTML = `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn small" type="button" id="save">☆ Save to Nest</button></div><div id="tw-embed"></div>`;
      const saved = get("saved", []);
      const sb = $("#save");
      if (saved.some(s => s.id === p.tweet)) { sb.textContent = "★ Saved"; sb.disabled = true; }
      sb.onclick = () => { set("saved", [{ id: p.tweet, handle: p.handle || "", at: Date.now() }, ...get("saved", [])]); sb.textContent = "★ Saved"; sb.disabled = true; counts(); };
      embedTweet(p.tweet, $("#tw-embed"));
    } else embedProfile(p.handle, out);
  };
  $("#lk").onsubmit = e => { e.preventDefault(); run(); };
  if (q) run(); else $("#lk-q").focus();
}

function nest() {
  const tab = get("nestTab", "favs");
  const favs = CANON.filter(t => get("favs", []).includes(t.id)), saved = get("saved", []), drafts = get("drafts", []);
  let body;
  if (tab === "favs") body = favs.length ? `<ul class="timeline">${favs.map(tweet).join("")}</ul>` : `<p class="empty">No favorites yet. Star something in The Canon.</p>`;
  else if (tab === "saved") body = saved.length ? `<ul class="timeline">${saved.map(s => `<li class="tw"><div class="av" style="background:#1d9bf0" aria-hidden="true">★</div><div>
      <p class="text"><a href="#/lookup/${encodeURIComponent(`https://x.com/${s.handle || "i"}/status/${s.id}`)}">${s.handle ? "@" + esc(s.handle) + "'s tweet" : "A tweet"}</a></p>
      <div class="meta"><span>saved ${ago(s.at)}</span><a href="https://x.com/${esc(s.handle || "i")}/status/${esc(s.id)}" target="_blank" rel="noopener">Open on X</a>
      <button type="button" data-unsave="${esc(s.id)}">Remove</button></div></div></li>`).join("")}</ul>`
    : `<p class="empty">Nothing saved. Look up a tweet and save it here.</p>`;
  else body = drafts.length ? `<ul class="timeline">${drafts.map((d, i) => `<li class="tw mine"><div class="av" aria-hidden="true"><img src="img/bird.svg" alt="" style="width:36px"></div><div>
      <p class="text">${linkify(d.text)}</p><div class="meta"><span>draft · ${ago(d.at)} · ${len(d.text)} characters</span>
      <button type="button" data-edit="${i}">Edit</button><button type="button" data-deldraft="${i}">Delete</button></div></div></li>`).join("")}</ul>`
    : `<p class="empty">No drafts.</p>`;
  view.innerHTML = `<h1>Nest</h1><p class="sub">Kept on this iPhone 3G only. Never synced, never updated.</p>
    <div class="tabs" role="tablist">
      <button type="button" data-t="favs" class="${tab === "favs" ? "on" : ""}">Favorites (${favs.length})</button>
      <button type="button" data-t="saved" class="${tab === "saved" ? "on" : ""}">Saved (${saved.length})</button>
      <button type="button" data-t="drafts" class="${tab === "drafts" ? "on" : ""}">Drafts (${drafts.length})</button></div>${body}`;
  view.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { set("nestTab", b.dataset.t); nest(); });
  view.querySelectorAll("[data-unsave]").forEach(b => b.onclick = () => { set("saved", get("saved", []).filter(s => s.id !== b.dataset.unsave)); counts(); nest(); });
  view.querySelectorAll("[data-deldraft]").forEach(b => b.onclick = () => { const d = get("drafts", []); d.splice(+b.dataset.deldraft, 1); set("drafts", d); counts(); nest(); });
  view.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    const d = get("drafts", []), [it] = d.splice(+b.dataset.edit, 1); set("drafts", d); counts();
    location.hash = "#/compose/" + encodeURIComponent(it.text);
  });
}

function settingsPage() {
  const theme = get("theme", "auto"), intro = get("intro", "session");
  const seg = (name, val, opts) => `<span class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === val ? "on" : ""}">${l}</button>`).join("")}</span>`;
  view.innerHTML = `<h1>Settings</h1><p class="sub">Full access, as the Prophecy requires.</p><div class="settings">
    <section><h3>Theme</h3><p>Day sky or night sky.</p>${seg("theme", theme, [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]])}</section>
    <section><h3>Intro</h3><p>Watch the X come down when Bluebird opens.</p>${seg("intro", intro, [["always", "Every time"], ["session", "Once per visit"], ["never", "Never"]])}
      <div class="row" style="margin-top:8px"><button class="btn small" type="button" id="replay">Play it now</button></div></section>
    <section><h3>Firmware</h3><p>Siri 3G advises against it.</p><button type="button" class="lock" id="fw" style="background:none;border:0;padding:0"><span class="sw"></span>Never update</button></section>
    <section><h3>Auto-Correct</h3><p>You are forced to mean what you say.</p><button type="button" class="lock" id="ac" style="background:none;border:0;padding:0"><span class="sw off"></span>Off</button></section>
    <section><h3>Network</h3><p>3G, connected to God's router. 4G is for the weak, and 5G awakens Elon Mush's dormant twin.</p></section>
    <section><h3>Your data</h3><p>Favorites, drafts, saved tweets and your tweet history live only in this browser. Bluebird has no server and never sees your X account; posting happens on X itself.</p>
      <button class="btn" type="button" id="wipe">Clear everything</button></section>
    <section><h3>About</h3><p>Twitter: Bluebird Variant (with no limits), the Sacred App from <a href="https://lsamman.github.io/legend-of-chris-wiki/twitter.html">The Legend Of Chris</a>. Made by Will. Not affiliated with X.</p></section>
  </div>`;
  view.querySelectorAll("[data-seg]").forEach(s => s.onclick = e => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    set(s.dataset.seg, b.dataset.v);
    if (s.dataset.seg === "theme") applyTheme();
    settingsPage();
  });
  $("#replay").onclick = () => boot(true);
  $("#fw").onclick = () => toast("Siri 3G: \"never update\"");
  $("#ac").onclick = () => toast("Even \"baller\" must be typed with intention.");
  $("#wipe").onclick = () => {
    if (!confirm("Clear your favorites, drafts, saved tweets and history?")) return;
    ["favs", "drafts", "saved", "posted"].forEach(k => set(k, []));
    counts(); toast("Cleared.");
  };
}

function applyTheme() {
  const t = get("theme", "auto");
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

// ---------- chrome ----------
function counts() {
  $("#n-posts").textContent = get("drafts", []).length;
  $("#n-favs").textContent = get("favs", []).length + get("saved", []).length;
}
$("#trends").innerHTML = TRENDS.map(t => `<li><a href="#/compose/${encodeURIComponent(t + " ")}">${esc(t)}</a></li>`).join("");
function tick() {
  $("#clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
tick(); setInterval(tick, 15000);

// ---------- boot: the X comes down ----------
function boot(force) {
  const mode = get("intro", "session");
  let seen = false;
  try { seen = sessionStorage.getItem(PREFIX + "booted") === "1"; sessionStorage.setItem(PREFIX + "booted", "1"); } catch (e) {}
  if (!force && (mode === "never" || (mode === "session" && seen))) return;
  const el = $("#boot"), line = $("#boot-line");
  const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.className = "boot"; el.hidden = false; line.textContent = BOOT_LINES[0];
  const timers = [];
  const done = () => { timers.forEach(clearTimeout); el.classList.add("out"); setTimeout(() => { el.hidden = true; }, 500); };
  el.onclick = done;
  el.onkeydown = e => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") done(); };
  el.focus();
  const step = fast ? 350 : 900;
  BOOT_LINES.slice(1).forEach((l, i) => timers.push(setTimeout(() => {
    line.textContent = l;
    if (i === 1) el.classList.add("shatter", "sky");
  }, step * (i + 1))));
  timers.push(setTimeout(done, step * (BOOT_LINES.length + 0.8)));
}

// ---------- routing ----------
function route() {
  const [, page = "", ...rest] = location.hash.split("/");
  const arg = decodeURIComponent(rest.join("/"));
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === (page || "home")));
  if (page === "compose") compose(arg);
  else if (page === "lookup") lookup(arg);
  else if (page === "nest") nest();
  else if (page === "settings") settingsPage();
  else home();
  view.focus({ preventScroll: true });
  scrollTo(0, 0);
}
addEventListener("hashchange", route);
applyTheme(); counts(); route(); boot();
