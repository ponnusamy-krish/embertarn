#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>.vm-run.lock
flock -n 9 || { echo 'Another vm_run owns this workspace'; exit 1; }
[[ -f DONE ]] && exit 0
exec >>status.log 2>&1
trap 'code=$?; echo "$(date -Is) interrupted/failed (exit $code)"' EXIT
export CHROME_BIN=${CHROME_BIN:-/usr/bin/google-chrome}
echo "$(date -Is) render/resume Embertarn"
[[ -f dist/index.html ]] || npm run build
node scripts/render.mjs --fps 30 --width 1920 --height 1080 --sub 16 --out frames
echo "$(date -Is) audio"
node scripts/audio.mjs
echo "$(date -Is) encode"
bash scripts/encode.sh --title 1
printf '%s\n' "$(date -Is) completed" > DONE.partial
mv DONE.partial DONE
echo "$(date -Is) DONE"
trap - EXIT
