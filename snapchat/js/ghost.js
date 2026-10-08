// Ghost messages: write, seal into a link, and open a link ("Your mission, should you choose to accept it…").
// The message and its key travel only in the link. Opening it burns it on this device.
import { get, set, $, esc, toast, bumpStreak, plural, when, left } from "./store.js?v=20261008144658";
import { seal, open, idOf, supported, SealError } from "./crypto.js?v=20261008144658";
import { codename, fileNo, BURN_LINES } from "./lore.js?v=20261008144658";

export const EXPIRIES = [["1 hour", 3600e3], ["1 day", 86400e3], ["1 week", 7 * 86400e3]];
const BURNS = [5, 10, 20, 30];
const MAX_TOKEN = 60000;   // keeps links short enough for most chat apps and browsers

// ---------- images ----------
export function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn’t a picture this browser can read.")); };
    img.src = url;
  });
}
// Draws any image or canvas into a JPEG data URL no bigger than max px on its long side.
export function shrink(src, max, quality) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

// ---------- sealing ----------
function linkFor(token) { return `${location.origin}${location.pathname}#m=${token}`; }

// Seals a message. If there's a picture, it is shrunk until the link fits.
export async function makeGhost({ text = "", image = null, seconds = 10, expiry = 86400e3, kind = "ghosts" }) {
  if (!supported()) throw new Error("This browser can’t encrypt here. Open the app over https.");
  const now = Date.now(), name = codename();
  const base = { v: 1, n: name, t: text, f: (get("agent", "") || "").trim() || "Agent", c: now, x: now + expiry, s: seconds };
  const tries = image ? [[640, 0.62], [480, 0.55], [360, 0.5], [260, 0.45], [180, 0.4]] : [null];
  let token = "";
  for (const t of tries) {
    const obj = t ? { ...base, i: shrink(image, t[0], t[1]) } : base;
    token = await seal(obj);
    if (token.length <= MAX_TOKEN) break;
  }
  if (token.length > MAX_TOKEN) throw new Error("That’s too much to fit in a link. Try a shorter message.");
  const res = { token, link: linkFor(token), name, exp: base.x, seconds, at: now, id: await idOf(token), hasImage: !!image };
  if (!get("ghostMode", false)) {
    const sent = get("sent", []).filter(m => m.exp > now - 7 * 86400e3);
    sent.unshift({ id: res.id, name, link: res.link, exp: res.exp, at: now, s: seconds, img: res.hasImage });
    set("sent", sent.slice(0, 40));
  }
  bumpStreak(kind);
  return res;
}

// ---------- compose screen ----------
let attached = null;   // HTMLImageElement
let currentLink = "";

function chips(el, items, value, onPick) {
  el.innerHTML = items.map(([label, v]) => `<button type="button" class="chip" role="radio" aria-checked="${v === value}" data-v="${v}">${esc(label)}</button>`).join("");
  el.onclick = e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    el.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
    onPick(Number(b.dataset.v));
  };
}
export function expiryChips(el, onPick) {
  chips(el, EXPIRIES, get("expiry", 86400e3), v => { set("expiry", v); onPick && onPick(v); });
}

export function initCompose() {
  expiryChips($("#gExpiry"));
  chips($("#gBurn"), BURNS.map(s => [`${s} s`, s]), get("burn", 10), v => set("burn", v));
  $("#gFileNo").textContent = fileNo();
  $("#gText").value = get("draft", "");
  $("#gText").addEventListener("input", e => set("draft", e.target.value));
  $("#gAttach").onclick = () => $("#gFile").click();
  $("#gFile").onchange = async e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      attached = await loadImage(f);
      $("#gThumbImg").src = shrink(attached, 200, 0.7);
      $("#gThumb").hidden = false; $("#gAttach").hidden = true;
    } catch (err) { toast(err.message); }
  };
  $("#gUnattach").onclick = () => { attached = null; $("#gThumb").hidden = true; $("#gAttach").hidden = false; };
  $("#gForm").onsubmit = async e => {
    e.preventDefault();
    const text = $("#gText").value.trim();
    if (!text && !attached) { toast("Write a briefing or attach a photo first."); $("#gText").focus(); return; }
    const btn = $("#gMake"); btn.disabled = true; btn.textContent = "Sealing…";
    try {
      const res = await makeGhost({ text, image: attached, seconds: get("burn", 10), expiry: get("expiry", 86400e3) });
      $("#gText").value = ""; set("draft", ""); $("#gUnattach").click();
      showResult(res);
    } catch (err) { toast(err.message || "Couldn’t seal that one."); }
    btn.disabled = false; btn.textContent = "Seal the dossier";
  };
  $("#gCopy").onclick = () => copy(currentLink);
  $("#gLink").onfocus = e => e.target.select();
  $("#gShare").onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Your mission", text: "Your mission, should you choose to accept it. This message will self-destruct.", url: currentLink }); }
      catch (e) { if (e.name !== "AbortError") copy(currentLink); }
    } else copy(currentLink);
  };
  $("#gNew").onclick = () => { $("#gResult").hidden = true; $("#gForm").hidden = false; $("#gFileNo").textContent = fileNo(); };
  updateFrom();
}
export function updateFrom() { $("#gFrom").textContent = (get("agent", "") || "").trim() || "Agent"; }

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Link copied. Guard it with your life."); }
  catch (e) { const i = $("#gLink"); i.focus(); i.select(); try { document.execCommand("copy"); toast("Link copied."); } catch (e2) { toast("Select the link and copy it."); } }
}

