// Only copied into the private test session, never included in the bundle.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
export default class TestDriver extends Extension {
    enable() {
        this._previous = global.context.unsafe_mode;
        global.context.unsafe_mode = true;
    }
    disable() {
        global.context.unsafe_mode = this._previous;
    }
}
