"""Cloud-only, restartable 8193-square hydraulic/thermal terrain preparation.

Each overlapping tile is checkpointed independently. World-space metres are
preserved; the authored shoreline and low valley are protected. Numba particles
transport sediment down gradients, then a talus pass redistributes loose debris.
"""
from pathlib import Path
import os,sys,json,time,hashlib,multiprocessing as mp
import numpy as np
from scipy.ndimage import zoom,gaussian_filter
from numba import njit
R=Path(__file__).resolve().parent;D=R/'dem';OUT=R/'erosion';N=8193;CELL=1.25;TILE=1024;HALO=96;VERSION=1

@njit(cache=True)
def simulate(h,base,seed,droplets):
 np.random.seed(seed);rows,cols=h.shape;flow=np.zeros_like(h);deposit=np.zeros_like(h);erosion=np.zeros_like(h)
 for drop in range(droplets):
  x=np.random.uniform(3,cols-4);z=np.random.uniform(3,rows-4);dx=dz=0.;speed=1.;water=1.;sediment=0.
  for step in range(96):
   ix=int(x);iz=int(z);u=x-ix;v=z-iz
   h00=h[iz,ix];h10=h[iz,ix+1];h01=h[iz+1,ix];h11=h[iz+1,ix+1]
   old=(h00*(1-u)+h10*u)*(1-v)+(h01*(1-u)+h11*u)*v
   if old<110:break
   gx=(h10-h00)*(1-v)+(h11-h01)*v;gz=(h01-h00)*(1-u)+(h11-h10)*u
   dx=dx*.3-gx*.7;dz=dz*.3-gz*.7;length=np.sqrt(dx*dx+dz*dz)
   if length<1e-6:break
   dx/=length;dz/=length;nx=x+dx;nz=z+dz
   if nx<2 or nx>=cols-3 or nz<2 or nz>=rows-3:break
   j=int(nx);k=int(nz);a=nx-j;b=nz-k
   new=(h[k,j]*(1-a)+h[k,j+1]*a)*(1-b)+(h[k+1,j]*(1-a)+h[k+1,j+1]*a)*b
   delta=new-old;capacity=max(-delta,0.02)*speed*water*6
   flow[iz,ix]+=water
   if sediment>capacity or delta>0:
    amount=min(sediment,delta) if delta>0 else (sediment-capacity)*.22
    for oz in range(2):
     for ox in range(2):
      weight=(u if ox else 1-u)*(v if oz else 1-v);h[iz+oz,ix+ox]+=amount*weight;deposit[iz+oz,ix+ox]+=amount*weight
    sediment-=amount
   else:
    # Rock layers differ in resistance, making irregular resistant ledges.
    hardness=.45+.35*(.5+.5*np.sin(old*.095+np.sin(ix*.009)*1.7))
    amount=min((capacity-sediment)*.18*hardness,max(-delta,.02),1.5)
    removed=0.
    for oz in range(-2,3):
     for ox in range(-2,3):
      weight=max(0.,3.-np.sqrt(ox*ox+oz*oz))/25.128
      yy=iz+oz;xx=ix+ox;take=min(amount*weight,max(0.,h[yy,xx]-(base[yy,xx]-38)))
      h[yy,xx]-=take;erosion[yy,xx]+=take;removed+=take
    sediment+=removed
   speed=np.sqrt(max(.1,speed*speed-delta*2.4));water*=.986;x=nx;z=nz
   if water<.02:break
 # Thermal transport conserves mass, favouring loose deposited sediment.
 for iteration in range(10):
  for z in range(2,rows-2):
   for x in range(2,cols-2):
    if h[z,x]<110:continue
    bz=z;bx=x;difference=0.
    for dz,dx in ((-1,0),(1,0),(0,-1),(0,1)):
     d=h[z,x]-h[z+dz,x+dx]
     if d>difference:difference=d;bz=z+dz;bx=x+dx
    excess=difference-CELL*.9
    if excess>0:
     amount=excess*(.12 if deposit[z,x]>.08 else .018);h[z,x]-=amount;h[bz,bx]+=amount;deposit[bz,bx]+=amount
 return h,flow,erosion,deposit

def noise(x,z):
 ix=np.floor(x);iz=np.floor(z);u=x-ix;v=z-iz;u=u*u*(3-2*u);v=v*v*(3-2*v)
 def h(a,b):return np.mod(np.sin(a*127.1+b*311.7)*43758.5453,1)
 return ((1-u)*h(ix,iz)+u*h(ix+1,iz))*(1-v)+((1-u)*h(ix,iz+1)+u*h(ix+1,iz+1))*v