export function showResult(res) {
  currentLink = res.link;
  $("#gForm").hidden = true; $("#gResult").hidden = false;
  $("#gResNo").textContent = `File ${res.id.slice(0, 6).toUpperCase()}`;
  $("#gResName").textContent = res.name;
  $("#gResMeta").innerHTML = `Burns <b>${plural(res.seconds, "second")}</b> after opening.<br>Link expires <b>${esc(when(res.exp))}</b>.`;
  $("#gLink").value = res.link;
  $("#gShare").textContent = navigator.share ? "Share link" : "Copy link";
  $("#gResNote").innerHTML = `<b>Field note.</b> Anyone with this link can open it until it expires, on any device that hasn’t burned it yet. ${res.link.length > 8000 ? "It’s a long link because the picture is inside it. Some apps cut long links short, so test it first." : "Send it only to the agent it’s for."}`;
  location.hash = "#/ghost";
}

// ---------- sent list (Dossier) ----------
export function renderSent() {
  const ul = $("#sentList"), now = Date.now();
  const sent = get("sent", []);
  if (get("ghostMode", false) && !sent.length) { ul.innerHTML = `<li class="empty">Ghost mode is on. Nothing is kept.</li>`; return; }
  if (!sent.length) { ul.innerHTML = `<li class="empty">No missions yet. Seal one on the Ghost tab.</li>`; return; }
  ul.innerHTML = sent.map((m, i) => `<li class="${m.exp < now ? "dead" : ""}">
    <div><b>${esc(m.name)}</b><span>${m.img ? "Snap · " : ""}${esc(when(m.at))} · ${esc(left(m.exp - now))}</span></div>
    ${m.exp > now ? `<button type="button" class="chip dark" data-copy="${i}">Copy</button>` : ""}
    <button type="button" class="chip" data-forget="${i}" aria-label="Forget ${esc(m.name)}">Forget</button></li>`).join("");
  ul.onclick = e => {
    const c = e.target.closest("[data-copy]"), f = e.target.closest("[data-forget]");
    const list = get("sent", []);
    if (c) { currentLink = list[+c.dataset.copy].link; $("#gLink").value = currentLink; copy(currentLink); }
    if (f) { list.splice(+f.dataset.forget, 1); set("sent", list); renderSent(); }
  };
}

// ---------- opening a link ----------
const M = () => $("#mInner");
let timers = [], burning = false;
function clearTimers() { timers.forEach(t => { clearTimeout(t); clearInterval(t); cancelAnimationFrame(t); }); timers = []; }

function screen(html, cls = "") {
  const m = $("#mission");
  m.hidden = false; m.className = `mission ${cls}`;
  M().innerHTML = html;
  m.scrollTop = 0;
}
function backButton(label = "Back to base") { return `<button type="button" class="primary" data-back>${label}</button>`; }
function wireBack(onClose) { M().querySelectorAll("[data-back]").forEach(b => b.onclick = onClose); }

export function closeMission() {
  clearTimers(); burning = false;
  $("#mission").hidden = true; M().innerHTML = "";
  document.body.classList.remove("in-mission");
}

