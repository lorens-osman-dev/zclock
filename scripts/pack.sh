#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if (($#)); then
    printf 'Reviewer packaging is production-only; use npm run dev for development.\n' >&2
    exit 2
fi
npm run build
npm run build:tools
glib-compile-schemas --strict --dry-run src/schemas
mkdir -p dissts/dist-zip
# utils/ is not a standard extension entry point, so explicitly include it.
# Tests (including the unsafe isolated test driver) must never be packaged.
gnome-extensions pack --force --out-dir=dissts/dist-zip \
    --extra-source=utils --extra-source=assets --extra-source=LICENSE dissts/dist
# Read back the ZIP: successful command execution alone does not prove that
# every runtime dependency made it into the installable artifact.
node dissts/dist-tools/verify-pack.js dissts/dist-zip/zclock@lorens.shell-extension.zip
