import Clutter from 'gi://Clutter';
import St from 'gi://St';
import type Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {widgetBounds} from './utils/model.js';
import {drawClock} from './utils/renderer.js';
import {Logger} from './utils/logger.js';

// This class owns Shell-specific resources only: the desktop actor, animation
// driver and signal connections. Time math and artwork live in separate files
// so they can also run outside Shell in the automated tests and GTK preview.
export default class ZclockExtension extends Extension {
    declare private _signals: [SignalSource, number][];
    declare private _clocks: ClockInstance[];
    declare private _settings: Gio.Settings | null;

    enable(): void {
        // Every enable gets fresh state. Shell can disable/re-enable extensions
        // when locking, changing sessions or applying settings in Extensions.
        this._signals = [];
        this._clocks = []; // Array to manage multiple actors and timelines
        this._settings = this.getSettings();

        // Both settings and desktop geometry may change while enabled. Always
        // recompute from the current work area rather than saving stale pixels.
        this._connect(this._settings, 'changed', () => this._update());
        this._connect(Main.layoutManager, 'monitors-changed', () => this._update());
        this._connect(global.display, 'workareas-changed', () => this._update());
        this._connect(Main.overview, 'showing', () => this._syncVisibility());
        this._connect(Main.overview, 'hidden', () => this._syncVisibility());
        this._connect(Main.sessionMode, 'updated', () => this._syncVisibility());
        
        this._update();
        if (import.meta.env.DEV)
            Logger.info('Enabled');
    }

    // Remember each connection to a long-lived Shell/settings object. Leaving
    // any of these connected after disable would retain this extension and
    // could call back into an actor that has already been destroyed.
    _connect(object: SignalSource, signal: string, callback: () => void): void {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _update(): void {
        const settings = this._settings;
        if (!settings) return;
        const monitors = Main.layoutManager.monitors;
        if (!monitors.length) {
            // Monitor lists can be temporarily empty during hotplug/reconfigure.
            this._syncVisibility();
            return;
        }

        const showOnAll = settings.get_boolean('show-on-all-monitors');
        const requested = settings.get_int('monitor');
        
        // Determine which monitor indices need a clock rendered
        // -1 follows the primary display. If a chosen display disappears,
        // fall back to primary instead of indexing a nonexistent monitor.
        const activeIndices = showOnAll
            ? monitors.map((_, i) => i)
            : [requested >= 0 && requested < monitors.length ? requested : Math.max(0, Main.layoutManager.primaryIndex)];

        // 1. Create missing clock instances for the required monitors
        while (this._clocks.length < activeIndices.length) {
            const area = new St.DrawingArea({
                name: 'zclock-desktop-clock',
                // The clock is decoration, not a window: let pointer events reach
                // desktop icons/wallpaper and never claim keyboard focus.
                reactive: false,
                can_focus: false,
                accessible_name: 'Desktop clock',
            });

            area.connect('repaint', () => {
                // DrawingArea provides a fresh Cairo context for this repaint.
                // A single Date snapshot supplies fractional local time to both
                // dials, so the digital text and rotating scales cannot disagree.
                const cr = area.get_context();
                try {
                    const [width, height] = area.get_surface_size();
                    drawClock(cr, width, height, new Date(), {
                        use24Hour: settings.get_boolean('use-24-hour'),
                        showSeconds: settings.get_boolean('show-seconds'),
                        opacity: settings.get_int('opacity') / 100,
                        // If you added flip or fontName earlier, pass them here too
                        flip: settings.get_int('position-x') >= 50,
                        fontName: settings.get_string('font-name'),
                        fontColor: settings.get_string('font-color'),
                        strokeColor: settings.get_string('stroke-color'),
                        fontBold: settings.get_boolean('font-bold'),
                        fontSize: settings.get_int('font-size'),
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
            Main.layoutManager._backgroundGroup.add_child(area);

            // A Clutter timeline follows this actor's compositor frame clock.
            // Each frame requests a redraw; unlike a one-second timeout, this
            // shows all the fractional positions calculated by clockState().
            // The duration only defines the repeating timeline, NOT clock time.
            // Sampling Date during repaint avoids timer drift and instantly picks
            // up clock corrections, timezone changes, or a resume from sleep.
            const timeline = new Clutter.Timeline({
                actor: area,
                duration: 1000,
                repeat_count: -1,
            });
            timeline.connect('new-frame', () => area.queue_repaint());

            // "visible" is our requested state; "mapped" says an ancestor also
            // permits drawing. Stop animating if Shell unmaps the entire desktop.
            const mappedSignalId = area.connect('notify::mapped', () => this._syncAnimation());

            this._clocks.push({ area, timeline, mappedSignalId });
        }

        // 2. Remove extra clock instances if the user disabled multi-monitor
        while (this._clocks.length > activeIndices.length) {
            const clock = this._clocks.pop()!;
            clock.timeline.stop();
            clock.timeline.set_actor(null);
            clock.area.disconnect(clock.mappedSignalId);
            clock.area.destroy();
        }

        // 3. Update geometry and boundaries for all active clocks
        for (let i = 0; i < activeIndices.length; i++) {
            const index = activeIndices[i];
            const clock = this._clocks[i];
            const bounds = widgetBounds(Main.layoutManager.getWorkAreaForMonitor(index),
                settings.get_int('height'),
                settings.get_int('position-x'),
                settings.get_int('position-y'));
            
            clock.area.set_position(bounds.x, bounds.y);
            clock.area.set_size(bounds.width, bounds.height);
            clock.area.queue_repaint();
        }

        this._syncVisibility();
    }

    _syncVisibility(): void {
        // Never draw over the lock screen. Overview hiding is optional, but
        // monitor availability and lock state always take precedence.
        const visible = Main.layoutManager.monitors.length > 0 &&
            !Main.sessionMode.isLocked &&
            !(Main.overview.visible && this._settings?.get_boolean('hide-in-overview'));

        for (const clock of this._clocks) {
            clock.area.visible = visible;
            if (visible) clock.area.queue_repaint();
        }
        this._syncAnimation();
    }

    _syncAnimation(): void {
        // Avoid spending CPU on continuous repainting while the clock is hidden.
        // stop() rewinds the timeline; this cannot rewind the dial because its
        // angle comes from real wall-clock time, not timeline progress.
        for (const clock of this._clocks) {
            if (clock.area.visible && clock.area.mapped) {
                if (!clock.timeline.is_playing()) clock.timeline.start();
            } else {
                clock.timeline.stop();
            }
        }
    }

    disable(): void {
        // Stop animation FIRST so no later frame can repaint a destroyed actor.
        // Break the timeline's reference to the actor as well as our own.
        // Destroying the actor also disconnects its own repaint callback.
        for (const clock of this._clocks) {
            clock.timeline.stop();
            clock.timeline.set_actor(null);
            clock.area.disconnect(clock.mappedSignalId);
            clock.area.destroy();
        }
        this._clocks = [];

        for (const [object, id] of this._signals ?? [])
            object.disconnect(id);
        this._signals = [];
        this._settings = null;
        if (import.meta.env.DEV)
            Logger.info('Disabled');
    }
}
interface SignalSource {
    connect(signal: string, callback: () => void): number;
    disconnect(id: number): void;
}

interface ClockInstance {
    area: St.DrawingArea;
    timeline: Clutter.Timeline;
    mappedSignalId: number;
}
