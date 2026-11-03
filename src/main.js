import * as THREE from "three/webgpu";
import { uniform } from "three/tsl";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import "./style.css";
import { height, generateHeightmap } from "./math.js";
import { loadSurfaces, createTerrain } from "./terrain.js";
import { createForest } from "./forest.js";
import { createVegetation } from "./vegetation.js";
import { createSky } from "./sky.js";
import { createWater } from "./water.js";
import { createPost } from "./post.js";
import { updateTour, tourPose, rebuildCorridors } from "./cinematic.js";
const params = new URLSearchParams(location.search),
  capture = params.get("capture") === "1",
  ultra = params.get("quality") === "ultra";
let cinematic = params.get("cinematic") === "1";
window.__ready = false;
window.__errors = [];
if (capture) document.body.classList.add("capture");
const loading = document.querySelector("#loading"),
  detail = document.querySelector("#load-detail"),
  canvas = document.querySelector("#world");
function fail(error) {
  window.__errors.push(String(error));
  console.error(error);
  loading.style.display = "flex";
  loading.style.opacity = 1;
  detail.textContent = String(error.message || error);
  document.querySelector("#interface").style.display = "none";
}
try {
  if (!navigator.gpu)
    throw Error(
      "WebGPU is required. Open this world in a current Chrome or Edge with hardware acceleration enabled.",
    );
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter)
    throw Error(
      "No WebGPU adapter is available. Enable hardware acceleration and update your graphics driver.",
    );
  const requiredFeatures = [
    "float32-filterable",
    "shader-f16",
    "texture-compression-bc",
    "depth-clip-control",
    "indirect-first-instance",
  ].filter((f) => adapter.features.has(f));
  const device = await adapter.requestDevice({ requiredFeatures });
  device.addEventListener("uncapturederror", (event) => {
    window.__errors.push(event.error.message);
    console.error("WebGPU validation:", event.error.message);
  });
  const renderer = new THREE.WebGPURenderer({
    canvas,
    device,
    antialias: false,
    powerPreference: "high-performance",
  });
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend)
    throw Error(
      "A native WebGPU backend is required; WebGL fallback has been disabled.",
    );
  window.__backend = {
    isWebGPUBackend: renderer.backend.isWebGPUBackend,
    adapter: {
      vendor: adapter.info.vendor,
      architecture: adapter.info.architecture,
      device: adapter.info.device,
      description: adapter.info.description,
    },
  };
  console.info(
    "renderer.backend.isWebGPUBackend =",
    renderer.backend.isWebGPUBackend,
    JSON.stringify(window.__backend),
  );
  renderer.setPixelRatio(capture ? 1 : Math.min(devicePixelRatio, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      55,
      innerWidth / innerHeight,
      0.35,
      14000,
    ),
    clock = uniform(0);
  detail.textContent = "Eroding ridgelines and carving glacial channels";
  await new Promise((r) => setTimeout(r, 10));
  generateHeightmap();
  rebuildCorridors();
  camera.position.set(-330, height(-330, 670) + 4.5, 670);
  camera.lookAt(0, 200, -800);
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, n, total) => {
    document.querySelector("#progress").style.width =
      `${Math.round((n / total) * 90)}%`;
    detail.textContent = `Loading CC0 materials - ${n}/${total}`;
  };
  manager.onError = (url) => {
    window.__errors.push(url);
    console.error("Asset failed", url);
  };
  const [surfaces, sky] = await Promise.all([
    loadSurfaces(manager),
    createSky(scene, renderer, manager, clock, ultra),
  ]);
  const terrain = createTerrain(scene, surfaces);
  terrain.update(camera, ultra);
  const water = createWater(scene, clock, sky.direction, ultra);
  const forest = await createForest(scene, manager, clock);
  const plants = await createVegetation(scene, surfaces, manager, clock);
  forest.update(camera);
  plants.update(camera);
  window.__sceneStats = {
    ...forest.counts,
    ...plants.counts,
    terrainTiles: terrain.tiles.length,
    heightmapResolution: 1025,
    compute: "WebGPU grass wind + distance culling",
  };
  const post = createPost(renderer, scene, camera, sky.shaftSun, ultra),
    controls = new PointerLockControls(camera, canvas),
    keys = new Set();
  let elapsed = 0,
    last = 0,
    tourStart = 0,
    frames = 0;
  function toggle() {
    cinematic = !cinematic;
    tourStart = elapsed;
    controls.unlock();
    document.body.classList.toggle("cinematic", cinematic);
  }
  document.querySelector("#enter").onclick = () => {
    cinematic = false;
    document.body.classList.remove("cinematic");
    controls.lock();
  };
  document.querySelector("#cinema").onclick = toggle;
  controls.addEventListener("lock", () =>
    document.body.classList.add("locked"),
  );
  controls.addEventListener("unlock", () =>
    document.body.classList.remove("locked"),
  );
  addEventListener("keydown", (e) => {
    keys.add(e.code);
    if (e.code === "KeyC" && !e.repeat) toggle();
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  let shadowTick = -1;
  const shadowPosition = new THREE.Vector3(Infinity, Infinity, Infinity),
    shadowRotation = new THREE.Quaternion();
  function render(t, dt = 0) {
    clock.value = t;
    if (cinematic)
      document.querySelector("#shot-label").textContent = updateTour(
        camera,
        capture ? t : t - tourStart,
      );
    else if (!capture && controls.isLocked) {
      const speed = (keys.has("ShiftLeft") ? 90 : 20) * dt;
      controls.moveForward(
        (Number(keys.has("KeyW")) - Number(keys.has("KeyS"))) * speed,
      );
      controls.moveRight(
        (Number(keys.has("KeyD")) - Number(keys.has("KeyA"))) * speed,
      );
      camera.position.y +=
        (Number(keys.has("KeyE")) - Number(keys.has("KeyQ"))) * speed;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2100, 2100);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2100, 2100);
      camera.position.y = Math.max(
        camera.position.y,
        height(camera.position.x, camera.position.z) + 2.2,
        24.2,
      );
      for (const tr of forest.trees) {
        const dx = camera.position.x - tr.x,
          dz = camera.position.z - tr.z,
          d = Math.hypot(dx, dz);
        if (d < 2 && camera.position.y < tr.y + 22 * tr.s) {
          camera.position.x += (dx / (d || 1)) * (2 - d);
          camera.position.z += (dz / (d || 1)) * (2 - d);
        }
      }
    }
    camera.updateMatrixWorld();
    sky.update(t, camera);
    terrain.update(camera, ultra);
    forest.update(camera, capture);
    plants.update(camera);
    const tick = Math.floor(t * 6),
      refresh =
        capture ||
        tick !== shadowTick ||
        camera.position.distanceToSquared(shadowPosition) > 0.001 ||
        camera.quaternion.angleTo(shadowRotation) > 0.001;
    for (const light of [...sky.csm.lights, sky.shaftSun]) {
      light.shadow.autoUpdate = false;
      light.shadow.needsUpdate = refresh;
    }
    shadowTick = tick;
    shadowPosition.copy(camera.position);
    shadowRotation.copy(camera.quaternion);
    renderer.compute(plants.compute);
    post.render();
    frames++;
    window.__renderedFrames = frames;
  }
  window.__renderFrame = async (t) => {
    if (!Number.isFinite(t) || t < 0)
      throw Error("t must be finite nonnegative seconds");
    elapsed = t;
    window.__captureTime = t;
    render(t);
    await device.queue.onSubmittedWorkDone();
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
  window.__tourCollisionCheck = () => {
    let groundMargin = Infinity,
      treeMargin = Infinity;
    for (let t = 0; t < 300; t += 0.25) {
      const p = tourPose(t).position;
      groundMargin = Math.min(groundMargin, p.y - height(p.x, p.z));
      for (const tr of forest.trees)
        if (p.y < tr.y + 22 * tr.s && p.y > tr.y - 1)
          treeMargin = Math.min(
            treeMargin,
            Math.hypot(p.x - tr.x, p.z - tr.z) - 6.1 * tr.s,
          );
    }
    return { groundMargin, treeMargin };
  };
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (capture && window.__ready) window.__renderFrame(elapsed);
  });
  detail.textContent = "Compiling native WebGPU pipelines";
  await renderer.compileAsync(scene, camera);
  renderer.compute(plants.compute);
  await device.queue.onSubmittedWorkDone();
  render(cinematic ? 0 : 12);
  await device.queue.onSubmittedWorkDone();
  render(cinematic ? 0 : 12);
  await device.queue.onSubmittedWorkDone();
  window.__ready = true;
  document.body.classList.toggle("cinematic", cinematic);
  loading.style.opacity = 0;
  setTimeout(() => loading.remove(), 800);
  console.info("Aurelia WebGPU ready", JSON.stringify(window.__sceneStats));
  if (!capture)
    renderer.setAnimationLoop((ms) => {
      const dt = last ? Math.min((ms - last) / 1000, 0.05) : 0;
      last = ms;
      elapsed += dt;
      render(elapsed, dt);
    });
} catch (error) {
  fail(error);
}
