import * as THREE from "three/webgpu";
import {
  Fn,
  texture,
  positionWorld,
  cameraPosition,
  vec2,
  vec3,
  vec4,
  float,
  uniform,
  reflector,
  reflect,
  normalize,
  mix,
  smoothstep,
  sin,
  screenUV,
  viewportTexture,
  If,
  Discard,
} from "three/tsl";
import { makeHeightTexture } from "./terrain.js";
import { random, LAKE, WORLD } from "./math.js";
function normals() {
  const n = 256,
    d = new Uint8Array(n * n * 4),
    rand = random(28),
    waves = Array.from({ length: 22 }, (_, i) => ({
      x: Math.round((rand() - 0.5) * 70),
      y: Math.round((rand() - 0.5) * 70),
      p: rand() * 6.28,
      a: 0.055 / (1 + i * 0.18),
    }));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let dx = 0,
        dy = 0;
      for (const w of waves) {
        const f =
            Math.cos(
              (x / n) * Math.PI * 2 * w.x + (y / n) * Math.PI * 2 * w.y + w.p,
            ) * w.a,
          l = Math.hypot(w.x, w.y) || 1;
        dx += (f * w.x) / l;
        dy += (f * w.y) / l;
      }
      const v = new THREE.Vector3(dx, dy, 1).normalize(),
        i = (y * n + x) * 4;
      d[i] = v.x * 127 + 128;
      d[i + 1] = v.y * 127 + 128;
      d[i + 2] = v.z * 127 + 128;
      d[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(d, n, n);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
export function createWater(scene, time, sunDirection, ultra) {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2100, 2100), material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = LAKE;
  water.renderOrder = 2;
  const mirror = reflector({
    resolutionScale: ultra ? 0.75 : 0.4,
    bounces: false,
    samples: 1,
  });
  water.add(mirror.target);
  const nTex = normals(),
    p = positionWorld,
    ground = texture(makeHeightTexture(), p.xz.div(WORLD).add(0.5)).r,
    depth = float(LAKE).sub(ground).max(0);
  const n1 = texture(
      nTex,
      p.xz.mul(0.018).add(vec2(time.mul(0.004), time.mul(0.002))),
    )
      .xyz.mul(2)
      .sub(1),
    n2 = texture(
      nTex,
      p.xz.mul(0.041).add(vec2(time.mul(-0.003), time.mul(0.005))),
    )
      .xyz.mul(2)
      .sub(1);
  const wave = n1.add(n2.mul(0.45));
  const normal = vec3(wave.x, 1, wave.y).normalize(),
    eye = cameraPosition.sub(p).normalize();
  const fresnel = float(0.025).add(
    float(1).sub(eye.dot(normal).max(0)).pow(5).mul(0.975),
  );
  const distortion = wave.xy.mul(0.006).mul(smoothstep(0.1, 4, depth));
  mirror.uvNode = mirror.uvNode.add(distortion);
  const transmitted = viewportTexture(screenUV.add(distortion.mul(0.22))).rgb;
  const deep = vec3(0.018, 0.105, 0.085),
    absorption = depth.mul(-0.2).exp();
  const body = mix(deep, transmitted.mul(vec3(0.65, 0.91, 0.79)), absorption);
  const shine = reflect(uniform(sunDirection).negate(), normal)
    .dot(eye)
    .max(0)
    .pow(380)
    .mul(vec3(3.0, 2.2, 1.25));
  const edge = smoothstep(0.02, 0.38, depth).mul(
    smoothstep(0.4, 1.3, depth).oneMinus(),
  );
  const ripples = sin(depth.mul(11).sub(time.mul(1.7)).add(p.x.mul(0.3)))
    .mul(0.5)
    .add(0.5)
    .pow(7)
    .mul(edge)
    .mul(0.06);
  material.colorNode = mix(body, mirror.rgb, fresnel)
    .add(shine)
    .add(vec3(0.65, 0.71, 0.6).mul(ripples));
  material.opacityNode = smoothstep(0, 0.18, depth);
  scene.add(water);
  return { mesh: water, mirror };
}
