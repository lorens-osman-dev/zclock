import { widgetBounds } from "./src/model.js";
import { drawClock } from "./src/renderer.js";
import Clutter from "gi://Clutter";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
// extension.ts
var ZclockExtension = class extends Extension {
	enable() {
		this._signals = [];
		this._clocks = [];
		this._settings = this.getSettings();
		this._connect(this._settings, "changed", () => this._update());
		this._connect(Main.layoutManager, "monitors-changed", () => this._update());
		this._connect(global.display, "workareas-changed", () => this._update());
		this._connect(Main.overview, "showing", () => this._syncVisibility());
		this._connect(Main.overview, "hidden", () => this._syncVisibility());
		this._connect(Main.sessionMode, "updated", () => this._syncVisibility());
		this._update();
	}
	_connect(object, signal, callback) {
		this._signals.push([object, object.connect(signal, callback)]);
	}
	_update() {
		const settings = this._settings;
		if (!settings) return;
		const monitors = Main.layoutManager.monitors;
		if (!monitors.length) {
			this._syncVisibility();
			return;
		}
		const showOnAll = settings.get_boolean("show-on-all-monitors");
		const requested = settings.get_int("monitor");
		const activeIndices = showOnAll ? monitors.map((_, i) => i) : [requested >= 0 && requested < monitors.length ? requested : Math.max(0, Main.layoutManager.primaryIndex)];
		while (this._clocks.length < activeIndices.length) {
			const area = new St.DrawingArea({
				name: "zclock-desktop-clock",
				reactive: false,
				can_focus: false,
				accessible_name: "Desktop clock"
			});
			area.connect("repaint", () => {
				const cr = area.get_context();
				try {
					const [width, height] = area.get_surface_size();
					drawClock(cr, width, height, /* @__PURE__ */ new Date(), {
						use24Hour: settings.get_boolean("use-24-hour"),
						showSeconds: settings.get_boolean("show-seconds"),
						opacity: settings.get_int("opacity") / 100,
						flip: settings.get_int("position-x") >= 50,
						fontName: settings.get_string("font-name"),
						fontColor: settings.get_string("font-color"),
						strokeColor: settings.get_string("stroke-color"),
						fontBold: settings.get_boolean("font-bold"),
						fontSize: settings.get_int("font-size")
					});
				} finally {
					cr.$dispose();
				}
			});
			Main.layoutManager._backgroundGroup.add_child(area);
			const timeline = new Clutter.Timeline({
				actor: area,
				duration: 1e3,
				repeat_count: -1
			});
			timeline.connect("new-frame", () => area.queue_repaint());
			const mappedSignalId = area.connect("notify::mapped", () => this._syncAnimation());
			this._clocks.push({
				area,
				timeline,
				mappedSignalId
			});
		}
		while (this._clocks.length > activeIndices.length) {
			const clock = this._clocks.pop();
			clock.timeline.stop();
			clock.timeline.set_actor(null);
			clock.area.disconnect(clock.mappedSignalId);
			clock.area.destroy();
		}
		for (let i = 0; i < activeIndices.length; i++) {
			const index = activeIndices[i];
			const clock = this._clocks[i];
			const bounds = widgetBounds(Main.layoutManager.getWorkAreaForMonitor(index), settings.get_int("height"), settings.get_int("position-x"), settings.get_int("position-y"));
			clock.area.set_position(bounds.x, bounds.y);
			clock.area.set_size(bounds.width, bounds.height);
			clock.area.queue_repaint();
		}
		this._syncVisibility();
	}
	_syncVisibility() {
		const visible = Main.layoutManager.monitors.length > 0 && !Main.sessionMode.isLocked && !(Main.overview.visible && this._settings?.get_boolean("hide-in-overview"));
		for (const clock of this._clocks) {
			clock.area.visible = visible;
			if (visible) clock.area.queue_repaint();
		}
		this._syncAnimation();
	}
	_syncAnimation() {
		for (const clock of this._clocks) if (clock.area.visible && clock.area.mapped) {
			if (!clock.timeline.is_playing()) clock.timeline.start();
		} else clock.timeline.stop();
	}
	disable() {
		for (const clock of this._clocks) {
			clock.timeline.stop();
			clock.timeline.set_actor(null);
			clock.area.disconnect(clock.mappedSignalId);
			clock.area.destroy();
		}
		this._clocks = [];
		for (const [object, id] of this._signals ?? []) object.disconnect(id);
		this._signals = [];
		this._settings = null;
	}
};
export { ZclockExtension as default };
