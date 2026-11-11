// Your own icon choices. They are written into a small theme, "Shine-Custom", that
// inherits from the pack you picked, so every app that follows the icon theme picks them up.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {CUSTOM_ID, USER_ICONS, iconFile, forgetThemes, run} from './iconthemes.js';

const join = GLib.build_filenamev;
const CONFIG_DIR = join([GLib.get_user_config_dir(), 'fern']);
const CONFIG = join([CONFIG_DIR, 'config.json']);
const DATA = join([GLib.get_user_data_dir(), 'fern']);

// Fern was called Shine. Its saved files are copied over the first time; the old folder stays as a backup.
function bringOver(oldDir, newDir) {
    if (GLib.file_test(newDir, GLib.FileTest.EXISTS) || !GLib.file_test(oldDir, GLib.FileTest.IS_DIR))
        return;
    try {
        Gio.Subprocess.new(['cp', '-a', oldDir, newDir], Gio.SubprocessFlags.NONE).wait(null);
    } catch (e) {
        // Starting fresh is fine.
    }
}
bringOver(join([GLib.get_user_config_dir(), 'shine']), CONFIG_DIR);
bringOver(join([GLib.get_user_data_dir(), 'shine']), DATA);

// What can be changed. `ctx` is the icon-theme folder the icon lives in.
export const SPECIAL = [
    {name: 'user-home', title: 'Home', ctx: 'places'},
    {name: 'user-trash', title: 'Trash (empty)', ctx: 'places'},
    {name: 'user-trash-full', title: 'Trash (full)', ctx: 'places'},
    {name: 'folder', title: 'Folders', ctx: 'places'},
    {name: 'user-desktop', title: 'Desktop', ctx: 'places'},
    {name: 'folder-documents', title: 'Documents', ctx: 'places'},
    {name: 'folder-download', title: 'Downloads', ctx: 'places'},
    {name: 'folder-music', title: 'Music', ctx: 'places'},
    {name: 'folder-pictures', title: 'Pictures', ctx: 'places'},
    {name: 'folder-videos', title: 'Videos', ctx: 'places'},
    {name: 'folder-publicshare', title: 'Public', ctx: 'places'},
    {name: 'folder-templates', title: 'Templates', ctx: 'places'},
    {name: 'org.gnome.Nautilus', title: 'Files app', ctx: 'apps'},
];

let cfg = {base: null, overrides: {}, sidebar: true, folders: {}};
try {
    const [ok, bytes] = GLib.file_get_contents(CONFIG);
    if (ok) cfg = {...cfg, ...JSON.parse(new TextDecoder().decode(bytes))};
} catch { /* first run */ }

function save() {
    GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
    GLib.file_set_contents(CONFIG, JSON.stringify(cfg, null, 2));
}

const iface = () => new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
export const currentTheme = () => iface().get_string('icon-theme');
export const overrideCount = () => Object.keys(cfg.overrides).length;
export const isOverridden = name => name in cfg.overrides;
export const sidebarEnabled = () => cfg.sidebar;
export const folderIcons = () => cfg.folders;

// The pack your icons come from, ignoring the generated theme.
export function baseTheme() {
    if (cfg.base) return cfg.base;
    const cur = currentTheme();
    return cur === CUSTOM_ID ? 'Yaru' : cur;
}

// The theme name to look icons up in right now.
export const activeTheme = () => (overrideCount() ? CUSTOM_ID : baseTheme());

function copyInto(src, destDir, destName) {
    GLib.mkdir_with_parents(destDir, 0o755);
    const dest = Gio.File.new_for_path(join([destDir, destName]));
    Gio.File.new_for_path(src).copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
    return dest.get_path();
}

const extOf = path => (path.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? 'png').toLowerCase();

async function writeTheme() {
    const dir = join([USER_ICONS, CUSTOM_ID]);
    await run(['rm', '-rf', dir]);
    if (!overrideCount()) return;
    const dirs = new Set();
    const files = [];
    for (const [name, o] of Object.entries(cfg.overrides)) {
        const svg = extOf(o.file) === 'svg';
        const folder = `${svg ? 'scalable' : '512x512'}/${o.ctx}`;
        dirs.add(folder);
        files.push([o.file, folder, `${name}.${extOf(o.file)}`]);
        if (cfg.sidebar && o.ctx === 'places')
            files.push([o.file, folder, `${name}-symbolic.${extOf(o.file)}`]);
    }
    for (const [src, folder, fname] of files)
        copyInto(src, join([dir, folder]), fname);

    const ctxName = {places: 'Places', apps: 'Applications'};
    let text = `[Icon Theme]\nName=Shine Custom\nComment=Your icon choices from Shine\nInherits=${baseTheme()}\n` +
        `Directories=${[...dirs].join(',')}\n`;
    for (const d of dirs) {
        const [sz, ctx] = d.split('/');
        text += `\n[${d}]\nSize=${sz === 'scalable' ? 64 : 512}\nMinSize=${sz === 'scalable' ? 8 : 16}\n` +
            `MaxSize=512\nType=Scalable\nContext=${ctxName[ctx]}\n`;
    }
    GLib.file_set_contents(join([dir, 'index.theme']), text);
    run(['gtk-update-icon-cache', '-f', '-t', dir]).catch(() => {});
}

// Writes the custom theme and tells the desktop to switch to it.
async function commit() {
    save();
    await writeTheme();
    forgetThemes();
    const s = iface();
    const target = activeTheme();
    if (s.get_string('icon-theme') === target) {
        // Switching away and back makes apps reload icons that changed in place.
        s.set_string('icon-theme', target === CUSTOM_ID ? baseTheme() : 'Adwaita');
        Gio.Settings.sync();
        await new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => { r(); return GLib.SOURCE_REMOVE; }));
    }
    s.set_string('icon-theme', target);
    Gio.Settings.sync();
}

export async function applyBase(id) {
    cfg.base = id;
    await commit();
}

function store(name, ctx, src) {
    const kept = copyInto(src, join([DATA, 'overrides']), `${name}.${extOf(src)}`);
    cfg.overrides[name] = {file: kept, ctx};
}

export async function setOverride(item, src) {
    store(item.name, item.ctx, src);
    await commit();
}

// Takes the listed icons from another pack. Returns how many that pack had.
export async function useFromPack(packId, items) {
    let n = 0;
    for (const item of items) {
        const f = iconFile(packId, item.name);
        if (!f) continue;
        store(item.name, item.ctx, f);
        n++;
    }
    await commit();
    return n;
}

export async function clearOverride(name) {
    delete cfg.overrides[name];
    await commit();
}

export async function clearAll() {
    cfg.overrides = {};
    await commit();
}

export async function setSidebar(on) {
    cfg.sidebar = on;
    await commit();
}

// ---- Single folders (Files remembers these per folder) ----

export async function setFolderIcon(folder, image) {
    const keep = copyInto(image, join([DATA, 'folder-icons']),
        `${GLib.compute_checksum_for_string(GLib.ChecksumType.SHA1, folder, -1)}.${extOf(image)}`);
    await run(['gio', 'set', '-t', 'string', folder, 'metadata::custom-icon', `file://${keep}`]);
    cfg.folders[folder] = keep;
    save();
}

export async function resetFolderIcon(folder) {
    await run(['gio', 'set', '-t', 'unset', folder, 'metadata::custom-icon']).catch(() => {});
    delete cfg.folders[folder];
    save();
}
