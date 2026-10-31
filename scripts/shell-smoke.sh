#!/usr/bin/env bash
# Runs a second, headless compositor. Does NOT install into the user's profile.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
npm run build:tests
export TMPDIR="${TMPDIR:-$(node -p 'require("node:os").tmpdir()')}"
ROOT="$(mktemp -d "$TMPDIR/zclock-shell.XXXXXX")"
export GCLOCK_TEST_ROOT="$ROOT"
export GCLOCK_SOURCE="$PWD"
export XDG_CONFIG_HOME="$ROOT/config"
export XDG_DATA_HOME="$ROOT/data"
export XDG_CACHE_HOME="$ROOT/cache"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_DATA_HOME/gnome-shell/extensions/zclock@lorens"
cp -r dist/. "$XDG_DATA_HOME/gnome-shell/extensions/zclock@lorens/"
glib-compile-schemas --strict "$XDG_DATA_HOME/gnome-shell/extensions/zclock@lorens/schemas"
# The test-only companion allows introspection on this private D-Bus only.
DRIVER="$XDG_DATA_HOME/gnome-shell/extensions/zclock-test@local"
mkdir -p "$DRIVER"
cp dist-tests/tests/driver.js "$DRIVER/extension.js"
node --input-type=module -e 'import {writeFileSync} from "node:fs"; import {join} from "node:path"; writeFileSync(join(process.env.XDG_DATA_HOME, "gnome-shell/extensions/zclock-test@local/metadata.json"), JSON.stringify({uuid: "zclock-test@local", name: "Test driver", description: "Isolated smoke test only", "shell-version": ["50"]}), "utf8");'
dbus-run-session -- bash -euc '
    gsettings set org.gnome.shell enabled-extensions "['\''zclock-test@local'\'', '\''zclock@lorens'\'']"
    gsettings set org.gnome.shell disable-user-extensions false
    gsettings set org.gnome.shell welcome-dialog-last-shown-version "'\''50.1'\''"
    gnome-shell --headless --virtual-monitor=1280x900 --wayland-display=zclock-test >"$GCLOCK_TEST_ROOT/shell.log" 2>&1 &
    shell_pid=$!
    trap "kill $shell_pid 2>/dev/null || true; wait $shell_pid 2>/dev/null || true" EXIT
    gjs -m "$GCLOCK_SOURCE/dist-tests/tests/shell-client.js"
    WAYLAND_DISPLAY=zclock-test GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH} G_DEBUG=fatal-criticals timeout 30s gjs -m "$GCLOCK_SOURCE/dist-tests/tests/prefs-client.js" >"$GCLOCK_TEST_ROOT/prefs.log" 2>&1 || { cat "$GCLOCK_TEST_ROOT/prefs.log"; exit 1; }
    cat "$GCLOCK_TEST_ROOT/prefs.log"
'
printf 'Shell smoke-test artifacts: %s\n' "$ROOT"
