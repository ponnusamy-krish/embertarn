import bpy,json,math
import numpy as np
from pathlib import Path
from mathutils import Vector
from terrain import height,sample,shore,slope,ELEVATION_OFFSET,noise2
ROOT=Path(__file__).resolve().parent
def source_collection(name):
 c=bpy.data.collections.new('Embertarn source '+name);bpy.context.scene.collection.children.link(c);return c
def import_model(key,collection,tree_index=None,target_height=None,ratio=None):
 path=ROOT/'assets/models'/key/(key+'.gltf')
 if tree_index is not None:
  d=json.loads(path.read_text());chosen=d['nodes'][tree_index].copy();chosen.pop('translation',None);d['nodes']=[chosen];d['scenes']=[{'nodes':[0]}];d['scene']=0;path=path.with_name(key+f'_subset{tree_index}.gltf');path.write_text(json.dumps(d))
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=[o for o in bpy.data.objects if o not in before and o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name='Embertarn '+key+(str(tree_index) if tree_index is not None else '')
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 # Bake original offsets, place the model's root at its own origin.
 coords=np.empty(len(o.data.vertices)*3,dtype='float32');o.data.vertices.foreach_get('co',coords);v=coords.reshape(-1,3);lo=v.min(axis=0);hi=v.max(axis=0);v-=np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]],dtype='float32')
 if target_height:v*=target_height/(hi[2]-lo[2])
 o.data.vertices.foreach_set('co',v.ravel());o.data.update();o.location=(0,0,-20000)
 if ratio:
  dec=o.modifiers.new('Embertarn mesh LOD','DECIMATE');dec.ratio=ratio;bpy.ops.object.modifier_apply(modifier=dec.name)
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o)
 for m in o.data.materials:
  if m and m.use_nodes:
   for p in m.node_tree.nodes:
    if p.type=='BSDF_PRINCIPLED':
     p.inputs['Roughness'].default_value=.8
     alpha=list((ROOT/'assets/models'/key).glob('opacity.*'))
     if alpha and ('twig' in m.name.lower() or key in ['fern_02','grass_medium_01']):
      tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(alpha[0]),check_existing=True);tex.image.colorspace_settings.name='Non-Color';m.node_tree.links.new(tex.outputs['Color'],p.inputs['Alpha']);p.inputs['Subsurface Weight'].default_value=0
      for normal in m.node_tree.nodes:
       if normal.type=='NORMAL_MAP':normal.inputs['Strength'].default_value=.4
      original=p.inputs['Base Color'].links[0].from_socket if p.inputs['Base Color'].is_linked else None
      if original:
       hue=m.node_tree.nodes.new('ShaderNodeHueSaturation');random=m.node_tree.nodes.new('ShaderNodeObjectInfo');gain=m.node_tree.nodes.new('ShaderNodeMapRange');gain.inputs['To Min'].default_value=1.05;gain.inputs['To Max'].default_value=1.65;m.node_tree.links.new(random.outputs['Random'],gain.inputs['Value']);m.node_tree.links.new(gain.outputs[0],hue.inputs['Value']);m.node_tree.links.new(original,hue.inputs['Color']);m.node_tree.links.new(hue.outputs['Color'],p.inputs['Base Color'])
 # Delete import helper empties; mesh is already independent.
 o.parent=None
 for extra in list(bpy.data.objects):
  if extra not in before and extra!=o and extra.type=='EMPTY':bpy.data.objects.remove(extra,do_unlink=True)
 return o
