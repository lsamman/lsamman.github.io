// The official YouTube Data API, signed in with Google (read-only), for your subscriptions.
import { GOOGLE_CLIENT_ID } from "./config.js";
import { get, set, del } from "./store.js";
import { isoDuration } from "./util.js";

const API = "https://www.googleapis.com/youtube/v3";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
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
        set("token", { value: resp.access_token, expires: Date.now() + (resp.expires_in || 3600) * 1000 });
        p && p.resolve();
      },
      error_callback: err => { const p = pending; pending = null; p && p.reject(new Error(err.message || err.type || "Sign-in cancelled")); }
    });
  }
  await new Promise((resolve, reject) => {
    pending = { resolve, reject };
    tokenClient.requestAccessToken({ prompt: wasSignedIn() ? "" : "consent" });
  });
  const me = await call("/channels", { part: "snippet", mine: "true" });
  const c = me.items && me.items[0];
  set("profile", c ? { id: c.id, name: c.snippet.title, avatar: c.snippet.thumbnails?.default?.url } : { name: "Signed in" });
  changed();
}

export function signOut() {
  const t = token();
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
  del("token"); del("profile"); del("feed");
  changed();
}

async function call(path, params) {
  const t = token();
  if (!t) { const e = new Error("Sign in again to load this."); e.code = "auth"; throw e; }
  const url = API + path + "?" + new URLSearchParams(params);
  const res = await fetch(url, { headers: { Authorization: "Bearer " + t } });
  if (res.status === 401) { del("token"); changed(); const e = new Error("Your Google sign-in expired. Sign in again."); e.code = "auth"; throw e; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    const e = new Error(reason === "quotaExceeded" ? "Today's YouTube API allowance is used up. It resets at midnight Pacific time."
      : data.error?.message || `YouTube API error ${res.status}`);
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
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await call("/videos", { part: "snippet,contentDetails,statistics,player", id: ids.slice(i, i + 50).join(","), maxHeight: 360 });
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
  return out;
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
export async function feed({ force = false } = {}) {
  const cached = get("feed", null);
  if (!force && cached && cached.at > Date.now() - 10 * 60000) return cached;
  const subs = await subscriptions();
  const avatars = Object.fromEntries(subs.map(s => [s.id, s.avatar]));
  const lists = await pool(subs, 8, s => call("/playlistItems", { part: "contentDetails", playlistId: "UU" + s.id.slice(2), maxResults: 8 }));
  const recent = lists.flatMap(l => (l?.items || []).map(i => ({ id: i.contentDetails.videoId, at: Date.parse(i.contentDetails.videoPublishedAt || 0) })))
    .filter(v => v.at).sort((a, b) => b.at - a.at).slice(0, 150);
  const items = (await videos(recent.map(v => v.id)))
    .map(v => ({ ...v, channelAvatar: avatars[v.channelId] }))
    .sort((a, b) => b.published - a.published);
  const result = { at: Date.now(), subs, items };
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
