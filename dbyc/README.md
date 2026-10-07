# DBYC

**Dreamliner's Better YouTube Client** — YouTube without the ads or the Shorts. Made by Will.

- **No ads.** Videos play through [Piped](https://github.com/TeamPiped/Piped), an open-source, ad-free way to watch YouTube. If Piped can't play a video, DBYC falls back to YouTube's own player (which may show ads) and tells you so. You can change this in **Settings → Playback**.
- **No Shorts.** They're filtered out of every list: subscriptions, search, trending, channels and Up next.
- **Your subscriptions.** Sign in with Google (read-only) and Home shows the newest videos from the channels you follow.
- **Paste a link.** Paste any YouTube link (including a Shorts link) into the search box to open it in DBYC.

It's a plain web app: HTML, CSS and JavaScript with no build step and no server.

## Run it

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/dbyc/ (run it from the résumé site's folder). Live at https://lsamman.github.io/dbyc/. Everything except your subscriptions works straight away. Trending, search, channels and playback use public Piped servers. DBYC tries several and remembers the one that worked; you can also pick one in Settings.

## Google setup (for your subscriptions)

This takes about 15 minutes, once.

1. Go to https://console.cloud.google.com, then **Select a project → New project**, and name it `DBYC`.
2. **APIs & Services → Library**: search for **YouTube Data API v3** and click **Enable**.
3. **APIs & Services → OAuth consent screen** (it may be called "Google Auth Platform"):
   - Choose **External**.
   - Fill in the app name and your email.
   - Under **Audience → Test users**, add your Google account.
   - Leave it in **Testing**. Since only you use it, it doesn't need Google's review.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Under **Authorized JavaScript origins**, add where you'll open DBYC, `https://lsamman.github.io` (and `http://localhost:8000` for testing on your Mac).
   - Click **Create** and copy the **Client ID**.
5. Paste the client ID into `GOOGLE_CLIENT_ID` in `js/config.js`.

DBYC only asks for read-only YouTube access. The client ID isn't secret; Google only accepts it from the origins you listed.

Two limits to know about:
- **Daily allowance:** the YouTube API gives 10,000 units a day. Loading your feed costs about one unit per subscribed channel, and DBYC caches it for 10 minutes. Search uses Piped, so it doesn't spend your allowance unless Piped is down.
- **Sign-in length:** Google sign-ins last an hour, then DBYC asks you to sign in again.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The page and its look |
| `js/app.js` | Pages (Home, Search, Watch, Channel, Settings) and routing |
| `js/player.js` | Ad-free playback via Piped (HLS or direct), with the YouTube fallback |
| `js/piped.js` | Piped API with automatic server failover |
| `js/youtube.js` | Google sign-in and the YouTube Data API (subscriptions feed) |
| `js/util.js` | Shorts filter, formatting, safe text |
| `js/config.js` | Your Google client ID and the Piped server list |
