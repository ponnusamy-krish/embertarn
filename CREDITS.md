# Asset credits

All rendered photographic art is CC0 1.0, from Poly Haven. Geographic data has separate licenses below. https://polyhaven.com/license

- **Qwantani Sunset** - Greg Zaal, Jarod Guest - https://polyhaven.com/a/qwantani_sunset - CC0 1.0
- **Grass Ground** - Charlotte Baglioni - https://polyhaven.com/a/grass_ground - CC0 1.0
- **Forest Ground 04** - Rob Tuytel, Rico Cilliers - https://polyhaven.com/a/forest_ground_04 - CC0 1.0
- **Rock Face** - Greg Zaal, Dario Barresi - https://polyhaven.com/a/rock_face - CC0 1.0
- **Snow 02** - Rob Tuytel - https://polyhaven.com/a/snow_02 - CC0 1.0
- **Dry River Pebbles** - Amal Kumar - https://polyhaven.com/a/dry_river_pebbles - CC0 1.0
- **Fir Sapling** - Rob Tuytel, Rico Cilliers - https://polyhaven.com/a/fir_sapling - CC0 1.0
- **Boulder 01** - Rico Cilliers - https://polyhaven.com/a/boulder_01 - CC0 1.0
- **Fern 02** - Rob Tuytel, Rico Cilliers - https://polyhaven.com/a/fern_02 - CC0 1.0
- **Dead Tree Trunk** - Rob Tuytel - https://polyhaven.com/a/dead_tree_trunk - CC0 1.0

- **Fir Tree 01** - Rob Tuytel, Rico Cilliers - https://polyhaven.com/a/fir_tree_01 - CC0 1.0. V2 uses a locally optimized 1k-PBR GLB of the first mature fir, with welded geometry and meshoptimizer simplification (ratio 0.18, error 0.002). Reproduce with scripts/optimize-fir.mjs. The three distant impostor PNGs were baked from the original full-detail model in V1; their original bake tools remain in the untouched backup_v1_webgl/.

Procedural terrain-detail algorithms, grass blades, water normal texture, and bird geometry: original project code; CC0 1.0.


V2 additions (all CC0 1.0):

- **Industrial Sunset 02 PureSky** - Sergej Majboroda (original), Jarod Guest (sky edits) - https://polyhaven.com/a/industrial_sunset_02_puresky - CC0 1.0. 4k HDR, lighting and visible cloud panorama.
- **Rock Face 03** - Dario Barresi (photography), Rico Cilliers (processing) - https://polyhaven.com/a/rock_face_03 - CC0 1.0. 2k diffuse, OpenGL normal, roughness.
- **Aerial Rocks 04** - Rob Tuytel - https://polyhaven.com/a/aerial_rocks_04 - CC0 1.0. 2k diffuse, OpenGL normal, roughness.

Downloads use the Poly Haven assets and files APIs. `public/assets/manifest.json` records source URLs, sizes and MD5 checksums; the optimized fir has its own derivation record. Qwantani Sunset and the original Rock Face remain included source assets, superseded in V2's active scene.

Three.js and its WebGPU/TSL examples are MIT-licensed software, not art assets. glTF Transform and meshoptimizer are MIT-licensed build tools. No non-CC0 photographs or AI-generated images are shipped.


## V3 additions

- Table Mountain 2 (Pure Sky) - Greg Zaal (original), Jarod Guest (sky edits), https://polyhaven.com/a/table_mountain_2_puresky - CC0 1.0. Active 4k HDR sky and PMREM. API provenance: public/assets/sky-v3-source.json.
- Terrain Tiles / Moraine Lake DEM - Mapzen/Tilezen, hosted by AWS Open Data, https://registry.opendata.aws/terrain-tiles/ . Forty-nine zoom-13 Terrarium tiles; URLs in public/assets/moraine-dem/metadata.json. Required attribution: **Canada terrain data contains information licensed under the Open Government Licence - Canada.** See https://github.com/tilezen/joerd/blob/master/docs/attribution.md and https://open.canada.ca/en/open-government-licence-canada . Geographic data, not CC0 art.
- Moraine Lake outline - Copyright OpenStreetMap contributors, way 356877446, https://www.openstreetmap.org/way/356877446 - ODbL 1.0, https://www.openstreetmap.org/copyright . Extracted outline: public/assets/moraine-dem/lake-outline.json. The derived shoreline field and locally leveled lakebed are distributed under ODbL. These are geographic data, not CC0 art.
- Fir octahedral atlas: sixteen albedo/object-normal views locally derived from Fir Tree 01 above, CC0. Reproduce with scripts/bake-octa.mjs and scripts/assemble-octa.py.
- Five copyrighted comparison photos remain only in screenshots/reference, outside public/. Exact URLs: sources.json. Four Moraine images are from Mark Unrau's gallery at https://morainelakesunriseshuttle.com/photos/ . The fifth carries a Tezya Photography watermark. They are not scene assets or sampled in rendering.
- src/AtmosphereSky.js adapts the MIT Three.js SkyMesh with a deterministic clock; available via ?sky=analytic. Default uses photographed CC0 clouds.


## Embertarn film audio (V4)

The 300-second stereo wind, shore wash and sparse bird-like chirps are original procedural synthesis in scripts/audio.mjs, dedicated to CC0 1.0 by this project. No third-party audio samples, Freesound/API assets, Pixabay tracks or recordings are used. The source is continuous rather than looped, so there are no loop joins to crossfade. FFmpeg performs fades and two-pass EBU R128 loudness normalization to -16 LUFS / -1.5 dBTP. Procedural chirps are an artistic approximation, not field recordings.
