#!/bin/sh
# Installs Fern for the current user, without root.
set -e

APP_ID=io.github.webhookstudios.Fern
ROOT="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/fern/app"

mkdir -p "$DEST" "$DATA/applications" "$DATA/icons/hicolor/scalable/apps"
rm -rf "$DEST"/*
cp "$ROOT"/src/*.js "$DEST/"
cp "$ROOT/bin/fern" "$DEST/launcher.js"
cp "$ROOT/data/$APP_ID.svg" "$DATA/icons/hicolor/scalable/apps/"
ICON="$DATA/icons/hicolor/scalable/apps/$APP_ID.svg"
sed -e "s|@EXEC@|env FERN_DIR=\"$DEST\" gjs -m \"$DEST/launcher.js\"|" -e "s|@ICON@|$ICON|" \
    "$ROOT/data/$APP_ID.desktop.in" > "$DATA/applications/$APP_ID.desktop"
update-desktop-database "$DATA/applications" 2>/dev/null || true

echo "Fern is installed. Open it from the apps menu."
