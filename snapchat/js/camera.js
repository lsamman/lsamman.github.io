// Snaps: the camera, the caption bar, doodles, the timer, and sending.
// The rear camera is preferred. A lens that faces you is refused ("to avoid self-reflection") unless you accept it.
import { get, set, $, toast, bumpStreak, plural } from "./store.js?v=20261008143024";
import { SELF_REFLECTION } from "./lore.js?v=20261008143024";
import { loadImage, makeGhost, showResult, expiryChips } from "./ghost.js?v=20261008143024";

const MAX_EDGE = 2048;
const COLORS = ["#FFFC00", "#FF2D2D", "#FFFFFF", "#111111", "#2F7BFF", "#3DDC84"];

const video = $("#cam"), lens = $("#lens"), lensMsg = $("#lensMsg"), shutter = $("#shutter");
const editor = $("#editor"), stage = $("#stage"), photo = $("#photo"), ink = $("#ink");
const cap = $("#caption"), capInput = $("#capInput");

let stream = null, facing = "unknown", devices = [], devIdx = -1, wantOn = false, starting = 0;
let strokes = [], cur = null, drawMode = false, color = COLORS[0], capY = 0.62, capFont = 20;
let timer = Math.min(10, Math.max(1, get("timer", 3)));

const hasCamera = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const selfOk = () => !!get("selfReflection", false);

// ---------- lens ----------
function msg(html) { lensMsg.innerHTML = html; lensMsg.hidden = !html; }
function libButton(label = "Pick from library") { return `<button type="button" class="ghostbtn light" data-lib>${label}</button>`; }
lensMsg.addEventListener("click", e => {
  if (e.target.closest("[data-lib]")) $("#libInput").click();
  if (e.target.closest("[data-arm]")) start();
  if (e.target.closest("[data-self]")) { set("selfReflection", true); document.dispatchEvent(new CustomEvent("ghost:stats")); start(devices[devIdx]?.deviceId); }
});

function showArm() {
  if (!hasCamera()) {
    msg(`<div class="lens-card"><span class="stamp red">No lens</span><h2>No camera here</h2><p>This browser can’t reach a camera. You can still make a snap from a photo.</p>${libButton()}</div>`);
    return;
  }
  msg(`<div class="lens-card"><span class="stamp red">Standby</span><h2>Lens offline</h2><p>Ghost Protocol uses the rear camera. Your snaps stay on this device until you send them.</p><button type="button" class="primary" data-arm>Arm the lens</button>${libButton()}</div>`);
}
function showRefusal() {
  msg(`<div class="lens-card refuse"><span class="stamp red">Denied</span><h2>${SELF_REFLECTION.title}</h2><p>${SELF_REFLECTION.body}</p>
    <button type="button" class="primary" data-self>${SELF_REFLECTION.accept}</button>${libButton(SELF_REFLECTION.library)}</div>`);
}
function showError(e) {
  const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
  const none = e && (e.name === "NotFoundError" || e.name === "OverconstrainedError");
  const body = denied ? "Camera access was refused. The lens stays dark. You can allow it in your browser’s site settings, or use a photo instead."
    : none ? "No camera was found on this device. You can still make a snap from a photo."
    : "The camera wouldn’t start. Another app may be using it.";
  msg(`<div class="lens-card"><span class="stamp red">Blocked</span><h2>${denied ? "Access denied" : "No signal"}</h2><p>${body}</p>${denied || none ? "" : `<button type="button" class="primary" data-arm>Try again</button>`}${libButton()}</div>`);
}

function facingOf(track) {
  const s = track.getSettings ? track.getSettings() : {};
  if (s.facingMode) return s.facingMode === "environment" ? "environment" : "user";
  const l = track.label || "";
  if (/back|rear|environment|world/i.test(l)) return "environment";
  if (/front|user|facetime|selfie|integrated|built-in/i.test(l)) return "user";
  return "unknown";   // a webcam that doesn't say. Laptops and desktops point these at you, so it counts as front.
}

function stop() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; video.srcObject = null;
  shutter.disabled = true; $("#rec").hidden = true;
}

