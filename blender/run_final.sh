#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f DONE ] && exit 0
[ "${APPROVED_STILLS:-0}" = 1 ] || { echo 'Set APPROVED_STILLS=1 only after approving the stills.'; exit 1; }
exec 9>.render.lock
flock -n 9 || exit 0
exec >>status.log 2>&1
echo "$(date -Is) starting/resuming"
python3 fetch_assets.py
python3 erode.py
B=tools/blender/blender
[ -s embertarn.blend ] || "$B" -b --factory-startup --python-exit-code 1 -P build_scene.py
python3 render_batch.py --start 0 --end 7199
python3 audio.py
bash encode.sh
touch DONE
echo "$(date -Is) complete"
