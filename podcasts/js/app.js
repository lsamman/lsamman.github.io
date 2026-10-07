// Apple Podcasts 2. The Sacred App from The Legend Of Chris, which only the iPhone 3G can run.
// Apple Podcasts 1 was the first church of Chris, until the Tech Bros deprecated it. This one is a real podcast player:
// search Apple's directory, subscribe, and listen, with no account and no server. Everything you do stays in this browser.
import { get, set, esc, htmlToText, textToHtml, clock, length, date, art } from "./util.js?v=20261007172844";
import * as itunes from "./itunes.js?v=20261007172844";
import * as player from "./player.js?v=20261007172844";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $("#view");
const episodes = new Map();          // every episode on screen, by id, for the buttons
let renderToken = 0;

// ---------- subscriptions (the Congregation) ----------
const subs = () => get("subs", []);
const isSub = id => subs().some(s => s.id === id);
function subscribe(pod, eps) {
  const list = subs().filter(s => s.id !== pod.id);
  // The newest episode counts as new, like a welcome. Anything older is history.
  const newest = eps && eps[0] && Date.parse(eps[0].date);
  list.push({ id: pod.id, name: pod.name, artist: pod.artist, art: pod.art, genre: pod.genre, added: Date.now(), seen: newest ? newest - 1 : Date.now() });
  list.sort((a, b) => a.name.localeCompare(b.name));
  set("subs", list);
  if (eps) saveFeed(pod.id, eps);
  toast(`${pod.name} joined your Congregation.`);
  drawSidebar();
}
function unsubscribe(id) {
  const s = subs().find(x => x.id === id);
  set("subs", subs().filter(x => x.id !== id));
  const f = get("feeds", {}); delete f[id]; set("feeds", f);
  if (s) toast(`${s.name} left your Congregation.`);
  drawSidebar();
}
function markSeen(id) {
  const list = subs(), s = list.find(x => x.id === id);
  if (s) { s.seen = Date.now(); set("subs", list); }
}
// The latest few episodes of each subscription, kept so Home can show what's new straight away.
function saveFeed(id, eps) {
  const f = get("feeds", {});
  f[id] = { at: Date.now(), eps: eps.slice(0, 8).map(e => ({ ...e, desc: htmlToText(e.desc).slice(0, 400) })) };
  set("feeds", f);
}
function newEpisodes() {
  const f = get("feeds", {}), out = [];
  for (const s of subs()) {
    for (const e of (f[s.id] && f[s.id].eps) || []) {
      if (Date.parse(e.date) > (s.seen || s.added) && !player.isPlayed(e.id) && !player.progress(e.id)) out.push(e);
    }
  }
  return out.sort((a, b) => (b.date > a.date ? 1 : -1));
}
let refreshing = null;
function refreshSubs(force) {
  if (refreshing) return refreshing;
  const f = get("feeds", {});
  const due = subs().filter(s => force || !f[s.id] || Date.now() - f[s.id].at > 20 * 60 * 1000);
  if (!due.length) return Promise.resolve(false);
  status("Checking your Congregation for new episodes…");
  let i = 0;
  const worker = async () => {
    while (i < due.length) {
      const s = due[i++];
      try { const { episodes: eps } = await itunes.lookup(s.id, { fresh: force }); saveFeed(s.id, eps); } catch (e) {}
    }
  };
  refreshing = Promise.all([worker(), worker(), worker()]).then(() => { refreshing = null; drawSidebar(); return true; });
  return refreshing;
}

// ---------- little UI helpers ----------
function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
}
let statusText = "";
function status(text) { statusText = text; $("#status").textContent = text; }
const loading = (text = "Spreading the word…") => `<div class="loading"><span class="spinner"></span>${esc(text)}</div>`;
const problem = (text, retry = true) => `<div class="empty"><p>${esc(text)}</p>${retry ? `<button class="pill" data-act="retry">Try again</button>` : ""}</div>`;
function setTitle(t) { $("#title").textContent = t; document.title = t === "Home" ? "Apple Podcasts 2" : `${t} · Apple Podcasts 2`; }