async function start(deviceId) {
  if (!hasCamera()) return showArm();
  const run = ++starting;
  stop();
  msg(`<div class="lens-wait"><svg class="ghost spin"><use href="#i-ghost"/></svg><p>Arming the lens…</p></div>`);
  const size = { width: { ideal: 1920 }, height: { ideal: 1440 } };
  let s;
  try { s = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size } }); }
  catch (e) { if (run === starting) { set("camOk", false); showError(e); } return; }
  if (run !== starting || !wantOn || !editor.hidden) { s.getTracks().forEach(t => t.stop()); return; }
  stream = s; set("camOk", true);
  const track = s.getVideoTracks()[0];
  const myId = track.getSettings ? track.getSettings().deviceId : "";
  try { devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput"); } catch (e) { devices = []; }
  facing = facingOf(track);
  if (facing !== "environment" && !deviceId) {
    const back = devices.find(d => /back|rear|environment/i.test(d.label) && d.deviceId !== myId);
    if (back) return start(back.deviceId);
  }
  devIdx = Math.max(0, devices.findIndex(d => d.deviceId === myId));
  $("#flipBtn").hidden = devices.length < 2;
  if (facing !== "environment" && !selfOk()) { stop(); return showRefusal(); }
  video.srcObject = s;
  video.classList.toggle("mirror", facing !== "environment");
  try { await video.play(); } catch (e) {}
  if (run !== starting) return;
  msg("");
  shutter.disabled = false;
  const rec = $("#rec"); rec.hidden = false;
  rec.lastChild.textContent = facing === "environment" ? "LIVE · REAR LENS" : "LIVE · SELF-REFLECTION";
}

export function enterSnap() {
  wantOn = true;
  if (!editor.hidden || stream) return;
  if (get("camOk", false) && hasCamera()) start(); else showArm();
}
export function leaveSnap() { wantOn = false; starting++; stop(); }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { if (stream) { starting++; stop(); } }
  else if (wantOn && editor.hidden && !stream && get("camOk", false)) start(devices[devIdx]?.deviceId);
});

$("#flipBtn").onclick = () => { if (devices.length < 2) return; devIdx = (devIdx + 1) % devices.length; start(devices[devIdx].deviceId); };
$("#libBtn").onclick = () => $("#libInput").click();
$("#libInput").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const img = await loadImage(f);
    const k = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    openEditor(c);
  } catch (err) { toast(err.message); }
};

shutter.onclick = () => {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  const k = Math.min(1, MAX_EDGE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext("2d");
  if (video.classList.contains("mirror")) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(video, 0, 0, c.width, c.height);
  lens.classList.remove("flash"); void lens.offsetWidth; lens.classList.add("flash");
  setTimeout(() => openEditor(c), 120);
};

// ---------- editor ----------
function openEditor(src) {
  starting++; stop();
  photo.width = ink.width = src.width; photo.height = ink.height = src.height;
  photo.getContext("2d").drawImage(src, 0, 0);
  strokes = []; cur = null; redraw();
  capInput.value = ""; cap.hidden = true; capY = 0.62;
  setDraw(false); $("#timerPick").hidden = true;
  lens.hidden = true; editor.hidden = false;
  document.getElementById("app").classList.add("editing");
  layout();
}
function closeEditor() {
  editor.hidden = true; lens.hidden = false;
  document.getElementById("app").classList.remove("editing");
  if (wantOn) enterSnap();
}
export function editorOpen() { return !editor.hidden; }

function layout() {
  if (editor.hidden) return;
  const r = $("#stageWrap").getBoundingClientRect();
  const a = photo.width / photo.height;
  let w = r.width, h = w / a;
  if (h > r.height) { h = r.height; w = h * a; }
  stage.style.width = `${w}px`; stage.style.height = `${h}px`;
  capFont = Math.max(15, Math.min(28, h * 0.042));
  cap.style.fontSize = `${capFont}px`;
  placeCaption();
}
addEventListener("resize", layout);
function placeCaption() { cap.style.top = `${capY * 100}%`; }

// Caption: tap the photo to add it, drag it up and down, tap it to type.
function showCaption(y) {
  if (y != null) capY = Math.min(0.94, Math.max(0.06, y));
  cap.hidden = false; placeCaption(); capInput.focus();
}
$("#edText").onclick = () => { setDraw(false); if (cap.hidden) showCaption(); else capInput.focus(); };
capInput.addEventListener("keydown", e => { if (e.key === "Enter") capInput.blur(); });
capInput.addEventListener("blur", () => { if (!capInput.value.trim()) cap.hidden = true; });

let drag = null;
cap.addEventListener("pointerdown", e => {
  if (drawMode) return;
  drag = { y: e.clientY, from: capY, moved: false, focused: document.activeElement === capInput };
  if (!drag.focused) e.preventDefault();
  cap.setPointerCapture(e.pointerId);
});
cap.addEventListener("pointermove", e => {
  if (!drag) return;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; cap.classList.add("dragging"); }
  if (drag.moved) { capY = Math.min(0.94, Math.max(0.06, drag.from + dy / stage.getBoundingClientRect().height)); placeCaption(); }
});
cap.addEventListener("pointerup", () => {
  if (!drag) return;
  const tap = !drag.moved; drag = null; cap.classList.remove("dragging");
  if (tap) capInput.focus();
  else if (!capInput.value.trim() && document.activeElement !== capInput) cap.hidden = true;
});
cap.addEventListener("pointercancel", () => { drag = null; cap.classList.remove("dragging"); });

