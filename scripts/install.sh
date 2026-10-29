#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Build/validate before replacing the per-user installation. --force supports
# upgrades; the UUID and unchanged schema path preserve existing preferences.
bash scripts/pack.sh
gnome-extensions install --force dist/gclock@lorens.shell-extension.zip
printf '\nInstalled gclock. On Wayland, log out and back in, then run:\n  gnome-extensions enable gclock@lorens\n  gnome-extensions prefs gclock@lorens\n'
