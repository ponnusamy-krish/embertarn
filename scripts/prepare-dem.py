import json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage
p=Path('public/assets/moraine-dem');h=np.memmap(p/'elevation.f32',dtype='<f4',mode='r',shape=(2049,2049))
g=json.load(open('screenshots/reference/lake-outline-osm.json'))['elements'][0]['geometry']
a=math.radians(35);points=[]
for v in g:
 e=(v['lon']+116.1856)*111320*math.cos(math.radians(51.3217));n=(v['lat']-51.3217)*111320
 x=-e*math.cos(a)+n*math.sin(a);z=e*math.sin(a)+n*math.cos(a);points.append((x,z))
print('lake bounds',np.min(points,axis=0),np.max(points,axis=0))
im=Image.new('1',(2049,2049));ImageDraw.Draw(im).polygon([((x+5120)/5,(z+5120)/5) for x,z in points],fill=1);mask=np.array(im,dtype=bool)
sd=(ndimage.distance_transform_edt(~mask)-ndimage.distance_transform_edt(mask)).astype('float32')*5;sd.tofile(p/'shore-distance.f32')
y=np.array(h)-1920+22;inside=sd<0;y[inside]=22-np.minimum(18,np.maximum(.15,-sd[inside]*.09))
w=np.clip(sd/65,0,1);w=w*w*(3-2*w);y=np.where(sd>=0,(22+sd*.06)*(1-w)+y*w,y);y.astype('<f4').tofile(p/'terrain.f32')
json.dump({'source':'OpenStreetMap way 356877446','license':'ODbL 1.0','worldOutline':points},open(p/'lake-outline.json','w'))
preview=np.stack([np.clip((h-1800)/1400,0,1)]*3,axis=-1)*200+20;preview[mask]=[22,170,220];Image.fromarray(preview.astype('uint8')).resize((1024,1024)).save('screenshots/reference/dem-lake-mask.png')
