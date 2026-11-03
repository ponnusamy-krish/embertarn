import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const specs = [
  ["hdris", "qwantani_sunset"],
  ...[
    "grass_ground",
    "forest_ground_04",
    "rock_face",
    "snow_02",
    "dry_river_pebbles",
  ].map((x) => ["textures", x]),
  ...["fir_sapling", "boulder_01", "fern_02", "dead_tree_trunk"].map((x) => [
    "models",
    x,
  ]),
];
const manifest = JSON.parse(fs.readFileSync("public/assets/manifest.json", "utf8"));
const jobs = [];
let credits =
  "# Asset credits\n\nAll downloaded art is CC0 1.0, from Poly Haven. https://polyhaven.com/license\n\n";
for (const [type, id] of specs) {
  const files = await (
    await fetch("https://api.polyhaven.com/files/" + id)
  ).json();
  const catalog = await (
    await fetch("https://api.polyhaven.com/assets?t=" + type)
  ).json();
  const asset = catalog[id];
  credits += `- **${asset.name}**  -  ${Object.keys(asset.authors || {}).join(", ")}  -  https://polyhaven.com/a/${id}  -  CC0 1.0\n`;
  const add = (f, local) => {
    if (!f) throw Error("Missing " + local);
    jobs.push({
      url: f.url,
      local: "public/assets/" + local,
      md5: f.md5,
      size: f.size,
    });
  };
  if (type === "hdris") add(files.hdri["4k"].hdr, id + ".hdr");
  else if (type === "textures")
    for (const map of ["diff", "nor_gl", "rough"])
      add(
        files[{ diff: "Diffuse", rough: "Rough" }[map] || map]["2k"].jpg,
        `${id}/${map}.jpg`,
      );
  else {
    const f = files.gltf["1k"].gltf;
    add(f, `${id}/${id}.gltf`);
    for (const [name, v] of Object.entries(f.include)) add(v, `${id}/${name}`);
  }
}
console.log("Total MB", jobs.reduce((s, f) => s + f.size, 0) / 1e6);
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++];
    fs.mkdirSync(path.dirname(j.local), { recursive: true });
    if (!fs.existsSync(j.local)) {
      const r = await fetch(j.url);
      if (!r.ok) throw Error(r.status + " " + j.url);
      fs.writeFileSync(j.local, Buffer.from(await r.arrayBuffer()));
    }
    const b = fs.readFileSync(j.local);
    if (crypto.createHash("md5").update(b).digest("hex") !== j.md5)
      throw Error("Hash mismatch " + j.local);
    console.log(j.local);
    manifest.push(j);
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
for (const name of [
  "fir-impostor-0.png",
  "fir-impostor-1.png",
  "fir-impostor-2.png",
  "fir-impostors.json",
]) {
  const local = "public/assets/" + name;
  if (fs.existsSync(local)) {
    const bytes = fs.readFileSync(local);
    manifest.push({
      local,
      size: bytes.length,
      md5: crypto.createHash("md5").update(bytes).digest("hex"),
      derivedFrom: "https://polyhaven.com/a/fir_tree_01",
      license: "CC0-1.0",
    });
  }
}
fs.writeFileSync(
  "public/assets/manifest.json",
  JSON.stringify([...new Map(manifest.map(v=>[v.local,v])).values()], null, 2),
);