const card = (p, rank) => `
  <a class="card" href="#/podcast/${esc(p.id)}" title="${esc(p.name)}">
    <span class="art">${rank ? `<i class="rank">${rank}</i>` : ""}<img loading="lazy" src="${esc(art(p.art, 300))}" alt=""></span>
    <b>${esc(p.name)}</b><small>${esc(p.artist)}</small>
  </a>`;
const grid = list => `<div class="grid">${list.map(p => card(p)).join("")}</div>`;

function epRow(ep, { showShow = false, isNew = false } = {}) {
  episodes.set(ep.id, ep);
  const prog = player.progress(ep.id), played = player.isPlayed(ep.id);
  const left = prog > 0 && prog < 1 && ep.ms ? `${length(ep.ms * (1 - prog)) || "1 min"} left` : length(ep.ms);
  const desc = htmlToText(ep.desc);
  return `
  <li class="ep${played ? " played" : ""}" data-id="${esc(ep.id)}">
    <span class="dot ${played ? "" : prog > 0 ? "half" : "full"}" title="${played ? "Played" : prog > 0 ? "In progress" : "Unplayed"}"></span>
    ${showShow ? `<a class="ep-art" href="#/podcast/${esc(ep.pid)}"><img loading="lazy" src="${esc(art(ep.art, 100))}" alt=""></a>` : ""}
    <div class="ep-main">
      <button class="ep-title" data-act="notes" aria-expanded="false">${isNew ? `<i class="new">New</i>` : ""}${esc(ep.title)}</button>
      <div class="ep-meta">${showShow ? `<a href="#/podcast/${esc(ep.pid)}">${esc(ep.show)}</a> · ` : ""}${esc(date(ep.date))}${left ? ` · <span class="left">${esc(left)}</span>` : ""}</div>
      ${desc ? `<div class="notes" hidden>${textToHtml(desc)}</div>` : ""}
      ${prog > 0 && prog < 1 ? `<span class="minibar"><i style="width:${(prog * 100).toFixed(1)}%"></i></span>` : ""}
    </div>
    <div class="ep-acts">
      <button class="gbtn sm" data-act="play" aria-label="Play" title="Play">${ICON.play}</button>
      <button class="tbtn" data-act="queue" title="Add to Up Next" aria-label="Add to Up Next">${ICON.addq}</button>
      <button class="tbtn" data-act="played" title="${played ? "Mark as unplayed" : "Mark as played"}" aria-label="${played ? "Mark as unplayed" : "Mark as played"}">${played ? ICON.undo : ICON.check}</button>
    </div>
  </li>`;
}
const epList = (list, opts) => `<ul class="eps">${list.map(e => epRow(e, opts)).join("")}</ul>`;
const section = (title, body, more) => `<section class="sec"><h2>${esc(title)}${more || ""}</h2>${body}</section>`;

const ICON = {
  play: `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/></svg>`,
  addq: `<svg viewBox="0 0 24 24"><path d="M3 6h12v2H3zm0 5h12v2H3zm0 5h8v2H3zm14-3h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>`,
  undo: `<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6c1.4-1.2 3.2-1.9 5.1-1.9 3.5 0 6.5 2.3 7.6 5.5l2.4-.8C21 11 17.1 8 12.5 8z"/></svg>`,
  up: `<svg viewBox="0 0 24 24"><path d="M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z"/></svg>`,
  down: `<svg viewBox="0 0 24 24"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>`,
  x: `<svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z"/></svg>`
};

