import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
const root = GLib.getenv('GCLOCK_SOURCE');
const {default: Preferences} = await import(`file://${root}/prefs.js`);
const [, bytes] = GLib.file_get_contents(`${root}/metadata.json`);
const metadata = JSON.parse(new TextDecoder().decode(bytes));
metadata.dir = Gio.File.new_for_path(root);
metadata.path = root;
let failure = null;
const app = new Adw.Application({application_id: 'local.gclock.PreferencesTest', flags: Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate', () => {
    const window = new Adw.PreferencesWindow({application: app});
    try {
        const preferences = new Preferences(metadata);
        preferences.fillPreferencesWindow(window);
        window.present();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            try {
                const widgets = [];
                const visit = widget => {
                    widgets.push(widget);
                    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
                        visit(child);
                };
                visit(window);
                const switches = widgets.filter(w => w instanceof Adw.SwitchRow);
                const spins = widgets.filter(w => w instanceof Adw.SpinRow);
                if (switches.length !== 3 || spins.length !== 5)
                    throw new Error(`Unexpected controls: ${switches.length} switches, ${spins.length} spins`);
                const settings = preferences.getSettings();
                const format = switches.find(w => w.title === '24-hour time');
                format.active = true;
                if (!settings.get_boolean('use-24-hour'))
                    throw new Error('Switch binding did not update settings');
                const size = spins.find(w => w.title === 'Size');
                size.value = 640;
                if (settings.get_int('height') !== 640)
                    throw new Error('Spin binding did not update settings');
                const reset = widgets.find(w => w.get_label?.() === 'Reset to defaults');
                reset.emit('clicked');
                if (settings.get_int('height') !== 740 || settings.get_boolean('use-24-hour'))
                    throw new Error('Reset button did not restore defaults');
                print('PASS: real GTK4/libadwaita preferences render, all controls bind, reset restores defaults');
            } catch (error) {
                failure = error;
            } finally {
                window.close();
                app.quit();
            }
            return GLib.SOURCE_REMOVE;
        });
    } catch (error) {
        failure = error;
        window.close();
        app.quit();
    }
});
app.run([]);
if (failure)
    throw failure;
