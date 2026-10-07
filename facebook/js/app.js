// Facebook (Pre-Cringe). The Sacred App from The Legend Of Chris, restored from a 67gb micro SD card.
// A real Bluesky client dressed as 2007 Facebook: friends are Bluesky accounts you add, the News Feed is their posts
// merged strictly by time (no algorithm, which is the whole point), profiles have an Information box and a Wall,
// status updates start with "is" and go out through Bluesky's compose page, and pokes stay on this device.
import * as store from "./store.js?v=20261007174732";
import { getProfile, searchPeople, MergedFeed, clearFeedCache } from "./bsky.js?v=20261007174732";
import { esc, ago, fullDate, num, plural, safeUrl, profileHref, bskyProfile, bskyPost, richText, cleanHandle } from "./util.js?v=20261007174732";

const view = document.getElementById("view");
const $ = (sel, root = document) => root.querySelector(sel);
const LIMIT = 300;   // Bluesky's post length, in characters (graphemes, strictly)
const HIDE_LABELS = new Set(["porn", "sexual", "nudity", "graphic-media", "gore"]);

function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3800);
}

const graphemes = s => {
  try { return [...new Intl.Segmenter().segment(s)].length; } catch (e) { return [...s].length; }
};
const intentUrl = text => "https://bsky.app/intent/compose?text=" + encodeURIComponent(text);
const nameOf = p => (p && (p.displayName || "").trim()) || (p && p.handle) || "Someone";

