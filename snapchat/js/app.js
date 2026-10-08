// Snapchat: Ghost Protocol Edition. A Sacred App from The Legend Of Chris.
// Snaps: take a photo with the rear camera (the front one is refused, to avoid self-reflection), caption it,
// doodle on it, then share or save it. Ghosts: messages sealed with AES-GCM in the browser, with the key in the
// link's # part, that self-destruct after reading. No server. Everything else stays on this device.
import { get, set, wipe, $, toast, streak, sessionGet, sessionSet } from "./store.js?v=20261008182449";
import { initCompose, updateFrom, renderSent, openMission, closeMission } from "./ghost.js?v=20261008182449";
import { enterSnap, leaveSnap, editorOpen } from "./camera.js?v=20261008182449";

const VIEWS = ["snap", "ghost", "dossier"];

// ---------- routing: #/snap, #/ghost, #/dossier, and #m=<sealed message> ----------
function route() {
  const h = location.hash;
  if (h.startsWith("#m=")) {
    leaveSnap();
    openMission(h.slice(3), () => { closeMission(); history.replaceState(null, "", location.pathname + "#/ghost"); route(); });
    return;
  }
  closeMission();
  const name = (h.match(/^#\/(\w+)/) || [])[1];
  const view = VIEWS.includes(name) ? name : "snap";
  document.querySelectorAll(".view").forEach(v => { v.hidden = v.dataset.view !== view; });
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === view));
  document.getElementById("app").dataset.view = view;
  if (view === "snap") enterSnap(); else leaveSnap();
  if (view === "dossier") renderDossier();
  if (view !== "snap" && editorOpen()) document.getElementById("app").classList.remove("editing");
  if (view === "snap" && editorOpen()) document.getElementById("app").classList.add("editing");
}
addEventListener("hashchange", route);

// ---------- streak + stats ----------
function renderStats() {
  const n = streak();
  $("#streakN").textContent = n;
  $("#streak").classList.toggle("cold", n === 0);
  const stats = get("stats", { snaps: 0, ghosts: 0 });
  $("#sStreak").textContent = n;
  $("#sSnaps").textContent = stats.snaps || 0;
  $("#sGhosts").textContent = stats.ghosts || 0;
  $("#sBurned").textContent = Object.keys(get("burned", {})).length;
  $("#tSelf").checked = !!get("selfReflection", false);
}
document.addEventListener("ghost:stats", renderStats);

// ---------- dossier ----------
function renderDossier() {
  renderStats();
  renderSent();
  $("#agentName").value = get("agent", "");
  $("#tGhostMode").checked = !!get("ghostMode", false);
  $("#tIntro").checked = get("intro", true) !== false;
}
$("#agentName").addEventListener("input", e => { set("agent", e.target.value.slice(0, 40)); updateFrom(); });
$("#tGhostMode").onchange = e => {
  set("ghostMode", e.target.checked);
  if (e.target.checked) { set("sent", []); toast("Ghost mode on. The mission list is gone."); }
  renderSent();
};
$("#tSelf").onchange = e => { set("selfReflection", e.target.checked); toast(e.target.checked ? "Self-reflection accepted. Front cameras allowed." : "Front cameras are off again. As Steve intended."); };
$("#tIntro").onchange = e => set("intro", e.target.checked);
$("#wipeBtn").onclick = () => {
  if (!confirm("Wipe your streak, settings, mission list and burn records on this device?")) return;
  wipe(); renderDossier(); updateFrom(); toast("Wiped. You were never here.");
};

// ---------- intro: once per visit ----------
function intro() {
  const sp = $("#splash");
  if (location.hash.startsWith("#m=") || get("intro", true) === false || sessionGet("intro") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  sessionSet("intro", "1");
  sp.hidden = false;
  const end = () => { sp.classList.add("out"); setTimeout(() => { sp.hidden = true; }, 400); };
  sp.onclick = end;
  setTimeout(end, 1500);
}

initCompose();
renderStats();
intro();
route();
