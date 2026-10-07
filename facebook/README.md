# Facebook (Pre-Cringe)

A Bluesky client named after the Sacred App from The Legend Of Chris, which Steve Jobs says only the iPhone 3G can run. In the book it's the prize possession of the Projects, found under a build building, in the rubble, on a 67gb micro SD card and kept in the Projects National Archives. This is that copy. It looks like Facebook in 2007, from before the cringe: the blue top bar with the lowercase wordmark, pale blue boxes, 11px Lucida Grande, a column of applications on the left. It works on phones and on desktop. Made by Will.

- **News Feed.** Posts from your friends, merged and sorted strictly by time, newest first. No algorithm, no "top stories", no suggested posts. Text keeps its links and mentions, with photos, link cards, quoted posts, videos (as a link to Bluesky), reposts ("shared a post"), like, repost and comment counts, and 2007 times like "about 3 hours ago". **Older posts** pages back as far as your friends go.
- **Friends.** Find people on Bluesky by name or handle and add them. Remove them just as easily. Bluesky and AT Protocol are your friends to start with, so the feed isn't empty.
- **Profiles.** Tap anyone for a 2007 profile: picture on the left, an Information box (bio, followers, following, posts, member since) and the Wall (their posts, with paging). Add or remove them as a friend, poke them, write on their Wall, or open them on Bluesky.
- **Status updates.** The "[Name] is…" box. Share opens Bluesky's compose page with your status filled in, and you finish posting there. Your updates are kept in your Mini-Feed on your Profile, where you can post one again.
- **Pokes.** Poke anyone from their profile. Pokes stay on this device and nobody is told. Zarkmuckerberg poked you once, before he retired at age 3.

## How it talks to Bluesky

Facebook's API isn't usable from a plain web page, so this runs on Bluesky instead. It reads from Bluesky's public API (`public.api.bsky.app`), which needs no sign-in and allows requests from any website. There's no sign-in and no server. Posting goes through Bluesky's own compose page (`bsky.app/intent/compose`).

| What | Endpoint |
|---|---|
| Profile | `app.bsky.actor.getProfile` |
| Friend search | `app.bsky.actor.searchActorsTypeahead`, then `getProfile` on the exact handle if that fails or finds nothing |
| Feed and Wall | `app.bsky.feed.getAuthorFeed` with `filter=posts_no_replies` |

## How the News Feed is merged

`js/bsky.js` loads the first page of each friend's posts, four friends at a time, and shows them as they arrive. Each friend is paged with their own cursor. A post is only shown once every friend who could still have something newer has been loaded past it, so the order never shifts as you page. Older posts loads further back only for the friends who are holding things up. Reposts are placed by when they were reposted. First pages are cached for four minutes, and **Refresh** skips the cache.

## Limits

- No sign-in, so you can't like, repost or reply from here. Comment opens the post on Bluesky.
- Friends, status updates, pokes and your name are kept in this browser only (`localStorage`, keys starting with `fb.`).
- Replies are left out of the feed and Walls. Posts labelled as sensitive hide their photos until you tap.
- With many friends the first load makes one request per friend.

## Run it

From the résumé site's folder, run `python3 -m http.server 8000` and open http://localhost:8000/facebook/. Live at https://lsamman.github.io/facebook/.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The page and its 2007 look |
| `js/app.js` | Pages (News Feed, Profile, Friends, Pokes), the status box, how posts are drawn, and routing |
| `js/bsky.js` | Bluesky's public API, the feed cache and the merged chronological feed |
| `js/store.js` | Friends, status updates, pokes and your name, kept in this browser |
| `js/util.js` | Safe text, "about 3 hours ago" times, Bluesky rich text (links and mentions) |
| `img/` | The favicon and the home-screen icon |
