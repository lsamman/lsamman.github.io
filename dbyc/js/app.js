// MySpace v1.3.3 (DBYC, Dreamliner's Better YouTube Client): YouTube without the ads or the Shorts.
// Named for the Sacred App from The Legend Of Chris.
import * as piped from "./piped.js?v=20261008184847";
import * as yt from "./youtube.js?v=20261008184847";
import * as player from "./player.js?v=20261008184847";
import { settings, get, set, del } from "./store.js?v=20261008184847";
import { PIPED_INSTANCES } from "./config.js?v=20261008184847";
import { esc, duration, views, ago, thumb, noShorts, linkify, htmlToText } from "./util.js?v=20261008184847";

const view = document.getElementById("view");
const $ = (sel, root = document) => root.querySelector(sel);
let renderId = 0;   // ignore results from a page the user already left

function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 4000);
}

// ---------- pieces ----------
const known = new Map();   // every video shown in a list, so its page can fill in instantly
function card(v) {
  known.set(v.id, v);
  const meta = [v.views != null ? views(v.views) : "", v.published ? ago(v.published) : v.publishedText || ""].filter(Boolean).join(" · ");
  const chan = v.channelId ? `<a href="#/channel/${esc(v.channelId)}">${esc(v.channelName || "")}</a>` : esc(v.channelName || "");
  return `<article class="card">
    <a class="thumb" href="#/watch/${esc(v.id)}"><img src="${thumb(v.id)}" alt="" loading="lazy">${v.duration ? `<span class="dur">${duration(v.duration)}</span>` : ""}</a>
    <div class="card-body">
      ${v.channelAvatar ? `<img class="avatar" src="${esc(v.channelAvatar)}" alt="" loading="lazy">` : ""}
      <div><a class="card-title" href="#/watch/${esc(v.id)}">${esc(v.title)}</a>
      <div class="card-meta">${chan}</div><div class="card-meta">${meta}</div>${v.why ? `<div class="card-meta why">${esc(v.why)}</div>` : ""}</div>
    </div></article>`;
}
const grid = list => `<div class="grid">${noShorts(list).map(card).join("")}</div>`;
const loading = text => `<p class="loading">${esc(text || "Loading")}</p>`;
const skeleton = (n = 8) => `<div class="grid" aria-busy="true">${'<div class="skel"><div class="thumb"></div><div class="card-body"><div class="avatar"></div><div class="lines"><i></i><i></i></div></div></div>'.repeat(n)}</div>`;
const sameIds = (a, b) => a.map(v => v.id).join() === b.map(v => v.id).join();
const notice = (html, kind = "") => `<div class="notice ${kind}">${html}</div>`;

function signInButton(label = "Sign in with Google") {
  return yt.canSignIn ? `<button class="btn primary" type="button" data-signin>${esc(label)}</button>` : "";
}
view.addEventListener("click", e => {
  if (e.target.closest("[data-signin]")) doSignIn();
});

async function doSignIn() {
  try { await yt.signIn(); toast("Signed in. Loading your subscriptions."); route(); }
  catch (e) { toast(e.message); }
}

function renderAccount() {
  const b = $("#account"), p = yt.profile();
  if (yt.signedIn() && p) {
    b.classList.add("signed-in");
    b.innerHTML = `${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : ""}<span>${esc(p.name)}</span>`;
    b.title = "Account";
  } else {
    b.classList.remove("signed-in");
    b.textContent = yt.wasSignedIn() ? "Sign in again" : "Sign in";
    b.title = yt.canSignIn ? "Sign in with Google to see your subscriptions" : "Google sign-in isn't set up yet";
  }
}
$("#account").addEventListener("click", () => {
  if (yt.signedIn()) location.hash = "#/settings";
  else if (yt.canSignIn) doSignIn();
  else location.hash = "#/settings";
});
yt.onAuthChange(renderAccount);

