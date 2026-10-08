// The official YouTube Data API, signed in with Google: subscriptions, playlists, likes and saving.
import { GOOGLE_CLIENT_ID } from "./config.js?v=20261008143024";
import { get, set, del } from "./store.js?v=20261008143024";
import { isoDuration, isShort } from "./util.js?v=20261008143024";

const API = "https://www.googleapis.com/youtube/v3";
// Full YouTube access, so DBYC can like videos and save them to playlists (it never posts or deletes).
const SCOPE = "https://www.googleapis.com/auth/youtube";
const GIS = "https://accounts.google.com/gsi/client";

export const canSignIn = Boolean(GOOGLE_CLIENT_ID);
let tokenClient = null, pending = null;
const listeners = new Set();
export const onAuthChange = fn => listeners.add(fn);
const changed = () => listeners.forEach(fn => fn());

// A token lasts an hour; keep it so a reload doesn't ask again.
function token() {
  const t = get("token", null);
  return t && t.expires > Date.now() + 60000 ? t.value : null;
}
export const signedIn = () => Boolean(token());
// Signed in before likes and playlists existed (read-only): those need one more "Allow".
export const canWrite = () => { const t = get("token", null); return Boolean(t && t.value && String(t.scope || "").split(" ").includes(SCOPE)); };
export const wasSignedIn = () => Boolean(get("profile", null));
export const profile = () => get("profile", null);

function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS; s.async = true; s.onload = resolve;
    s.onerror = () => reject(new Error("Couldn't load Google sign-in"));
    document.head.append(s);
  });
}

// Must be called from a click (it opens Google's sign-in popup).
export async function signIn() {
  if (!canSignIn) throw new Error("Google sign-in isn't set up yet (see README).");
  await loadGis();
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPE,
      callback: resp => {
        const p = pending; pending = null;
        if (resp.error) { p && p.reject(new Error(resp.error_description || resp.error)); return; }
        set("token", { value: resp.access_token, expires: Date.now() + (resp.expires_in || 3600) * 1000, scope: resp.scope || "" });
        p && p.resolve();
      },
      error_callback: err => { const p = pending; pending = null; p && p.reject(new Error(err.message || err.type || "Sign-in cancelled")); }
    });
  }
  await new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient.requestAccessToken({ prompt: wasSignedIn() && canWrite() ? "" : "consent" });
  });
  const me = await call("/channels", { part: "snippet", mine: "true" });
  const c = me.items && me.items[0];
  set("profile", c ? { id: c.id, name: c.snippet.title, avatar: c.snippet.thumbnails?.default?.url } : { name: "Signed in" });
  changed();
}

export function signOut() {
  const t = token();
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
  del("token"); del("profile"); del("feed"); del("playlists");
  changed();
}

async function call(path, params, { method = "GET", body } = {}) {
  const t = token();
  if (!t) { const e = new Error("Sign in again to load this."); e.code = "auth"; throw e; }
  const url = API + path + "?" + new URLSearchParams(params);
  const headers = { Authorization: "Bearer " + t };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return {};
  if (res.status === 401) { del("token"); changed(); const e = new Error("Your Google sign-in expired. Sign in again."); e.code = "auth"; throw e; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    const scope = res.status === 403 && /insufficient|scope/i.test((reason || "") + " " + (data.error?.message || ""));
    const e = new Error(reason === "quotaExceeded" ? "Today's YouTube API allowance is used up. It resets at midnight Pacific time."
      : scope ? "DBYC needs permission to like and save videos. Sign in again and press Allow."
      : data.error?.message || `YouTube API error ${res.status}`);
    if (scope) { e.code = "scope"; throw e; }
    e.code = reason; throw e;
  }
  return data;
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } }
  }));
  return out;
}

// Full details for up to any number of ids (50 per request), in DBYC's video shape.
export async function videos(ids) {
  const out = [], batches = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
  const answers = await Promise.all(batches.map(b => call("/videos", { part: "snippet,contentDetails,statistics,player", id: b.join(","), maxHeight: 360 })));
  const order = new Map(ids.map((id, i) => [id, i]));
  for (const data of answers) {
    for (const v of data.items || []) {
      const w = +v.player?.embedWidth || 0, h = +v.player?.embedHeight || 0;
      out.push({
        id: v.id, title: v.snippet.title, description: v.snippet.description,
        channelId: v.snippet.channelId, channelName: v.snippet.channelTitle,
        published: Date.parse(v.snippet.publishedAt), duration: isoDuration(v.contentDetails.duration),
        views: +v.statistics?.viewCount || null, likes: +v.statistics?.likeCount || null,
        vertical: w && h ? h > w : false, live: v.snippet.liveBroadcastContent !== "none"
      });
    }
  }
  return out.sort((a, b) => order.get(a.id) - order.get(b.id));
}

