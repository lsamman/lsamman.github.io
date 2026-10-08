// Small wrappers around localStorage; DBYC keeps working (with defaults) if storage is blocked.
const PREFIX = "dbyc.";

export function get(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}
export function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
}
export function del(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) {}
}

// playback: "auto" (Piped, fall back to YouTube) | "piped" | "youtube"
export const settings = {
  get playback() { return get("playback", "auto"); },
  set playback(v) { set("playback", v); },
  get pipedInstance() { return get("pipedInstance", ""); },   // "" = automatic
  set pipedInstance(v) { set("pipedInstance", v); },
  get region() { return get("region", "US"); },
  set region(v) { set("region", v); }
};
