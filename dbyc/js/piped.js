// Piped (https://github.com/TeamPiped/Piped): an open-source, ad-free front door to YouTube.
// Public servers come and go, so every request tries several and remembers the one that worked.
import { PIPED_INSTANCES, PIPED_INSTANCE_LIST } from "./config.js?v=20261007142443";
import { get, set, settings } from "./store.js?v=20261007142443";

const TIMEOUT = 7000;
let listLoaded = false;

async function fetchJSON(url, timeout = TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
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

export async function api(path) {
  let lastErr;
  for (const base of (await candidates()).slice(0, 5)) {
    try {
      const data = await fetchJSON(base + path);
      set("pipedLast", base);
      return { data, instance: base };
    } catch (e) { lastErr = e; }
  }
  throw new Error("No Piped server answered" + (lastErr ? ` (${lastErr.message})` : ""));
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
  const { data } = await api(`/trending?region=${encodeURIComponent(region || "US")}`);
  return streams(data);
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
const relatedCache = new Map();
export async function related(id) {
  if (!relatedCache.has(id)) relatedCache.set(id, api(`/streams/${encodeURIComponent(id)}`).then(r => streams(r.data.relatedStreams)));
  try { return await relatedCache.get(id); } catch (e) { relatedCache.delete(id); throw e; }
}
