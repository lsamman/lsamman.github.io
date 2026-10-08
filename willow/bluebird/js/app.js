// Twitter: Bluebird Variant (with no limits). An X client from before the X, named for the Sacred App
// from The Legend Of Chris. No character limit, no auto-correct, never update.
// X's API isn't open to a plain web page, so Bluebird posts through X's own share page (one tab per part),
// shows real tweets and the accounts you follow through X's embeds, and keeps favorites, drafts and saved
// tweets on this device. Alongside them, the Timeline fills up through the day with tweets from the book's characters (feed.js).
import { ACCOUNTS, CANON, TRENDS, BOOT_LINES } from "./canon.js?v=20261008185704";
import { timeline, byId } from "./feed.js?v=20261008185704";

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
    .replace(/(^|\s)@(\w{1,15})/g, (m, sp, h) => ACCOUNTS[h] ? `${sp}<b class="lore">@${h}</b>` : `${sp}<a href="https://x.com/${h}" target="_blank" rel="noopener">@${h}</a>`)
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
// Tweetie-style times for the timeline: "now", "5m", "3h", then the date.
function short(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.round(s / 60) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
    el.innerHTML = `<p class="note-line" style="margin-bottom:10px">X only shows profile timelines to people signed in to X in this browser. ${open}</p>`;
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

// ---------- chrome: the navigation bar ----------
const PENCIL = `<svg viewBox="0 0 24 24"><path d="M4 17.2V21h3.8L19 9.8 15.2 6zM21 7.8a1 1 0 0 0 0-1.4L18.6 4a1 1 0 0 0-1.4 0l-1.6 1.6 3.8 3.8z"/></svg>`;
const NEW = `<a class="barbtn" href="#/compose" aria-label="New tweet" title="New tweet">${PENCIL}</a>`;
function bar(title, left = "", right = NEW) {
  $("#nav-title").innerHTML = title;
  $("#nb-left").innerHTML = left;
  $("#nb-right").innerHTML = right;
}
const segbar = (key, val, opts) => `<div class="toolbar"><div class="segbar" role="tablist">${opts.map(([k, l]) =>
  `<button type="button" role="tab" data-${key}="${k}" class="${k === val ? "on" : ""}" aria-selected="${k === val}">${l}</button>`).join("")}</div></div>`;

// ---------- pieces ----------
function avatar(acc) {
  return `<div class="av" style="background:${esc(acc.color)}" aria-hidden="true">${esc(acc.mark)}</div>`;
}
function tweet(t) {
  const acc = ACCOUNTS[t.by];
  const fav = get("favs", []).includes(t.id);
  return `<li class="tw" data-id="${esc(t.id)}">${avatar(acc)}<div>
    <div class="top"><span class="who">${esc(acc.name)}</span><span class="handle">@${esc(t.by)}</span><span class="time">${t.at ? short(t.at) : ""}</span></div>
    ${acc.note ? `<span class="note">${esc(acc.note)}</span>` : ""}
    <p class="text">${linkify(t.text)}</p>
    <div class="acts"><span>${t.at ? "" : esc(t.when) + " · "}from ${esc(t.client || "iPhone 3G")}</span>
      <button type="button" data-reply="${esc(t.id)}">Reply</button>
      <button type="button" data-rt="${esc(t.id)}">Retweet</button>
      <button type="button" class="fav${fav ? " on" : ""}" data-fav="${esc(t.id)}" aria-pressed="${fav}">${fav ? "★ Favorite" : "☆ Favorite"}</button></div>
  </div></li>`;
}
const find = id => CANON.find(t => t.id === id) || byId(id);
const MY_AV = `<div class="av" aria-hidden="true"><img src="img/bird.svg" alt=""></div>`;
function myTweet(p) {
  return `<li class="tw mine">${MY_AV}<div>
    <div class="top"><span class="who">You</span><span class="handle">@baller</span><span class="time">${short(p.at)}</span></div>
    <p class="text">${linkify(p.text)}</p>
    <div class="acts"><span>from Bluebird${p.parts > 1 ? ` · ${p.parts} parts` : ""}</span><button type="button" data-again="${p.at}">Post again</button></div>
  </div></li>`;
}

// Timeline buttons: reply, retweet (the 2009 way: RT), favorite (a star, not a heart).
// Replies and retweets name the character rather than @-mention whoever owns that handle on X.
view.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.reply) { const t = find(b.dataset.reply); return t && openCompose(`${ACCOUNTS[t.by].name}, `); }
  if (b.dataset.rt) { const t = find(b.dataset.rt); return t && openCompose(`RT ${ACCOUNTS[t.by].name}: ${t.text}`); }
  if (b.dataset.again) { const p = get("posted", []).find(x => String(x.at) === b.dataset.again); return p && openCompose(p.text); }
  if (b.dataset.fav) {
    const id = b.dataset.fav, favs = get("favs", []), on = !favs.includes(id);
    set("favs", on ? [...favs, id] : favs.filter(x => x !== id));
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? "★ Favorite" : "☆ Favorite";
  }
});
const openCompose = text => { location.hash = "#/compose/" + encodeURIComponent(text); };

