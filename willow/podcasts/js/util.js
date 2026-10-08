// Small helpers: storage, safe text, formatting.

// ---------- storage (keeps working with defaults if storage is blocked) ----------
const PREFIX = "podcasts.";
export function get(key, fallback) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
  catch (e) { return fallback; }
}
export function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
}
export function del(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) {}
}

// ---------- safe text ----------
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Episode notes often come as HTML. DOMParser never runs scripts or loads images, so this is a safe way to get the text.
export function htmlToText(html) {
  const src = String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n");
  const d = new DOMParser().parseFromString(`<body>${src}</body>`, "text/html");
  d.querySelectorAll("script, style, noscript, template").forEach(n => n.remove());
  return (d.body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
// Plain text to HTML: escaped, with links and line breaks.
export function textToHtml(text) {
  return esc(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)"'&]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`)
    .replace(/\n/g, "<br>");
}

// ---------- formatting ----------
export function clock(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}
export function length(ms) {
  if (!ms) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return min + " min";
  return Math.floor(min / 60) + " hr " + (min % 60 ? (min % 60) + " min" : "");
}
export function date(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const days = (Date.now() - d) / 864e5;
  if (days < 1 && days > -1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
// Apple artwork URLs end in e.g. /600x600bb.jpg; ask for the size we need.
export function art(url, size = 300) {
  if (!url) return "img/icon.svg";
  return String(url).replace(/\/\d+x\d+(bb|cc)?\.(jpg|png|webp)$/, `/${size}x${size}bb.$2`);
}
