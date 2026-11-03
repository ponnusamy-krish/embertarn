import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, weld, simplify } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
const stage = path.resolve("scripts/.fir-source");
fs.mkdirSync(stage, { recursive: true });
const metadata = await (
    await fetch("https://api.polyhaven.com/files/fir_tree_01")
  ).json(),
  f = metadata.gltf["1k"].gltf;
await Promise.all(
  [["fir.gltf", f], ...Object.entries(f.include)].map(async ([name, item]) => {
    const dest = path.join(stage, name);
    if (fs.existsSync(dest)) return;
    const r = await fetch(item.url);
    if (!r.ok) throw Error(r.status);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (crypto.createHash("md5").update(bytes).digest("hex") !== item.md5)
      throw Error("Hash mismatch");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
  }),
);
console.log("Source downloaded");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  doc = await io.read(path.join(stage, "fir.gltf"));
const scene = doc.getRoot().listScenes()[0],
  children = scene.listChildren();
console.log(
  "Trees",
  children.map((x) => x.getName()),
);
for (const node of children.slice(1)) scene.removeChild(node);
await MeshoptSimplifier.ready;
await doc.transform(
  prune(),
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.18, error: 0.002 }),
  prune(),
);
await io.write("public/assets/fir-tree-lod.glb", doc);
console.log(
  "Optimized bytes",
  fs.statSync("public/assets/fir-tree-lod.glb").size,
);
fs.writeFileSync(
  "public/assets/fir-tree-source.json",
  JSON.stringify(
    {
      source: f.url,
      license: "CC0-1.0",
      authors: ["Rob Tuytel", "Rico Cilliers"],
      processing:
        "First tree; weld and meshoptimizer simplify ratio 0.18 error 0.002; original 1k PBR maps",
    },
    null,
    2,
  ),
);
if (stage === path.resolve("scripts/.fir-source"))
  fs.rmSync(stage, { recursive: true, force: true });
