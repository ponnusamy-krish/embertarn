import * as THREE from 'three/webgpu';
import {texture,positionWorld,cameraPosition,vec2,vec3,float,uniform,reflector,reflect,mix,smoothstep,sin,screenUV,viewportTexture,mx_noise_float} from 'three/tsl';
import {makeHeightTexture} from './terrain.js';
import {random,LAKE,WORLD,GRID,shorelineMap} from './math.js';
function normals(){const n=512,d=new Uint8Array(n*n*4),rand=random(28),waves=Array.from({length:32},(_,i)=>({x:Math.round((rand()-.5)*36),y:Math.round((rand()-.5)*36),p:rand()*6.28,a:.012/(1+i*.15)}));for(let y=0;y<n;y++)for(let x=0;x<n;x++){let dx=0,dy=0;for(const w of waves){const f=Math.cos(x/n*Math.PI*2*w.x+y/n*Math.PI*2*w.y+w.p)*w.a,l=Math.hypot(w.x,w.y)||1;dx+=f*w.x/l;dy+=f*w.y/l;}const v=new THREE.Vector3(dx,dy,1).normalize(),i=(y*n+x)*4;d[i]=v.x*127+128;d[i+1]=v.y*127+128;d[i+2]=v.z*127+128;d[i+3]=255;}const t=new THREE.DataTexture(d,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=8;t.needsUpdate=true;return t;}
export function createWater(scene,time,sunDirection,ultra){
 const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(2600,3200),m);mesh.rotation.x=-Math.PI/2;mesh.position.y=LAKE;mesh.renderOrder=3;
 const mirror=reflector({resolutionScale:1,generateMipmaps:true,bounces:false,samples:ultra?4:2});mesh.add(mirror.target);
 const shoreline=new THREE.DataTexture(shorelineMap(),GRID,GRID,THREE.RedFormat,THREE.FloatType);shoreline.minFilter=shoreline.magFilter=THREE.LinearFilter;shoreline.needsUpdate=true;
 const p=positionWorld,depth=float(LAKE).sub(texture(makeHeightTexture(),p.xz.div(WORLD).add(.5)).r).max(0),map=normals();
 const a=texture(map,p.xz.mul(.009).add(vec2(time.mul(.0009),time.mul(.0005)))).xy.mul(2).sub(1),b=texture(map,vec2(p.x.add(p.z.mul(.7)),p.z.sub(p.x.mul(.7))).mul(.014).add(vec2(time.mul(-.0005),time.mul(.0008)))).xy.mul(2).sub(1),ripple=a.add(b.mul(.42));
 const normal=vec3(ripple.x,1,ripple.y).normalize(),view=cameraPosition.sub(p).normalize(),fresnel=float(.021).add(view.dot(normal).clamp(0,1).oneMinus().pow(5).mul(.979));
 const distortion=ripple.mul(.0007).mul(smoothstep(.1,3,depth));mirror.uvNode=mirror.uvNode.add(distortion);
 const refract=viewportTexture(screenUV.add(distortion.mul(.3))).rgb,attenuation=vec3(.23,.065,.045).mul(depth.negate()).exp(),deep=vec3(.008,.105,.135),body=refract.mul(attenuation).add(deep.mul(attenuation.oneMinus()));
 const sun=reflect(uniform(sunDirection).negate(),normal).dot(view).max(0).pow(1800).mul(vec3(4.5,2.5,1));
 const shore=smoothstep(.01,.2,depth).mul(smoothstep(.25,1.4,depth).oneMinus()),foam=sin(depth.mul(7).sub(time.mul(.5)).add(mx_noise_float(p.xz.mul(.2)).mul(3))).mul(.5).add(.5).pow(10).mul(shore).mul(.03);
 m.colorNode=mix(body,mirror.rgb,fresnel).add(sun).add(foam);m.opacityNode=smoothstep(0,.16,depth).mul(smoothstep(-1,3,texture(shoreline,p.xz.div(WORLD).add(.5)).r).oneMinus());scene.add(mesh);return{mesh,mirror};
}
