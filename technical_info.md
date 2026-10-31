# Technical information

## Compatibility and architecture

Only GNOME Shell 50 is currently declared supported and integration-tested.
Shell's private background-group API is deliberately confined to `extension.js`.
No drag gestures are installed: the widget never intercepts desktop input.

- `extension.js` — Shell actor, placement, visibility and lifecycle.
- `src/model.js` — pure local-time and monitor geometry.
- `src/renderer.js` — shared Cairo/Pango drawing.
- `prefs.js` — libadwaita settings window.
- `schemas/` — settings schema.
- `tests/` and `scripts/` — tests, packaging and installation.

## Animation and transparency

The source includes explanatory comments about the mathematics, drawing steps,
settings bindings, and resource ownership. Start with `src/model.js`, then
`src/renderer.js`, and finally `extension.js` to follow data from time to pixels.

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
additionally use Node.js (built-in test runner) and Python 3 with Pillow. There
are no npm packages to install.

```sh
npm test                       # pure local-time and placement tests
npm run check                  # tests, syntax, schema, and Cairo pixel checks
npm run shell-smoke            # isolated headless GNOME Shell + GTK preferences
npm run pack                   # create and validate installable ZIP in distZip/
npm run install                # install the extension locally
npm run uninstall              # remove the locally installed extension
npm run dev                    # uninstall, reinstall, and start the dev workflow
```

`npm run dev` runs `scripts/dev.sh` after reinstalling the extension. These
commands are defined in `package.json`.

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

`tests/render.js` renders the same code as the extension, at the fixed reference
fixture time **11:11:43**. Its transparent and black-composited PNGs are written
under the system's temporary directory. This is a render fixture, not a live
screenshot.
