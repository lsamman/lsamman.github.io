# Apple Podcasts 2

A podcast player named after the Sacred App from The Legend Of Chris, which Steve Jobs says only the iPhone 3G can run. In the book, Apple Podcasts was the social network Chris, LeBron, Elon and Zuckerberg founded to spread the word of Chris to all the middle-aged men: the first church of Chris. The Prophecy asks for Apple Podcasts 2. Apple Podcasts 1 was deprecated by the Tech Bros. It's built like iTunes 9 on a 2009 Mac: a brushed-aluminium bar with the glowing LCD in the middle, glossy round buttons, a blue-gray source list and album-art grids. The icon is a stained-glass rose window. Made by Will.

- **Search.** Find any show in Apple's podcast directory, by name, host or topic.
- **Top Podcasts.** Apple's current chart. If your browser can't load it, you get a few well-loved shows instead.
- **Congregation.** Your subscriptions. They're listed in the sidebar, with a count of new episodes.
- **New episodes.** Home shows episodes released since you last opened each show. The newest episode of a show you just subscribed to counts as new.
- **Player.** Play and pause, back 15 seconds, forward 30, a scrubber and four speeds (1×, 1.25×, 1.5×, 2×). It keeps playing while you move around the app.
- **Picks up where you left off.** Every episode remembers its spot, even after you close the tab. Finished episodes are marked played (you can also mark them by hand). Blue dots mark unplayed episodes, half dots ones you've started.
- **Up Next.** Queue episodes, reorder them, and they play one after another.
- **Lock screen.** Play, pause and skip from your phone's lock screen or your keyboard's media keys (Media Session API). On a computer, Space plays or pauses and the arrow keys skip.

## How it works

There's no server and no account. Search and episode lists come from the iTunes Search API (`itunes.apple.com/search` and `/lookup`), loaded as JSONP (a `<script>` tag with a `callback=` parameter), because the API doesn't let every site read it directly. The chart comes from Apple's marketing feed (`rss.applemarketingtools.com`). Audio plays straight from each podcast's own host in an `<audio>` element, which doesn't need permission from the host.

Your subscriptions, positions, played episodes, queue and speed are kept in this browser's local storage, under keys starting with `podcasts.`.

## Limits

- Apple's directory lists the latest 100 episodes of a show. Older ones aren't shown.
- New episodes appear when Apple's directory picks them up, which can be a few hours after the show posts them. Home checks your Congregation for new episodes when you open it, at most every 20 minutes. There are no notifications.
- Apple's chart feed may not allow other sites to read it. When it fails, Top Podcasts shows search picks instead.
- Nothing syncs between devices. Each browser has its own Congregation.
- Episode notes are shown as plain text, with links.
- A few hosts block playback from other sites, or move their files. Those episodes show an error in the LCD.

## Run it

From the résumé site's folder, run `python3 -m http.server 8000` and open http://localhost:8000/podcasts/. Live at https://lsamman.github.io/podcasts/.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The page and its iTunes 9 look: the aluminium bar and LCD, the source list, and the phone layout (tab bar with the LCD as a mini player) |
| `js/app.js` | Pages (Home, Congregation, Top Podcasts, Search, a show, Up Next), routing, subscriptions and new episodes, the LCD |
| `js/player.js` | The `<audio>` player: saved positions, played episodes, Up Next, speed, lock-screen controls |
| `js/itunes.js` | The iTunes Search API over JSONP, and Top Podcasts with its fallback |
| `js/util.js` | Storage, safe text, formatting |
| `img/` | The stained-glass icon (`icon.svg`) and the home-screen icon |
