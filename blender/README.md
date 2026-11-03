# Embertarn — Cycles film pipeline

This independent Blender project preserves the interactive WebGPU application. It renders 45 shots, 160 frames each: 7,200 frames at 24 fps, 1920×1080. All current shots use Cycles OptiX, AgX, motion blur, adaptive sampling and GPU denoising. External textures and instanced botanical scans keep the blend portable.

## Cloud workflow

Run `pack.ps1` locally. Upload `embertarn-blender-upload.tar.gz` and extract in the VM home directory. The archive contains scripts, DEM and credits; downloaded assets, blends, frames and backups are excluded.

```bash
cd ~/embertarn/blender
bash setup_vm.sh
python3 fetch_assets.py
python3 erode.py
tools/blender/blender -b --factory-startup --python-exit-code 1 -P build_scene.py
tools/blender/blender -b embertarn.blend --python-exit-code 1 -P render.py -- --frames 80,240,560,400,720,1360,1200,2000 --outdir stills/final
```

**Full scene builds are deliberately disabled on Windows.** Perform heavy work only on the 180 GB cloud VM. Do not start the final sequence until the stills are approved.

After approval: `nohup env APPROVED_STILLS=1 bash run_final.sh > launcher.log 2>&1 < /dev/null &`. Re-run the same command after a spot interruption. The runner uses an exclusive lock, retries failed Blender processes, renders in shot-sized batches, and writes `DONE` only after audio and encoding succeed. Frame files are atomically promoted after full PNG CRC/decompression checks. A manifest prevents mixing different scene/settings in the same frame folder. Preserve the VM disk; stopping the VM does not remove work.

For a reduced-sample test use `--start 160 --end 183 --samples 8 --outdir frames-test`; resume with identical settings. Generate audio with `python3 audio.py`, then `python3 encode.py --frames frames-test --start 160 --count 24 --out output/preview_test.mp4`. Final encoding uses NVENC CQ18, with libx264 CRF17 fallback, H.264 High/yuv420p, AAC320k and faststart. The first-shot title is “Embertarn”; final output fades to black. Original procedural wind/water/bird-like ambience uses no licensed recordings.

## Reproducibility and credits

Blender is pinned to **5.2.2 LTS** with its official Linux SHA256 verified by setup. Assets are downloaded through the Poly Haven API and MD5 checked; authors and CC0 links are recorded in `../CREDITS.md`. The scene uses fir, pine sapling, two boulder scans, fern, grass, dead timber, nine PBR surfaces (three rock scans at 4k) and a golden-hour HDRI.

The DEM originates from the Moraine Lake region, AWS Terrain Tiles/Mapzen/Tilezen, with Canadian source attribution and an OpenStreetMap lake outline. See the parent credits for geographic provenance. The fictional Embertarn title is not a claim that this reconstruction reproduces current conditions at that location. DEM values are little-endian float32, 2049² samples over 10,240 metres; the lake is rebased to elevation 1,884 metres. Added fine detail and shoreline bathymetry are synthetic.

## Verified results

Eight final review images are in `stills/final/`; `stills/review-pass8.jpg` compares all eight against real photographic references. See `REVIEW.md` for remaining limitations.

Cloud-only erosion upsamples the float32 DEM to 8193 squared, runs hydraulic particles and thermal transport, and checkpoints binary height/flow/erosion/deposition maps. Cliff tiles use 2.5 m geometry, distant tiles 5 m. Geometry Nodes retain instances. A buffered water shell hides its boundary beneath the shore.

The latest throughput configuration is locked in `render-settings.json`: three GPU-only OptiX workers, 16 CPU threads each, persistent data, camera-only motion blur, lossless PNG compression 0. Samples, adaptive threshold, bounces and denoiser quality remain unchanged. `run_final.sh` calls `render_batch.py` for non-overlapping, resumable shot batches.

Measured aggregate throughput is **1,955-2,045 frames/hour**, or **1.76-1.84 effective seconds/output frame**. Plan about **3.5-4.5 hours** for 7,200 frames, excluding preemption and encoding. This is a mixed wide/forest benchmark, not an exhaustive timing of every shot. Uncompressed RGB16 PNGs require approximately 90 GB. See [PERFORMANCE.md](PERFORMANCE.md) for all configurations, phase timings, GPU/CPU/VRAM telemetry, numeric differences and limitations.

The final three-worker SIGKILL/resume test preserved six completed PNG hashes and finished 24/24. Evidence: `resume-round9-result.json`. `throughput/quality-chosen.jpg` compares baseline and chosen settings. The older `output/preview_test.mp4` remains the iteration-8 one-second encoding test; it is not a preview of the latest look. Both NVENC and software fallback were verified previously. Setup includes matching NVIDIA server-family OptiX/encode libraries and Pillow for benchmark image comparisons.

Latest stills: `stills/iteration9/` (rejected regular snow bands) and `stills/iteration10/` (corrected). The eight copies in `stills/final/` now match iteration 10. Reference comparisons: `stills/review-pass9.jpg` and `stills/review-pass10.jpg`. The metre-scale audit is in `terrain-scale-audit.json`.

The final blend remains on the persistent VM disk at `~/embertarn/blender/embertarn.blend`; do not build or open it on the memory-limited local PC. Full rendering has not started and remains approval-gated. Some gullies and forest ground plants still look procedural.


## Approved production run - iteration 11

The user approved the full 7,200-frame Cycles-only render. `embertarn-render.service` runs `run_final.sh` with approval recorded in its environment, then audio, encode and DONE. It is enabled at boot, waits for the NVIDIA driver and restarts failed runs after 60 seconds. Existing validated frames are skipped. A stopped/preempted spot VM must still be started through Google Cloud; once booted, the service resumes automatically. It does not stop the VM on completion.

Cheap one-line status on the VM: `~/embertarn/blender/status.sh`. From another machine:

```sh
gcloud compute ssh embertarn-render --zone asia-southeast1-a --project karuthu --command '~/embertarn/blender/status.sh'
```

Status reports committed frames, recent aggregate frames/hour, ETA, worker count, DONE and the last recorded error. Render logs: `status.log`, `service.log`, `frames/worker-*.log`; progress: `frames/progress-*.json`. Final movie: `output/embertarn_5min.mp4`.

Iteration 11 fixes the last-light Euler-angle wrap using quaternion camera animation, guards every cut's shutter interval, adds teal submerged silt and brighter irregular snow pockets. Latest review sheet: `stills/review-pass11.jpg`; all eight images: `stills/iteration11/` and `stills/final/`. Do not change the scene, renderer or settings while production is running: the manifests deliberately reject mixed versions. `install_render_service.sh --start` is idempotent and installs/enables the service; use only for an approved run.
