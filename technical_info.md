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
npm run dev                    # uninstall the live copy, build dev, launch nested Shell
```

`scripts/dev.sh` stages `dissts/dist-dev/` with compiled schemas inside temporary
data/config/cache directories for the nested Shell session. That launcher does
not replace the live extension, write `dissts/dist/`, or create a development ZIP
at the reviewer archive path. Temporary session files are cleaned up when the
nested session exits.

**Important:** the current `npm run dev` command in `package.json` starts with
`npm run uninstall`. It therefore removes the normal per-user installation
before building and launching the otherwise isolated session. To keep your live
installation while developing, use:

```sh
npm run build:dev && bash scripts/dev.sh
```

Installation uses `install:extension` rather than npm's `install` lifecycle hook,
so `npm install` and `npm ci` do not install or replace the extension in your
running desktop session.

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

## Step-by-step workflow for making changes

Run the following commands from the repository root, where `package.json` is
located. The normal loop is **edit source → run checks → rebuild and preview →
run integration tests → package production**. Installing into your normal
desktop is a separate, optional last step.

### 1. Prepare the checkout

```sh
git status --short
node --version
npm ci
npm run typecheck
```

- Check `git status` before editing so you do not overwrite unrelated work.
- Use a Node version accepted by `package.json`. `npm ci` installs the exact
  development dependencies recorded in `package-lock.json`; run it on a fresh
  checkout or after the lockfile changes, not after every small code edit.
- GNOME Shell 50, GJS, `gnome-extensions` and GLib's schema compiler must also be
  installed on the machine. npm supplies the TypeScript definitions and test
  libraries, not the native GNOME runtime. Python is not needed.
- If the baseline checks already fail, record that failure before changing
  code. Do not confuse an existing failure with a regression introduced by your
  change. See the current dev-script/test mismatch in the troubleshooting
  section below.

### 2. Choose the source files and the corresponding tests

Edit files under `src/`, not the generated JavaScript under `dissts/`. Vite
cleans and rebuilds its output directory, so manual edits to generated files
will be lost.

| What you want to change | Main source files | Verification to update or run |
| --- | --- | --- |
| Time formatting, dial angles, monitor geometry | `src/utils/model.ts` | `tests/model.test.ts` |
| Clock artwork, font options, stroke color, transparency | `src/utils/renderer.ts` | `tests/font-render.ts`, `tests/font.test.ts`, `tests/render.ts`, `tests/check-render.ts` |
| Actor placement, visibility, animation, enable/disable cleanup | `src/extension.ts` | `tests/shell-client.ts` and both Shell smoke-test modes |
| Preferences widgets, preview, settings bindings, reset | `src/prefs.ts` | `tests/prefs-client.ts` and the Shell smoke tests |
| A new setting or a default/range change | `src/schemas/org.gnome.shell.extensions.zclock.gschema.xml` plus the consumers above | Schema validation, binding/reset checks, renderer checks where relevant |
| Development logging | `src/utils/logger.ts`, guarded calls in `src/extension.ts` | Development lifecycle logs and production logger-exclusion checks |
| Supported Shell versions or extension metadata | `src/metadata.json` | Compatibility testing, build and ZIP validation |
| Build or packaging behavior | `vite.config.ts`, `scripts/` | `tests/build.test.ts`, `tests/verify-pack.test.ts`, production packaging |

Keep relative imports ending in `.js`, even when the source file is `.ts`.
The emitted files are JavaScript modules loaded by GJS. Keep pure clock math
independent of GI imports, and do not import Shell-only St/Clutter code into the
separate GTK preferences process.

### 3. Make a small change with a focused test

For a bug fix, first add a test that reproduces the bug. For a new option, first
describe its expected behavior in a test. Run that test, confirm that it fails
for the intended reason, implement the change, then run it again.

For example, when working on time or geometry calculations:

```sh
npm run build:tests
node --test dissts/dist-tests/tests/model.test.js
```

For font, color, stroke or text-size changes:

```sh
npm run build:tests
node --test dissts/dist-tests/tests/font.test.js
```

`build:tests` must be rerun after editing a source file or test, because these
commands execute the compiled copies. Font tests invoke the real offscreen GJS
renderer and inspect PNG pixels; they are not browser screenshots or simulated
rendering.

After the focused test is green, run the broader checks:

```sh
npm run typecheck
npm run check
```

`typecheck` checks the extension, tests, Node tools and Vite configuration.
`check` runs the npm test suite, validates emitted JavaScript and the schema,
and performs the Cairo pixel checks. It already includes `npm test`, so you do
not need to run both for every iteration.

The build tests also exercise production/development builds and packaging.
Expect generated files under `dissts/` to be refreshed by the test suite; it is
not a read-only operation on build artifacts.

### 4. Preview the change in a nested development session

The non-destructive preview command is:

```sh
npm run build:dev && bash scripts/dev.sh
```

This performs two different jobs:

1. Vite builds the development extension into `dissts/dist-dev/`. Development
   logging is included; the production output and reviewer ZIP are left alone.
2. The launcher copies that build into a temporary extension directory,
   compiles its schema there, creates private data/config/cache directories and
   starts a nested GNOME Shell on a private session bus.

In the nested desktop, check the behavior you changed: placement, visibility in
Activities, clock movement, settings changes, preferences preview and reset as
appropriate. Open development preferences from a terminal **inside the nested
session**:

```sh
gnome-extensions prefs zclock@lorens
```

Running that command from your normal desktop terminal targets the normal
session instead, not the temporary development copy.

The launcher is not a hot-reload server. If you edit source while the nested
session is running, rebuilding `dissts/dist-dev/` does not replace the copy
already staged in its temporary directory or reload cached GJS modules.
Exit the nested Shell, make your changes, and rerun the preview command.

You can use `npm run dev` as the convenience command, but remember that its
current first step uninstalls the normal desktop copy. It is not equivalent to
the non-destructive command above. On Wayland, the normal Shell may require a
logout/login to forget a removed installation.

### 5. Use development logging without shipping it

The existing lifecycle calls produce `[zclock] Enabled` and `[zclock] Disabled`
in development. The launcher filters its output for `zclock` and its own `>>>`
status messages.

When adding a diagnostic in `src/extension.ts`, use its existing `Logger`
import and guard the call:

```ts
if (import.meta.env.DEV)
    Logger.info('Describe the state being inspected');
