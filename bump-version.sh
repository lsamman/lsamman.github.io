#!/bin/sh
# Give this publish a new version number so every visitor's browser loads it fresh.
# Updates the ?v= tags and SITE_VERSION in index.html, and version.json.
# Run this before committing: ./bump-version.sh && git add -A && git commit -m "..." && git push
set -e
cd "$(dirname "$0")"
V=$(date -u +%Y%m%d%H%M%S)
sed -i.bak -E "s/\?v=[0-9]+/?v=$V/g; s/SITE_VERSION = \"[0-9]+\"/SITE_VERSION = \"$V\"/" index.html
rm -f index.html.bak
printf '{ "v": "%s" }\n' "$V" > version.json
echo "Version $V"
