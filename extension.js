import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {widgetBounds} from './src/model.js';
import {drawClock} from './src/renderer.js';

export default class GclockExtension extends Extension {
    enable() {
        this._signals = [];
        this._settings = this.getSettings();
        this._area = new St.DrawingArea({
            name: 'gclock-desktop-clock',
            reactive: false,
            can_focus: false,
            accessible_name: 'Desktop clock',
        });
        this._area.connect('repaint', area => {
            const cr = area.get_context();
            try {
                const [width, height] = area.get_surface_size();
                drawClock(cr, width, height, new Date(), {
                    use24Hour: this._settings.get_boolean('use-24-hour'),
                    showSeconds: this._settings.get_boolean('show-seconds'),
                    opacity: this._settings.get_int('opacity') / 100,
                });
            } finally {
                cr.$dispose();
            }
        });
        // A child of window_group below all windows, but above its wallpaper
        // group. Unlike addChrome(), this neither reserves space nor steals clicks.
        global.window_group.insert_child_above(this._area, Main.layoutManager._backgroundGroup);
        this._connect(this._settings, 'changed', () => this._update());
        this._connect(Main.layoutManager, 'monitors-changed', () => this._update());
        this._connect(global.display, 'workareas-changed', () => this._update());
        this._connect(Main.overview, 'showing', () => this._syncVisibility());
        this._connect(Main.overview, 'hidden', () => this._syncVisibility());
        this._connect(Main.sessionMode, 'updated', () => this._syncVisibility());
        this._update();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (this._area.visible)
                this._area.queue_repaint();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _update() {
        const monitors = Main.layoutManager.monitors;
        if (!monitors.length) {
            this._area.hide();
            return;
        }
        const requested = this._settings.get_int('monitor');
        const index = requested >= 0 && requested < monitors.length
            ? requested : Math.max(0, Main.layoutManager.primaryIndex);
        const bounds = widgetBounds(Main.layoutManager.getWorkAreaForMonitor(index),
            this._settings.get_int('height'),
            this._settings.get_int('position-x'),
            this._settings.get_int('position-y'));
        this._area.set_position(bounds.x, bounds.y);
        this._area.set_size(bounds.width, bounds.height);
        this._syncVisibility();
        this._area.queue_repaint();
    }

    _syncVisibility() {
        this._area.visible = Main.layoutManager.monitors.length > 0 &&
            !Main.sessionMode.isLocked &&
            !(Main.overview.visible && this._settings.get_boolean('hide-in-overview'));
        if (this._area.visible)
            this._area.queue_repaint();
    }

    disable() {
        if (this._timer) {
            GLib.Source.remove(this._timer);
            this._timer = null;
        }
        for (const [object, id] of this._signals ?? [])
            object.disconnect(id);
        this._signals = [];
        this._area?.destroy();
        this._area = null;
        this._settings = null;
    }
}
