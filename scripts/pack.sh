#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build -- "$@"
npm run build:tools
glib-compile-schemas --strict --dry-run schemas
mkdir -p distZip
# src/ is not a standard extension entry point, so explicitly include it.
# Tests (including the unsafe isolated test driver) must never be packaged.
gnome-extensions pack --force --out-dir=distZip \
    --extra-source=src --extra-source=LICENSE  dist
# Read back the ZIP: successful command execution alone does not prove that
# every runtime dependency made it into the installable artifact.
node dist-tools/verify-pack.js distZip/zclock@lorens.shell-extension.zip "$@"
