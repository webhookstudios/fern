import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

import {listThemes, paintable, installArchive, removePack, CUSTOM_ID} from './iconthemes.js';
import * as O from './overrides.js';
import {applyToApp as applySedge} from './sedge/sedge.js';

const APP_ID = 'io.github.webhookstudios.Shine';
const SEDGE_DIR = GLib.build_filenamev([GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]), 'sedge']);
const PREVIEW = ['user-home', 'user-trash', 'folder', 'folder-documents', 'folder-pictures', 'folder-music'];

Gio._promisify(Gtk.FileDialog.prototype, 'open', 'open_finish');
Gio._promisify(Gtk.FileDialog.prototype, 'select_folder', 'select_folder_finish');

const esc = text => GLib.markup_escape_text(text, -1);

function image(themeId, name, size) {
    const p = paintable(themeId, name, size);
    const img = p ? Gtk.Image.new_from_paintable(p) : new Gtk.Image({icon_name: 'image-missing-symbolic'});
    img.pixel_size = size;
    return img;
}

function imageFromFile(path, size) {
    const img = Gtk.Image.new_from_file(path);
    img.pixel_size = size;
    return img;
}

function imageFilter() {
    const f = new Gtk.FileFilter({name: 'Images'});
    f.add_mime_type('image/*');
    const list = new Gio.ListStore({item_type: Gtk.FileFilter});
    list.append(f);
    return list;
}

class ShineWindow {
    constructor(app) {
        this.themes = [];
        this.win = new Adw.ApplicationWindow({application: app, title: 'Fern', default_width: 780, default_height: 760});
        this.toasts = new Adw.ToastOverlay();

        this.stack = new Adw.ViewStack();
        const switcher = new Adw.ViewSwitcher({stack: this.stack, policy: Adw.ViewSwitcherPolicy.WIDE});
        const header = new Adw.HeaderBar({title_widget: switcher});
        const menu = new Gio.Menu();
        menu.append('About Fern', 'app.about');
        header.pack_end(new Gtk.MenuButton({icon_name: 'open-menu-symbolic', menu_model: menu, tooltip_text: 'Main menu'}));

        this.packsPage = new Adw.PreferencesPage();
        this.specialPage = new Adw.PreferencesPage();
        this.foldersPage = new Adw.PreferencesPage();
        this.stack.add_titled_with_icon(this.packsPage, 'packs', 'Icon packs', 'applications-graphics-symbolic');
        this.stack.add_titled_with_icon(this.specialPage, 'special', 'Home, Trash & folders', 'user-home-symbolic');
        this.stack.add_titled_with_icon(this.foldersPage, 'folders', 'Single folders', 'folder-symbolic');

        const view = new Adw.ToolbarView({content: this.stack});
        view.add_top_bar(header);
        this.toasts.set_child(view);
        this.win.set_content(this.toasts);

        this.refresh();
        // Lets a test or a shortcut open straight on one page: packs, special or folders.
        const page = GLib.getenv('SHINE_PAGE');
        if (page) this.stack.set_visible_child_name(page);
    }

    toast(text) {
        this.toasts.add_toast(new Adw.Toast({title: text, timeout: 3}));
    }

    // Runs an async action and reports a failure instead of doing nothing.
    async act(fn, done) {
        try {
            await fn();
            if (done) this.toast(done);
        } catch (e) {
            this.toast(`Something went wrong: ${e.message}`);
        }
        this.refresh();
    }

    refresh() {
        this.themes = listThemes();
        this.buildPacks();
        this.buildSpecial();
        this.buildFolders();
    }

    clear(page, groups) {
        groups.forEach(g => page.remove(g));
    }

