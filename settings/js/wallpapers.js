// Home-screen wallpapers for the iPhone 3G on the wiki. Each one is a CSS `background` value,
// saved under loc.phone.wallpaper. Everything here is drawn with gradients: no image files.
import { raw, put, drop } from "./store.js?v=20261008185244";

export const KEY = "loc.phone.wallpaper";

// The wiki's own home screen, so the "Default" thumbnail matches what the phone shows with no key set.
export const DEFAULT_BG =
  "radial-gradient(ellipse at 50% 120%, #2c6fb3 0%, rgba(44, 111, 179, 0) 60%), radial-gradient(circle at 78% 22%, rgba(255, 255, 255, .18) 0 2px, transparent 3px), " +
  "radial-gradient(circle at 20% 30%, rgba(255, 255, 255, .25) 0 1px, transparent 2px), radial-gradient(circle at 55% 12%, rgba(255, 255, 255, .25) 0 1px, transparent 2px), " +
  "linear-gradient(#050b18, #0c2547 70%, #13406f)";

const star = (x, y, a = .7, r = 1) => `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, ${a}) 0 ${r}px, transparent ${r + 1}px)`;

export const PRESETS = [
  { id: "router", name: "God's router at night", note: "One tower. Full bars.",
    bg: [
      // the tower: a thin mast on the hill, with a light on top
      "radial-gradient(circle at 50% 41%, #fff 0 2px, rgba(140, 210, 255, .9) 3px, rgba(140, 210, 255, 0) 9px)",
      "linear-gradient(90deg, transparent calc(50% - 1.5px), #05070d calc(50% - 1.5px) calc(50% + 1.5px), transparent calc(50% + 1.5px)) 0 100% / 100% 59% no-repeat",
      // the hill
      "radial-gradient(ellipse 70% 30% at 50% 100%, #070a12 0 99%, transparent 100%)",
      // signal rings from the tower, fading out
      "radial-gradient(circle at 50% 41%, rgba(10, 20, 45, 0) 0 8%, rgba(10, 20, 45, .9) 55%)",
      "repeating-radial-gradient(circle at 50% 41%, rgba(140, 210, 255, 0) 0 22px, rgba(140, 210, 255, .55) 23px 25px, rgba(140, 210, 255, 0) 26px 44px)",
      star(12, 14), star(27, 8, .5), star(70, 12), star(86, 24, .6), star(36, 26, .4), star(92, 6, .8),
      "linear-gradient(#02040b, #0a1838 60%, #1b2f5c)"
    ].join(", ") },
  { id: "court", name: "The Court", note: "Its location is unknown.",
    bg: [
      // centre circle and half-court line
      "radial-gradient(circle at 50% 50%, transparent 0 17%, rgba(255, 255, 255, .9) calc(17% + 1px) calc(17% + 4px), transparent calc(17% + 5px))",
      "radial-gradient(circle at 50% 50%, #c0392b 0 6%, transparent calc(6% + 1px))",
      "linear-gradient(90deg, transparent calc(50% - 2px), rgba(255, 255, 255, .9) calc(50% - 2px) calc(50% + 2px), transparent calc(50% + 2px))",
      // the keys at each end
      "linear-gradient(rgba(192, 57, 43, .85), rgba(192, 57, 43, .85)) 0 50% / 14% 36% no-repeat",
      "linear-gradient(rgba(192, 57, 43, .85), rgba(192, 57, 43, .85)) 100% 50% / 14% 36% no-repeat",
      // spotlight and the hardwood
      "radial-gradient(ellipse at 50% 40%, rgba(255, 240, 210, .35), rgba(0, 0, 0, .35) 80%)",
      "repeating-linear-gradient(90deg, rgba(0, 0, 0, .08) 0 1px, transparent 1px 28px)",
      "repeating-linear-gradient(0deg, #d9a35f 0 13px, #cf9853 13px 26px, #dcaa68 26px 39px)"
    ].join(", ") },
  { id: "baja", name: "Baja Blast", note: "Tropical lime. Teal like the sea.",
    bg: [
      "radial-gradient(circle at 18% 72%, rgba(255, 255, 255, .55) 0 3px, rgba(255, 255, 255, 0) 5px)",
      "radial-gradient(circle at 24% 58%, rgba(255, 255, 255, .45) 0 2px, rgba(255, 255, 255, 0) 4px)",
      "radial-gradient(circle at 70% 80%, rgba(255, 255, 255, .5) 0 4px, rgba(255, 255, 255, 0) 6px)",
      "radial-gradient(circle at 76% 62%, rgba(255, 255, 255, .4) 0 2px, rgba(255, 255, 255, 0) 4px)",
      "radial-gradient(circle at 46% 44%, rgba(255, 255, 255, .35) 0 3px, rgba(255, 255, 255, 0) 5px)",
      "radial-gradient(circle at 88% 36%, rgba(255, 255, 255, .45) 0 2px, rgba(255, 255, 255, 0) 4px)",
      "radial-gradient(ellipse 80% 40% at 30% 0%, rgba(230, 255, 140, .7), rgba(230, 255, 140, 0))",
      "linear-gradient(170deg, rgba(255, 255, 255, 0) 55%, rgba(255, 255, 255, .25) 55.5%, rgba(255, 255, 255, 0) 70%)",
      "linear-gradient(160deg, #7ff0d0, #19c3b5 45%, #0a8f9e 75%, #05607a)"
    ].join(", ") },
  { id: "shadowban", name: "Club Shadowban", note: "Nightly Joker residency.",
    bg: [
      "radial-gradient(ellipse 60% 22% at 50% 100%, rgba(255, 60, 200, .55), rgba(255, 60, 200, 0))",
      "conic-gradient(from 160deg at 15% -5%, transparent 0 8deg, rgba(0, 240, 255, .35) 8deg 16deg, transparent 16deg 360deg)",
      "conic-gradient(from 175deg at 85% -5%, transparent 0 22deg, rgba(255, 50, 210, .35) 22deg 30deg, transparent 30deg 360deg)",
      "conic-gradient(from 168deg at 50% -10%, transparent 0 10deg, rgba(180, 120, 255, .3) 10deg 15deg, transparent 15deg 360deg)",
      // the giant X, suspended above the floor
      "linear-gradient(33deg, transparent calc(50% - 3px), rgba(255, 255, 255, .85) calc(50% - 3px) calc(50% + 3px), transparent calc(50% + 3px)) 50% 45% / 22% 34% no-repeat",
      "linear-gradient(-33deg, transparent calc(50% - 3px), rgba(255, 255, 255, .85) calc(50% - 3px) calc(50% + 3px), transparent calc(50% + 3px)) 50% 45% / 22% 34% no-repeat",
      "repeating-linear-gradient(90deg, rgba(255, 255, 255, .03) 0 2px, transparent 2px 6px)",
      "linear-gradient(#07020f, #1b0730 60%, #2c0a3d)"
    ].join(", ") },
  { id: "ton618", name: "TON 618", note: "Terrible Offensive Nuhuh.",
    bg: [
      "radial-gradient(circle at 50% 50%, #000 0 15%, rgba(0, 0, 0, 0) 15.5%)",
      "radial-gradient(ellipse 46% 10% at 50% 50%, rgba(255, 245, 220, .95) 0 20%, rgba(255, 170, 60, .85) 40%, rgba(200, 60, 10, .5) 70%, rgba(120, 20, 0, 0) 100%)",
      "radial-gradient(circle at 50% 50%, rgba(255, 190, 90, 0) 0 15%, rgba(255, 200, 110, .95) 16.5%, rgba(255, 120, 30, .55) 20%, rgba(150, 30, 0, 0) 30%)",
      "conic-gradient(from 0deg at 50% 50%, rgba(255, 120, 40, .15), rgba(255, 120, 40, 0) 25%, rgba(255, 120, 40, .15) 50%, rgba(255, 120, 40, 0) 75%, rgba(255, 120, 40, .15))",
      star(10, 20), star(22, 80, .5), star(80, 15, .6), star(90, 70), star(64, 88, .4), star(35, 10, .5),
      "radial-gradient(circle at 50% 50%, #1a0b05, #000 70%)"
    ].join(", ") },
  { id: "classic", name: "Classic iPhone OS 3 blue", note: "Glossy, like 2009.",
    bg: [
      "radial-gradient(ellipse 140% 60% at 50% -12%, rgba(255, 255, 255, .55), rgba(255, 255, 255, 0) 70%)",
      "radial-gradient(circle at 80% 85%, rgba(120, 220, 255, .55), rgba(120, 220, 255, 0) 40%)",
      "repeating-radial-gradient(circle at 20% 110%, rgba(255, 255, 255, 0) 0 30px, rgba(255, 255, 255, .07) 31px 33px)",
      "linear-gradient(#3f9cf0, #1460c4 55%, #0a3b8c)"
    ].join(", ") }
];

export function current() { return raw(KEY); }
export function save(value) { return value === null ? (drop(KEY), true) : put(KEY, value); }
export function nameOf(value) {
  if (value === null) return "Default";
  const p = PRESETS.find(p => p.bg === value);
  if (p) return p.name;
  return /^url\("data:image\//.test(value) ? "Your photo" : "Custom";
}

// An uploaded picture becomes a 960 x 640 JPEG (the phone is sideways, so landscape), cropped to fill.
export async function fromFile(file, w = 960, h = 640) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error("That picture can't be opened.")); i.src = url; });
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    x.fillStyle = "#000"; x.fillRect(0, 0, w, h);
    x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    let q = .82, data = c.toDataURL("image/jpeg", q);
    while (data.length > 400000 && q > .4) { q -= .12; data = c.toDataURL("image/jpeg", q); }
    return `url("${data}") center / cover no-repeat #000`;
  } finally { URL.revokeObjectURL(url); }
}
