import GLib from 'gi://GLib';
import Cairo from 'cairo';
import {drawClock} from '../src/renderer.js';

// These are deterministic render fixtures, NOT screenshots of the live clock.
// The same renderer is used by Shell, so inspecting pixels tests real artwork.
const output = ARGV[0] ?? GLib.build_filenamev([GLib.get_tmp_dir(), 'gclock-preview.png']);
const directory = GLib.path_get_dirname(output);
function render(path, milliseconds = 0, background = false) {
    const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, 640, 860);
    const cr = new Cairo.Context(surface);
    if (background) {
        // A nonblack backdrop catches both accidental fills AND destructive
        // CLEAR operations that would erase whatever was already underneath.
        cr.setSourceRGB(0.2, 0.4, 0.6);
        cr.paint();
    }
    drawClock(cr, 640, 860, new Date(2026, 9, 29, 11, 11, 43, milliseconds), {
        use24Hour: false, showSeconds: true, opacity: 1,
    });
    surface.writeToPNG(path);
    cr.$dispose();
}
render(output);
render(GLib.build_filenamev([directory, 'gclock-background.png']), 0, true);
// Two times within the SAME second must produce different outer-ring pixels.
// This protects against reintroducing integer-second rounding in rendering.
render(GLib.build_filenamev([directory, 'gclock-fractional.png']), 250);
print(`Rendered actual Cairo clock and subsecond/background fixtures: ${output}`);
