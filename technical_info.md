# Technical information

## Compatibility and architecture

Only GNOME Shell 50 is currently declared supported and integration-tested.
Shell's private background-group API is deliberately confined to `src/extension.ts`.
No drag gestures are installed: the widget never intercepts desktop input.

- `src/extension.ts` — Shell actor, placement, visibility and lifecycle.
- `src/utils/model.ts` — pure local-time and monitor geometry.
- `src/utils/logger.ts` — development-only lifecycle logging.
- `src/utils/renderer.ts` — shared Cairo/Pango drawing.
- `src/prefs.ts` — libadwaita settings window.
- `src/schemas/` — settings schema.
- `tests/` and `scripts/` — tests, packaging and installation.

The extension's source and distributable assets live together:

```text
src/
├── schemas/
│   └── org.gnome.shell.extensions.zclock.gschema.xml
├── utils/
│   ├── model.ts
│   ├── logger.ts
│   └── renderer.ts
├── extension.ts
├── LICENSE
├── metadata.json
└── prefs.ts
```

## Animation and transparency

The source includes explanatory comments about the mathematics, drawing steps,
settings bindings, and resource ownership. Start with `src/utils/model.ts`, then
`src/utils/renderer.ts`, and finally `src/extension.ts` to follow data from time to pixels.

1. **Fractional local time:** `clockState()` adds milliseconds to seconds and
   carries that fraction into minutes. Digital labels still change only at the
   appropriate real clock boundaries.
2. **Frame scheduling:** a Clutter timeline requests repaints from the actor's
   compositor frame clock. GTK uses its own tick callback for the preferences
   preview. Neither driver invents time or counts frames to advance the dial;
   each draw samples `Date`, preventing accumulated timer drift.
3. **Visibility and cleanup:** the desktop timeline stops whenever the clock is
   hidden or unmapped, and disable stops it, disconnects signals and releases its
   actor reference before destroying the actor.
4. **No minute fill:** an even-odd clip excludes the capsule interior while the
   dials are drawn. The clip is then restored, and only the outline and digital
   readout are painted. There is no dark fill or destructive CLEAR operation,
   including when drawing over an existing preview backdrop.
5. **Rollover:** dial angles wrap by a full revolution, whose sine/cosine
   positions are identical, so crossing 59.999 → 00.000 remains continuous.

## Development and verification

Requires GNOME Shell 50, GJS, GLib tooling and `gnome-extensions`. Tests
additionally use Node.js (built-in test runner). Node must satisfy the version
range in `package.json` for Vite. PNG pixel checks use `pngjs`,
and ZIP validation uses `adm-zip`; both are development-only npm dependencies.
No Python environment or Pillow installation is required.
Run `npm ci` to install TypeScript, the GNOME 50/GJS type definitions and Node
test types, along with the PNG/ZIP test tooling. Typings and test libraries are
development-only dependencies, not runtime imports.

