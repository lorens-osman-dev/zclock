import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('About page logo is included unchanged in the extension build', () => {
    assert.deepEqual(readFileSync('dissts/dist/assets/Z-CLOCK-LOGO.png'),
        readFileSync('assets/Z-CLOCK-LOGO.png'));
});
