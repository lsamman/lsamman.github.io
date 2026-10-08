// The player: one <audio> element that keeps playing while you move around the app.
// Remembers where you stopped in every episode, which ones you've finished, the Up Next queue and your speed.
import { get, set, art } from "./util.js?v=20261008143024";

const audio = document.getElementById("audio");
export const SPEEDS = [1, 1.25, 1.5, 2];
const listeners = new Set();
let current = get("current", null);
let queue = get("queue", []);
let speed = SPEEDS.includes(get("speed", 1)) ? get("speed", 1) : 1;
let lastSave = 0, pendingSeek = null, error = "";

export const on = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function emit(kind) { for (const fn of listeners) { try { fn(kind); } catch (e) { console.error(e); } } }

// Only what we need to play it later; descriptions stay out of storage.
const slim = ep => ({ id: ep.id, pid: ep.pid, title: ep.title, show: ep.show, url: ep.url, art: ep.art, date: ep.date, ms: ep.ms });

// ---------- saved positions and played episodes ----------
function positions() { return get("pos", {}); }
export function position(id) { const p = positions()[id]; return p ? p[0] : 0; }
export function progress(id) {
  if (isPlayed(id)) return 1;
  const p = positions()[id];
  return p && p[1] ? Math.min(1, p[0] / p[1]) : 0;
}
function savePosition(force) {
  if (!current || !audio.src) return;
  if (!force && Date.now() - lastSave < 4000) return;
  lastSave = Date.now();
  const all = positions();
  const t = audio.currentTime, d = audio.duration || (current.ms / 1000) || 0;
  if (t > 5 && !(d && t > d - 5)) all[current.id] = [Math.round(t), Math.round(d), Date.now()];
  else if (t <= 5 && all[current.id] && pendingSeek === null) delete all[current.id];
  // Keep the newest 400.
  const ids = Object.keys(all);
  if (ids.length > 400) ids.sort((a, b) => all[a][2] - all[b][2]).slice(0, ids.length - 400).forEach(k => delete all[k]);
  set("pos", all);
}
export function isPlayed(id) { return !!get("played", {})[id]; }
export function setPlayed(id, yes) {
  const all = get("played", {});
  if (yes) {
    all[id] = Date.now();
    const p = positions(); delete p[id]; set("pos", p);
  } else delete all[id];
  const ids = Object.keys(all);
  if (ids.length > 3000) ids.sort((a, b) => all[a] - all[b]).slice(0, ids.length - 3000).forEach(k => delete all[k]);
  set("played", all);
  emit("played");
}
// Episodes you've started, newest first, for "Continue listening".
export function inProgress() {
  const p = positions();
  return get("recent", []).filter(e => p[e.id] && !isPlayed(e.id));
}
function remember(ep) {
  const list = get("recent", []).filter(e => e.id !== ep.id);
  list.unshift(slim(ep));
  set("recent", list.slice(0, 30));
}

// ---------- playback ----------
export const state = () => ({
  current, queue, speed, error,
  playing: !audio.paused && !audio.ended,
  time: pendingSeek ?? audio.currentTime ?? 0,
  duration: audio.duration && isFinite(audio.duration) ? audio.duration : (current ? current.ms / 1000 : 0),
  buffering: !!current && !audio.paused && audio.readyState < 3
});

function load(ep, autoplay) {
  error = "";
  current = slim(ep);
  set("current", current);
  remember(ep);
  const start = position(ep.id);
  pendingSeek = start > 0 ? start : null;
  audio.src = ep.url;
  audio.playbackRate = speed;
  audio.defaultPlaybackRate = speed;
  if (autoplay) audio.play().catch(err => { if (err.name !== "AbortError") { error = "This episode couldn't be played."; emit("error"); } });
  else audio.load();
  updateSession();
  emit("track");
}

