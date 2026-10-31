import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import AdmZip from 'adm-zip';

export function verifyPack(path: string): void {
    const bundle = new AdmZip(path);
    const names = new Set(bundle.getEntries().map(entry => entry.entryName));
    const required = ['extension.js', 'prefs.js', 'metadata.json', 'src/model.js',
        'src/renderer.js', 'schemas/org.gnome.shell.extensions.zclock.gschema.xml',
        'LICENSE', 'README.md'];
    const missing = required.filter(name => !names.has(name));
    assert.equal(missing.length, 0, `Missing bundle files: ${missing.join(', ')}`);
    assert.ok(![...names].some(name => name.includes('test')), 'Test-only code must not ship');
    assert.ok(![...names].some(name => /\.(ts|map)$/.test(name) || name.includes('node_modules')),
        'Only runtime files may ship');
    const metadata: {uuid?: unknown} = JSON.parse(bundle.readAsText('metadata.json'));
    assert.equal(metadata.uuid, 'zclock@lorens', 'Incorrect extension UUID');
    assert.ok(bundle.test(), 'ZIP integrity check failed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const archive = resolve(process.argv[2] ?? 'distZip/zclock@lorens.shell-extension.zip');
    verifyPack(archive);
    console.log(`Verified installable bundle: ${archive} (${statSync(archive).size} bytes)`);
}
