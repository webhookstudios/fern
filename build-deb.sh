#!/bin/sh
# Builds dist/fern_<version>_all.deb. Needs only dpkg-deb.
#
#   /usr/share/fern/            the app's code
#   /usr/bin/fern               launcher
#   /usr/share/applications, /usr/share/icons   apps-menu entry and icon
set -e

APP_ID=io.github.webhookstudios.Fern
ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

install -d "$STAGE/DEBIAN" "$STAGE/usr/bin" "$STAGE/usr/share/fern" \
    "$STAGE/usr/share/applications" \
    "$STAGE/usr/share/icons/hicolor/scalable/apps" \
    "$STAGE/usr/share/doc/fern"
install -m 644 "$ROOT"/src/*.js "$STAGE/usr/share/fern/"
cp -r "$ROOT/src/sedge" "$STAGE/usr/share/fern/"
find "$STAGE/usr/share/fern/sedge" -type f -exec chmod 644 {} +
install -m 755 "$ROOT/bin/fern" "$STAGE/usr/bin/fern"
install -m 644 "$ROOT/data/$APP_ID.svg" "$STAGE/usr/share/icons/hicolor/scalable/apps/"
sed -e 's|@EXEC@|fern|' -e "s|@ICON@|$APP_ID|" "$ROOT/data/$APP_ID.desktop.in" \
    > "$STAGE/usr/share/applications/$APP_ID.desktop"
chmod 644 "$STAGE/usr/share/applications/$APP_ID.desktop"

cat > "$STAGE/usr/share/doc/fern/copyright" <<EOT
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Fern
Source: https://github.com/webhookstudios/fern

Files: *
Copyright: $(date +%Y) webhookstudios
License: GPL-2+
 On Debian systems, the full text of the GNU General Public License
 version 2 can be found in /usr/share/common-licenses/GPL-2.

Files: */sedge/fonts/*
Copyright: 2023 The Young Serif Project Authors; 2015 The Public Sans Project Authors
License: OFL-1.1
 The full license texts are in the sedge/fonts/ folder.
EOT
chmod 644 "$STAGE/usr/share/doc/fern/copyright"

# Replaces/Breaks take over from this app's old package name, shine.
cat > "$STAGE/DEBIAN/control" <<EOT
Package: fern
Version: $VERSION
Architecture: all
Maintainer: webhookstudios <354619278+webhookstudios@users.noreply.github.com>
Installed-Size: $(du -sk "$STAGE/usr" | cut -f1)
Depends: gjs, gir1.2-adw-1, gir1.2-gtk-4.0, libglib2.0-bin, unzip, tar
Replaces: shine (<< 2~)
Breaks: shine (<< 2~)
Recommends: libgtk-3-bin
Section: gnome
Priority: optional
Homepage: https://github.com/webhookstudios/fern
Description: Icon packs and custom folder icons for GNOME
 Fern lets you apply an icon pack with one click, mix icons from different
 packs, and give Home, Trash and any single folder its own icon.
EOT

find "$STAGE" -type d -exec chmod 755 {} +
mkdir -p "$ROOT/dist"
dpkg-deb --root-owner-group --build "$STAGE" "$ROOT/dist/fern_${VERSION}_all.deb"
