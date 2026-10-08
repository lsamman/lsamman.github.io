# Home

A browser start page at **/home/**: the Dreamliner skyline and weather (rain Mar-Oct, snow Nov-Feb) behind a grid of rounded app icons that open your favourite sites. Set its address as your browser's home page.

- **Weather:** the ☂/❄ button switches between rain and snow until the season changes.
- **Open a site:** click or tap its icon.
- **Edit:** press **Edit** (top right). Icons wiggle. Drag one to any cell (dropping on another icon swaps them), tap one to change its name, address, icon or colour, tap a **+** to add one, tap the red **x** to remove one. Press **Done** or Esc to finish.
- Leave the icon field blank to use the site's own icon, or type an emoji or letters.
- Shortcuts are saved in this browser only (`localStorage`, key `home.shortcuts`).
- Files: `index.html`, `css/home.css`, `js/shortcuts.js` (saved list), `js/grid.js` (grid, drag and drop, dialog). The skyline, weather and sound are the shared `../js/scene.js`, `rain.js` and `audio.js`.