export async function subscriptions() {
  const subs = []; let pageToken = "";
  for (let page = 0; page < 6; page++) {
    const data = await call("/subscriptions", { part: "snippet", mine: "true", maxResults: 50, order: "alphabetical", ...(pageToken && { pageToken }) });
    for (const s of data.items || []) subs.push({ id: s.snippet.resourceId.channelId, name: s.snippet.title, avatar: s.snippet.thumbnails?.default?.url });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return subs;
}

// Newest uploads from everyone you subscribe to. Cached for 10 minutes to save API allowance.
// cachedFeed() returns the last one (up to a day old) instantly, for showing while refreshing.
export const FEED_FRESH = 10 * 60000;
export function cachedFeed() {
  const c = get("feed", null);
  return c && c.v === 2 && c.at > Date.now() - 24 * 3600000 ? c : null;
}
let feedInFlight = null;
export function feed({ force = false } = {}) {
  const cached = cachedFeed();
  if (!force && cached && cached.at > Date.now() - FEED_FRESH) return Promise.resolve(cached);
  if (!feedInFlight) feedInFlight = loadFeed().finally(() => { feedInFlight = null; });
  return feedInFlight;
}
async function loadFeed() {
  const subs = await subscriptions();
  const avatars = Object.fromEntries(subs.map(s => [s.id, s.avatar]));
  const lists = await pool(subs, 16, s => call("/playlistItems", { part: "contentDetails", playlistId: "UU" + s.id.slice(2), maxResults: 8 }));
  const recent = lists.flatMap(l => (l?.items || []).map(i => ({ id: i.contentDetails.videoId, at: Date.parse(i.contentDetails.videoPublishedAt || 0) })))
    .filter(v => v.at).sort((a, b) => b.at - a.at).slice(0, 150);
  const items = (await videos(recent.map(v => v.id)))
    .map(v => ({ ...v, channelAvatar: avatars[v.channelId] }))
    .sort((a, b) => b.published - a.published);
  // Each channel's newest upload that isn't a Short (for the "new this week" ring).
  const newest = {}, covered = new Set(items.map(v => v.channelId));
  for (const v of items) if (!isShort(v) && !(newest[v.channelId] > v.published)) newest[v.channelId] = v.published;
  lists.forEach((l, i) => {
    const id = subs[i].id;
    if (covered.has(id)) return;   // its recent uploads were checked above
    const at = Math.max(0, ...(l?.items || []).map(x => Date.parse(x.contentDetails.videoPublishedAt || 0) || 0));
    if (at) newest[id] = at;
  });
  subs.forEach(s => { s.latest = newest[s.id] || null; });
  const result = { v: 2, at: Date.now(), subs, items };
  set("feed", result);
  return result;
}

export async function search(q) {
  const data = await call("/search", { part: "snippet", type: "video", q, maxResults: 25 });
  return videos((data.items || []).map(i => i.id.videoId));
}

export async function channel(id) {
  const [c] = (await call("/channels", { part: "snippet,brandingSettings,statistics", id })).items || [];
  const list = await call("/playlistItems", { part: "contentDetails", playlistId: "UU" + id.slice(2), maxResults: 40 });
  const items = await videos((list.items || []).map(i => i.contentDetails.videoId));
  return {
    id, name: c?.snippet?.title, avatar: c?.snippet?.thumbnails?.medium?.url, banner: c?.brandingSettings?.image?.bannerExternalUrl,
    description: c?.snippet?.description, subscribers: +c?.statistics?.subscriberCount || null,
    items: items.map(v => ({ ...v, channelAvatar: c?.snippet?.thumbnails?.default?.url })), nextpage: null
  };
}

// ---------- playlists ----------
export function cachedPlaylists() { return get("playlists", null); }
export async function playlists() {
  const out = []; let pageToken = "";
  const me = await call("/channels", { part: "contentDetails", mine: "true" });
  const liked = me.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  for (let page = 0; page < 4; page++) {
    const data = await call("/playlists", { part: "snippet,contentDetails,status", mine: "true", maxResults: 50, ...(pageToken && { pageToken }) });
    for (const p of data.items || []) out.push({
      id: p.id, title: p.snippet.title, count: p.contentDetails?.itemCount ?? null, privacy: p.status?.privacyStatus,
      thumb: p.snippet.thumbnails?.medium?.url || p.snippet.thumbnails?.default?.url
    });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  const result = { liked, items: out, at: Date.now() };
  set("playlists", result);
  return result;
}

export async function playlist(id, { max = 200 } = {}) {
  const [info] = (await call("/playlists", { part: "snippet,contentDetails,status", id })).items || [];
  const ids = []; let pageToken = "";
  while (ids.length < max) {
    const data = await call("/playlistItems", { part: "contentDetails", playlistId: id, maxResults: 50, ...(pageToken && { pageToken }) });
    ids.push(...(data.items || []).map(i => i.contentDetails.videoId));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return { id, title: info?.snippet?.title, privacy: info?.status?.privacyStatus, count: info?.contentDetails?.itemCount ?? ids.length, items: await videos(ids) };
}

export async function addToPlaylist(playlistId, videoId) {
  return call("/playlistItems", { part: "snippet" }, { method: "POST", body: { snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } } });
}

export async function createPlaylist(title, privacyStatus = "private") {
  const p = await call("/playlists", { part: "snippet,status" }, { method: "POST", body: { snippet: { title }, status: { privacyStatus } } });
  return { id: p.id, title: p.snippet?.title || title };
}

// ---------- likes ----------
export async function rating(id) {
  const data = await call("/videos/getRating", { id });
  return data.items?.[0]?.rating || "none";
}
export async function rate(id, value) {   // "like" | "dislike" | "none"
  await call("/videos/rate", { id, rating: value }, { method: "POST" });
}
