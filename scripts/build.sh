#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Rebuild from scratch so deleted modules cannot linger in release bundles.
rm -rf dist
npx --no-install tsc -p tsconfig.json
cp metadata.json LICENSE README.md dist/
mkdir -p dist/schemas
cp schemas/*.gschema.xml dist/schemas/
