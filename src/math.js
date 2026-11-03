// All terrain and placements are seeded. No wall-clock input is used here.
export function random(seed = 913) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x, y) => {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
export function noise(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  let u = x - ix,
    v = y - iy;
  u = u * u * u * (u * (u * 6 - 15) + 10);
  v = v * v * v * (v * (v * 6 - 15) + 10);
  return (
    (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
    (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
  );
}
export function fbm(x, z, n = 5) {
  let a = 0.5,
    s = 0;
  for (let i = 0; i < n; i++) {
    s += a * noise(x, z);
    const xx = x;
    x = xx * 1.79 + z * 0.93 + 17.1;
    z = z * 1.79 - xx * 0.93 - 29.5;
    a *= 0.5;
  }
  return s;
}
export function ridged(x, z, n = 6) {
  let a = 0.52,
    s = 0,
    weight = 1;
  for (let i = 0; i < n; i++) {
    let q = 1 - Math.abs(noise(x, z) * 2 - 1);
    q = q * q;
    s += q * a * weight;
    weight = Math.min(1, q * 1.7);
    x = x * 2.07 + 3.7;
    z = z * 2.07 - 6.5;
    a *= 0.51;
  }
  return s;
}
export const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const LAKE = 22,
  WORLD = 4608,
  GRID = 1025,
  CELL = WORLD / (GRID - 1);
export function lakeRadius(x, z) {
  return (
    Math.hypot(x / 470, z / 700) +
    (noise(x * 0.004 + 50, z * 0.004 + 50) - 0.5) * 0.18 +
    Math.sin(Math.atan2(z, x) * 5) * 0.025
  );
}
function geology(x, z) {
  const r = lakeRadius(x, z),
    shore = LAKE + (r - 1) * 62;
  const wx = x + (fbm(x * 0.0013 + 10, z * 0.0013) - 0.48) * 290,
    wz = z + (fbm(x * 0.0013, z * 0.0013 + 21) - 0.48) * 220;
  // Intersecting, anisotropic ridge belts; no radial cone primitives.
  const ridges = [
    [-1000, -900, 0.32, 1020, 400, 740],
    [150, -1550, -0.2, 1330, 530, 1030],
    [1270, -700, 1.2, 1050, 440, 910],
    [-1400, 580, 1.45, 1100, 470, 670],
    [1470, 860, 0.9, 1150, 500, 640],
    [-350, 1900, 0.2, 1200, 420, 590],
  ];
  let mass = 0;
  for (let k = 0; k < ridges.length; k++) {
    const [cx, cz, a, len, width, h] = ridges[k],
      dx = wx - cx,
      dz = wz - cz,
      u = (dx * Math.cos(a) + dz * Math.sin(a)) / len,
      v = (-dx * Math.sin(a) + dz * Math.cos(a)) / width;
    const spine =
      Math.exp(-Math.pow(Math.abs(v), 1.35)) *
      Math.exp(-Math.pow(Math.abs(u), 4) * 1.5);
    const crest = 0.82 + 0.25 * ridged(u * 2.0 + k * 13, v * 0.65 + k * 9, 4);
    mass = Math.max(mass, h * spine * crest);
  }
  const mask = smooth(1.25, 2.2, r);
  const fractured =
    (ridged(wx * 0.0045, wz * 0.0045, 6) - 0.38) * (65 + mass * 0.19);
  const gullies =
    (1 - Math.abs(noise(wx * 0.009, wz * 0.0018) * 2 - 1)) *
    Math.min(90, mass * 0.15);
  const rock =
    mass +
    fractured -
    gullies +
    (ridged(wx * 0.026, wz * 0.019, 4) - 0.4) * 42 * smooth(120, 500, mass);
  const stratum =
    Math.sin((rock + wx * 0.07) * 0.085) * 9 * smooth(180, 550, rock);
  return (
    shore +
    (rock + stratum) * mask +
    (fbm(x * 0.018, z * 0.018, 4) - 0.46) * (2 + mask * 16)
  );
}
let map;
export function generateHeightmap() {
  if (map) return map;
  map = new Float32Array(GRID * GRID);
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++)
      map[z * GRID + x] = geology(x * CELL - WORLD / 2, z * CELL - WORLD / 2);
  // Deterministic downhill flow incision followed by conservative thermal transport.
  const flow = new Float32Array(map.length);
  flow.fill(1);
  for (let pass = 0; pass < 9; pass++) {
    const nextFlow = new Float32Array(map.length);
    nextFlow.fill(1);
    for (let z = 1; z < GRID - 1; z++)
      for (let x = 1; x < GRID - 1; x++) {
        const i = z * GRID + x;
        if (map[i] < 65) continue;
        let low = i;
        for (const d of [-1, 1, -GRID, GRID])
          if (map[i + d] < map[low]) low = i + d;
        if (low !== i) {
          const slope = (map[i] - map[low]) / CELL;
          nextFlow[low] += Math.min(flow[i], 150);
          map[i] -= Math.min(0.55, Math.log1p(flow[i]) * 0.035 * slope);
        }
      }
    flow.set(nextFlow);
  }
  for (let pass = 0; pass < 5; pass++) {
    const delta = new Float32Array(map.length);
    for (let z = 1; z < GRID - 1; z++)
      for (let x = 1; x < GRID - 1; x++) {
        const i = z * GRID + x;
        if (map[i] < 80) continue;
        let low = i;
        for (const d of [-1, 1, -GRID, GRID])
          if (map[i + d] < map[low]) low = i + d;
        const excess = map[i] - map[low] - CELL * 1.15;
        if (excess > 0) {
          const move = excess * 0.14;
          delta[i] -= move;
          delta[low] += move;
        }
      }
    for (let i = 0; i < map.length; i++) map[i] += delta[i];
  }
  return map;
}
export function height(x, z) {
  if (!map) return geology(x, z);
  const fx = Math.max(0, Math.min(GRID - 1.001, (x + WORLD / 2) / CELL)),
    fz = Math.max(0, Math.min(GRID - 1.001, (z + WORLD / 2) / CELL));
  const ix = Math.floor(fx),
    iz = Math.floor(fz),
    u = fx - ix,
    v = fz - iz,
    i = iz * GRID + ix;
  const base =
    (map[i] * (1 - u) + map[i + 1] * u) * (1 - v) +
    (map[i + GRID] * (1 - u) + map[i + GRID + 1] * u) * v;
  return base + (noise(x * 0.23, z * 0.23) - 0.5) * 0.32 * smooth(23, 30, base);
}
export function slope(x, z) {
  return (
    Math.hypot(
      height(x + 2, z) - height(x - 2, z),
      height(x, z + 2) - height(x, z - 2),
    ) / 4
  );
}