let tapStart = null;
stage.addEventListener("pointerdown", e => { if (!drawMode && e.target === ink) tapStart = { x: e.clientX, y: e.clientY }; });
stage.addEventListener("pointerup", e => {
  if (!tapStart || drawMode) return;
  const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 8; tapStart = null;
  if (moved) return;
  if (document.activeElement === capInput) { capInput.blur(); return; }
  if (cap.hidden) { const r = stage.getBoundingClientRect(); showCaption((e.clientY - r.top) / r.height); $("#timerPick").hidden = true; }
});

// Doodles
const palette = $("#palette");
palette.innerHTML = COLORS.map(c => `<button type="button" style="--c:${c}" data-c="${c}" aria-label="Colour ${c}" aria-pressed="${c === color}"></button>`).join("");
palette.onclick = e => {
  const b = e.target.closest("[data-c]"); if (!b) return;
  color = b.dataset.c;
  palette.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  $("#edPen").style.setProperty("--pen", color);
};
function setDraw(on) {
  drawMode = on;
  $("#edPen").setAttribute("aria-pressed", String(on));
  $("#edPen").style.setProperty("--pen", color);
  palette.hidden = !on;
  stage.classList.toggle("drawing", on);
  if (on) { capInput.blur(); $("#timerPick").hidden = true; }
  $("#edUndo").hidden = !strokes.length;
}
$("#edPen").onclick = () => setDraw(!drawMode);
$("#edUndo").onclick = () => { strokes.pop(); redraw(); $("#edUndo").hidden = !strokes.length; };

function pt(e) {
  const r = ink.getBoundingClientRect();
  return [(e.clientX - r.left) * ink.width / r.width, (e.clientY - r.top) * ink.height / r.height];
}
function line(g, s, from) {
  g.strokeStyle = g.fillStyle = s.c; g.lineWidth = s.w; g.lineCap = g.lineJoin = "round";
  if (s.p.length === 1) { g.beginPath(); g.arc(s.p[0][0], s.p[0][1], s.w / 2, 0, Math.PI * 2); g.fill(); return; }
  g.beginPath(); g.moveTo(...s.p[Math.max(0, from - 1)]);
  for (let i = Math.max(1, from); i < s.p.length; i++) g.lineTo(...s.p[i]);
  g.stroke();
}
function redraw() {
  const g = ink.getContext("2d");
  g.clearRect(0, 0, ink.width, ink.height);
  strokes.forEach(s => line(g, s, 1));
}
ink.addEventListener("pointerdown", e => {
  if (!drawMode) return;
  e.preventDefault(); ink.setPointerCapture(e.pointerId);
  cur = { c: color, w: Math.max(4, Math.max(ink.width, ink.height) / 110), p: [pt(e)] };
  strokes.push(cur); line(ink.getContext("2d"), cur, 0);
});
ink.addEventListener("pointermove", e => {
  if (!cur) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const from = cur.p.length;
  (evs.length ? evs : [e]).forEach(ev => cur.p.push(pt(ev)));
  line(ink.getContext("2d"), cur, from);
});
const endStroke = () => { if (cur) { cur = null; $("#edUndo").hidden = !strokes.length; } };
ink.addEventListener("pointerup", endStroke);
ink.addEventListener("pointercancel", endStroke);

