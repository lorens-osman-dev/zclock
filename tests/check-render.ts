// Inspect actual GJS/Cairo pixels, including transparency and smooth motion.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {PNG} from 'pngjs';
import {readImage, pixel, pixels, equalPixels, compositeBlack} from './image.js';

const source = process.argv[2] ?? join(tmpdir(), 'zclock-preview.png');
const image = readImage(source);
assert.deepEqual([image.width, image.height], [640, 860]);
assert.equal(pixel(image, 600, 100)[3], 0, 'Wallpaper must stay transparent');
assert.equal(pixel(image, 200, 400)[3], 0, 'Minute capsule must have NO fill');
assert.ok(pixels(image, [30, 430, 130, 431]).some(value => value[3] > 240), 'Hour text is present');
// Interior points away from the digits should all remain completely empty.
// The dials are masked out here for readability, not painted over with a color.
assert.ok(pixels(image, [220, 450, 221, 465]).every(value => value[3] === 0), 'Dial bleeds through capsule');
// Drawing text directly can inherit desktop subpixel AA and cause green fringes
// on transparent surfaces. Neutral white strokes must stay neutral.
assert.ok(pixels(image, [20, 375, 140, 480]).filter(value => value[3] > 50)
    .every(([r, g, b]) => Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1), 'Colored text fringes');
const background = readImage(join(dirname(source), 'zclock-background.png'));
assert.deepEqual(pixel(background, 200, 400), [51, 102, 153, 255], 'Renderer altered the backdrop behind minutes');
const fractional = readImage(join(dirname(source), 'zclock-fractional.png'));
// Ignore the minute capsule and hour; only compare the outer arc above them.
assert.ok(!equalPixels(image, fractional, [0, 70, 365, 370]), 'Dial did not move within one second');
// Produce a viewable illustration, but keep the actual test image transparent.
writeFileSync(join(dirname(source), 'zclock-preview-black.png'), PNG.sync.write(compositeBlack(image), {colorType: 2}));
console.log('Cairo pixel checks passed: transparent minutes, preserved backdrop, subsecond motion and neutral text');
