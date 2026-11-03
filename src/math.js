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
export const LAKE=22,WORLD=10240,GRID=2049,CELL=WORLD/(GRID-1);
let map,shore,biomes;
export async function loadDEM(){
 const paths=['terrain.f32','shore-distance.f32','biome.rgba'];
 const data=await Promise.all(paths.map(async file=>{const r=await fetch('/assets/moraine-dem/'+file);if(!r.ok)throw Error('DEM '+r.status+' '+file);return r.arrayBuffer();}));
 map=new Float32Array(data[0]);shore=new Float32Array(data[1]);biomes=new Uint8Array(data[2]);
 // Sub-DEM surface detail, restrained so surveyed silhouettes stay intact.
 for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){const i=z*GRID+x,y=map[i];if(shore[i]>15){const wx=x*CELL-WORLD/2,wz=z*CELL-WORLD/2;map[i]+=(ridged(wx*.018+(noise(wx*.004,wz*.004)-.5)*2,wz*.018,5)-.4)*smooth(40,500,y)*26+(noise(wx*.23,wz*.23)-.5)*.5;}}
 return map;
}
export function generateHeightmap(){if(!map)throw Error('loadDEM must complete before terrain creation');return map;}
function sample(data,x,z,size=GRID,channels=1,channel=0){const fx=Math.max(0,Math.min(size-1.001,(x/WORLD+.5)*(size-1))),fz=Math.max(0,Math.min(size-1.001,(z/WORLD+.5)*(size-1))),ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,i=(iz*size+ix)*channels+channel;
 return(data[i]*(1-u)+data[i+channels]*u)*(1-v)+(data[i+size*channels]*(1-u)+data[i+(size+1)*channels]*u)*v;}
export function height(x,z){return map?sample(map,x,z):22;}
export function shoreDistance(x,z){return shore?sample(shore,x,z):100;}
export function lakeRadius(x,z){return 1+shoreDistance(x,z)/500;}
export function biome(x,z){return [0,1,2,3].map(i=>sample(biomes,x,z,1025,4,i)/255);}
export function slope(x,z){return Math.hypot(height(x+3,z)-height(x-3,z),height(x,z+3)-height(x,z-3))/6;}

export function shorelineMap(){return shore;}
