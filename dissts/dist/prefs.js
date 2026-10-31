import { drawClock } from "./src/renderer.js";

import Adw from "gi://Adw";

import Gio from "gi://Gio";

import Gdk from "gi://Gdk";

import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

var ZclockPreferences = class extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(640, 820);
        const page = new Adw.PreferencesPage({
            title: "Zclock",
            icon_name: "preferences-system-time-symbolic"
        });
        window.add(page);
        const previewGroup = new Adw.PreferencesGroup({
            title: "Zclock",
            description: ""
        });
        const preview = new Gtk.DrawingArea({
            content_height: 250,
            hexpand: true
        });
        preview.set_draw_func((_area, cr, width, height) => {
            cr.setSourceRGB(.025, .025, .03);
            cr.paint();
            cr.save();
            const clockWidth = height * 640 / 860;
            if (settings.get_int("position-x") >= 50) cr.translate(width - clockWidth, 0); else cr.translate(0, 0);
            drawClock(cr, clockWidth, height, new Date, {
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
            cr.restore();
        });
        previewGroup.add(preview);
        page.add(previewGroup);
        const appearance = new Adw.PreferencesGroup({
            title: "Appearance"
        });
        page.add(appearance);
        const fontRow = new Adw.ActionRow({
            title: "Font family"
        });
        const fontButton = new Gtk.FontButton({
            valign: Gtk.Align.CENTER,
            use_font: true,
            use_size: false,
            level: Gtk.FontChooserLevel.FAMILY
        });
        fontRow.add_suffix(fontButton);
        settings.bind("font-name", fontButton, "font", Gio.SettingsBindFlags.DEFAULT);
        appearance.add(fontRow);
        const syncColors = [ [ "font-color", "Font color" ], [ "stroke-color", "Stroke color" ] ].map(([key, title]) => {
            const colorRow = new Adw.ActionRow({
                title: title
            });
            const colorButton = new Gtk.ColorButton({
                title: `Choose ${title.toLowerCase()}`,
                valign: Gtk.Align.CENTER,
                use_alpha: false
            });
            colorRow.add_suffix(colorButton);
            colorRow.activatable_widget = colorButton;
            appearance.add(colorRow);
            const syncColor = () => {
                const color = new Gdk.RGBA;
                const value = settings.get_string(key);
                color.parse(/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff");
                colorButton.set_rgba(color);
            };
            syncColor();
            colorButton.connect("color-set", () => {
                const color = colorButton.get_rgba();
                const hex = [ color.red, color.green, color.blue ].map(channel => Math.round(channel * 255).toString(16).padStart(2, "0")).join("");
                settings.set_string(key, `#${hex}`);
            });
            return syncColor;
        });
        const boldRow = new Adw.SwitchRow({
            title: "Bold text"
        });
        settings.bind("font-bold", boldRow, "active", Gio.SettingsBindFlags.DEFAULT);
        appearance.add(boldRow);
        this._spin(appearance, settings, "font-size", "Font size", "Text scale (%) · independent of the overall clock size", 50, 150, 5);
        for (const [key, title, subtitle] of [ [ "use-24-hour", "24-hour time", "Display 00–23 instead of 1–12" ], [ "show-seconds", "Seconds dial", "The outer ring; the inner ring always shows minutes" ], [ "hide-in-overview", "Hide in Activities", "Keep the overview uncluttered" ] ]) {
            const row = new Adw.SwitchRow({
                title: title,
                subtitle: subtitle
            });
            settings.bind(key, row, "active", Gio.SettingsBindFlags.DEFAULT);
            appearance.add(row);
        }
        this._spin(appearance, settings, "opacity", "Opacity", "Brightness of the whole clock (%)", 15, 100, 5);
        const placement = new Adw.PreferencesGroup({
            title: "Placement",
            description: "The clock stays behind windows and lets desktop clicks pass through."
        });
        page.add(placement);
        this._spin(placement, settings, "height", "Size", "Height in logical pixels; automatically fits your display", 240, 1600, 20);
        this._spin(placement, settings, "position-x", "Horizontal position", "0 = left · 50 = center · 100 = right", 0, 100, 1);
        this._spin(placement, settings, "position-y", "Vertical position", "0 = top · 50 = center · 100 = bottom", 0, 100, 1);
        this._spin(placement, settings, "monitor", "Display", "−1 = primary display · 0 = first · 1 = second", -1, 32, 1);
        const allMonitorsRow = new Adw.SwitchRow({
            title: "Show on all displays",
            subtitle: "Display the clock on every connected screen"
        });
        settings.bind("show-on-all-monitors", allMonitorsRow, "active", Gio.SettingsBindFlags.DEFAULT);
        placement.add(allMonitorsRow);
        const reset = new Gtk.Button({
            label: "Reset to defaults",
            halign: Gtk.Align.END,
            margin_top: 12
        });
        reset.connect("clicked", () => {
            for (const key of settings.settings_schema.list_keys()) settings.reset(key);
        });
        placement.add(reset);
        const changed = settings.connect("changed", () => {
            for (const syncColor of syncColors) syncColor();
            preview.queue_draw();
        });
        const tick = preview.add_tick_callback(() => {
            preview.queue_draw();
            return true;
        });
        window.connect("close-request", () => {
            preview.remove_tick_callback(tick);
            settings.disconnect(changed);
            return false;
        });
    }
    _spin(group, settings, key, title, subtitle, lower, upper, step) {
        const row = new Adw.SpinRow({
            title: title,
            subtitle: subtitle,
            adjustment: new Gtk.Adjustment({
                lower: lower,
                upper: upper,
                step_increment: step,
                page_increment: step * 5
            }),
            digits: 0
        });
        settings.bind(key, row, "value", Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
};

export { ZclockPreferences as default };