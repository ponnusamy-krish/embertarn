import * as THREE from "three/webgpu";
import { height } from "./math.js";
const V = (a) => new THREE.Vector3(...a);
// Adjacent shots share endpoints. Quintic easing brings velocity and acceleration to zero at edits.
const definitions = [
  [
    "01 / THE VALLEY",
    36,
    [
      [280, 650, 1130],
      [180, 440, 920],
      [30, 180, 650],
      [-60, 32, 470],
    ],
    [
      [0, 180, -300],
      [0, 170, -380],
      [0, 150, -470],
      [0, 110, -570],
    ],
  ],
  [
    "02 / A MIRROR OF SKY",
    38,
    [
      [-60, 32, 470],
      [-45, 29, 280],
      [0, 28, 80],
      [85, 35, -160],
    ],
    [
      [0, 110, -570],
      [30, 80, -620],
      [60, 75, -700],
      [40, 110, -850],
    ],
  ],
  [
    "03 / THE WATERLINE",
    36,
    [
      [85, 35, -160],
      [-120, 38, 60],
      [-340, 42, 340],
      [-414, 29, 460],
    ],
    [
      [0, 110, -850],
      [-230, 80, -220],
      [-50, 125, -420],
      [0, 150, -450],
    ],
  ],
  [
    "04 / UNDER THE SPRUCES",
    38,
    [
      [-414, 29, 460],
      [-470, 29.5, 430],
      [-510, 31, 330],
      [-550, 38, 180],
    ],
    [
      [0, 150, -450],
      [-500, 35, 300],
      [-550, 39, 160],
      [-300, 190, -600],
    ],
  ],
  [
    "05 / THE FRACTURED RIDGE",
    38,
    [
      [-550, 38, 180],
      [-640, 200, 80],
      [-730, 470, -20],
      [-500, 660, -200],
    ],
    [
      [-300, 190, -600],
      [-250, 260, -700],
      [0, 420, -1200],
      [100, 350, -900],
    ],
  ],
  [
    "06 / THE LONG WAY HOME",
    38,
    [
      [-500, 660, -200],
      [-600, 520, -500],
      [200, 430, -650],
      [640, 300, 80],
    ],
    [
      [100, 350, -900],
      [0, 70, 0],
      [0, 80, 0],
      [0, 80, 0],
    ],
  ],
  [
    "07 / THE MEADOW",
    38,
    [
      [640, 300, 80],
      [590, 140, 300],
      [460, 34, 490],
      [382, 30.6, 570],
    ],
    [
      [0, 80, 0],
      [0, 80, -300],
      [420, 35, 520],
      [350, 31, 540],
    ],
  ],
  [
    "08 / UNTIL TOMORROW",
    38,
    [
      [382, 30.6, 570],
      [420, 150, 800],
      [500, 650, 1200],
      [680, 1100, 1700],
    ],
    [
      [350, 31, 540],
      [0, 120, -350],
      [0, 150, -200],
      [0, 150, -200],
    ],
  ],
];
export const shots = definitions.map(([name, duration, points, looks]) => ({
  name,
  duration,
  path: new THREE.CatmullRomCurve3(points.map(V)),
  look: new THREE.CatmullRomCurve3(looks.map(V)),
}));
export function tourPose(t) {
  let local = ((t % 300) + 300) % 300,
    index = 0;
  while (local >= shots[index].duration && index < 7) {
    local -= shots[index++].duration;
  }
  const s = shots[index];
  let u = local / s.duration;
  u = u * u * u * (u * (u * 6 - 15) + 10);
  const position = s.path.getPoint(u),
    target = s.look.getPoint(u);
  position.y = Math.max(
    position.y,
    height(position.x, position.z) + (index === 6 || index === 7 ? 1.6 : 2.3),
    24.3,
  );
  return { position, target, name: s.name };
}
let corridors = [];
export function rebuildCorridors() {
  corridors = [];
  for (let t = 0; t < 300; t += 0.35) {
    const p = tourPose(t).position;
    if (p.y - height(p.x, p.z) < 55) corridors.push(p);
  }
}
export function inCameraCorridor(x, z, r = 13) {
  return (
    corridors.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r) ||
    (x + 330) ** 2 + (z - 670) ** 2 < 24 * 24
  );
}
export function updateTour(camera, t) {
  const p = tourPose(t);
  camera.position.copy(p.position);
  camera.lookAt(p.target);
  return p.name;
}