    // ---- Page 1: icon packs ----
    buildPacks() {
        if (this._packGroups) this.clear(this.packsPage, this._packGroups);
        const base = O.baseTheme();

        const add = new Gtk.Button({label: 'Add icon pack…', valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
        add.connect('clicked', () => this.addPack());
        const group = new Adw.PreferencesGroup({
            title: 'Icon packs',
            description: 'Pick one to use it everywhere. Anything you change on the next page stays on top of it.',
            header_suffix: add,
        });

        let first = null;
        for (const t of this.themes) {
            const row = new Adw.ActionRow({title: esc(t.name), subtitle: t.user ? 'Added by you' : 'Installed with Ubuntu', activatable: true});
            const strip = new Gtk.Box({spacing: 6, margin_top: 8, margin_bottom: 8});
            for (const n of PREVIEW) strip.append(image(t.id, n, 32));
            row.add_prefix(strip);

            const radio = new Gtk.CheckButton({active: t.id === base, valign: Gtk.Align.CENTER, can_target: false, can_focus: false});
            if (first) radio.set_group(first); else first = radio;
            row.add_suffix(radio);

            const menu = this.packMenu(t);
            row.add_suffix(menu);
            row.connect('activated', () => this.act(() => O.applyBase(t.id), `Using ${t.name}`));
            group.add(row);
        }
        this._packGroups = [group];
        this.packsPage.add(group);
    }

    packMenu(t) {
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 2, margin_top: 6, margin_bottom: 6, margin_start: 6, margin_end: 6});
        const pop = new Gtk.Popover({child: box});
        const item = (label, fn) => {
            const b = new Gtk.Button({label, css_classes: ['flat'], halign: Gtk.Align.FILL});
            b.get_child().halign = Gtk.Align.START;
            b.connect('clicked', () => { pop.popdown(); fn(); });
            box.append(b);
        };
        item('Use as my icon pack', () => this.act(() => O.applyBase(t.id), `Using ${t.name}`));
        item('Take only its Home, Trash and folder icons', () => this.act(async () => {
            const n = await O.useFromPack(t.id, O.SPECIAL);
            this.toast(`Took ${n} icons from ${t.name}`);
        }));
        if (t.user) item('Remove this pack', () => this.act(() => removePack(t), `Removed ${t.name}`));
        return new Gtk.MenuButton({icon_name: 'view-more-symbolic', valign: Gtk.Align.CENTER, popover: pop, css_classes: ['flat']});
    }

