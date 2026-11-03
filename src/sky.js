import * as THREE from "three/webgpu";
import {
  uniform,
  positionWorld,
  positionView,
  cameraPosition,
  float,
  vec3,
  fog,
  exp,
  mx_fractal_noise_float,
  smoothstep,
  uv,
  mix,
} from "three/tsl";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { CSMShadowNode } from "three/addons/csm/CSMShadowNode.js";

import { random, LAKE } from "./math.js";
export async function createSky(scene, renderer, manager, time, ultra) {
  const hdr = await new HDRLoader(manager).loadAsync(
    "/assets/industrial_sunset_02_puresky.hdr",
  );
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.45;
  const direction = new THREE.Vector3(-0.85, 0.22, 0.48).normalize();
  // Rotate the HDR environment so its brightest source agrees with the analytic sky sun.
  const { data, width, height } = hdr.image;
  let peak = 0,
    bx = 0;
  for (let y = 0; y < height * 0.7; y += 4)
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4,
        energy =
          THREE.DataUtils.fromHalfFloat(data[i]) +
          THREE.DataUtils.fromHalfFloat(data[i + 1]) +
          THREE.DataUtils.fromHalfFloat(data[i + 2]);
      if (energy > peak) {
        peak = energy;
        bx = x;
      }
    }
  scene.environmentRotation.y =
    (bx / width - 0.5) * Math.PI * 2 - Math.atan2(direction.z, direction.x);
  pmrem.dispose();
  scene.background = hdr;
  scene.backgroundRotation.copy(scene.environmentRotation);
  scene.backgroundIntensity = 0.8;
  const sun = new THREE.DirectionalLight(0xffe3bd, 3.2);
  sun.position.copy(direction).multiplyScalar(1600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(ultra ? 2048 : 1024, ultra ? 2048 : 1024);
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.65;
  sun.shadow.radius = 2;
  sun.shadow.camera.far = 3500;
  const csm = new CSMShadowNode(sun, {
    cascades: 3,
    maxFar: 1600,
    mode: "practical",
    lightMargin: 900,
  });
  csm.fade = true;
  sun.shadow.shadowNode = csm;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xa3bdcf, 0x564632, 0.45));
  const shaftSun = new THREE.DirectionalLight(0xffc78d, 0.015);
  shaftSun.castShadow = true;
  shaftSun.position.copy(direction).multiplyScalar(1400);
  shaftSun.shadow.mapSize.set(512, 512);
  Object.assign(shaftSun.shadow.camera, {
    left: -900,
    right: 900,
    top: 900,
    bottom: -900,
    near: 1,
    far: 3300,
  });
  shaftSun.shadow.bias = -0.001;
  scene.add(shaftSun, shaftSun.target);
  const d = positionView.z.negate(),
    low = positionWorld.y.sub(LAKE).max(0).mul(-0.009).exp();
  const aerial = d
    .mul(0.000025)
    .add(d.mul(0.000035).mul(low))
    .negate()
    .exp()
    .oneMinus();
  scene.fogNode = fog(vec3(0.48, 0.56, 0.6), aerial.clamp(0, 0.65));
  const mistMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mist = mx_fractal_noise_float(
    positionWorld.xz.mul(0.007).add(time.mul(0.006)),
    3,
  )
    .mul(0.5)
    .add(0.5);
  mistMat.colorNode = vec3(0.64, 0.69, 0.62);
  mistMat.opacityNode = smoothstep(0.4, 0.75, mist)
    .mul(smoothstep(0.25, 0.5, uv().sub(0.5).length()).oneMinus())
    .mul(0.085);
  const mistPlane = new THREE.Mesh(new THREE.PlaneGeometry(850, 1300), mistMat);
  mistPlane.rotation.x = -Math.PI / 2;
  mistPlane.position.y = 25;
  scene.add(mistPlane);
  const birds = [],
    rand = random(35);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 1.8, 0.15, -0.35, 0.4, 0, 0.35, 0, 0, 0, -1.8, 0.15, -0.35,
        -0.4, 0, 0.35,
      ],
      3,
    ),
  );
  g.computeVertexNormals();
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(
      g,
      new THREE.MeshBasicNodeMaterial({
        color: 0x283029,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(b);
    birds.push({ mesh: b, phase: rand() * 6.28, radius: 120 + rand() * 170 });
  }
  return {
    sun,
    csm,
    shaftSun,
    direction,
    update(t, camera) {
      scene.backgroundRotation.y = scene.environmentRotation.y + t * 0.000006;
      birds.forEach((b, i) => {
        const a = t * 0.032 + b.phase;
        b.mesh.position.set(
          Math.cos(a) * b.radius,
          120 + i * 12 + Math.sin(a * 2) * 8,
          Math.sin(a) * b.radius - 100,
        );
        b.mesh.rotation.set(0, -a, Math.sin(t * 2.8 + i) * 0.15);
      });
      shaftSun.target.position.set(camera.position.x, 30, camera.position.z);
      shaftSun.position
        .copy(shaftSun.target.position)
        .addScaledVector(direction, 1400);
    },
  };
}
