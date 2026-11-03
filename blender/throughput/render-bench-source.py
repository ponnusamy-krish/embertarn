"""Cycles OptiX frame-level resume. Inclusive [start,end], atomic valid PNGs."""
from pathlib import Path
import sys,argparse,json,os,time,hashlib,struct,zlib
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
import bpy,shots
def gpu(scene, hybrid=False):
 p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices_for_type('OPTIX')
 for d in p.devices:d.use=d.type=='OPTIX' or (hybrid and d.type=='CPU')
 selected=[d.name for d in p.devices if d.use]
 if not selected:raise RuntimeError('No OptiX GPU found; CPU fallback prohibited')
 scene.cycles.device='GPU';scene.cycles.denoiser='OPTIX';scene.cycles.denoising_use_gpu=True;print('OPTIX',selected,flush=True)
from frameio import valid_png

def atomic(path,data):
 tmp=path.with_name(path.name+'.partial')
 with open(tmp,'w') as f:json.dump(data,f,indent=2);f.flush();os.fsync(f.fileno())
 os.replace(tmp,path)
def apply_config(scene,c):
 scene.render.use_persistent_data=c.get('persistent',True)
 scene.render.image_settings.compression=c.get('compression',15)
 scene.cycles.denoiser=c.get('denoiser','OPTIX')
 for key in ['adaptive_threshold','adaptive_min_samples','max_bounces','diffuse_bounces','glossy_bounces','transmission_bounces','tile_size']:
  if key in c:setattr(scene.cycles,key,c[key])
 if c.get('camera_only_blur',False):
  for o in scene.objects:
   if o.type!='CAMERA' and hasattr(o,'cycles'):
    if hasattr(o.cycles,'use_motion_blur'):o.cycles.use_motion_blur=False
    if hasattr(o.cycles,'use_deform_motion'):o.cycles.use_deform_motion=False
 if 'compositor_device' in c:scene.render.compositor_device=c['compositor_device']
 print('CONFIG',json.dumps(c),flush=True)

def main():
 p=argparse.ArgumentParser();p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=7199);p.add_argument('--frames');p.add_argument('--outdir',default=str(ROOT/'frames'));p.add_argument('--samples',type=int);p.add_argument('--engine',choices=['CYCLES','BLENDER_EEVEE']);p.add_argument('--config');p.add_argument('--stride',type=int,default=1);p.add_argument('--offset',type=int,default=0);a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 if bpy.app.version[:3]!=(5,2,2):raise RuntimeError('Blender 5.2.2 required')
 frames=list(map(int,a.frames.split(','))) if a.frames else range(a.start,a.end+1)
 if any(f<0 or f>=7200 for f in frames):raise ValueError('Frame range 0..7199')
 config=json.loads(Path(a.config).read_text()) if a.config else json.loads((ROOT/'render-settings.json').read_text()) if (ROOT/'render-settings.json').exists() else {}
 scene=bpy.context.scene;gpu(scene,config.get('hybrid',False));apply_config(scene,config);out=Path(a.outdir).resolve();out.mkdir(parents=True,exist_ok=True);sha=hashlib.sha256()
 with open(bpy.data.filepath,'rb') as f:
  for b in iter(lambda:f.read(1048576),b''):sha.update(b)
 signature={'renderer':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'blend':sha.hexdigest(),'blender':bpy.app.version_string,'config':config,'samples':a.samples,'engine':a.engine,'shots':shots.SHOTS,'size':[1920,1080],'fps':24}
 manifest=out/'manifest.json'
 import fcntl
 with open(out/'.manifest.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  if manifest.exists() and json.loads(manifest.read_text())!=signature:raise RuntimeError('Different scene/settings: choose a new output directory')
  atomic(manifest,signature)
 frames=[f for f in frames if f%a.stride==a.offset];rendered=skipped=0;seconds=0
 for frame in frames:
  target=out/f'f_{frame:06d}.png'
  if valid_png(target):skipped+=1;print('SKIP',frame,flush=True);continue
  start=time.perf_counter();shot=shots.SHOTS[min(44,frame//160)];engine=a.engine or shot['engine']
  if scene.render.engine!=engine or not config.get('reuse_engine',False):scene.render.engine=engine
  scene.cycles.samples=a.samples or shot['samples'];camera=bpy.data.objects['Embertarn camera '+str(shot['index'])]
  if scene.camera!=camera:scene.camera=camera
  scene.frame_set(frame);scene.cycles.seed=frame+53;scene.view_settings.exposure=shot['exposure']
  if scene.render.engine=='BLENDER_EEVEE':scene.eevee.use_raytracing=True;scene.eevee.taa_render_samples=a.samples or shot['samples']
  evaluated=time.perf_counter();print('PROFILE_EVALUATED',frame,evaluated-start,flush=True)
  tmp=target.with_name(target.stem+'.partial.png');scene.render.filepath=str(tmp);bpy.ops.render.render(write_still=False);traced=time.perf_counter();bpy.data.images['Render Result'].save_render(str(tmp),scene=scene);saved=time.perf_counter()
  if not valid_png(tmp):raise RuntimeError('Invalid rendered PNG')
  with open(tmp,'rb') as f:os.fsync(f.fileno())
  os.replace(tmp,target);elapsed=time.perf_counter()-start;seconds+=elapsed;rendered+=1
  atomic(out/f'progress-{a.offset}.json',{'updated':time.time(),'last':frame,'rendered_this_run':rendered,'skipped_this_run':skipped,'mean_seconds':seconds/rendered,'frame_seconds':elapsed,'engine':scene.render.engine,'samples':scene.cycles.samples,'remaining_range':sum(not valid_png(out/f'f_{i:06d}.png') for i in frames) if len(frames)<30 else len(frames)-rendered-skipped})
  with open(out/f'timings-{a.offset}.jsonl','a') as f:f.write(json.dumps({'frame':frame,'seconds':elapsed,'evaluation':evaluated-start,'render':traced-evaluated,'save':saved-traced,'validation':time.perf_counter()-saved,'engine':scene.render.engine,'samples':scene.cycles.samples})+'\n')
  print('FRAME',frame,f'{elapsed:.3f}',flush=True)
 print('COMPLETE',rendered,'SKIPPED',skipped,flush=True)
if __name__=='__main__':main()
