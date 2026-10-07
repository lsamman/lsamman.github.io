// DBYC: Dreamliner's Better YouTube Client. YouTube without the ads or the Shorts.
import * as piped from "./piped.js?v=20261007140750";
import * as yt from "./youtube.js?v=20261007140750";
import * as player from "./player.js?v=20261007140750";
import { settings, get } from "./store.js?v=20261007140750";
import { PIPED_INSTANCES } from "./config.js?v=20261007140750";
import { esc, duration, views, ago, thumb, noShorts, linkify, htmlToText } from "./util.js?v=20261007140750";

const view = document.getElementById("view");
const $ = (sel, root = document) => root.querySelector(sel);
let renderId = 0;   // ignore results from a page the user already left

function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 4000);
}

// ---------- pieces ----------
function card(v) {
  const meta = [v.views != null ? views(v.views) : "", v.published ? ago(v.published) : v.publishedText || ""].filter(Boolean).join(" · ");
  const chan = v.channelId ? `<a href="#/channel/${esc(v.channelId)}">${esc(v.channelName || "")}</a>` : esc(v.channelName || "");
  return `<article class="card">
    <a class="thumb" href="#/watch/${esc(v.id)}"><img src="${thumb(v.id)}" alt="" loading="lazy">${v.duration ? `<span class="dur">${duration(v.duration)}</span>` : ""}</a>
    <div class="card-body">
      ${v.channelAvatar ? `<img class="avatar" src="${esc(v.channelAvatar)}" alt="" loading="lazy">` : ""}
      <div><a class="card-title" href="#/watch/${esc(v.id)}">${esc(v.title)}</a>
      <div class="card-meta">${chan}</div><div class="card-meta">${meta}</div></div>
    </div></article>`;
}
const grid = list => `<div class="grid">${noShorts(list).map(card).join("")}</div>`;
const loading = text => `<p class="loading">${esc(text || "Loading")}</p>`;
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
    view.innerHTML = `<h1>Subscriptions</h1><p class="sub">Newest videos from your channels. No Shorts.</p>${loading("Loading your subscriptions")}`;
    try {
      const f = await yt.feed();
      if (rid !== renderId) return;
      view.innerHTML = `<div class="row" style="justify-content:space-between"><div><h1>Subscriptions</h1>
        <p class="sub">${f.subs.length} channel${f.subs.length === 1 ? "" : "s"} · updated ${ago(f.at)} · no Shorts</p></div>
        <button class="btn" type="button" id="refresh">Refresh</button></div>` +
        (f.items.length ? grid(f.items) : notice("No recent videos from your subscriptions."));
      $("#refresh").onclick = async () => { view.innerHTML = loading("Refreshing"); await yt.feed({ force: true }).catch(e => toast(e.message)); route(); };
      return;
    } catch (e) {
      if (rid !== renderId) return;
      if (e.code !== "auth") { view.innerHTML = `<h1>Subscriptions</h1>` + notice(esc(e.message), "bad"); return; }
    }
  }
  const intro = yt.canSignIn
    ? notice(`<b>${yt.wasSignedIn() ? "Your Google sign-in expired." : "See your subscriptions here."}</b> ${yt.wasSignedIn() ? "Sign in again to load your feed." : "Sign in with Google (read-only) to get the newest videos from the channels you follow."}<div class="row" style="margin-top:10px">${signInButton(yt.wasSignedIn() ? "Sign in again" : "Sign in with Google")}</div>`)
    : notice("Google sign-in isn't set up yet, so here's what's trending. See the README to connect your subscriptions.", "warn");
  view.innerHTML = intro + `<h1>Trending</h1><p class="sub">No ads, no Shorts.</p>${loading()}`;
  try {
    const items = await piped.trending(settings.region);
    if (rid !== renderId) return;
    view.innerHTML = intro + `<h1>Trending</h1><p class="sub">No ads, no Shorts.</p>` + grid(items);
  } catch (e) {
    if (rid !== renderId) return;
    view.innerHTML = intro + `<h1>Trending</h1>` + notice(`Trending is unavailable right now: ${esc(e.message)}. Try searching instead.`, "warn");
  }
}

