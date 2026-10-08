// Formatting, Shorts detection and safe HTML helpers shared by the views.

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function duration(sec) {
  if (!sec || sec < 0) return "";
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

// ISO 8601 durations from the YouTube API, e.g. PT1H2M3S
export function isoDuration(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

export function views(n) {
  if (n == null || n < 0) return "";
  const f = (x, u) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + u;
  if (n >= 1e9) return f(n / 1e9, "B") + " views";
  if (n >= 1e6) return f(n / 1e6, "M") + " views";
  if (n >= 1e3) return f(n / 1e3, "K") + " views";
  return n + (n === 1 ? " view" : " views");
}

export function ago(ms) {
  if (!ms) return "";
  const s = (Date.now() - ms) / 1000;
  const units = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [n, u] of units) if (s >= n) { const v = Math.floor(s / n); return `${v} ${u}${v > 1 ? "s" : ""} ago`; }
  return "just now";
}

export function thumb(id) { return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`; }

// Shorts never show in DBYC. Piped marks them; for the YouTube API we look at length,
// shape (vertical player) and the #shorts tag.
export function isShort(v) {
  if (v.isShort) return true;
  if (/#shorts?\b/i.test(v.title || "") || /#shorts?\b/i.test(v.description || "")) return true;
  if (v.duration > 0 && v.duration <= 180 && v.vertical) return true;
  return false;
}
export const noShorts = list => list.filter(v => v && v.id && !isShort(v));

// Plain text with links, for descriptions (never trust remote HTML).
export function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}
export function htmlToText(html) {
  const d = new DOMParser().parseFromString(`<body>${String(html || "").replace(/<br\s*\/?>/gi, "\n")}</body>`, "text/html");
  return d.body.textContent || "";
}
