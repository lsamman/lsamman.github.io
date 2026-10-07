// Storage and small helpers shared by every screen.
// Everything lives in this browser under keys that start with "ghost.". If storage is blocked
// (private mode, strict settings), the app keeps working with defaults and just forgets on reload.
const PREFIX = "ghost.";

export function get(key, fallback) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw === null ? fallback : JSON.parse(raw); }
  catch (e) { return fallback; }
}
export function set(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {} }
export function del(key) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} }
export function wipe() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) keys.push(k); }
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}
export function sessionGet(key) { try { return sessionStorage.getItem(PREFIX + key); } catch (e) { return null; } }
export function sessionSet(key, v) { try { sessionStorage.setItem(PREFIX + key, v); } catch (e) {} }

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- toast ----------
let toastTimer = 0;
export function toast(msg, ms = 2600) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("on"); setTimeout(() => { t.hidden = true; }, 250); }, ms);
}

// ---------- Snapstreak: days in a row with at least one snap or ghost sent ----------
function day(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function streak() {
  const s = get("streak", { count: 0, last: "" });
  const y = new Date(); y.setDate(y.getDate() - 1);
  return (s.last === day() || s.last === day(y)) ? s.count : 0;
}
export function bumpStreak(kind) {
  const s = get("streak", { count: 0, last: "" });
  const today = day(), y = new Date(); y.setDate(y.getDate() - 1);
  if (s.last !== today) { s.count = s.last === day(y) ? s.count + 1 : 1; s.last = today; set("streak", s); }
  const stats = get("stats", { snaps: 0, ghosts: 0 });
  stats[kind] = (stats[kind] || 0) + 1;
  set("stats", stats);
  document.dispatchEvent(new CustomEvent("ghost:stats"));
}

export function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }
export function when(t) {
  return new Date(t).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
export function left(ms) {
  if (ms <= 0) return "expired";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} min left`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h left`;
  return `${Math.round(h / 24)} days left`;
}