// ---------- Timeline ----------
let shown = null;   // ids on screen in the Timeline, so new ones wait behind the "new tweets" bar
const TITLE = document.title;
function home() {
  const tab = get("homeTab", "timeline"), posted = get("posted", []);
  const names = { timeline: "Timeline", following: "Following", canon: "The Canon", mine: "Your Tweets" };
  bar(tab === "timeline" ? `<img src="img/bird.svg" alt="">Bluebird` : names[tab]);
  view.innerHTML = segbar("tab", tab, [["timeline", "Timeline"], ["following", "Following"], ["canon", "Canon"], ["mine", "Mine"]]) +
    `<button type="button" class="newbar" id="newbar" hidden></button><div class="scroll" id="tab-body"></div>`;
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { set("homeTab", b.dataset.tab); home(); });
  $("#newbar").onclick = showTimeline;
  shown = null; document.title = TITLE;
  const body = $("#tab-body");
  if (tab === "timeline") showTimeline();
  else if (tab === "following") following(body);
  else if (tab === "canon") body.innerHTML = `<p class="note-line" style="margin-bottom:10px">Quoted from The Legend Of Chris.</p><ul class="cells">${CANON.map(tweet).join("")}</ul>`;
  else body.innerHTML = posted.length ? `<ul class="cells">${posted.map(myTweet).join("")}</ul>` : `<p class="empty">Nothing yet. Tap ✎ to tweet.</p>`;
}
function showTimeline() {
  const list = timeline();
  shown = new Set(list.map(t => t.id));
  $("#tab-body").innerHTML = `<ul class="cells">${list.map(tweet).join("")}</ul>`;
  $("#tab-body").scrollTop = 0;
  $("#newbar").hidden = true; document.title = TITLE;
}
// Every 20 seconds, see whether a character has tweeted since the Timeline was drawn.
setInterval(() => {
  if (!shown || !$("#newbar")) return;
  const n = timeline().filter(t => !shown.has(t.id)).length;
  if (!n) return;
  const nb = $("#newbar");
  nb.textContent = `${n} new tweet${n === 1 ? "" : "s"}`; nb.hidden = false;
  document.title = `(${n}) ${TITLE}`;
}, 20000);

// Following: real X accounts. Tap one to see its posts through X's embed.
const followed = () => get("following", []);
const isFollowed = h => followed().some(x => x.toLowerCase() === h.toLowerCase());
function follow(handle, on) {
  const list = followed().filter(h => h.toLowerCase() !== handle.toLowerCase());
  set("following", on ? [handle, ...list] : list);
}
function following(el) {
  const list = followed();
  el.innerHTML = `<div class="group"><h3>Follow an account on X</h3>
      <form class="table" id="fl"><div class="row"><input id="fl-q" class="grow" type="text" placeholder="@handle" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="X account to follow">
      <button class="btn blue" type="submit">Follow</button></div></form></div>
    <div class="group"><h3>Following</h3>
      ${list.length ? `<div class="table">${list.map(h => `<div class="row"><a class="grow" href="#/lookup/${encodeURIComponent("@" + h)}"><b>@${esc(h)}</b><span class="sub">Latest posts on X</span></a>
        <button type="button" class="x" data-unfollow="${esc(h)}" aria-label="Unfollow @${esc(h)}" title="Unfollow">−</button></div>`).join("")}</div>`
        : `<p class="empty" style="padding:12px">You're not following anyone yet.</p>`}
      <p class="foot">X shows their posts when you're signed in to X in this browser.</p></div>`;
  $("#fl").onsubmit = e => {
    e.preventDefault();
    const p = parseLookup($("#fl-q").value);
    if (!p || !p.handle) return toast("That isn't an @handle.");
    follow(p.handle, true); toast(`Following @${p.handle}`); following(el);
  };
  el.querySelectorAll("[data-unfollow]").forEach(b => b.onclick = () => { follow(b.dataset.unfollow, false); following(el); });
}