// ---------- pages ----------
async function home(rid) {
  if (yt.signedIn()) {
    const show = f => {
      view.innerHTML = `<div class="row" style="justify-content:space-between"><div><h1>Subscriptions</h1>
        <p class="sub">${f.subs.length} channel${f.subs.length === 1 ? "" : "s"} · updated ${ago(f.at)} · no Shorts</p></div>
        <button class="btn" type="button" id="refresh">Refresh</button></div>` +
        (f.items.length ? grid(f.items) : notice("No recent videos from your subscriptions. Even the MySpace servers are quiet."));
      $("#refresh").onclick = async () => {
        const b = $("#refresh"); b.disabled = true; b.textContent = "Refreshing…";
        try { const nf = await yt.feed({ force: true }); if (rid === renderId) show(nf); } catch (e) { toast(e.message); b.disabled = false; b.textContent = "Refresh"; }
      };
    };
    const saved = yt.cachedFeed();
    if (saved) show(saved);
    else view.innerHTML = `<h1>Subscriptions</h1><p class="sub">Newest videos from your channels. No Shorts.</p>` + skeleton(12);
    if (saved && saved.at > Date.now() - yt.FEED_FRESH) return;
    try {
      const f = await yt.feed();
      if (rid !== renderId) return;
      if (!saved || !sameIds(saved.items, f.items)) show(f);
      else $(".sub", view).textContent = `${f.subs.length} channel${f.subs.length === 1 ? "" : "s"} · updated just now · no Shorts`;
      return;
    } catch (e) {
      if (rid !== renderId) return;
      if (saved) { toast(e.message); return; }
      if (e.code !== "auth") { view.innerHTML = `<h1>Subscriptions</h1>` + notice(esc(e.message), "bad"); return; }
    }
  }
  const intro = yt.canSignIn
    ? notice(`<b>${yt.wasSignedIn() ? "Your Google sign-in expired." : "See your subscriptions here."}</b> ${yt.wasSignedIn() ? "Sign in again to load your feed." : "Sign in with Google to get the newest videos from the channels you follow."}<div class="row" style="margin-top:10px">${signInButton(yt.wasSignedIn() ? "Sign in again" : "Sign in with Google")}</div>`)
    : notice("Google sign-in isn't set up yet, so here's what's trending. See the README to connect your subscriptions.", "warn");
  const head = intro + `<h1>Trending</h1><p class="sub">No ads, no Shorts.</p>`;
  const saved = piped.cachedTrending(settings.region);
  view.innerHTML = head + (saved ? grid(saved.items) : skeleton(12));
  try {
    const items = await piped.trending(settings.region);
    if (rid !== renderId) return;
    if (!saved || !sameIds(saved.items, items)) view.innerHTML = head + grid(items);
  } catch (e) {
    if (rid !== renderId || saved) return;
    view.innerHTML = intro + `<h1>Trending</h1>` + notice(`Trending is unavailable right now: ${esc(e.message)}. Try searching instead.`, "warn");
  }
}

async function search(rid, q) {
  $("#search-input").value = q;
  view.innerHTML = `<h1>${esc(q)}</h1><p class="sub">Searching…</p>` + skeleton(12);
  let items = [], next = null, via = "piped";
  try {
    ({ items, nextpage: next } = await piped.search(q));
  } catch (e) {
    if (yt.signedIn()) {
      try { items = await yt.search(q); via = "youtube"; } catch (e2) { items = null; e = e2; }
    } else items = null;
    if (!items) { if (rid === renderId) view.innerHTML = `<h1>${esc(q)}</h1>` + notice(`Search isn't working right now: ${esc(e.message)}`, "bad"); return; }
  }
  if (rid !== renderId) return;
  view.innerHTML = `<h1>${esc(q)}</h1><p class="sub">${via === "youtube" ? "Results from YouTube (Piped is down)" : "Results"} · no Shorts</p>` + grid(items) +
    (next ? `<div class="more"><button class="btn" type="button" id="more">More results</button></div>` : "");
  const more = $("#more");
  if (more) more.onclick = async () => {
    more.disabled = true; more.textContent = "Loading…";
    try {
      const r = await piped.search(q, next); next = r.nextpage;
      $(".grid", view).insertAdjacentHTML("beforeend", noShorts(r.items).map(card).join(""));
      if (next) { more.disabled = false; more.textContent = "More results"; } else more.parentElement.remove();
    } catch (e) { toast(e.message); more.disabled = false; more.textContent = "More results"; }
  };
}

