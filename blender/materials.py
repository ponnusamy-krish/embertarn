from pathlib import Path
import json,math
import bpy
ROOT=Path(__file__).resolve().parent
def node(tree,kind,name=None):
 n=tree.nodes.new(kind)
 if name:n.name=name
 return n
def connect(tree,value,socket):
 if hasattr(value,'is_output'):tree.links.new(value,socket)
 else:socket.default_value=value
def mathn(t,op,*values):
 n=node(t,'ShaderNodeMath');n.operation=op
 for i,v in enumerate(values):connect(t,v,n.inputs[i])
 return n.outputs[0]
def mix(t,f,a,b):
 n=node(t,'ShaderNodeMixRGB');connect(t,f,n.inputs[0]);connect(t,a,n.inputs[1]);connect(t,b,n.inputs[2]);return n.outputs[0]
def ramp(t,value,stops):
 n=node(t,'ShaderNodeValToRGB');connect(t,value,n.inputs[0]);r=n.color_ramp;r.elements.remove(r.elements[1]);r.elements[0].position=stops[0][0];r.elements[0].color=stops[0][1]
 for p,c in stops[1:]:r.elements.new(p).color=c
 return n.outputs[0]
def noise(t,position,scale,detail=4):
 n=node(t,'ShaderNodeTexNoise');connect(t,position,n.inputs['Vector']);n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=detail;n.inputs['Roughness'].default_value=.7;return n.outputs['Fac']
def material(name):
 m=bpy.data.materials.new('Embertarn '+name);m.use_nodes=True;t=m.node_tree;t.nodes.clear();p=node(t,'ShaderNodeBsdfPrincipled');o=node(t,'ShaderNodeOutputMaterial');t.links.new(p.outputs[0],o.inputs['Surface']);return m,t,p,o