def instances(name,collection,positions,scales,rotations,indices):
 mesh=bpy.data.meshes.new(name);mesh.vertices.add(len(positions));mesh.vertices.foreach_set('co',np.asarray(positions,dtype='float32').ravel());mesh.update()
 for key,kind,values in [('scale','FLOAT_VECTOR',scales),('rotation','FLOAT_VECTOR',rotations),('variant','INT',indices)]:
  attr=mesh.attributes.new(key,kind,'POINT');attr.data.foreach_set('value' if kind=='INT' else 'vector',np.asarray(values,dtype='int32' if kind=='INT' else 'float32').ravel())
 obj=bpy.data.objects.new('Embertarn '+name,mesh);bpy.context.collection.objects.link(obj);group=bpy.data.node_groups.new(name,'GeometryNodeTree');group.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');group.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry')
 nodes=group.nodes;links=group.links;inp=nodes.new('NodeGroupInput');out=nodes.new('NodeGroupOutput');info=nodes.new('GeometryNodeCollectionInfo');info.inputs['Collection'].default_value=collection;info.inputs['Separate Children'].default_value=True;info.inputs['Reset Children'].default_value=True;inst=nodes.new('GeometryNodeInstanceOnPoints');inst.inputs['Pick Instance'].default_value=True;links.new(inp.outputs['Geometry'],inst.inputs['Points']);links.new(info.outputs['Instances'],inst.inputs['Instance']);links.new(inst.outputs['Instances'],out.inputs['Geometry'])
 for key,kind,socket in [('scale','FLOAT_VECTOR','Scale'),('rotation','FLOAT_VECTOR','Rotation'),('variant','INT','Instance Index')]:
  n=nodes.new('GeometryNodeInputNamedAttribute');n.data_type=kind;n.inputs['Name'].default_value=key;links.new(n.outputs['Attribute'],inst.inputs[socket])
 obj.modifiers.new('Embertarn un-realized instances','NODES').node_group=group;return obj

def grass_tufts(rng):
 collection=source_collection('fine grass');verts=[];faces=[]
 for i in range(18):
  angle=rng.uniform(0,math.tau);blade_height=rng.uniform(.2,.55);bend=rng.uniform(.08,.3);origin=rng.uniform(-.12,.12,2);start=len(verts)
  for j in range(5):
   u=j/4;w=.018*(1-u)+.0002;cx=origin[0]+math.cos(angle)*bend*u*u;cy=origin[1]+math.sin(angle)*bend*u*u
   verts.extend([(cx-math.sin(angle)*w,cy+math.cos(angle)*w,blade_height*u),(cx+math.sin(angle)*w,cy-math.cos(angle)*w,blade_height*u)])
  faces.extend([(start+j*2,start+j*2+1,start+j*2+3,start+j*2+2) for j in range(4)])
 mesh=bpy.data.meshes.new('Embertarn curved blades');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Embertarn fine grass source',mesh);collection.objects.link(o);o.location.z=-20000
 from materials import material,node,connect,ramp
 m,t,p,out=material('living grass');random=node(t,'ShaderNodeObjectInfo');color=ramp(t,random.outputs['Random'],[(0,(.035,.065,.012,1)),(1,(.12,.17,.035,1))]);connect(t,color,p.inputs['Base Color']);p.inputs['Roughness'].default_value=.8;mesh.materials.append(m)
 positions=[];scales=[];rots=[]
 for cx,cz,count in [(-235,380,6000),(-180,300,10000),(-110,390,3000)]:
  x=rng.uniform(cx-28,cx+28,count);z=rng.uniform(cz-28,cz+28,count);keep=(sample(shore,x,z)>5)&(slope(x,z)<.6)&(noise2(x/7,z/7)>.43)
  for a,b in zip(x[keep],z[keep]):
   positions.append((a,-b,height(a,b)+ELEVATION_OFFSET-.03));s=rng.uniform(.5,1.5);scales.append((s,s,s));rots.append((0,0,rng.uniform(0,math.tau)))
 instances('fine grass along paths',collection,positions,scales,rots,np.zeros(len(positions),dtype='int32'))

