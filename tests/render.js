import GLib from 'gi://GLib';
import Cairo from 'cairo';
import {drawClock} from '../src/renderer.js';

const output = ARGV[0] ?? GLib.build_filenamev([GLib.get_tmp_dir(), 'gclock-preview.png']);
const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, 640, 860);
const cr = new Cairo.Context(surface);
drawClock(cr, 640, 860, new Date(2026, 9, 29, 11, 11, 43), {
    use24Hour: false, showSeconds: true, opacity: 1,
});
surface.writeToPNG(output);
cr.$dispose();
print(`Rendered actual Cairo clock: ${output}`);
