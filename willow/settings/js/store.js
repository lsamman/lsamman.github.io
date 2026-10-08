// Settings (Full access): every app on the phone lives on the same origin (lsamman.github.io),
// so they share one localStorage. This module knows which keys belong to which app.

export const APPS = [
  { id: "myspace",  name: "MySpace",  full: "MySpace v1.3.3", prefixes: ["dbyc."], theme: "dbyc.theme", url: "../dbyc/",
    icon: "../dbyc/img/apple-touch-icon.png" },
  { id: "bluebird", name: "Bluebird", full: "Twitter: Bluebird Variant (with no limits)", prefixes: ["bluebird."], theme: "bluebird.theme", url: "../bluebird/",
    icon: "../bluebird/img/apple-touch-icon.png" },
  { id: "snapchat", name: "Snapchat", full: "Snapchat: Ghost Protocol Edition", prefixes: ["ghost."], theme: "ghost.theme", url: "../snapchat/",
    glyph: "👻", bg: "linear-gradient(#fff86a,#f2d600)" },
  { id: "facebook", name: "Facebook", full: "Facebook (Pre-Cringe)", prefixes: ["fb."], theme: "fb.theme", url: "../facebook/",
    glyph: "f", bg: "linear-gradient(#6d8fd6,#3b5998)" },
  { id: "podcasts", name: "Podcasts", full: "Apple Podcasts 2", prefixes: ["podcasts."], theme: "podcasts.theme", url: "../podcasts/",
    glyph: "🎙", bg: "linear-gradient(#d68cf0,#8e3fc0)" },
  { id: "wiki",     name: "Wiki",     full: "The Legend Of Chris Wiki", prefixes: ["loc.", "loc-"], theme: "loc-theme", raw: true, url: "../legend-of-chris-wiki/",
    glyph: "📖", bg: "linear-gradient(#ffffff,#e3e7ea)" },
  { id: "settings", name: "Settings", full: "Settings (Full access)", prefixes: ["settings."], theme: "settings.theme", url: "./",
    icon: "img/apple-touch-icon.png" }
];
export const byId = id => APPS.find(a => a.id === id);

// ---------- safe storage ----------
export function raw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
export function put(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
export function drop(key) { try { localStorage.removeItem(key); } catch (e) {} }
export function get(key, fallback) {
  const r = raw("settings." + key);
  if (r === null) return fallback;
  try { return JSON.parse(r); } catch (e) { return fallback; }
}
export function set(key, value) { return put("settings." + key, JSON.stringify(value)); }
export function allKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== null) out.push(k); } } catch (e) {}
  return out.sort();
}

// ---------- which app owns a key ----------
export const owner = key => APPS.find(a => a.prefixes.some(p => key.startsWith(p))) || null;
export const keysFor = app => allKeys().filter(k => app.prefixes.some(p => k.startsWith(p)));
export const managedKeys = () => allKeys().filter(k => owner(k));
// localStorage keeps strings as UTF-16, so 2 bytes a character is a fair estimate.
export const bytesOf = keys => keys.reduce((n, k) => n + (k.length + (raw(k) || "").length) * 2, 0);
export function usage() {
  return APPS.map(a => { const keys = keysFor(a); return { app: a, keys, count: keys.length, bytes: bytesOf(keys) }; });
}
export function clearApp(app) { keysFor(app).forEach(drop); }

export function formatBytes(n) {
  if (n < 1024) return n + " bytes";
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

// ---------- themes ----------
// The apps store their theme as a JSON string ('"light"' or '"dark"'), and no key means auto.
// The wiki stores a raw string ('light' or 'dark') under loc-theme.
export function readTheme(app) {
  const r = raw(app.theme);
  if (r === null) return "auto";
  let v = r;
  if (!app.raw) { try { v = JSON.parse(r); } catch (e) { v = r; } }
  return v === "light" || v === "dark" ? v : "auto";
}
export function writeTheme(app, value) {
  if (value === "light" || value === "dark") put(app.theme, app.raw ? value : JSON.stringify(value));
  else drop(app.theme);
}
export function writeAllThemes(value) { APPS.forEach(a => writeTheme(a, value)); }
export function overallTheme() {
  const vals = new Set(APPS.map(readTheme));
  return vals.size === 1 ? [...vals][0] : "mixed";
}

// ---------- backup ----------
export const BACKUP_FORMAT = "iphone-3g-backup";
export function makeBackup(siteVersion) {
  const keys = {};
  managedKeys().forEach(k => { const v = raw(k); if (v !== null) keys[k] = v; });
  return { format: BACKUP_FORMAT, version: 1, from: "Settings (Full access)", site: siteVersion || null,
    exported: new Date().toISOString(), keys };
}
export function backupName(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `iphone-3g-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
// Reads a backup file's text. Only keys that belong to a known app are accepted.
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("That file isn't JSON."); }
  if (!data || typeof data !== "object" || data.format !== BACKUP_FORMAT || !data.keys || typeof data.keys !== "object")
    throw new Error("That isn't an iPhone 3G backup.");
  const keys = {}, skipped = [];
  for (const [k, v] of Object.entries(data.keys)) {
    if (typeof v === "string" && owner(k)) keys[k] = v; else skipped.push(k);
  }
  return { exported: data.exported || null, site: data.site || null, keys, skipped };
}
// What applying a backup would do. With replace, keys of the backed-up apps that aren't in the backup are removed.
export function diffBackup(backup, replace) {
  const rows = [];
  for (const [k, v] of Object.entries(backup.keys)) {
    const now = raw(k);
    rows.push({ key: k, app: owner(k), change: now === null ? "add" : now === v ? "same" : "change", value: v });
  }
  if (replace) {
    const apps = new Set(rows.map(r => r.app));
    for (const k of managedKeys()) if (!(k in backup.keys) && apps.has(owner(k))) rows.push({ key: k, app: owner(k), change: "remove" });
  }
  return rows.sort((a, b) => a.key < b.key ? -1 : 1);
}
export function applyDiff(rows) {
  let failed = 0;
  for (const r of rows) {
    if (r.change === "add" || r.change === "change") { if (!put(r.key, r.value)) failed++; }
    else if (r.change === "remove") drop(r.key);
  }
  return failed;
}