// ---------- pages ----------
async function pageHome(token) {
  setTitle("Home");
  const draw = () => {
    if (token !== renderToken) return;
    const cont = player.inProgress().slice(0, 5), fresh = newEpisodes().slice(0, 12), mine = subs();
    let html = "";
    if (cont.length) html += section("Continue Listening", epList(cont, { showShow: true }));
    if (fresh.length) html += section("New Episodes", epList(fresh, { showShow: true, isNew: true }));
    html += section("Your Congregation", mine.length ? grid(mine.slice(0, 12)) : `<p class="hint">Nobody here yet. Subscribe to a show and it joins your Congregation, and its new episodes show up here.</p>`, mine.length > 12 ? ` <a class="more" href="#/library">See all</a>` : "");
    html += `<div id="top-home">${section("Top Podcasts", loading())}</div>`;
    view.innerHTML = `<div class="page">${html}</div>`;
    status(mine.length ? `${mine.length} in your Congregation${fresh.length ? `, ${fresh.length} new episode${fresh.length > 1 ? "s" : ""}` : ""}` : "Welcome to Apple Podcasts 2");
    drawTop($("#top-home"), token, 12);
  };
  draw();
  if (await refreshSubs()) { const y = scrollY, s = view.scrollTop; draw(); scrollTo(0, y); view.scrollTop = s; }
}
async function drawTop(el, token, n) {
  try {
    const { list, source } = await itunes.top();
    if (token !== renderToken || !el.isConnected) return;
    const note = source === "picks" ? `<p class="hint">Apple's chart couldn't load here, so these are some well-loved shows instead.</p>` : "";
    el.innerHTML = section("Top Podcasts", note + `<div class="grid">${list.slice(0, n).map((p, i) => card(p, source === "chart" ? i + 1 : 0)).join("")}</div>`,
      n < list.length ? ` <a class="more" href="#/top">See all</a>` : "");
    if (n >= list.length) status(`${list.length} podcasts`);
  } catch (e) {
    if (token === renderToken && el.isConnected) el.innerHTML = section("Top Podcasts", problem(e.message));
  }
}
function pageTop(token) {
  setTitle("Top Podcasts");
  view.innerHTML = `<div class="page" id="top-page">${section("Top Podcasts", loading())}</div>`;
  status("Loading the charts…");
  drawTop($("#top-page"), token, 100);
}

async function pageLibrary(token) {
  setTitle("Congregation");
  const mine = subs();
  const draw = () => {
    if (token !== renderToken) return;
    const f = get("feeds", {});
    const latest = mine.flatMap(s => (f[s.id] && f[s.id].eps) || []).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 30);
    view.innerHTML = `<div class="page">
      ${section("Your Congregation", mine.length ? grid(mine) : `<div class="empty"><p>Your Congregation is empty.</p><p class="hint">Find a show in Top Podcasts or Search, then press Subscribe.</p><a class="pill" href="#/top">Browse Top Podcasts</a></div>`)}
      ${latest.length ? section("Latest Episodes", epList(latest, { showShow: true })) : ""}
    </div>`;
    status(`${mine.length} podcast${mine.length === 1 ? "" : "s"} in your Congregation`);
  };
  draw();
  if (await refreshSubs()) draw();
}

