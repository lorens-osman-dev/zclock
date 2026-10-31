import test from 'node:test';
import assert from 'node:assert/strict';
import {clockState, dialAngle, widgetBounds} from '../src/model.js';

test('clock reads local time and maps midnight to twelve', () => {
    const state = clockState(new Date(2026, 0, 1, 0, 7, 30), false);
    assert.equal(state.hour, '12');
    assert.equal(state.minute, '07');
    assert.equal(state.minuteValue, 7.5);
    assert.equal(state.secondValue, 30);
});

// Subsecond input must reach BOTH dials. More redraws alone cannot make
// movement smooth if the model keeps rounding the time to whole seconds.
test('dial positions include milliseconds without changing digital minute text', () => {
    const state = clockState(new Date(2026, 0, 1, 11, 7, 30, 250));
    assert.equal(state.secondValue, 30.25);
    assert.equal(state.minuteValue, 7 + 30.25 / 60);
    assert.equal(state.minute, '07');
});

// The angle may wrap by one whole revolution at :00, but its position on
// screen must move a tiny distance forward, never jump or rotate backwards.
test('seconds sweep continuously through the minute rollover', () => {
    const before = clockState(new Date(2026, 0, 1, 11, 59, 59, 999));
    const after = clockState(new Date(2026, 0, 1, 12, 0, 0, 0));
    const a = dialAngle(0, before.secondValue);
    const b = dialAngle(0, after.secondValue);
    assert.ok(before.secondValue > 59.99);
    assert.ok(Math.hypot(Math.cos(b) - Math.cos(a), Math.sin(b) - Math.sin(a)) < 0.001);
    assert.equal(after.hour, '12');
    assert.equal(after.minute, '00');
});

test('24-hour time, noon and last second are correct', () => {
    assert.equal(clockState(new Date(2026, 0, 1, 0), true).hour, '00');
    assert.equal(clockState(new Date(2026, 0, 1, 12)).hour, '12');
    assert.equal(clockState(new Date(2026, 0, 1, 23, 59, 59), true).hour, '23');
    assert.equal(clockState(new Date(2026, 0, 1, 23, 59, 59)).hour, '11');
});

test('current dial value points right; larger values are above', () => {
    assert.equal(dialAngle(11, 11), 0);
    assert.ok(dialAngle(15, 11) < 0);
    assert.ok(Math.abs(Math.sin(dialAngle(0, 59)) + Math.sin(Math.PI / 30)) < 1e-10);
});

test('placement respects monitor origins and keeps the widget in the work area', () => {
    const area = {x: -1920, y: 32, width: 1920, height: 1048};
    const left = widgetBounds(area, 740, 0, 50);
    assert.equal(left.x, -1920);
    assert.equal(left.y, 186);
    assert.equal(left.height, 740);
    const right = widgetBounds(area, 2000, 100, 100);
    assert.equal(right.height, 1048);
    assert.ok(right.x + right.width <= area.x + area.width);
    assert.equal(right.y + right.height, 1080);
});
