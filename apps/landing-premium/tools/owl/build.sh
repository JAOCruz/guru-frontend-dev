#!/usr/bin/env bash
# Regenerates public/models/owl.glb from build_owl.py (Blender 5.x headless) and compresses it with meshopt.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
B=/Applications/Blender.app/Contents/MacOS/Blender
TMP="${TMPDIR:-/tmp}/owl_raw.glb"
"$B" -b --factory-startup --python "$HERE/build_owl.py" -- --out "$TMP" ${PREVIEW:+--preview "$PREVIEW"} 2>&1 | grep -E "bounds|meshes:|Error|Traceback|wrote|preview"
mkdir -p "$APP/public/models"
npx -y @gltf-transform/cli@4 optimize "$TMP" "$APP/public/models/owl.glb" \
  --compress meshopt --flatten false --join false --palette false --simplify false --instance false --prune-attributes false
ls -la "$APP/public/models/owl.glb"