    async addPack() {
        const dialog = new Gtk.FileDialog({title: 'Choose an icon pack (.zip or .tar)'});
        const f = new Gtk.FileFilter({name: 'Icon pack archives'});
        for (const p of ['*.zip', '*.tar', '*.tar.gz', '*.tgz', '*.tar.xz', '*.tar.bz2'])
            f.add_pattern(p);
        const list = new Gio.ListStore({item_type: Gtk.FileFilter});
        list.append(f);
        dialog.filters = list;
        try {
            const file = await dialog.open(this.win, null);
            await this.act(async () => {
                const names = await installArchive(file.get_path());
                if (!names.length) throw new Error('no icon pack found in that file');
                this.toast(`Added ${names.join(', ')}`);
            });
        } catch (e) {
            if (!e.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED)) this.toast(`Could not add it: ${e.message}`);
        }
    }

    // ---- Page 2: Home, Trash and folders ----
    buildSpecial() {
        if (this._specialGroups) this.clear(this.specialPage, this._specialGroups);
        const theme = O.activeTheme();

        const reset = new Gtk.Button({label: 'Reset all', valign: Gtk.Align.CENTER, css_classes: ['flat']});
        reset.sensitive = O.overrideCount() > 0;
        reset.connect('clicked', () => this.act(() => O.clearAll(), 'Back to the pack’s own icons'));

        const top = new Adw.PreferencesGroup({title: 'Quick start', header_suffix: reset});
        const names = ['Choose a pack…', ...this.themes.map(t => t.name)];
        const all = new Adw.ActionRow({title: 'Take all of these from one pack', subtitle: 'Mix packs: keep your main pack and borrow just these icons'});
        const allDrop = new Gtk.DropDown({model: Gtk.StringList.new(names), valign: Gtk.Align.CENTER});
        let guard = false;
        allDrop.connect('notify::selected', () => {
            if (guard || allDrop.selected === 0) return;
            const t = this.themes[allDrop.selected - 1];
            this.act(async () => {
                const n = await O.useFromPack(t.id, O.SPECIAL);
                this.toast(`Took ${n} icons from ${t.name}`);
            });
        });
        all.add_suffix(allDrop);
        top.add(all);

        const side = new Adw.SwitchRow({title: 'Also change the small sidebar icons', subtitle: 'The little icons beside Home and Trash in Files', active: O.sidebarEnabled()});
        side.connect('notify::active', () => {
            if (side.active !== O.sidebarEnabled()) this.act(() => O.setSidebar(side.active));
        });
        top.add(side);

        const group = new Adw.PreferencesGroup({title: 'Icons'});
        for (const item of O.SPECIAL) {
            const custom = O.isOverridden(item.name);
            const row = new Adw.ActionRow({title: esc(item.title), subtitle: custom ? 'Changed by you' : 'From your icon pack'});
            row.add_prefix(image(theme, item.name, 40));

            const drop = new Gtk.DropDown({model: Gtk.StringList.new(['From pack…', ...this.themes.map(t => t.name)]), valign: Gtk.Align.CENTER});
            let g2 = false;
            drop.connect('notify::selected', () => {
                if (g2 || drop.selected === 0) return;
                const t = this.themes[drop.selected - 1];
                this.act(async () => {
                    const n = await O.useFromPack(t.id, [item]);
                    this.toast(n ? `Took ${item.title} from ${t.name}` : `${t.name} has no ${item.title} icon`);
                });
            });
            row.add_suffix(drop);

            const pick = new Gtk.Button({label: 'Image…', valign: Gtk.Align.CENTER});
            pick.connect('clicked', () => this.pickImage(item));
            row.add_suffix(pick);

            const undo = new Gtk.Button({icon_name: 'edit-undo-symbolic', valign: Gtk.Align.CENTER, css_classes: ['flat'],
                tooltip_text: 'Go back to the pack’s icon', sensitive: custom});
            undo.connect('clicked', () => this.act(() => O.clearOverride(item.name)));
            row.add_suffix(undo);
            group.add(row);
        }
        this._specialGroups = [top, group];
        this.specialPage.add(top);
        this.specialPage.add(group);
    }

    async pickImage(item) {
        const dialog = new Gtk.FileDialog({title: `Choose an image for ${item.title}`, filters: imageFilter()});
        try {
            const file = await dialog.open(this.win, null);
            await this.act(() => O.setOverride(item, file.get_path()), `${item.title} updated`);
        } catch (e) {
            if (!e.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED)) this.toast(`Could not use it: ${e.message}`);
        }
    }

    // ---- Page 3: single folders ----
    buildFolders() {
        if (this._folderGroups) this.clear(this.foldersPage, this._folderGroups);
        const add = new Gtk.Button({label: 'Add folder…', valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
        add.connect('clicked', () => this.addFolder());
        const group = new Adw.PreferencesGroup({
            title: 'Single folders',
            description: 'Give any one folder its own picture. Files shows it right away, and it stays with the folder.',
            header_suffix: add,
        });
        const entries = Object.entries(O.folderIcons());
        if (!entries.length) {
            group.add(new Adw.ActionRow({title: 'No folders yet', subtitle: 'Click “Add folder…” to start'}));
        }
        for (const [folder, icon] of entries) {
            const row = new Adw.ActionRow({title: esc(GLib.path_get_basename(folder)), subtitle: esc(folder)});
            row.add_prefix(imageFromFile(icon, 40));
            const undo = new Gtk.Button({label: 'Reset', valign: Gtk.Align.CENTER, css_classes: ['flat']});
            undo.connect('clicked', () => this.act(() => O.resetFolderIcon(folder), 'Folder reset'));
            row.add_suffix(undo);
            group.add(row);
        }
        this._folderGroups = [group];
        this.foldersPage.add(group);
    }

    async addFolder() {
        try {
            const folder = await new Gtk.FileDialog({title: 'Choose a folder'}).select_folder(this.win, null);
            const image = await new Gtk.FileDialog({title: 'Choose a picture for it', filters: imageFilter()}).open(this.win, null);
            await this.act(() => O.setFolderIcon(folder.get_path(), image.get_path()), 'Folder updated');
        } catch (e) {
            if (!e.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED)) this.toast(`Could not do that: ${e.message}`);
        }
    }
}

export function main() {
    const app = new Adw.Application({application_id: APP_ID});
    app.connect('startup', () => applySedge(SEDGE_DIR));
    const about = new Gio.SimpleAction({name: 'about'});
    about.connect('activate', () => new Adw.AboutDialog({
        application_name: 'Fern', application_icon: APP_ID, developer_name: 'webhookstudios',
        website: 'https://github.com/webhookstudios/shine', license_type: Gtk.License.GPL_2_0,
        comments: 'Icon packs, and your own icons for Home, Trash and any folder.\n\nPart of the Sedge family of apps.',
    }).present(app.get_active_window()));
    app.add_action(about);
    app.connect('activate', () => {
        const existing = app.get_active_window();
        if (existing) existing.present();
        else new ShineWindow(app).win.present();
    });
    app.run([]);
}
