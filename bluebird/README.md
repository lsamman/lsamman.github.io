# Twitter: Bluebird Variant (with no limits)

An X client named after the Sacred App from The Legend Of Chris, which Steve Jobs says only the iPhone 3G can run. It's the 2009 sky-and-clouds Twitter, before the X: it boots as Club Shadowban's giant rotating X (suspended by Elon's tears) shatters and the bird flies out. Made by Will.

- **No limits.** No character counter, just ∞. Anything longer than X's 280 characters is split at word boundaries into a numbered thread, with a Post button for each part.
- **No auto-correct.** The text box has spellcheck and auto-correct turned off. You are forced to mean what you say.
- **The Canon.** A home timeline of tweets from the book's characters, quoted from the book. Reply, retweet (the 2009 way: `RT @handle:`) and favorite (a star, not a heart).
- **Look up.** Paste a tweet link (x.com, twitter.com, fxtwitter…) or an @handle to see it through X's own embed, and save tweets to your Nest.
- **Nest.** Favorites, saved tweets and drafts, kept in this browser only.
- **Settings.** Light, dark or auto; how often the intro plays; firmware locked to Never update.

## How it talks to X

X's API isn't open to a plain web page, so Bluebird has no sign-in and no server. Posting opens X's own share page (`x.com/intent/post`) with your text filled in, and tweets and profiles are shown with X's embed script (`platform.twitter.com/widgets.js`), which loads only when you look something up. X only shows profile timelines to people signed in to X in the same browser.

## Run it

From the résumé site's folder, run `python3 -m http.server 8000` and open http://localhost:8000/bluebird/. Live at https://lsamman.github.io/bluebird/.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The page and its look |
| `js/app.js` | Pages (Home, Tweet, Look up, Nest, Settings), the thread splitter, X embeds, the boot intro |
| `js/canon.js` | The Canon timeline, trending topics and the boot lines |
| `img/` | The bird and the home-screen icon |