export async function openMission(token, onClose) {
  clearTimers();
  document.body.classList.add("in-mission");
  screen(`<div class="m-wait"><svg class="ghost spin"><use href="#i-ghost"/></svg><p>Decrypting dossier…</p></div>`);
  const dead = (title, body, cls) => { screen(`<div class="m-dead ${cls}"><svg class="ghost"><use href="#i-ghost"/></svg><span class="stamp red big">${esc(title)}</span><p>${body}</p>${backButton()}</div>`, "is-dead"); wireBack(onClose); };
  if (!supported()) return dead("Locked", "This browser can’t unlock ghost messages here. Try a recent browser over https.");
  const id = await idOf(token);
  const burned = get("burned", {});
  // Forget burns of links that expired over a day ago, so storage stays small.
  let changed = false;
  for (const k in burned) if (burned[k].x < Date.now() - 86400e3) { delete burned[k]; changed = true; }
  if (changed) set("burned", burned);
  if (burned[id]) return dead("Burned", `This message already self-destructed on this device (${esc(when(burned[id].at))}). There’s nothing left but ash.`);
  let msg;
  try { msg = await open(token); }
  catch (e) {
    if (e instanceof SealError && e.code === "old-browser") return dead("Locked", "This browser is too old to unpack this message. Try a newer one.");
    return dead("Damaged", "This link is damaged or incomplete. Some apps cut long links short. Ask the sender to send it again.");
  }
  if (!(msg.x > Date.now())) return dead("Expired", `This mission expired ${esc(when(msg.x))}. The trail has gone cold.`);
  const secs = Math.min(60, Math.max(1, Number(msg.s) || 10));
  screen(`<article class="paper brief">
      <div class="clip" aria-hidden="true"></div>
      <span class="stamp red">Classified</span>
      <p class="file-no">File ${esc(id.slice(0, 6).toUpperCase())} · Eyes only</p>
      <h1 class="d-title">${esc(msg.n || "Operation Ghost")}</h1>
      <p class="typed">Good ${greeting()}, Agent.</p>
      <p class="typed">Your mission, should you choose to accept it, is to read ${msg.i && !msg.t ? "this snap" : "this message"}.</p>
      <p class="typed">As always, it will self-destruct <b>${plural(secs, "second")}</b> after you accept.</p>
      <dl class="meta">
        <dt>From</dt><dd>${esc(msg.f || "Agent")}</dd>
        <dt>Sent</dt><dd>${esc(when(msg.c))}</dd>
        <dt>Link expires</dt><dd>${esc(when(msg.x))}</dd>
      </dl>
      <div class="m-actions">
        <button type="button" class="primary" id="mAccept">Accept the mission</button>
        <button type="button" class="ghostbtn" data-back>Not now</button>
      </div>
      <p class="fieldnote"><b>Field note.</b> There is no server. Anyone with this link can open it until it expires. Once you accept, it burns on this device only.</p>
    </article>`, "is-brief");
  wireBack(onClose);
  $("#mAccept").onclick = () => {
    const b = get("burned", {});
    b[id] = { at: Date.now(), x: msg.x };   // burn first, so a reload mid-countdown doesn't give a second look
    set("burned", b);
    document.dispatchEvent(new CustomEvent("ghost:stats"));
    read(msg, secs, onClose);
  };
}

function greeting() { const h = new Date().getHours(); return h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"; }

function read(msg, secs, onClose) {
  screen(`<div class="fuse" aria-hidden="true"><div class="rope" style="animation-duration:${secs}s"><span class="spark"></span></div></div>
    <div class="count" id="mCount" aria-live="off">00:${String(secs).padStart(2, "0")}</div>
    <article class="paper burnable" id="mPaper">
      <span class="stamp red">Eyes only</span>
      <p class="file-no">${esc(msg.n || "")}</p>
      ${msg.i ? `<img class="m-img" src="${esc(msg.i)}" alt="Snap">` : ""}
      ${msg.t ? `<p class="m-text" id="mText">${esc(msg.t)}</p>` : ""}
      <p class="sig">Signed, ${esc(msg.f || "Agent")}</p>
      <i class="ember" aria-hidden="true"></i>
    </article>
    <button type="button" class="ghostbtn small" id="mNow">Burn it now</button>`, "is-reading");
  const end = Date.now() + secs * 1000;
  const tick = () => {
    const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const c = $("#mCount"); if (c) { c.textContent = `00:${String(s).padStart(2, "0")}`; c.classList.toggle("hot", s <= 3); }
    if (s <= 0) burn(onClose);
  };
  timers.push(setInterval(tick, 200));
  $("#mNow").onclick = () => burn(onClose);
}

function burn(onClose) {
  if (burning) return; burning = true;
  clearTimers();
  const paper = $("#mPaper"), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#mission").classList.add("burning");
  $("#mNow")?.remove();
  const done = () => {
    burning = false;
    const line = BURN_LINES[Math.floor(Math.random() * BURN_LINES.length)];
    screen(`<div class="m-dead ash"><svg class="ghost rise"><use href="#i-ghost"/></svg><span class="stamp red big">Destroyed</span><p>${esc(line)}</p><p class="small">It’s gone from this device. Anyone else with the link can still open it until it expires.</p>${backButton()}</div>`, "is-dead");
    wireBack(onClose);
  };
  if (!paper || reduce) { timers.push(setTimeout(done, reduce ? 400 : 0)); return; }
  // 1. Glitch: the text scrambles and the page tears.
  paper.classList.add("glitch");
  const txt = $("#mText"), orig = txt ? txt.textContent : "", glyphs = "█▓▒░#%&@$?!<>/\\01";
  const scramble = setInterval(() => {
    if (!txt) return;
    txt.textContent = [...orig].map(ch => ch === "\n" || ch === " " || Math.random() < 0.35 ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
  }, 60);
  timers.push(scramble);
  // 2. Burn: a hole opens from the bottom and eats the page, with a glowing edge.
  timers.push(setTimeout(() => {
    clearInterval(scramble);
    paper.classList.remove("glitch"); paper.classList.add("fire");
    const t0 = performance.now(), dur = 1500;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), r = Math.pow(k, 0.85) * 112;
      paper.style.setProperty("--r", r.toFixed(2) + "%");
      if (k < 1) timers.push(requestAnimationFrame(step)); else timers.push(setTimeout(done, 250));
    };
    timers.push(requestAnimationFrame(step));
  }, 650));
}
