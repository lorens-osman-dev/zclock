#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
glib-compile-schemas --strict --dry-run schemas
mkdir -p dist
# src/ is not a standard extension entry point, so explicitly include it.
# Tests (including the unsafe isolated test driver) must never be packaged.
gnome-extensions pack --force --out-dir=dist \
    --extra-source=src --extra-source=LICENSE --extra-source=README.md .
# Read back the ZIP: successful command execution alone does not prove that
# every runtime dependency made it into the installable artifact.
python3 - <<'PY'
import json, zipfile
from pathlib import Path
archive = Path('dist/zclock@lorens.shell-extension.zip')
with zipfile.ZipFile(archive) as bundle:
    names = set(bundle.namelist())
    required = {'extension.js', 'prefs.js', 'metadata.json', 'src/model.js',
                'src/renderer.js', 'schemas/org.gnome.shell.extensions.zclock.gschema.xml',
                'LICENSE', 'README.md'}
    assert required <= names, f'Missing bundle files: {required - names}'
    assert not any('test' in name for name in names), 'Test-only code must not ship'
    assert json.loads(bundle.read('metadata.json'))['uuid'] == 'zclock@lorens'
    assert bundle.testzip() is None
print(f'Verified installable bundle: {archive.resolve()} ({archive.stat().st_size} bytes)')
PY
