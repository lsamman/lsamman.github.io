// Bluesky's public AppView API. No sign-in, CORS-enabled, read-only.
// Posting goes through Bluesky's own compose page (see app.js), so nothing here needs a password.
import { get, set } from "./store.js?v=20261008143303";
import { looksLikeHandle } from "./util.js?v=20261008143303";

const API = "https://public.api.bsky.app/xrpc/";
const TIMEOUT = 12000;
const CACHE_MS = 4 * 60 * 1000;   // the News Feed is cached for a few minutes

export class ApiError extends Error {
  constructor(message, status = 0, code = "") { super(message); this.status = status; this.code = code; }
}

export async function xrpc(method, params = {}) {
  const url = new URL(API + method);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  let res;
  try { res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } }); }
  catch (e) { throw new ApiError("Bluesky didn't answer. Try again."); }
  finally { clearTimeout(timer); }
  let body = null;
  try { body = await res.json(); } catch (e) {}
  if (!res.ok) {
    const code = body && body.error || "";
    const msg = body && body.message || "";
    // 400s carry a useful reason ("Profile not found"). Anything else is Bluesky having a bad day.
    if (res.status === 400 && msg) throw new ApiError(msg, 400, code);
    throw new ApiError("Bluesky didn't answer. Try again.", res.status, code);
  }
  if (!body || typeof body !== "object") throw new ApiError("Bluesky sent something we couldn't read. Try again.", res.status);
  return body;
}

// ---------- profiles ----------
const profiles = new Map();   // actor -> { at, data }
export async function getProfile(actor, fresh = false) {
  const hit = profiles.get(actor);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await xrpc("app.bsky.actor.getProfile", { actor });
  profiles.set(actor, { at: Date.now(), data });
  if (data.did) profiles.set(data.did, { at: Date.now(), data });
  if (data.handle) profiles.set(data.handle, { at: Date.now(), data });
  return data;
}

// ---------- search ----------
// Typeahead first. If that fails (or finds nothing) and the query looks like a handle, look it up exactly.
export async function searchPeople(q) {
  q = String(q || "").trim();
  if (!q) return [];
  let actors = null, failed = null;
  try {
    const r = await xrpc("app.bsky.actor.searchActorsTypeahead", { q, limit: 10 });
    actors = Array.isArray(r.actors) ? r.actors : [];
  } catch (e) { failed = e; }
  if (actors && actors.length) return actors;
  const tries = [];
  if (looksLikeHandle(q)) tries.push(q);
  if (!q.includes(".") && /^[a-z0-9-]+$/i.test(q)) tries.push(q + ".bsky.social");
  for (const t of tries) {
    try { return [await getProfile(t)]; } catch (e) { if (e.status !== 400) failed = e; }
  }
  if (failed && !actors) throw failed;
  return [];
}

// ---------- author feeds (with a short cache for first pages) ----------
function readCache() { const c = get("cache", {}); return c && typeof c === "object" ? c : {}; }
function writeCache(c) {
  // Keep only fresh entries, and drop the cache entirely if storage is full.
  const now = Date.now();
  for (const k of Object.keys(c)) if (!c[k] || now - c[k].at > CACHE_MS) delete c[k];
  if (!set("cache", c)) set("cache", {});
}

export async function authorFeed(actor, cursor = "", limit = 30, { fresh = false } = {}) {
  const key = actor + "|" + limit;
  if (!cursor && !fresh) {
    const hit = readCache()[key];
    if (hit && Date.now() - hit.at < CACHE_MS && hit.data) return hit.data;
  }
  const data = await xrpc("app.bsky.feed.getAuthorFeed", { actor, limit, cursor, filter: "posts_no_replies" });
  const out = { feed: Array.isArray(data.feed) ? data.feed : [], cursor: data.cursor || "" };
  if (!cursor) { const c = readCache(); c[key] = { at: Date.now(), data: out }; writeCache(c); }
  return out;
}

export function clearFeedCache() { set("cache", {}); }