// ---------- New Tweet ----------
function compose(text) {
  bar("New Tweet", `<a class="barbtn" href="#/">Cancel</a>`, `<button class="barbtn done" type="button" id="send">Send</button>`);
  view.innerHTML = `<div class="compose">
    <div class="to"><span>@baller · iPhone 3G · no auto-correct</span><span class="counter" title="Bluebird Variant: with no limits">∞</span></div>
    <textarea id="tw-text" maxlength="100000" spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off"
      placeholder="What's happening? Type with intention." aria-label="Tweet">${esc(text)}</textarea>
    <ul class="parts" id="parts" hidden></ul>
    <div class="tools"><span class="limits" id="limits"></span><button class="barbtn" type="button" id="draft">Save Draft</button></div>
  </div>`;
  const ta = $("#tw-text"), lim = $("#limits"), partsEl = $("#parts");
  const update = () => {
    const n = len(ta.value.trim()), parts = split(ta.value);
    lim.textContent = !n ? "No limits. X has some, so long tweets go up as a thread."
      : parts.length > 1 ? `${n} characters. X stops at ${LIMIT}, so this goes up as ${parts.length} tweets.`
      : `${n} characters.`;
    partsEl.hidden = true;
  };
  ta.addEventListener("input", update); update();
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  $("#draft").onclick = () => {
    const t = ta.value.trim(); if (!t) return toast("Nothing to save. Mean something first.");
    set("drafts", [{ text: t, at: Date.now() }, ...get("drafts", [])].slice(0, 100));
    ta.value = ""; update(); toast("Saved to Drafts");
  };
  $("#send").onclick = () => {
    const t = ta.value.trim(), parts = split(t);
    if (!parts.length) return toast("Even \"baller\" must be typed with intention.");
    set("posted", [{ text: t, at: Date.now(), parts: parts.length }, ...get("posted", [])].slice(0, 200));
    if (parts.length === 1) {
      window.open(intent(parts[0]), "_blank", "noopener");
      ta.value = ""; toast("Sent to X. Finish posting in the new tab.");
      location.hash = "#/";
      return;
    }
    partsEl.innerHTML = parts.map((p, i) => `<li><span class="n">${i + 1}/${parts.length}</span><p>${esc(p)}</p>
      <button class="barbtn${i === 0 ? " done" : ""}" type="button" data-part="${i}">Post</button></li>`).join("");
    partsEl.hidden = false;
    lim.textContent = `Post these ${parts.length} in order. On X, reply to yourself to keep the thread together.`;
    partsEl.onclick = ev => {
      const b = ev.target.closest("[data-part]"); if (!b) return;
      window.open(intent(parts[+b.dataset.part]), "_blank", "noopener");
      b.textContent = "Posted"; b.classList.remove("done");
      const next = partsEl.querySelector(`[data-part="${+b.dataset.part + 1}"]`);
      if (next) next.classList.add("done");
    };
  };
}

