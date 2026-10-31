import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
    const development = mode === 'development';
    const root = import.meta.dirname;

    return {
        envDir: false,
        publicDir: false,
        define: {
            'import.meta.env.DEV': JSON.stringify(development),
            'import.meta.env.PROD': JSON.stringify(!development),
        },
        plugins: [{
            name: 'gnome-extension-assets',
            generateBundle() {
                const files = ['metadata.json', 'LICENSE',
                    ...readdirSync(resolve(root, 'schemas'))
                        .filter(name => name.endsWith('.gschema.xml')).map(name => `schemas/${name}`)];
                for (const fileName of files) {
                    let source = readFileSync(resolve(root, fileName), 'utf8');
                    if (!development && fileName.endsWith('.xml'))
                        source = source.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\t ]+$/gm, '');
                    this.emitFile({type: 'asset', fileName, source});
                }
            },
        }],
        build: {
            target: 'es2023',
            modulePreload: false,
            outDir: development ? 'dissts/dist-dev' : 'dissts/dist',
            emptyOutDir: true,
            minify: development ? false : 'terser',
            terserOptions: {
                compress: false,
                mangle: false,
                format: {comments: false, beautify: true},
            },
            sourcemap: false,
            rolldownOptions: {
                input: {
                    extension: resolve(root, 'extension.ts'),
                    prefs: resolve(root, 'prefs.ts'),
                },
                preserveEntrySignatures: 'strict',
                external: id => id.startsWith('gi://') || id.startsWith('resource:///') || id === 'cairo',
                output: {
                    format: 'es',
                    preserveModules: true,
                    preserveModulesRoot: root,
                    entryFileNames: '[name].js',
                    comments: development,
                },
            },
        },
    };
});
