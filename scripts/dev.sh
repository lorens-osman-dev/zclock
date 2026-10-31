#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf '\033[97;44m Dev mode : nested Gnome session ✓✓ \033[0m\n\n'

export UUID="zclock@lorens"
ROOT="$(mktemp -d "$(node -p 'require("node:os").tmpdir()')/zclock-dev.XXXXXX")"
trap 'rm -rf "$ROOT"' EXIT
export XDG_CONFIG_HOME="$ROOT/config"
export XDG_DATA_HOME="$ROOT/data"
export XDG_CACHE_HOME="$ROOT/cache"
EXTENSION="$XDG_DATA_HOME/gnome-shell/extensions/$UUID"
mkdir -p "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$EXTENSION"
cp -r dist-dev/. "$EXTENSION/"
glib-compile-schemas --strict "$EXTENSION/schemas"

dbus-run-session -- bash -euc '
  gnome-shell --devkit --wayland &
  shell_pid=$!
  trap "kill $shell_pid 2>/dev/null || true; wait $shell_pid 2>/dev/null || true" EXIT

  # wait until the nested shell owns org.gnome.Shell.Extensions
  for i in $(seq 1 60); do
    gdbus call --session --dest org.freedesktop.DBus \
      --object-path /org/freedesktop/DBus \
      --method org.freedesktop.DBus.NameHasOwner org.gnome.Shell.Extensions \
      | grep -q true && break
    sleep 0.5
  done

  gnome-extensions enable "$UUID" && echo ">>> $UUID enabled in nested session"
  wait $shell_pid
' 2>&1 | grep --line-buffered "zclock\|>>>"