The setup follows the [GJS TypeScript guide](https://gjs.guide/extensions/development/typescript.html):
ES modules, strict checking, `ambient.d.ts` for GI/resource imports, and a build
step because GNOME Shell runs JavaScript, not TypeScript. Local imports retain
their `.js` suffix so the emitted modules load correctly in GJS.
`vite.config.ts` owns the extension build. `npm run build` runs Vite in production
mode, following the imports from `src/extension.ts` and `src/prefs.ts` rather than
compiling every source file. `enable()` and `disable()` call `Logger.info()`
behind `import.meta.env.DEV` guards. Vite replaces those guards at build time,
so production contains neither the calls nor the logger module. GNOME
`gi://`, `resource:///` and `cairo` imports remain external, with ES-module paths
preserved. Production output is formatted for review without name mangling or
code compression, and JavaScript/XML comments are removed. TypeScript source
comments are retained. A small Vite asset hook stages metadata, schema XML,
license alongside the generated JavaScript in `dissts/dist/`.

`npm run build:dev` uses Vite's `development` mode and writes to `dissts/dist-dev/`,
including the logger actually imported by the lifecycle methods. Production
continues to use `dissts/dist/`. One Vite configuration handles both modes, and neither
development builds nor the development session overwrite the reviewer ZIP.
The `DEV`/`PROD` constants are explicitly tied to the Vite mode, because
`vite build --mode development` alone still defaults to production `NODE_ENV`.
Type checking remains a separate `npm run typecheck` step because Vite transforms
TypeScript without checking its types. The root TypeScript configuration uses
`noEmit` so a plain `tsc` invocation cannot overwrite Vite output. Tests and Node
tools explicitly enable emission into their own output directories.
Tests compile separately into
`dissts/dist-tests/`; neither tests, TypeScript sources nor npm dependencies ship in
the extension ZIP. Node packaging tools compile separately into `dissts/dist-tools/`.
`node_modules/` is ignored; the repository retains its existing policy for
generated release and test files.

All generated outputs are grouped under `dissts/`:

```text
dissts/
├── dist/
├── dist-tools/
├── dist-tests/
├── dist-dev/
└── dist-zip/
```

```sh
npm ci                         # install locked development dependencies
npm run build                  # compile runtime modules and stage dissts/dist/
npm run build:dev              # Vite development build, including utils/logger.js
npm run build:tools            # compile Node.js ZIP validation tooling
npm run typecheck              # strict runtime and test type checking
npm test                       # build, model/font tests and build/comment checks
npm run check                  # type checks, tests, syntax, schema, and Cairo pixels
npm run shell-smoke            # isolated headless GNOME Shell + GTK preferences
npm run shell-smoke -- development # also verify actual enable/disable logger output
npm run pack                   # create and validate installable ZIP in dissts/dist-zip/
npm run install:extension      # build and install the extension locally
npm run uninstall              # remove the locally installed extension
npm run dev                    # build dissts/dist-dev/ and launch an isolated nested Shell
```

`npm run dev` builds `dissts/dist-dev/` and stages that extension with compiled schemas
inside temporary data/config/cache directories for the nested Shell session.
It does not uninstall or replace the live extension, write `dissts/dist/`, or create a
development ZIP at the reviewer archive path. Temporary session files are
cleaned up when the nested session exits. These
commands are defined in `package.json`. Installation uses `install:extension`
rather than npm's `install` lifecycle hook, so `npm install` and `npm ci` never
install or replace the extension in your running desktop session.

Before submitting to the reviewer, run `npm run pack`. This always rebuilds in
production mode; development flags are rejected. Submit
`dissts/dist-zip/zclock@lorens.shell-extension.zip`; production validation rejects the
development logger. Dev output is isolated in the ignored `dissts/dist-dev/` directory.

The smoke test starts a **separate compositor and private session bus** with its
own data, config and cache directories under `$TMPDIR`. It verifies loading,
placement changes, click-through state, desktop layering, overview hiding,
disable/re-enable, real subsecond repaint counts, and stopping/releasing the
animation driver. It also opens the real preferences inside that compositor,
counts actual preview draws, and exercises switch/spin bindings and reset. A
compositor screenshot and logs are retained in the printed artifact directory.

The test-only companion enables Shell evaluation **only in that isolated bus**;
it is never included in the extension bundle. No test installs or enables the
extension in your real desktop session. Some host portal/device services may
print unrelated warnings when the isolated session starts or stops.

`tests/render.ts` renders the same code as the extension, at the fixed reference
fixture time **11:11:43**. Its transparent and black-composited PNGs are written
under the system's temporary directory. This is a render fixture, not a live
screenshot.

`tests/check-render.ts` inspects those PNG fixtures using the shared Node.js
pixel helpers in `tests/image.ts`, including transparency, color, subsecond
movement and a black-composited illustration. Font and stroke tests use the
same PNG decoder and explicit RGBA comparisons. Packaging validation in
`scripts/verify-pack.ts` checks required files, excluded development files,
the extension UUID and ZIP entry CRC integrity.