// When an item belongs in the timeline. Reposts sort by when they were reposted.
// A post's createdAt is set by the poster's app and can be in the future, so it's capped at indexedAt.
export function sortAt(item) {
  const r = item.reason;
  if (r && r.indexedAt) return Date.parse(r.indexedAt) || 0;
  const p = item.post || {};
  const c = Date.parse(p.record && p.record.createdAt) || 0;
  const i = Date.parse(p.indexedAt) || 0;
  return c && i ? Math.min(c, i) : (c || i);
}

// ---------- the merged News Feed ----------
// Strictly by time, newest first, across every friend. No ranking, no "top stories".
// Each friend's feed is paged with its own cursor. An item is only shown once every friend who might still have
// something newer has been loaded past it (the "horizon"), so the order never changes under you as you page.
export class MergedFeed {
  constructor(people, { pageSize = 20, perFriend = 25, concurrency = 4 } = {}) {
    this.pageSize = pageSize; this.perFriend = perFriend; this.concurrency = concurrency;
    this.sources = people.map(friend => ({ friend, actor: friend.did || friend.handle, items: [], cursor: "", done: false, error: null, loaded: false }));
    this.shown = pageSize;
    this.busy = false;
  }

  async loadSource(s, fresh = false) {
    try {
      const r = await authorFeed(s.actor, s.cursor, this.perFriend, { fresh });
      const items = r.feed.filter(x => x && x.post && x.post.uri).map(x => ({ ...x, at: sortAt(x), friend: s.friend }));
      s.items.push(...items);
      s.cursor = r.cursor;
      s.done = !r.cursor || !items.length;
      s.error = null;
    } catch (e) {
      s.error = e; s.done = true;
    }
    s.loaded = true;
  }

  // Load everyone's first page, a few at a time. onProgress runs as each one arrives.
  async start(onProgress, { fresh = false } = {}) {
    const queue = [...this.sources];
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift();
        await this.loadSource(s, fresh);
        onProgress && onProgress(this);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, queue.length) || 1 }, worker));
  }

  get loading() { return this.sources.filter(s => !s.loaded).length; }
  get failed() { return this.sources.filter(s => s.error); }

  // The oldest moment we can vouch for: everything newer than this is loaded for every friend.
  horizon() {
    let h = -Infinity;
    for (const s of this.sources) {
      if (s.done) continue;
      if (!s.loaded) return Infinity;
      const oldest = s.items.length ? s.items[s.items.length - 1].at : Infinity;
      if (oldest > h) h = oldest;
    }
    return h;
  }

  all() {
    const seen = new Set();
    return this.sources.flatMap(s => s.items)
      .sort((a, b) => b.at - a.at)
      .filter(x => { const k = x.post.uri; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // While first pages are still arriving, show what we have so far. After that, only the confirmed part.
  visible() {
    const all = this.all();
    if (this.loading) return all.slice(0, this.shown);
    const h = this.horizon();
    return all.filter(x => x.at >= h).slice(0, this.shown);
  }

  confirmedCount() { const h = this.horizon(); return this.all().filter(x => x.at >= h).length; }

  hasMore() { return this.confirmedCount() > this.shown || this.sources.some(s => !s.done); }

  // "Older posts": show the next page, loading further back only for the friends holding the horizon up.
  async more() {
    if (this.busy) return;
    this.busy = true;
    try {
      this.shown += this.pageSize;
      let rounds = 0;
      while (this.confirmedCount() < this.shown && this.sources.some(s => !s.done) && rounds < 8) {
        const h = this.horizon();
        const limiting = this.sources.filter(s => !s.done && (s.items.length ? s.items[s.items.length - 1].at : Infinity) >= h);
        await Promise.all(limiting.map(s => this.loadSource(s)));
        rounds++;
      }
    } finally { this.busy = false; }
  }

  // Try the friends that failed again.
  async retryFailed(onProgress) {
    const bad = this.failed;
    bad.forEach(s => { s.loaded = false; s.done = false; s.error = null; });
    const queue = [...bad];
    const worker = async () => { while (queue.length) { const s = queue.shift(); await this.loadSource(s, true); onProgress && onProgress(this); } };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, queue.length) || 1 }, worker));
  }
}
