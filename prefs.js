import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {drawClock} from './src/renderer.js';

// Preferences run in a separate GTK process, NOT inside GNOME Shell. Sharing
// only the renderer/model lets us preview the clock without importing Shell's
// St/Clutter objects, which cannot be used in this process.
export default class GclockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // This is the same GSettings schema the desktop actor reads. Bindings
        // update it immediately; there is intentionally no Apply/Save button.
        const settings = this.getSettings();
        window.set_default_size(640, 820);
        const page = new Adw.PreferencesPage({title: 'gclock', icon_name: 'preferences-system-time-symbolic'});
        window.add(page);

        const previewGroup = new Adw.PreferencesGroup({title: 'gclock', description: 'Time, quietly. Rotating dials inspired by your reference.'});
        const preview = new Gtk.DrawingArea({content_height: 250, hexpand: true});
        preview.set_draw_func((_area, cr, width, height) => {
            // This dark color is the PREVIEW backdrop, like a sample wallpaper,
            // not the minute element's background. drawClock leaves that color
            // untouched under the hollow capsule, just as on the real desktop.
            cr.setSourceRGB(0.025, 0.025, 0.03);
            cr.paint();
            cr.save();
            // Fit the reference aspect ratio to the available preview height
            // and center it horizontally instead of stretching the artwork.
            const clockWidth = height * 640 / 860;
            cr.translate((width - clockWidth) / 2, 0);
            drawClock(cr, clockWidth, height, new Date(), {
                use24Hour: settings.get_boolean('use-24-hour'),
                showSeconds: settings.get_boolean('show-seconds'),
                opacity: settings.get_int('opacity') / 100,
                flip: settings.get_int('position-x') >= 50,
            });
            cr.restore();
            // GTK owns this context, so unlike St.DrawingArea's context we do
            // NOT call $dispose(): GTK still needs it after this callback.
        });
        previewGroup.add(preview);
        page.add(previewGroup);

        const appearance = new Adw.PreferencesGroup({title: 'Appearance'});
        page.add(appearance);
        // The table pairs each schema key with its UI text. Gio's two-way
        // binding handles both user interaction and changes from another app.
        for (const [key, title, subtitle] of [
            ['use-24-hour', '24-hour time', 'Display 00–23 instead of 1–12'],
            ['show-seconds', 'Seconds dial', 'The outer ring; the inner ring always shows minutes'],
            ['hide-in-overview', 'Hide in Activities', 'Keep the overview uncluttered'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            appearance.add(row);
        }
        this._spin(appearance, settings, 'opacity', 'Opacity', 'Brightness of the whole clock (%)', 15, 100, 5);

        const placement = new Adw.PreferencesGroup({title: 'Placement', description: 'The clock stays behind windows and lets desktop clicks pass through.'});
        page.add(placement);
        // The spin limits mirror the schema ranges; the Shell model then fits
        // these requested values into the monitor's actual available work area.
        this._spin(placement, settings, 'height', 'Size', 'Height in logical pixels; automatically fits your display', 240, 1600, 20);
        this._spin(placement, settings, 'position-x', 'Horizontal position', '0 = left · 50 = center · 100 = right', 0, 100, 1);
        this._spin(placement, settings, 'position-y', 'Vertical position', '0 = top · 50 = center · 100 = bottom', 0, 100, 1);
        this._spin(placement, settings, 'monitor', 'Display', '−1 = primary display · 0 = first · 1 = second', -1, 32, 1);
        const reset = new Gtk.Button({label: 'Reset to defaults', halign: Gtk.Align.END, margin_top: 12});
        reset.connect('clicked', () => {
            // Reset the schema's values, not hardcoded UI defaults, so future
            // schema changes automatically apply to this button too.
            for (const key of settings.settings_schema.list_keys())
                settings.reset(key);
        });
        placement.add(reset);

        // Repaint immediately when any setting changes. For animation, use
        // GTK's frame clock, the GTK counterpart of the Clutter timeline used
        // on the desktop. A one-second timeout here would preview jerky seconds
        // even though the desktop clock itself now moves smoothly.
        const changed = settings.connect('changed', () => preview.queue_draw());
        const tick = preview.add_tick_callback(() => {
            preview.queue_draw();
            return true; // Keep receiving ticks while the widget is mapped.
        });
        window.connect('close-request', () => {
            // Drop callbacks before the window's children are destroyed; this
            // prevents background work and references to a closed preview.
            preview.remove_tick_callback(tick);
            settings.disconnect(changed);
            return false; // Allow GTK's normal window-close handling.
        });
    }

    // All numeric rows follow the same binding pattern. Gtk.Adjustment owns
    // the bounds and increments; the schema remains the persisted source of
    // truth, and digits: 0 prevents fractional sizes/percentages in the UI.
    _spin(group, settings, key, title, subtitle, lower, upper, step) {
        const row = new Adw.SpinRow({title, subtitle,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5}),
            digits: 0,
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
}