// The 2007 default picture: a grey silhouette with a question mark.
function pic(p, size = "") {
  const src = safeUrl(p && p.avatar);
  const cls = "pic" + (size ? " pic-" + size : "");
  return src
    ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="${cls} nopic" aria-hidden="true">?</span>`;
}

function errorBox(message, retryId) {
  return `<div class="errorbox" role="alert"><b>${esc(message || "Bluesky didn't answer. Try again.")}</b>${retryId ? ` <button class="btn" id="${retryId}">Try again</button>` : ""}</div>`;
}

// ---------- stories (one post in the feed or on a Wall) ----------
function hiddenMedia(post) {
  const labels = [...(post.labels || []), ...((post.author && post.author.labels) || [])];
  return labels.some(l => l && HIDE_LABELS.has(l.val));
}

function imagesHtml(images, sensitive) {
  const list = (images || []).filter(i => safeUrl(i.thumb)).slice(0, 4);
  if (!list.length) return "";
  const inner = list.map(i => `<a href="${esc(safeUrl(i.fullsize) || safeUrl(i.thumb))}" target="_blank" rel="noopener"><img src="${esc(safeUrl(i.thumb))}" alt="${esc(i.alt || "")}" loading="lazy" referrerpolicy="no-referrer"></a>`).join("");
  const grid = `<div class="photos n${list.length}">${inner}</div>`;
  return sensitive ? `<div class="sensitive"><button class="btn-link reveal">This post has sensitive photos. Show them</button><div hidden>${grid}</div></div>` : grid;
}

function externalHtml(ext, sensitive) {
  const u = safeUrl(ext && ext.uri);
  if (!u) return "";
  let host = ""; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch (e) {}
  const thumb = !sensitive && safeUrl(ext.thumb);
  return `<a class="linkcard" href="${esc(u)}" target="_blank" rel="noopener nofollow">
    ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
    <span><b>${esc(ext.title || host)}</b>${ext.description ? `<span class="desc">${esc(ext.description.slice(0, 200))}</span>` : ""}<span class="host">${esc(host)}</span></span></a>`;
}

function videoHtml(v, post, sensitive) {
  const thumb = !sensitive && safeUrl(v && v.thumbnail);
  return `<a class="video" href="${esc(bskyPost(post.uri, post.author && post.author.handle))}" target="_blank" rel="noopener">
    ${thumb ? `<img src="${esc(thumb)}" alt="${esc(v.alt || "")}" loading="lazy" referrerpolicy="no-referrer">` : ""}<span class="play">▶ Watch the video on Bluesky</span></a>`;
}

function mediaHtml(e, post, sensitive) {
  const t = (e && e.$type) || "";
  if (t.startsWith("app.bsky.embed.images")) return imagesHtml(e.images, sensitive);
  if (t.startsWith("app.bsky.embed.external")) return externalHtml(e.external, sensitive);
  if (t.startsWith("app.bsky.embed.video")) return videoHtml(e, post, sensitive);
  return "";
}

function quoteHtml(rec, sensitive) {
  const t = (rec && rec.$type) || "";
  if (t.endsWith("#viewNotFound")) return `<div class="quote gone">This post was deleted.</div>`;
  if (t.endsWith("#viewBlocked")) return `<div class="quote gone">This post is hidden.</div>`;
  if (t.endsWith("#viewDetached")) return `<div class="quote gone">The author removed this quote.</div>`;
  if (t.endsWith("#viewRecord")) {
    const a = rec.author || {}, v = rec.value || {};
    const inner = (rec.embeds || []).map(e => mediaHtml(e, rec, sensitive || hiddenMedia(rec))).join("");
    return `<div class="quote">
      <div class="who"><a href="${esc(profileHref(a.did || a.handle))}">${esc(nameOf(a))}</a> <span class="handle">@${esc(a.handle)}</span></div>
      <div class="text">${richText(v.text, v.facets)}</div>${inner}
      <a class="when" href="${esc(bskyPost(rec.uri, a.handle))}" target="_blank" rel="noopener">${esc(ago(v.createdAt || rec.indexedAt))}</a></div>`;
  }
  if (t.startsWith("app.bsky.feed.defs#generatorView")) return `<div class="quote"><b>Feed:</b> ${esc(rec.displayName || "A Bluesky feed")}</div>`;
  if (t.startsWith("app.bsky.graph.defs#listView")) return `<div class="quote"><b>List:</b> ${esc(rec.name || "A Bluesky list")}</div>`;
  if (t.startsWith("app.bsky.graph.defs#starterPackViewBasic")) return `<div class="quote"><b>Starter pack:</b> ${esc((rec.record && rec.record.name) || "A Bluesky starter pack")}</div>`;
  return "";
}

function embedHtml(post) {
  const e = post.embed;
  if (!e) return "";
  const sensitive = hiddenMedia(post);
  const t = e.$type || "";
  if (t.startsWith("app.bsky.embed.recordWithMedia")) return mediaHtml(e.media, post, sensitive) + quoteHtml(e.record && e.record.record, sensitive);
  if (t.startsWith("app.bsky.embed.record")) return quoteHtml(e.record, sensitive);
  return mediaHtml(e, post, sensitive);
}

function storyHtml(item, { wall = false } = {}) {
  const post = item.post, a = post.author || {}, rec = post.record || {};
  const reason = item.reason && (item.reason.$type || "").endsWith("#reasonRepost") ? item.reason : null;
  const by = reason && reason.by;
  const link = bskyPost(post.uri, a.handle);
  const counts = [
    post.replyCount ? plural(post.replyCount, "comment") : "",
    post.likeCount ? plural(post.likeCount, "like") : "",
    post.repostCount ? plural(post.repostCount, "repost") : "",
  ].filter(Boolean).join(" · ");
  const reply = rec.reply ? `<div class="shared">In reply to a post. <a href="${esc(link)}" target="_blank" rel="noopener">See the thread</a></div>` : "";
  return `<article class="story" data-at="${item.at}" data-uri="${esc(post.uri)}">
    <a class="story-pic" href="${esc(profileHref(a.did || a.handle))}" aria-hidden="true" tabindex="-1">${pic(a, "s")}</a>
    <div class="story-body">
      ${by ? `<div class="shared"><span class="ico-share" aria-hidden="true"></span><a href="${esc(profileHref(by.did || by.handle))}">${esc(nameOf(by))}</a> shared a post${wall ? "" : ` ${esc(ago(reason.indexedAt))}`}.</div>` : ""}
      ${reply}
      <div class="who"><a class="name" href="${esc(profileHref(a.did || a.handle))}">${esc(nameOf(a))}</a> <span class="handle">@${esc(a.handle)}</span></div>
      ${rec.text ? `<div class="text">${richText(rec.text, rec.facets)}</div>` : ""}
      ${embedHtml(post)}
      <div class="meta"><a href="${esc(link)}" target="_blank" rel="noopener" title="${esc(fullDate(rec.createdAt || post.indexedAt))}">${esc(ago(rec.createdAt || post.indexedAt))}</a>${counts ? ` · <span class="counts">${counts}</span>` : ""} · <a href="${esc(link)}" target="_blank" rel="noopener">Comment</a></div>
    </div>
  </article>`;
}

function wireStories(root) {
  root.querySelectorAll(".reveal").forEach(b => b.onclick = () => { b.nextElementSibling.hidden = false; b.remove(); });
}

// ---------- status box ----------
function statusBox() {
  const name = store.myName();
  return `<form class="statusbox" id="statusbox" autocomplete="off">
    <span class="sb-pic">${pic(null, "xs")}</span>
    <div class="sb-line">
      ${name ? `<a class="sb-name" href="#/profile" title="Change your name on your Profile">${esc(name)}</a>`
             : `<input id="sb-name" class="sb-nameinput" placeholder="Your name" aria-label="Your name" maxlength="40" autocapitalize="words">`}
      <span class="sb-is">is</span>
      <input id="sb-text" class="sb-text" placeholder="doing what right now?" aria-label="What are you doing?" maxlength="${LIMIT}" spellcheck="true">
    </div>
    <div class="sb-foot"><span id="sb-count" class="sb-count"></span>
      <a id="sb-share" class="btn btn-blue" href="${esc(intentUrl(""))}" target="_blank" rel="noopener">Share</a></div>
    <p class="sb-note">Share opens Bluesky's compose page with your status filled in. You finish posting there.</p>
  </form>`;
}

function statusText() {
  const name = ($("#sb-name") ? $("#sb-name").value : store.myName()).trim();
  const t = $("#sb-text").value.trim().replace(/^is\s+/i, "");
  return { name, t, full: (name ? name + " is " : "is ") + t };
}

function wireStatusBox() {
  const form = $("#statusbox");
  if (!form) return;
  const share = $("#sb-share"), count = $("#sb-count");
  const update = () => {
    const { t, full } = statusText();
    share.href = intentUrl(t ? full : "");
    const left = LIMIT - graphemes(full);
    count.textContent = t ? (left >= 0 ? `${left} left` : `${-left} too many for one Bluesky post`) : "";
    count.classList.toggle("over", left < 0);
  };
  form.addEventListener("input", update);
  form.addEventListener("submit", e => { e.preventDefault(); share.click(); });
  share.addEventListener("click", e => {
    const { name, t, full } = statusText();
    if (!t) { e.preventDefault(); $("#sb-text").focus(); toast("Type what you're doing first."); return; }
    share.href = intentUrl(full);
    if (name && !store.myName()) store.set("name", name);
    store.addStatus(full);
    setTimeout(() => { $("#sb-text") && ($("#sb-text").value = ""); update(); toast("Status saved. Finish posting it in the Bluesky tab."); }, 0);
  });
  update();
}

// ---------- News Feed ----------
let feed = null, feedSig = "";
const sigOf = list => list.map(f => f.did || f.handle).join(",");

function renderFeed() {
  const box = $("#stories"), foot = $("#feedfoot");
  if (!box || !feed) return;
  const items = feed.visible();
  const loading = feed.loading;
  const failed = feed.failed;
  let html = items.map(i => storyHtml(i)).join("");
  if (!items.length && !loading) {
    html = failed.length === feed.sources.length
      ? errorBox("Bluesky didn't answer. Try again.", "retry")
      : `<div class="empty"><b>Nothing new from your friends.</b><p>They haven't posted anything yet. Add more friends to fill your News Feed.</p><a class="btn" href="#/friends">Find friends</a></div>`;
  }
  box.innerHTML = html;
  wireStories(box);
  let f = "";
  if (loading) f = `<div class="loading"><span class="spin" aria-hidden="true"></span>Reading from the 67gb micro SD card… ${feed.sources.length - loading} of ${plural(feed.sources.length, "friend")} loaded.</div>`;
  else {
    if (failed.length && failed.length < feed.sources.length) f += `<div class="warn">Bluesky didn't answer for ${esc(failed.map(s => nameOf(s.friend)).join(", "))}. <button class="btn-link" id="retry">Try again</button></div>`;
    if (feed.busy) f += `<div class="loading"><span class="spin" aria-hidden="true"></span>Loading older posts…</div>`;
    else if (items.length && feed.hasMore()) f += `<button class="btn more" id="older">Older posts</button>`;
    else if (items.length) f += `<div class="end">That's everything. You've reached the bottom of the archives.</div>`;
  }
  foot.innerHTML = f;
  const older = $("#older");
  if (older) older.onclick = async () => { const p = feed.more(); renderFeed(); await p; renderFeed(); };
  const retry = $("#retry");
  if (retry) retry.onclick = async () => { const p = feed.retryFailed(renderFeed); renderFeed(); await p; renderFeed(); };
}