function pageSearch(token, term) {
  setTitle("Search");
  term = term || "";
  view.innerHTML = `<div class="page">
    <form class="searchform" id="sform" role="search">
      <input id="q" type="search" placeholder="Search podcasts" value="${esc(term)}" autocomplete="off" enterkeyhint="search" aria-label="Search podcasts">
      <button class="pill" type="submit">Search</button>
    </form>
    <div id="results">${term ? loading("Searching…") : `<p class="hint">Search Apple's directory by show name, host or topic.</p>`}</div>
  </div>`;
  $("#sform").addEventListener("submit", e => { e.preventDefault(); const q = $("#q").value.trim(); if (q) location.hash = "#/search/" + encodeURIComponent(q); });
  if (!term) { status("Search"); if (matchMedia("(min-width: 761px)").matches || !("ontouchstart" in window)) $("#q").focus(); return; }
  status(`Searching for “${term}”…`);
  itunes.search(term).then(list => {
    if (token !== renderToken) return;
    $("#results").innerHTML = list.length ? grid(list) : `<div class="empty"><p>No podcasts found for “${esc(term)}”.</p></div>`;
    status(`${list.length} result${list.length === 1 ? "" : "s"} for “${term}”`);
  }, e => {
    if (token !== renderToken) return;
    $("#results").innerHTML = problem(e.message);
    status("Search failed");
  });
}

async function pagePodcast(token, id) {
  setTitle("Podcast");
  view.innerHTML = `<div class="page">${loading()}</div>`;
  status("Loading episodes…");
  let data;
  try { data = await itunes.lookup(id); }
  catch (e) { if (token === renderToken) { view.innerHTML = `<div class="page">${problem(e.message)}</div>`; status("Couldn't load this podcast"); } return; }
  if (token !== renderToken) return;
  const { pod, episodes: eps } = data;
  setTitle(pod.name);
  const sub = subs().find(s => s.id === pod.id);
  if (sub) { saveFeed(pod.id, eps); }
  const since = sub ? (sub.seen || sub.added) : Infinity;
  const totalMs = eps.reduce((n, e) => n + (e.ms || 0), 0);
  view.innerHTML = `<div class="page">
    <header class="show">
      <img class="show-art" src="${esc(art(pod.art, 600))}" alt="">
      <div class="show-info">
        <h1>${esc(pod.name)}</h1>
        <p class="by">${esc(pod.artist)}</p>
        ${pod.genre ? `<p class="genre">${esc(pod.genre)}</p>` : ""}
        <div class="show-acts">
          <button class="pill ${sub ? "on" : "buy"}" data-act="sub">${sub ? "Subscribed" : "Subscribe"}</button>
          ${eps.length ? `<button class="pill" data-act="playlatest">${ICON.play} Latest</button>` : ""}
          ${eps.length ? `<button class="pill" data-act="allplayed">Mark all played</button>` : ""}
        </div>
      </div>
    </header>
    <div class="cols" aria-hidden="true"><span>Episode</span><span>Time</span></div>
    ${eps.length ? epList(eps, { isNew: false }) : `<div class="empty"><p>No episodes are listed for this show.</p></div>`}
    ${eps.length >= 100 ? `<p class="hint center">Apple's directory lists the latest 100 episodes.</p>` : ""}
  </div>`;
  // "New" badges for episodes released since you last opened this show.
  if (sub) for (const e of eps) {
    if (Date.parse(e.date) > since && !player.isPlayed(e.id) && !player.progress(e.id)) {
      const t = $(`.ep[data-id="${CSS.escape(e.id)}"] .ep-title`, view);
      if (t) t.insertAdjacentHTML("afterbegin", `<i class="new">New</i>`);
    }
  }
  if (sub) { markSeen(pod.id); drawSidebar(); }
  view.dataset.pod = JSON.stringify(pod);
  status(`${eps.length} episode${eps.length === 1 ? "" : "s"}${totalMs ? `, ${(totalMs / 3600000).toFixed(1)} hours` : ""}`);
  syncRows();
}

function pageQueue(token) {
  setTitle("Up Next");
  const s = player.state(), cur = s.current;
  const cont = player.inProgress().filter(e => !cur || e.id !== cur.id).slice(0, 8);
  view.innerHTML = `<div class="page">
    ${cur ? `<section class="np">
      <img class="np-art" src="${esc(art(cur.art, 600))}" alt="">
      <div class="np-info">
        <p class="np-show"><a href="#/podcast/${esc(cur.pid)}">${esc(cur.show)}</a></p>
        <h1 class="np-title">${esc(cur.title)}</h1>
        <p class="np-date">${esc(date(cur.date))}</p>
        <input class="scrub" id="np-scrub" type="range" min="0" max="1000" value="0" aria-label="Position">
        <div class="np-times"><span id="np-el">0:00</span><span id="np-rem">-0:00</span></div>
        <div class="np-ctrl">
          <button class="gbtn" data-act="back" aria-label="Back 15 seconds" title="Back 15 seconds">${SKIP(-15)}</button>
          <button class="gbtn big" data-act="toggle" aria-label="Play" title="Play or pause" id="np-play">${ICON.play}</button>
          <button class="gbtn" data-act="fwd" aria-label="Forward 30 seconds" title="Forward 30 seconds">${SKIP(30)}</button>
        </div>
        <div class="speeds" role="group" aria-label="Speed">${player.SPEEDS.map(v => `<button data-speed="${v}" class="${v === s.speed ? "on" : ""}">${v}×</button>`).join("")}</div>
      </div>
    </section>` : `<div class="empty"><p>Nothing is playing.</p><p class="hint">Pick an episode and it plays here.</p></div>`}
    ${section("Up Next", s.queue.length ? `<ul class="eps queue">${s.queue.map((e, i) => {
      episodes.set(e.id, e);
      return `<li class="ep" data-id="${esc(e.id)}">
        <span class="qnum">${i + 1}</span>
        <a class="ep-art" href="#/podcast/${esc(e.pid)}"><img loading="lazy" src="${esc(art(e.art, 100))}" alt=""></a>
        <div class="ep-main"><span class="ep-title plain">${esc(e.title)}</span><div class="ep-meta">${esc(e.show)} · ${esc(date(e.date))}${e.ms ? " · " + esc(length(e.ms)) : ""}</div></div>
        <div class="ep-acts">
          <button class="gbtn sm" data-act="play" aria-label="Play now" title="Play now">${ICON.play}</button>
          <button class="tbtn" data-act="up" aria-label="Move up" title="Move up" ${i === 0 ? "disabled" : ""}>${ICON.up}</button>
          <button class="tbtn" data-act="down" aria-label="Move down" title="Move down" ${i === s.queue.length - 1 ? "disabled" : ""}>${ICON.down}</button>
          <button class="tbtn" data-act="remove" aria-label="Remove" title="Remove">${ICON.x}</button>
        </div></li>`;
    }).join("")}</ul>` : `<p class="hint">Your queue is empty. Use the ${ICON.addq} button on any episode to add it.</p>`,
      s.queue.length ? ` <button class="more linkish" data-act="clearq">Clear</button>` : "")}
    ${cont.length ? section("Continue Listening", epList(cont, { showShow: true })) : ""}
  </div>`;
  status(s.queue.length ? `${s.queue.length} episode${s.queue.length === 1 ? "" : "s"} up next` : "Up Next is empty");
  syncPlayer();
}
const SKIP = n => `<svg viewBox="0 0 24 24" class="skip"><path d="${n < 0 ? "M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" : "M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"}"/><text x="12" y="16.2" text-anchor="middle">${Math.abs(n)}</text></svg>`;

// ---------- routing ----------
const routes = { "": pageHome, top: pageTop, library: pageLibrary, search: pageSearch, podcast: pagePodcast, queue: pageQueue };
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  const name = routes[parts[0]] ? parts[0] : "";
  let arg = parts.slice(1).join("/");
  try { arg = decodeURIComponent(arg); } catch (e) {}
  const token = ++renderToken;
  episodes.clear();
  delete view.dataset.pod;
  $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === name || (name === "podcast" && a.dataset.nav === "pod-" + arg)));
  if (name !== "search") $("#topsearch").value = "";
  routes[name](token, arg);
  view.scrollTop = 0; scrollTo(0, 0);
  view.focus({ preventScroll: true });
}
addEventListener("hashchange", route);

// ---------- clicks on the page ----------
view.addEventListener("click", e => {
  const b = e.target.closest("[data-act],[data-speed]");
  if (!b) return;
  if (b.dataset.speed) { player.setSpeed(+b.dataset.speed); return; }
  const li = b.closest(".ep"), ep = li && episodes.get(li.dataset.id);
  switch (b.dataset.act) {
    case "retry": route(); break;
    case "notes": {
      const n = $(".notes", li); if (!n) break;
      n.hidden = !n.hidden; b.setAttribute("aria-expanded", String(!n.hidden)); break;
    }
    case "play": {
      const s = player.state();
      if (s.current && s.current.id === ep.id) player.toggle(); else player.play(ep);
      break;
    }
    case "queue":
      if (player.inQueue(ep.id)) { toast("Already in Up Next."); break; }
      if (player.enqueue(ep)) toast("Added to Up Next."); else toast(ep.url ? "That's playing now." : "This episode has no audio file.");
      break;
    case "played": player.setPlayed(ep.id, !player.isPlayed(ep.id)); refreshRow(li); break;
    case "up": player.move(ep.id, -1); break;
    case "down": player.move(ep.id, 1); break;
    case "remove": player.dequeue(ep.id); break;
    case "clearq": player.clearQueue(); break;
    case "toggle": player.toggle(); break;
    case "back": player.skip(-15); break;
    case "fwd": player.skip(30); break;
    case "sub": {
      const pod = JSON.parse(view.dataset.pod || "null"); if (!pod) break;
      if (isSub(pod.id)) { if (confirm(`Unsubscribe from ${pod.name}?`)) unsubscribe(pod.id); }
      else subscribe(pod, [...episodes.values()]);
      b.textContent = isSub(pod.id) ? "Subscribed" : "Subscribe";
      b.classList.toggle("on", isSub(pod.id)); b.classList.toggle("buy", !isSub(pod.id));
      break;
    }
    case "playlatest": { const first = $(".ep", view); if (first) player.play(episodes.get(first.dataset.id)); break; }
    case "allplayed":
      if (!confirm("Mark every episode of this show as played?")) break;
      for (const id of episodes.keys()) if (!player.isPlayed(id)) player.setPlayed(id, true);
      $$(".ep", view).forEach(refreshRow);
      break;
  }
});
function refreshRow(li) {
  const ep = episodes.get(li.dataset.id); if (!ep) return;
  const showShow = !!$(".ep-art", li), isNew = !!$(".new", li) && !player.isPlayed(ep.id);
  const open = $(".notes", li) && !$(".notes", li).hidden;
  li.outerHTML = epRow(ep, { showShow, isNew });
  if (open) { const n = $(`.ep[data-id="${CSS.escape(ep.id)}"] .notes`, view); if (n) n.hidden = false; }
  syncRows();
}

// ---------- the sidebar (source list) ----------
function drawSidebar() {
  const mine = subs(), fresh = newEpisodes();
  const count = id => fresh.filter(e => e.pid === id).length;
  $("#congregation").innerHTML = mine.length ? mine.map(s => {
    const n = count(s.id);
    return `<a href="#/podcast/${esc(s.id)}" data-nav="pod-${esc(s.id)}"><img src="${esc(art(s.art, 60))}" alt=""><span>${esc(s.name)}</span>${n ? `<i class="badge">${n}</i>` : ""}</a>`;
  }).join("") : `<p class="side-hint">Subscribe to a show to add it here.</p>`;
  const q = player.state().queue.length;
  $$(".qcount").forEach(el => { el.textContent = q || ""; el.hidden = !q; });
  const nn = fresh.length;
  $$(".newcount").forEach(el => { el.textContent = nn || ""; el.hidden = !nn; });
  const name = location.hash.replace(/^#\/?/, "").split("/");
  if (name[0] === "podcast") $$(`#congregation [data-nav="pod-${CSS.escape(name[1] || "")}"]`).forEach(a => a.classList.add("on"));
}