def worker(index):
 target=OUT/f'tile-{index:02d}.npz'
 if target.exists():
  try:
   with np.load(target) as d:assert d['height'].shape==tuple(d['shape'])
   return index
  except Exception:pass
 ix=index%8;iz=index//8;x0=max(0,ix*TILE-HALO);x1=min(N,(ix+1)*TILE+HALO+1);z0=max(0,iz*TILE-HALO);z1=min(N,(iz+1)*TILE+HALO+1)
 initial=np.memmap(OUT/'initial.f32',dtype='<f4',mode='r',shape=(N,N));base=np.array(initial[z0:z1,x0:x1]);h,flow,erosion,deposit=simulate(base.copy(),base,6020+index,140000)
 protection=np.clip((base-100)/160,0,1);h=base+(h-base)*protection;erosion*=protection;deposit*=protection
 with open(target.with_suffix('.partial'),'wb') as f:np.savez_compressed(f,height=h,flow=flow,erosion=erosion,deposition=deposit,bounds=[x0,x1,z0,z1],shape=h.shape);f.flush();os.fsync(f.fileno())
 os.replace(target.with_suffix('.partial'),target);return index

def main():
 if sys.platform=='win32':raise RuntimeError('Full erosion is cloud-only')
 OUT.mkdir(exist_ok=True);signature={'version':VERSION,'grid':N,'cell':CELL,'droplets':8960000,'steps':96,'thermal':10,'dem_sha256':hashlib.sha256((D/'terrain.f32').read_bytes()).hexdigest()}
 manifest=OUT/'manifest.json'
 if manifest.exists():
  if json.loads(manifest.read_text())!=signature:raise RuntimeError('Erosion inputs changed; preserve old cache in a different directory')
 else:manifest.write_text(json.dumps(signature,indent=2))
 if (OUT/'DONE').exists():print('EROSION already complete');return
 start=time.time()
 if not (OUT/'initial.f32').exists():
  source=np.memmap(D/'terrain.f32',dtype='<f4',mode='r',shape=(2049,2049));initial=np.memmap(OUT/'initial.partial',dtype='<f4',mode='w+',shape=(N,N));zoom(source,N/2049,order=3,output=initial)
  x=np.linspace(-5120,5120,N,dtype='float32')[None,:]
  for row in range(0,N,128):
   z=np.linspace(-5120+row*CELL,-5120+min(N-1,row+127)*CELL,min(128,N-row),dtype='float32')[:,None];base=np.array(initial[row:row+128]);warp=60*(noise(x/240,z/240)-.5)
   ridges=sum((1-np.abs(noise((x+warp)/scale,(z+warp)/scale)*2-1))**3*amp for scale,amp in [(180,22),(70,12),(25,4)])-10
   initial[row:row+128]=base+ridges*np.clip((base-120)/400,0,1)
  initial.flush();del initial;os.replace(OUT/'initial.partial',OUT/'initial.f32')
 # Compile once before forking, keeping worker startup and memory bounded.
 simulate(np.full((12,12),120,dtype='float32'),np.full((12,12),120,dtype='float32'),1,1)
 with mp.Pool(min(12,os.cpu_count()),maxtasksperchild=4) as pool:
  for number,index in enumerate(pool.imap_unordered(worker,range(64)),1):
   (OUT/'progress.json').write_text(json.dumps({'complete_tiles':number,'last':index,'seconds':time.time()-start}));print('EROSION_TILE',number,index,flush=True)
 accum={key:np.memmap(OUT/(key+'.sum'),dtype='<f4',mode='w+',shape=(N,N)) for key in ['height','flow','erosion','deposition','weight']}
 for index in range(64):
  with np.load(OUT/f'tile-{index:02d}.npz') as d:
   x0,x1,z0,z1=map(int,d['bounds']);yy,xx=np.indices(d['height'].shape,dtype='float32');w=np.minimum(np.minimum(xx+1,x1-x0-xx),np.minimum(yy+1,z1-z0-yy));w=np.clip(w/HALO,0,1);accum['weight'][z0:z1,x0:x1]+=w
   for key in ['height','flow','erosion','deposition']:accum[key][z0:z1,x0:x1]+=d[key]*w
 for key in ['height','flow','erosion','deposition']:
  result=np.memmap(OUT/(key+'.partial'),dtype='<f4',mode='w+',shape=(N,N))
  for row in range(0,N,128):result[row:row+128]=accum[key][row:row+128]/np.maximum(accum['weight'][row:row+128],1e-8)
  result.flush();del result;os.replace(OUT/(key+'.partial'),OUT/(key+'.f32'))
 del accum
 for p in OUT.glob('*.sum'):p.unlink()
 (OUT/'DONE').write_text(json.dumps({'seconds':time.time()-start,**signature},indent=2));print('EROSION_COMPLETE',time.time()-start,flush=True)
if __name__=='__main__':main()
