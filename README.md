# gclock

A transparent desktop clock for **GNOME Shell 50**, inspired by the supplied
`Group@2x.jpg`: a large hour, a dark outlined minute capsule, and two offset,
rotating instrument-style dials. The inner scale is minutes; the outer scale is
seconds. The currently selected value points right toward the capsule. Labels
remain upright while the scales rotate.

## Features

- Native GJS, Cairo and Pango rendering; no browser, network access, or runtime npm dependencies.
- Click-through desktop widget above the wallpaper and below application windows.
- 12/24-hour display, optional seconds ring, adjustable opacity.
- Size and horizontal/vertical placement, with primary or specific display selection.
- Automatically constrained to the chosen display's work area.
- Live GTK4/libadwaita preferences with preview and reset.
- Hidden during Activities by default, removed on lock/disable.
- One update per second. Uses local system time and observes clock/timezone changes
  on the next update. Minutes advance with seconds; seconds step once per second.

The widget does not set your wallpaper. A plain dark wallpaper looks closest to
the reference. The reference's phone battery indicator is not part of this clock.

## Install

From this directory:

```sh
bash scripts/install.sh
```

Or install the prebuilt ZIP:

```sh
gnome-extensions install --force dist/gclock@lorens.shell-extension.zip
```

On Wayland, **log out and log back in** after a first installation or code update,
then enable and configure it:

```sh
gnome-extensions enable gclock@lorens
gnome-extensions prefs gclock@lorens
```

Default placement: left side, vertically centered, height 740 logical pixels.
The apparent clock is narrower than its transparent drawing surface. Display
`-1` follows the primary monitor; `0` selects the first, `1` the second, etc.
Disconnected/invalid monitor selections fall back to the primary display.

To remove:

```sh
gnome-extensions disable gclock@lorens
gnome-extensions uninstall gclock@lorens
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
disable/re-enable, and timed repaints. It also opens the real preferences inside
that compositor and exercises switch/spin bindings and reset. A compositor
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

## Layout

- `extension.js` — Shell actor, placement, visibility and lifecycle.
- `src/model.js` — pure local-time and monitor geometry.
- `src/renderer.js` — shared Cairo/Pango drawing.
- `prefs.js` — libadwaita settings window.
- `schemas/` — settings schema.
- `tests/` and `scripts/` — tests, packaging and installation.

## License

GPL-3.0-or-later. See `LICENSE`.