// ---------- the LCD and transport ----------
const lcd = {
  title: $("#lcd-title"), sub: $("#lcd-sub"), el: $("#lcd-el"), rem: $("#lcd-rem"), bar: $("#lcd-bar"), art: $("#lcd-art"), play: $("#tb-play"), speed: $("#tb-speed")
};
let dragging = null;
function syncPlayer() {
  const s = player.state(), cur = s.current;
  document.body.classList.toggle("idle", !cur);
  document.body.classList.toggle("playing", s.playing);
  const t = dragging ?? s.time, d = s.duration;
  if (cur) {
    if (lcd.title.dataset.id !== cur.id) {
      lcd.title.dataset.id = cur.id;
      lcd.title.innerHTML = `<span>${esc(cur.title)}</span>`;
      lcd.sub.textContent = cur.show;
      lcd.art.src = art(cur.art, 100);
      lcd.art.hidden = false;
      requestAnimationFrame(marquee);
    }
  } else if (lcd.title.dataset.id !== "") {
    lcd.title.dataset.id = "";
    lcd.title.innerHTML = `<span>Apple Podcasts 2</span>`;
    lcd.sub.textContent = "The first church of Chris";
    lcd.art.src = "img/icon.svg";
  }
  if (s.error && cur) lcd.sub.textContent = s.error;
  else if (cur && s.buffering) lcd.sub.textContent = "Loading…";
  else if (cur) lcd.sub.textContent = cur.show;
  lcd.el.textContent = cur ? clock(t) : "";
  lcd.rem.textContent = cur ? "-" + clock(Math.max(0, d - t)) : "";
  if (dragging === null) lcd.bar.value = d ? Math.round((t / d) * 1000) : 0;
  lcd.bar.disabled = !cur;
  lcd.bar.style.setProperty("--p", (d ? (t / d) * 100 : 0) + "%");
  for (const b of [lcd.play, $("#np-play")]) if (b) {
    b.innerHTML = s.playing ? ICON.pause : ICON.play;
    b.setAttribute("aria-label", s.playing ? "Pause" : "Play");
  }
  lcd.speed.textContent = s.speed + "×";
  // The Up Next page's big player.
  const np = $("#np-scrub");
  if (np) {
    if (dragging === null) np.value = d ? Math.round((t / d) * 1000) : 0;
    np.style.setProperty("--p", (d ? (t / d) * 100 : 0) + "%");
    $("#np-el").textContent = clock(t);
    $("#np-rem").textContent = "-" + clock(Math.max(0, d - t));
    $$(".speeds button").forEach(b => b.classList.toggle("on", +b.dataset.speed === s.speed));
  }
}
function marquee() {
  const box = lcd.title, span = box.firstElementChild;
  if (!span) return;
  const over = span.scrollWidth - box.clientWidth;
  box.classList.toggle("scroll", over > 4);
  if (over > 4) { span.style.setProperty("--d", (over + 40) + "px"); span.style.animationDuration = Math.max(8, (over + 40) / 18) + "s"; }
}
addEventListener("resize", () => requestAnimationFrame(marquee));
// Highlight the row that's playing.
function syncRows() {
  const s = player.state();
  $$(".ep", view).forEach(li => {
    const now = s.current && li.dataset.id === s.current.id;
    li.classList.toggle("now", !!now);
    const b = $('[data-act="play"]', li);
    if (b) { b.innerHTML = now && s.playing ? ICON.pause : ICON.play; b.setAttribute("aria-label", now && s.playing ? "Pause" : "Play"); }
  });
}

