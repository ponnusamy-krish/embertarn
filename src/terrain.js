import * as THREE from "three/webgpu";
import {
  Fn,
  vec3,
  float,
  mix,
  texture,
  positionWorld,
  normalWorldGeometry,
  cameraPosition,
  cameraViewMatrix,
  smoothstep,
  sin,
  normalMap,
  uv,
  mx_fractal_noise_float,
} from "three/tsl";
import { height, WORLD, GRID, generateHeightmap } from "./math.js";
export async function loadSurfaces(manager) {
  const loader = new THREE.TextureLoader(manager),
    result = {};
  await Promise.all(
    [
      "grass_ground",
      "forest_ground_04",
      "rock_face_03",
      "aerial_rocks_04",
      "snow_02",
      "dry_river_pebbles",
    ].map(async (id) => {
      const maps = await Promise.all(
        ["diff", "nor_gl", "rough"].map(async (k) => {
          const t = await loader.loadAsync(`/assets/${id}/${k}.jpg`);
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = 8;
          if (k === "diff") t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }),
      );
      const c = document.createElement("canvas");
      c.width = maps[1].image.width;
      c.height = maps[1].image.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(maps[1].image, 0, 0);
      const p = ctx.getImageData(0, 0, c.width, c.height);
      ctx.drawImage(maps[2].image, 0, 0);
      const r = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < p.data.length; i += 4) p.data[i] = r.data[i - 2];
      const packed = new THREE.DataTexture(p.data, c.width, c.height);
      packed.flipY = true;
      packed.wrapS = packed.wrapT = THREE.RepeatWrapping;
      packed.generateMipmaps = true;
      packed.minFilter = THREE.LinearMipmapLinearFilter;
      packed.magFilter = THREE.LinearFilter;
      packed.anisotropy = 8;
      packed.needsUpdate = true;
      result[id] = {
        map: maps[0],
        normalMap: maps[1],
        roughnessMap: maps[2],
        packed,
      };
    }),
  );
  return result;
}
export function makeTerrainMaterial(s) {
  const mat = new THREE.MeshStandardNodeMaterial({
    roughness: 0.92,
    envMapIntensity: 0.35,
  });
  const p = positionWorld,
    n = normalWorldGeometry,
    w = n
      .abs()
      .pow(5)
      .div(n.abs().pow(5).dot(vec3(1)));
  const distance = cameraPosition.distance(p),
    far = smoothstep(100, 900, distance);
  const tri = (map, scale) =>
    texture(map, p.yz.mul(scale))
      .mul(w.x)
      .add(texture(map, p.xz.mul(scale)).mul(w.y))
      .add(texture(map, p.xy.mul(scale)).mul(w.z));
  const ground = (map, scale) =>
    mix(
      texture(map, p.xz.mul(scale)),
      texture(map, p.xz.mul(scale * 0.19)),
      far.mul(0.7),
    );
  const strata = sin(
    p.y
      .mul(0.19)
      .add(p.x.mul(0.026))
      .add(sin(p.z.mul(0.015)).mul(3)),
  )
    .mul(0.08)
    .add(0.92);
  const slopeRock = smoothstep(0.16, 0.48, n.y.oneMinus()),
    highRock = smoothstep(220, 480, p.y).mul(0.85),
    rock = slopeRock.max(highRock);
  const snow = smoothstep(580, 900, p.y.add(sin(p.x.mul(0.016)).mul(40))).mul(
    smoothstep(0.42, 0.73, n.y),
  );
  const shore = smoothstep(24.2, 29, p.y).oneMinus(),
    forest = smoothstep(31, 65, p.y)
      .mul(smoothstep(180, 330, p.y).oneMinus())
      .mul(0.7);
  const scree = smoothstep(0.18, 0.5, n.y.oneMinus())
    .mul(smoothstep(0.52, 0.85, n.y))
    .mul(smoothstep(90, 240, p.y));
  const grass = ground(s.grass_ground.map, 0.22).rgb.mul(
    vec3(0.65, 0.79, 0.48),
  );
  const soil = ground(s.forest_ground_04.map, 0.24).rgb.mul(0.67);
  const macro = mx_fractal_noise_float(p.mul(0.035), 4).mul(0.35).add(0.85);
  const cliff = mix(
    tri(s.rock_face_03.map, 0.085).rgb,
    tri(s.rock_face_03.map, 0.0038).rgb,
    far.mul(0.85),
  )
    .mul(strata)
    .mul(macro)
    .mul(vec3(0.64, 0.78, 0.94));
  const rubble = ground(s.aerial_rocks_04.map, 0.035).rgb.mul(0.87);
  const snowColor = ground(s.snow_02.map, 0.13).rgb;
  const beach = ground(s.dry_river_pebbles.map, 0.38).rgb;
  const wet = smoothstep(22.1, 24.4, p.y).mul(0.55).add(0.45);
  mat.colorNode = mix(
    mix(
      mix(mix(mix(grass, soil, forest), cliff, rock), rubble, scree.mul(0.65)),
      snowColor,
      snow,
    ),
    beach.mul(wet),
    shore,
  );
  const g = texture(s.grass_ground.packed, p.xz.mul(0.22)),
    f = texture(s.forest_ground_04.packed, p.xz.mul(0.24)),
    r = tri(s.rock_face_03.packed, 0.085),
    b = texture(s.dry_river_pebbles.packed, p.xz.mul(0.38)),
    sn = texture(s.grass_ground.packed, p.xz.mul(0.13));
  const detail = mix(mix(mix(mix(g, f, forest), r, rock), sn, snow), b, shore);
  // Project tangent-space normal components into each triplanar world frame.
  const rn = (coords) =>
    mix(
      texture(s.rock_face_03.packed, coords.mul(0.085)).xyz,
      texture(s.rock_face_03.packed, coords.mul(0.0038)).xyz,
      far.mul(0.8),
    )
      .mul(2)
      .sub(1);
  const rx = rn(p.yz),
    ry = rn(p.xz),
    rz = rn(p.xy);
  const cliffDetail = vec3(0, rx.x, rx.y)
    .mul(w.x)
    .add(vec3(ry.x, 0, ry.y).mul(w.y))
    .add(vec3(rz.x, rz.y, 0).mul(w.z));
  const groundDetail = vec3(detail.x.mul(2).sub(1), 0, detail.y.mul(2).sub(1));
  const perturbed = n
    .add(
      mix(groundDetail.mul(0.38), cliffDetail.mul(1.15), rock).mul(
        snow.mul(-0.7).add(1),
      ),
    )
    .normalize();
  mat.normalNode = perturbed.transformDirection(cameraViewMatrix);
  mat.roughnessNode = mix(
    detail.a.clamp(0.48, 1),
    float(0.29),
    shore.mul(wet.oneMinus()),
  );
  return mat;
}
export function createTerrain(scene, surfaces) {
  const material = makeTerrainMaterial(surfaces),
    tiles = [],
    step = 384;
  function geometry(cx, cz, segments) {
    const g = new THREE.PlaneGeometry(step, step, segments, segments);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = cx + p.getX(i),
        z = cz + p.getZ(i);
      p.setXYZ(i, x, height(x, z), z);
    }
    g.computeVertexNormals();
    const oldPositions = Array.from(g.attributes.position.array),
      oldUVs = Array.from(g.attributes.uv.array),
      indices = Array.from(g.index.array),
      row = segments + 1;
    const edges = [
      Array.from({ length: row }, (_, i) => i),
      Array.from({ length: row }, (_, i) => segments * row + i),
      Array.from({ length: row }, (_, i) => i * row),
      Array.from({ length: row }, (_, i) => i * row + segments),
    ];
    for (const edge of edges) {
      let previous = -1;
      for (let j = 0; j < edge.length; j++) {
        const top = edge[j],
          bottom = oldPositions.length / 3;
        oldPositions.push(p.getX(top), p.getY(top) - 12, p.getZ(top));
        oldUVs.push(0, 0);
        if (j > 0) {
          const before = edge[j - 1];
          indices.push(before, top, bottom, before, bottom, previous);
        }
        previous = bottom;
      }
    }
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(oldPositions, 3),
    );
    g.setAttribute("uv", new THREE.Float32BufferAttribute(oldUVs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  for (let z = 0; z < 12; z++)
    for (let x = 0; x < 12; x++) {
      const cx = (x + 0.5) * step - WORLD / 2,
        cz = (z + 0.5) * step - WORLD / 2;
      const mesh = new THREE.Mesh(geometry(cx, cz, 48), material);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);
      tiles.push({
        cx,
        cz,
        mesh,
        levels: new Map([[48, mesh.geometry]]),
        level: 48,
      });
    }
  return {
    update(camera, ultra = false) {
      for (const t of tiles) {
        const d = Math.hypot(
          camera.position.x - t.cx,
          camera.position.z - t.cz,
        );
        const level = d < 490 ? (ultra ? 256 : 192) : d < 950 ? 96 : 48;
        if (level !== t.level) {
          if (!t.levels.has(level))
            t.levels.set(level, geometry(t.cx, t.cz, level));
          t.mesh.geometry = t.levels.get(level);
          t.level = level;
        }
      }
    },
    tiles,
  };
}
export function makeHeightTexture() {
  const data = generateHeightmap();
  const tex = new THREE.DataTexture(
    data,
    GRID,
    GRID,
    THREE.RedFormat,
    THREE.FloatType,
  );
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