async function watch(rid, id) {
  const pre = known.get(id) || null;
  view.innerHTML = `<div class="watch"><div class="main">
      <div class="player" id="player"></div>
      <p class="source" id="source"></p>
      <h1 id="title">${pre ? esc(pre.title) : '<span class="skel-line" style="width:60%"></span>'}</h1>
      <div class="channel-line"><span id="chan">${chanLink(pre)}</span>
      <div class="actions">
        <div class="pill"><button type="button" class="act" id="like" aria-pressed="false" title="I like this">${ICON.like}<span id="like-n">Like</span></button><button type="button" class="act" id="dislike" aria-pressed="false" title="I dislike this">${ICON.dislike}</button></div>
        <button type="button" class="act" id="save">${ICON.save}<span>Save</span></button>
        <button type="button" class="act" id="share">${ICON.share}<span>Share</span></button>
      </div></div>
      <div class="desc" id="desc" hidden></div></div>
    <aside class="side"><h2>Up next</h2><div id="related">${'<div class="skel"><div class="thumb"></div><div class="card-body"><div class="lines"><i></i><i></i></div></div></div>'.repeat(5)}</div></aside></div>`;
  if (pre) document.title = pre.title + " · MySpace";
  const state = { d: pre };
  wireActions(id, state);

  // Up next from your subscriptions can show straight away from the saved feed.
  let upNextDone = false;
  if (yt.signedIn()) {
    const f = yt.cachedFeed();
    const fresh = f ? noShorts(f.items).filter(v => v.id !== id && v.published > Date.now() - 14 * 864e5) : [];
    if (fresh.length) { showUpNext(shuffle(fresh).slice(0, 20), true); upNextDone = true; }
  }

  const res = await player.play($("#player"), id, settings.playback);
  if (rid !== renderId) return;
  const src = $("#source");
  if (res.source === "piped") src.innerHTML = `<b>● Ad-free</b> via Piped (${esc(new URL(res.instance).host)}) <button type="button" id="use-yt">Use YouTube's player</button>`;
  else if (res.source === "youtube") {
    src.classList.add("yt");
    src.innerHTML = `<b>● YouTube player</b> ${res.fellBack ? "· Piped couldn't play this, so YouTube may show ads" : "· YouTube may show ads"} ${settings.playback !== "youtube" ? '<button type="button" id="retry">Try ad-free again</button>' : ""}`;
  }
  const useYt = $("#use-yt"), retry = $("#retry");
  if (useYt) useYt.onclick = async () => { await player.play($("#player"), id, "youtube"); src.classList.add("yt"); src.innerHTML = "<b>● YouTube player</b> · YouTube may show ads"; };
  if (retry) retry.onclick = () => route();

  let d = res.details, related = res.related || [];
  if (!d && yt.signedIn()) d = (await yt.videos([id]).catch(() => []))[0];
  if (rid !== renderId) return;
  d = d || pre;
  if (d) {
    state.d = { ...pre, ...d, channelAvatar: d.channelAvatar || pre?.channelAvatar };
    document.title = d.title + " · MySpace";
    $("#title").textContent = d.title;
    $("#chan").innerHTML = chanLink(state.d);
    if (d.likes != null) $("#like-n").textContent = compact(d.likes);
    const text = d.descriptionIsHtml ? htmlToText(d.description) : d.description || "";
    const stats = [d.views != null ? views(d.views) : "", d.published ? ago(d.published) : ""].filter(Boolean).join(" · ");
    const desc = $("#desc");
    desc.innerHTML = `<span class="stats">${esc(stats)}</span>${linkify(text)}`;
    desc.hidden = false;
    desc.onclick = e => { if (!e.target.closest("a")) desc.classList.add("open"); };
    remember({ id, title: d.title, channelId: d.channelId });
  } else if (!pre) $("#title").textContent = "";
  if (upNextDone) return;

  // Up next: an assortment of new videos from your subscriptions, or related videos when signed out.
  if (yt.signedIn()) {
    const f = await yt.feed().catch(() => null);
    const fresh = f ? noShorts(f.items).filter(v => v.id !== id && v.published > Date.now() - 14 * 864e5) : [];
    if (rid !== renderId) return;
    if (fresh.length) { showUpNext(shuffle(fresh).slice(0, 20), true); return; }
  }
  if (!related.length && d && d.channelId) {
    related = await piped.channel(d.channelId).then(c => c.items)
      .catch(() => yt.signedIn() ? yt.channel(d.channelId).then(c => c.items) : []).catch(() => []);
  }
  if (rid !== renderId) return;
  showUpNext(noShorts(related).filter(v => v.id !== id).slice(0, 20), false);
}
const chanLink = d => d ? `${d.channelAvatar ? `<img class="avatar" src="${esc(d.channelAvatar)}" alt="">` : ""}<a class="name" href="#/channel/${esc(d.channelId)}">${esc(d.channelName || "")}</a>` : "";
function showUpNext(list, fromSubs) {
  $(".side h2").textContent = fromSubs ? "Up next from your subscriptions" : "Up next";
  $("#related").innerHTML = list.length ? list.map(card).join("") : '<p class="sub">Nothing to suggest.</p>';
}

