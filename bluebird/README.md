# Twitter: Bluebird Variant (with no limits)

An X client named after the Sacred App from The Legend Of Chris, which Steve Jobs says only the iPhone 3G can run. It's built as an iPhone OS 3 app: blue-gray navigation bar, segmented controls, pinstripe grouped tables and the black glossy tab bar. On a computer it runs on a virtual iPhone 3G, sideways and cracked, as the book describes it. On a phone, it fills the screen. It boots as Club Shadowban's giant rotating X (suspended by Elon's tears) shatters and the bird flies out. Made by Will.

- **Timeline.** Characters from the book tweet through the day. Tweets appear at random times, a "new tweets" bar shows up when someone posts, and every visitor sees the same timeline. Only fictional and book-invented characters post (Elon Mush, not Elon Musk).
- **Following.** Follow real X accounts by @handle and tap one to see its latest posts through X's embed.
- **The Canon.** Tweets quoted straight from the book.
- **No limits.** The counter is ∞. Anything longer than X's 280 characters is split at word boundaries into a numbered thread, with a Post button for each part.
- **No auto-correct.** The text box has spellcheck and auto-correct turned off. You are forced to mean what you say.
- **Look up.** Paste a tweet link (x.com, twitter.com, fxtwitter…) or an @handle to see it through X's embed. Save tweets and follow accounts from there.
- **Nest.** Favorites (a star, not a heart), saved tweets and drafts, kept in this browser only.
- **Settings.** Day, Night (the black bar style) or Auto; how often the intro plays; Software Update locked to Never.

## How it talks to X

X's API isn't open to a plain web page, so Bluebird has no sign-in and no server. Posting opens X's own share page (`x.com/intent/post`) with your text filled in, and tweets and profiles are shown with X's embed script (`platform.twitter.com/widgets.js`), which loads only when needed. X only shows profile timelines to people signed in to X in the same browser.

## How the Timeline is generated

`js/feed.js` works everything out from the date with a seeded random number generator, so there's no server. Each day gets 12 to 20 tweets at random minutes (mostly in waking hours). Each tweet picks a character and one of their lines, then fills in places, items, factions and events from the wiki. To add a character, give them an entry in `CAST` with a few lines in their voice.

## Run it

From the résumé site's folder, run `python3 -m http.server 8000` and open http://localhost:8000/bluebird/. Live at https://lsamman.github.io/bluebird/.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The iPhone 3G, the iPhone OS 3 look |
| `js/app.js` | Screens (Timeline, New Tweet, Look up, Nest, Settings), the thread splitter, X embeds, the boot intro |
| `js/feed.js` | The generated Timeline: the cast, their lines and the daily schedule |
| `js/canon.js` | Tweets quoted from the book, trending topics and the boot lines |
| `img/` | The bird and the home-screen icon |