def terrain_material(iteration=4):
 m,t,p,out=material('alpine geology');m.displacement_method='BUMP';m.max_vertex_displacement=14
 g=node(t,'ShaderNodeNewGeometry');pos=g.outputs['Position'];sep=node(t,'ShaderNodeSeparateXYZ');connect(t,pos,sep.inputs[0]);h=mathn(t,'SUBTRACT',sep.outputs['Z'],1862)
 ns=node(t,'ShaderNodeSeparateXYZ');connect(t,g.outputs['Normal'],ns.inputs[0]);nz=ns.outputs['Z']
 manifest=json.loads((ROOT/'assets/manifest.json').read_text())
 def clamp(v):return mathn(t,'MINIMUM',1,mathn(t,'MAXIMUM',0,v))
 # Explicit three-axis projection; independent UV planes and normalized normal weights.
 components=node(t,'ShaderNodeSeparateXYZ');connect(t,pos,components.inputs[0]);norms=node(t,'ShaderNodeSeparateXYZ');connect(t,g.outputs['Normal'],norms.inputs[0]);axes=[];weights=[]
 for axis,pair in enumerate([(1,2),(0,2),(0,1)]):
  uv=node(t,'ShaderNodeCombineXYZ');connect(t,components.outputs[pair[0]],uv.inputs[0]);connect(t,components.outputs[pair[1]],uv.inputs[1]);axes.append(uv.outputs[0]);weights.append(mathn(t,'POWER',mathn(t,'ABSOLUTE',norms.outputs[axis]),4))
 total=mathn(t,'MAXIMUM',mathn(t,'ADD',weights[0],mathn(t,'ADD',weights[1],weights[2])),.0001)
 def tex(asset,channel,scale):
  im=bpy.data.images.load(str(ROOT/'assets'/manifest['textures'][asset][channel]),check_existing=True)
  if channel!='Diffuse':im.colorspace_settings.name='Non-Color'
  colors=[]
  for axis in range(3):
   uv=node(t,'ShaderNodeVectorMath');uv.operation='SCALE';connect(t,axes[axis],uv.inputs[0]);uv.inputs['Scale'].default_value=scale
   n=node(t,'ShaderNodeTexImage');n.image=im;n.projection='FLAT';connect(t,uv.outputs[0],n.inputs[0]);weight=node(t,'ShaderNodeMixRGB');weight.blend_type='MULTIPLY';weight.inputs[0].default_value=1;connect(t,n.outputs['Color'],weight.inputs[1]);connect(t,mathn(t,'DIVIDE',weights[axis],total),weight.inputs[2]);colors.append(weight.outputs[0])
  a=node(t,'ShaderNodeMixRGB');a.blend_type='ADD';a.inputs[0].default_value=1;connect(t,colors[0],a.inputs[1]);connect(t,colors[1],a.inputs[2]);b=node(t,'ShaderNodeMixRGB');b.blend_type='ADD';b.inputs[0].default_value=1;connect(t,a.outputs[0],b.inputs[1]);connect(t,colors[2],b.inputs[2]);return b.outputs[0]
 macro=noise(t,pos,.003,5)
 rock=mix(t,macro,tex('rock_face_03','Diffuse',.004),tex('rock_face','Diffuse',.014))
 desat=node(t,'ShaderNodeHueSaturation');desat.inputs['Saturation'].default_value=.35;connect(t,rock,desat.inputs['Color']);rock=mix(t,.2,desat.outputs[0],(.14,.17,.21,1))
 layerCoords=node(t,'ShaderNodeVectorMath');layerCoords.operation='MULTIPLY';connect(t,pos,layerCoords.inputs[0]);layerCoords.inputs[1].default_value=(.018,.018,.12)
 layers=noise(t,layerCoords.outputs[0],1,5)
 rock=mix(t,mathn(t,'MULTIPLY',layers,.3),rock,(.045,.06,.08,1))
 curve=node(t,'ShaderNodeAttribute');curve.attribute_name='curvature'
 scree=clamp(mathn(t,'MULTIPLY',mathn(t,'ADD',curve.outputs['Fac'],.2),.25))
 rock=mix(t,mathn(t,'MULTIPLY',scree,clamp(mathn(t,'MULTIPLY',mathn(t,'SUBTRACT',nz,.62),4))),rock,tex('aerial_rocks_04','Diffuse',.045))
 ground=mix(t,.82,tex('forest_ground_04','Diffuse',.35),tex('forest_leaves_02','Diffuse',.28));ground=mix(t,.18,ground,(.025,.055,.012,1));moss=clamp(mathn(t,'MULTIPLY',mathn(t,'SUBTRACT',noise(t,pos,.13,3),.42),3));ground=mix(t,mathn(t,'MULTIPLY',moss,.7),ground,(.035,.09,.012,1))
 steep=clamp(mathn(t,'MAXIMUM',mathn(t,'MULTIPLY',mathn(t,'SUBTRACT',.91,nz),3),mathn(t,'DIVIDE',mathn(t,'SUBTRACT',h,390),250)))
 flow=node(t,'ShaderNodeAttribute');flow.attribute_name='flow';deposition=node(t,'ShaderNodeAttribute');deposition.attribute_name='deposition';rock=mix(t,mathn(t,'MULTIPLY',deposition.outputs['Fac'],.7),rock,tex('aerial_rocks_04','Diffuse',.08));rock=mix(t,mathn(t,'MULTIPLY',flow.outputs['Fac'],.35),rock,(.025,.038,.045,1));base=mix(t,steep,ground,rock)
 snowHeight=clamp(mathn(t,'DIVIDE',mathn(t,'SUBTRACT',mathn(t,'ADD',h,mathn(t,'MULTIPLY',macro,200)),820),180))
 flat=clamp(mathn(t,'ADD',mathn(t,'MULTIPLY',mathn(t,'SUBTRACT',nz,.55),4),mathn(t,'MULTIPLY',scree,.3)))
 snowAttribute=node(t,'ShaderNodeAttribute');snowAttribute.attribute_name='snow';snow=snowAttribute.outputs['Fac'];base=mix(t,snow,base,mix(t,.65,tex('snow_02','Diffuse',.16),(.85,.9,.96,1)))
 sd=node(t,'ShaderNodeAttribute');sd.attribute_name='shore'
 beach=mathn(t,'MULTIPLY',clamp(mathn(t,'SUBTRACT',1,mathn(t,'DIVIDE',sd.outputs['Fac'],7))),mathn(t,'LESS_THAN',h,29))
 wet=clamp(mathn(t,'DIVIDE',mathn(t,'SUBTRACT',24,h),2))
 pebble=tex('dry_river_pebbles','Diffuse',.7);pebble=mix(t,mathn(t,'MULTIPLY',wet,.65),pebble,(.035,.045,.04,1));submerged=clamp(mathn(t,'DIVIDE',mathn(t,'SUBTRACT',22,h),1.5));pebble=mix(t,mathn(t,'MULTIPLY',submerged,.78),pebble,(.12,.32,.28,1));base=mix(t,beach,base,pebble);connect(t,base,p.inputs['Base Color'])
 rough=mix(t,beach,tex('rock_face_03','Rough',.05),mathn(t,'SUBTRACT',.85,mathn(t,'MULTIPLY',wet,.5)));connect(t,rough,p.inputs['Roughness'])
 ridged=mathn(t,'SUBTRACT',1,mathn(t,'MULTIPLY',mathn(t,'ABSOLUTE',mathn(t,'SUBTRACT',noise(t,pos,.045,6),.5)),2))
 rockHeight=mathn(t,'ADD',mathn(t,'MULTIPLY',tex('rock_face_03','Displacement',.018),.6),mathn(t,'MULTIPLY',ridged,.4))
 geological=mathn(t,'ADD',rockHeight,mathn(t,'MULTIPLY',layers,.18))
 displacement=node(t,'ShaderNodeDisplacement');displacement.inputs['Midlevel'].default_value=.55
 displacement.inputs['Scale'].default_value=9;connect(t,mathn(t,'ADD',.55,mathn(t,'MULTIPLY',mathn(t,'SUBTRACT',geological,.55),clamp(mathn(t,'DIVIDE',mathn(t,'SUBTRACT',h,100),200)))),displacement.inputs['Height']);# Geometry comes from the eroded global heightfield; no per-tile normal displacement.
 b=node(t,'ShaderNodeBump');connect(t,mathn(t,'MULTIPLY',steep,mathn(t,'SUBTRACT',.8,mathn(t,'MULTIPLY',snow,.7))),b.inputs['Strength']);b.inputs['Distance'].default_value=5;connect(t,geological,b.inputs['Height'])
 fine=node(t,'ShaderNodeBump');fine.inputs['Strength'].default_value=.65;fine.inputs['Distance'].default_value=.35;connect(t,mix(t,steep,tex('forest_leaves_02','Displacement',.28),tex('rock_face_03','Displacement',.18)),fine.inputs['Height']);connect(t,b.outputs[0],fine.inputs['Normal']);connect(t,fine.outputs[0],p.inputs['Normal'])
 return m

