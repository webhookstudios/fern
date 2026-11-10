// Finding, previewing, installing and removing icon packs.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

const join = GLib.build_filenamev;
export const USER_ICONS = join([GLib.get_user_data_dir(), 'icons']);
const HOME_ICONS = join([GLib.get_home_dir(), '.icons']);
const SEARCH = [USER_ICONS, HOME_ICONS, ...GLib.get_system_data_dirs().map(d => join([d, 'icons']))];
// GLib.KeyFile.has_key is not available from GJS, so ask for the value instead.
function hasKey(kf, group, key) {
    try {
        kf.get_value(group, key);
        return true;
    } catch {
        return false;
    }
}

export const CUSTOM_ID = 'Shine-Custom';
const SKIP = ['hicolor', 'default', 'locolor', 'HighContrast', CUSTOM_ID];

// Every installed icon pack (cursor-only themes have no Directories key, so they are left out).
export function listThemes() {
    const found = new Map();
    for (const base of SEARCH) {
        let en;
        try {
            en = Gio.File.new_for_path(base).enumerate_children('standard::name', 0, null);
        } catch {
            continue;
        }
        let info;
        while ((info = en.next_file(null))) {
            const id = info.get_name();
            if (found.has(id) || SKIP.includes(id)) continue;
            const kf = new GLib.KeyFile();
            try {
                kf.load_from_file(join([base, id, 'index.theme']), GLib.KeyFileFlags.NONE);
                if (!hasKey(kf, 'Icon Theme', 'Directories')) continue;
                if (hasKey(kf, 'Icon Theme', 'Hidden') && kf.get_boolean('Icon Theme', 'Hidden')) continue;
            } catch {
                continue;
            }
            let name = id;
            try { name = kf.get_locale_string('Icon Theme', 'Name', null); } catch { /* keep id */ }
            found.set(id, {id, name, path: join([base, id]), user: base === USER_ICONS || base === HOME_ICONS});
        }
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const cache = new Map();
function themeObject(id) {
    let t = cache.get(id);
    if (!t) {
        t = new Gtk.IconTheme();
        t.set_search_path(SEARCH);
        t.set_theme_name(id);
        cache.set(id, t);
    }
    return t;
}

// Throw away what GTK remembered, so changed icons show up.
export function forgetThemes() {
    cache.clear();
}

export function paintable(themeId, iconName, size) {
    const t = themeObject(themeId);
    if (!t.has_icon(iconName)) return null;
    return t.lookup_icon(iconName, null, size, 1, Gtk.TextDirection.NONE, 0);
}

// The file a pack uses for one icon name, or null when it has none.
export function iconFile(themeId, iconName) {
    const p = paintable(themeId, iconName, 256);
    return p?.get_file()?.get_path() ?? null;
}

export function run(argv) {
    return new Promise((resolve, reject) => {
        const p = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        p.communicate_utf8_async(null, null, (_p, res) => {
            try {
                const [, out] = p.communicate_utf8_finish(res);
                if (p.get_successful()) resolve(out ?? '');
                else reject(new Error(`${argv[0]} failed`));
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Unpacks a zip or tar archive and copies every icon pack inside it into the user's icon folder.
export async function installArchive(path) {
    const tmp = GLib.Dir.make_tmp('shine-XXXXXX');
    try {
        if (/\.zip$/i.test(path)) await run(['unzip', '-q', '-o', path, '-d', tmp]);
        else await run(['tar', '-xf', path, '-C', tmp]);
        const found = (await run(['find', tmp, '-maxdepth', '3', '-name', 'index.theme'])).split('\n').filter(Boolean);
        const names = [];
        GLib.mkdir_with_parents(USER_ICONS, 0o755);
        for (const file of found) {
            const dir = GLib.path_get_dirname(file);
            const kf = new GLib.KeyFile();
            try {
                kf.load_from_file(file, GLib.KeyFileFlags.NONE);
                if (!hasKey(kf, 'Icon Theme', 'Directories')) continue;
            } catch {
                continue;
            }
            const name = GLib.path_get_basename(dir);
            await run(['rm', '-rf', join([USER_ICONS, name])]);
            await run(['cp', '-r', dir, join([USER_ICONS, name])]);
            names.push(name);
        }
        return names;
    } finally {
        run(['rm', '-rf', tmp]).catch(() => {});
        forgetThemes();
    }
}

export async function removePack(theme) {
    if (!theme.user || !theme.path.startsWith(USER_ICONS) && !theme.path.startsWith(HOME_ICONS)) return;
    await run(['rm', '-rf', theme.path]);
    forgetThemes();
}