// ---------- Look up ----------
const MAG = `<svg viewBox="0 0 30 30"><path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 3.2a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6zM18.5 19.7l2.3-2.3 6.4 6.4-2.3 2.3z"/></svg>`;
function lookup(q = "") {
  bar("Look up");
  view.innerHTML = `<div class="toolbar"><form id="lk"><label class="searchfield">${MAG}<input id="lk-q" type="search" placeholder="Tweet link or @handle" value="${esc(q)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Tweet link or handle"></label>
    <button class="barbtn" type="submit">Search</button></form></div><div class="scroll" id="lk-body"></div>`;
  const out = $("#lk-body");
  const idle = () => {
    const list = followed();
    out.innerHTML = `<div class="group"><h3>Trending Topics</h3><div class="table">${TRENDS.map(t =>
        `<a class="row go" href="#/compose/${encodeURIComponent(t + " ")}"><b>${esc(t)}</b></a>`).join("")}</div>
      <p class="foot">Tap a topic to tweet about it.</p></div>` +
      (list.length ? `<div class="group"><h3>Following</h3><div class="table">${list.map(h =>
        `<a class="row go" href="#/lookup/${encodeURIComponent("@" + h)}"><b>@${esc(h)}</b></a>`).join("")}</div></div>` : "") +
      `<p class="note-line" style="margin-bottom:14px">Paste a link to a tweet (x.com or twitter.com) or type an @handle.</p>`;
  };
  const run = () => {
    const raw = $("#lk-q").value.trim(), p = parseLookup(raw);
    if (!raw) return idle();
    if (!p) { out.innerHTML = `<p class="empty">That isn't a tweet link or an @handle.</p>`; return; }
    if (location.hash !== "#/lookup/" + encodeURIComponent(raw)) history.replaceState(null, "", "#/lookup/" + encodeURIComponent(raw));
    if (p.tweet) {
      const saved = get("saved", []).some(s => s.id === p.tweet);
      out.innerHTML = `<div class="embed"><div class="actions"><button class="btn${saved ? "" : " blue"}" type="button" id="save"${saved ? " disabled" : ""}>${saved ? "★ Saved" : "☆ Save to Nest"}</button></div><div id="tw-embed"></div></div>`;
      $("#save").onclick = () => { set("saved", [{ id: p.tweet, handle: p.handle || "", at: Date.now() }, ...get("saved", [])]); $("#save").textContent = "★ Saved"; $("#save").disabled = true; $("#save").classList.remove("blue"); };
      embedTweet(p.tweet, $("#tw-embed"));
    } else {
      const label = () => isFollowed(p.handle) ? "Following ✓" : "Follow @" + p.handle;
      out.innerHTML = `<div class="embed"><div class="actions"><button class="btn${isFollowed(p.handle) ? "" : " blue"}" type="button" id="fol">${esc(label())}</button></div><div id="p-embed"></div></div>`;
      $("#fol").onclick = () => {
        const now = !isFollowed(p.handle);
        follow(p.handle, now); toast(now ? `Following @${p.handle}` : `Unfollowed @${p.handle}`);
        $("#fol").textContent = label(); $("#fol").classList.toggle("blue", !now);
      };
      embedProfile(p.handle, $("#p-embed"));
    }
  };
  $("#lk").onsubmit = e => { e.preventDefault(); $("#lk-q").blur(); run(); };
  run();
}

// ---------- Nest ----------
function nest() {
  const tab = get("nestTab", "favs");
  const favs = get("favs", []).map(find).filter(Boolean), saved = get("saved", []), drafts = get("drafts", []);
  bar("Nest");
  let body;
  if (tab === "favs") body = favs.length ? `<ul class="cells">${favs.map(tweet).join("")}</ul>` : `<p class="empty">No favorites yet. Tap ☆ on a tweet.</p>`;
  else if (tab === "saved") body = saved.length ? `<div class="group"><div class="table">${saved.map(s => `<div class="row">
      <a class="grow" href="#/lookup/${encodeURIComponent(`https://x.com/${s.handle || "i"}/status/${s.id}`)}"><b>${s.handle ? "@" + esc(s.handle) : "A tweet"}</b><span class="sub">Saved ${ago(s.at)}</span></a>
      <button type="button" class="x" data-unsave="${esc(s.id)}" aria-label="Remove" title="Remove">−</button></div>`).join("")}</div></div>`
    : `<p class="empty">Nothing saved. Look up a tweet and save it here.</p>`;
  else body = drafts.length ? `<ul class="cells">${drafts.map((d, i) => `<li class="tw mine">${MY_AV}<div>
      <div class="top"><span class="who">Draft</span><span class="time">${short(d.at)}</span></div>
      <p class="text">${linkify(d.text)}</p><div class="acts"><span>${len(d.text)} characters</span>
      <button type="button" data-edit="${i}">Edit</button><button type="button" data-deldraft="${i}">Delete</button></div></div></li>`).join("")}</ul>`
    : `<p class="empty">No drafts.</p>`;
  view.innerHTML = segbar("t", tab, [["favs", "Favorites"], ["saved", "Saved"], ["drafts", "Drafts"]]) + `<div class="scroll">
    <div class="me"><img src="img/bird.svg" alt=""><div><b>You</b><span>@baller · not verified</span></div></div>
    <div class="stats"><div><b>${favs.length}</b><span>favorites</span></div><div><b>${saved.length}</b><span>saved</span></div><div><b>${drafts.length}</b><span>drafts</span></div><div><b>97</b><span>followers</span></div></div>
    <p class="note-line" style="margin-bottom:10px">Kept on this iPhone 3G only. Never synced, never updated.</p>${body}</div>`;
  view.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { set("nestTab", b.dataset.t); nest(); });
  view.querySelectorAll("[data-unsave]").forEach(b => b.onclick = () => { set("saved", get("saved", []).filter(s => s.id !== b.dataset.unsave)); nest(); });
  view.querySelectorAll("[data-deldraft]").forEach(b => b.onclick = () => { const d = get("drafts", []); d.splice(+b.dataset.deldraft, 1); set("drafts", d); nest(); });
  view.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    const d = get("drafts", []), [it] = d.splice(+b.dataset.edit, 1); set("drafts", d);
    openCompose(it.text);
  });
}