def water_material():
 m,t,p,o=material('glacial water');p.inputs['Base Color'].default_value=(.91,.98,.99,1);p.inputs['Roughness'].default_value=.025;p.inputs['IOR'].default_value=1.333;p.inputs['Transmission Weight'].default_value=1
 g=node(t,'ShaderNodeTexCoord');drift=node(t,'ShaderNodeVectorMath');drift.operation='ADD';connect(t,g.outputs['Object'],drift.inputs[0]);drift.inputs[1].default_value=(0,0,0);drift.inputs[1].keyframe_insert('default_value',frame=0);drift.inputs[1].default_value=(9,3,0);drift.inputs[1].keyframe_insert('default_value',frame=7200);n=noise(t,drift.outputs[0],.7,3);b=node(t,'ShaderNodeBump');b.inputs['Strength'].default_value=.22;b.inputs['Distance'].default_value=.018;connect(t,n,b.inputs['Height']);t.links.new(b.outputs[0],p.inputs['Normal'])
 volume=node(t,'ShaderNodeVolumePrincipled');volume.inputs['Color'].default_value=(.75,.95,.91,1);volume.inputs['Density'].default_value=.04;volume.inputs['Anisotropy'].default_value=.1;volume.inputs['Absorption Color'].default_value=(.18,.65,.7,1);connect(t,volume.outputs[0],o.inputs['Volume']);return m
def fog_material():
 m,t,p,o=material('aerial perspective');t.nodes.remove(p);g=node(t,'ShaderNodeNewGeometry');sep=node(t,'ShaderNodeSeparateXYZ');t.links.new(g.outputs['Position'],sep.inputs[0]);h=mathn(t,'MAXIMUM',0,mathn(t,'SUBTRACT',sep.outputs['Z'],1884));d=mathn(t,'MULTIPLY',mathn(t,'EXPONENT',mathn(t,'MULTIPLY',h,-.0016)),.000035)
 camera=node(t,'ShaderNodeCameraData');far=mathn(t,'MINIMUM',1,mathn(t,'MAXIMUM',0,mathn(t,'DIVIDE',mathn(t,'SUBTRACT',camera.outputs['View Distance'],250),2200)));d=mathn(t,'MULTIPLY',d,far)
 v=node(t,'ShaderNodeVolumeScatter');v.inputs['Color'].default_value=(.72,.83,1,1);v.inputs['Anisotropy'].default_value=.28;connect(t,d,v.inputs['Density']);t.links.new(v.outputs[0],o.inputs['Volume']);return m
