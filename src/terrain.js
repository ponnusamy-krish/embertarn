import * as THREE from 'three/webgpu';
import {Fn,vec3,float,mix,texture,positionWorld,normalWorldGeometry,cameraPosition,cameraViewMatrix,smoothstep,sin,mx_fractal_noise_float,attribute} from 'three/tsl';
import {height,biome,WORLD,GRID,generateHeightmap} from './math.js';
const IDS=['grass_ground','forest_ground_04','rock_face_03','aerial_rocks_04','snow_02','dry_river_pebbles','rock_face'];
export async function loadSurfaces(manager){
 const loader=new THREE.TextureLoader(manager),result={},size=1024,colors=new Uint8Array(size*size*4*IDS.length),normals=new Uint8Array(colors.length),canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 // Sequential decode limits peak RAM; compact arrays share two samplers.
 for(let layer=0;layer<IDS.length;layer++){const id=IDS[layer],maps=[];for(const k of ['diff','nor_gl','rough']){const t=await loader.loadAsync(`/assets/${id}/${k}.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(k==='diff')t.colorSpace=THREE.SRGBColorSpace;maps.push(t);}
  ctx.drawImage(maps[0].image,0,0,size,size);colors.set(ctx.getImageData(0,0,size,size).data,layer*size*size*4);ctx.drawImage(maps[1].image,0,0,size,size);const n=ctx.getImageData(0,0,size,size).data;ctx.drawImage(maps[2].image,0,0,size,size);const r=ctx.getImageData(0,0,size,size).data;for(let i=3;i<n.length;i+=4)n[i]=r[i-2];normals.set(n,layer*size*size*4);
  result[id]={map:maps[0],normalMap:maps[1],roughnessMap:maps[2]};
 }
 const make=(data,srgb)=>{const t=new THREE.DataArrayTexture(data,size,size,IDS.length);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;};result.colorArray=make(colors,true);result.normalArray=make(normals,false);return result;
}
export function makeTerrainMaterial(s,film=null){
 const m=new THREE.MeshStandardNodeMaterial({roughness:.93,envMapIntensity:.22}),p=positionWorld,n=normalWorldGeometry,w=n.abs().pow(6).div(n.abs().pow(6).dot(vec3(1))),bio=attribute('biome','vec4');
 const tex=(layer,coords,normal=false)=>texture(normal?s.normalArray:s.colorArray,coords).depth(layer);
 const tri=(layer,scale,normal=false)=>tex(layer,p.yz.mul(scale),normal).mul(w.x).add(tex(layer,p.xz.mul(scale),normal).mul(w.y)).add(tex(layer,p.xy.mul(scale),normal).mul(w.z));
 const macro=mx_fractal_noise_float(p.mul(.0023),4).mul(.5).add(.5),micro=mx_fractal_noise_float(p.mul(.08),3).mul(.12).add(.94),far=smoothstep(50,850,cameraPosition.distance(p));
 const ground=(layer,scale)=>mix(tex(layer,p.xz.mul(scale)),tex(layer,p.xz.mul(scale*.23)),far.mul(.5));
 const stoneA=mix(tri(2,.09).rgb,tri(2,.003).rgb,far.mul(.6)),stoneB=tri(6,.007).rgb;
 const rawRock=mix(stoneA,stoneB,smoothstep(.32,.68,macro)),grey=rawRock.dot(vec3(.3,.59,.11));
 const strata=mx_fractal_noise_float(vec3(p.x.mul(.008),p.y.mul(.09),p.z.mul(.012)),4).mul(.5).add(.7);
 const cliff=mix(rawRock,vec3(grey),.72).mul(vec3(.77,.85,.96)).mul(strata).mul(micro).mul(mx_fractal_noise_float(p.mul(.017),5).mul(.6).add(.65));
 const rock=smoothstep(.18,.48,n.y.oneMinus()).max(smoothstep(420,700,p.y));
 const scree=smoothstep(.18,.4,n.y.oneMinus()).mul(smoothstep(.45,.82,n.y)).mul(smoothstep(100,420,p.y));
 const north=n.x.mul(-.57).add(n.z.mul(.82));
 const snowBreak=mx_fractal_noise_float(vec3(p.x.mul(.018),p.y.mul(.009),p.z.mul(.018)),4).mul(220);
 const gullySnow=smoothstep(430,850,p.y.add(macro.mul(120))).mul(smoothstep(.54,.66,bio.y)).mul(smoothstep(.2,.5,n.y));
 const snow=gullySnow.max(smoothstep(570,960,p.y.add(snowBreak).add(north.mul(160)).add(macro.mul(170))).mul(smoothstep(.4,.72,n.y)).max(smoothstep(1150,1450,p.y).mul(smoothstep(.35,.8,n.y))));
 const forest=bio.x.mul(smoothstep(27,42,p.y)),grass=ground(0,.24).rgb.mul(vec3(.68,.78,.59)),soil=ground(1,.18).rgb.mul(.5);
 // A continuous fine crown pattern under the far forest prevents isolated dots on bare slopes.
 const crownNoise=mx_fractal_noise_float(p.xz.mul(.18),3).mul(.45).add(.55),canopy=vec3(.038,.062,.035).mul(crownNoise.mul(.65).add(.6));
 const groundColor=mix(grass,mix(soil,canopy,far.mul(.87)),forest);
 const wet=smoothstep(22.2,25.8,p.y).mul(.55).add(.35),beach=ground(5,.42).rgb.mul(wet),shore=smoothstep(25.2,30,p.y).oneMinus();
 m.colorNode=mix(mix(mix(mix(groundColor,cliff,rock),ground(3,.045).rgb.mul(.82),scree.mul(.6)),ground(4,.16).rgb,snow),beach,shore);
 const rn=coords=>mix(tex(2,coords.mul(.09),true).xyz,tex(2,coords.mul(.011),true).xyz,far.mul(.5)).mul(2).sub(1),rx=rn(p.yz),ry=rn(p.xz),rz=rn(p.xy);
 const cliffN=vec3(0,rx.x,rx.y).mul(w.x).add(vec3(ry.x,0,ry.y).mul(w.y)).add(vec3(rz.x,rz.y,0).mul(w.z));
 const g=tex(0,p.xz.mul(.24),true),b=tex(5,p.xz.mul(.42),true),detail=mix(g,b,shore),gn=vec3(detail.x.mul(2).sub(1),0,detail.y.mul(2).sub(1));
 m.normalNode=n.add(mix(gn.mul(.3),cliffN.mul(film?.35:.95),rock).mul(snow.mul(-.6).add(1))).normalize().transformDirection(cameraViewMatrix);
 m.roughnessNode=mix(float(.92),float(.35),shore.mul(wet.oneMinus()));
 m.receivedShadowNode=Fn(([shadow])=>shadow.mul(bio.w).mul(film?film.cloudShadow:float(1)));return m;
}
export function createTerrain(scene,surfaces,film=null){
 const material=makeTerrainMaterial(surfaces,film),tiles=[],step=WORLD/16;
 function geometry(cx,cz,segments){const row=segments+1,count=row*row,verts=count+row*4,p=new Float32Array(verts*3),b=new Float32Array(verts*4),indices=new Uint32Array(segments*segments*6+segments*24);let o=0;
  for(let z=0;z<row;z++)for(let x=0;x<row;x++){const i=z*row+x,wx=cx+(x/segments-.5)*step,wz=cz+(z/segments-.5)*step;p.set([wx,height(wx,wz),wz],i*3);b.set(biome(wx,wz),i*4);if(x<segments&&z<segments){indices.set([i,i+row,i+1,i+1,i+row,i+row+1],o);o+=6;}}
  const edges=[i=>i,i=>segments*row+i,i=>i*row,i=>i*row+segments];let v=count;for(const edge of edges){let prior=-1;for(let j=0;j<row;j++){const top=edge(j);p.set([p[top*3],p[top*3+1]-25,p[top*3+2]],v*3);b.set(b.subarray(top*4,top*4+4),v*4);if(j){indices.set([edge(j-1),top,v,edge(j-1),v,prior],o);o+=6;}prior=v++;}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('biome',new THREE.BufferAttribute(b,4));g.setIndex(new THREE.BufferAttribute(indices,1));g.computeVertexNormals();const normals=g.attributes.normal;for(let i=0;i<verts;i++){const x=p[i*3],z=p[i*3+2],nx=height(x-3,z)-height(x+3,z),nz=height(x,z-3)-height(x,z+3),len=Math.hypot(nx,6,nz);normals.setXYZ(i,nx/len,6/len,nz/len);}g.computeBoundingSphere();return g;}
 for(let z=0;z<16;z++)for(let x=0;x<16;x++){const cx=(x+.5)*step-WORLD/2,cz=(z+.5)*step-WORLD/2,mesh=new THREE.Mesh(geometry(cx,cz,32),material);mesh.receiveShadow=true;mesh.castShadow=false;scene.add(mesh);tiles.push({cx,cz,mesh,level:32});}
 return {tiles,update(camera,ultra=false){for(const t of tiles){const d=Math.hypot(camera.position.x-t.cx,camera.position.z-t.cz),level=d<560?(ultra?256:128):d<4500?64:32;if(level!==t.level){const old=t.mesh.geometry;t.mesh.geometry=geometry(t.cx,t.cz,level);t.level=level;old.dispose();}}}};
}
export function makeHeightTexture(){const t=new THREE.DataTexture(generateHeightmap(),GRID,GRID,THREE.RedFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;}
