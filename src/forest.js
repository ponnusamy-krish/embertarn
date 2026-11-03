import * as THREE from 'three/webgpu';
import {Fn,cameraViewMatrix,attribute,positionLocal,cameraPosition,vec2,vec3,float,texture,uv,mix,sin,cos,uniform,smoothstep} from 'three/tsl';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random,height,biome,shoreDistance,fbm,smooth} from './math.js';
import {inCameraCorridor} from './cinematic.js';
export async function createForest(scene,manager,time){
 const loader=new THREE.TextureLoader(manager),albedo=await loader.loadAsync('/assets/fir-octa/albedo.png'),normals=await loader.loadAsync('/assets/fir-octa/normal.png');albedo.colorSpace=THREE.SRGBColorSpace;for(const t of [albedo,normals]){t.anisotropy=4;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;}
 const trees=[],rand=random(221),buckets=new Map();
 for(let i=0;i<440000;i++){const x=(rand()-.5)*5000,z=(rand()-.5)*5400,y=height(x,z),b=biome(x,z),cluster=.35+fbm(x*.006,z*.006,3);
  if(shoreDistance(x,z)<4||y<24||y>570||inCameraCorridor(x,z,13)||rand()>b[0]*cluster*.95)continue;
  const s=(.7+rand()*.65)*(1-smooth(290,580,y)*.72),a=rand()*Math.PI*2;
  trees.push({x,y:y-1.2,z,s,a,sun:b[3],color:new THREE.Color().setHSL(.24+rand()*.05,.2+rand()*.1,.66+rand()*.23)});
 }
 const data=attribute('treeData','vec4'),angle=attribute('treeAngle'),sunVis=attribute('sunVis'),center=data.xyz.add(vec3(0,data.w.mul(11),0)),view=cameraPosition.sub(center).normalize(),right=vec3(view.z,0,view.x.negate()).normalize(),up=view.cross(right).normalize();
 const corner=attribute('position'),sway=sin(time.mul(.55).add(data.x.mul(.11))).mul(.035).mul(corner.y.div(28).add(.5).pow(2));
 const localView=vec3(view.x.mul(cos(angle)).sub(view.z.mul(sin(angle))),view.y.abs(),view.x.mul(sin(angle)).add(view.z.mul(cos(angle))));
 const oct=localView.div(localView.abs().dot(vec3(1))),octUV=vec2(oct.x.add(oct.z),oct.x.sub(oct.z)).mul(.5).add(.5),frame=octUV.mul(3).round().clamp(0,3);
 // PNG rows are top-down; the Three texture UV origin is bottom-left.
 const atlasUV=vec2(frame.x.add(uv().x),float(3).sub(frame.y).add(uv().y)).div(4),aTex=texture(albedo,atlasUV),nTex=texture(normals,atlasUV).xyz.mul(2).sub(1);
 const normal=vec3(nTex.x.mul(cos(angle)).add(nTex.z.mul(sin(angle))),nTex.y,nTex.z.mul(cos(angle)).sub(nTex.x.mul(sin(angle)))).normalize(),sun=vec3(-.815,.122,.565).normalize();
 const lit=vec3(.36,.48,.66).add(vec3(2.6,1.55,.72).mul(normal.dot(sun).max(0)).mul(sunVis));
 const rim=view.dot(sun.negate()).max(0).pow(5).mul(.4).mul(sunVis),ao=uv().x.sub(.5).abs().mul(.45).add(.77);
 const material=new THREE.MeshStandardNodeMaterial({alphaTest:.12,side:THREE.DoubleSide,roughness:.95,envMapIntensity:.4});material.colorNode=aTex.rgb.mul(vec3(.28,.42,.3));material.opacityNode=aTex.a;material.normalNode=normal.transformDirection(cameraViewMatrix);material.aoNode=ao;material.emissiveNode=aTex.rgb.mul(vec3(1.1,.68,.25)).mul(rim);material.receivedShadowNode=Fn(([shadow])=>shadow.mul(sunVis));
 material.positionNode=center.add(right.mul(corner.x.mul(.65).add(sway)).mul(data.w)).add(up.mul(corner.y).mul(data.w));
 const base=new THREE.PlaneGeometry(16,28),dummy=new THREE.Object3D(),chunks=[];
 for(const t of trees){const key=`${Math.floor(t.x/260)},${Math.floor(t.z/260)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(t);}
 for(const list of buckets.values()){const geo=base.clone(),d=new Float32Array(list.length*4),angles=new Float32Array(list.length),lights=new Float32Array(list.length),mesh=new THREE.InstancedMesh(geo,material,list.length);
  list.forEach((t,i)=>{d.set([t.x,t.y,t.z,t.s],i*4);angles[i]=t.a;lights[i]=t.sun;dummy.position.set(t.x,t.y+11*t.s,t.z);dummy.scale.setScalar(t.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,t.color);t.draw={mesh,index:i,d};});geo.setAttribute('treeData',new THREE.InstancedBufferAttribute(d,4));geo.setAttribute('treeAngle',new THREE.InstancedBufferAttribute(angles,1));geo.setAttribute('sunVis',new THREE.InstancedBufferAttribute(lights,1));mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.boundingSphere.radius+=28;scene.add(mesh);chunks.push(mesh);
 }
 const scan=await new GLTFLoader(manager).loadAsync('/assets/fir-tree-lod.glb');scan.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scan.scene),factor=22/(bounds.max.y-bounds.min.y),real=[];const count=6;
 scan.scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.translate(0,-bounds.min.y,0);g.scale(factor*.65,factor,factor);g.setAttribute('sunVisReal',new THREE.InstancedBufferAttribute(new Float32Array(count),1));const m=new THREE.MeshStandardNodeMaterial();THREE.MeshStandardMaterial.prototype.copy.call(m,o.material);m.envMapIntensity=.4;m.color.multiply(new THREE.Color(.28,.42,.3));m.receivedShadowNode=Fn(([shadow])=>shadow.mul(attribute('sunVisReal')));const mesh=new THREE.InstancedMesh(g,m,count);mesh.count=0;mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;scene.add(mesh);real.push(mesh);});
 // Cheap shadow-only volumes for the nearest scanned crowns.
 const crown=new THREE.ConeGeometry(2.8,16,8);crown.translate(0,14,0);const trunk=new THREE.CylinderGeometry(.08,.3,20,6);trunk.translate(0,10,0);const proxy=new THREE.InstancedMesh(mergeGeometries([crown,trunk]),new THREE.MeshBasicNodeMaterial({colorWrite:false,depthWrite:false}),count);proxy.castShadow=true;proxy.count=0;proxy.frustumCulled=false;scene.add(proxy);real.push(proxy);
 let selected=[],previous=new THREE.Vector3(Infinity,0,0),rotation=new THREE.Quaternion();
 const restore=t=>{t.draw.d[t.draw.index*4+3]=t.s;t.draw.mesh.geometry.attributes.treeData.needsUpdate=true;};
 const nearby=(x,z)=>{const result=[],cx=Math.floor(x/260),cz=Math.floor(z/260);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const list=buckets.get(`${cx+dx},${cz+dz}`);if(list)result.push(...list);}return result;};
 return{trees,nearby,counts:{trees:trees.length,forestChunks:chunks.length,scannedTreeLOD:count,octahedralViews:16},update(camera,force=false){if(!force&&previous.distanceTo(camera.position)<8&&rotation.angleTo(camera.quaternion)<.1)return;previous.copy(camera.position);rotation.copy(camera.quaternion);selected.forEach(restore);const forward=camera.getWorldDirection(new THREE.Vector3());selected=nearby(camera.position.x,camera.position.z).map(t=>({t,d:Math.hypot(camera.position.x-t.x,camera.position.y-t.y-11,camera.position.z-t.z)})).filter(v=>v.d<125&&(v.t.x-camera.position.x)*forward.x+(v.t.z-camera.position.z)*forward.z>0).sort((a,b)=>a.d-b.d).slice(0,count).map(v=>v.t);
  for(const m of real)m.count=selected.length;selected.forEach((t,i)=>{t.draw.d[t.draw.index*4+3]=0;t.draw.mesh.geometry.attributes.treeData.needsUpdate=true;dummy.position.set(t.x,t.y,t.z);dummy.rotation.y=t.a;dummy.scale.setScalar(t.s);dummy.updateMatrix();for(const m of real){m.setMatrixAt(i,dummy.matrix);m.instanceMatrix.needsUpdate=true;const a=m.geometry.attributes.sunVisReal;if(a){a.setX(i,t.sun);a.needsUpdate=true;}}});
 }};
}
