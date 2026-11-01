import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const modules = ['extension', 'prefs', 'utils/model', 'utils/renderer'];

function comments(source: string): string[] {
    const scanner = ts.createScanner(ts.ScriptTarget.ES2023, false, ts.LanguageVariant.Standard, source);
    const result: string[] = [];
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
            result.push(scanner.getTokenText());
    }
    return result;
}

function externalImports(source: string): string[] {
    const file = ts.createSourceFile('module.ts', source, ts.ScriptTarget.ES2023, true);
    return file.statements.filter(ts.isImportDeclaration)
        .filter(node => !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier))
        .map(node => (node.moduleSpecifier as ts.StringLiteral).text)
        .filter(name => /^(gi:\/\/|resource:\/\/\/|cairo$)/.test(name)).sort();
}

function build(script: string): void {
    const result = spawnSync('npm', ['run', script], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stdout + result.stderr);
}

test('extension source tree is contained in src with schemas and utilities', () => {
    assert.deepEqual(readdirSync('src').sort(), ['LICENSE', 'extension.ts', 'metadata.json', 'prefs.ts', 'schemas', 'utils'].sort());
    assert.deepEqual(readdirSync('src/utils').sort(), ['model.ts', 'logger.ts', 'renderer.ts'].sort());
    assert.deepEqual(readdirSync('src/schemas'), ['org.gnome.shell.extensions.zclock.gschema.xml']);
    for (const old of ['extension.ts', 'prefs.ts', 'metadata.json', 'LICENSE', 'schemas'])
        assert.ok(!existsSync(old), `Remove the old source location: ${old}`);
});

test('Vite production build emits readable GJS modules without comments or the unused logger', () => {
    const {scripts} = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.equal(scripts.build, 'vite build');
    build('build');
    assert.ok(existsSync('dissts/dist/extension.js'), 'Production output must live under dissts/');
    for (const name of modules) {
        assert.ok(!existsSync(`src/${name}.js`), `Only TypeScript should be maintained: ${name}`);
        const source = readFileSync(`src/${name}.ts`, 'utf8');
        const emitted = readFileSync(`dissts/dist/${name}.js`, 'utf8');
        assert.deepEqual(comments(emitted), [], `Production comments must be removed: ${name}`);
        assert.deepEqual(externalImports(emitted), externalImports(source), `GJS import paths must be preserved: ${name}`);
        assert.doesNotMatch(emitted, /@girs\/|__vitePreload|document\.createElement|from ["']node:/,
            'Browser helpers, Node modules and type packages must not enter GJS bundles');
        assert.doesNotMatch(emitted, /Logger|logger\.js|import\.meta\.env/, 'Production must contain no logger imports or calls');
    }
    assert.match(readFileSync('dissts/dist/extension.js', 'utf8'), /ZclockExtension/);
    assert.match(readFileSync('dissts/dist/prefs.js', 'utf8'), /ZclockPreferences/);
    assert.equal(readFileSync('dissts/dist/metadata.json', 'utf8'), readFileSync('src/metadata.json', 'utf8'));
    assert.ok(existsSync('dissts/dist/LICENSE'));
    // assert.ok(existsSync('dissts/dist/README.md'));
    assert.doesNotMatch(readFileSync('dissts/dist/schemas/org.gnome.shell.extensions.zclock.gschema.xml', 'utf8'), /<!--/);
    assert.ok(!existsSync('dissts/dist/tests'), 'Test-only code must stay outside the extension build');
    assert.ok(!existsSync('dissts/dist/utils/logger.js'), 'The unused logger must not ship');
});

test('Vite development logs lifecycle events without changing production output or the reviewer ZIP', () => {
    const packed = spawnSync('npm', ['run', 'pack'], {encoding: 'utf8'});
    assert.equal(packed.status, 0, packed.stdout + packed.stderr);
    const production = readFileSync('dissts/dist/extension.js');
    const archive = readFileSync('dissts/dist-zip/zclock@lorens.shell-extension.zip');
    build('build:dev');
    const logger = readFileSync('dissts/dist-dev/utils/logger.js', 'utf8');
    const extension = readFileSync('dissts/dist-dev/extension.js', 'utf8');
    assert.match(logger, /Logger/);
    assert.match(logger, /zclock/);
    assert.match(extension, /Logger\.info\(["']Enabled["']\)/);
    assert.match(extension, /Logger\.info\(["']Disabled["']\)/);
    assert.doesNotMatch(extension, /import\.meta\.env/, 'Vite must replace the development guard at build time');
    assert.match(readFileSync('dissts/dist-dev/schemas/org.gnome.shell.extensions.zclock.gschema.xml', 'utf8'), /<!--/);
    assert.deepEqual(readFileSync('dissts/dist/extension.js'), production, 'Development must not overwrite dissts/dist/');
    assert.deepEqual(readFileSync('dissts/dist-zip/zclock@lorens.shell-extension.zip'), archive, 'Development must not overwrite the reviewer ZIP');
    assert.ok(!existsSync('dissts/dist/utils/logger.js'));
    const {scripts} = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.equal(scripts.dev, 'npm run uninstall && npm run build:dev && bash scripts/dev.sh');
    const rejected = spawnSync('npm', ['run', 'pack', '--', '--mode', 'development'], {encoding: 'utf8'});
    assert.notEqual(rejected.status, 0, 'Reviewer packaging must not accept development mode');
    assert.deepEqual(readFileSync('dissts/dist-zip/zclock@lorens.shell-extension.zip'), archive);
});

test('plain TypeScript checking cannot emit a logger into production output', () => {
    const production = readFileSync('dissts/dist/extension.js');
    const checked = spawnSync('npx', ['--no-install', 'tsc', '-p', 'tsconfig.json'], {encoding: 'utf8'});
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
    assert.deepEqual(readFileSync('dissts/dist/extension.js'), production);
    assert.ok(!existsSync('dissts/dist/utils/logger.js'), 'Only Vite may write the production build');
});
