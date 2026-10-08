// The iTunes Search API, loaded with JSONP (a <script> tag) because it doesn't send CORS headers to every site.
import { get, set } from "./util.js?v=20261008143303";

let seq = 0;
export function jsonp(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const name = "__ap2cb" + Date.now().toString(36) + (seq++);
    const s = document.createElement("script");
    let done = false;
    function cleanup() {
      done = true;
      clearTimeout(timer);
      s.remove();
      // A reply that arrives after the timeout calls a no-op instead of throwing.
      window[name] = () => { delete window[name]; };
    }
    const timer = setTimeout(() => { if (!done) { cleanup(); reject(new Error("The request timed out.")); } }, timeout);
    window[name] = data => { if (done) return; cleanup(); delete window[name]; resolve(data); };
    s.onerror = () => { if (!done) { cleanup(); reject(new Error("Couldn't reach Apple's podcast directory.")); } };
    s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + name;
    document.head.appendChild(s);
  });
}

const API = "https://itunes.apple.com";
const country = () => get("country", "US");

// A podcast as the app keeps it.
export function podcastFrom(r) {
  return {
    id: String(r.collectionId || r.id),
    name: r.collectionName || r.name || r.trackName || "Untitled",
    artist: r.artistName || "",
    art: r.artworkUrl600 || r.artworkUrl100 || r.artworkUrl60 || "",
    genre: r.primaryGenreName || (r.genres && r.genres[0] && r.genres[0].name) || "",
    feed: r.feedUrl || "",
    count: r.trackCount || 0
  };
}
// An episode as the app keeps it (small enough to save in the queue).
export function episodeFrom(r, pod) {
  return {
    id: String(r.trackId),
    pid: String(r.collectionId || (pod && pod.id) || ""),
    title: r.trackName || "Untitled episode",
    show: r.collectionName || (pod && pod.name) || "",
    url: r.episodeUrl || "",
    art: r.artworkUrl600 || r.artworkUrl160 || r.artworkUrl60 || (pod && pod.art) || "",
    date: r.releaseDate || "",
    ms: r.trackTimeMillis || 0,
    desc: r.description || r.shortDescription || ""
  };
}

export async function search(term, limit = 25) {
  const q = `${API}/search?media=podcast&entity=podcast&limit=${limit}&country=${country()}&term=${encodeURIComponent(term)}`;
  const d = await jsonp(q);
  return (d.results || []).filter(r => r.collectionId).map(podcastFrom);
}

// Episodes for one podcast. Kept in memory for 10 minutes so moving around the app stays quick.
const cache = new Map();
export async function lookup(id, { fresh = false } = {}) {
  const hit = cache.get(id);
  if (hit && !fresh && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
  const d = await jsonp(`${API}/lookup?id=${encodeURIComponent(id)}&entity=podcastEpisode&limit=100&country=${country()}`);
  const results = d.results || [];
  const head = results.find(r => r.wrapperType === "track" && r.kind === "podcast") || results[0];
  if (!head) throw new Error("This podcast wasn't found.");
  const pod = podcastFrom(head);
  const episodes = results.filter(r => r !== head && r.trackId && (r.wrapperType === "podcastEpisode" || r.kind === "podcast-episode"))
    .map(r => episodeFrom(r, pod))
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  const data = { pod, episodes };
  cache.set(id, { at: Date.now(), data });
  return data;
}

// Top Podcasts: Apple's marketing feed first. If the browser can't read it, search for a few well-known shows instead.
export const FALLBACK_TERMS = ["The Daily", "This American Life", "Radiolab", "Hardcore History", "Freakonomics Radio", "99% Invisible", "Stuff You Should Know", "Serial", "The Joe Rogan Experience", "Planet Money", "Song Exploder", "Conan O'Brien Needs a Friend"];
export async function top() {
  const saved = get("top", null);
  if (saved && Date.now() - saved.at < 6 * 3600 * 1000 && saved.list.length) return saved;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`https://rss.applemarketingtools.com/api/v2/${country().toLowerCase()}/podcasts/top/25/podcasts.json`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const list = ((d.feed && d.feed.results) || []).map(podcastFrom);
    if (!list.length) throw new Error("empty");
    const out = { at: Date.now(), list, source: "chart" };
    set("top", out);
    return out;
  } catch (e) {
    const found = await Promise.all(FALLBACK_TERMS.map(t => search(t, 1).then(r => r[0], () => null)));
    const seen = new Set();
    const list = found.filter(p => p && !seen.has(p.id) && seen.add(p.id));
    if (!list.length) throw new Error("Couldn't reach Apple's podcast directory.");
    return { at: Date.now(), list, source: "picks" };
  }
}