def low_shrubs(rng):
 c=source_collection('low alpine shrubs');verts=[];faces=[]
 # Small curved leaves on a branching, low bush; true geometry, no opacity cards.
 for branch in range(9):
  angle=rng.uniform(0,math.tau);height=rng.uniform(.18,.42)
  for j in range(7):
   u=(j+1)/8;center=np.array([math.cos(angle)*.23*u,math.sin(angle)*.23*u,height*u])
   for side in [-1,1]:
    az=angle+side*1.2;length=rng.uniform(.035,.065);direction=np.array([math.cos(az),math.sin(az),.3]);across=np.array([-math.sin(az),math.cos(az),0]);start=len(verts)
    for k in range(5):
     v=k/4;width=math.sin(v*math.pi)*length*.32;mid=center+direction*length*v+np.array([0,0,.008*math.sin(v*math.pi)])
     verts.extend([tuple(mid-across*width),tuple(mid+across*width)])
    faces.extend([(start+k*2,start+k*2+1,start+k*2+3,start+k*2+2) for k in range(4)])
 mesh=bpy.data.meshes.new('Embertarn heather-like foliage');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Embertarn low shrub source',mesh);c.objects.link(o);o.location.z=-20000
 from materials import material,node,ramp,connect
 m,t,p,out=material('shrub leaves');random=node(t,'ShaderNodeObjectInfo');color=ramp(t,random.outputs['Random'],[(0,(.018,.045,.008,1)),(1,(.065,.1,.025,1))]);connect(t,color,p.inputs['Base Color']);p.inputs['Roughness'].default_value=.6;mesh.materials.append(m)
 positions=[];scales=[];rots=[]
 for cx,cz in [(-235,380),(-180,300)]:
  x=rng.uniform(cx-48,cx+48,18000);z=rng.uniform(cz-48,cz+48,18000);keep=(sample(shore,x,z)>9)&(noise2(x/12,z/12)>.38)&(slope(x,z)<.65)
  for a,b in zip(x[keep],z[keep]):
   positions.append((a,-b,__import__('terrain').height(a,b)+ELEVATION_OFFSET));s=rng.uniform(.8,2.2);scales.append((s,s,s));rots.append((0,0,rng.uniform(0,math.tau)))
 instances('clustered low shrubs',c,positions,scales,rots,np.zeros(len(positions),dtype='int32'))
