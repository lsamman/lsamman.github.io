# Settings (Full access)

The Sacred App from The Legend Of Chris that Elon Mush made when he mooshed all the chalkboards on Earth: "a place for computer nerds to tweak their settings on all devices until the ends of all times." The Prophecy asks for "Settings (Full access)", and this one really has it. Every app on the iPhone 3G lives on lsamman.github.io, so they all share one localStorage, and Settings can manage all of them from one place.

It looks like a 2007 preferences window: brushed aluminium, Show All, and rows of pane icons. On a computer it floats over an aurora desktop and the window resizes as panes open. On a phone it fills the screen, panes slide in, and Show All takes you back. Dark mode is a graphite version. Made by Will.

- **Appearance.** One switch sets Light, Dark or Auto for MySpace, Bluebird, Snapchat, Facebook, Podcasts, the wiki and Settings. Each app can also be set on its own.
- **Wallpaper.** Pick the home screen for the iPhone 3G on the wiki: six presets drawn with CSS (God's router at night, The Court, Baja Blast, Club Shadowban, TON 618, Classic iPhone OS 3 blue), your own picture, or Default. A small home screen shows the result.
- **Anti-Social.** What's left of Elon Mush's platform: a touch-grass timer. Set a limit, start it, and when it runs out Settings fills the screen and tells you to go outside.
- **About This Phone.** The iPhone 3G's specs, the Sacred Apps with links, and which of them are installed.
- **Network.** God's router, full bars, 3G. 5G stays off because it awakens Elon Mush's dormant twin.
- **Storage.** How many keys and roughly how many bytes each app keeps, with a Clear button per app and a total.
- **Backup.** Save every app's data to `iphone-3g-backup-YYYY-MM-DD.json`, and restore it with a preview of what will change first.
- **Software Update.** Shows the site version from `../version.json`. Your iPhone 3G is up to date. Never update. The Update button asks Siri 3G, who says no.

## Storage keys other apps can rely on

All of these are in localStorage on lsamman.github.io. Wrap reads in try/catch, since storage can be blocked.

### Themes

Settings writes these. Each app reads its own key when it loads.

| Key | Format | Auto |
|---|---|---|
| `dbyc.theme`, `bluebird.theme`, `ghost.theme`, `fb.theme`, `podcasts.theme`, `settings.theme` | a JSON string: `"light"` or `"dark"` (the stored text includes the quotes) | key removed |
| `loc-theme` (the wiki) | a plain string: `light` or `dark` | key removed |

The usual way to read it, before the stylesheet loads:

```html
<script>try { var t = localStorage.getItem("ghost.theme"); if (t === '"light"' || t === '"dark"') document.documentElement.dataset.theme = JSON.parse(t); } catch (e) {}</script>
```

### `loc.phone.wallpaper`

The home-screen wallpaper of the iPhone 3G on the wiki. It's a complete CSS `background` shorthand value, ready to use as is:

```js
var wp = null;
try { wp = localStorage.getItem("loc.phone.wallpaper"); } catch (e) {}
if (wp) screenEl.style.background = wp;   // otherwise keep the wiki's own default
```

- **Key missing:** Default. Use the wiki's built-in background.
- **A preset:** one or more CSS gradients separated by commas. Some layers carry a position and size, for example `linear-gradient(...) 0 100% / 100% 59% no-repeat`. No image files are used.
- **Your own picture:** `url("data:image/jpeg;base64,...") center / cover no-repeat #000`. The picture is cropped to fill 960 x 640 (landscape, because the phone is sideways) and saved as JPEG. Settings lowers the JPEG quality until the whole value is under about 400,000 characters.

Set it with `style.background`, not `style.backgroundImage`, so the sizes and positions apply. The value is always written by Settings, but treat it as untrusted text: set it through the style property, never by building HTML with it.

### `settings.antisocial`

The Anti-Social timer, as JSON:

```json
{ "limitMinutes": 30, "startedAt": 1791394914188 }
```

- `limitMinutes`: a number of minutes (5 to 180 from the slider, but read it as any positive number).
- `startedAt`: when the timer started, in milliseconds since 1970 (`Date.now()`), or `null` when it isn't running.
- The timer runs out at `startedAt + limitMinutes * 60000`. Key missing or `startedAt` null means no timer.

Any app can show a gentle "go outside" when it's past that time. To stop the timer, write the same object back with `startedAt: null`.

### Backup file

```json
{ "format": "iphone-3g-backup", "version": 1, "from": "Settings (Full access)", "site": "20261007172844",
  "exported": "2026-10-07T17:28:44.000Z", "keys": { "bluebird.theme": "\"dark\"", "loc-theme": "dark" } }
```

`keys` holds each raw localStorage string. A backup only includes, and a restore only writes, keys with these prefixes: `dbyc.`, `bluebird.`, `ghost.`, `fb.`, `podcasts.`, `loc.`, `loc-` and `settings.`. Anything else in a file is skipped.

## Run it

From the résumé site's folder, run `python3 -m http.server 8000` and open http://localhost:8000/settings/. Live at https://lsamman.github.io/settings/.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The page, the preferences window, the aurora desktop and the phone layout |
| `js/app.js` | Show All, the panes, sheets, the Anti-Social timer and the Go outside screen |
| `js/store.js` | Which keys belong to which app, theme reading and writing, sizes, backup and restore |
| `js/wallpapers.js` | The wallpaper presets and the picture shrinker |
| `js/icons.js` | The pane icons, drawn in SVG |
| `img/` | The gear icon (favicon and home-screen icon) |
