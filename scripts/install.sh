#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Build/validate before replacing the per-user installation. --force supports
# upgrades; the UUID and unchanged schema path preserve existing preferences.
bash scripts/pack.sh "$@"
gnome-extensions install --force distZip/zclock@lorens.shell-extension.zip
printf '\033[33mInstalled zclock. On Wayland, log out and back in, then run:\033[0m\n  gnome-extensions enable zclock@lorens\n  gnome-extensions prefs zclock@lorens\n\n'