def scatter(iteration=1):
 rng=np.random.default_rng(1122);far=source_collection('fir LOD');near=source_collection('fir near')
 tree=import_model('fir_tree_01',far,1,20,.12)
 # Three branching silhouettes from two actual botanical scans, plus scale variation.
 pine=import_model('pine_sapling_medium',far,2,13,.35)
 duplicate=tree.copy();duplicate.data=tree.data.copy();far.objects.link(duplicate);duplicate.name='Embertarn slender fir';co=np.empty(len(duplicate.data.vertices)*3,dtype='float32');duplicate.data.vertices.foreach_get('co',co);co=co.reshape(-1,3);co[:,0]*=.8;co[:,1]*=.8;co[:,2]*=1.12;duplicate.data.vertices.foreach_set('co',co.ravel())
 import_model('fir_tree_01',near,1,23,.35);import_model('fir_tree_01',near,2,18,None)
 x=rng.uniform(-2100,2100,1100000);z=rng.uniform(-2400,2400,1100000);y=sample(__import__('terrain').data,x,z);sl=slope(x,z);sd=sample(shore,x,z)
 cluster=np.clip((noise2(x/170,z/170)-.22)*1.7,.05,1);keep=(sd>7)&(y>24)&(y<520)&(sl<.9)&(rng.random(len(x))<cluster*np.clip((520-y)/180,0,1))
 # Clear a narrow footpath for all variations of the forest shot.
 keep&=~((x>-257)&(x<-208)&(z>355)&(z<408))
 keep&=~((x+180)**2+(z-300)**2<18**2)
 x=x[keep];z=z[keep];y=y[keep];scale=rng.uniform(.45,1.45,len(x))*np.clip((600-y)/350,.32,1)
 pos=np.column_stack([x,-z,y+ELEVATION_OFFSET-.35-np.clip(slope(x,z),0,1)*.4]);sc=np.column_stack([scale*rng.uniform(.85,1.12,len(x)),scale,scale]);rot=np.column_stack([np.zeros(len(x)),np.zeros(len(x)),rng.uniform(0,math.tau,len(x))]);idx=rng.integers(0,3,len(x))
 isnear=((x+235)**2+(z-380)**2<140**2)|((x-150)**2+(z-650)**2<90**2)
 instances('distant forest',far,pos[~isnear],sc[~isnear],rot[~isnear],idx[~isnear]);instances('near forest',near,pos[isnear],sc[isnear],rot[isnear],idx[isnear]%2)
 print('Forest',len(x),'near',isnear.sum(),flush=True)
 rocks=source_collection('shore stones');import_model('boulder_01',rocks,target_height=1.8);import_model('namaqualand_boulder_02',rocks,target_height=2.4)
 x=rng.uniform(-360,300,60000);z=rng.uniform(-850,900,60000);sd=sample(shore,x,z);keep=(sd>-17)&(sd<27);x=x[keep];z=z[keep];y=sample(__import__('terrain').data,x,z);s=.06+rng.random(len(x))**10*1.5
 positions=np.column_stack([x,-z,y+ELEVATION_OFFSET-s*.25]);scales=np.column_stack([s,s*rng.uniform(.7,1.5,len(s)),s*.75]);rots=np.column_stack([rng.uniform(-.25,.25,len(s)),rng.uniform(-.25,.25,len(s)),rng.uniform(0,math.tau,len(s))]);indices=rng.integers(0,2,len(s));instances('pebble beach and boulders',rocks,positions,scales,rots,indices)
 # Hero foreground stones make the close view read at a human scale.
 positions=[[-173,-295,height(-173,295)+ELEVATION_OFFSET-.5],[-164,-289,height(-164,289)+ELEVATION_OFFSET-.8]];instances('foreground stones',rocks,positions,[[1.2,1.4,.9],[1.4,1.8,1.2]],[[0,0,.7],[0,0,2]],[0,1])
 plants=source_collection('understory');import_model('fern_02',plants,0);import_model('grass_medium_01',plants,4);logs=source_collection('fallen timber');import_model('dead_tree_trunk',logs)
 positions=[];scales=[];rots=[];indices=[]
 for cx,cz in [(-235,380),(-180,300),(-110,390)]:
  xx=rng.uniform(cx-65,cx+65,30000);zz=rng.uniform(cz-65,cz+65,30000);yy=sample(__import__('terrain').data,xx,zz);keep=(sample(shore,xx,zz)>3)&(slope(xx,zz)<.8)&(noise2(xx/9,zz/9)>.35)
  for a,b,c in zip(xx[keep],zz[keep],yy[keep]):
   positions.append([a,-b,c+ELEVATION_OFFSET]);s=rng.uniform(.5,1.2);scales.append([s,s,s]);rots.append([0,0,rng.uniform(0,math.tau)]);indices.append(int(rng.random()>.7))
 instances('near-path ferns and grass',plants,positions,scales,rots,indices)
 instances('fallen logs',logs,[[160,-655,height(160,655)+ELEVATION_OFFSET],[-225,-370,height(-225,370)+ELEVATION_OFFSET]],[[1,1,1],[.8,.8,.8]],[[0,0,1.3],[0,0,.3]],[0,0])
 grass_tufts(rng)
 low_shrubs(rng)
 positions=[];scales=[];rots=[]
 for i in range(28):
  a=rng.uniform(-280,-170);b=rng.uniform(310,420)
  if sample(shore,a,b)<12:continue
  positions.append((a,-b,height(a,b)+ELEVATION_OFFSET-.12));s=rng.uniform(.12,.6);scales.append((s,s,s));rots.append((0,0,rng.uniform(0,math.tau)))
 instances('fallen branches in forest',logs,positions,scales,rots,np.zeros(len(positions),dtype='int32'))
 return {'forest':len(x),'plants':len(positions)}
