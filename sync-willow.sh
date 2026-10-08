#!/bin/sh
# Keep /willow/ identical to the main site, except for what willow/js/willow.js changes
# (the "Hi, I'm Dreamliner" item and the Contact email).
# Mirrors the page, styles, scripts, assets and apps from the main site into willow/, deleting
# anything in willow/ that is no longer in the main site, then loads willow/js/willow.js right
# after js/content.js. ./bump-version.sh runs this automatically.
set -e
cd "$(dirname "$0")"
keep=$(mktemp)
cp willow/js/willow.js "$keep"
for d in css js assets bluebird dbyc facebook podcasts settings snapchat; do
  rm -rf "willow/$d"
  cp -R "$d" "willow/$d"
done
cp "$keep" willow/js/willow.js
rm -f "$keep"
cp index.html willow/index.html
sed -i 's#^\( *\)<script src="js/content.js?v=\([0-9]*\)"></script>#&\n\1<script src="js/willow.js?v=\2"></script>#' willow/index.html
rm -f willow/README.md willow/bump-version.sh
echo "willow/ mirrors the main site"
