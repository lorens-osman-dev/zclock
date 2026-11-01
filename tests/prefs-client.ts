import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
const root = GLib.getenv('GCLOCK_SOURCE');
const staged = `${GLib.getenv('XDG_DATA_HOME')}/gnome-shell/extensions/zclock@lorens`;
const {default: Preferences} = await import(`file://${staged}/prefs.js`) as typeof import('../src/prefs.js');
const [, bytes] = GLib.file_get_contents(`${root}/src/metadata.json`);
const metadata = JSON.parse(new TextDecoder().decode(bytes)) as
    ConstructorParameters<typeof Preferences>[0] & {dir: Gio.File; path: string};
metadata.dir = Gio.File.new_for_path(staged);
metadata.path = staged;
let failure: unknown = null;
const app = new Adw.Application({application_id: 'local.zclock.PreferencesTest', flags: Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate', async () => {
    const window = new Adw.PreferencesWindow({application: app});
    try {
        const preferences = new Preferences(metadata);
        // Instrument the real GTK draw callback without replacing the renderer
        // or simulating frames. Restore the prototype immediately after setup.
        // A stepped one-second preview cannot produce this many actual paints.
        let paints = 0;
        const originalSetDraw = Gtk.DrawingArea.prototype.set_draw_func;
        Gtk.DrawingArea.prototype.set_draw_func = function (callback: Gtk.DrawingAreaDrawFunc | null) {
            originalSetDraw.call(this, (...args) => {
                paints++;
                callback?.(...args);
            });
        };
        try {
            await preferences.fillPreferencesWindow(window);
        } finally {
            Gtk.DrawingArea.prototype.set_draw_func = originalSetDraw;
        }
        window.present();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            try {
                if (paints < 8)
                    throw new Error(`Preview did not animate continuously: ${paints} paints in one second`);
                print(`PASS: smooth GTK preview (${paints} actual paints in one second)`);
                const widgets: Gtk.Widget[] = [];
                const visit = (widget: Gtk.Widget): void => {
                    widgets.push(widget);
                    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
                        visit(child);
                };
                visit(window);
                const switches = widgets.filter(w => w instanceof Adw.SwitchRow);
                const spins = widgets.filter(w => w instanceof Adw.SpinRow);
                if (switches.length !== 5 || spins.length !== 6)
                    throw new Error(`Unexpected controls: ${switches.length} switches, ${spins.length} spins`);
                const settings = preferences.getSettings();
                const bold = switches.find(w => w.title === 'Bold text')!;
                bold.active = true;
                if (!settings.get_boolean('font-bold'))
                    throw new Error('Bold binding did not update settings');
                const fontSize = spins.find(w => w.title === 'Font size')!;
                fontSize.value = 75;
                if (settings.get_int('font-size') !== 75)
                    throw new Error('Font size binding did not update settings');
                const colorButtons = widgets.filter(w => w instanceof Gtk.ColorButton);
                const colorButton = colorButtons.find(w => w.title === 'Choose font color')!;
                const strokeButton = colorButtons.find(w => w.title === 'Choose stroke color');
                if (!strokeButton)
                    throw new Error('Stroke color picker is missing');
                const color = new Gdk.RGBA();
                color.parse('#ff8000');
                colorButton.set_rgba(color);
                colorButton.emit('color-set');
                if (settings.get_string('font-color') !== '#ff8000')
                    throw new Error('Color picker did not update settings');
                settings.set_string('font-color', '#0080ff');
                const selected = colorButton.get_rgba();
                if (selected.red !== 0 || selected.blue !== 1)
                    throw new Error('External color change did not update picker');
                color.parse('#00ff00');
                strokeButton.set_rgba(color);
                strokeButton.emit('color-set');
                if (settings.get_string('stroke-color') !== '#00ff00' || settings.get_string('font-color') !== '#0080ff')
                    throw new Error('Stroke picker must update stroke color independently of font color');
                settings.set_string('stroke-color', '#ff0000');
                const selectedStroke = strokeButton.get_rgba();
                if (selectedStroke.red !== 1 || selectedStroke.green !== 0 || selectedStroke.blue !== 0)
                    throw new Error('External stroke color change did not update picker');
                settings.set_string('stroke-color', 'invalid');
                if (strokeButton.get_rgba().red !== 1 || strokeButton.get_rgba().green !== 1 || strokeButton.get_rgba().blue !== 1)
                    throw new Error('Invalid stroke colors must display the white fallback');
                settings.set_string('stroke-color', '#00ff00');
                settings.set_boolean('font-bold', false);
                settings.set_int('font-size', 125);
                if (bold.active || fontSize.value !== 125)
                    throw new Error('External font settings did not update controls');
                const format = switches.find(w => w.title === '24-hour time')!;
                format.active = true;
                if (!settings.get_boolean('use-24-hour'))
                    throw new Error('Switch binding did not update settings');
                const size = spins.find(w => w.title === 'Size')!;
                size.value = 640;
                if (settings.get_int('height') !== 640)
                    throw new Error('Spin binding did not update settings');
                const reset = widgets.find(w => w instanceof Gtk.Button && w.get_label() === 'Reset to defaults')!;
                reset.emit('clicked');
                if (settings.get_int('height') !== settings.get_default_value('height')!.deep_unpack() || settings.get_boolean('use-24-hour') ||
                    settings.get_boolean('font-bold') || settings.get_int('font-size') !== 100 ||
                    settings.get_string('font-color') !== '#ffffff' || colorButton.get_rgba().red !== 1 ||
                    settings.get_string('stroke-color') !== '#ffffff' || strokeButton.get_rgba().red !== 1 ||
                    strokeButton.get_rgba().green !== 1 || strokeButton.get_rgba().blue !== 1)
                    throw new Error('Reset button did not restore defaults');
                print('PASS: real GTK4/libadwaita preferences render, all controls bind, reset restores defaults');
                print('PASS: stroke color picker persists independently, follows external changes and resets');
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
// Keep promise continuations running while the GTK main loop is active.
await app.runAsync([]);
if (failure)
    throw failure;
