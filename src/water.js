import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { terrainHeightTexture } from "./terrain.js";
import { LAKE, random } from "./math.js";
function rippleNormals() {
  const n = 256,
    d = new Uint8Array(n * n * 4),
    rand = random(28),
    waves = Array.from({ length: 28 }, (_, i) => ({
      x: Math.round((rand() - 0.5) * 80),
      y: Math.round((rand() - 0.5) * 80),
      p: rand() * 6.28,
      a: 0.08 / (1 + i * 0.18),
    }));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2,
        v = (y / n) * Math.PI * 2;
      let dx = 0,
        dy = 0;
      for (const w of waves) {
        const len = Math.hypot(w.x, w.y) || 1;
        const q = Math.cos(u * w.x + v * w.y + w.p) * w.a;
        dx += (q * w.x) / len;
        dy += (q * w.y) / len;
      }
      const normal = new THREE.Vector3(dx, dy, 1).normalize();
      let i = (y * n + x) * 4;
      d[i] = normal.x * 127 + 128;
      d[i + 1] = normal.y * 127 + 128;
      d[i + 2] = normal.z * 127 + 128;
      d[i + 3] = 255;
    }
  const t = new THREE.DataTexture(d, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
export function createWater(scene, sun, capture) {
  const water = new Water(new THREE.PlaneGeometry(2250, 2250), {
    textureWidth: capture ? 1536 : 1024,
    textureHeight: capture ? 1536 : 1024,
    waterNormals: rippleNormals(),
    sunDirection: sun,
    sunColor: 0xffd6a0,
    waterColor: 0x17433b,
    distortionScale: 0.48,
    alpha: 1,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = LAKE;
  water.material.uniforms.size.value = 1.8;
  water.material.uniforms.terrainMap = { value: terrainHeightTexture() };
  water.material.fragmentShader =
    "uniform sampler2D terrainMap;\n" + water.material.fragmentShader;
  water.material.fragmentShader = water.material.fragmentShader.replace(
    "vec3 outgoingLight = albedo;",
    `
 float ground=texture2D(terrainMap,worldPosition.xz/2400.+.5).r;
 float depth=22.-ground;
 if(depth<0.)discard;
 vec3 shallows=vec3(.12,.24,.19)*( .85+.15*sin(worldPosition.x*.7)*sin(worldPosition.z*.5));
 albedo=mix(shallows*.65+reflectionSample*.35,albedo,smoothstep(0.,7.,depth));
 float edge=(1.-smoothstep(.05,.65,depth))*.13;
 albedo+=edge*vec3(.65,.68,.53);
 vec3 outgoingLight = albedo;
 `,
  );
  scene.add(water);
  return {
    mesh: water,
    update: (t) => (water.material.uniforms.time.value = t * 0.32),
  };
}
