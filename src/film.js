import * as THREE from 'three/webgpu';
import {uniform,vec3,positionWorld,positionView,fog,mx_fractal_noise_float,attribute,sin,cos,uv,smoothstep,mix,cameraPosition} from 'three/tsl';
import {height,noise,random,shoreDistance} from './math.js';

export const FILM_DURATION=300, SHOT_DURATION=300/45;
// Lake/drone viewpoints keep the camera above canopies or inside open water.
const views=[
 [[60,95,620],[-100,220,-1400],44],
 [[-30,38,200],[-220,100,-850],50],
 [[350,420,850],[-240,220,-800],40],
 [[-100,75,-180],[-400,100,700],48],
 [[450,650,-250],[-450,260,200],42],
 [[-100,34,440],[-180,35,260],48],
 [[-450,650,200],[180,160,-550],43],
 [[220,850,1250],[-250,250,-1600],39],
 [[20,45,-360],[-420,95,700],46],
];
export const filmShots=Array.from({length:45},(_,i)=>({index:i,start:i*SHOT_DURATION,duration:SHOT_DURATION,crossfade:i>0&&i%7===0?.65:0,view:i%9}));
export function filmPose(t,override){
 const index=override??Math.min(44,Math.floor(Math.max(0,t)/SHOT_DURATION));
 const shot=filmShots[index],u=THREE.MathUtils.clamp((t-shot.start)/SHOT_DURATION,0,1),e=u*u*(3-2*u),cycle=Math.floor(index/9);
 const [p,q,fov]=views[shot.view],position=new THREE.Vector3(...p),target=new THREE.Vector3(...q);
 position.x+=(cycle-2)*17+(e-.5)*(shot.view%2?36:70);
 position.z+=(cycle-2)*12+(e-.5)*38;
 position.y+=(e-.5)*8;
 position.y=Math.max(position.y,height(position.x,position.z)+(shoreDistance(position.x,position.z)>0?38:3),30);
 const shake=(seed,freq,amp)=>(noise(t*freq,seed)-.5)*amp;
 position.add(new THREE.Vector3(shake(1,.7,.15),shake(2,.65,.12),shake(3,.6,.15)));
 target.x+=shake(4,.55,1.2);target.y+=shake(5,.7,.8);
 return {position,target,fov:fov+cycle*.6,index,focus:shot.view===5?95:1600,dof:shot.view===5?1:0,fade:shot.crossfade?Math.max(0,1-(t-shot.start)/shot.crossfade):0};
}
export function createFilm(scene,time){
 const state={focus:uniform(1600),dof:uniform(0),sunUV:uniform(new THREE.Vector2(-2,-2)),glare:uniform(0),time};
 const d=positionView.z.negate(),low=positionWorld.y.sub(22).max(0).mul(-.006).exp();
 const towardSun=positionWorld.sub(cameraPosition).normalize().dot(vec3(-.815,.087,.565)).max(0).pow(3);
 scene.fogNode=fog(mix(vec3(.185,.235,.275),vec3(.38,.285,.19),towardSun),d.mul(.00025).add(d.mul(.00008).mul(low)).negate().exp().oneMinus().clamp(0,.9));
 const mistMaterial=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});mistMaterial.colorNode=vec3(.56,.57,.51);mistMaterial.opacityNode=mx_fractal_noise_float(positionWorld.xz.mul(.009).add(vec3(time.mul(.006),0,0).xz),3).add(.3).clamp(0,1).mul(smoothstep(.2,.5,uv().sub(.5).length()).oneMinus()).mul(.09);const mist=new THREE.Mesh(new THREE.PlaneGeometry(480,1400),mistMaterial);mist.rotation.x=-Math.PI/2;mist.position.y=25;scene.add(mist);
 const rand=random(144),positions=new Float32Array(280*3);
 for(let i=0;i<280;i++)positions.set([(rand()-.5)*500,24+rand()*22,(rand()-.5)*1000],i*3);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const mat=new THREE.PointsNodeMaterial({color:0xffd99a,size:.12,transparent:true,opacity:.23,depthWrite:false,sizeAttenuation:true});
 const p=attribute('position');mat.positionNode=p.add(vec3(sin(time.mul(.12).add(p.z)).mul(3),sin(time.mul(.3).add(p.x)).mul(1.4),cos(time.mul(.08).add(p.x)).mul(4)));
 scene.add(new THREE.Points(geo,mat));
 state.cloudShadow=mx_fractal_noise_float(positionWorld.xz.mul(.0008).add(time.mul(.00007)),3).mul(.12).add(.84);
 state.update=(camera,t,override)=>{const pose=filmPose(t,override);camera.position.copy(pose.position);camera.fov=pose.fov;camera.updateProjectionMatrix();camera.lookAt(pose.target);camera.rotateZ((noise(t*.3,91)-.5)*.0015);camera.updateMatrixWorld();state.focus.value=pose.focus;state.dof.value=pose.dof;
  const sun=new THREE.Vector3(-.815,.087,.565).normalize();const forward=camera.getWorldDirection(new THREE.Vector3());const facing=forward.dot(sun);const projected=camera.position.clone().addScaledVector(sun,8000).project(camera);state.sunUV.value.set(projected.x*.5+.5,.5-projected.y*.5);state.glare.value=facing>.7?Math.max(0,1-Math.abs(projected.x))*Math.max(0,1-Math.abs(projected.y))*.12:0;return pose;};
 return state;
}

// Accumulate decoded display-linear RGB, never gamma-encoded bytes. Bounded RAM:
// one Float32 RGB sum and two RGBA8 canvases, independent of the sub-frame count.
export function filmAccumulator(source){
 const w=source.width,h=source.height,read=document.createElement('canvas'),out=document.createElement('canvas');read.width=out.width=w;read.height=out.height=h;
 out.id='film-output';Object.assign(out.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'1000',pointerEvents:'none'});document.body.appendChild(out);
 const ctx=read.getContext('2d',{willReadFrequently:true}),dest=out.getContext('2d'),sum=new Float32Array(w*h*3),linear=Float32Array.from({length:256},(_,i)=>{const v=i/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 return {reset(){sum.fill(0);},add(weight){ctx.drawImage(source,0,0);const a=ctx.getImageData(0,0,w,h).data;for(let i=0,j=0;i<a.length;i+=4,j+=3){sum[j]+=linear[a[i]]*weight;sum[j+1]+=linear[a[i+1]]*weight;sum[j+2]+=linear[a[i+2]]*weight;}},finish(){const image=dest.createImageData(w,h);for(let i=0,j=0;i<image.data.length;i+=4,j+=3){for(let c=0;c<3;c++){const v=Math.max(0,sum[j+c]);image.data[i+c]=255*(v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055);}image.data[i+3]=255;}dest.putImageData(image,0,0);},png(){return out.toDataURL('image/png').split(',')[1];}};
}
export function halton(i,base){let f=1,r=0;while(i){f/=base;r+=f*(i%base);i=Math.floor(i/base);}return r;}
