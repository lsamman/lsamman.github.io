// Piped (https://github.com/TeamPiped/Piped): an open-source, ad-free front door to YouTube.
// Public servers come and go, so every request tries several and remembers the one that worked.
import { PIPED_INSTANCES, PIPED_INSTANCE_LIST } from "./config.js?v=20261007170436";
import { get, set, settings } from "./store.js?v=20261007170436";

const TIMEOUT = 8000;   // give up on one server after this long
const HEDGE = 1500;     // ask the next server too if the current one is this slow
let listLoaded = false;

async function fetchJSON(url, timeout = TIMEOUT, outer) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  if (outer) outer.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.error) throw new Error(data.error);
    return data;
  } finally { clearTimeout(t); }
}

async function candidates() {
  const pinned = settings.pipedInstance;
  if (pinned) return [pinned];
  let list = get("pipedList", null) || PIPED_INSTANCES;
  if (!listLoaded) {
    listLoaded = true;
    fetchJSON(PIPED_INSTANCE_LIST, 5000).then(all => {
      const urls = all.filter(i => i.api_url && i.up_to_date !== false).map(i => i.api_url.replace(/\/$/, ""));
      if (urls.length) set("pipedList", [...new Set([...PIPED_INSTANCES, ...urls])]);
    }).catch(() => {});
  }
  const last = get("pipedLast", "");
  return [...new Set([last, ...list].filter(Boolean))];
}

// Ask the server that worked last time; if it's slow or fails, ask the next one as well
// (and the next…). Whichever answers first wins and the others are cancelled.
function race(list, path) {
  return new Promise((resolve, reject) => {
    let next = 0, failed = 0, done = false, lastErr = null;
    const ctrls = [];
    const finish = () => { done = true; clearInterval(hedge); ctrls.forEach(c => c.abort()); };
    const launch = () => {
      if (done || next >= list.length) return;
      const base = list[next++], ctrl = new AbortController();
      ctrls.push(ctrl);
      fetchJSON(base + path, TIMEOUT, ctrl.signal).then(data => {
        if (done) return;
        finish(); set("pipedLast", base);
        resolve({ data, instance: base });
      }, e => {
        if (done) return;
        lastErr = e; failed++;
        if (failed >= list.length) { finish(); reject(new Error("No Piped server answered" + (lastErr ? ` (${lastErr.message})` : ""))); }
        else launch();
      });
    };
    const hedge = setInterval(launch, HEDGE);
    launch();
  });
}

// Answers are kept for a few minutes, so going back and forth between pages is instant.
const memo = new Map();
export async function api(path, ttl = 5 * 60000) {
  const hit = memo.get(path);
  if (hit && hit.until > Date.now()) return hit.promise;
  const promise = candidates().then(list => race(list.slice(0, 6), path));
  memo.set(path, { promise, until: Date.now() + ttl });
  promise.catch(() => memo.delete(path));
  return promise;
}

const idFrom = url => (/[?&]v=([\w-]{11})/.exec(url || "") || [])[1] || (/^\/?([\w-]{11})$/.exec(url || "") || [])[1];
const channelFrom = url => (/\/channel\/([\w-]+)/.exec(url || "") || [])[1];

// Piped's list items → DBYC's video shape
export function video(item) {
  return {
    id: idFrom(item.url),
    title: item.title,
    channelId: channelFrom(item.uploaderUrl),
    channelName: item.uploaderName,
    channelAvatar: item.uploaderAvatar,
    published: item.uploaded > 0 ? item.uploaded : null,
    publishedText: item.uploadedDate,
    duration: item.duration,
    views: item.views,
    isShort: Boolean(item.isShort),
    description: item.shortDescription || ""
  };
}
const streams = items => (items || []).filter(i => !i.type || i.type === "stream").map(video);

export async function search(q, nextpage) {
  const path = nextpage
    ? `/nextpage/search?q=${encodeURIComponent(q)}&filter=videos&nextpage=${encodeURIComponent(nextpage)}`
    : `/search?q=${encodeURIComponent(q)}&filter=videos`;
  const { data } = await api(path);
  return { items: streams(data.items), nextpage: data.nextpage || null };
}

export async function trending(region) {
  const { data } = await api(`/trending?region=${encodeURIComponent(region || "US")}`, 30 * 60000);
  const items = streams(data);
  set("trending", { at: Date.now(), region, items });
  return items;
}
export function cachedTrending(region) {
  const t = get("trending", null);
  return t && t.region === region && t.at > Date.now() - 12 * 3600000 ? t : null;
}

export async function channel(id, nextpage) {
  const path = nextpage ? `/nextpage/channel/${encodeURIComponent(id)}?nextpage=${encodeURIComponent(nextpage)}` : `/channel/${encodeURIComponent(id)}`;
  const { data } = await api(path);
  return {
    id: data.id || id, name: data.name, avatar: data.avatarUrl, banner: data.bannerUrl,
    description: data.description, subscribers: data.subscriberCount,
    items: streams(data.relatedStreams), nextpage: data.nextpage || null
  };
}

// Everything needed to play a video without ads, plus its details.
export async function streamsFor(id) {
  const { data, instance } = await api(`/streams/${encodeURIComponent(id)}`);
  return {
    instance,
    hls: data.hls || null,
    progressive: (data.videoStreams || []).filter(s => !s.videoOnly && s.url)
      .sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0)),
    details: {
      id, title: data.title, description: data.description, descriptionIsHtml: true,
      channelId: channelFrom(data.uploaderUrl), channelName: data.uploader, channelAvatar: data.uploaderAvatar,
      views: data.views, likes: data.likes, published: data.uploadDate ? Date.parse(data.uploadDate) : null,
      duration: data.duration
    },
    related: streams(data.relatedStreams)
  };
}

// YouTube's own "related videos" for a video (what YouTube thinks goes with it).
export async function related(id) {
  const { data } = await api(`/streams/${encodeURIComponent(id)}`);
  return streams(data.relatedStreams);
}
