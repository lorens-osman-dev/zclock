import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
export default class TestDriver extends Extension {
    _previous = false;
    enable() {
        this._previous = global.context.unsafe_mode;
        global.context.unsafe_mode = true;
    }
    disable() {
        global.context.unsafe_mode = this._previous;
    }
}