{
  const el = lcd.bar;
  el.addEventListener("input", () => { const d = player.state().duration; dragging = (el.value / 1000) * d; syncPlayer(); });
  el.addEventListener("change", () => { const d = player.state().duration; player.seek((el.value / 1000) * d); dragging = null; syncPlayer(); });
}
view.addEventListener("input", e => {
  if (e.target.id !== "np-scrub") return;
  dragging = (e.target.value / 1000) * player.state().duration; syncPlayer();
});
view.addEventListener("change", e => {
  if (e.target.id !== "np-scrub") return;
  player.seek((e.target.value / 1000) * player.state().duration); dragging = null; syncPlayer();
});
$("#tb-play").addEventListener("click", () => player.toggle());
$("#tb-back").addEventListener("click", () => player.skip(-15));
$("#tb-fwd").addEventListener("click", () => player.skip(30));
$("#tb-speed").addEventListener("click", () => { player.cycleSpeed(); toast(`Speed ${player.state().speed}×`); });
$("#lcd-open").addEventListener("click", () => { location.hash = "#/queue"; });
$("#topsearch-form").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#topsearch").value.trim();
  if (q) location.hash = "#/search/" + encodeURIComponent(q);
});

player.on(kind => {
  if (kind === "time") { syncPlayer(); return; }
  syncPlayer();
  syncRows();
  if (kind === "error") toast(player.state().error);
  if (kind === "queue" || kind === "track") {
    drawSidebar();
    if (location.hash.startsWith("#/queue")) { const y = view.scrollTop, w = scrollY; pageQueue(renderToken); view.scrollTop = y; scrollTo(0, w); }
  }
  if (kind === "played") drawSidebar();
});

// Keyboard: space plays or pauses, arrows skip (when you're not typing).
addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input, textarea, select, button, a")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === " ") { e.preventDefault(); player.toggle(); }
  else if (e.key === "ArrowLeft") player.skip(-15);
  else if (e.key === "ArrowRight") player.skip(30);
});

// Broken artwork falls back to the app icon.
document.addEventListener("error", e => {
  const t = e.target;
  if (t && t.tagName === "IMG" && !t.src.endsWith("img/icon.svg")) t.src = "img/icon.svg";
}, true);

drawSidebar();
syncPlayer();
route();
