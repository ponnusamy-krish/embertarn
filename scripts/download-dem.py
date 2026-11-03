from pathlib import Path
import math,json,requests,numpy as np,io
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
out=Path('public/assets/moraine-dem');out.mkdir(parents=True,exist_ok=True)
lat,lon=51.3217,-116.1856;zoom=13;N=2**zoom;world=10240;size=2049;angle=math.radians(35)
cx=(lon+180)/360*N*256;cy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N*256;metres=math.cos(math.radians(lat))*2*math.pi*6378137/(N*256)
extent=world*.5*(abs(math.sin(angle))+abs(math.cos(angle)))/metres
x0,x1=int((cx-extent)//256),int((cx+extent)//256)+1;y0,y1=int((cy-extent)//256),int((cy+extent)//256)+1
canvas=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256),dtype=np.float32);jobs=[(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
def fetch(q):
 x,y=q;url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png';r=requests.get(url,timeout=90);r.raise_for_status();a=np.array(Image.open(io.BytesIO(r.content)),dtype=np.float32);return x,y,a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768,url
urls=[]
with ThreadPoolExecutor(max_workers=2) as pool:
 for x,y,a,url in pool.map(fetch,jobs):canvas[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=a;urls.append(url)
result=np.memmap(out/'elevation.f32',dtype='<f4',mode='w+',shape=(size,size));xs=np.linspace(-world/2,world/2,size,dtype=np.float32)[None,:]
for start in range(0,size,64):
 zs=np.linspace(-world/2,world/2,size,dtype=np.float32)[start:start+64,None]
 # Right-handed scene coordinates: +X points NW, +Z points NE.
 e=-xs*math.cos(angle)+zs*math.sin(angle);north=xs*math.sin(angle)+zs*math.cos(angle)
 fx=cx+e/metres-x0*256;fy=cy-north/metres-y0*256;ix=fx.astype(np.int32);iy=fy.astype(np.int32);u=fx-ix;v=fy-iy
 result[start:start+len(zs)]=(canvas[iy,ix]*(1-u)+canvas[iy,ix+1]*u)*(1-v)+(canvas[iy+1,ix]*(1-u)+canvas[iy+1,ix+1]*u)*v
result.flush();meta=dict(location='Moraine Lake, Valley of the Ten Peaks, Alberta, Canada',center=[lat,lon],worldMetres=world,size=size,rotationDegrees=35,xAxis='northwest',zAxis='northeast',sourceGroundResolution=metres,sourceZoom=zoom,tiles=urls,actualWaterElevation=1884,sourceLakePlateau=1920,attribution='Terrain Tiles, Mapzen/Tilezen, AWS Open Data. Canada terrain data contains information licensed under the Open Government Licence - Canada.',licenseURL='https://github.com/tilezen/joerd/blob/master/docs/attribution.md');(out/'metadata.json').write_text(json.dumps(meta,indent=2),encoding='utf8');print('DEM streamed',len(urls),'tiles',float(result.min()),float(result.max()))
