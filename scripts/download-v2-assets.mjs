import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const manifest = JSON.parse(fs.readFileSync("public/assets/manifest.json"));
for (const id of ["rock_face_03", "aerial_rocks_04"]) {
  const r = await fetch("https://api.polyhaven.com/files/" + id);
  if (!r.ok) throw Error(r.status);
  const files = await r.json();
  for (const [name, key] of [
    ["diff", "Diffuse"],
    ["nor_gl", "nor_gl"],
    ["rough", "Rough"],
  ]) {
    const file = files[key]["2k"].jpg;
    const local = `public/assets/${id}/${name}.jpg`;
    fs.mkdirSync(path.dirname(local), { recursive: true });
    const response = await fetch(file.url);
    if (!response.ok) throw Error(response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash("md5").update(bytes).digest("hex") !== file.md5)
      throw Error("Bad hash");
    fs.writeFileSync(local, bytes);
    manifest.push({ local, ...file });
  }
}
fs.writeFileSync(
  "public/assets/manifest.json",
  JSON.stringify([...new Map(manifest.map(v=>[v.local,v])).values()], null, 2),
);
console.log("Geology scans downloaded");
