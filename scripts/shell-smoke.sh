#!/usr/bin/env bash
# Runs a second, headless compositor. Does NOT install into the user's profile.
set -euo pipefail
cd "$(dirname "$0")/.."
export TMPDIR="${TMPDIR:-$(python3 -c 'import tempfile; print(tempfile.gettempdir())')}"
ROOT="$(mktemp -d "$TMPDIR/gclock-shell.XXXXXX")"
export GCLOCK_TEST_ROOT="$ROOT"
export GCLOCK_SOURCE="$PWD"
export XDG_CONFIG_HOME="$ROOT/config"
export XDG_DATA_HOME="$ROOT/data"
export XDG_CACHE_HOME="$ROOT/cache"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_DATA_HOME/gnome-shell/extensions/gclock@lorens"
cp -r extension.js prefs.js metadata.json src schemas "$XDG_DATA_HOME/gnome-shell/extensions/gclock@lorens/"
glib-compile-schemas --strict "$XDG_DATA_HOME/gnome-shell/extensions/gclock@lorens/schemas"
# The test-only companion allows introspection on this private D-Bus only.
DRIVER="$XDG_DATA_HOME/gnome-shell/extensions/gclock-test@local"
mkdir -p "$DRIVER"
cp tests/driver.js "$DRIVER/extension.js"
python3 -c 'import json,os; p=os.environ["XDG_DATA_HOME"]+"/gnome-shell/extensions/gclock-test@local/metadata.json"; json.dump({"uuid":"gclock-test@local","name":"Test driver","description":"Isolated smoke test only","shell-version":["50"]},open(p,"w"))'
dbus-run-session -- bash -euc '
    gsettings set org.gnome.shell enabled-extensions "['\''gclock-test@local'\'', '\''gclock@lorens'\'']"
    gsettings set org.gnome.shell disable-user-extensions false
    gsettings set org.gnome.shell welcome-dialog-last-shown-version "'\''50.1'\''"
    gnome-shell --headless --virtual-monitor=1280x900 --wayland-display=gclock-test >"$GCLOCK_TEST_ROOT/shell.log" 2>&1 &
    shell_pid=$!
    trap "kill $shell_pid 2>/dev/null || true; wait $shell_pid 2>/dev/null || true" EXIT
    gjs -m "$GCLOCK_SOURCE/tests/shell-client.js"
    WAYLAND_DISPLAY=gclock-test GI_TYPELIB_PATH=/usr/lib/gnome-shell/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH} G_DEBUG=fatal-criticals gjs -m "$GCLOCK_SOURCE/tests/prefs-client.js" >"$GCLOCK_TEST_ROOT/prefs.log" 2>&1 || { python3 -c '\''import os; print(open(os.environ["GCLOCK_TEST_ROOT"]+"/prefs.log").read())'\''; exit 1; }
    python3 -c '\''import os; print(open(os.environ["GCLOCK_TEST_ROOT"]+"/prefs.log").read())'\''
'
printf 'Shell smoke-test artifacts: %s\n' "$ROOT"
