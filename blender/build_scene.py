"""Build the complete Embertarn landscape, using bounded tiles and GN instances."""
from pathlib import Path
import sys,os,argparse,json,math,time,subprocess
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT))
import bpy,numpy as np
from mathutils import Vector,Quaternion
import terrain,materials,vegetation,shots
def main():
 if sys.platform=='win32':raise RuntimeError('Full scene builds are cloud-only. Do not run on the local PC.')
 if not (ROOT/'erosion/DONE').exists():raise RuntimeError('Run python3 erode.py before building the scene')
 parser=argparse.ArgumentParser();parser.add_argument('--out',default=str(ROOT/'embertarn.blend'));parser.add_argument('--iteration',type=int,default=1);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 if bpy.app.version[:3]!=(5,2,2):raise RuntimeError('Exact Blender 5.2.2 required')
 bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.name='Embertarn';scene['embertarn_version']=5;scene['look_iteration']=args.iteration;scene.unit_settings.system='METRIC'
 scene.render.engine='CYCLES';scene.cycles.device='GPU';scene.cycles.samples=64;scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.045;scene.cycles.adaptive_min_samples=8;scene.cycles.use_denoising=True;scene.cycles.denoiser='OPTIX';scene.cycles.denoising_use_gpu=True;scene.cycles.max_bounces=6;scene.cycles.diffuse_bounces=2;scene.cycles.glossy_bounces=3;scene.cycles.transmission_bounces=6;scene.cycles.volume_bounces=1;scene.cycles.transparent_max_bounces=16;scene.cycles.sample_clamp_indirect=3;scene.render.use_persistent_data=True
 scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.fps=24;scene.frame_start=0;scene.frame_end=7199;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='16';scene.render.image_settings.color_mode='RGB';scene.render.use_motion_blur=True;scene.render.motion_blur_shutter=.5;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.85
 terrain.build(materials.terrain_material(args.iteration));vegetation.scatter(args.iteration)
 subprocess.run(['python3',str(ROOT/'prepare_water.py')],check=True)
 outline=json.loads((ROOT/'erosion/water-shell.json').read_text())['worldOutline'];top=[(x,-z,1884) for x,z in outline];bottom=[(x,-z,1838) for x,z in outline];n=len(top);faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];m=bpy.data.meshes.new('Embertarn water volume');m.from_pydata(top+bottom,[],faces);m.update();lake=bpy.data.objects.new('Embertarn lake',m);scene.collection.objects.link(lake);bpy.context.view_layer.objects.active=lake;lake.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');lake.select_set(False);lake.data.materials.append(materials.water_material())
 world=bpy.data.worlds.new('Embertarn golden hour');world.use_nodes=True;scene.world=world;t=world.node_tree;t.nodes.clear();out=t.nodes.new('ShaderNodeOutputWorld');bg=t.nodes.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=1.1;env=t.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'assets/table_mountain_2_puresky.hdr'));coord=t.nodes.new('ShaderNodeTexCoord');mapping=t.nodes.new('ShaderNodeMapping');t.links.new(coord.outputs['Generated'],mapping.inputs['Vector']);t.links.new(mapping.outputs[0],env.inputs[0]);t.links.new(env.outputs[0],bg.inputs[0]);t.links.new(bg.outputs[0],out.inputs[0])
 # Find the photographic sun's azimuth and align the direct sun to it.
 width,height=env.image.size;pixels=np.empty(width*height*4,dtype='float32');env.image.pixels.foreach_get(pixels);small=pixels.reshape(height,width,4)[::8,::8,:3];r,c=np.unravel_index(np.argmax(small.sum(axis=2)),small.shape[:2]);phi=(c*8/width-.5)*2*math.pi;direction=Vector((-.815,-.565,.113)).normalized();mapping.inputs['Rotation'].default_value[2]=phi-math.atan2(direction.y,direction.x);del pixels,small
 sun_data=bpy.data.lights.new('Embertarn sun','SUN');sun_data.energy=4.5;sun_data.color=(1,.50,.25);sun_data.angle=math.radians(.65);sun=bpy.data.objects.new('Embertarn sun',sun_data);scene.collection.objects.link(sun);sun.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
 bpy.ops.mesh.primitive_cube_add(size=2,location=(0,0,2600));fog=bpy.context.object;fog.name='Embertarn height atmosphere';fog.scale=(5400,5400,850);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);fog.data.materials.append(materials.fog_material())
 for shot in shots.SHOTS:
  camera_data=bpy.data.cameras.new('Embertarn lens '+str(shot['index']));camera_data.clip_end=25000;camera_data.clip_start=.08;camera_data.sensor_width=36;camera=bpy.data.objects.new('Embertarn camera '+str(shot['index']),camera_data);scene.collection.objects.link(camera);camera.rotation_mode='QUATERNION';previous=None
  for frame in list(range(shot['start'],shot['end']+1,4))+[shot['end']]:
   pos,target,lens,kind=shots.pose(frame,terrain.height);camera.location=pos;q=(Vector(target)-Vector(pos)).to_track_quat('-Z','Y')@Quaternion((0,0,1),.0006*math.sin(frame*.03))
   if previous is not None and previous.dot(q)<0:q.negate()
   camera.rotation_quaternion=q;previous=q.copy();camera_data.lens=lens;camera.keyframe_insert('location',frame=frame);camera.keyframe_insert('rotation_quaternion',frame=frame)
  camera_data.dof.use_dof=kind in ('close','forest');camera_data.dof.focus_distance=(Vector(target)-Vector(pos)).length;camera_data.dof.aperture_fstop=5.6 if kind=='close' else 8
  marker=scene.timeline_markers.new(f'{shot["index"]+1:02d} / {shot["name"]}',frame=shot['start']);marker.camera=camera
 scene.camera=bpy.data.objects['Embertarn camera 0'];scene.frame_set(0)
 # Blender 5.2 compositor uses an explicit node group.
 group=bpy.data.node_groups.new('Embertarn photographic finish','CompositorNodeTree');group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');scene.compositing_node_group=group;rl=group.nodes.new('CompositorNodeRLayers');glare=group.nodes.new('CompositorNodeGlare');glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='Medium';glare.inputs['Threshold'].default_value=1.5;glare.inputs['Strength'].default_value=.08;output=group.nodes.new('NodeGroupOutput');group.links.new(rl.outputs['Image'],glare.inputs['Image']);group.links.new(glare.outputs['Image'],output.inputs['Image'])
 # Relative external assets make the blend portable without embedding duplicates.
 for image in bpy.data.images:
  if image.filepath:image.filepath=bpy.path.relpath(image.filepath,start=str(ROOT))
 scene['build_sources']='Poly Haven CC0 + attributed Terrain Tiles and OSM geographic data';scene['source_water_level']=1884.0
 path=Path(args.out).resolve();path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_name(path.stem+'.partial.blend');bpy.ops.wm.save_as_mainfile(filepath=str(temp),compress=True);os.replace(temp,path);print('BUILD_COMPLETE',path,flush=True)
if __name__=='__main__':main()