// Watch history stays on this device; Discover uses it to find things you might like.
function remember(v) {
  const h = get("history", []).filter(x => x.id !== v.id);
  set("history", [{ ...v, at: Date.now() }, ...h].slice(0, 40));
}

const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const compact = n => n >= 1e6 ? (Math.round(n / 1e5) / 10) + "M" : n >= 1e3 ? (n >= 1e4 ? Math.round(n / 1e3) : Math.round(n / 100) / 10) + "K" : String(n);
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  like: svg("M7 10v11H3V10h4zm2 11h8.6a2 2 0 0 0 2-1.6l1.3-7A2 2 0 0 0 19 10h-5.2l.9-4.4A1.8 1.8 0 0 0 11.4 4L9 10v11z"),
  dislike: svg("M17 14V3h4v11h-4zm-2-11H6.4a2 2 0 0 0-2 1.6l-1.3 7A2 2 0 0 0 5 14h5.2l-.9 4.4a1.8 1.8 0 0 0 3.3 1.6L15 14V3z"),
  save: svg("M4 6h12v2H4V6zm0 5h12v2H4v-2zm0 5h8v2H4v-2zm14-2v-3h2v3h3v2h-3v3h-2v-3h-3v-2h3z"),
  share: svg("M14 5l7 7-7 7v-4c-5 0-8.5 1.6-11 5 1-5 4-10 11-11V5z")
};

// Like / dislike / save / share on the watch page. Changing things needs Google sign-in with
// permission to manage YouTube; asking for it happens from the click itself (popups need that).
async function ensureWrite() {
  if (!yt.canSignIn) throw new Error("Google sign-in isn't set up.");
  if (!yt.signedIn() || !yt.canWrite()) {
    toast("Allow MySpace to like and save videos for you.");
    await yt.signIn();
    renderAccount();
  }
}
function wireActions(id, state) {
  const like = $("#like"), dislike = $("#dislike");
  let rating = "none", wasLiked = false;
  const show = () => {
    like.setAttribute("aria-pressed", rating === "like");
    dislike.setAttribute("aria-pressed", rating === "dislike");
    const d = state.d;
    if (d && d.likes != null) $("#like-n").textContent = compact(d.likes + (rating === "like" && !wasLiked ? 1 : 0) - (rating !== "like" && wasLiked ? 1 : 0));
  };
  if (yt.signedIn() && yt.canWrite()) yt.rating(id).then(r => { rating = r; wasLiked = r === "like"; show(); }).catch(() => {});
  const rateTo = async target => {
    try {
      await ensureWrite();
      const next = rating === target ? "none" : target;
      const before = rating; rating = next; show();
      try { await yt.rate(id, next); toast(next === "like" ? "Liked. It's in your Liked videos." : next === "dislike" ? "Disliked." : "Rating removed."); }
      catch (e) { rating = before; show(); throw e; }
    } catch (e) { toast(e.message); }
  };
  like.onclick = () => rateTo("like");
  dislike.onclick = () => rateTo("dislike");
  $("#save").onclick = async () => {
    try { await ensureWrite(); await saveDialog(id); } catch (e) { toast(e.message); }
  };
  $("#share").onclick = async () => {
    const url = `https://youtu.be/${id}`, title = state.d ? state.d.title : "YouTube video";
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(url); toast("Link copied: " + url); }
    catch (e) { prompt("Copy this link:", url); }
  };
}

async function saveDialog(videoId) {
  const dlg = $("#dlg"), body = $("#dlg-body");
  $("#dlg-title").textContent = "Save to playlist";
  dlg.showModal();
  let lists = yt.cachedPlaylists();
  if (!lists) {
    body.innerHTML = loading("Loading your playlists");
    try { lists = await yt.playlists(); } catch (e) { body.innerHTML = notice(esc(e.message), "bad"); return; }
  } else yt.playlists().catch(() => {});   // refresh the saved copy for next time
  body.innerHTML = `<ul class="pick">${lists.items.map(p => `<li><button type="button" class="pick-item" data-id="${esc(p.id)}">
      ${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : '<span class="pl-blank"></span>'}<span><b>${esc(p.title)}</b><small>${privacyLabel(p.privacy)}${p.count != null ? " · " + p.count + " videos" : ""}</small></span></button></li>`).join("")}</ul>
    <form class="new-pl" id="new-pl"><input type="text" id="new-pl-name" placeholder="New playlist name" maxlength="150" required>
      <select id="new-pl-privacy" aria-label="Who can see it"><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select>
      <button class="btn primary" type="submit">Create &amp; save</button></form>`;
  body.querySelectorAll(".pick-item").forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await yt.addToPlaylist(b.dataset.id, videoId); dlg.close(); toast(`Saved to “${b.querySelector("b").textContent}”.`); }
    catch (e) { b.disabled = false; toast(e.message); }
  });
  $("#new-pl").onsubmit = async ev => {
    ev.preventDefault();
    const name = $("#new-pl-name").value.trim(); if (!name) return;
    try {
      const p = await yt.createPlaylist(name, $("#new-pl-privacy").value);
      await yt.addToPlaylist(p.id, videoId);
      dlg.close(); toast(`Made “${p.title}” and saved the video to it.`);
    } catch (e) { toast(e.message); }
  };
}
const privacyLabel = p => ({ private: "Private", unlisted: "Unlisted", public: "Public" }[p] || "");

