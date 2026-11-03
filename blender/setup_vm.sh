#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sudo apt-get update
sudo apt-get install -y ffmpeg python3 python3-numpy python3-numba python3-scipy python3-shapely python3-pil fonts-dejavu-core curl xz-utils libxi6 libxrender1 libxfixes3 libxkbcommon0 libsm6 libegl1 libgl1
mkdir -p tools
archive=blender-5.2.2-linux-x64.tar.xz
sha=84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168
if [ ! -x tools/blender/blender ]; then
 curl -fL --retry 5 -C - "https://download.blender.org/release/Blender5.2/$archive" -o "tools/$archive"
 echo "$sha  tools/$archive" | sha256sum -c -
 tar -xf "tools/$archive" -C tools
 ln -sfn blender-5.2.2-linux-x64 tools/blender
 rm "tools/$archive"
fi
nvidia-smi
 branch=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1 | cut -d. -f1)
 suffix=''
 if dpkg-query -W "libnvidia-compute-$branch-server" >/dev/null 2>&1; then suffix='-server'; fi
 sudo apt-get install -y "libnvidia-gl-$branch$suffix" "libnvidia-encode-$branch$suffix"
tools/blender/blender -b --factory-startup --python-exit-code 1 --python-expr "import bpy; p=bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type='OPTIX'; p.refresh_devices(); print('OPTIX_PROBE',[(d.name,d.type) for d in p.devices]); assert any(d.type=='OPTIX' for d in p.devices)"
