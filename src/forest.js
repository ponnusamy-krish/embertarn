import * as THREE from "three/webgpu";
import {
  positionLocal,
  attribute,
  vec3,
  vec4,
  sin,
  float,
  instanceIndex,
} from "three/tsl";
import { random, height, slope, noise, fbm, lakeRadius } from "./math.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { inCameraCorridor } from "./cinematic.js";
function needleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const c = canvas.getContext("2d"),
    rand = random(38);
  c.strokeStyle = "#56643b";
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(256, 1018);
  c.bezierCurveTo(250, 700, 264, 300, 256, 10);
  c.stroke();
  for (let row = 0; row < 26; row++) {
    const y = 32 + row * 36,
      l = (24 + Math.sin((row / 28) * Math.PI) * 175) * (0.78 + rand() * 0.22);
    for (const side of [-1, 1]) {
      const ex = 256 + side * l,
        ey = y - 40;
      c.lineWidth = 3;
      c.strokeStyle = "#3d4c2b";
      c.beginPath();
      c.moveTo(256, y + 10);
      c.lineTo(ex, ey);
      c.stroke();
      for (let j = 0; j < 14; j++) {
        const f = j / 14,
          x = 256 + (ex - 256) * f,
          yy = y + 10 + (ey - y - 10) * f;
        c.lineWidth = 2.0;
        c.strokeStyle = ["#415a2f", "#5c713b", "#7b8649", "#344928"][
          Math.floor(rand() * 4)
        ];
        for (const sign of [-1, 1]) {
          c.beginPath();
          c.moveTo(x, yy);
          c.lineTo(x + side * (6 + rand() * 6) * sign, yy - 8 - rand() * 12);
          c.stroke();
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
function canopy(detail, variant) {
  const rand = random(120 + variant),
    p = [],
    uvs = [],
    idx = [];
  const tiers = [18, 12, 8][detail],
    branches = [8, 6, 5][detail],
    sprays = [5, 3, 2][detail];
  function card(center, axis, width, length, roll) {
    const up = new THREE.Vector3(0, 1, 0);
    let side = new THREE.Vector3().crossVectors(axis, up).normalize();
    if (side.length() < 0.1) side.set(1, 0, 0);
    const across = side
      .clone()
      .multiplyScalar(Math.cos(roll))
      .add(up.clone().multiplyScalar(Math.sin(roll)))
      .multiplyScalar(width);
    const tip = center.clone().addScaledVector(axis, length);
    const base = center.clone().addScaledVector(axis, -length * 0.18);
    const points = [
      base.clone().sub(across),
      tip.clone().addScaledVector(across, -0.75),
      tip.clone().addScaledVector(across, 0.75),
      base.clone().add(across),
    ];
    const i = p.length / 3;
    for (const v of points) p.push(v.x, v.y, v.z);
    uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  for (let t = 0; t < tiers; t++) {
    const u = t / (tiers - 1),
      y = 3 + u * 18,
      r = (1 - u) * 4.2 + 0.18;
    for (let b = 0; b < branches; b++) {
      const a = (b / branches) * Math.PI * 2 + t * 2.39 + rand() * 0.28,
        axis = new THREE.Vector3(
          Math.cos(a),
          -0.14 + u * 0.4,
          Math.sin(a),
        ).normalize();
      for (let j = 0; j < sprays; j++) {
        const f = 0.12 + (j / sprays) * 0.88,
          center = new THREE.Vector3(0, y, 0).addScaledVector(axis, r * f);
        const length = 0.45 + r * 0.29;
        const twig = axis
          .clone()
          .applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            (j % 2 === 0 ? 1 : -1) * 0.42,
          );
        card(center, twig, 0.14 + length * 0.22, length, rand() * 0.55);
        card(
          center,
          twig,
          0.13 + length * 0.2,
          length * 0.95,
          1.15 + rand() * 0.3,
        );
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function crownCore(variant) {
  const rand = random(820 + variant),
    pieces = [];
  for (let j = 0; j < 10; j++) {
    const u = j / 10,
      r = (1 - u) * 2.7 + 0.08,
      g = new THREE.ConeGeometry(r, 3.8 - u, 7, 1);
    g.translate(0, 3.1 + j * 1.75, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)),
        f = 0.84 + 0.17 * Math.sin(a * 5 + j * 1.7) + rand() * 0.07;
      p.setXYZ(
        i,
        p.getX(i) * f,
        p.getY(i) + Math.sin(a * 3 + j) * 0.13,
        p.getZ(i) * f,
      );
    }
    g.computeVertexNormals();
    pieces.push(g);
  }
  return mergeGeometries(pieces);
}
export async function createForest(scene, manager, time) {
  const atlas = needleTexture(),
    bark = await new THREE.TextureLoader(manager).loadAsync(
      "/assets/fir_sapling/textures/fir_sapling_branches_diff_1k.jpg",
    );
  bark.colorSpace = THREE.SRGBColorSpace;
  bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
  bark.repeat.set(1, 5);
  const foliage = new THREE.MeshStandardNodeMaterial({
    map: atlas,
    alphaTest: 0.18,
    side: THREE.DoubleSide,
    roughness: 0.91,
    envMapIntensity: 0.22,
    color: 0xd3d4ab,
  });
  const sway = sin(
    time
      .mul(0.8)
      .add(attribute("position").y.mul(0.4))
      .add(instanceIndex.toFloat().mul(0.73)),
  )
    .mul(attribute("position").y.div(22).pow(2))
    .mul(0.13);
  foliage.positionNode = positionLocal.add(vec3(sway, 0, sway.mul(0.4)));
  const coreMat = new THREE.MeshStandardNodeMaterial({
    color: 0x283b20,
    roughness: 1,
    envMapIntensity: 0.25,
  });
  coreMat.positionNode = foliage.positionNode;
  const cores = [0, 1, 2].map(crownCore);
  const barkMat = new THREE.MeshStandardNodeMaterial({
    map: bark,
    color: 0x8e8474,
    roughness: 1,
  });
  const trunk = new THREE.CylinderGeometry(0.055, 0.34, 22, 6, 4);
  trunk.translate(0, 11, 0);
  const farMaps = await Promise.all(
    [0, 1, 2].map(async (i) => {
      const t = await new THREE.TextureLoader(manager).loadAsync(
        `/assets/fir-impostor-${i}.png`,
      );
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return new THREE.MeshBasicNodeMaterial({
        map: t,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        color: 0xc4d1ac,
      });
    }),
  );
  const cross = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(12, 23);
    g.translate(0, 11.1, 0);
    g.rotateY((i * Math.PI) / 3);
    const n = g.attributes.normal;
    for (let j = 0; j < n.count; j++) n.setXYZ(j, 0, 1, 0);
    cross.push(g);
  }
  const farGeo = mergeGeometries(cross);
  const geos = [0, 1, 2].map((d) => [0, 1, 2].map((v) => canopy(d, v))),
    rand = random(221),
    trees = [],
    buckets = new Map();
  for (let i = 0; i < 145000; i++) {
    const x = (rand() - 0.5) * 3400,
      z = (rand() - 0.5) * 3550,
      y = height(x, z),
      r = lakeRadius(x, z),
      s = slope(x, z);
    const cluster = fbm(x * 0.007 + 30, z * 0.007 - 20, 3);
    const density = 0.2 + Math.pow(cluster, 1.2) * 1.2;
    if (
      y < 25.2 ||
      y > 410 ||
      r < 1.024 ||
      s > 0.88 ||
      inCameraCorridor(x, z, 12) ||
      rand() > density * (1 - y / 620)
    )
      continue;
    // Preserve the main view while allowing trees to frame the shore.
    if (x > -365 && x < -270 && z > 550 && z < 705) continue;
    const scale = (0.65 + rand() * 1.05) * (1 - smoothHeight(y));
    const tree = {
      x,
      y: y - 0.38,
      z,
      s: scale,
      a: rand() * Math.PI * 2,
      color: new THREE.Color().setHSL(
        0.23 + rand() * 0.045,
        0.12 + rand() * 0.12,
        0.65 + rand() * 0.22,
      ),
    };
    trees.push(tree);
  }
  for (const [x, z, s] of [
    [-355, 625, 1.4],
    [-370, 600, 1.3],
    [-400, 570, 1.65],
  ])
    if (height(x, z) > 25)
      trees.push({
        x,
        z,
        y: height(x, z) - 0.4,
        s,
        a: 1,
        color: new THREE.Color(0.8, 0.85, 0.7),
      });
  for (const t of trees) {
    const key = `${Math.floor(t.x / 260)},${Math.floor(t.z / 260)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }
  const chunks = [],
    dummy = new THREE.Object3D();
  let n = 0;
  for (const list of buckets.values()) {
    const variant = n++ % 3;
    const core = new THREE.InstancedMesh(cores[variant], coreMat, list.length);
    const leaves = new THREE.InstancedMesh(
        geos[2][variant],
        foliage,
        list.length,
      ),
      trunks = new THREE.InstancedMesh(trunk, barkMat, list.length);
    list.forEach((v, i) => {
      v.width = 0.85 + (i % 5) * 0.08;
      v.draw = { leaves, trunks, core, index: i };
      dummy.position.set(v.x, v.y, v.z);
      dummy.rotation.y = v.a;
      dummy.scale.set(
        v.s * (0.85 + (i % 5) * 0.08),
        v.s,
        v.s * (0.85 + (i % 5) * 0.08),
      );
      dummy.updateMatrix();
      core.setMatrixAt(i, dummy.matrix);
      core.setColorAt(i, v.color);
      leaves.setMatrixAt(i, dummy.matrix);
      trunks.setMatrixAt(i, dummy.matrix);
      leaves.setColorAt(i, v.color);
    });
    core.receiveShadow = true;
    core.computeBoundingSphere();
    scene.add(core);
    leaves.receiveShadow = true;
    trunks.receiveShadow = true;
    leaves.computeBoundingSphere();
    trunks.computeBoundingSphere();
    scene.add(leaves, trunks);
    chunks.push({
      leaves,
      trunks,
      core,
      variant,
      center: leaves.boundingSphere.center.clone(),
      level: -1,
    });
  }
  const scan = await new GLTFLoader(manager).loadAsync(
    "/assets/fir-tree-lod.glb",
  );
  scan.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scan.scene),
    factor = 22 / (bounds.max.y - bounds.min.y),
    realMeshes = [];
  scan.scene.children[0].traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.translate(0, -bounds.min.y, 0);
    g.scale(factor, factor, factor);
    const m = new THREE.MeshStandardNodeMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, o.material);
    m.envMapIntensity = 0.35;
    const mesh = new THREE.InstancedMesh(g, m, 4);
    mesh.count = 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    realMeshes.push(mesh);
  });
  const proxyMat = new THREE.MeshBasicNodeMaterial({
    depthWrite: false,
    colorWrite: false,
  });
  const proxy = new THREE.InstancedMesh(
    mergeGeometries([cores[0], trunk]),
    proxyMat,
    4,
  );
  proxy.count = 0;
  proxy.castShadow = true;
  proxy.frustumCulled = false;
  scene.add(proxy);
  realMeshes.push(proxy);
  let realTrees = [],
    previous = new THREE.Vector3(Infinity, Infinity, Infinity),
    previousRotation = new THREE.Quaternion();
  function writeTree(t, hide = false) {
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.y = t.a;
    dummy.scale.set(
      hide ? 0 : t.s * t.width,
      hide ? 0 : t.s,
      hide ? 0 : t.s * t.width,
    );
    dummy.updateMatrix();
    for (const m of [t.draw.leaves, t.draw.trunks, t.draw.core]) {
      m.setMatrixAt(t.draw.index, dummy.matrix);
      m.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    trees,
    counts: {
      trees: trees.length,
      forestChunks: chunks.length,
      scannedTreeLOD: 4,
    },
    update(camera, force = false) {
      if (
        force ||
        previous.distanceTo(camera.position) > 10 ||
        previousRotation.angleTo(camera.quaternion) > 0.12
      ) {
        previous.copy(camera.position);
        previousRotation.copy(camera.quaternion);
        const forward = camera.getWorldDirection(new THREE.Vector3());
        for (const t of realTrees) writeTree(t);
        realTrees = trees
          .map((t) => ({
            t,
            d: Math.hypot(
              camera.position.x - t.x,
              camera.position.z - t.z,
              camera.position.y - t.y - 10,
            ),
          }))
          .filter(
            (v) =>
              v.d < 140 &&
              (v.t.x - camera.position.x) * forward.x +
                (v.t.z - camera.position.z) * forward.z +
                (v.t.y + 12 - camera.position.y) * forward.y >
                0,
          )
          .sort((a, b) => a.d - b.d)
          .slice(0, 4)
          .map((v) => v.t);
        for (const m of realMeshes) m.count = realTrees.length;
        realTrees.forEach((t, i) => {
          writeTree(t, true);
          dummy.position.set(t.x, t.y, t.z);
          dummy.rotation.y = t.a;
          dummy.scale.setScalar(t.s);
          dummy.updateMatrix();
          for (const m of realMeshes) {
            m.setMatrixAt(i, dummy.matrix);
            m.instanceMatrix.needsUpdate = true;
          }
        });
      }
      for (const c of chunks) {
        const d = Math.hypot(
          camera.position.x - c.center.x,
          camera.position.z - c.center.z,
        );
        const level = d < 260 ? 0 : d < 520 ? 1 : 2;
        if (level !== c.level) {
          c.leaves.geometry = level === 2 ? farGeo : geos[level][c.variant];
          c.leaves.material = level === 2 ? farMaps[c.variant] : foliage;
          c.level = level;
        }
        c.core.visible = level === 1;
        c.trunks.visible = level !== 2;
        c.core.castShadow = d < 500;
        c.leaves.castShadow = d < 500;
        c.trunks.castShadow = d < 500;
      }
    },
  };
}
function smoothHeight(y) {
  return Math.max(0, (y - 220) / 700);
}
