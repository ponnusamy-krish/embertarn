import { scannedForest } from "./forest.js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { random, height, slope, lakeRadius } from "./math.js";
import { inCameraCorridor } from "./cinematic.js";
function addInstances(scene, geometry, material, transforms, shadow = false) {
  const m = new THREE.InstancedMesh(geometry, material, transforms.length);
  const obj = new THREE.Object3D();
  transforms.forEach((v, i) => {
    obj.position.set(v.x, v.y, v.z);
    obj.rotation.set(v.rx || 0, v.a || 0, v.rz || 0);
    obj.scale.setScalar(v.s);
    obj.updateMatrix();
    m.setMatrixAt(i, obj.matrix);
    if (v.color) m.setColorAt(i, v.color);
  });
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  scene.add(m);
  return m;
}
export async function createVegetation(scene, surfaces, manager, time) {
  const rand = random(419),
    trees = [];
  const color = new THREE.Color();
  for (let i = 0; i < 36000; i++) {
    const x = (rand() - 0.5) * 3100,
      z = (rand() - 0.5) * 3300,
      y = height(x, z),
      r = lakeRadius(x, z);
    if (
      (x > -380 && x < -270 && z > 560 && z < 720) ||
      y < 26 ||
      y > 420 ||
      r < 1.035 ||
      slope(x, z) > 0.9 ||
      inCameraCorridor(x, z) ||
      rand() > 0.68 - y / 600
    )
      continue;
    trees.push({
      x,
      y: y - 0.2,
      z,
      a: rand() * 6.28,
      s: 0.8 + rand() * 1.0,
      color: color
        .clone()
        .setHSL(
          0.25 + rand() * 0.05,
          0.15 + rand() * 0.17,
          0.48 + rand() * 0.17,
        ),
    });
  }
  for (const [x, z, s] of [
    [-352, 625, 1.6],
    [-365, 600, 1.7],
    [-380, 580, 1.5],
  ])
    trees.push({ x, z, y: height(x, z), s, a: rand() * 6.28 });
  await scannedForest(scene, manager, trees, time);
  const loader = new GLTFLoader(manager);
  const models = await Promise.all(
    ["fir_sapling", "boulder_01", "fern_02", "dead_tree_trunk"].map((id) =>
      loader.loadAsync(`/assets/${id}/${id}.gltf`),
    ),
  );
  // Photogrammetry assets use their original PBR textures. Scanned saplings are reserved for foreground detail.
  function scatterModel(root, positions, onlyFirst = false) {
    root.updateMatrixWorld(true);
    let meshes = [];
    root.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
    if (onlyFirst) {
      const first = root.children[0];
      meshes = [];
      first.traverse((o) => {
        if (o.isMesh) meshes.push(o);
      });
    }
    for (const mesh of meshes) {
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      const mat = mesh.material.clone();
      mat.envMapIntensity = 0.65;
      addInstances(scene, g, mat, positions, true);
    }
  }
  const saplings = [];
  for (let i = 0; i < 24; i++) {
    const x = -360 + (rand() - 0.5) * 170,
      z = 660 + (rand() - 0.5) * 170,
      y = height(x, z);
    if (y > 27 && !inCameraCorridor(x, z, 8))
      saplings.push({ x, y, z, s: 2 + rand() * 3, a: rand() * 6.28 });
  }
  scatterModel(models[0].scene, saplings, true);
  const rocks = [];
  for (let i = 0; i < 180; i++) {
    const a = rand() * 6.28,
      r = 1.015 + rand() * 0.16,
      x = Math.cos(a) * 480 * r,
      z = Math.sin(a) * 730 * r,
      y = height(x, z);
    if (y > 20 && !inCameraCorridor(x, z, 8))
      rocks.push({ x, y: y - 0.5, z, s: 0.5 + rand() * 2.7, a: rand() * 6.28 });
  }
  scatterModel(models[1].scene, [
    ...rocks.slice(0, 14),
    { x: -338, z: 648, y: height(-338, 648) - 0.5, s: 3.0, a: 2.4 },
    { x: -346, z: 636, y: height(-346, 636) - 0.4, s: 1.7, a: 1.1 },
  ]);
  const rockMesh = models[1].scene.children[0];
  const smallRock = new THREE.IcosahedronGeometry(1, 1);
  const pp = smallRock.attributes.position;
  for (let i = 0; i < pp.count; i++)
    pp.setXYZ(
      i,
      pp.getX(i) * (0.8 + rand() * 0.4),
      pp.getY(i) * 0.65,
      pp.getZ(i),
    );
  smallRock.computeVertexNormals();
  addInstances(scene, smallRock, rockMesh.material, rocks, false);
  const ferns = [];
  for (let i = 0; i < 160; i++) {
    const x = -350 + (rand() - 0.5) * 220,
      z = 690 + (rand() - 0.5) * 140,
      y = height(x, z);
    if (y > 26 && slope(x, z) < 0.5)
      ferns.push({ x, y, z, s: 1.2 + rand() * 2, a: rand() * 6.28 });
  }
  scatterModel(models[2].scene, ferns, true);
  scatterModel(models[3].scene, [
    { x: -385, z: 610, y: height(-385, 610), s: 1.4, a: 1.8 },
    { x: 410, z: 550, y: height(410, 550), s: 1, a: 2.7 },
  ]);
  const blade = new THREE.BufferGeometry();
  blade.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.035, 0, 0, 0.035, 0, 0, 0.025, 0.45, 0.025, -0.025, 0.45, 0.025,
        0.06, 0.95, 0.1,
      ],
      3,
    ),
  );
  blade.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
  blade.computeVertexNormals();
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xb6a67a,
    side: THREE.DoubleSide,
    roughness: 1,
  });
  grassMat.onBeforeCompile = (s) => {
    s.uniforms.uTime = time;
    s.vertexShader = "uniform float uTime;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
 vec3 base=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz; transformed.x+=sin(uTime*1.7+base.x*.4+base.z*.25)*position.y*position.y*.18;`,
    );
  };
  const grasses = [];
  for (let i = 0; i < 80000; i++) {
    const center = i < 62000 ? [-330, 670] : [400, 565],
      spread = i < 48000 ? 55 : 150,
      x = center[0] + (rand() - 0.5) * spread,
      z = center[1] + (rand() - 0.5) * spread,
      y = height(x, z);
    if (y < 25 || slope(x, z) > 0.6) continue;
    grasses.push({
      x,
      y,
      z,
      s: 0.55 + rand() * 0.85,
      a: rand() * 6.28,
      color: new THREE.Color().setHSL(
        0.16 + rand() * 0.08,
        0.35,
        0.36 + rand() * 0.24,
      ),
    });
  }
  addInstances(scene, blade, grassMat, grasses, false);
  return {
    trees,
    counts: {
      trees: trees.length,
      grass: grasses.length,
      saplings: saplings.length,
      rocks: rocks.length,
      ferns: ferns.length,
    },
  };
}
