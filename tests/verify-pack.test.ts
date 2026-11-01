import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import AdmZip from 'adm-zip';
import {verifyPack} from '../scripts/verify-pack.js';

function bundle(): AdmZip {
    const zip = new AdmZip();
    for (const name of ['extension.js', 'prefs.js', 'utils/model.js', 'utils/renderer.js',
        'schemas/org.gnome.shell.extensions.zclock.gschema.xml', 'LICENSE'])
        zip.addFile(name, Buffer.from('fixture content'));
    zip.addFile('metadata.json', Buffer.from(JSON.stringify({uuid: 'zclock@lorens'})));
    return zip;
}

function withArchive(check: (path: string, zip: AdmZip) => void): void {
    const directory = mkdtempSync(join(tmpdir(), 'zclock-zip-'));
    try {
        check(join(directory, 'extension.zip'), bundle());
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
}

test('ZIP validation accepts an intact runtime-only extension bundle', () => {
    withArchive((path, zip) => {
        zip.writeZip(path);
        assert.doesNotThrow(() => verifyPack(path));
    });
});

test('ZIP validation rejects missing runtime modules and incorrect UUIDs', () => {
    withArchive((path, zip) => {
        zip.deleteFile('utils/renderer.js');
        zip.writeZip(path);
        assert.throws(() => verifyPack(path), /Missing bundle files/);
    });
    withArchive((path, zip) => {
        zip.updateFile('metadata.json', Buffer.from(JSON.stringify({uuid: 'wrong@local'})));
        zip.writeZip(path);
        assert.throws(() => verifyPack(path), /UUID/);
    });
});

test('ZIP validation rejects test code, TypeScript, source maps and npm dependencies', () => {
    for (const name of ['tests/driver.js', 'extension.ts', 'extension.js.map', 'node_modules/example/index.js']) {
        withArchive((path, zip) => {
            zip.addFile(name, Buffer.from('not for release'));
            zip.writeZip(path);
            assert.throws(() => verifyPack(path), /must not ship|runtime files/);
        });
    }
});

test('production ZIP rejects the development-only logger', () => {
    withArchive((path, zip) => {
        zip.addFile('utils/logger.js', Buffer.from('export const Logger = {};'));
        zip.writeZip(path);
        assert.throws(() => verifyPack(path), /logger must not ship/);
    });
});

test('development ZIP permits the logger but still rejects test-only code', () => {
    withArchive((path, zip) => {
        zip.addFile('utils/logger.js', Buffer.from('export const Logger = {};'));
        zip.writeZip(path);
        assert.doesNotThrow(() => verifyPack(path, 'development'));
        zip.addFile('tests/driver.js', Buffer.from('test code'));
        zip.writeZip(path);
        assert.throws(() => verifyPack(path, 'development'), /must not ship/);
    });
});

test('ZIP validation rejects an entry with corrupt data and an invalid CRC', () => {
    withArchive((path, zip) => {
        const entry = zip.addFile('extra.txt', Buffer.from('unique CRC fixture'));
        entry.header.method = 0;
        const data = zip.toBuffer();
        const offset = data.indexOf(Buffer.from('unique CRC fixture'));
        assert.ok(offset >= 0);
        data[offset] ^= 1;
        writeFileSync(path, data);
        assert.throws(() => verifyPack(path), /CRC|integrity/);
    });
});
