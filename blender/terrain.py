from pathlib import Path
import numpy as np
import bpy
from shots import ELEVATION_OFFSET
ROOT=Path(__file__).resolve().parent
DEM=ROOT/'dem'
if not DEM.exists():DEM=ROOT.parent/'public/assets/moraine-dem'
GRID=2049;WORLD=10240;CELL=5;LAKE=1884.0
original=np.memmap(DEM/'terrain.f32',dtype='<f4',mode='r',shape=(GRID,GRID))
data=original
eroded=ROOT/'erosion'
if (eroded/'DONE').exists():data=np.memmap(eroded/'height.f32',dtype='<f4',mode='r',shape=(8193,8193))
derived={k:np.memmap(eroded/(k+'.f32'),dtype='<f4',mode='r',shape=(8193,8193)) for k in ['flow','erosion','deposition']} if (eroded/'DONE').exists() else {}
shore=np.memmap(DEM/'shore-distance.f32',dtype='<f4',mode='r',shape=(GRID,GRID))
def sample(a,x,z):
 cell=WORLD/(a.shape[0]-1);limit=a.shape[0]-1.001;fx=np.clip((np.asarray(x)+5120)/cell,0,limit);fz=np.clip((np.asarray(z)+5120)/cell,0,limit);ix=fx.astype(np.int32);iz=fz.astype(np.int32);u=fx-ix;v=fz-iz
 value=(a[iz,ix]*(1-u)+a[iz,ix+1]*u)*(1-v)+(a[iz+1,ix]*(1-u)+a[iz+1,ix+1]*u)*v
 if a is data:
  if derived:
   baseline=sample(original,x,z);strength=.55+.45*noise2(np.asarray(x)/135,np.asarray(z)/135);value=np.where(value>120,baseline+(value-baseline)*strength,value)
  # Metre-preserving DEM with explicit artistic cliff shaping above the forest.
  baseline=sample(original,x,z)
  grad=np.hypot(sample(original,np.asarray(x)+15,z)-sample(original,np.asarray(x)-15,z),sample(original,x,np.asarray(z)+15)-sample(original,x,np.asarray(z)-15))/30
  high=np.clip((baseline-230)/300,0,1);steep=np.clip((grad-.48)/.65,0,1)
  warp=95*noise2(np.asarray(x)/330,np.asarray(z)/330)+np.asarray(x)*.045+np.asarray(z)*.025
  # One irregular cliff transition, not periodic terraces/snow rings.
  cliff=75*np.tanh((baseline+warp-850)/95)
  value=value+high*steep*cliff+np.maximum(baseline-620,0)*.17
  sd=sample(shore,x,z);value=np.where((sd>-3)&(sd<160),np.maximum(value,22.1+np.clip(sd,-3,160)*.025),value)
 return value
def height(x,z):return float(sample(data,x,z))

def bicubic(x,z):
 fx=np.clip((np.asarray(x)+5120)/5,1,2046.999);fz=np.clip((np.asarray(z)+5120)/5,1,2046.999);ix=fx.astype(np.int32);iz=fz.astype(np.int32);u=fx-ix;v=fz-iz
 def weights(t):return [-.5*t+t*t-.5*t*t*t,1-2.5*t*t+1.5*t*t*t,.5*t+2*t*t-1.5*t*t*t,-.5*t*t+.5*t*t*t]
 wx,wz=weights(u),weights(v)
 return sum(data[iz+j-1,ix+i-1]*wx[i]*wz[j] for j in range(4) for i in range(4))
def slope(x,z):return np.hypot(sample(data,np.asarray(x)+5,z)-sample(data,np.asarray(x)-5,z),sample(data,x,np.asarray(z)+5)-sample(data,x,np.asarray(z)-5))/10
def mesh_grid(name,x,z,y):
 rows,cols=x.shape;n=rows*cols;verts=np.column_stack((x.ravel(),-z.ravel(),y.ravel()+ELEVATION_OFFSET)).astype('float32')
 ids=np.arange(n,dtype='int32').reshape(rows,cols);a=ids[:-1,:-1].ravel();faces=np.column_stack((a,a+cols,a+cols+1,a+1)).astype('int32').ravel()
 m=bpy.data.meshes.new(name);m.vertices.add(n);m.vertices.foreach_set('co',verts.ravel());m.loops.add(len(faces));m.loops.foreach_set('vertex_index',faces);m.polygons.add(len(a));m.polygons.foreach_set('loop_start',np.arange(len(a),dtype='int32')*4);m.polygons.foreach_set('loop_total',np.full(len(a),4,dtype='int32'));m.polygons.foreach_set('use_smooth',np.ones(len(a),dtype=bool));m.update()
 o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);return o
def noise2(x,z):
 ix=np.floor(x);iz=np.floor(z);u=x-ix;v=z-iz;u=u*u*(3-2*u);v=v*v*(3-2*v)
 def h(a,b):return np.mod(np.sin(a*127.1+b*311.7)*43758.5453,1)
 return ((1-u)*h(ix,iz)+u*h(ix+1,iz))*(1-v)+((1-u)*h(ix,iz+1)+u*h(ix+1,iz+1))*v

def build(material):
 for iz in range(16):
  for ix in range(16):
   cx=(ix+.5)*640-5120;cz=(iz+.5)*640-5120;segments=256 if abs(cx)<3500 and cz<0 else 128
   x,z=np.meshgrid(np.linspace(cx-320,cx+320,segments+1),np.linspace(cz-320,cz+320,segments+1));y=sample(data,x,z) if derived else bicubic(x,z)
   if segments==256:
    y[1:-1:2,0]=(y[:-2:2,0]+y[2::2,0])*.5;y[1:-1:2,-1]=(y[:-2:2,-1]+y[2::2,-1])*.5
    y[0,1:-1:2]=(y[0,:-2:2]+y[0,2::2])*.5;y[-1,1:-1:2]=(y[-1,:-2:2]+y[-1,2::2])*.5
   o=mesh_grid(f'Embertarn terrain {ix:02d}-{iz:02d}',x,z,y);o.data.materials.append(material)
   attr=o.data.attributes.new('shore','FLOAT','POINT');attr.data.foreach_set('value',sample(shore,x,z).astype('float32').ravel())
   curve=(sample(data,x+10,z)+sample(data,x-10,z)+sample(data,x,z+10)+sample(data,x,z-10)-4*y)/4
   attr=o.data.attributes.new('curvature','FLOAT','POINT');attr.data.foreach_set('value',curve.astype('float32').ravel())
   nz=1/np.sqrt(1+slope(x,z)**2)
   flow=np.clip(np.log1p(np.maximum(0,sample(derived['flow'],x,z)))/8,0,1) if derived else 0
   pockets=np.clip(curve/2,0,1)*.45+flow*.7
   snow=np.clip((y-620+noise2(x/190,z/190)*150)/240,0,1)*np.clip((nz-.48)*2.6+pockets,0,1)*np.clip((noise2(x/115,z/115)-.08)*2.5,0,1)
   attr=o.data.attributes.new('snow','FLOAT','POINT');attr.data.foreach_set('value',snow.astype('float32').ravel())
   for name,values in derived.items():
    value=np.clip(np.log1p(np.maximum(0,sample(values,x,z)))/(8 if name=='flow' else 3),0,1)
    attr=o.data.attributes.new(name,'FLOAT','POINT');attr.data.foreach_set('value',value.astype('float32').ravel())
 print('Terrain tiles built',flush=True)
