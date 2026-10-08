// Small helpers: safe HTML, times in the 2007 style, Bluesky rich text and links.

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "about 3 hours ago", like the 2007 Mini-Feed.
export function ago(t) {
  const ms = typeof t === "number" ? t : Date.parse(t);
  if (!ms) return "";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "less than a minute ago";
  const m = Math.round(s / 60);
  if (m < 2) return "about a minute ago";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(s / 3600);
  if (h < 2) return "about an hour ago";
  if (h < 24) return `about ${h} hours ago`;
  const d = Math.round(s / 86400);
  if (d < 2) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return "on " + new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export const fullDate = t => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }); };

export const num = n => Number(n || 0).toLocaleString("en-US");
export const plural = (n, one, many = one + "s") => `${num(n)} ${n === 1 ? one : many}`;

// Only http(s) links ever become hrefs.
export function safeUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; }
  catch (e) { return ""; }
}

export const profileHref = actor => "#/profile/" + encodeURIComponent(actor);
export const bskyProfile = actor => "https://bsky.app/profile/" + encodeURIComponent(actor);
export function bskyPost(uri, handle) {
  // at://did/app.bsky.feed.post/rkey -> https://bsky.app/profile/handle/post/rkey
  const m = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(uri || "");
  if (!m) return "https://bsky.app";
  return `https://bsky.app/profile/${encodeURIComponent(handle || m[1])}/post/${encodeURIComponent(m[2])}`;
}

const shortLink = u => { const s = u.replace(/^https?:\/\//, "").replace(/\/$/, ""); return s.length > 40 ? s.slice(0, 38) + "…" : s; };
const link = (href, text, cls = "") => `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ""} target="_blank" rel="noopener nofollow">${esc(text)}</a>`;

// Plain text without facets: link bare URLs and @handles.
function linkifyPlain(text) {
  const re = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(^|[\s(])@([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi;
  let out = "", last = 0, m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    if (m[1]) { const u = safeUrl(m[1]); out += u ? link(u, shortLink(m[1])) : esc(m[1]); }
    else out += esc(m[2]) + `<a href="${esc(profileHref(m[3]))}">@${esc(m[3])}</a>`;
    last = re.lastIndex;
  }
  return out + esc(text.slice(last));
}

// Bluesky rich text. Facets point at UTF-8 byte ranges, so slice the bytes, not the string.
export function richText(text, facets) {
  text = String(text || "");
  if (!Array.isArray(facets) || !facets.length) return linkifyPlain(text).replace(/\n/g, "<br>");
  const enc = new TextEncoder(), dec = new TextDecoder();
  const bytes = enc.encode(text);
  const sorted = facets
    .filter(f => f && f.index && Number.isInteger(f.index.byteStart) && Number.isInteger(f.index.byteEnd) && f.index.byteEnd > f.index.byteStart)
    .sort((a, b) => a.index.byteStart - b.index.byteStart);
  let out = "", pos = 0;
  for (const f of sorted) {
    const { byteStart, byteEnd } = f.index;
    if (byteStart < pos || byteEnd > bytes.length) continue;
    out += esc(dec.decode(bytes.slice(pos, byteStart)));
    const seg = dec.decode(bytes.slice(byteStart, byteEnd));
    const feat = (f.features || [])[0] || {};
    const type = feat.$type || "";
    if (type.endsWith("#mention") && feat.did) out += `<a href="${esc(profileHref(feat.did))}">${esc(seg)}</a>`;
    else if (type.endsWith("#link") && safeUrl(feat.uri)) out += link(safeUrl(feat.uri), seg);
    else if (type.endsWith("#tag") && feat.tag) out += link("https://bsky.app/hashtag/" + encodeURIComponent(feat.tag), seg);
    else out += esc(seg);
    pos = byteEnd;
  }
  out += esc(dec.decode(bytes.slice(pos)));
  return out.replace(/\n/g, "<br>");
}

// Turn what someone typed into a handle: "@Alice.bsky.social " -> "alice.bsky.social". bsky.app profile links work too.
export function cleanHandle(q) {
  let s = String(q || "").trim();
  const m = /bsky\.app\/profile\/([^/?#\s]+)/i.exec(s);
  if (m) s = decodeURIComponent(m[1]);
  s = s.replace(/^@/, "");
  return s.startsWith("did:") ? s : s.toLowerCase();
}
export const looksLikeHandle = s => /^did:(plc|web):[a-z0-9._:%-]+$/i.test(s) || /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s);
