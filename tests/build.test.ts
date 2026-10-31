import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const modules = ['extension', 'prefs', 'src/model', 'src/renderer'];

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

test('Vite production build emits readable GJS modules without comments or the unused logger', () => {
    const {scripts} = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.equal(scripts.build, 'vite build');
    build('build');
    for (const name of modules) {
        assert.ok(!existsSync(`${name}.js`), `Only TypeScript should be maintained: ${name}`);
        const source = readFileSync(`${name}.ts`, 'utf8');
        const emitted = readFileSync(`dist/${name}.js`, 'utf8');
        assert.deepEqual(comments(emitted), [], `Production comments must be removed: ${name}`);
        assert.deepEqual(externalImports(emitted), externalImports(source), `GJS import paths must be preserved: ${name}`);
        assert.doesNotMatch(emitted, /@girs\/|__vitePreload|document\.createElement|from ["']node:/,
            'Browser helpers, Node modules and type packages must not enter GJS bundles');
    }
    assert.match(readFileSync('dist/extension.js', 'utf8'), /ZclockExtension/);
    assert.match(readFileSync('dist/prefs.js', 'utf8'), /ZclockPreferences/);
    assert.equal(readFileSync('dist/metadata.json', 'utf8'), readFileSync('metadata.json', 'utf8'));
    assert.ok(existsSync('dist/LICENSE'));
    // assert.ok(existsSync('dist/README.md'));
    assert.doesNotMatch(readFileSync('dist/schemas/org.gnome.shell.extensions.zclock.gschema.xml', 'utf8'), /<!--/);
    assert.ok(!existsSync('dist/tests'), 'Test-only code must stay outside the extension build');
    assert.ok(!existsSync('dist/src/logger.js'), 'The unused logger must not ship');
});

test('Vite development mode includes the logger and a subsequent production build removes it', () => {
    try {
        build('build:dev');
        const logger = readFileSync('dist/src/logger.js', 'utf8');
        assert.match(logger, /Logger/);
        assert.match(logger, /zclock/);
        assert.match(readFileSync('dist/schemas/org.gnome.shell.extensions.zclock.gschema.xml', 'utf8'), /<!--/);
    } finally {
        build('build');
    }
    assert.ok(!existsSync('dist/src/logger.js'), 'Production rebuild must clean stale development modules');
});
