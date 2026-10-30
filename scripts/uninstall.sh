#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

UUID="gclock@lorens"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

# Remove the per-user installation directly from disk. This works even when
# GNOME Shell doesn't yet know about the extension (e.g. it was never picked up
# in the current session), unlike `gnome-extensions uninstall` which errors on
# an unknown UUID. A logout/login on Wayland is needed for the shell to forget it.
rm -rf "$INSTALL_DIR"
printf '\033[31mUninstalled gclock (removed %s). On Wayland, log out and back in for the change to take effect.\033[0m\n' "$INSTALL_DIR"