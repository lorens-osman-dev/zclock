import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readImage, pixels, equalPixels, alphaSum, inkHeight } from './image.js';
function renderImages(t) {
    const directory = mkdtempSync(join(tmpdir(), 'zclock-font-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const render = spawnSync('gjs', ['-m', 'dist-tests/tests/font-render.js', directory], { encoding: 'utf8' });
    assert.equal(render.status, 0, render.stderr);
    return Object.fromEntries(readdirSync(directory).filter(name => name.endsWith('.png'))
        .map(name => [name.slice(0, -4), readImage(join(directory, name))]));
}
test('native renderer applies font color, bold and size to texts(numbers\'s strings)', t => {
    const images = renderImages(t);
    const hour = [0, 355, 170, 505];
    const colored = pixels(images.color, hour).filter(value => value[3] > 128);
    assert.ok(colored.length > 0 && colored.every(([r, g, b]) => r > 250 && g === 0 && b === 0), 'Font color must tint the hour glyphs');
    assert.ok(pixels(images.color, [0, 0, 640, 350]).some(([r, g, b, a]) => r > 250 && g === 0 && b === 0 && a > 20), 'Dial labels must use the font color');
    assert.ok(alphaSum(images.bold, hour) > alphaSum(images.normal, hour) * 1.1, 'Bold must increase glyph ink');
    assert.ok(inkHeight(images.small, hour) < inkHeight(images.normal, hour) * 0.75, 'Font size must scale text independently');
    assert.ok(equalPixels(images.invalid, images.normal), 'Invalid colors must fall back to white');
    assert.ok(pixels(images.flipped, [470, 355, 640, 505]).some(([r, g, b, a]) => r > 250 && g === 0 && b === 0 && a > 128), 'Font options must work when mirrored');
});
test('native renderer applies stroke color to dial ticks and capsule outline independently of text', t => {
    const images = renderImages(t);
    const { normal, stroke } = images;
    const regions = [
        ['seconds', [320, 300, 355, 380]],
        ['minutes', [245, 300, 275, 360]],
        ['capsule', [280, 474, 300, 476]],
    ];
    for (const [name, box] of regions) {
        const visible = pixels(stroke, box).filter(value => value[3] > 10);
        assert.ok(visible.length > 0 && visible.every(([r, g, b]) => r === 0 && g > 250 && b === 0), `${name} strokes must use the stroke color`);
    }
    assert.ok(equalPixels(normal, stroke, [0, 0, 640, 860], [3]), 'Stroke color must preserve geometry and opacity');
    assert.ok(equalPixels(normal, stroke, [0, 355, 170, 505]), 'Stroke color must not tint the hour text');
    assert.ok(equalPixels(images['invalid-stroke'], normal), 'Invalid stroke colors must fall back to white');
    assert.ok(equalPixels(images['white-stroke'], normal), 'White strokes must remain the default');
    assert.ok(pixels(images['flipped-stroke'], [640 - 355, 300, 640 - 320, 380])
        .some(([r, g, b, a]) => r === 0 && g > 250 && b === 0 && a > 10), 'Stroke color must work when mirrored');
    assert.ok(pixels(images.combined, [0, 355, 170, 505]).some(([r, g, b, a]) => r > 250 && g === 0 && b === 0 && a > 128), 'Font color must remain independent of stroke color');
});
