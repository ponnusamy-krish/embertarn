import * as THREE from "three/webgpu";
import { height } from "./math.js";
const V = (a) => new THREE.Vector3(...a);
// Adjacent shots share endpoints. Quintic easing brings velocity and acceleration to zero at edits.
const definitions = [
 ['01 / EMBERTARN',36,[[180,600,1400],[130,360,1100],[70,180,800],[30,70,600]],[[-150,260,-1800],[-150,260,-1800],[-150,260,-1800],[-150,260,-1800]]],
 ['02 / THE MIRROR',38,[[30,70,600],[20,55,400],[-20,50,200],[-55,60,-50]],[[-150,260,-1800],[-150,260,-1800],[-150,260,-1800],[-150,260,-1800]]],
 ['03 / GLACIAL SHORE',36,[[-55,60,-50],[-100,45,100],[-160,38,300],[-210,35,450]],[[-150,260,-1800],[0,180,-900],[0,150,-800],[0,160,-850]]],
 ['04 / UNDER THE FIRS',38,[[-210,35,450],[-240,35,400],[-255,40,300],[-260,65,150]],[[0,160,-850],[-220,45,280],[-240,70,100],[-100,300,-1400]]],
 ['05 / RIDGE REVEAL',38,[[-260,65,150],[-450,260,0],[-650,500,-150],[-600,720,-350]],[[-100,300,-1400],[-150,450,-1800],[-100,600,-2200],[-100,500,-2000]]],
 ['06 / ABOVE THE VALLEY',38,[[-600,720,-350],[-500,650,-700],[250,600,-700],[550,450,100]],[[-100,500,-2000],[0,60,0],[0,60,0],[0,80,0]]],
 ['07 / LAKESIDE MEADOW',38,[[550,450,100],[350,240,300],[200,65,550],[155,38,680]],[[0,80,0],[0,120,-600],[0,180,-1100],[-150,260,-1800]]],
 ['08 / LAST LIGHT',38,[[155,38,680],[180,200,900],[300,650,1400],[500,1200,2100]],[[-150,260,-1800],[-150,260,-1800],[-150,260,-1800],[-150,260,-1800]]]
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
    (x - 155) ** 2 + (z - 680) ** 2 < 24 * 24
  );
}
export function updateTour(camera, t) {
  const p = tourPose(t);
  camera.position.copy(p.position);
  camera.lookAt(p.target);
  return p.name;
}