async function feedPage({ fresh = false } = {}) {
  const people = store.friends();
  view.innerHTML = `${statusBox()}
    <div class="feedhead"><h1>News Feed</h1><span class="sub">Newest first. No algorithm.</span>
      <button class="btn-link" id="refresh">Refresh</button></div>
    <div id="stories" class="stories"></div><div id="feedfoot" class="feedfoot"></div>`;
  wireStatusBox();
  $("#refresh").onclick = () => { clearFeedCache(); feed = null; feedPage({ fresh: true }); };
  if (!people.length) {
    $("#stories").innerHTML = `<div class="empty archive">
      <b>Your News Feed is empty.</b>
      <p>You have no friends yet. Even Zarkmuckerberg had friends, and he retired at age 3.</p>
      <p>Add people from Bluesky and their posts show up here, newest first.</p>
      <a class="btn btn-blue" href="#/friends">Find friends</a> <button class="btn" id="defaults">Add the default friends</button></div>`;
    $("#defaults").onclick = () => { store.saveFriends(store.DEFAULT_FRIENDS.map(f => ({ ...f }))); feedPage(); };
    return;
  }
  const sig = sigOf(people);
  if (feed && feedSig === sig && !fresh) { renderFeed(); return; }
  feed = new MergedFeed(people);
  feedSig = sig;
  const mine = feed;
  renderFeed();
  await mine.start(() => { if (mine === feed && current === "feed") renderFeed(); }, { fresh });
  if (mine !== feed) return;
  // Keep friends' names and pictures current from what came back.
  for (const s of mine.sources) {
    const own = s.items.find(i => i.post.author && (i.post.author.did === s.friend.did || i.post.author.handle === s.friend.handle));
    if (own) store.refreshFriend({ ...own.post.author, handle: s.friend.handle, did: own.post.author.did });
  }
  if (current === "feed") renderFeed();
}

