/*
 * "Now playing" tile: shows what you're listening to, live from Last.fm.
 *
 * Setup: fill in `lastfm` in js/content.js with your Last.fm username and an
 * API key (free from https://www.last.fm/api/account/create). Only the API key
 * goes here. NEVER put the "shared secret" in this site.
 * If either is blank, this file does nothing.
 *
 * Self-contained: it adds its own styles and element, so including the
 * <script> tag is all that's needed. Also exposes window.NowPlaying.
 */

(function () {
  var cfg = (window.SITE && window.SITE.lastfm) || {};
  if (!cfg.user || !cfg.apiKey) return;

  var POLL_MS = 30000;
  // Last.fm returns this grey star image when a track has no artwork
  var BLANK_ART = "2a96cbd8b46e442fc41c2b86b821562f";
  var API = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&format=json&limit=1" +
    "&user=" + encodeURIComponent(cfg.user) + "&api_key=" + encodeURIComponent(cfg.apiKey);

  // ---------- Styles (liquid glass, matching css/style.css; uses the --hue accent) ----

  var css = document.createElement("style");
  css.textContent = [
    "#nowplaying{position:fixed;z-index:20;left:24px;bottom:calc(env(safe-area-inset-bottom,0px) + 48px);",
    "display:flex;align-items:center;gap:12px;width:min(320px,calc(100vw - 48px));padding:8px 16px 8px 8px;border-radius:20px;",
    "background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 42%,rgba(255,255,255,.07)),rgba(18,20,23,.34);",
    "box-shadow:0 10px 30px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.28);",
    "color:#f4f6f5;text-decoration:none;font-family:inherit;backdrop-filter:blur(14px) saturate(175%);-webkit-backdrop-filter:blur(14px) saturate(175%);",
    "opacity:0;transform:translateX(-12px);transition:opacity .5s,transform .5s,border-color .3s}",
    "body.started #nowplaying.ready{opacity:1;transform:none}",
    "body.detail-open #nowplaying{opacity:0!important;pointer-events:none}",
    "#nowplaying:hover{box-shadow:0 10px 30px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.28),0 0 24px hsl(var(--hue,120) 85% 55% / .3)}",
    "#nowplaying .np-art{flex:none;width:52px;height:52px;object-fit:cover;border-radius:13px;background:rgba(255,255,255,.08)}",
    "#nowplaying .np-text{min-width:0;display:flex;flex-direction:column;line-height:1.25}",
    "#nowplaying .np-label{display:flex;align-items:center;gap:6px;font-size:.72rem;text-transform:lowercase;letter-spacing:.06em;color:hsl(var(--hue,120) 70% 60%)}",
    "#nowplaying .np-track{font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#nowplaying .np-artist{font-size:.85rem;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#nowplaying .np-eq{display:inline-flex;align-items:flex-end;gap:2px;height:10px}",
    "#nowplaying .np-eq i{width:2px;background:currentColor;animation:np-eq .9s ease-in-out infinite}",
    "#nowplaying .np-eq i:nth-child(2){animation-delay:-.3s}#nowplaying .np-eq i:nth-child(3){animation-delay:-.6s}",
    "#nowplaying:not(.live) .np-eq{display:none}",
    "@keyframes np-eq{0%,100%{height:3px}50%{height:10px}}",
    "html.reduce-motion #nowplaying .np-eq i{animation:none;height:7px}",
    "@media (max-width:640px){#nowplaying{left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 44px);width:calc(100vw - 24px)}",
    "#nowplaying .np-art{width:42px;height:42px}}"
  ].join("");
  document.head.appendChild(css);

  // ---------- The tile -----------------------------------------------------

  var tile = document.createElement("a");
  tile.id = "nowplaying";
  tile.target = "_blank";
  tile.rel = "noopener";
  tile.innerHTML =
    '<img class="np-art" alt="">' +
    '<span class="np-text">' +
      '<span class="np-label"><span class="np-eq"><i></i><i></i><i></i></span><span class="np-status"></span></span>' +
      '<span class="np-track"></span><span class="np-artist"></span>' +
    "</span>";
  tile.setAttribute("aria-live", "polite");
  document.body.appendChild(tile);

  var artEl = tile.querySelector(".np-art");
  var lastKey = "";

  function ago(uts) {
    var s = Math.max(0, Date.now() / 1000 - uts);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }

  function art(track) {
    var imgs = track.image || [];
    for (var i = imgs.length - 1; i >= 0; i--) {
      var url = imgs[i]["#text"];
      if (url && url.indexOf(BLANK_ART) === -1) return url;
    }
    return "";
  }

  function render(track) {
    var live = !!(track["@attr"] && track["@attr"].nowplaying === "true");
    var artist = (track.artist && (track.artist["#text"] || track.artist.name)) || "";
    var status = live ? "now playing" : "last played" + (track.date ? " · " + ago(+track.date.uts) : "");

    tile.classList.toggle("live", live);
    tile.querySelector(".np-status").textContent = status;
    tile.href = /^https:\/\//.test(track.url || "") ? track.url : "https://www.last.fm/user/" + encodeURIComponent(cfg.user);
    tile.title = (live ? "Listening to " : "Last played ") + track.name + " by " + artist + " on Last.fm";

    var key = track.name + "|" + artist;
    if (key !== lastKey) {
      lastKey = key;
      tile.querySelector(".np-track").textContent = track.name;
      tile.querySelector(".np-artist").textContent = artist;
      var src = art(track);
      if (src) artEl.src = src; else artEl.removeAttribute("src");
      if (tile.classList.contains("ready") && tile.animate) {   // small flip when the song changes
        tile.animate([{ transform: "perspective(600px) rotateX(70deg)", opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 450, easing: "cubic-bezier(.2,.9,.25,1.15)" });
      }
    }
    tile.classList.add("ready");
    window.NowPlaying.current = { live: live, track: track.name, artist: artist, art: art(track), url: tile.href };
    if (window.NowPlaying.onchange) window.NowPlaying.onchange(window.NowPlaying.current);
  }

  var timer = null;
  function poll() {
    fetch(API)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var t = data && data.recenttracks && data.recenttracks.track;
        t = Array.isArray(t) ? t[0] : t;
        if (t) render(t);
      })
      .catch(function () { /* offline or Last.fm hiccup: keep showing the last result */ });
  }
  function schedule() {
    clearInterval(timer);
    timer = null;
    if (!document.hidden) { poll(); timer = setInterval(poll, POLL_MS); }
  }
  document.addEventListener("visibilitychange", schedule);   // stop polling while the tab is hidden
  schedule();

  window.NowPlaying = { current: null, onchange: null, refresh: poll };
})();
