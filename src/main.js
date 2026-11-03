import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import "./style.css";
import { height } from "./math.js";
import { loadSurfaces, createTerrain } from "./terrain.js";
import { createWater } from "./water.js";
import { createVegetation } from "./vegetation.js";
import { createSky } from "./sky.js";
import { createPost } from "./post.js";
import { updateTour, tourPose } from "./cinematic.js";
const params = new URLSearchParams(location.search),
  capture = params.get("capture") === "1";
let cinematic = params.get("cinematic") === "1";
if (capture) document.body.classList.add("capture");
window.__ready = false;
window.__errors = [];
const canvas = document.querySelector("#world");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
  preserveDrawingBuffer: capture,
});
renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Avoid driver dithering that can change the last output bit between identical frames.
renderer.getContext().disable(renderer.getContext().DITHER);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.5, 8000);
camera.position.set(-330, height(-330, 670) + 5, 670);
camera.lookAt(0, 170, -650);
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  document.querySelector("#progress").style.width = `${(loaded / total) * 90}%`;
  document.querySelector("#load-detail").textContent =
    `Loading natural materials - ${loaded} / ${total}`;
};
manager.onError = (url) => {
  window.__errors.push("Asset failed: " + url);
  console.error("Asset failed:", url);
};
const timeUniform = { value: 0 },
  keys = new Set(),
  controls = new PointerLockControls(camera, canvas);
let elapsed = 0,
  last = 0,
  tourStart = 0;
function toggleCinematic() {
  cinematic = !cinematic;
  tourStart = elapsed;
  controls.unlock();
  document.body.classList.toggle("cinematic", cinematic);
}
document.querySelector("#enter").onclick = () => {
  cinematic = false;
  controls.lock();
};
document.querySelector("#cinema").onclick = toggleCinematic;
controls.addEventListener("lock", () => document.body.classList.add("locked"));
controls.addEventListener("unlock", () =>
  document.body.classList.remove("locked"),
);
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyC" && !e.repeat) toggleCinematic();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
try {
  const [surfaces, sky] = await Promise.all([
    loadSurfaces(manager),
    createSky(scene, renderer, manager),
  ]);
  createTerrain(scene, surfaces);
  const water = createWater(scene, sky.sunDirection, capture);
  const vegetation = await createVegetation(
    scene,
    surfaces,
    manager,
    timeUniform,
  );
  window.__sceneStats = vegetation.counts;
  window.__tourCollisionCheck = () => {
    let groundMargin = Infinity,
      treeMargin = Infinity;
    for (let t = 0; t < 300; t += 0.25) {
      const p = tourPose(t).position;
      groundMargin = Math.min(groundMargin, p.y - height(p.x, p.z));
      for (const tree of vegetation.trees) {
        if (p.y < tree.y + 21 * tree.s && p.y > tree.y - 1)
          treeMargin = Math.min(
            treeMargin,
            Math.hypot(p.x - tree.x, p.z - tree.z) - 5 * tree.s,
          );
      }
    }
    return { groundMargin, treeMargin };
  };
  const composer = createPost(renderer, scene, camera, sky.disk, capture);
  function render(t, dt = 0) {
    timeUniform.value = t;
    water.update(t);
    if (cinematic) {
      document.querySelector("#shot-label").textContent = updateTour(
        camera,
        capture ? t : t - tourStart,
      );
    } else if (!capture && controls.isLocked) {
      const speed = (keys.has("ShiftLeft") ? 95 : 24) * dt;
      controls.moveForward(
        ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) * speed,
      );
      controls.moveRight(
        ((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0)) * speed,
      );
      camera.position.y +=
        ((keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0)) * speed;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2100, 2100);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2100, 2100);
      camera.position.y = Math.max(
        camera.position.y,
        height(camera.position.x, camera.position.z) + 3,
        25,
      );
      for (const tree of vegetation.trees) {
        const dx = camera.position.x - tree.x,
          dz = camera.position.z - tree.z,
          d = Math.hypot(dx, dz);
        if (d < 2 && camera.position.y < tree.y + 18 * tree.s) {
          camera.position.x += (dx / (d || 1)) * (2 - d);
          camera.position.z += (dz / (d || 1)) * (2 - d);
        }
      }
    }
    camera.updateMatrixWorld();
    sky.update(t, camera);
    composer.render(0);
  }
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    if (capture && window.__ready) render(elapsed);
  });
  window.__renderFrame = async (t) => {
    if (!Number.isFinite(t) || t < 0)
      throw new Error("Frame time must be finite nonnegative seconds");
    elapsed = t;
    window.__captureTime = t;
    // Settle reflection/shadow dependencies after arbitrary time and camera seeks.
    for (let settle = 0; settle < 2; settle++) render(t);
    renderer.getContext().finish();
  };
  window.__setMode = (mode) => {
    cinematic = mode === "cinematic";
  };
  window.__cameraPosition = () => camera.position.toArray();
  window.__tourPose = (t) => {
    const p = tourPose(t);
    return {
      position: p.position.toArray(),
      ground: height(p.position.x, p.position.z),
    };
  };
  document.querySelector("#load-detail").textContent =
    "Warming light, reflections and shaders";
  await renderer.compileAsync(scene, camera);
  render(cinematic ? 0 : 12);
  await new Promise((r) => requestAnimationFrame(r));
  render(cinematic ? 0 : 12);
  renderer.getContext().finish();
  window.__ready = true;
  document.body.classList.toggle("cinematic", cinematic);
  document.querySelector("#loading").style.opacity = 0;
  setTimeout(() => document.querySelector("#loading").remove(), 900);
  if (!capture)
    renderer.setAnimationLoop((ms) => {
      const dt = last ? Math.min((ms - last) / 1000, 0.05) : 0;
      last = ms;
      elapsed += dt;
      render(elapsed, dt);
    });
  console.info("Aurelia ready", vegetation.counts);
} catch (error) {
  console.error(error);
  window.__errors.push(String(error));
  document.querySelector("#load-detail").textContent =
    "Could not enter the valley. " + error.message;
}