// ---------- profiles ----------
let wall = null;
function renderWall() {
  const box = $("#wall"), foot = $("#wallfoot");
  if (!box || !wall) return;
  const items = wall.visible();
  if (wall.loading) { box.innerHTML = `<div class="loading"><span class="spin" aria-hidden="true"></span>Loading the Wall…</div>`; foot.innerHTML = ""; return; }
  if (wall.failed.length) { box.innerHTML = errorBox("Bluesky didn't answer. Try again.", "wallretry"); foot.innerHTML = ""; }
  else if (!items.length) { box.innerHTML = `<div class="empty small">Nothing on the Wall yet.</div>`; foot.innerHTML = ""; }
  else {
    box.innerHTML = items.map(i => storyHtml(i, { wall: true })).join("");
    wireStories(box);
    foot.innerHTML = wall.busy ? `<div class="loading"><span class="spin" aria-hidden="true"></span>Loading older posts…</div>`
      : wall.hasMore() ? `<button class="btn more" id="wallolder">Older posts</button>` : `<div class="end">That's the whole Wall.</div>`;
  }
  const older = $("#wallolder");
  if (older) older.onclick = async () => { const p = wall.more(); renderWall(); await p; renderWall(); };
  const retry = $("#wallretry");
  if (retry) retry.onclick = async () => { const p = wall.retryFailed(renderWall); renderWall(); await p; renderWall(); };
}

