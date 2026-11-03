# Embertarn - An Alpine Golden Hour

A native Three.js 0.187 WebGPU alpine world. Explore mode uses WASD/mouse, Q/E elevation, Shift speed and C for the 300-second cinematic. Run `npm install`, `npm run dev`, or `npm run build`. Hardware-accelerated Chrome/Edge and WebGPU are required.

V4 film capture and resumable cloud rendering are implemented in scripts/. Film effects apply only with `?capture=1&quality=ultra&film=1`. Existing explore behavior and both backups are preserved.

## Capture API

Wait for `window.__ready`, then call `await window.__renderFrame(t, {sub:16,fps:30})` serially. Film mode averages deterministic subframes over a 180-degree shutter, with subpixel jitter and display-linear accumulation. `window.__framePNG()` returns the completed PNG as base64. Without film mode the original single-frame hook remains available.

## Geographic and asset credits

The terrain is derived from AWS Terrain Tiles around Moraine Lake / Valley of the Ten Peaks, Alberta, Canada. The water outline comes from OpenStreetMap way 356877446. Geographic names identify source data only, not the fictional Embertarn branding. See CREDITS.md for Canadian Open Government and ODbL attribution and CC0 Poly Haven art. Local bathymetry, elevation rebasing and rock detail are artistic reconstruction, not surveying data.

## Remaining visual limits

Synthetic cliff detail, repeated tree shapes and even shoreline blending remain visible. Film framing, atmospheric haze and photographic lens effects reduce these cues; they do not turn the scene into a real photograph.


## V4 film and rendering

Film mode cuts 300 seconds into 45 shots of 6.67 seconds. Six cuts have 0.65-second linear-light crossfades. The camera uses eased drift, deterministic low-amplitude shake and a small roll. Haze, moving low mist, sun glare, pollen, animated cloud shadows, warmer highlights/teal shadows, subtle radial distortion, chromatic aberration, grain and vignetting apply only in capture film mode. A small depth-dependent blur softens the water-detail shot; it is a restrained approximation rather than a physical bokeh lens. Explore mode retains its original render path.

Each output frame averages N jittered subframes over a centered 180-degree shutter. Samples are clamped at hard cuts to avoid ghosts from the adjacent shot. Crossfade cameras render separately. Display-sRGB bytes are decoded to linear RGB, accumulated with Float32 precision and encoded once; this is post-tone-map linear accumulation, not an HDR exposure integrator. RAM use is independent of N. Grain, clouds, mist, water, vegetation and camera motion share absolute time. The GPU canvas must be copied before yielding to the browser compositor; the completed frame hook still awaits submitted GPU work.

```powershell
npm run build
node scripts/render.mjs --fps 30 --width 1920 --height 1080 --sub 16 --out frames
node scripts/audio.mjs
powershell -File scripts/encode.ps1 --title 1
```

Default output: 9,000 PNG frames, then output/alpine_lake_5min.mp4. The filename follows the requested delivery convention; the optional title card says **Embertarn**. Linux uses `bash scripts/encode.sh --title 1`. NVENC is tested by an actual encode before selection (CQ 18, preset p6); failure falls back to libx264 CRF 16/preset slow. Both produce H.264 High, yuv420p, 30 fps, AAC 320k and faststart. The last second fades to black. Audio is 300 seconds of original procedural wind, lapping water and bird-like chirps, with fades and two-pass loudness normalization; measured final loudness is approximately -16.17 LUFS.

`--start` is an inclusive frame index; `--end` is exclusive, default 9000. `--sub 2` is the preview setting. `--segments 1:30,22:30,57:30` produces 90 contiguous output frames drawn from those three one-second timeline excerpts. Use a separate --out for preview and final.

### Recovery rules

