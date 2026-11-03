import fs from "node:fs";
import crypto from "node:crypto";
const id = "industrial_sunset_02_puresky",
  files = await (await fetch("https://api.polyhaven.com/files/" + id)).json(),
  file = files.hdri["4k"].hdr;
const r = await fetch(file.url);
if (!r.ok) throw Error(r.status);
const b = Buffer.from(await r.arrayBuffer());
if (crypto.createHash("md5").update(b).digest("hex") !== file.md5)
  throw Error("Hash mismatch");
const local = `public/assets/${id}.hdr`;
fs.writeFileSync(local, b);
const p = "public/assets/manifest.json",
  m = JSON.parse(fs.readFileSync(p));
m.push({ local, ...file });
fs.writeFileSync(p, JSON.stringify([...new Map(m.map(v=>[v.local,v])).values()], null, 2));
const all = await (await fetch("https://api.polyhaven.com/assets")).json();
for (const name of [id, "rock_face_03", "aerial_rocks_04"])
  console.log(name, all[name].authors);
