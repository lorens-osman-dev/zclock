import Cairo from 'cairo';
import { drawClock } from '../src/renderer.js';
for (const [name, options] of Object.entries({
    normal: {},
    color: { fontColor: '#ff0000' },
    bold: { fontBold: true },
    small: { fontSize: 60 },
    invalid: { fontColor: 'not-a-color' },
    flipped: { fontColor: '#ff0000', fontBold: true, fontSize: 60, flip: true },
    stroke: { strokeColor: '#00ff00' },
    'invalid-stroke': { strokeColor: 'not-a-color' },
    'white-stroke': { strokeColor: '#ffffff' },
    'flipped-stroke': { strokeColor: '#00ff00', flip: true },
    combined: { fontColor: '#ff0000', strokeColor: '#00ff00' },
})) {
    const surface = new Cairo.ImageSurface(Cairo.Format.ARGB32, 640, 860);
    const cr = new Cairo.Context(surface);
    drawClock(cr, 640, 860, new Date(2026, 9, 29, 11, 11, 43), options);
    surface.writeToPNG(`${ARGV[0]}/${name}.png`);
    cr.$dispose();
}
