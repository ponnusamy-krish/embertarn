#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
iteration=${1:-1}
tools/blender/blender -b embertarn.blend --python-exit-code 1 -P render.py -- --frames 80,240,560,400,720,1360,1200,2000 --outdir "stills/iteration$iteration"
