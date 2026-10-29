import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {widgetBounds} from './src/model.js';
import {drawClock} from './src/renderer.js';
import {Logger} from './src/logger.js';

// This class owns Shell-specific resources only: the desktop actor, animation
// driver and signal connections. Time math and artwork live in separate files
// so they can also run outside Shell in the automated tests and GTK preview.
export default class GclockExtension extends Extension {
    enable() {
        // Every enable gets fresh state. Shell can disable/re-enable extensions
        // when locking, changing sessions or applying settings in Extensions.
        this._signals = [];
        this._settings = this.getSettings();
        this._area = new St.DrawingArea({
            name: 'gclock-desktop-clock',
            // The clock is decoration, not a window: let pointer events reach
            // desktop icons/wallpaper and never claim keyboard focus.
            reactive: false,
            can_focus: false,
            accessible_name: 'Desktop clock',
        });
        this._area.connect('repaint', area => {
            // DrawingArea provides a fresh Cairo context for this repaint.
            // A single Date snapshot supplies fractional local time to both
            // dials, so the digital text and rotating scales cannot disagree.
            const cr = area.get_context();
            try {
                const [width, height] = area.get_surface_size();
                drawClock(cr, width, height, new Date(), {
                    use24Hour: this._settings.get_boolean('use-24-hour'),
                    showSeconds: this._settings.get_boolean('show-seconds'),
                    opacity: this._settings.get_int('opacity') / 100,
                    flip: this._settings.get_int('position-x') >= 50,
                });
            } finally {
                // Release native Cairo resources immediately, including when
                // drawing throws; don't leave many contexts waiting for GC.
                cr.$dispose();
            }
        });

        // Put the actor directly into the background group, below normal windows.
        // Unlike addChrome(), this does not reserve panel space or create an
        // input region. This is the only dependency on Shell's background API.
        Main.layoutManager._backgroundGroup.add_child(this._area);

        // A Clutter timeline follows this actor's compositor frame clock.
        // Each frame requests a redraw; unlike a one-second timeout, this
        // shows all the fractional positions calculated by clockState().
        // The duration only defines the repeating timeline, NOT clock time.
        // Sampling Date during repaint avoids timer drift and instantly picks
        // up clock corrections, timezone changes, or a resume from sleep.
        this._timeline = new Clutter.Timeline({
            actor: this._area,
            duration: 1000,
            repeat_count: -1,
        });
        this._connect(this._timeline, 'new-frame', () => this._area.queue_repaint());

        // Both settings and desktop geometry may change while enabled. Always
        // recompute from the current work area rather than saving stale pixels.
        this._connect(this._settings, 'changed', () => this._update());
        this._connect(Main.layoutManager, 'monitors-changed', () => this._update());
        this._connect(global.display, 'workareas-changed', () => this._update());
        this._connect(Main.overview, 'showing', () => this._syncVisibility());
        this._connect(Main.overview, 'hidden', () => this._syncVisibility());
        this._connect(Main.sessionMode, 'updated', () => this._syncVisibility());
        // "visible" is our requested state; "mapped" says an ancestor also
        // permits drawing. Stop animating if Shell unmaps the entire desktop.
        this._connect(this._area, 'notify::mapped', () => this._syncAnimation());
        this._update();

        Logger.info('Gclock enabled , Hi')
    }

    // Remember each connection to a long-lived Shell/settings object. Leaving
    // any of these connected after disable would retain this extension and
    // could call back into an actor that has already been destroyed.
    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _update() {
        const monitors = Main.layoutManager.monitors;
        if (!monitors.length) {
            // Monitor lists can be temporarily empty during hotplug/reconfigure.
            this._syncVisibility();
            return;
        }
        const requested = this._settings.get_int('monitor');
        // -1 follows the primary display. If a chosen display disappears,
        // fall back to primary instead of indexing a nonexistent monitor.
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
        // Never draw over the lock screen. Overview hiding is optional, but
        // monitor availability and lock state always take precedence.
        this._area.visible = Main.layoutManager.monitors.length > 0 &&
            !Main.sessionMode.isLocked &&
            !(Main.overview.visible && this._settings.get_boolean('hide-in-overview'));
        this._syncAnimation();
        if (this._area.visible)
            this._area.queue_repaint();
    }

    _syncAnimation() {
        // Avoid spending CPU on continuous repainting while the clock is hidden.
        // stop() rewinds the timeline; this cannot rewind the dial because its
        // angle comes from real wall-clock time, not timeline progress.
        if (this._area.visible && this._area.mapped) {
            if (!this._timeline.is_playing())
                this._timeline.start();
        } else {
            this._timeline.stop();
        }
    }

    disable() {
        // Stop animation FIRST so no later frame can repaint a destroyed actor.
        this._timeline?.stop();
        for (const [object, id] of this._signals ?? [])
            object.disconnect(id);
        this._signals = [];
        // Break the timeline's reference to the actor as well as our own.
        this._timeline?.set_actor(null);
        this._timeline = null;
        // Destroying the actor also disconnects its own repaint callback.
        this._area?.destroy();
        this._area = null;
        this._settings = null;
    }
}
