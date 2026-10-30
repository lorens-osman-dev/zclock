import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('native renderer applies font color, bold and size without changing dial strokes', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zclock-font-'));
    try {
        const render = spawnSync('gjs', ['-m', 'tests/font-render.js', directory], {encoding: 'utf8'});
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
# Color applies to dial labels too, but not to the white dial strokes.
assert any(r > 250 and g == 0 and b == 0 and a > 20 for r, g, b, a in images['color'].crop((0, 0, 640, 350)).getdata()), 'Dial labels must use the font color'
assert any(r == g == b == 255 and a > 40 for r, g, b, a in images['color'].getdata()), 'Dial strokes must stay white'
ink = lambda image: sum(image.getchannel('A').getdata())
assert ink(hour('bold')) > ink(normal) * 1.1, 'Bold must increase glyph ink'
assert hour('small').getbbox()[3] - hour('small').getbbox()[1] < (normal.getbbox()[3] - normal.getbbox()[1]) * .75, 'Font size must scale text independently'
assert ImageChops.difference(images['invalid'], images['normal']).getbbox() is None, 'Invalid colors must fall back to white'
assert any(r > 250 and g == 0 and b == 0 and a > 128 for r, g, b, a in images['flipped'].crop((470, 355, 640, 505)).getdata()), 'Font options must work when mirrored'
`, directory], {encoding: 'utf8'});
        assert.equal(check.status, 0, check.stderr);
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});
