// Local storage for Facebook (Pre-Cringe). Every key starts with "fb.".
// Storage can be blocked (private windows, strict settings), so every read and write is wrapped
// and the app keeps working with defaults.
const PREFIX = "fb.";

export function get(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}

export function set(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch (e) {}
}

// ---------- friends ----------
// A friend is { did, handle, displayName, avatar, added }. Handles can change, so the DID is the real key
// once we know it. The defaults are Bluesky's own accounts, so the feed isn't empty on first load.
export const DEFAULT_FRIENDS = [
  { did: "", handle: "bsky.app", displayName: "Bluesky", avatar: "", added: 0 },
  { did: "", handle: "atproto.com", displayName: "AT Protocol", avatar: "", added: 0 },
];

export function friends() {
  const list = get("friends", null);
  return Array.isArray(list) ? list : DEFAULT_FRIENDS.map(f => ({ ...f }));
}

export function saveFriends(list) { set("friends", list); }

const same = (a, b) => (a.did && b.did && a.did === b.did) || (a.handle && b.handle && a.handle.toLowerCase() === b.handle.toLowerCase());

export function isFriend(p) { return friends().some(f => same(f, p)); }

export function addFriend(p) {
  const list = friends();
  if (list.some(f => same(f, p))) return false;
  list.push({ did: p.did || "", handle: p.handle, displayName: p.displayName || "", avatar: p.avatar || "", added: Date.now() });
  saveFriends(list);
  return true;
}

export function removeFriend(p) {
  saveFriends(friends().filter(f => !same(f, p)));
}

// Fill in the DID, name and picture once a profile has loaded, so the friend list stays current.
export function refreshFriend(p) {
  const list = friends();
  const f = list.find(x => same(x, p));
  if (!f) return;
  const next = { ...f, did: p.did || f.did, handle: p.handle || f.handle, displayName: p.displayName ?? f.displayName, avatar: p.avatar ?? f.avatar };
  if (JSON.stringify(next) === JSON.stringify(f)) return;
  Object.assign(f, next);
  saveFriends(list);
}

// ---------- you ----------
export const myName = () => String(get("name", "") || "").trim();
export const myHandle = () => String(get("handle", "") || "").trim();

// Your own status updates: [{ text, at }], newest first.
export const statuses = () => { const s = get("status", []); return Array.isArray(s) ? s : []; };
export function addStatus(text) {
  const list = [{ text, at: Date.now() }, ...statuses()].slice(0, 200);
  set("status", list);
}

// ---------- pokes ----------
// Pokes you sent: [{ did, handle, name, at }], newest first.
export const pokes = () => { const p = get("pokes", []); return Array.isArray(p) ? p : []; };
export function poke(p) {
  const list = [{ did: p.did || "", handle: p.handle, name: p.displayName || p.handle, at: Date.now() }, ...pokes()].slice(0, 500);
  set("pokes", list);
}
