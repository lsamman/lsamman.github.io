#!/bin/sh
# Keep the /willow/ copy of the site in step with the main one.
# Copies the shared engine files (background, weather, audio, detail panel...) from the main site into willow/,
# so a change to them goes live on both. willow's own pages and content (index.html, css/, js/xmb.js, js/content.js,
# dbyc/) are NOT touched: edit those in willow/ by hand when a change should apply there too.
# ./bump-version.sh runs this automatically.
set -e
cd "$(dirname "$0")"
mkdir -p willow/js willow/assets/audio
for f in js/rain.js js/scene.js js/audio.js js/sun.js js/launches.js js/nowplaying.js js/detail.js assets/audio/neverending-night.mp3; do
  cmp -s "$f" "willow/$f" 2>/dev/null || { cp "$f" "willow/$f"; echo "synced $f"; }
done
