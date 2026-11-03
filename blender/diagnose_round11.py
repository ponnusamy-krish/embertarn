from pathlib import Path
import bpy,sys,json,math
R=Path(__file__).resolve().parent;sys.path.insert(0,str(R))
from render import gpu,apply_config
import shots
s=bpy.context.scene;gpu(s);apply_config(s,json.loads((R/'render-settings.json').read_text()))
out=R/'stills/diagnostic11';out.mkdir(parents=True,exist_ok=True)
s.render.resolution_percentage=34;s.cycles.samples=16;s.render.image_settings.file_format='PNG';s.render.image_settings.compression=15
camera=bpy.data.objects['Embertarn camera 8'];s.camera=camera
audit=[]
for t in [1355.75,1356,1359.75,1360,1360.25,1364]:
 s.frame_set(int(t),subframe=t%1);audit.append({'frame':t,'camera':s.camera.name,'location':list(camera.location),'euler':list(camera.rotation_euler),'quaternion':list(camera.matrix_world.to_quaternion())})
(out/'camera.json').write_text(json.dumps(audit,indent=2))
s.frame_set(1360);s.camera=camera;s.view_settings.exposure=shots.SHOTS[8]['exposure']
for name,blur,fog,composite in [('original',True,True,True),('no_blur',False,True,True),('no_fog',False,False,True),('raw',False,False,False)]:
 s.render.use_motion_blur=blur;bpy.data.objects['Embertarn height atmosphere'].hide_render=not fog;s.render.use_compositing=composite;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('DIAGNOSTIC_COMPLETE',flush=True)
