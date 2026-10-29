import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function call(iface, method, parameters = null) {
    return Gio.DBus.session.call_sync('org.gnome.Shell', '/org/gnome/Shell',
        iface, method, parameters, null, Gio.DBusCallFlags.NONE, 5000, null).deep_unpack();
}
function evaluate(code) {
    const [ok, result] = call('org.gnome.Shell', 'Eval', new GLib.Variant('(s)', [code]));
    if (!ok)
        throw new Error(`Shell evaluation failed: ${result}`);
    return JSON.parse(result);
}
function expect(condition, message) {
    if (!condition)
        throw new Error(message);
    print(`PASS: ${message}`);
}
function waitFor(fn, description) {
    let last;
    for (let i = 0; i < 80; i++) {
        try { if (fn()) return; } catch (error) { last = error; }
        GLib.usleep(250_000);
    }
    throw new Error(`Timed out: ${description}: ${last ?? ''}`);
}
const uuid = new GLib.Variant('(s)', ['gclock@lorens']);
const info = () => call('org.gnome.Shell.Extensions', 'GetExtensionInfo', uuid)[0];
const actor = `global.window_group.get_children().find(a => a.name === 'gclock-desktop-clock')`;
waitFor(() => info().state.deep_unpack() === 1, 'extension enabled');
waitFor(() => evaluate('true'), 'private test driver');
// Close the startup overview to exercise the actual desktop widget.
evaluate('Main.overview.hide(); true');
waitFor(() => evaluate(`Boolean(${actor}?.visible)`), 'clock visible');
expect(info().state.deep_unpack() === 1, 'GNOME Shell 50 loaded gclock without errors');
const initial = evaluate(`(() => { const a=${actor}; const c=global.window_group.get_children(); return {x:a.x,y:a.y,width:a.width,height:a.height,reactive:a.reactive,aboveWallpaper:c.indexOf(a)>c.indexOf(Main.layoutManager._backgroundGroup)}; })()`);
expect(initial.height === 740, 'configured clock size is applied');
expect(initial.reactive === false, 'clock is click-through');
expect(initial.aboveWallpaper, 'clock is above wallpaper in the window layer');
const screenshot = GLib.getenv('GCLOCK_TEST_ROOT') + '/desktop.png';
const [captured] = Gio.DBus.session.call_sync('org.gnome.Shell', '/org/gnome/Shell/Screenshot',
    'org.gnome.Shell.Screenshot', 'Screenshot',
    new GLib.Variant('(bbs)', [false, false, screenshot]), null,
    Gio.DBusCallFlags.NONE, 10000, null).deep_unpack();
expect(captured && GLib.file_test(screenshot, GLib.FileTest.EXISTS), 'actual compositor screenshot captured');

const schemaDir = GLib.getenv('XDG_DATA_HOME') + '/gnome-shell/extensions/gclock@lorens/schemas';
const source = Gio.SettingsSchemaSource.new_from_directory(schemaDir, Gio.SettingsSchemaSource.get_default(), false);
const settings = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.gclock', false)});
settings.set_int('height', 500);
settings.set_int('position-x', 100);
settings.set_int('position-y', 100);
settings.set_boolean('use-24-hour', true);
settings.set_boolean('show-seconds', false);
settings.set_int('opacity', 65);
Gio.Settings.sync();
waitFor(() => evaluate(`${actor}.height`) === 500, 'live size update');
const changed = evaluate(`(() => { const a=${actor}; return {x:a.x,y:a.y,height:a.height}; })()`);
expect(changed.x > initial.x && changed.y > initial.y, 'live placement settings move the actual actor');
evaluate('Main.overview.show(); true');
waitFor(() => evaluate(`${actor}.visible`) === false, 'overview visibility');
expect(true, 'clock hides in overview');
evaluate('Main.overview.hide(); true');
waitFor(() => evaluate(`${actor}.visible`) === true, 'restore desktop');
expect(true, 'clock returns after overview');

call('org.gnome.Shell.Extensions', 'DisableExtension', uuid);
waitFor(() => info().state.deep_unpack() === 2, 'disabled');
expect(evaluate(`Boolean(${actor})`) === false, 'disable removes the desktop actor');
call('org.gnome.Shell.Extensions', 'EnableExtension', uuid);
waitFor(() => info().state.deep_unpack() === 1 && evaluate(`Boolean(${actor})`), 'reenabled');
expect(evaluate(`global.window_group.get_children().filter(a => a.name === 'gclock-desktop-clock').length`) === 1,
    'reenabling produces exactly one actor');
// Leave enough time for at least two real repaint ticks, then check Shell state.
GLib.usleep(2_500_000);
expect(info().state.deep_unpack() === 1, 'timer-driven Cairo repaints keep extension healthy');
print('All isolated GNOME Shell integration checks passed.');
