import puppeteer from "puppeteer";
import fs from "node:fs";
import crypto from "node:crypto";
let browser,page;
const errors=[],failed=[];
async function launch(){
browser = await puppeteer.launch({
  headless: true,
  args: [
    "--enable-unsafe-webgpu",
    "--ignore-gpu-blocklist",
    "--use-angle=d3d11",
    "--force-color-profile=srgb",
    "--disable-background-timer-throttling",
  ],
  protocolTimeout: 300000,
});

page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
  if (errors.length < 5) console.log(m.type(), m.text().slice(0, 2500));
});
page.on("pageerror", (e) => {
  errors.push(String(e));
  console.log("PAGEERROR", String(e));
});
page.on("requestfailed", (r) => failed.push(r.url()));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(r.status() + " " + r.url());
});
}
await launch();
const dir = process.env.ITERATION
  ? `screenshots/iteration-${process.env.ITERATION}`
  : "screenshots";
fs.mkdirSync(dir, { recursive: true });
try {
  await page.goto("http://localhost:5173/?capture=1", {
    waitUntil: "networkidle0",
    timeout: 240000,
  });
  await page.waitForFunction(() => window.__ready || window.__errors?.length, {
    timeout: 240000,
  });
  if (!(await page.evaluate(() => window.__ready)))
    throw Error(
      await page.evaluate(() => window.__errors.slice(0, 4).join("\n")),
    );
  await page.evaluate(() => window.__renderFrame(12));
  await page.evaluate(() => document.body.classList.remove("capture"));
  await page.screenshot({ path: dir + "/explore.png" });
  await page.evaluate(() => document.body.classList.add("capture"));
  await page.evaluate(() => window.__setMode("cinematic"));
  for (const t of [20, 60, 120, 200, 280]) {
    console.log("Capture", t);
    await page.evaluate((t) => window.__renderFrame(t), t);
    await page.screenshot({ path: `${dir}/cinematic-${t}.png` });
  }
  await page.evaluate(() => window.__renderFrame(120));
  const hashA = crypto
    .createHash("sha256")
    .update(await page.screenshot())
    .digest("hex");
  await page.evaluate(() => window.__renderFrame(20));
  await page.evaluate(() => window.__renderFrame(120));
  const hashB = crypto
    .createHash("sha256")
    .update(await page.screenshot())
    .digest("hex");
  const deterministic = hashA === hashB;
  const stats = await page.evaluate(() => ({
    backend: window.__backend,
    ready: window.__ready,
    scene: window.__sceneStats,
    clearance: window.__tourCollisionCheck(),
    assetErrors: window.__errors,
  }));
  let performance = null;
  if (!process.env.FAST) {
    await browser.close(); await launch();
    await page.goto("http://localhost:5173/", {
      waitUntil: "networkidle0",
      timeout: 240000,
    });
    await page.waitForFunction(() => window.__ready, { timeout: 240000 });
    performance = await page.evaluate(async () => {
      const start = performance.now(),
        frameStart = window.__renderedFrames;
      await new Promise((r) => setTimeout(r, 5000));
      return {
        fps:
          ((window.__renderedFrames - frameStart) * 1000) /
          (performance.now() - start),
        width: innerWidth,
        height: innerHeight,
      };
    });
    await page.click("#enter");
    await page.waitForFunction(() => document.pointerLockElement !== null);
    const before = await page.evaluate(() => window.__cameraPosition());
    const flyStart = await page.evaluate(() => ({
      t: performance.now(),
      n: window.__renderedFrames,
    }));
    await page.keyboard.down("KeyW");
    await new Promise((r) => setTimeout(r, 1200));
    await page.keyboard.up("KeyW");
    performance.flyFps = await page.evaluate(
      (v) =>
        ((window.__renderedFrames - v.n) * 1000) / (performance.now() - v.t),
      flyStart,
    );
    const after = await page.evaluate(() => window.__cameraPosition());
    const moved = Math.hypot(...after.map((v, i) => v - before[i]));
    await page.keyboard.press("Escape");
    if (moved < 1) throw Error("Fly controls did not move");
    performance.controlsMovedMetres = moved;
    await page.keyboard.press("KeyC");
    performance.cinematicFps = await page.evaluate(async () => {
      const start = performance.now(),
        n = window.__renderedFrames;
      await new Promise((r) => setTimeout(r, 5000));
      return (
        ((window.__renderedFrames - n) * 1000) / (performance.now() - start)
      );
    });
  }
  let ultra = null,
    unavailableMessage = false;
  if (!process.env.FAST) {
    await browser.close(); await launch();
    await page.goto(
      "http://localhost:5173/?capture=1&cinematic=1&quality=ultra",
      { waitUntil: "networkidle0", timeout: 240000 },
    );
    await page.waitForFunction(
      () => window.__ready || window.__errors?.length,
      { timeout: 240000 },
    );
    await page.evaluate(() => window.__renderFrame(60));
    ultra = await page.evaluate(() => ({
      ready: window.__ready,
      backend: window.__backend.isWebGPUBackend,
      errors: window.__errors,
    }));
    const unsupported = await browser.newPage();
    await unsupported.evaluateOnNewDocument(() =>
      Object.defineProperty(navigator, "gpu", { get: () => undefined }),
    );
    await unsupported.goto("http://localhost:5173/?capture=1");
    await unsupported.waitForFunction(() => window.__errors?.length);
    unavailableMessage = await unsupported.evaluate(() =>
      document
        .querySelector("#load-detail")
        .textContent.includes("WebGPU is required"),
    );
    await unsupported.close();
  }
  const report = {
    errors,
    failed,
    ...stats,
    deterministic,
    performance,
    ultra,
    unavailableMessage,
  };
  fs.writeFileSync(dir + "/verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (
    !deterministic ||
    errors.length ||
    failed.length ||
    stats.assetErrors.length ||
    !stats.backend.isWebGPUBackend ||
    stats.clearance.groundMargin < 1.5 ||
    stats.clearance.treeMargin < 0.2
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