// ---------- Settings, iPhone OS style ----------
function settingsPage() {
  const theme = get("theme", "auto"), intro = get("intro", "session");
  const seg = (name, val, opts) => `<span class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === val ? "on" : ""}">${l}</button>`).join("")}</span>`;
  bar("Settings", "", "");
  view.innerHTML = `<div class="scroll">
    <div class="group"><h3>Display</h3><div class="table">
      <div class="row"><b>Theme</b>${seg("theme", theme, [["auto", "Auto"], ["light", "Day"], ["dark", "Night"]])}</div></div></div>
    <div class="group"><h3>Intro</h3><div class="table">
      <div class="row"><b>Play</b>${seg("intro", intro, [["always", "Always"], ["session", "Once a visit"], ["never", "Never"]])}</div>
      <button type="button" class="row go" id="replay"><b>Watch the X come down</b></button></div></div>
    <div class="group"><h3>General</h3><div class="table">
      <button type="button" class="row go" id="fw"><b>Software Update</b><span class="val">Never</span></button>
      <button type="button" class="row" id="ac"><b>Auto-Correct</b><span class="switch">OFF</span></button>
      <div class="row"><b>Network</b><span class="val">3G · God's router</span></div>
      <div class="row"><b>Front Camera</b><span class="val">None</span></div></div>
      <p class="foot">4G is for the weak, and 5G awakens Elon Mush's dormant twin.</p></div>
    <div class="group"><h3>Your Data</h3>
      <button type="button" class="danger" id="wipe">Clear Everything</button>
      <p class="foot">Favorites, drafts, saved tweets, follows and your tweet history live only in this browser. Bluebird has no server and never sees your X account. Posting happens on X itself.</p></div>
    <div class="group"><h3>About</h3><div class="table">
      <div class="row"><b>Name</b><span class="val">Bluebird Variant</span></div>
      <div class="row"><b>Limits</b><span class="val">None</span></div>
      <div class="row"><b>Made by</b><span class="val">Will</span></div>
      <a class="row go" href="https://lsamman.github.io/legend-of-chris-wiki/twitter.html" target="_blank" rel="noopener"><b>The Legend Of Chris</b></a></div>
      <p class="foot">The Sacred App, as named by Steve Jobs at the iPhone 3G Keynote. Not affiliated with X.</p></div>
  </div>`;
  view.querySelectorAll("[data-seg]").forEach(s => s.onclick = e => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    set(s.dataset.seg, b.dataset.v);
    if (s.dataset.seg === "theme") applyTheme();
    s.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  });
  $("#replay").onclick = () => boot(true);
  $("#fw").onclick = () => toast("Siri 3G: \"never update\"");
  $("#ac").onclick = () => toast("You are forced to mean what you say.");
  $("#wipe").onclick = () => {
    if (!confirm("Clear your favorites, drafts, saved tweets, follows and history?")) return;
    ["favs", "drafts", "saved", "posted", "following"].forEach(k => set(k, []));
    toast("Cleared");
  };
}

function applyTheme() {
  const t = get("theme", "auto");
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

// ---------- status bar clock ----------
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
  const tabFor = { compose: "", lookup: "lookup", nest: "nest", settings: "settings" };
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === (page in tabFor ? tabFor[page] : "home")));
  shown = null;
  if (page === "compose") compose(arg);
  else if (page === "lookup") lookup(arg);
  else if (page === "nest") nest();
  else if (page === "settings") settingsPage();
  else home();
  if (page !== "compose") view.focus({ preventScroll: true });
}
addEventListener("hashchange", route);
applyTheme(); route(); boot();
