import * as THREE from "three/webgpu";
import {
  Fn,
  instancedArray,
  instanceIndex,
  positionLocal,
  attribute,
  vec2,
  vec3,
  vec4,
  sin,
  cos,
  smoothstep,
  uniform,
  float,
} from "three/tsl";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { random, height, slope, lakeRadius, LAKE } from "./math.js";
import { inCameraCorridor } from "./cinematic.js";
export function instances(scene, geo, mat, items, shadow = false) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length),
    dummy = new THREE.Object3D();
  items.forEach((v, i) => {
    dummy.position.set(v.x, v.y, v.z);
    dummy.rotation.set(v.rx || 0, v.a || 0, v.rz || 0);
    dummy.scale.set(v.sx || v.s, v.sy || v.s, v.sz || v.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (v.color) mesh.setColorAt(i, v.color);
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}
export async function createVegetation(scene, surfaces, manager, time) {
  const rand = random(841),
    loader = new GLTFLoader(manager),
    [boulder, fern, log, sapling] = await Promise.all(
      ["boulder_01", "fern_02", "dead_tree_trunk", "fir_sapling"].map((id) =>
        loader.loadAsync(`/assets/${id}/${id}.gltf`),
      ),
    );
  function scan(root, items, first = false) {
    root.updateMatrixWorld(true);
    const target = first ? root.children[0] : root;
    target.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const m = new THREE.MeshStandardNodeMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(m, o.material);
      m.envMapIntensity = 0.45;
      instances(scene, g, m, items, true);
    });
  }
  const boulders = [],
    pebbles = [];
  for (let i = 0; i < 6500; i++) {
    const a = rand() * Math.PI * 2,
      r = 0.985 + rand() * 0.16,
      x = Math.cos(a) * 470 * r,
      z = Math.sin(a) * 700 * r,
      y = height(x, z);
    if (y < 20 || y > 34 || inCameraCorridor(x, z, 5)) continue;
    const scale = 0.12 + Math.pow(rand(), 4) * 2.1;
    pebbles.push({
      x,
      y: y - scale * 0.2,
      z,
      s: scale,
      sx: scale * (1 + rand()),
      sy: scale * 0.65,
      sz: scale,
      a: rand() * 6.28,
      color: new THREE.Color().setScalar(0.5 + rand() * 0.45),
    });
    if (scale > 1.3 && boulders.length < 30)
      boulders.push({ x, y: y - 0.5, z, s: scale * 1.3, a: rand() * 6.28 });
  }
  boulders.push(
    { x: -340, y: height(-340, 648) - 0.4, z: 648, s: 2.7, a: 0.8 },
    { x: -348, y: height(-348, 632) - 0.6, z: 632, s: 1.7, a: 2 },
  );
  scan(boulder.scene, boulders);
  const pebbleMat = new THREE.MeshStandardNodeMaterial({
    map: surfaces.dry_river_pebbles.map,
    roughness: 0.72,
    normalMap: surfaces.dry_river_pebbles.normalMap,
  });
  for (let type = 0; type < 3; type++) {
    const g = new THREE.IcosahedronGeometry(1, type === 0 ? 1 : 0),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.8 + rand() * 0.35;
      p.setXYZ(
        i,
        p.getX(i) * k,
        p.getY(i) * (0.6 + rand() * 0.2),
        p.getZ(i) * k,
      );
    }
    g.computeVertexNormals();
    instances(
      scene,
      g,
      pebbleMat,
      pebbles.filter((_, i) => i % 3 === type),
    );
  }
  const ferns = [],
    young = [];
  for (let i = 0; i < 150; i++) {
    const x = -380 + (rand() - 0.5) * 150,
      z = 620 + (rand() - 0.5) * 160,
      y = height(x, z);
    if (y > 26 && !inCameraCorridor(x, z, 6)) {
      ferns.push({
        x,
        y: y - 0.05,
        z,
        s: 0.7 + rand() * 1.1,
        a: rand() * 6.28,
      });
      if (i % 13 === 0)
        young.push({ x, y: y - 0.1, z, s: 2 + rand() * 1.5, a: rand() * 6.28 });
    }
  }
  scan(fern.scene, ferns, true);
  scan(sapling.scene, young, true);
  scan(log.scene, [
    { x: -365, y: height(-365, 610) - 0.1, z: 610, s: 1.8, a: 1.9 },
    { x: 385, y: height(385, 560), z: 560, s: 1.3, a: 2.4 },
  ]);
  const grass = [];
  for (let i = 0; i < 150000; i++) {
    const centers = [
        [-330, 670],
        [390, 570],
        [-500, 350],
      ],
      c = centers[i % 3],
      spread = i % 3 === 2 ? 130 : 110,
      x = c[0] + (rand() - 0.5) * spread,
      z = c[1] + (rand() - 0.5) * spread,
      y = height(x, z);
    if (y < 24.5 || slope(x, z) > 0.62) continue;
    grass.push({
      x,
      y: y - 0.03,
      z,
      s: 0.35 + rand() * 0.75,
      a: rand() * 6.28,
      color: new THREE.Color().setHSL(
        0.23 + rand() * 0.07,
        0.28,
        0.35 + rand() * 0.2,
      ),
    });
  }
  const blade = new THREE.BufferGeometry();
  blade.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.025, 0, 0, 0.025, 0, 0, -0.019, 0.32, 0.03, 0.019, 0.32, 0.03,
        -0.011, 0.66, 0.09, 0.011, 0.66, 0.09, 0.03, 1, 0.17,
      ],
      3,
    ),
  );
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  blade.computeVertexNormals();
  const seeds = new Float32Array(grass.length * 4);
  grass.forEach((p, i) => seeds.set([p.x, p.y, p.z, p.a], i * 4));
  const positions = instancedArray(seeds, "vec4"),
    motion = instancedArray(grass.length, "vec4"),
    eye = uniform(new THREE.Vector3());
  const compute = Fn(() => {
    const p = positions.element(instanceIndex),
      d = p.xz.distance(eye.xz),
      fade = smoothstep(100, 165, d).oneMinus();
    const gust = sin(time.mul(1.4).add(p.x.mul(0.16)).add(p.z.mul(0.11)));
    motion
      .element(instanceIndex)
      .assign(
        vec4(
          gust.mul(0.22),
          cos(time.mul(0.75).add(p.z.mul(0.09))).mul(0.1),
          fade,
          0,
        ),
      );
  })()
    .compute(grass.length)
    .setName("Grass wind and distance culling");
  const wind = motion.element(instanceIndex),
    grassMat = new THREE.MeshStandardNodeMaterial({
      color: 0x8caa64,
      side: THREE.DoubleSide,
      roughness: 0.94,
      envMapIntensity: 0.3,
    });
  grassMat.positionNode = positionLocal
    .sub(positions.element(instanceIndex).xyz)
    .mul(wind.z)
    .add(positions.element(instanceIndex).xyz)
    .add(vec3(wind.x, 0, wind.y).mul(attribute("position").y.pow(2)));
  instances(scene, blade, grassMat, grass);
  return {
    compute,
    update(camera) {
      eye.value.copy(camera.position);
    },
    counts: {
      grass: grass.length,
      pebbles: pebbles.length,
      boulders: boulders.length,
      ferns: ferns.length,
    },
  };
}
