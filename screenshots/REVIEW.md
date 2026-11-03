# Visual review record

Reference: [Lago di Braies photography](https://www.fotografjoachimsen.no/fotokurs/2025/dolomites-photography-workshop-2026), viewed for geological massing, forest density, water color and atmospheric perspective. No reference photography is shipped as an asset.

The iteration folders contain actual rendered QA captures, not image mockups.

1. First complete WebGPU render: detected instanced-position wind errors and excess haze.
2. Corrected wind to use untransformed geometry attributes, grounded roots, closed LOD seams and changed light direction.
3. Broadened geological ridge shapes, added forest crown volume and tested finer procedural clouds.
4. Replaced artificial cloud blobs with HDR photography, added scanned close vegetation and revised grass color.
5. Added mature-fir geometry, increased forest density and introduced far crossed-impostor LOD.
6. Improved far-tree lighting, geometric cliff detail and rendering cost.
7. Added a sunset cloud HDRI and shadow update scheduling; verified large performance improvement.
8. Restored fir needle detail after an over-aggressive simplification, added shadow proxies, checked exact repeated captures and controls.
9. Corrected triplanar cliff normals in world space so rock detail survives on steep slopes and at distance.

Final six captures were inspected individually. Native NVIDIA WebGPU, zero console/validation errors or failed requests, deterministic PNG output after arbitrary seeks, ultra readiness, and unsupported-browser messaging passed. The sampled tour's minimum terrain clearance was 1.6 m and conservative canopy clearance 2.17 m.

Remaining differences from photography: far foliage silhouettes and lighting are visibly simplified, medium conifer branches remain repetitive, some rock patterns and snow transitions reveal procedural construction, and the flat lake lacks wave geometry and underwater caustics. The scene should not be presented as indistinguishable from a real photograph.
