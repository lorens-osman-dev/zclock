import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PNG} from 'pngjs';
import {readImage, pixel, pixels, equalPixels, alphaSum, inkHeight, compositeBlack} from './image.js';

const image = () => {
    const result = new PNG({width: 2, height: 2});
    result.data.set([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 64]);
    return result;
};

test('PNG decoding and region sampling preserve RGBA channels and crop boundaries', () => {
    const directory = mkdtempSync(join(tmpdir(), 'zclock-png-'));
    try {
        const path = join(directory, 'image.png');
        writeFileSync(path, PNG.sync.write(image()));
        const decoded = readImage(path);
        assert.deepEqual(pixel(decoded, 1, 0), [0, 255, 0, 128]);
        assert.deepEqual(pixels(decoded, [1, 0, 2, 2]), [[0, 255, 0, 128], [255, 255, 255, 64]]);
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});

test('pixel comparisons detect RGB changes even with identical alpha', () => {
    const a = image();
    const b = image();
    assert.ok(equalPixels(a, b));
    b.data[0] = 0;
    assert.ok(!equalPixels(a, b));
    assert.ok(equalPixels(a, b, [0, 0, 2, 2], [3]));
    assert.ok(equalPixels(a, b, [1, 0, 2, 2]));
    assert.ok(!equalPixels(a, new PNG({width: 1, height: 1})));
});

test('ink measurements include alpha and ignore invisible RGB', () => {
    assert.equal(alphaSum(image(), [0, 0, 2, 2]), 447);
    assert.equal(inkHeight(image(), [0, 0, 1, 2]), 1);
    assert.equal(inkHeight(image(), [0, 0, 2, 2]), 2);
    assert.equal(inkHeight(image(), [0, 1, 1, 2]), 0);
});

test('black compositing flattens transparency without changing the source pixels', () => {
    const source = image();
    const before = Buffer.from(source.data);
    const result = compositeBlack(source);
    assert.deepEqual(pixel(result, 0, 0), [255, 0, 0, 255]);
    assert.deepEqual(pixel(result, 1, 0), [0, 128, 0, 255]);
    assert.deepEqual(pixel(result, 0, 1), [0, 0, 0, 255]);
    assert.deepEqual(pixel(result, 1, 1), [64, 64, 64, 255]);
    assert.deepEqual(source.data, before);
});