export function play(ep) {
  if (!ep || !ep.url) { error = "This episode has no audio file."; emit("error"); return; }
  if (current && current.id === ep.id && audio.src) { audio.play(); return; }
  savePosition(true);
  queue = queue.filter(q => q.id !== ep.id);
  set("queue", queue);
  if (isPlayed(ep.id)) setPlayed(ep.id, false);
  load(ep, true);
}
export function toggle() {
  if (!current) { if (queue.length) next(); return; }
  if (!audio.src) { load(current, true); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
export function pause() { audio.pause(); }
export function skip(sec) {
  if (!current) return;
  const d = state().duration || Infinity;
  seek(Math.max(0, Math.min(d - 1, state().time + sec)));
}
export function seek(t) {
  if (!current) return;
  if (audio.readyState >= 1) { audio.currentTime = t; pendingSeek = null; }
  else pendingSeek = t;
  emit("time");
  savePosition(true);
}
export function setSpeed(s) {
  speed = SPEEDS.includes(s) ? s : 1;
  audio.playbackRate = speed;
  audio.defaultPlaybackRate = speed;
  set("speed", speed);
  emit("speed");
}
export function cycleSpeed() { setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]); }

// ---------- Up Next ----------
export function inQueue(id) { return queue.some(q => q.id === id); }
export function enqueue(ep, first = false) {
  if (!ep.url || (current && current.id === ep.id)) return false;
  queue = queue.filter(q => q.id !== ep.id);
  if (first) queue.unshift(slim(ep)); else queue.push(slim(ep));
  set("queue", queue);
  emit("queue");
  return true;
}
export function dequeue(id) { queue = queue.filter(q => q.id !== id); set("queue", queue); emit("queue"); }
export function move(id, dir) {
  const i = queue.findIndex(q => q.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= queue.length) return;
  [queue[i], queue[j]] = [queue[j], queue[i]];
  set("queue", queue);
  emit("queue");
}
export function clearQueue() { queue = []; set("queue", queue); emit("queue"); }
export function next() {
  const ep = queue.shift();
  set("queue", queue);
  if (ep) { savePosition(true); load(ep, true); }
  else emit("queue");
}

// ---------- events ----------
audio.addEventListener("loadedmetadata", () => {
  if (pendingSeek !== null) {
    const t = pendingSeek; pendingSeek = null;
    if (!audio.duration || t < audio.duration - 5) audio.currentTime = t;
  }
  emit("time");
});
audio.addEventListener("timeupdate", () => { savePosition(false); emit("time"); updatePosition(); });
audio.addEventListener("play", () => { emit("state"); setPlaybackState(); });
audio.addEventListener("playing", () => { error = ""; emit("state"); });
audio.addEventListener("waiting", () => emit("state"));
audio.addEventListener("pause", () => { savePosition(true); emit("state"); setPlaybackState(); });
audio.addEventListener("ratechange", () => { if (audio.playbackRate !== speed && audio.playbackRate > 0) audio.playbackRate = speed; });
audio.addEventListener("ended", () => {
  if (current) setPlayed(current.id, true);
  if (queue.length) next(); else { emit("state"); setPlaybackState(); }
});
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return;
  error = "This episode couldn't be played. The file may have moved.";
  emit("error");
});
addEventListener("pagehide", () => savePosition(true));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") savePosition(true); });

// ---------- lock-screen controls (Media Session) ----------
const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
function updateSession() {
  if (!ms || !current) return;
  try {
    ms.metadata = new MediaMetadata({
      title: current.title, artist: current.show, album: "Apple Podcasts 2",
      artwork: current.art ? [256, 512].map(n => ({ src: art(current.art, n), sizes: `${n}x${n}`, type: "image/jpeg" })) : []
    });
  } catch (e) {}
}
function setPlaybackState() { if (ms) try { ms.playbackState = audio.paused ? "paused" : "playing"; } catch (e) {} }
let lastPos = 0;
function updatePosition() {
  if (!ms || !ms.setPositionState || Date.now() - lastPos < 1000) return;
  lastPos = Date.now();
  const d = audio.duration;
  if (!d || !isFinite(d)) return;
  try { ms.setPositionState({ duration: d, position: Math.min(d, audio.currentTime), playbackRate: audio.playbackRate || 1 }); } catch (e) {}
}
if (ms) {
  const act = (name, fn) => { try { ms.setActionHandler(name, fn); } catch (e) {} };
  act("play", () => toggle());
  act("pause", () => pause());
  act("seekbackward", d => skip(-((d && d.seekOffset) || 15)));
  act("seekforward", d => skip((d && d.seekOffset) || 30));
  act("seekto", d => { if (d && d.seekTime != null) seek(d.seekTime); });
  act("previoustrack", () => skip(-15));
  act("nexttrack", () => { if (queue.length) next(); else skip(30); });
}

// Put the last episode back in the player (paused) after a reload, at the saved spot.
if (current && current.url) load(current, false);
