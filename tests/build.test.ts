import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const modules = ['extension', 'prefs', 'src/model', 'src/renderer', 'src/logger'];

function comments(source: string): string[] {
    const scanner = ts.createScanner(ts.ScriptTarget.ES2023, false, ts.LanguageVariant.Standard, source);
    const result: string[] = [];
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
            result.push(scanner.getTokenText());
    }
    return result;
}

test('build emits GJS modules with configured comments without shipping TypeScript', () => {
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
    assert.equal(config.error, undefined);
    const {options} = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
    const build = spawnSync('npm', ['run', 'build'], {encoding: 'utf8'});
    assert.equal(build.status, 0, build.stdout + build.stderr);
    for (const name of modules) {
        assert.ok(!existsSync(`${name}.js`), `Only TypeScript should be maintained: ${name}`);
        const source = readFileSync(`${name}.ts`, 'utf8');
        const emitted = readFileSync(`dist/${name}.js`, 'utf8');
        assert.deepEqual(comments(emitted), options.removeComments ? [] : comments(source), `Configured comments: ${name}`);
        assert.ok(!emitted.includes('from \'@girs/'), 'Typings must not become runtime dependencies');
    }
    assert.equal(readFileSync('dist/metadata.json', 'utf8'), readFileSync('metadata.json', 'utf8'));
    assert.ok(existsSync('dist/schemas/org.gnome.shell.extensions.zclock.gschema.xml'));
    assert.ok(!existsSync('dist/tests'), 'Test-only code must stay outside the extension build');
});
