import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const mode = process.argv[3] ?? 'production';
const log = readFileSync(process.argv[2], 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
const events = [...log.matchAll(/\[zclock\]\s+(Enabled|Disabled)\b/g)].map(match => match[1]);
if (mode === 'development') {
    const enabled = events.filter(event => event === 'Enabled').length;
    const disabled = events.filter(event => event === 'Disabled').length;
    assert.ok(enabled >= 2, `Expected enable and re-enable logs, got ${enabled}`);
    assert.ok(disabled >= 1, `Expected a disable log, got ${disabled}`);
    console.log(`PASS: real development lifecycle uses Logger.info (${enabled} Enabled, ${disabled} Disabled)`);
} else {
    assert.equal(events.length, 0, 'Production must not emit development lifecycle logs');
    console.log('PASS: production lifecycle has no development logging');
}
