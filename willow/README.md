# My résumé site

A personal résumé website styled like a dark, gritty 2010-era console dashboard. Flat tiles sit over a city skyline that lights up to match the visitor's time of day, and atmospheric jungle music is generated live in the browser.

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

The site updates itself for visitors. On load it checks `version.json`, and if a newer version has been published it clears the browser's caches and reloads the new one. To mark a new version, run `./bump-version.sh` before committing:

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

The **Settings** category has music, sound effects, volume, time of day (preview dawn/day/dusk/night), accent colour and reduce-motion options. Choices are remembered per visitor.

## How it's built

Plain HTML, CSS and JavaScript, with no frameworks or build step.

| File | What it does |
|---|---|
| `js/content.js` | All your text and images |
| `js/xmb.js` | The menu: layout, controls, settings, start screen |
| `js/detail.js` | The detail panel, its turnstile open/close animation, and links like `#/projects/project-1` |
| `js/scene.js` | The background: time-of-day sky, procedural city with lit windows, wave ribbons (canvas) |
| `js/audio.js` | Jungle music and sound effects, synthesised with the Web Audio API (no audio files or samples) |
| `css/style.css` | All the styling. `--hue` at the top is the default accent colour |
