// Preference-pane icons, drawn here in SVG. Each call gets its own gradient ids, so an icon can appear twice on a page.
let n = 0;
const svg = (body, label) => `<svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true" focusable="false">${body}</svg>`;

const DRAW = {
  appearance: u => `
    <defs>
      <linearGradient id="rim${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f7"/><stop offset="1" stop-color="#8b939c"/></linearGradient>
      <linearGradient id="day${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe6ff"/><stop offset="1" stop-color="#5aa8ef"/></linearGradient>
      <linearGradient id="nite${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3550"/><stop offset="1" stop-color="#0b0f1c"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="20" ry="3" fill="#000" opacity=".18"/>
    <circle cx="32" cy="31" r="27" fill="url(#rim${u})" stroke="#6d757e" stroke-width="1"/>
    <path d="M32 7 A24 24 0 0 0 32 55Z" fill="url(#day${u})"/>
    <path d="M32 7 A24 24 0 0 1 32 55Z" fill="url(#nite${u})"/>
    <circle cx="21" cy="27" r="6" fill="#ffd23f" stroke="#f0a400" stroke-width="1"/>
    <g stroke="#f0a400" stroke-width="1.6" stroke-linecap="round"><path d="M21 16v3M21 35v3M10 27h3M29 27h-1M13.2 19.2l2 2M13.2 34.8l2-2"/></g>
    <path d="M45 19a8 8 0 1 0 6 12 7 7 0 1 1-6-12z" fill="#f3f0d6"/>
    <circle cx="40" cy="42" r="1" fill="#fff"/><circle cx="48" cy="45" r=".8" fill="#fff"/><circle cx="37" cy="14" r=".8" fill="#fff"/>
    <ellipse cx="32" cy="15" rx="18" ry="7" fill="#fff" opacity=".22"/>`,
  wallpaper: u => `
    <defs>
      <linearGradient id="fr${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f7f9"/><stop offset=".5" stop-color="#b9c0c8"/><stop offset="1" stop-color="#e9ecef"/></linearGradient>
      <linearGradient id="sky${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3d8f"/><stop offset=".6" stop-color="#b35bb5"/><stop offset="1" stop-color="#ff9f5a"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="58" rx="26" ry="3" fill="#000" opacity=".18"/>
    <rect x="4" y="10" width="56" height="44" rx="2" fill="url(#fr${u})" stroke="#737b84"/>
    <rect x="9" y="15" width="46" height="34" fill="url(#sky${u})"/>
    <circle cx="40" cy="36" r="6" fill="#ffd9a0"/>
    <path d="M9 49V38l9-8 8 7 9-10 20 16v6z" fill="#1d2433"/>
    <path d="M9 49v-4c10-3 30-3 46 0v4z" fill="#0d121c"/>
    <circle cx="16" cy="20" r=".9" fill="#fff"/><circle cx="27" cy="18" r=".7" fill="#fff"/><circle cx="48" cy="21" r=".8" fill="#fff"/>
    <path d="M9 15h46L9 30z" fill="#fff" opacity=".12"/>`,
  antisocial: u => `
    <defs>
      <linearGradient id="case${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf0"/><stop offset="1" stop-color="#7f8892"/></linearGradient>
      <radialGradient id="face${u}" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfe5ea"/></radialGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="22" ry="3" fill="#000" opacity=".18"/>
    <rect x="28" y="3" width="8" height="6" rx="1.5" fill="url(#case${u})" stroke="#6d757e"/>
    <circle cx="32" cy="33" r="24" fill="url(#case${u})" stroke="#5f6770"/>
    <circle cx="32" cy="33" r="19.5" fill="url(#face${u})" stroke="#9aa2ab"/>
    <path d="M32 33 L32 13.5 A19.5 19.5 0 0 1 50.6 39 Z" fill="#43b02a" opacity=".25"/>
    <g stroke="#555" stroke-width="1.4" stroke-linecap="round"><path d="M32 15.5v3M32 47.5v3M14.5 33h3M46.5 33h3"/></g>
    <path d="M32 33 L44 26" stroke="#2d8a1c" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="32" cy="33" r="2.2" fill="#2d8a1c"/>
    <g fill="#3fae2a"><path d="M10 60c2-8 3-12 6-16-1 6-1 10 0 16z"/><path d="M15 60c0-6 2-10 5-13-1 5 0 9 1 13z"/><path d="M44 60c1-5 3-9 6-12-1 5-1 8 0 12z"/><path d="M49 60c2-7 4-11 7-14-2 5-2 9-1 14z"/></g>`,
  network: u => `
    <defs>
      <linearGradient id="mast${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a929b"/><stop offset=".5" stop-color="#f1f3f5"/><stop offset="1" stop-color="#7a828b"/></linearGradient>
      <radialGradient id="glow${u}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#8fd3ff"/><stop offset="1" stop-color="#8fd3ff" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="16" ry="3" fill="#000" opacity=".18"/>
    <path d="M32 18 L22 58 h4 L32 30 L38 58 h4z" fill="url(#mast${u})" stroke="#5b636c" stroke-width=".8"/>
    <path d="M26 44h12M28 36h8" stroke="#5b636c" stroke-width="1.4"/>
    <g fill="none" stroke="#2f8ae0" stroke-width="3" stroke-linecap="round">
      <path d="M22 9a14 14 0 0 0 0 20M42 9a14 14 0 0 1 0 20"/>
      <path d="M15 4a22 22 0 0 0 0 30M49 4a22 22 0 0 1 0 30" opacity=".6"/>
    </g>
    <circle cx="32" cy="19" r="7" fill="url(#glow${u})"/>`,
  about: u => `
    <defs>
      <linearGradient id="body${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a4a"/><stop offset="1" stop-color="#050505"/></linearGradient>
      <linearGradient id="scr${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1d3d"/><stop offset="1" stop-color="#2c6fb3"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="52" rx="28" ry="3" fill="#000" opacity=".18"/>
    <rect x="2" y="14" width="60" height="34" rx="9" fill="url(#body${u})" stroke="#000"/>
    <rect x="11" y="18" width="40" height="26" fill="url(#scr${u})"/>
    <g><rect x="14" y="21" width="6" height="6" rx="1.5" fill="#f2d600"/><rect x="22" y="21" width="6" height="6" rx="1.5" fill="#3b5998"/><rect x="30" y="21" width="6" height="6" rx="1.5" fill="#8e3fc0"/><rect x="38" y="21" width="6" height="6" rx="1.5" fill="#9aa3ad"/><rect x="14" y="30" width="6" height="6" rx="1.5" fill="#1da1f2"/><rect x="22" y="30" width="6" height="6" rx="1.5" fill="#1e4c8f"/></g>
    <circle cx="56.5" cy="31" r="3" fill="#111" stroke="#666" stroke-width=".8"/>
    <path d="M51 44l-6-6-5-1M45 38l-1-5M45 38l3-4" stroke="#fff" stroke-width=".7" fill="none" opacity=".8"/>
    <path d="M6 16h52a6 6 0 0 1 2 4H4a6 6 0 0 1 2-4z" fill="#fff" opacity=".15"/>`,
  storage: u => `
    <defs>
      <linearGradient id="can${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d959e"/><stop offset=".35" stop-color="#f2f4f6"/><stop offset="1" stop-color="#7d858f"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="22" ry="3" fill="#000" opacity=".18"/>
    ${[40, 26, 12].map((y, i) => `
      <path d="M12 ${y}v10c0 3.3 9 6 20 6s20-2.7 20-6V${y}" fill="url(#can${u})" stroke="#5f6770"/>
      <path d="M12 ${y + 6}c0 3.3 9 6 20 6s20-2.7 20-6" fill="none" stroke="${["#43b02a", "#2f8ae0", "#e8a33d"][i]}" stroke-width="2.4"/>
      <ellipse cx="32" cy="${y}" rx="20" ry="6" fill="#e9ecef" stroke="#5f6770"/>`).join("")}
    <ellipse cx="32" cy="12" rx="12" ry="3" fill="#fff" opacity=".6"/>`,
  backup: u => `
    <defs>
      <linearGradient id="box${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e1b878"/><stop offset="1" stop-color="#a87a3c"/></linearGradient>
      <linearGradient id="arw${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#1663c7"/></linearGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="24" ry="3" fill="#000" opacity=".18"/>
    <path d="M8 30h48v26H8z" fill="url(#box${u})" stroke="#7a5526"/>
    <path d="M8 30l6-8h36l6 8z" fill="#c99a57" stroke="#7a5526"/>
    <path d="M27 30h10v8H27z" fill="#f2e3c4" opacity=".8"/>
    <path d="M20 22a14 14 0 0 1 24-12" fill="none" stroke="url(#arw${u})" stroke-width="5" stroke-linecap="round"/>
    <path d="M47 3l1 12-12-2z" fill="#1663c7"/>
    <path d="M30 44h18" stroke="#7a5526" stroke-width="1.2"/><path d="M30 48h12" stroke="#7a5526" stroke-width="1.2"/>`,
  update: u => `
    <defs>
      <radialGradient id="globe${u}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#bfe6ff"/><stop offset=".5" stop-color="#2f8ae0"/><stop offset="1" stop-color="#0c3d84"/></radialGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="20" ry="3" fill="#000" opacity=".18"/>
    <circle cx="32" cy="31" r="25" fill="url(#globe${u})" stroke="#0b346f"/>
    <g fill="none" stroke="#fff" stroke-width="1" opacity=".45"><ellipse cx="32" cy="31" rx="11" ry="25"/><path d="M7 31h50M10 19h44M10 43h44"/></g>
    <path d="M20 31a12 12 0 0 1 21-8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M44 15v11h-11z" fill="#fff"/>
    <path d="M44 31a12 12 0 0 1-21 8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M20 47V36h11z" fill="#fff"/>
    <circle cx="48" cy="48" r="10" fill="#d8312b" stroke="#fff" stroke-width="2"/>
    <path d="M42.5 48h11" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="27" cy="15" rx="12" ry="5" fill="#fff" opacity=".3"/>`
};

export function icon(name, size = 32) {
  const u = "i" + (++n);
  return svg(DRAW[name](u)).replace('width="32" height="32"', `width="${size}" height="${size}"`);
}
