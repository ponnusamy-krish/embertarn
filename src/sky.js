import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { random, LAKE } from "./math.js";
export async function createSky(scene, renderer, manager) {
  const hdr = await new HDRLoader(manager).loadAsync(
    "/assets/qwantani_sunset.hdr",
  );
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  // Locate the sun directly in the HDR so the key light and reflected disk agree.
  const { data, width, height } = hdr.image;
  let best = -1,
    bx = 0,
    by = 0;
  for (let y = 0; y < height * 0.65; y += 2)
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const lum =
        THREE.DataUtils.fromHalfFloat(data[i]) +
        THREE.DataUtils.fromHalfFloat(data[i + 1]) +
        THREE.DataUtils.fromHalfFloat(data[i + 2]);
      if (lum > best) {
        best = lum;
        bx = x;
        by = y;
      }
    }
  const phi = (bx / width - 0.5) * Math.PI * 2,
    latitude = (0.5 - by / height) * Math.PI;
  const original = new THREE.Vector3(
    Math.cos(phi) * Math.cos(latitude),
    Math.sin(latitude),
    Math.sin(phi) * Math.cos(latitude),
  );
  const desiredAngle = -2.25,
    rotation = phi - desiredAngle;
  const sunDirection = original
    .clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
  sunDirection.y = Math.max(0.12, sunDirection.y);
  sunDirection.normalize();
  scene.background = hdr;
  scene.backgroundRotation.y = rotation;
  scene.backgroundIntensity = 0.7;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentRotation.y = rotation;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  scene.fog = new THREE.FogExp2(0x9fa9a3, 0.000045);
  const sun = new THREE.DirectionalLight(0xffd3a0, 3.1);
  sun.position.copy(sunDirection).multiplyScalar(1000);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190;
  sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190;
  sun.shadow.camera.bottom = -190;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 2200;
  sun.shadow.normalBias = 1.0;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xa7c5cf, 0x62523c, 0.55));
  const disk = new THREE.Mesh(
    new THREE.SphereGeometry(12, 20, 12),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(4, 2.9, 1.6),
      transparent: true,
      depthWrite: false,
    }),
  );
  disk.position.copy(sunDirection).multiplyScalar(5000);
  scene.add(disk);
  const rand = random(98),
    birds = [];
  const wing = new THREE.BufferGeometry();
  wing.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0, 1.7, 0.1, -0.25, 0.35, 0, 0.4, 0, 0, 0, -1.7, 0.1, -0.25,
        -0.35, 0, 0.4,
      ],
      3,
    ),
  );
  wing.computeVertexNormals();
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(
      wing,
      new THREE.MeshBasicMaterial({ color: 0x242c29, side: THREE.DoubleSide }),
    );
    b.userData.phase = rand() * 6.28;
    b.userData.radius = 110 + rand() * 160;
    scene.add(b);
    birds.push(b);
  }
  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 1350),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float uTime;void main(){vec2 p=(vUv-.5)*2.;float edge=1.-smoothstep(.3,1.,length(p));float n=sin(p.x*18.+p.y*9.+uTime*.03)*sin(p.y*23.-uTime*.02)*.5+.5;gl_FragColor=vec4(.75,.79,.73,edge*n*.055);}`,
    }),
  );
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = LAKE + 3;
  scene.add(mist);
  return {
    sunDirection,
    sun,
    disk,
    update(t, camera) {
      mist.material.uniforms.uTime.value = t;
      birds.forEach((b, i) => {
        const a = t * 0.035 + b.userData.phase;
        b.position.set(
          Math.cos(a) * b.userData.radius,
          130 + i * 9 + Math.sin(a * 2) * 15,
          Math.sin(a) * b.userData.radius - 140,
        );
        b.rotation.set(0, -a, Math.sin(t * 2.2 + i) * 0.12);
        b.scale.y = 0.5 + Math.sin(t * 3 + i) * 0.45;
      });
      sun.target.position.set(camera.position.x, 0, camera.position.z);
      sun.position
        .copy(sun.target.position)
        .addScaledVector(sunDirection, 1100);
      sun.target.updateMatrixWorld();
    },
  };
}
