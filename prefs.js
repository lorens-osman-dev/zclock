import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {drawClock} from './src/renderer.js';

export default class GclockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(640, 820);
        const page = new Adw.PreferencesPage({title: 'gclock', icon_name: 'preferences-system-time-symbolic'});
        window.add(page);

        const previewGroup = new Adw.PreferencesGroup({title: 'gclock', description: 'Time, quietly. Rotating dials inspired by your reference.'});
        const preview = new Gtk.DrawingArea({content_height: 250, hexpand: true});
        preview.set_draw_func((_area, cr, width, height) => {
            cr.setSourceRGB(0.025, 0.025, 0.03);
            cr.paint();
            cr.save();
            const clockWidth = height * 640 / 860;
            cr.translate((width - clockWidth) / 2, 0);
            drawClock(cr, clockWidth, height, new Date(), {
                use24Hour: settings.get_boolean('use-24-hour'),
                showSeconds: settings.get_boolean('show-seconds'),
                opacity: settings.get_int('opacity') / 100,
            });
            cr.restore();
        });
        previewGroup.add(preview);
        page.add(previewGroup);

        const appearance = new Adw.PreferencesGroup({title: 'Appearance'});
        page.add(appearance);
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
        this._spin(placement, settings, 'height', 'Size', 'Height in logical pixels; automatically fits your display', 240, 1600, 20);
        this._spin(placement, settings, 'position-x', 'Horizontal position', '0 = left · 50 = center · 100 = right', 0, 100, 1);
        this._spin(placement, settings, 'position-y', 'Vertical position', '0 = top · 50 = center · 100 = bottom', 0, 100, 1);
        this._spin(placement, settings, 'monitor', 'Display', '−1 = primary display · 0 = first · 1 = second', -1, 32, 1);
        const reset = new Gtk.Button({label: 'Reset to defaults', halign: Gtk.Align.END, margin_top: 12});
        reset.connect('clicked', () => {
            for (const key of settings.settings_schema.list_keys())
                settings.reset(key);
        });
        placement.add(reset);

        const changed = settings.connect('changed', () => preview.queue_draw());
        const timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            preview.queue_draw();
            return GLib.SOURCE_CONTINUE;
        });
        window.connect('close-request', () => {
            GLib.Source.remove(timer);
            settings.disconnect(changed);
            return false;
        });
    }

    _spin(group, settings, key, title, subtitle, lower, upper, step) {
        const row = new Adw.SpinRow({title, subtitle,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5}),
            digits: 0,
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
}
