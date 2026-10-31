import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('native renderer applies font color, bold and size to texts(numbers\'s strings)', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zclock-font-'));
    try {
        const render = spawnSync('gjs', ['-m', 'dist-tests/tests/font-render.js', directory], {encoding: 'utf8'});
        assert.equal(render.status, 0, render.stderr);
        const check = spawnSync('python3', ['-c', `
import sys
from PIL import Image, ImageChops
from pathlib import Path
root = Path(sys.argv[1])
images = {p.stem: Image.open(p).convert('RGBA') for p in root.glob('*.png')}
# The hour crop contains only text, not the dial or capsule border.
hour = lambda name: images[name].crop((0, 355, 170, 505))
normal = hour('normal')
colored = hour('color')
pixels = [p for p in colored.getdata() if p[3] > 128]
assert pixels and all(r > 250 and g == 0 and b == 0 for r, g, b, a in pixels), 'Font color must tint the hour glyphs'
# Font color applies to the dial's number strings too.
assert any(r > 250 and g == 0 and b == 0 and a > 20 for r, g, b, a in images['color'].crop((0, 0, 640, 350)).getdata()), 'Dial labels must use the font color'

ink = lambda image: sum(image.getchannel('A').getdata())
assert ink(hour('bold')) > ink(normal) * 1.1, 'Bold must increase glyph ink'
assert hour('small').getbbox()[3] - hour('small').getbbox()[1] < (normal.getbbox()[3] - normal.getbbox()[1]) * .75, 'Font size must scale text independently'
assert ImageChops.difference(images['invalid'], images['normal']).convert('RGB').getbbox() is None, 'Invalid colors must fall back to white'
assert any(r > 250 and g == 0 and b == 0 and a > 128 for r, g, b, a in images['flipped'].crop((470, 355, 640, 505)).getdata()), 'Font options must work when mirrored'
`, directory], {encoding: 'utf8'});
        assert.equal(check.status, 0, check.stderr);
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});

test('native renderer applies stroke color to dial ticks and capsule outline independently of text', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zclock-stroke-'));
    try {
        const render = spawnSync('gjs', ['-m', 'dist-tests/tests/font-render.js', directory], {encoding: 'utf8'});
        assert.equal(render.status, 0, render.stderr);
        const check = spawnSync('python3', ['-c', `
import sys
from PIL import Image, ImageChops
from pathlib import Path
root = Path(sys.argv[1])
images = {p.stem: Image.open(p).convert('RGBA') for p in root.glob('*.png')}
normal, stroke = images['normal'], images['stroke']
# Sample both dial rings away from their labels, and the capsule's lower border.
for name, box in [('seconds', (320, 300, 355, 380)), ('minutes', (245, 300, 275, 360)), ('capsule', (280, 474, 300, 476))]:
    pixels = [p for p in stroke.crop(box).getdata() if p[3] > 10]
    assert pixels and all(r == 0 and g > 250 and b == 0 for r, g, b, a in pixels), f'{name} strokes must use the stroke color'
assert ImageChops.difference(normal.getchannel('A'), stroke.getchannel('A')).getbbox() is None, 'Stroke color must preserve geometry and opacity'
assert ImageChops.difference(normal.crop((0, 355, 170, 505)), stroke.crop((0, 355, 170, 505))).convert('RGB').getbbox() is None, 'Stroke color must not tint the hour text'
assert ImageChops.difference(images['invalid-stroke'], normal).convert('RGB').getbbox() is None, 'Invalid stroke colors must fall back to white'
assert ImageChops.difference(images['white-stroke'], normal).convert('RGB').getbbox() is None, 'White strokes must remain the default'
flipped = images['flipped-stroke'].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
assert any(r == 0 and g > 250 and b == 0 and a > 10 for r, g, b, a in flipped.crop((320, 300, 355, 380)).getdata()), 'Stroke color must work when mirrored'
assert any(r > 250 and g == 0 and b == 0 and a > 128 for r, g, b, a in images['combined'].crop((0, 355, 170, 505)).getdata()), 'Font color must remain independent of stroke color'
`, directory], {encoding: 'utf8'});
        assert.equal(check.status, 0, check.stderr);
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});
