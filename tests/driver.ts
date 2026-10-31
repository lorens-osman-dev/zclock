// Only copied into the private test session, never included in the bundle.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import type Shell from 'gi://Shell';

// This companion runs in Shell; Node's test types also declare a different global.
declare const global: Shell.Global;

export default class TestDriver extends Extension {
    private _previous = false;

    override enable(): void {
        this._previous = global.context.unsafe_mode;
        global.context.unsafe_mode = true;
    }
    override disable(): void {
        global.context.unsafe_mode = this._previous;
    }
}
