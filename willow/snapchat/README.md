# Snapchat: Ghost Protocol Edition

A camera and self-destructing message app named after the Sacred App from The Legend Of Chris, which Steve Jobs says only the iPhone 3G can run. Its subtitle is "Should you choose to accept it." It looks like 2013 Snapchat crossed with a spy dossier: Snapchat yellow and the ghost (now in a spy mask), manila folders, red stamps, a typewriter and a burning fuse. It is always dark, like a briefing room. On wide screens the mission briefing sits beside the app. Made by Will.

- **Snaps.** Take a photo with the rear camera. The iPhone 3G has "No Front Camera: To avoid self-reflection. Literally." So if the only camera faces you (most laptops), the app refuses it until you tap "I accept self-reflection". You can also pick a photo from your library.
- **Caption bar.** Tap the photo to add the classic white-on-translucent caption bar. Drag it up and down.
- **Doodles.** Tap the pen, pick one of six colours and draw with a finger or mouse. Undo takes back the last line.
- **Timer.** Pick 1 to 10 seconds, like 2013.
- **Send.** Shares the snap as a PNG through your phone's share sheet. If the browser can't share files, the PNG is downloaded instead. Save always downloads it.
- **Ghost link.** Puts the snap into a self-destructing link that burns after the timer runs out.
- **Ghosts.** Write a message, optionally with a photo, pick when the link expires (1 hour, 1 day or 1 week) and how long it lasts once opened (5 to 30 seconds). You get a link with a codename like "Operation Sideways Siri".
- **Opening a link.** It shows "Your mission, should you choose to accept it…". Accept, and the message appears under a burning fuse and a countdown. When it hits zero the page glitches and burns away. Opening it again on that device says it's gone.
- **Dossier.** Your Snapstreak (days in a row you sent a snap or a ghost), your agent name, the missions you sent, and the field notes. Ghost mode stops the app keeping a list of what you send.

## How ghost links work

There is no server. The message (and any photo, shrunk to fit) is turned into JSON, compressed when the browser can, and encrypted with AES-GCM using WebCrypto and a fresh random 128-bit key. The key and the encrypted message are packed together into the part of the link after `#`. Browsers never send that part to a website, so GitHub Pages only ever sees a request for `/snapchat/`.

Opening the link unpacks it in the browser. Before you accept, the app checks the expiry and checks whether this device already burned it. When you accept, it is marked burned in `localStorage` straight away, so reloading during the countdown doesn't give a second look.

## Honest limits

These are also in the app, in the Dossier's field notes:

- Anyone who has the link can open it until it expires. Send it only to the person it's for.
- "Burned" is remembered on the device that opened it. Another phone or browser can still open the same link.
- The expiry is checked by the app, not by a server. Someone who knows how could unlock an old link by hand.
- Screenshots exist.
- The timer on a shared PNG is just for show. Only a ghost link actually burns.
- Links with a photo are long (about 7 to 60 KB). Some chat apps cut long links short, and the app says so.
- Very old browsers without `DecompressionStream` can't open compressed links. They get a clear message.
- The camera needs https (or localhost). Some browsers don't say which way a camera faces. Then the app counts it as a front camera, since webcams point at you.

## Run it

From the résumé site's folder, run `python3 -m http.server 8000` and open http://localhost:8000/snapchat/. Live at https://lsamman.github.io/snapchat/.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/app.css` | The page, the self-update check and the dossier look |
| `js/app.js` | Tabs and routing, the Snapstreak, the Dossier settings, the intro |
| `js/camera.js` | The camera and the self-reflection refusal, the caption bar, doodles, the timer, sharing and saving |
| `js/ghost.js` | Writing ghost messages, making links, and the mission screen with the fuse and the burn |
| `js/crypto.js` | AES-GCM sealing and opening, and the link format |
| `js/store.js` | Storage (all keys start with `ghost.`), toasts and the streak |
| `js/lore.js` | Codenames and in-world lines from the book |
| `img/` | The favicon and the home-screen icon |
