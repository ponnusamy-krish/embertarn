// Seeded functions: terrain and placements are identical on every load.
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
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return (
    (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
    (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
  );
}
export function fbm(x, z, n = 6) {
  let a = 0.5,
    s = 0;
  for (let i = 0; i < n; i++) {
    s += a * noise(x, z);
    x = x * 2.03 + 31.7;
    z = z * 2.03 - 19.1;
    a *= 0.5;
  }
  return s;
}
export const smooth = (a, b, x) => {
  let t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const LAKE = 22;
export function lakeRadius(x, z) {
  return (
    Math.hypot(x / 480, z / 730) +
    (noise(x * 0.003 + 50, z * 0.003 + 50) - 0.5) * 0.2
  );
}
export function height(x, z) {
  const r = lakeRadius(x, z),
    a = Math.atan2(z / 730, x / 480);
  const shore = 22 + (r - 1) * 64;
  const rise = smooth(1.18, 2.0, r);
  const peaks = [
    [-1500, -300, 950, 1050, 1150],
    [-1150, -1100, 1100, 1050, 1000],
    [-400, -1750, 1250, 1100, 1050],
    [350, -1900, 1400, 1050, 1150],
    [1150, -1250, 1180, 1000, 1100],
    [1600, -300, 1000, 1000, 1250],
    [1500, 1100, 850, 1000, 1000],
    [-1500, 1300, 900, 1100, 1000],
  ];
  const wx = x + (fbm(x * 0.0015 + 5, z * 0.0015) - 0.5) * 170,
    wz = z + (fbm(x * 0.0015, z * 0.0015 + 9) - 0.5) * 170;
  let mountain = 0;
  for (const [px, pz, h, sx, sz] of peaks) {
    const dx = (wx - px) / sx,
      dz = (wz - pz) / sz,
      d = Math.hypot(dx, dz),
      a = Math.atan2(dz, dx);
    const gullies =
      1 +
      smooth(0, 0.3, d) *
        (0.1 * Math.sin(a * 9 + Math.sin(d * 7)) + 0.05 * Math.cos(a * 17));
    mountain = Math.max(
      mountain,
      h * 0.7 * Math.pow(Math.max(0, 1 - d), 1.35) * gullies,
    );
  }
  const detail =
    (fbm(x * 0.008 + 80, z * 0.008, 6) - 0.48) * (12 + mountain * 0.16);
  return (
    shore +
    mountain * rise +
    detail * smooth(0.96, 1.25, r) -
    smooth(0, 0.87, 1 - r) * 20
  );
}
export function slope(x, z) {
  return (
    Math.hypot(
      height(x + 3, z) - height(x - 3, z),
      height(x, z + 3) - height(x, z - 3),
    ) / 6
  );
}