// ---------- discover ----------
// YouTube's API doesn't share your personal recommendations, but YouTube recommends related videos
// for every video. Discover asks for those around what you've watched, liked and subscribed to,
// keeps only channels you don't follow, and ranks videos suggested from several places first.
async function discoverPage(rid, { force = false } = {}) {
  document.title = "Discover · MySpace";
  const head = `<div class="row" style="justify-content:space-between"><div><h1>Discover</h1>
    <p class="sub">Channels you don't follow yet, picked from what YouTube recommends alongside what you watch. No Shorts.</p></div>
    <button class="btn" type="button" id="refresh">Shuffle new picks</button></div>`;
  const cached = get("discover", null);
  if (!force && cached && cached.at > Date.now() - 30 * 60000 && cached.items.length) { showDiscover(head, cached.items); return; }
  view.innerHTML = head + skeleton(12);
  $("#refresh").onclick = () => discoverPage(++renderId, { force: true });

  const seeds = [], seen = new Set();
  const add = (v, why) => { if (v && v.id && !seen.has(v.id)) { seen.add(v.id); seeds.push({ id: v.id, title: v.title, why }); } };
  const history = get("history", []);
  history.slice(0, 6).forEach(v => add(v, "watched"));
  let subs = new Set();
  if (yt.signedIn()) {
    const f = await yt.feed().catch(() => null);
    if (f) { subs = new Set(f.subs.map(s => s.id)); noShorts(f.items).slice(0, 4).forEach(v => add(v, "subscribed")); }
    if (yt.canWrite()) {
      const lists = await yt.playlists().catch(() => null);
      if (lists && lists.liked) { const liked = await yt.playlist(lists.liked, { max: 10 }).catch(() => null); if (liked) noShorts(liked.items).slice(0, 4).forEach(v => add(v, "liked")); }
    }
  }
  if (rid !== renderId) return;
  if (!seeds.length) {
    view.innerHTML = head + notice("Discover learns from what you watch, much like Chris learned the secret teachings of social media. Watch a few videos (or sign in so it can use your subscriptions and likes), then come back.");
    $("#refresh").onclick = () => discoverPage(++renderId, { force: true });
    return;
  }
  const picks = new Map(), skip = new Set([...seen, ...history.map(h => h.id)]);
  const results = await Promise.all(shuffle(seeds).slice(0, 10).map(s => piped.related(s.id).then(list => [s, list]).catch(() => [s, []])));
  if (rid !== renderId) return;
  for (const [seed, list] of results) for (const v of noShorts(list)) {
    if (skip.has(v.id) || (v.channelId && subs.has(v.channelId))) continue;
    const p = picks.get(v.id) || { ...v, score: 0, why: ({ watched: "Because you watched", liked: "Because you liked", subscribed: "Similar to" }[seed.why] || "Like") + ` “${seed.title || "a video"}”` + (seed.why === "subscribed" ? " from your subscriptions" : "") };
    p.score += 1; picks.set(v.id, p);
  }
  // Ranked by how many of your videos led here; ties shuffled so each refresh feels new.
  const items = shuffle([...picks.values()]).sort((a, b) => b.score - a.score).slice(0, 48);
  if (!items.length) {
    view.innerHTML = head + notice("Couldn't find recommendations right now. Piped may be down; try again in a bit.", "warn");
    $("#refresh").onclick = () => discoverPage(++renderId, { force: true });
    return;
  }
  set("discover", { at: Date.now(), items });
  showDiscover(head, items);
}
function showDiscover(head, items) {
  view.innerHTML = head + grid(items);
  $("#refresh").onclick = () => discoverPage(++renderId, { force: true });
}