// Timer (1 to 10 seconds, like 2013)
const pick = $("#timerPick");
function renderTimer() {
  $("#timerN").textContent = timer;
  $("#edTimer").setAttribute("aria-label", `Timer: ${plural(timer, "second")}`);
  pick.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<button type="button" data-t="${n}" aria-pressed="${n === timer}">${n}</button>`).join("");
}
renderTimer();
$("#edTimer").onclick = () => { pick.hidden = !pick.hidden; if (!pick.hidden) setDraw(false); };
pick.onclick = e => { const b = e.target.closest("[data-t]"); if (!b) return; timer = +b.dataset.t; set("timer", timer); renderTimer(); pick.hidden = true; };

// ---------- output ----------
function compose() {
  const c = document.createElement("canvas");
  c.width = photo.width; c.height = photo.height;
  const g = c.getContext("2d");
  g.drawImage(photo, 0, 0); g.drawImage(ink, 0, 0);
  const text = capInput.value.trim();
  if (!cap.hidden && text) {
    const k = c.height / stage.getBoundingClientRect().height;
    const barH = cap.offsetHeight * k, y = capY * c.height - barH / 2;
    g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, y, c.width, barH);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `${Math.round(capFont * k)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.fillText(text, c.width / 2, y + barH / 2, c.width * 0.94);
  }
  return c;
}
function fileName() { const d = new Date(); return `snap-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}.png`; }
const toBlob = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Couldn’t make the picture.")), "image/png"));
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

$("#edClose").onclick = closeEditor;
$("#edSave").onclick = async () => {
  try { download(await toBlob(compose()), fileName()); toast("Saved to your downloads."); } catch (e) { toast(e.message); }
};
$("#edSend").onclick = async () => {
  let blob, name = fileName();
  try { blob = await toBlob(compose()); } catch (e) { toast(e.message); return; }
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Snap" });
      bumpStreak("snaps"); toast("Snap sent. Streak kept alive."); closeEditor();
    } catch (e) {
      if (e.name !== "AbortError") { download(blob, name); toast("Sharing failed, so the snap was saved instead."); }
    }
  } else {
    download(blob, name); bumpStreak("snaps");
    toast("Sharing isn’t available here, so the snap was saved instead.", 3400);
  }
};

// Ghost link: the snap goes into a self-destructing link and burns after the timer.
const sheet = $("#sheet");
$("#edGhost").onclick = () => {
  $("#sheetSecs").textContent = plural(timer, "second");
  expiryChips($("#sheetExpiry"));
  sheet.hidden = false; $("#sheetGo").focus();
};
$("#sheetCancel").onclick = () => { sheet.hidden = true; };
sheet.onclick = e => { if (e.target === sheet) sheet.hidden = true; };
$("#sheetGo").onclick = async () => {
  const b = $("#sheetGo"); b.disabled = true; b.textContent = "Sealing…";
  try {
    const res = await makeGhost({ image: compose(), seconds: timer, expiry: get("expiry", 86400e3), kind: "snaps" });
    sheet.hidden = true; editor.hidden = true; lens.hidden = false;
    document.getElementById("app").classList.remove("editing");
    showResult(res);
  } catch (e) { toast(e.message || "Couldn’t seal that one."); }
  b.disabled = false; b.textContent = "Seal it";
};
