#!/bin/sh
# Builds dist/shine_<version>_all.deb. Needs only dpkg-deb.
#
#   /usr/share/shine/            the app's code
#   /usr/bin/shine               launcher
#   /usr/share/applications, /usr/share/icons   apps-menu entry and icon
set -e

APP_ID=io.github.webhookstudios.Shine
ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(cat "$ROOT/VERSION")"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

install -d "$STAGE/DEBIAN" "$STAGE/usr/bin" "$STAGE/usr/share/shine" \
    "$STAGE/usr/share/applications" \
    "$STAGE/usr/share/icons/hicolor/scalable/apps" \
    "$STAGE/usr/share/doc/shine"
install -m 644 "$ROOT"/src/*.js "$STAGE/usr/share/shine/"
install -m 755 "$ROOT/bin/shine" "$STAGE/usr/bin/shine"
install -m 644 "$ROOT/data/$APP_ID.svg" "$STAGE/usr/share/icons/hicolor/scalable/apps/"
sed -e 's|@EXEC@|shine|' -e "s|@ICON@|$APP_ID|" "$ROOT/data/$APP_ID.desktop.in" \
    > "$STAGE/usr/share/applications/$APP_ID.desktop"
chmod 644 "$STAGE/usr/share/applications/$APP_ID.desktop"

cat > "$STAGE/usr/share/doc/shine/copyright" <<EOT
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Shine
Source: https://github.com/webhookstudios/shine

Files: *
Copyright: $(date +%Y) webhookstudios
License: GPL-2+
 On Debian systems, the full text of the GNU General Public License
 version 2 can be found in /usr/share/common-licenses/GPL-2.
EOT
chmod 644 "$STAGE/usr/share/doc/shine/copyright"

cat > "$STAGE/DEBIAN/control" <<EOT
Package: shine
Version: $VERSION
Architecture: all
Maintainer: webhookstudios <354619278+webhookstudios@users.noreply.github.com>
Installed-Size: $(du -sk "$STAGE/usr" | cut -f1)
Depends: gjs, gir1.2-adw-1, gir1.2-gtk-4.0, libglib2.0-bin, unzip, tar
Recommends: libgtk-3-bin
Section: gnome
Priority: optional
Homepage: https://github.com/webhookstudios/shine
Description: Icon packs and custom folder icons for GNOME
 Shine lets you apply an icon pack with one click, mix icons from different
 packs, and give Home, Trash and any single folder its own icon.
EOT

find "$STAGE" -type d -exec chmod 755 {} +
mkdir -p "$ROOT/dist"
dpkg-deb --root-owner-group --build "$STAGE" "$ROOT/dist/shine_${VERSION}_all.deb"
