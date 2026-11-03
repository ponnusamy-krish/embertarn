# Embertarn throughput measurements

Ubuntu 22.04, Blender 5.2.2, Cycles OptiX, RTX PRO 6000 Blackwell Server Edition. Iteration 10 scene, 1920x1080, 16-bit PNG. All experiments were bounded; no full film was started.

## Comparison method

Single-variable trials rendered six frames (80-82 and 560-562) per Blender process. Concurrency trials rendered the same 24-frame workload (80-91 and 560-571), assigned by frame modulo worker count. Throughput includes process startup, scene loading, rendering, PNG writing, validation and telemetry. Longer batches amortize startup better; compare the 24-frame concurrency rows with each other. The earlier 4.78 s/frame result excluded process startup and used iteration 8, so it is not an identical workload.

Mean absolute differences are computed on decoded 8-bit display RGB, normalized to 0-1. They are screening metrics, not proof of visual equivalence. Side-by-side images and magnified differences were inspected; canopy-edge outliers remain in maximum-error measurements. Image parameters were retained rather than accepting quality-sensitive changes for marginal speed gains.

| Configuration | Frames | Workers | Frames/hour | Wide MAE | Forest MAE |
|---|---:|---:|---:|---:|---:|
| adaptive | 6 | 1 | 892 | 0.001824 | 0.001693 |
| baseline | 6 | 1 | 634 | 0.000000 | 0.000000 |
| bounces | 6 | 1 | 880 | 0.000114 | 0.000114 |
| chosen repeat | 24 | 3 | 2045 | 0.000036 | 0.000092 |
| camera_static | 6 | 1 | 922 | 0.000036 | 0.000088 |
| concurrent1 | 24 | 1 | 1092 | 0.000035 | 0.000080 |
| concurrent2 | 24 | 2 | 1588 | 0.000036 | 0.000099 |
| concurrent3 | 24 | 3 | 1955 | 0.000036 | 0.000095 |
| gpu_compositor | 6 | 1 | 879 | 0.000036 | 0.000097 |
| hybrid | 6 | 1 | 710 | 0.000572 | 0.001960 |
| oidn | 6 | 1 | 881 | 0.005590 | 0.008160 |
| png0 | 6 | 1 | 698 | 0.000037 | 0.000088 |
| png3 | 6 | 1 | 696 | 0.000036 | 0.000082 |
| reuse_engine | 6 | 1 | 877 | 0.000036 | 0.000091 |
| threads16 | 6 | 1 | 894 | 0.000037 | 0.000092 |
| threads8 | 6 | 1 | 861 | 0.000036 | 0.000094 |
| tile512 | 6 | 1 | 647 | 0.000090 | 0.000225 |

## Bottleneck and selected settings

The redundant per-frame render-engine assignment discarded useful persistent state. Guarding it reduces steady-frame BVH submissions from 271 to 2 (camera cuts still rebuild more). Disabling object/deformation motion blur on static geometry retains camera motion blur. Persistent data was enabled throughout. CPU scene synchronization remains the main bottleneck; overlapping three workers fills more GPU idle time.

Selected: GPU-only OptiX, three processes with 16 CPU threads each, persistent data, camera-only motion blur, PNG compression 0, unchanged 48/64 maximum samples, adaptive threshold 0.045/minimum 8, six total bounces, two diffuse/three glossy/six transmission, 2048 tiles, original OptiX denoising. No sample or light-path reduction was accepted. OIDN and hybrid CPU/GPU changed more pixels and did not improve throughput. Smaller tiles were slower. GPU compositor and lower CPU thread counts provided no compelling advantage.

PNG compression 0 is lossless and requires roughly 90 GB for 7,200 RGB16 frames. The 300 GB VM disk has adequate space. Output frames retain CRC/decompression validation and atomic promotion.

## Stage profile

Baseline wide frame: scene synchronization 1.764 s, BVH submission span 0.263 s, path tracing 0.812 s, denoising 0.015 s. Forest: sync 1.787 s, BVH span 0.265 s, tracing 0.762 s, denoising 0.013 s. Mean PNG save was 0.366 s; compression 0 reduced it to about 0.136 s. Static-object/engine reuse reduced synchronization to about 1.5 s and warm-frame BVH work substantially.

BVH span is measured between first and last logged OptiX submissions, not an isolated GPU execution timer. Uploads, kernel setup and compositing account for additional render time. These nested diagnostic stages should not be summed as mutually exclusive phases. The early validation telemetry field also included progress bookkeeping; the final verification script records validation separately. `throughput/render-bench-source.py` preserves the source used for the initial trials.

Telemetry (sampled about every 0.3 s): one optimized worker averaged 24.7% GPU utilization / 8.7 GB peak VRAM; two averaged 41.5% / 17.5 GB; three averaged 52.4% / 26.2 GB. CPU utilization averaged 4.4%, 6.8% and 9.3% of all 48 vCPUs. Peak GPU utilization reached 100%. Short sampling windows and sequential runs introduce normal measurement variation.

## Resuming and reproducing

`run_final.sh` remains gated by APPROVED_STILLS=1. It calls `render_batch.py`, which renders shot-sized batches with disjoint modulo frame ownership, retries crashes, locks the output directory, checks scene/settings manifests before skipping, and preserves valid completed PNGs. SIGTERM stops owned workers cleanly; a spot shutdown can interrupt any frame without promoting a partial PNG.

`verify_chosen.py` repeats a bounded quality/throughput trial and the 24-frame kill/resume test. For a new scene or renderer version, preserve/rename the old throughput directory first; stale benchmark results are rejected. `throughput.py` contains individual configuration trials, and `benchmark_concurrency.sh` runs one/two/three-worker trials. `summarize_throughput.py` retains raw phase and telemetry summaries. `quality_sheet.py` creates baseline/candidate/difference sheets.

Blender performance reference: https://docs.blender.org/manual/en/latest/render/cycles/render_settings/performance.html . Measurements and engine-reset findings above are from this scene, not vendor estimates.


## Locked configuration verification

The final repeat completed 24 frames in 42.244 seconds: **2,045 frames/hour, 1.760 effective seconds/output frame**. Per-worker frame latency averaged 4.718 s because workers share the GPU; do not confuse that with aggregate throughput. The preceding three-worker run measured 1,955 frames/hour. Historical iteration-8 serial latency was 4.78 s/frame (about 753 frames/hour excluding startup); current iteration-10 baseline averaged 5.00 s/frame (634 frames/hour including its short six-frame startup).

Projected 7,200-frame duration: 3.52-3.68 hours at observed aggregate throughput; plan approximately **3.5-4.5 hours**, excluding spot downtime and encoding. Most other shot angles were not throughput-benchmarked, so this is an estimate, not a guarantee.

Final GPU load averaged 54.7%, peak VRAM was 26.2 GB, and CPU use averaged 9.2% across all 48 vCPUs. Wide/forest normalized display MAE was 0.000036/0.000092; 99th-percentile difference was 0/1 display code value. Differences are not bit-exact: isolated backlit canopy-edge pixels differ more. Side-by-side and 20x difference views in `throughput/quality-chosen.jpg` showed no visible loss at normal viewing scale. Sampling and light-path quality were unchanged.

The final resume test killed the entire owned process group after six complete PNGs (three workers finished almost together). Restart preserved all six SHA256 hashes, logged skips, and completed all 24 valid frames. Proof: `resume-round9-result.json` (test name retained from this realism round). Python syntax and Bash syntax checks passed. The full 7,200-frame render remains unstarted.
