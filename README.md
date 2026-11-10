# Shine

Apply an icon pack to Ubuntu with one click, and give Home, Trash and any single folder its own icon.

![Icon packs, each with a preview of Home, Trash and folders](docs/screenshots/packs.png)

## What it does

- **Icon packs:** see every installed pack with a live preview, pick one, or add new ones from a `.zip` or `.tar` file.
- **Home, Trash and folders:** change the Home, Trash (empty and full), Desktop, Documents, Downloads, Music, Pictures, Videos, Public and Templates icons, plus the Files app icon. Take them from another pack, or use any image of your own.
- **Mix packs:** keep one pack for everything, and borrow just the Home, Trash and folder icons from another.
- **Single folders:** give one specific folder its own picture. Files shows it right away.
- Changes apply to the whole desktop. **Reset all** goes back to the pack's own icons.

![Changing Home, Trash and folder icons one by one](docs/screenshots/special.png)

![Giving single folders their own picture](docs/screenshots/folders.png)

## Requirements

Ubuntu 24.04 or newer with GNOME. Shine has been tested on Ubuntu 26.04 with GNOME Shell 50.1 on Wayland.

## Install

### With the deb package (recommended)

Download `shine_1.0.0_all.deb` from the [latest release](https://github.com/webhookstudios/shine/releases/latest), then install it:

```bash
sudo apt install ./shine_1.0.0_all.deb
```

Open **Shine** from the apps menu. To remove it:

```bash
sudo apt remove shine
```

### From source

```bash
git clone https://github.com/webhookstudios/shine.git
```

```bash
./shine/install.sh
```

## How it works

Shine does not edit your icon packs. Your own choices are written into a small theme called `Shine-Custom` in `~/.local/share/icons/`. It inherits from the pack you picked, so only the icons you changed are different. Shine then sets it as your icon theme. Single folders use the `metadata::custom-icon` setting that Files reads, which stays with the folder.

Your choices are stored in `~/.config/shine/config.json`, and the pictures you chose are kept in `~/.local/share/shine/`.

Icons that apps draw themselves, or that are fixed inside an app, are not changed.

## Development

```bash
SHINE_DIR="$PWD/src" gjs -m bin/shine
```

Build the deb into `dist/` with `./build-deb.sh` (needs only `dpkg-deb`).

| File | Purpose |
|---|---|
| `src/main.js` | The window and its three pages |
| `src/iconthemes.js` | Finding, previewing, adding and removing icon packs |
| `src/overrides.js` | Your icon choices, the `Shine-Custom` theme and single folders |

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