async function profilePage(actor) {
  if (!actor) return myProfile();
  const token = ++pageToken;
  view.innerHTML = `<div class="loading pad"><span class="spin" aria-hidden="true"></span>Looking up ${esc(actor)}…</div>`;
  let p;
  try { p = await getProfile(actor); }
  catch (e) {
    if (token !== pageToken) return;
    view.innerHTML = `<div class="pagehead"><h1>Profile</h1></div>${errorBox(e.status === 400 ? `We couldn't find ${actor} on Bluesky. Check the handle.` : e.message, "again")}`;
    const again = $("#again"); if (again) again.onclick = () => profilePage(actor);
    return;
  }
  if (token !== pageToken) return;
  store.refreshFriend(p);
  const name = nameOf(p);
  const friend = store.isFriend(p);
  const pokedTimes = store.pokes().filter(x => (x.did && x.did === p.did) || x.handle === p.handle).length;
  const banner = safeUrl(p.banner);
  view.innerHTML = `<div class="profile">
    <div class="pleft">
      <div class="bigpic">${pic(p, "l")}</div>
      <ul class="pactions">
        <li><button class="act" id="friendbtn">${friend ? "Remove from Friends" : `Add ${esc(name)} as a Friend`}</button></li>
        <li><button class="act" id="pokebtn">Poke ${esc(name)}!</button></li>
        <li><a class="act" href="${esc(intentUrl("@" + p.handle + " "))}" target="_blank" rel="noopener">Write on ${esc(name)}'s Wall</a></li>
        <li><a class="act" href="${esc(bskyProfile(p.handle || p.did))}" target="_blank" rel="noopener">View on Bluesky</a></li>
      </ul>
      <p class="pokecount" id="pokecount">${pokedTimes ? `You have poked ${esc(name)} ${pokedTimes === 1 ? "once" : num(pokedTimes) + " times"}.` : ""}</p>
    </div>
    <div class="pright">
      ${banner ? `<div class="banner"><img src="${esc(banner)}" alt="" referrerpolicy="no-referrer"></div>` : ""}
      <h1 class="pname">${esc(name)}</h1>
      <p class="phandle">@${esc(p.handle)}${friend ? ` · <span class="isfriend">✓ Your friend</span>` : ""}</p>
      <section class="box">
        <h2>Information</h2>
        <dl class="info">
          ${p.description ? `<dt>About me:</dt><dd>${richText(p.description, null)}</dd>` : ""}
          <dt>Handle:</dt><dd>@${esc(p.handle)}</dd>
          <dt>Followers:</dt><dd>${num(p.followersCount)}</dd>
          <dt>Following:</dt><dd>${num(p.followsCount)}</dd>
          <dt>Posts:</dt><dd>${num(p.postsCount)}</dd>
          ${p.createdAt ? `<dt>Member since:</dt><dd>${esc(new Date(p.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</dd>` : ""}
        </dl>
      </section>
      <section class="box">
        <h2>The Wall <span class="boxsub">Newest first</span></h2>
        <div id="wall" class="stories"></div><div id="wallfoot" class="feedfoot"></div>
      </section>
    </div>
  </div>`;
  $("#friendbtn").onclick = () => {
    if (store.isFriend(p)) { store.removeFriend(p); toast(`${name} is no longer your friend.`); }
    else { store.addFriend(p); toast(`${name} is now your friend.`); }
    profilePage(actor);
  };
  $("#pokebtn").onclick = () => {
    store.poke(p);
    const n = store.pokes().filter(x => (x.did && x.did === p.did) || x.handle === p.handle).length;
    $("#pokecount").textContent = `You have poked ${name} ${n === 1 ? "once" : num(n) + " times"}.`;
    toast(`You poked ${name}. They won't know. Pokes stay on this device.`);
  };
  wall = new MergedFeed([{ did: p.did, handle: p.handle }], { pageSize: 15, perFriend: 30 });
  const mine = wall;
  renderWall();
  await mine.start();
  if (mine === wall && token === pageToken) renderWall();
}

function myProfile() {
  const name = store.myName(), handle = store.myHandle();
  const list = store.statuses();
  view.innerHTML = `<div class="profile">
    <div class="pleft"><div class="bigpic">${pic(null, "l")}</div>
      <ul class="pactions">${handle ? `<li><a class="act" href="${esc(profileHref(handle))}">See my Bluesky Wall</a></li>` : ""}<li><a class="act" href="#/feed">Update my status</a></li></ul></div>
    <div class="pright">
      <h1 class="pname">${esc(name || "Your profile")}</h1>
      <p class="phandle">${handle ? "@" + esc(handle) : "This profile lives on this device only."}</p>
      <section class="box"><h2>Information</h2>
        <form id="meform" class="meform" autocomplete="off">
          <label>Name <input id="me-name" value="${esc(name)}" maxlength="40" placeholder="Your name" autocapitalize="words"></label>
          <label>Bluesky handle <span class="opt">(optional)</span> <input id="me-handle" value="${esc(handle)}" placeholder="you.bsky.social" autocapitalize="none" spellcheck="false"></label>
          <button class="btn btn-blue">Save</button>
        </form>
        <p class="hint">Your name starts your status updates. There's no sign-in, so this is only kept in this browser.</p>
      </section>
      <section class="box"><h2>Mini-Feed <span class="boxsub">Your status updates</span></h2>
        ${list.length ? `<ul class="minifeed">${list.map((s, i) => `<li><span class="mf-text">${esc(s.text)}</span> <span class="mf-when">${esc(ago(s.at))}</span>
          <a class="btn-link" href="${esc(intentUrl(s.text))}" target="_blank" rel="noopener">Post again</a> <button class="btn-link" data-del="${i}">Delete</button></li>`).join("")}</ul>`
          : `<div class="empty small">No status updates yet. Tell your friends what you're doing from the News Feed.</div>`}
      </section>
    </div></div>`;
  $("#meform").onsubmit = e => {
    e.preventDefault();
    store.set("name", $("#me-name").value.trim());
    store.set("handle", cleanHandle($("#me-handle").value));
    toast("Saved.");
    myProfile();
  };
  view.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const l = store.statuses(); l.splice(+b.dataset.del, 1); store.set("status", l); myProfile();
  });
}

// ---------- Friends ----------
function friendsPage(q = "") {
  const list = store.friends();
  view.innerHTML = `<div class="pagehead"><h1>Friends</h1></div>
    <section class="box">
      <h2>Find people on Bluesky</h2>
      <form id="findform" class="findform" role="search" autocomplete="off">
        <input id="findq" type="search" value="${esc(q)}" placeholder="Name or handle, like alice.bsky.social" aria-label="Name or handle" autocapitalize="none" spellcheck="false">
        <button class="btn btn-blue">Search</button>
      </form>
      <div id="results"></div>
    </section>
    <section class="box">
      <h2>Your friends <span class="boxsub">${plural(list.length, "friend")}</span></h2>
      ${list.length ? `<ul class="friendlist">${list.map((f, i) => `<li>
          <a href="${esc(profileHref(f.did || f.handle))}">${pic(f, "s")}</a>
          <div><a class="name" href="${esc(profileHref(f.did || f.handle))}">${esc(nameOf(f))}</a><span class="handle">@${esc(f.handle)}</span></div>
          <button class="btn" data-remove="${i}">Remove</button></li>`).join("")}</ul>`
        : `<div class="empty small">No friends yet. Search above, or <button class="btn-link" id="defaults">add the default friends</button>.</div>`}
    </section>`;
  $("#findform").onsubmit = e => { e.preventDefault(); const v = $("#findq").value.trim(); if (v) location.hash = "#/friends/" + encodeURIComponent(v); };
  view.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
    const f = list[+b.dataset.remove];
    store.removeFriend(f); toast(`${nameOf(f)} is no longer your friend.`); friendsPage(q);
  });
  const d = $("#defaults");
  if (d) d.onclick = () => { store.saveFriends(store.DEFAULT_FRIENDS.map(f => ({ ...f }))); friendsPage(q); };
  if (q) runSearch(q);
}

async function runSearch(q) {
  const out = $("#results"), token = pageToken;
  out.innerHTML = `<div class="loading"><span class="spin" aria-hidden="true"></span>Searching…</div>`;
  let actors;
  try { actors = await searchPeople(cleanHandle(q).startsWith("did:") ? cleanHandle(q) : q.replace(/^@/, "").trim()); }
  catch (e) {
    if (token !== pageToken) return;
    out.innerHTML = errorBox(e.message, "searchagain");
    $("#searchagain").onclick = () => runSearch(q);
    return;
  }
  if (token !== pageToken) return;
  if (!actors.length) { out.innerHTML = `<div class="empty small">Nobody on Bluesky matches "${esc(q)}". Try their full handle, like name.bsky.social.</div>`; return; }
  out.innerHTML = `<ul class="friendlist results">${actors.map((a, i) => `<li>
      <a href="${esc(profileHref(a.did || a.handle))}">${pic(a, "s")}</a>
      <div><a class="name" href="${esc(profileHref(a.did || a.handle))}">${esc(nameOf(a))}</a><span class="handle">@${esc(a.handle)}</span>
        ${a.description ? `<span class="desc">${esc(a.description.slice(0, 120))}</span>` : ""}</div>
      ${store.isFriend(a) ? `<span class="isfriend">✓ Friends</span>` : `<button class="btn btn-blue" data-add="${i}">Add as Friend</button>`}</li>`).join("")}</ul>`;
  out.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
    const a = actors[+b.dataset.add];
    store.addFriend(a);
    toast(`${nameOf(a)} is now your friend.`);
    friendsPage(q);
  });
}

// ---------- Pokes ----------
function pokesPage() {
  store.set("pokesSeen", true);
  updateBadge();
  const sent = store.pokes();
  const byPerson = new Map();
  for (const p of sent) {
    const k = p.did || p.handle;
    const e = byPerson.get(k) || { ...p, count: 0, last: 0 };
    e.count++; e.last = Math.max(e.last, p.at);
    byPerson.set(k, e);
  }
  const zark = store.get("zarkPokes", 0);
  view.innerHTML = `<div class="pagehead"><h1>Pokes</h1></div>
    <section class="box"><h2>You have been poked</h2>
      <ul class="pokelist"><li>${pic(null, "s")}<div><b>Zarkmuckerberg</b> poked you.
        <span class="desc">This poke was found on the micro SD card. Zarkmuckerberg retired at age 3, so it may be old.</span></div>
        <button class="btn" id="zark">Poke back</button></li></ul>
      ${zark ? `<p class="hint">You have poked Zarkmuckerberg back ${zark === 1 ? "once" : num(zark) + " times"}. He has not noticed.</p>` : ""}
    </section>
    <section class="box"><h2>Pokes you sent <span class="boxsub">Kept on this device. Nobody is told.</span></h2>
      ${byPerson.size ? `<ul class="pokelist">${[...byPerson.values()].map(p => `<li>
          <div><a class="name" href="${esc(profileHref(p.did || p.handle))}">${esc(p.name || p.handle)}</a>
          <span class="desc">Poked ${p.count === 1 ? "once" : num(p.count) + " times"}, last ${esc(ago(p.last))}.</span></div>
          <button class="btn" data-poke="${esc(p.did || p.handle)}">Poke again</button></li>`).join("")}</ul>
          <button class="btn-link" id="clearpokes">Forget all my pokes</button>`
        : `<div class="empty small">You haven't poked anyone. Open a friend's profile and press Poke.</div>`}
    </section>`;
  $("#zark").onclick = () => { store.set("zarkPokes", zark + 1); toast("Zarkmuckerberg is retired. Your poke was filed in the Projects National Archives."); pokesPage(); };
  view.querySelectorAll("[data-poke]").forEach(b => b.onclick = () => {
    const p = byPerson.get(b.dataset.poke);
    store.poke({ did: p.did, handle: p.handle, displayName: p.name });
    toast(`You poked ${p.name || p.handle} again.`);
    pokesPage();
  });
  const c = $("#clearpokes");
  if (c) c.onclick = () => { if (confirm("Forget every poke you've sent?")) { store.set("pokes", []); pokesPage(); } };
}

function updateBadge() {
  const b = $("#poke-badge");
  if (b) { b.hidden = !!store.get("pokesSeen", false); b.textContent = "1"; }
}

// ---------- routing ----------
let current = "", pageToken = 0;
function route() {
  const [, page = "feed", ...rest] = location.hash.split("/");
  const arg = rest.length ? decodeURIComponent(rest.join("/")) : "";
  const known = ["feed", "profile", "friends", "pokes"];
  current = known.includes(page) ? page : "feed";
  pageToken++;
  document.querySelectorAll("[data-nav]").forEach(a => {
    const on = a.dataset.nav === current && !(current === "profile" && arg && arg !== store.myHandle());
    a.classList.toggle("on", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (current === "profile") profilePage(arg);
  else if (current === "friends") friendsPage(arg);
  else if (current === "pokes") pokesPage();
  else feedPage();
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

$("#topsearch").addEventListener("submit", e => {
  e.preventDefault();
  const q = $("#topq").value.trim();
  if (!q) return;
  $("#topq").value = "";
  $("#topq").blur();
  location.hash = "#/friends/" + encodeURIComponent(q);
});

// Refresh the "about 3 hours ago" times now and then without reloading anything.
setInterval(() => { if (current === "feed" && feed && !feed.loading && !feed.busy && !document.activeElement?.matches("input")) renderFeed(); }, 60000);

addEventListener("hashchange", route);
updateBadge();
route();
