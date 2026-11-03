"""Audit every shutter boundary; render representative cut endpoints at 640px."""
from pathlib import Path
import sys,json,math
import bpy
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R))
import shots
from render import gpu,apply_config
s=bpy.context.scene;gpu(s);apply_config(s,json.loads((R/'render-settings.json').read_text()));out=R/'stills/cuts11';out.mkdir(parents=True,exist_ok=True)
records=[]
for shot in shots.SHOTS:
 camera=bpy.data.objects['Embertarn camera '+str(shot['index'])]
 assert camera.rotation_mode=='QUATERNION'
 for frame in [shot['start'],shot['end'],(shot['start']+shot['end'])//2]:
  qs=[];ps=[]
  for offset in [-.25,.25]:
   t=frame+offset;s.frame_set(math.floor(t),subframe=t%1);qs.append(camera.matrix_world.to_quaternion());ps.append(camera.matrix_world.translation.copy())
  angle=math.degrees(qs[0].rotation_difference(qs[1]).angle);angle=min(angle,360-angle)
  assert angle<.5,(shot['index'],frame,angle)
  records.append({'shot':shot['index'],'frame':frame,'shutter_angle_degrees':angle,'translation_metres':(ps[0]-ps[1]).length,'blur_guard':frame in (shot['start'],shot['end'])})
# Explicitly sample the formerly broken fractional shutter interval.
camera=bpy.data.objects['Embertarn camera 8'];qs=[]
for t in [1359.75,1360.25]:s.frame_set(math.floor(t),subframe=t%1);qs.append(camera.matrix_world.to_quaternion())
angle=math.degrees(qs[0].rotation_difference(qs[1]).angle);angle=min(angle,360-angle);assert angle<.5
(out/'audit.json').write_text(json.dumps({'shots_checked':45,'boundary_and_midpoint_checks':records,'frame1360_shutter_degrees':angle,'max_shutter_degrees':max(r['shutter_angle_degrees'] for r in records)},indent=2))
s.render.resolution_x=640;s.render.resolution_y=360;s.render.resolution_percentage=100;s.cycles.samples=8;s.render.use_motion_blur=False;s.render.image_settings.compression=15
for index in [0,1,2,3,8,9,44]:
 shot=shots.SHOTS[index]
 for frame in [shot['start'],shot['end']]:
  s.frame_set(frame);s.camera=bpy.data.objects['Embertarn camera '+str(index)];s.view_settings.exposure=shot['exposure'];s.render.filepath=str(out/f'f_{frame:06d}.png');bpy.ops.render.render(write_still=True)
print('ALL_CUTS_PASS',flush=True)
