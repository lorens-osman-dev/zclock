# zclock

A transparent desktop clock for **GNOME Shell 50**, inspired by the supplied
`Group@2x.jpg`: a large hour, a hollow outlined minute capsule, and two offset,
rotating instrument-style dials. The inner scale is minutes; the outer scale is
seconds. The currently selected value points right toward the capsule. Labels
remain upright while the scales rotate.

## Features

- Native GJS, Cairo and Pango rendering; no browser, network access, or runtime npm dependencies.
- Click-through desktop widget above the wallpaper and below application windows.
- 12/24-hour display, optional seconds ring, adjustable opacity.
- Font family, text color, bold toggle, and independent font size (50–150%)
  for the digital readout and dial labels, with live preview and reset.
- Size and horizontal/vertical placement, with primary or specific display selection.
- Automatically constrained to the chosen display's work area.
- Live GTK4/libadwaita preferences with preview and reset.
- Hidden during Activities by default, removed on lock/disable.
- Smooth frame-synced seconds and minute dials, using millisecond-precision local
  time. Animation pauses while hidden or unmapped and resynchronizes on return.
- A fully transparent minute capsule interior: only its outline and digits are
  painted, so wallpaper or other content underneath shows through unchanged.

The widget does not set your wallpaper. A plain dark wallpaper looks closest to
the reference. The reference's phone battery indicator is not part of this clock.

## Install

From this directory:

```sh
bash scripts/install.sh
```

Or install the prebuilt ZIP:

```sh
gnome-extensions install --force dist/zclock@lorens.shell-extension.zip
```

On Wayland, **log out and log back in** after a first installation or code update,
then enable and configure it:

```sh
gnome-extensions enable zclock@lorens
gnome-extensions prefs zclock@lorens
```

Default placement: left side, vertically centered, height 740 logical pixels.
The apparent clock is narrower than its transparent drawing surface. Display
`-1` follows the primary monitor; `0` selects the first, `1` the second, etc.
Disconnected/invalid monitor selections fall back to the primary display.

To remove:

```sh
gnome-extensions disable zclock@lorens
gnome-extensions uninstall zclock@lorens
```

## Development and verification

Requires GNOME Shell 50, GJS, GLib tooling and `gnome-extensions`. Tests additionally
use Node.js (built-in test runner) and Python 3 with Pillow. There are no npm
packages to install.

```sh
npm test                       # pure local-time and placement tests
npm run check                  # above + syntax, schemas and actual Cairo pixels
bash scripts/shell-smoke.sh     # actual isolated headless GNOME Shell + GTK prefs
npm run pack                   # create and validate installable ZIP in dist/
```

The smoke test starts a **separate compositor and private session bus** with its
own data, config and cache directories under `$TMPDIR`. It verifies loading,
placement changes, click-through state, desktop layering, overview hiding,
disable/re-enable, real subsecond repaint counts, and stopping/releasing the
animation driver. It also opens the real preferences inside
that compositor, counts actual preview draws, and exercises switch/spin bindings
and reset. A compositor
screenshot and logs are retained in the printed artifact directory.

The test-only companion enables Shell evaluation **only in that isolated bus**;
it is never included in the extension bundle. No test installs or enables the
extension in your real desktop session. Some host portal/device services may
print unrelated warnings when the isolated session starts or stops.

`tests/render.js` renders the same code as the extension, at the fixed reference
fixture time **11:11:43**. Its transparent and black-composited PNGs are written
under the system's temporary directory (the Hermes scratch directory when run
inside Hermes). This is a render fixture, not a live screenshot.

Only GNOME Shell 50 is currently declared supported and integration-tested.
Shell's private background-group API is deliberately confined to `extension.js`.
No drag gestures are installed: the widget never intercepts desktop input.

## How the animation and transparency work

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
   hidden/unmapped, and disable stops it, disconnects signals and releases its
   actor reference before destroying the actor.
4. **No minute fill:** an even-odd clip excludes the capsule interior while the
   dials are drawn. The clip is then restored, and only the outline and digital
   readout are painted. There is no dark fill or destructive CLEAR operation,
   including when drawing over an existing preview backdrop.
5. **Rollover:** dial angles wrap by a full revolution, whose sine/cosine
   positions are identical, so crossing 59.999 → 00.000 remains continuous.

## Layout

- `extension.js` — Shell actor, placement, visibility and lifecycle.
- `src/model.js` — pure local-time and monitor geometry.
- `src/renderer.js` — shared Cairo/Pango drawing.
- `prefs.js` — libadwaita settings window.
- `schemas/` — settings schema.
- `tests/` and `scripts/` — tests, packaging and installation.

## License

GPL-3.0-or-later. See `LICENSE`.
