#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm test
for file in extension.js prefs.js src/*.js; do node --check "$file"; done
glib-compile-schemas --strict --dry-run schemas
gjs -m tests/render.js
python3 tests/check-render.py