```

Use the same guard around `Logger.error(...)` diagnostics. Avoid logging every
animation frame or repaint: that produces noisy output and can disturb the
performance you are trying to inspect.

Vite replaces the guard at build time. Production checks require the logger
module, imports and calls to be absent. Do not copy `utils/logger.js` manually
into the production build or remove the guard to make a message appear.

### 6. When adding or changing a setting

Keep the entire setting path in sync:

1. Add or update the key, type, default, summary and any range in the XML schema
   under `src/schemas/`. Preserve existing key names and the schema ID/path
   unless you intentionally handle the effect on existing preferences.
2. Add the preferences control and its binding in `src/prefs.ts`.
3. Read the setting in `src/extension.ts` where the desktop widget needs it.
4. For drawing options, update `ClockOptions` and the implementation in
   `src/utils/renderer.ts`, and pass the option to both the desktop renderer and
   the preferences preview.
5. Test the new behavior, default value, reset behavior and settings updates in
   both directions. Add invalid-value and mirrored-render checks where relevant.
6. If you add a widget, update the expected control counts in
   `tests/prefs-client.ts` **and** add assertions that exercise its real binding;
   changing a count alone does not test the new control.

Validate the source schema without generating compiled files in `src/`:

```sh
glib-compile-schemas --strict --dry-run src/schemas
```

Restart the development session after a schema change. The launcher and smoke
tests compile the schema in their staged directories. A source-tree
`gschemas.compiled` file is not required, and an old installed schema must not
be used to judge whether a new key works.

### 7. Run real Shell and preferences integration tests

```sh
npm run shell-smoke -- development
npm run shell-smoke
```

The development run checks actual enable/disable/re-enable logging. The default
production run checks that those development messages are absent. Both runs
exercise the built extension and real GTK preferences, including desktop
layering, live settings, visibility and animation cleanup.

Each run prints an artifact directory containing `shell.log`, `prefs.log` and
the compositor screenshot. Inspect that directory when a run fails. Host
portal/device warnings can occur during startup or shutdown; check the exit
status and relevant JavaScript errors rather than treating every warning as an
extension failure or ignoring all warnings.

These automated runs use their own settings and temporary directories. They
do not test your personal saved preferences or replace the live installation.

### 8. Prepare the production ZIP for review

A complete pre-release sequence is:

```sh
npm run typecheck
npm run check
npm run shell-smoke -- development
npm run shell-smoke
npm run pack
git diff --check
git status --short
```

Fix relevant failures before submitting. `npm run pack` performs a fresh
production build, validates the source schema, packages the runtime files and
reads the ZIP back to verify required files, excluded development files, the
UUID and CRC integrity. It rejects development-mode arguments.

Upload this file:

```text
dissts/dist-zip/zclock@lorens.shell-extension.zip
```

Do not upload `src/`, `dissts/dist-dev/`, or the test/tool output directories.
`npm run build` alone refreshes production JavaScript but does **not** refresh
the ZIP; always run `npm run pack` after the final source change.

Review the source diff and any regenerated files tracked by this repository.
Do not hand-edit generated JavaScript to fix a release problem: fix the source
or Vite configuration, rerun checks and rebuild the archive.

### 9. Optionally install the production build on your normal desktop

Only do this when you intend to replace the normal per-user installation:

```sh
npm run install:extension
```

This rebuilds and validates the production ZIP, then installs it with
`gnome-extensions install --force`. For the Wayland workflow, log out and back
in before enabling or checking newly loaded extension code:

```sh
gnome-extensions enable zclock@lorens
gnome-extensions prefs zclock@lorens
```

Use `npm run uninstall` only when you intend to remove
`~/.local/share/gnome-shell/extensions/zclock@lorens`. It is not required for
the non-destructive nested-preview workflow.

### Troubleshooting the change loop

- **The preview still shows old code:** edit `src/`, rebuild, exit the old
  nested session and launch a fresh one. Rebuilding alone does not update its
  temporary installed copy.
- **Development messages are missing:** check that you are running the
  development copy, trigger the relevant lifecycle operation, and keep logger
  calls behind the build-time guard. Production intentionally has no logger.
- **A settings key is missing:** validate the updated XML and start a fresh
  staged session so its schema is compiled again. Do not rely on the schema in
  an older live installation.
- **A pixel test fails:** check the actual fixture and the expected behavior.
  Adjust or add a focused regression test for an intentional artwork change;
  do not simply remove the assertion to obtain a green run.
- **The build test fails on `scripts.dev`:** the current test in
  `tests/build.test.ts` expects `npm run build:dev && bash scripts/dev.sh`, while
  the current `package.json` prefixes that command with `npm run uninstall`.
  This is an existing mismatch. Decide whether uninstalling the live copy is
  intended, then align the script, test and documentation; do not mistake this
  failure for a rendering regression.
- **The reviewer archive contains a logger or stale files:** fix the source or
  build configuration and rerun `npm run pack`. Do not package development
  output or bypass the production ZIP validator.

For everyday editing, the short version is:

```sh
# Edit the relevant src/ file and its tests first.
npm run typecheck && npm run check
npm run build:dev && bash scripts/dev.sh
# Exit the nested session, then repeat after the next edit.
```

When the behavior is ready, run both smoke-test modes and package production as
described above. Resolve any baseline failures, including the documented
dev-script/test mismatch, before treating the checks as a release gate.