// ---------- your channels ----------
async function subscriptionsPage(rid) {
  document.title = "Subscriptions · MySpace";
  if (!yt.signedIn()) { view.innerHTML = `<h1>Subscriptions</h1>` + notice(`Sign in to see the channels you follow.<div class="row" style="margin-top:10px">${signInButton()}</div>`); return; }
  let f = yt.cachedFeed();
  if (f) { showChannels(f); if (f.at > Date.now() - yt.FEED_FRESH) return; }
  else view.innerHTML = `<h1>Subscriptions</h1><p class="sub">Loading your channels…</p><div class="chans">${'<span class="chan skel"><span class="ring"><img alt=""></span><i></i></span>'.repeat(18)}</div>`;
  try { f = await yt.feed(); } catch (e) { if (rid === renderId && !yt.cachedFeed()) view.innerHTML = `<h1>Subscriptions</h1>` + notice(esc(e.message), "bad"); return; }
  if (rid !== renderId) return;
  showChannels(f);
}
function showChannels(f) {
  const week = Date.now() - 7 * 864e5;
  const subs = f.subs.slice().sort((a, b) => ((b.latest > week) - (a.latest > week)) || (b.latest > week ? b.latest - a.latest : 0) || a.name.localeCompare(b.name));
  const fresh = subs.filter(s => s.latest > week).length;
  view.innerHTML = `<h1>Subscriptions</h1><p class="sub">${subs.length} channel${subs.length === 1 ? "" : "s"} · <span class="ring-key"></span> ${fresh} posted in the last week</p>
    <div class="chans">${subs.map(s => `<a class="chan${s.latest > week ? " fresh" : ""}" href="#/channel/${esc(s.id)}" title="${s.latest ? "Last video " + ago(s.latest) : ""}">
      <span class="ring">${s.avatar ? `<img src="${esc(s.avatar)}" alt="" loading="lazy">` : ""}</span>
      <span class="chan-name">${esc(s.name)}</span><small>${s.latest > week ? "New · " + ago(s.latest) : s.latest ? ago(s.latest) : ""}</small></a>`).join("")}</div>`;
}

// ---------- your playlists ----------
async function playlistsPage(rid) {
  document.title = "Playlists · MySpace";
  if (!yt.signedIn()) { view.innerHTML = `<h1>Playlists</h1>` + notice(`Sign in to see your playlists.<div class="row" style="margin-top:10px">${signInButton()}</div>`); return; }
  const saved = yt.cachedPlaylists();
  if (saved) showPlaylists(saved);
  else view.innerHTML = `<h1>Playlists</h1><p class="sub">Loading your playlists…</p>` + skeleton(6);
  let r;
  try { r = await yt.playlists(); } catch (e) { if (rid === renderId && !saved) view.innerHTML = `<h1>Playlists</h1>` + notice(esc(e.message), "bad"); return; }
  if (rid !== renderId) return;
  showPlaylists(r);
}
function showPlaylists(r) {
  const tile = (href, title, sub, img) => `<a class="pl" href="${href}"><span class="pl-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}</span><b>${esc(title)}</b><small>${esc(sub)}</small></a>`;
  view.innerHTML = `<h1>Playlists</h1><p class="sub">Your YouTube playlists. Shorts are hidden inside them.</p><div class="pls">` +
    (r.liked ? tile(`#/playlist/${encodeURIComponent(r.liked)}`, "Liked videos", "Everything you've liked", null).replace('<span class="pl-thumb">', '<span class="pl-thumb liked">' + ICON.like) : "") +
    r.items.map(p => tile(`#/playlist/${encodeURIComponent(p.id)}`, p.title, [privacyLabel(p.privacy), p.count != null ? p.count + " videos" : ""].filter(Boolean).join(" · "), p.thumb)).join("") +
    `</div>` + (r.items.length ? "" : '<p class="sub">You don\'t have any playlists yet. Use Save on any video to make one.</p>');
}

async function playlistPage(rid, id) {
  if (!yt.signedIn()) { view.innerHTML = notice(`Sign in to see this playlist.<div class="row" style="margin-top:10px">${signInButton()}</div>`); return; }
  view.innerHTML = `<h1><span class="skel-line" style="width:40%"></span></h1>` + skeleton(8);
  let p;
  try { p = await yt.playlist(id); } catch (e) { if (rid === renderId) view.innerHTML = notice(esc(e.message), "bad"); return; }
  if (rid !== renderId) return;
  const shown = noShorts(p.items), hidden = p.items.length - shown.length;
  document.title = (p.title || "Playlist") + " · MySpace";
  view.innerHTML = `<h1>${esc(p.title || "Liked videos")}</h1><p class="sub">${[privacyLabel(p.privacy), shown.length + " videos", hidden ? hidden + " Short" + (hidden === 1 ? "" : "s") + " hidden" : ""].filter(Boolean).join(" · ")}</p>` +
    (shown.length ? grid(shown) : notice("No videos here yet."));
}

