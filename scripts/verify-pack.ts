import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import AdmZip from 'adm-zip';

export function verifyPack(path: string, mode: 'production' | 'development' = 'production'): void {
    const bundle = new AdmZip(path);
    const names = new Set(bundle.getEntries().map(entry => entry.entryName));
    if (mode !== 'development')
        assert.ok(!names.has('src/logger.js'), 'Development logger must not ship in a production ZIP');
    const required = ['extension.js', 'prefs.js', 'metadata.json', 'src/model.js',
        'src/renderer.js', 'schemas/org.gnome.shell.extensions.zclock.gschema.xml',
        'LICENSE'];
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
    const {values, positionals} = parseArgs({
        allowPositionals: true,
        options: {mode: {type: 'string', default: 'production'}},
    });
    assert.ok(values.mode === 'production' || values.mode === 'development', 'Expected production or development mode');
    const archive = resolve(positionals[0] ?? 'distZip/zclock@lorens.shell-extension.zip');
    verifyPack(archive, values.mode);
    console.log(`Verified ${values.mode} installable bundle: ${archive} (${statSync(archive).size} bytes)`);
}
