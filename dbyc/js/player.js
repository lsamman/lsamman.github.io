// Plays a video ad-free through Piped, or with YouTube's own player, depending on the
// Playback setting. In "auto" mode a Piped failure falls back to YouTube's player.
import { streamsFor } from "./piped.js?v=20261007165958";

const HLS_JS = "https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js";
const START_TIMEOUT = 12000;
let hlsInstance = null;

function loadHlsJs() {
  if (window.Hls) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HLS_JS; s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load the HLS player"));
    document.head.append(s);
  });
}

// Browsers without built-in HLS (everything but Safari) need hls.js; fetch it early, off the critical path.
export function warmUp() {
  if (window.Hls || document.createElement("video").canPlayType("application/vnd.apple.mpegurl")) return;
  loadHlsJs().catch(() => {});
}
if ("requestIdleCallback" in window) requestIdleCallback(() => warmUp(), { timeout: 4000 }); else setTimeout(warmUp, 2500);

export function stop() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
}

// Resolves once the video can actually start playing, rejects if it can't.
function whenPlayable(video) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => done(reject, new Error("The stream didn't start")), START_TIMEOUT);
    function done(fn, arg) { clearTimeout(t); video.removeEventListener("loadeddata", ok); video.removeEventListener("error", bad); fn(arg); }
    const ok = () => done(resolve);
    const bad = () => done(reject, new Error("The stream couldn't be played"));
    video.addEventListener("loadeddata", ok);
    video.addEventListener("error", bad);
  });
}

async function playPiped(box, id) {
  const s = await streamsFor(id);
  const video = document.createElement("video");
  video.controls = true; video.playsInline = true; video.autoplay = true; video.preload = "auto";
  box.replaceChildren(video);
  const sources = [];
  if (s.hls) sources.push(async () => {
    if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = s.hls; return whenPlayable(video); }
    await loadHlsJs();
    if (!window.Hls || !Hls.isSupported()) throw new Error("HLS isn't supported here");
    stop();
    hlsInstance = new Hls({ maxBufferLength: 30 });
    const started = whenPlayable(video);
    const fatal = new Promise((_, reject) => hlsInstance.on(Hls.Events.ERROR, (_e, d) => d.fatal && reject(new Error("HLS: " + d.details))));
    hlsInstance.loadSource(s.hls); hlsInstance.attachMedia(video);
    return Promise.race([started, fatal]);
  });
  for (const p of s.progressive.slice(0, 2)) sources.push(() => { stop(); video.src = p.url; return whenPlayable(video); });
  let lastErr = new Error("Piped had no playable stream");
  for (const attempt of sources) {
    try { await attempt(); video.play().catch(() => {}); return s; } catch (e) { lastErr = e; }
  }
  stop();
  throw lastErr;
}

function playYouTube(box, id) {
  stop();
  const f = document.createElement("iframe");
  f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  f.title = "YouTube video player";
  box.replaceChildren(f);
}

// mode: "auto" | "piped" | "youtube". Returns { source, instance?, details?, related?, error? }
export async function play(box, id, mode) {
  box.innerHTML = '<div class="player-msg">Loading…</div>';
  if (mode !== "youtube") {
    try {
      const s = await playPiped(box, id);
      return { source: "piped", instance: s.instance, details: s.details, related: s.related };
    } catch (e) {
      if (mode === "piped") {
        box.innerHTML = `<div class="player-msg">Couldn't play this ad-free right now.<br>${e.message}</div>`;
        return { source: "none", error: e };
      }
      playYouTube(box, id);
      return { source: "youtube", fellBack: true, error: e };
    }
  }
  playYouTube(box, id);
  return { source: "youtube" };
}
