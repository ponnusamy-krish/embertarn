# Aurelia V2 — WebGPU alpine valley

A local Vite / Three.js 0.187.0 world. All runtime assets are local CC0 files; no CDN is needed. The V1 source in `backup_v1_webgl/` is untouched.

## Run

```sh
npm install
npm run dev
npm run build
npm run preview
```

Open http://localhost:5173 in current Chrome or Edge with hardware acceleration. Native WebGPU is required; unsupported browsers show an explanation rather than silently falling back to WebGL. Use localhost or HTTPS, as WebGPU requires a secure context.

Click **Explore the valley** for pointer lock. WASD moves, Q/E moves vertically, Shift accelerates, Escape releases the mouse, and C toggles the cinematic tour.

- `/?cinematic=1`: eight connected Catmull–Rom shots over 300 seconds: aerial, lake skim, shoreline dolly, forest, ridge reveal, orbit, meadow, pullback.
- `/?capture=1&cinematic=1`: hide all UI and disable the animation loop.
- Add `&quality=ultra` for 1.5 m near-terrain tessellation, 2048-pixel cascades, more AO samples and a 75%-resolution reflection. Default near tessellation is 2 m; reflection resolution is 40% per dimension.

```js
// Wait for assets and initial GPU pipeline compilation.
await new Promise(resolve => {
  const id = setInterval(() => {
    if (window.__ready) { clearInterval(id); resolve(); }
  }, 100);
});
await window.__renderFrame(120);
```

The capture call accepts nonnegative seconds, updates camera/water/wind/sky/mist/birds from a single absolute time, renders the complete post pipeline, and awaits `GPUQueue.onSubmittedWorkDone()`. No temporal AA or history-dependent AO is used. Arbitrary seeks are supported. `window.__setMode('cinematic')` or `'explore'` changes the capture camera mode. The tour wraps at 300 seconds.

`window.__backend`, `__sceneStats`, `__errors`, `__cameraPosition()` and `__tourCollisionCheck()` expose diagnostics.

## Rendering and world structure

- `main.js`: native `WebGPURenderer`, device/features, controls, deterministic frame API and lifecycle. There are no custom GLSL shaders, `ShaderMaterial`, `onBeforeCompile`, or pmndrs postprocessing dependencies.
- `math.js`: seeded 4.608 km heightmap, 1025² samples, warped anisotropic ridge belts, ridged multi-octave detail, gullies and strata. Nine downhill-flow incision passes and five thermal transport passes run once on the CPU. This is a lightweight geological approximation, not a calibrated erosion simulation.
- `terrain.js`: 144 tiles with cached 2/4/8 m geometric LOD (1.5 m near in ultra), skirts, height/slope splatting, triplanar rock projections, correctly oriented detail normals, macro/micro tiling, slope-aware snow, scree and a wet beach band. Textures pack roughness into the normal alpha channel to stay within WebGPU sampler limits.
- `forest.js`: about 19,900 clustered, grounded trees, rejecting water, steep slopes and reserved tour corridors. Nearby trees use 3D branch-layer geometry; the four closest visible trees use optimized scanned mature-fir geometry. Medium crowns use volume meshes; beyond 520 m, crossed impostors use the original scan's baked lighting. Cell-based LOD and instancing limit draw cost. Simplified shadow proxies avoid repeatedly rasterizing millions of scanned needles.
- `vegetation.js`: 142,500 grass blades, roughly 5,900 irregular shore stones, scanned boulders, ferns, saplings and logs. A native TSL compute kernel writes grass wind and distance-fade data to GPU storage buffers. Placement is seeded CPU work; compute culling collapses distant grass rather than using indirect draws.
- `water.js`: native planar reflector node, two animated normal scales, Fresnel, refracted opaque-scene color, heightmap-derived optical depth/absorption, shoreline fading and small foam ripples. Reflections render the same grounded vegetation transforms as the main view.
- `sky.js`: 4k sunset HDR cloud panorama and PMREM lighting, azimuth-aligned sun, three soft PCF CSM cascades following the camera, height/distance fog, moving mist and birds. The panorama drifts slowly from absolute time. Shadow maps refresh whenever the camera moves and at 6 Hz when stationary; capture always refreshes them.
- `post.js`: native Three `RenderPipeline`, GTAO, restrained bloom, shadow-map god rays, FXAA, vignette, AgX tone mapping and sRGB output. No WebGL rendering path.

## Verification

Start the dev server, then run `npm run verify`. Puppeteer launches actual hardware WebGPU with `--enable-unsafe-webgpu --ignore-gpu-blocklist --use-angle=d3d11`; SwiftShader is not used. It records:

- Native `renderer.backend.isWebGPUBackend === true` and adapter information.
- Readiness, browser/validation errors and failed HTTP requests.
- Six 1920×1080 screenshots: explore and cinematic at 20, 60, 120, 200 and 280 seconds.
- Exact PNG repeatability after seeking 120 → 20 → 120.
- Tour terrain/canopy clearance sampled every 0.25 seconds, pointer lock, W movement and C mode switching.
- Default-view, moving-camera and aerial-tour FPS, plus ultra-mode readiness and the unsupported-WebGPU message.

The final run reported 98.4 fps at the default viewpoint, 68.2 fps while flying, and 149.2 fps during the opening aerial shot at 1920?1080. All 51 manifest entries passed local MD5 checks. Results are in `screenshots/verification.json`. Performance numbers are short headless measurements on the local NVIDIA GeForce RTX 5060 Ti, not a guarantee across the entire tour or other machines. `ITERATION=N` saves a separate visual-review set; `FAST=1` skips performance and auxiliary mode checks.

Nine visual review passes were made. They corrected stretched wind coordinates, lifted tree roots, LOD cracks, excess haze, broad procedural cloud blobs, sparse forests, overly simplified fir needles, cliff-normal orientation and shadow cost. Early iteration captures are retained as QA evidence. Real Dolomite lake photographs were used only for visual comparison, not as shipped assets.

## Assets and regeneration

`public/` is approximately 212 MiB (222 MB), below the 400 MB limit. See `CREDITS.md` and the checksum manifest. V2 adds Rock Face 03, Aerial Rocks 04, Industrial Sunset 02 PureSky and an optimized mature Fir Tree 01 GLB. Original V1 CC0 surfaces and small glTF scans remain available.

`download-assets.mjs`, `download-v2-assets.mjs` and `download-sky.mjs` fetch their respective source files from the Poly Haven API and validate MD5s. `optimize-fir.mjs` downloads the original fir into a temporary directory under `scripts/`, selects one tree, welds/simplifies it and exports the GLB; the 478 MB temporary source is removed afterward. The existing distant-tree PNGs retain their V1 source attribution.

## Remaining visual limitations

This is still an approximation of photographic scenery. Distant crossed-tree silhouettes and LOD changes can be noticeable; procedural mid-distance branches are more regular than scanned trees. Cliff silhouettes retain heightfield smoothness, and the snow mask is procedural. Water uses a single planar surface and terrain-derived depth, without wave geometry, underwater caustics or participating-media scattering. The distant forest's baked lighting cannot respond exactly like nearby PBR meshes. Cloud motion rotates a photographed panorama instead of simulating volumetric clouds.
