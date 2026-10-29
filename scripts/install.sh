#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash scripts/pack.sh
gnome-extensions install --force dist/gclock@lorens.shell-extension.zip
printf '\nInstalled gclock. On Wayland, log out and back in, then run:\n  gnome-extensions enable gclock@lorens\n  gnome-extensions prefs gclock@lorens\n'