async function search(rid, q) {
  $("#search-input").value = q;
  view.innerHTML = `<h1>${esc(q)}</h1>${loading("Searching")}`;
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
  view.innerHTML = `<div class="watch"><div class="main">
      <div class="player" id="player"></div>
      <p class="source" id="source"></p>
      <h1 id="title"></h1><div id="details"></div></div>
    <aside class="side"><h2>Up next</h2><div id="related">${loading()}</div></aside></div>`;
  const res = await player.play($("#player"), id, settings.playback);
  if (rid !== renderId) return;
  const src = $("#source");
  if (res.source === "piped") src.innerHTML = `<b>● Ad-free</b> via Piped (${esc(new URL(res.instance).host)}) <button type="button" id="use-yt">Use YouTube's player</button>`;
  else if (res.source === "youtube") {
    src.classList.add("yt");
    src.innerHTML = `<b>● YouTube player</b> ${res.fellBack ? "· Piped couldn't play this, so YouTube may show ads" : "· YouTube may show ads"} ${settings.playback !== "youtube" ? '<button type="button" id="retry">Try ad-free again</button>' : ""}`;
  }
  const useYt = $("#use-yt"), retry = $("#retry");
  if (useYt) useYt.onclick = async () => { const r = await player.play($("#player"), id, "youtube"); src.classList.add("yt"); src.innerHTML = "<b>● YouTube player</b> · YouTube may show ads"; };
  if (retry) retry.onclick = () => route();

  let d = res.details, related = res.related || [];
  if (!d && yt.signedIn()) d = (await yt.videos([id]).catch(() => []))[0];
  if (rid !== renderId) return;
  if (d) {
    document.title = d.title + " · DBYC";
    $("#title").textContent = d.title;
    const text = d.descriptionIsHtml ? htmlToText(d.description) : d.description || "";
    const stats = [d.views != null ? views(d.views) : "", d.published ? ago(d.published) : "", d.likes ? d.likes.toLocaleString() + " likes" : ""].filter(Boolean).join(" · ");
    $("#details").innerHTML = `<div class="channel-line">${d.channelAvatar ? `<img class="avatar" src="${esc(d.channelAvatar)}" alt="">` : ""}
      <a class="name" href="#/channel/${esc(d.channelId)}">${esc(d.channelName)}</a></div>
      <div class="desc" id="desc"><span class="stats">${esc(stats)}</span>${linkify(text)}</div>`;
    $("#desc").onclick = e => { if (!e.target.closest("a")) e.currentTarget.classList.add("open"); };
  }
  if (!related.length && d && d.channelId) {
    related = await piped.channel(d.channelId).then(c => c.items)
      .catch(() => yt.signedIn() ? yt.channel(d.channelId).then(c => c.items) : []).catch(() => []);
  }
  if (rid !== renderId) return;
  related = noShorts(related).filter(v => v.id !== id).slice(0, 20);
  $("#related").innerHTML = related.length ? related.map(card).join("") : '<p class="sub">Nothing to suggest.</p>';
}

async function channelPage(rid, id) {
  view.innerHTML = loading("Loading channel");
  let c;
  try { c = await piped.channel(id); }
  catch (e) {
    if (yt.signedIn()) c = await yt.channel(id).catch(() => null);
    if (!c) { if (rid === renderId) view.innerHTML = notice(`Couldn't load this channel: ${esc(e.message)}`, "bad"); return; }
  }
  if (rid !== renderId) return;
  document.title = (c.name || "Channel") + " · DBYC";
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
  document.title = "Settings · DBYC";
  const p = yt.profile();
  const list = get("pipedList", null) || PIPED_INSTANCES;
  const pb = settings.playback;
  const opt = (v, label, help) => `<label class="choice"><input type="radio" name="playback" value="${v}" ${pb === v ? "checked" : ""}><span>${label}<small>${help}</small></span></label>`;
  view.innerHTML = `<div class="settings"><h1>Settings</h1><p class="sub">Saved on this device.</p>
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
        : yt.signedIn() ? `<p>Signed in as <b>${esc(p?.name || "you")}</b>, read-only. DBYC can see your subscriptions but can't change anything on your account.</p><button class="btn" type="button" id="signout">Sign out</button>`
        : `<p>Sign in to see your subscriptions. Read-only: DBYC can't change anything on your account.</p>${signInButton()}`}
    </section>
    <section class="setting"><h2>About</h2><p>DBYC, Dreamliner's Better YouTube Client. No ads, no Shorts.</p></section></div>`;
  view.querySelectorAll("input[name=playback]").forEach(r => r.onchange = () => { settings.playback = r.value; toast("Playback setting saved."); });
  $("#instance").onchange = e => { settings.pipedInstance = e.target.value; toast("Piped server saved."); };
  $("#region").onchange = e => { settings.region = e.target.value.trim().toUpperCase() || "US"; };
  const so = $("#signout");
  if (so) so.onclick = () => { yt.signOut(); toast("Signed out."); settingsPage(); };
}

// ---------- routing ----------
function route() {
  const rid = ++renderId;
  player.stop();
  const h = location.hash.replace(/^#/, "") || "/";
  const [, page, arg] = /^\/([^/?]*)\/?([^?]*)?/.exec(h) || [];
  document.querySelectorAll("[data-nav]").forEach(a => a.toggleAttribute("aria-current", a.dataset.nav === (page || "home")));
  document.title = "DBYC";
  window.scrollTo(0, 0);
  if (page === "watch" && arg) return watch(rid, decodeURIComponent(arg));
  if (page === "channel" && arg) return channelPage(rid, decodeURIComponent(arg));
  if (page === "search") return search(rid, decodeURIComponent(arg || ""));
  if (page === "settings") return settingsPage();
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
addEventListener("hashchange", route);
renderAccount();
route();