async function channelPage(rid, id) {
  const k = [...known.values()].find(v => v.channelId === id);
  view.innerHTML = `<div class="chan-head">${k && k.channelAvatar ? `<img src="${esc(k.channelAvatar)}" alt="">` : ""}<div><h1>${esc(k ? k.channelName : "")}</h1></div></div>` + skeleton(12);
  let c;
  try { c = await piped.channel(id); }
  catch (e) {
    if (yt.signedIn()) c = await yt.channel(id).catch(() => null);
    if (!c) { if (rid === renderId) view.innerHTML = notice(`Couldn't load this channel: ${esc(e.message)}`, "bad"); return; }
  }
  if (rid !== renderId) return;
  document.title = (c.name || "Channel") + " · MySpace";
  view.innerHTML = (c.banner ? `<div class="banner"><img src="${esc(c.banner)}" alt=""></div>` : "") +
    `<div class="chan-head">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : ""}<div><h1>${esc(c.name)}</h1>
     <p class="sub" style="margin:0">${c.subscribers ? Number(c.subscribers).toLocaleString() + " subscribers · " : ""}no Shorts</p></div></div>` +
    grid(c.items.map(v => ({ ...v, channelAvatar: null }))) +
    (c.nextpage ? `<div class="more"><button class="btn" type="button" id="more">More videos</button></div>` : "");
  let next = c.nextpage;
  const more = $("#more");
  if (more) more.onclick = async () => {
    more.disabled = true;
    try {
      const r = await piped.channel(id, next); next = r.nextpage;
      $(".grid", view).insertAdjacentHTML("beforeend", noShorts(r.items).map(v => card({ ...v, channelAvatar: null })).join(""));
      if (next) more.disabled = false; else more.parentElement.remove();
    } catch (e) { toast(e.message); more.disabled = false; }
  };
}

function settingsPage() {
  document.title = "Settings · MySpace";
  const p = yt.profile();
  const list = get("pipedList", null) || PIPED_INSTANCES;
  const pb = settings.playback;
  const opt = (v, label, help) => `<label class="choice"><input type="radio" name="playback" value="${v}" ${pb === v ? "checked" : ""}><span>${label}<small>${help}</small></span></label>`;
  view.innerHTML = `<div class="settings"><h1>Settings</h1><p class="sub">Saved on this device.</p>
    <section class="setting"><h2>Appearance</h2><p>Day sky or night sky. Automatic follows your device.</p>
      <div class="row">${["auto", "light", "dark"].map(t => `<label class="choice" style="padding:4px 14px 4px 0"><input type="radio" name="theme" value="${t}" ${(get("theme", "auto") || "auto") === t ? "checked" : ""}><span>${{ auto: "Automatic", light: "Light", dark: "Dark" }[t]}</span></label>`).join("")}</div></section>
    <section class="setting"><h2>Playback</h2><p>Where videos play from.</p>
      ${opt("auto", "Ad-free, with backup (recommended)", "Plays through Piped with no ads. If Piped can't play a video, uses YouTube's player instead (which may show ads).")}
      ${opt("piped", "Ad-free only", "Always Piped. If it can't play a video, you'll see a message instead of an ad.")}
      ${opt("youtube", "YouTube's player", "Most reliable, but YouTube may play ads before or during videos.")}
    </section>
    <section class="setting"><h2>Piped server</h2><p>Automatic tries several public servers and remembers the one that works.</p>
      <select id="instance"><option value="">Automatic${get("pipedLast", "") ? ` (last used: ${esc(new URL(get("pipedLast")).host)})` : ""}</option>
      ${list.map(u => `<option value="${esc(u)}" ${settings.pipedInstance === u ? "selected" : ""}>${esc(new URL(u).host)}</option>`).join("")}</select>
    </section>
    <section class="setting"><h2>Trending region</h2><p>Two-letter country code for the Trending page when you're signed out.</p>
      <input type="text" id="region" maxlength="2" value="${esc(settings.region)}" style="max-width:90px;text-transform:uppercase"></section>
    <section class="setting"><h2>Google account</h2>
      ${!yt.canSignIn ? "<p>Google sign-in isn't set up yet. Add your OAuth client ID to <code>js/config.js</code> (see the README).</p>"
        : yt.signedIn() ? `<p>Signed in as <b>${esc(p?.name || "you")}</b>. MySpace reads your subscriptions and playlists, and only changes things when you press Like, Dislike or Save.</p><button class="btn" type="button" id="signout">Sign out</button>`
        : `<p>Sign in to see your subscriptions and playlists, and to like and save videos. MySpace only changes things when you press those buttons.</p>${signInButton()}`}
    </section>
    <section class="setting"><h2>Watch history</h2><p>MySpace remembers your last 40 videos on this device only, so Discover can suggest new channels.</p>
      <button class="btn" type="button" id="clear-history">Clear watch history</button></section>
    <section class="setting"><h2>About</h2><p class="lore"><img src="img/logo.png" alt="">MySpace v1.3.3, the first of the Sacred Apps, as named by Steve Jobs at the iPhone 3G Keynote. Kept by the Keepers of the MySpace Relics. Also known as DBYC, Dreamliner's Better YouTube Client: no ads, no Shorts.</p>
      <p class="lore">A single MySpace server cries in the back.</p>
      <p><a class="btn" href="https://lsamman.github.io/legend-of-chris-wiki/myspace.html" target="_blank" rel="noopener">Read about MySpace on the wiki ↗</a></p></section></div>`;
  view.querySelectorAll("input[name=theme]").forEach(r => r.onchange = () => setTheme(r.value));
  view.querySelectorAll("input[name=playback]").forEach(r => r.onchange = () => { settings.playback = r.value; toast("Playback setting saved."); });
  $("#instance").onchange = e => { settings.pipedInstance = e.target.value; toast("Piped server saved."); };
  $("#region").onchange = e => { settings.region = e.target.value.trim().toUpperCase() || "US"; };
  $("#clear-history").onclick = () => { del("history"); del("discover"); toast("Watch history cleared."); };
  const so = $("#signout");
  if (so) so.onclick = () => { yt.signOut(); toast("Signed out."); settingsPage(); };
}