- Frames are PNG-decoded with CRC/dimension/nonblank checks before reuse. Partial files are never considered complete. A temp write is fsynced and renamed atomically. A corrupt completed PNG is regenerated.
- manifest.json fingerprints the built dist contents, resolution, fps, shutter, samples and timeline. A changed build/configuration refuses to mix frames; use a new output directory. Range changes do not invalidate the manifest.
- progress.json records total completed frames, skipped frames, effective fps, render seconds/frame and ETA. PNG files are authoritative if progress was interrupted.
- Chrome restarts every 500 newly rendered frames (configurable --restart), and a failed frame/device loss receives up to four attempts with fresh browsers. Software adapters and WebGL fallback are rejected. Another renderer cannot own the same output directory.
- Audio and video write temporary outputs and atomically promote validated results. Matching valid outputs are reused; encoding fingerprints frame bytes, audio and options.
- vm_run.sh uses flock, appends status.log, resumes render/audio/encode, and writes DONE only after success. DONE makes subsequent runs a no-op. Remove DONE intentionally when starting a different delivery.
- Keep the project, frames and output on a **persistent disk**. Spot preemption cannot preserve files stored on a deleted ephemeral/local SSD. Budget at least 40 GB free for lossless frames, assets and working files.

## Ubuntu 22.04 Spot VM

Upload/extract the archive onto a persistent disk, owned by an unprivileged render user. NVIDIA drivers must already be installed.

```bash
bash scripts/vm_setup.sh
nohup bash scripts/vm_run.sh </dev/null >bootstrap.log 2>&1 &
tail -f status.log
```

Setup installs Node 22, Google Chrome stable/dependencies, FFmpeg, Vulkan libraries/tools and fonts; runs npm ci/build; prints nvidia-smi/vulkaninfo; and probes an actual hardware WebGPU render. It is safe to rerun. Normally rerun only vm_run.sh after a stop, preserving the same build and browser. CHROME_BIN defaults to /usr/bin/google-chrome on the VM. For boot-time resume, edit User/WorkingDirectory/ExecStart in scripts/embertarn.service, install it under /etc/systemd/system/, then `sudo systemctl daemon-reload` and `sudo systemctl enable --now embertarn.service`.

Linux Chrome flags include --enable-gpu, --enable-unsafe-webgpu, --enable-features=Vulkan,VulkanFromANGLE, --use-angle=vulkan and --ignore-gpu-blocklist. No display/Xvfb is assumed. These follow [Chromium's headless GPU guidance](https://chromium.googlesource.com/chromium/src.git/+/main/docs/gpu/using-gpu-hardware-in-headless-chrome.md). **Linux execution is not locally verified**: driver/ICD/sandbox configuration may require adjustment. The adapter probe fails loudly instead of accepting software rendering. CHROME_EXTRA_ARGS accepts a JSON array for explicit diagnostic overrides. Use an unprivileged user; CHROME_NO_SANDBOX=1 is an explicit isolated-root-container opt-in, never the default.

## Packaging

`powershell -File scripts/pack.ps1` writes ../embertarn-upload.tar.gz. It excludes node_modules, dist, frames, output, screenshots, backups, .git, logs, DONE and runtime locks. The archive contains source and required scene assets; setup rebuilds dist. No commits or .gitignore edits are performed.

## Local V4 verification

Build passed after the corruption repair and film changes. Four film stills plus three look-review sheets are in screenshots/film/. Native NVIDIA Blackwell WebGPU, zero console/request/asset errors, deterministic out-of-order crossfade rendering and sampled camera clearance passed. `node scripts/verify-film.mjs` reproduces the checks.

The forced-stop test killed the entire owned Node/Chrome tree after five completed frames, resumed unchanged frames, regenerated a deliberately corrupt PNG and finished 90/90. `scripts/test-resume.mjs` requires a fresh frames/preview directory to repeat that destructive test. output/preview_test.mp4 is exactly 3.000 seconds, 90 frames, 1920x1080/30fps H.264 High/yuv420p with AAC stereo audio. Audio and encode reruns correctly skipped valid outputs.

Local RTX 5060 Ti sub-16 capture averaged **0.762 seconds/frame**, including PNG transfer, decoding, fsync and saving, across eight frames at four viewpoints. The API-only four-view mean was 0.727 seconds. At local speed 9000 frames take about 1.9 hours plus browser startup, crossfades and encoding. VM speed is unmeasured; stronger GPU performance does not eliminate CPU readback/PNG overhead. Shell syntax was checked with Bash; Linux package installation and GPU flags still need the supplied VM probe.

## Embertarn Blender film pipeline

The independent [Blender pipeline](blender/README.md) uses Blender 5.2.2, Cycles OptiX, CC0 scans and the existing attributed DEM. Heavy builds and verification run on the cloud VM. Full video rendering is gated on approval of the stills; the interactive web application is unchanged.

