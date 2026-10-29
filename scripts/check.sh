#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Pure math first; Node checks syntax but cannot execute GNOME GI imports.
npm test
for file in extension.js prefs.js src/*.js; do node --check "$file"; done
# Validate the schema without writing compiled files into the source tree.
glib-compile-schemas --strict --dry-run schemas
# Use the real GJS/Pango/Cairo renderer, then inspect its actual RGBA pixels.
gjs -m tests/render.js
python3 tests/check-render.py
