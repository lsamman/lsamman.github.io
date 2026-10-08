# My résumé site

A personal résumé website styled like a dark, gritty 2010-era console dashboard. Flat tiles sit over a city skyline that lights up to match the visitor's time of day, "Neverending Night" loops as the background music (`assets/audio/neverending-night.mp3`; the old jungle synth plays if it can't load), and the weather plays underneath it: rain from March to October, with drops running down the screen like a window, and a snowstorm from November to February, with a soft wind, white mist in the distance and snow piling on the rooftops. To check both, use the **Rain or snow** switch in Settings (the ☂/❄ button on `/home/`): it lasts until the season changes, then the weather goes back to what the date says. `?weather=snow` or `?weather=rain` in the address also forces one.

Live at **https://lsamman.github.io** (once published).

## Editing your details

Almost everything you'll change is in **`js/content.js`**. Open it, replace the `PLACEHOLDER` text, and save. Each item can have a `title`, `subtitle`, `summary`, `body`, `bullets`, `tags`, `images` and `links`. The comment at the top of the file explains each one.

To use your name in the browser tab and search results, also change `Your Name` in `index.html` (in the `<title>` and `<meta name="description">` lines).

**Adding photos:** copy them into `assets/images/` (JPG or PNG is fine, ideally under ~500 KB each). Then point to them in `content.js`:

```js
images: [{ src: "assets/images/my-app.jpg", caption: "The home screen" }]
```

**If the site goes blank after an edit**, you probably have a missing comma or quote in `content.js`. Press F12 in your browser and look at the Console tab, which shows the line number.

## Previewing on your computer

In a terminal, from this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Refresh the page after each change.

## Publishing changes

The site updates itself for visitors, including people who left a tab open or come back with the Back button. Every page (the résumé, MySpace and Bluebird) checks `version.json` when it loads, when its tab comes back into view, when it's restored with Back, and every 5 minutes. If a newer version has been published, it clears the browser's caches and reloads it, at once on load, or otherwise at the next moment that won't lose anything (a page change, or coming back to the tab), never in the middle of typing or a playing video. To mark a new version, run `./bump-version.sh` before committing:

```
./bump-version.sh
```

Claude does this automatically when it publishes.

```
./bump-version.sh
git add -A
git commit -m "Update my details"
git push
```

The live site updates in about a minute. (Or just ask Claude to "publish my changes".)

## Controls

| Action | Keyboard | Mouse | Phone |
|---|---|---|---|
| Change category | ← → (or A/D) | click an icon / shift+scroll | drag sideways |
| Change item | ↑ ↓ (or W/S) | scroll wheel / click | drag or flick up/down |
| Open | Enter | click the highlighted item | tap the highlighted item |
| Back | Esc | ✕ button or click outside | ✕ button |

The **Settings** category has music, rain (sound and drops on the glass), sound effects, volume, time of day (preview dawn/day/dusk/night), accent colour and reduce-motion options. Choices are remembered per visitor.

## The willow copy

`/willow/` (https://lsamman.github.io/willow/) is a full mirror of this site: same tabs, apps, skyline and weather. `./bump-version.sh` runs `./sync-willow.sh` first, which copies the page, styles, scripts, assets and apps into `willow/` (deleting anything no longer here), so every change you make on the main site reaches both. The only differences live in `willow/js/willow.js`, which loads after `js/content.js`: the gender/pronoun line and profile picture (`willow/willow-avatar.png`) on "Hi, I'm Dreamliner", and the willow email and X link on Contact. Edit that file, not the rest of `willow/`.

## How it's built

Plain HTML, CSS and JavaScript, with no frameworks or build step.

| File | What it does |
|---|---|
| `js/content.js` | All your text and images |
| `js/xmb.js` | The menu: layout, controls, settings, start screen |
| `js/detail.js` | The detail panel, its turnstile open/close animation, and links like `#/projects/project-1` |
| `js/scene.js` | The background: time-of-day sky, procedural city with lit windows, wave ribbons (canvas) |
| `js/rain.js` | The weather on the window: rain (streaks, beads of water that run, trail and merge) Mar-Oct, snowstorm with mist Nov-Feb (canvas) |
| `home/` | A browser start page: the same skyline and weather with a grid of rounded app-icon shortcuts you can add and drag around (see `home/README.md`) |
| `js/audio.js` | Jungle music, rain and sound effects, synthesised with the Web Audio API (no audio files or samples) |
| `css/style.css` | All the styling. `--hue` at the top is the default accent colour |
