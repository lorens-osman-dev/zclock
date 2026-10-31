import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function call(iface: string, method: string, parameters: GLib.Variant | null = null): unknown[] {
    return Gio.DBus.session.call_sync('org.gnome.Shell', '/org/gnome/Shell',
        iface, method, parameters, null, Gio.DBusCallFlags.NONE, 5000, null).deep_unpack() as unknown[];
}
function evaluate<T = boolean>(code: string): T {
    const [ok, result] = call('org.gnome.Shell', 'Eval', new GLib.Variant('(s)', [code])) as [boolean, string];
    if (!ok)
        throw new Error(`Shell evaluation failed: ${result}`);
    // Eval is a private-session JSON boundary; callers describe the requested value.
    return JSON.parse(result) as T;
}
function expect(condition: unknown, message: string): void {
    if (!condition)
        throw new Error(message);
    print(`PASS: ${message}`);
}
function waitFor(fn: () => unknown, description: string): void {
    let last: unknown;
    for (let i = 0; i < 80; i++) {
        try { if (fn()) return; } catch (error) { last = error; }
        GLib.usleep(250_000);
    }
    throw new Error(`Timed out: ${description}: ${last ?? ''}`);
}
const uuid = new GLib.Variant('(s)', ['zclock@lorens']);
const info = () => call('org.gnome.Shell.Extensions', 'GetExtensionInfo', uuid)[0] as Record<string, GLib.Variant>;
const actor = `Main.layoutManager._backgroundGroup.get_children().find(a => a.name === 'zclock-desktop-clock')`;
waitFor(() => info().state.deep_unpack() === 1, 'extension enabled');
waitFor(() => evaluate('true'), 'private test driver');
// Close the startup overview to exercise the actual desktop widget.
evaluate('Main.overview.hide(); true');
waitFor(() => evaluate(`Boolean(${actor}?.visible)`), 'clock visible');
expect(info().state.deep_unpack() === 1, 'GNOME Shell 50 loaded zclock without errors');
const initial = evaluate<{x: number; y: number; width: number; height: number; reactive: boolean; inBackground: boolean}>(`(() => { const a=${actor}; return {x:a.x,y:a.y,width:a.width,height:a.height,reactive:a.reactive,inBackground:a.get_parent()===Main.layoutManager._backgroundGroup}; })()`);
expect(initial.height === 500, 'configured clock size is applied');
expect(initial.reactive === false, 'clock is click-through');
expect(initial.inBackground, 'clock is in the desktop background layer');

// Count REAL drawing callbacks, rather than just checking that a timer exists.
// At frame cadence there should be many paints inside a fraction of a second;
// the previous one-second scheduler cannot pass this assertion.
evaluate(`globalThis.zclockPaints = 0; globalThis.zclockPaintId = ${actor}.connect('repaint', () => globalThis.zclockPaints++); true`);
GLib.usleep(650_000);
const paints = evaluate<number>('globalThis.zclockPaints');
expect(paints >= 8, `continuous frame-driven repainting (${paints} paints in 650 ms)`);
evaluate(`${actor}.disconnect(globalThis.zclockPaintId); true`);
const screenshot = GLib.getenv('GCLOCK_TEST_ROOT') + '/desktop.png';
const [captured] = Gio.DBus.session.call_sync('org.gnome.Shell', '/org/gnome/Shell/Screenshot',
    'org.gnome.Shell.Screenshot', 'Screenshot',
    new GLib.Variant('(bbs)', [false, false, screenshot]), null,
    Gio.DBusCallFlags.NONE, 10000, null).deep_unpack() as [boolean, string];
expect(captured && GLib.file_test(screenshot, GLib.FileTest.EXISTS), 'actual compositor screenshot captured');

const schemaDir = GLib.getenv('XDG_DATA_HOME') + '/gnome-shell/extensions/zclock@lorens/schemas';
const source = Gio.SettingsSchemaSource.new_from_directory(schemaDir, Gio.SettingsSchemaSource.get_default(), false);
const settings = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.zclock', false)!});
settings.set_int('height', 500);
settings.set_int('position-x', 100);
settings.set_int('position-y', 100);
settings.set_boolean('use-24-hour', true);
settings.set_boolean('show-seconds', false);
settings.set_int('opacity', 65);
Gio.Settings.sync();
waitFor(() => evaluate<number>(`${actor}.height`) === 500, 'live size update');
const changed = evaluate<{x: number; y: number; height: number}>(`(() => { const a=${actor}; return {x:a.x,y:a.y,height:a.height}; })()`);
expect(changed.x > initial.x && changed.y > initial.y, 'live placement settings move the actual actor');
evaluate('Main.overview.show(); true');
waitFor(() => evaluate(`${actor}.visible`) === false, 'overview visibility');
expect(true, 'clock hides in overview');
// Visibility is not enough: the frame driver must stop too, otherwise a
// hidden clock would still spend CPU scheduling redraws every display frame.
expect(evaluate(`Main.extensionManager.lookup('zclock@lorens').stateObj._clocks[0].timeline.is_playing()`) === false,
    'animation stops while hidden in overview');
evaluate('Main.overview.hide(); true');
waitFor(() => evaluate(`${actor}.visible`) === true, 'restore desktop');
expect(true, 'clock returns after overview');

// Keep a reference only in the test so we can prove disable stops the native
// timeline itself, rather than merely removing the actor from the scene.
evaluate(`globalThis.zclockOldTimeline = Main.extensionManager.lookup('zclock@lorens').stateObj._clocks[0].timeline; true`);
call('org.gnome.Shell.Extensions', 'DisableExtension', uuid);
waitFor(() => info().state.deep_unpack() === 2, 'disabled');
expect(evaluate(`Boolean(${actor})`) === false, 'disable removes the desktop actor');
expect(evaluate('globalThis.zclockOldTimeline.is_playing()') === false,
    'disable stops the old animation timeline');
expect(evaluate('globalThis.zclockOldTimeline.get_actor() === null'),
    'disable releases the timeline actor reference');
evaluate('delete globalThis.zclockOldTimeline; true');
call('org.gnome.Shell.Extensions', 'EnableExtension', uuid);
waitFor(() => info().state.deep_unpack() === 1 && evaluate(`Boolean(${actor})`), 'reenabled');
expect(evaluate<number>(`Main.layoutManager._backgroundGroup.get_children().filter(a => a.name === 'zclock-desktop-clock').length`) === 1,
    'reenabling produces exactly one actor');
// Let the replacement timeline run across multiple cycles, then check Shell state.
GLib.usleep(2_500_000);
expect(info().state.deep_unpack() === 1, 'frame-driven Cairo repaints keep extension healthy');
print('All isolated GNOME Shell integration checks passed.');
