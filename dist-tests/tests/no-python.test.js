import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
test('development tooling has no Python scripts or embedded Python commands', () => {
    for (const directory of ['tests', 'scripts']) {
        for (const file of readdirSync(directory)) {
            if (file === 'no-python.test.ts')
                continue;
            assert.ok(!file.endsWith('.py'), `Convert the remaining script: ${join(directory, file)}`);
            if (!/\.(ts|js|mjs|sh)$/.test(file))
                continue;
            const source = readFileSync(join(directory, file), 'utf8');
            assert.doesNotMatch(source, /\bpython(?:3)?\b|\bPIL\b/, `Remove embedded Python: ${join(directory, file)}`);
        }
    }
});