// ---------- light / dark ----------
function setTheme(t) {
  if (t === "light" || t === "dark") { document.documentElement.dataset.theme = t; set("theme", t); }
  else { delete document.documentElement.dataset.theme; del("theme"); }
}
$("#theme-btn").addEventListener("click", () => {
  const now = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setTheme(now === "dark" ? "light" : "dark");
  toast(now === "dark" ? "Day sky." : "Night sky.");
  document.querySelectorAll("input[name=theme]").forEach(r => { r.checked = r.value === (get("theme", "auto") || "auto"); });
});

// ---------- routing ----------
function route() {
  const rid = ++renderId;
  player.stop();
  const h = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = /^\/([^/?]*)\/?([^?]*)?/.exec(h) || [];
  document.querySelectorAll("[data-nav]").forEach(a => a.toggleAttribute("aria-current", a.dataset.nav === ({ playlist: "playlists", "": "home" }[page || ""] ?? page)));
  document.title = "MySpace v1.3.3";
  window.scrollTo(0, 0);
  if (page === "watch" && arg) return watch(rid, decodeURIComponent(arg));
  if (page === "channel" && arg) return channelPage(rid, decodeURIComponent(arg));
  if (page === "search") return search(rid, decodeURIComponent(arg || ""));
  if (page === "settings") return settingsPage();
  if (page === "subscriptions") return subscriptionsPage(rid);
  if (page === "discover") return discoverPage(rid);
  if (page === "playlists") return playlistsPage(rid);
  if (page === "playlist" && arg) return playlistPage(rid, decodeURIComponent(arg));
  $("#search-input").value = "";
  return home(rid);
}

$("#search-form").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#search-input").value.trim();
  if (!q) return;
  // Pasting a YouTube link opens the video directly.
  const m = /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/.exec(q);
  location.hash = m ? `#/watch/${m[1]}` : `#/search/${encodeURIComponent(q)}`;
  $("#search-input").blur();
});
// Start fetching a video's stream as soon as you point at (or touch) it, so it's ready on click.
let warmTimer = null;
function warm(e) {
  const a = e.target.closest && e.target.closest('a[href^="#/watch/"]');
  if (!a || settings.playback === "youtube") return;
  clearTimeout(warmTimer);
  warmTimer = setTimeout(() => { piped.streamsFor(a.getAttribute("href").slice(8)).catch(() => {}); player.warmUp(); }, e.type === "touchstart" ? 0 : 120);
}
document.addEventListener("pointerover", warm, { passive: true });
document.addEventListener("touchstart", warm, { passive: true });
document.addEventListener("focusin", warm);

addEventListener("hashchange", route);
renderAccount();
route();
