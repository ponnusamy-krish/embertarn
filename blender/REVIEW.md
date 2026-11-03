# Embertarn visual review and verification

Reference photographs are retained outside the render assets in `../screenshots/reference/`, with provenance in `sources.json`. They are comparison references only, not scene textures or redistributed in the deployment archive.

## Pass 1 — rejected

Reviewed all six full-resolution frames against reference photos 1 and 2. The actual scan silhouettes and ray-traced reflections work, but the result is not photographic. Shadows are severely underexposed; almost no forest or shoreline detail survives. The mountain silhouette is recognizable, but the DEM's smooth interpolation dominates and the material lacks readable rock strata. Tight camera fields of view crop the summits; the ridge view mostly shows an uninteresting dark slope. Ground cover is sparse and one source imported the entire grass variant display row.

Changes for pass 2: raise environmental illumination, warm direct sun, increase exposure, widen landscape framing, redesign ridge and last-light views; add multi-scale domain-warped geometric relief and shader strata, make snow cover more legible, constrain the beach material by elevation, and import individual grass/fern variants with denser ground cover. All terrain tiles now share the same 5 m edge sampling to eliminate LOD cracks.

## Infrastructure

The Ubuntu Deep Learning image initially lacked `libnvoptix.so`. Installing the matching **580-server** graphics library supplies OptiX without replacing the server driver stack. Blender 5.2.2 then enumerated `NVIDIA RTX PRO 6000 Blackwell Server Edition` as OPTIX. Setup now preserves the installed server/non-server package family. Official version checksum is pinned in setup.

Pass-1 timings are intentionally not final-quality budget estimates; the look was rejected. No full 7,200-frame render has been launched.


## Passes 2 through 5

Increased sky fill and exposure, corrected foliage alpha, added scanned rock at multiple scales, softened snow masks and added shoreline boulders. Pass 3 exposed smooth DEM geometry and crushed canopy shadows. Pass 5 shoreline frame 400 was strongest; wide faces still looked clay-like and snow had thin scratch artifacts.

## Pass 6

Added an 8193-square heightfield processed by 8.96 million hydraulic particles and thermal transport. Flow, erosion and deposition maps drive wet streaks, scree and snow. Eroded geometry improved distant ridges and snowfields. Review still found a smooth foreground mass, overly parallel gullies, gray forest ground and a cyan water boundary.

## Pass 7

Reframed the aerial, varied erosion strength spatially, normalized explicit triplanar texture weights and added clustered ground cover, shrubs and fallen timber. Lifted forest exposure, retaining shore composition and lighting. Inspection still found the cyan stripe and weak leaf-litter detail.

## Pass 8 / delivered set

Added forest_leaves_02 moss/leaves/twigs. The cyan cause was a lake polygon/terrain shoreline disagreement of up to 11 m, exposing a vertical water-volume face. Buffered the water shell by 20 m so it ends underground. Consolidated water volume nodes to avoid exceeding Cycles closure limits. Re-rendered all eight 1920x1080 frames and compared with three photographic references in `stills/review-pass8.jpg`.

The cyan seam is gone; ray-traced reflections and scanned shoreline rocks are strongest. Eroded snowfields improved. This is still not consistently photographic: some channels are too parallel, forest ground plants repeat, canopy interiors are dark, and distant surfaces lack the references' complexity. Final stills are in `stills/final/`.

## Final verification

Blender 5.2.2 / RTX PRO 6000 Blackwell / Cycles OptiX / 1920x1080 / adaptive 48 samples wide, 64 close and forest / denoising / native motion blur. Nine consecutive frames measured evaluation, rendering, PNG saving and validation: wide 4.782 s, shore 4.776 s, forest 4.665 s. First frame 4.914 s; complete process 49.429 s. Weighted tour estimate 9.51 hours, or 11.42 with 20% allowance, excluding preemption and unbenchmarked-shot variation.

The resume test SIGKILLed its owned Blender process after four valid frames. Restart preserved all four SHA256 hashes, logged skips and completed 24/24 valid frames. Preview: one second, 1080p/24, H.264 High/yuv420p, AAC. FFmpeg tremolo was corrected from unsupported 0.08 to 0.1 Hz. Ambience measures -15.92 LUFS. Missing NVENC library exercised libx264 fallback; installing matching libnvidia-encode-580-server enabled successful NVENC encoding. Setup includes that dependency.

No full 7,200-frame rendering was started; still approval is required. All scene/cache/checkpoints persist on the VM disk.


## Round 9 and correction 10

Verified scale before changing geometry: 10,240 m / 2048 intervals = 5 m per original sample; eroded data uses 1.25 m samples; Blender units are metres. Original elevations span 1608.94 to 3453.63 m after the existing 36 m additive lake datum adjustment. There was no erroneous vertical scale. See terrain-scale-audit.json.

Pass 9 added cliff-band shaping, reduced near-camera fog with a smooth distance ramp, increased contrast, brightened glacial scattering and substantially increased clustered ferns/shrubs. The comparison sheet revealed unacceptable repeated snow stripes on the periodic ledges, and the contrast crushed shaded ground. Rejected that geometry treatment.

Pass 10 replaced periodic terraces with one irregular cliff transition and modest upper-ridge uplift, kept talus below the high-slope mask, broke snow into spatial patches, lifted exposure and reduced water absorption. Compared all eight images to the same real photographs. The striped snow artifact is gone and peaks/understory are stronger. Remaining limitations are explicit: some faces retain comb-like gullies, the forest still has dry gaps, and shaded water remains darker and less turquoise than the photographic references. Reflections remain intact. This is an improvement, not a claim of indistinguishability from photography.

Review sets: stills/iteration9 and stills/iteration10. Contact sheets: stills/review-pass9.jpg and stills/review-pass10.jpg.


Final throughput/quality comparison and three-worker resume verification are documented in PERFORMANCE.md. The chosen configuration preserves samples and light paths. Effective output time improved to 1.76-1.84 s/frame through scheduling and cache retention. Full rendering remains unstarted.


## Round 11 - production look

Root cause of the last-light smear was Euler rotation wrap, not terrain or UVs: the camera Y rotation crossed -pi/+pi between frames 1360 and 1364. At 1360.25 the old interpolation had already introduced about four degrees of unintended rotation. A/B rendering without motion blur removed the smear. All cameras are now baked as hemisphere-consistent quaternions. Production disables motion blur on the first and last frame of every shot to prevent a shutter from sampling across camera cuts; camera motion blur remains enabled inside shots.

Audited all 45 cameras at start/end/midpoint subframes and explicitly checked frame 1360. Rendered 14 representative cut endpoints at 640x360 and inspected the contact sheet. The final 1080p frame 1360 is sharp, including the right mountain/trees and their reflection.

Added glacial silt colour to the submerged bed and adjusted water volume scattering/absorption. Shallows are lighter and the lake is more teal while grazing reflections remain. Snow combines altitude, slope, local concavity and erosion flow with irregular macro masks; bright gullies and benches return without periodic bands. All eight final-setting review frames were inspected against the reference sheet; no new regression was found. Remaining procedural geology/vegetation limitations persist.

Stills: `stills/iteration11/`. Review: `stills/review-pass11.jpg`. Cut audit and sheet: `stills/cuts11/`. The user approved the full Cycles render; the boot-enabled production service now supersedes earlier notes that the full render had not started.
