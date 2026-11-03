from pathlib import Path
import numpy as np
from scipy import ndimage
from PIL import Image
p=Path('public/assets/moraine-dem');h=np.fromfile(p/'terrain.f32',dtype='<f4').reshape(2049,2049)
y,x=np.mgrid[0:2049:2,0:2049:2];base=h[::2,::2];horizon=np.full(base.shape,-10.,dtype='float32')
for d in np.arange(24,5200,48):
 tx=x-.815*d/5;ty=y+.565*d/5;other=ndimage.map_coordinates(h,[ty,tx],order=1,mode='nearest');candidate=(other-base)/d;candidate[(tx>2048)|(ty>2048)|(tx<0)|(ty<0)]=-10;horizon=np.maximum(horizon,candidate)
sun=np.clip((.087-horizon)/.018+.5,0,1);sun=ndimage.gaussian_filter(sun,.6)
gz,gx=np.gradient(base,10);slope=np.hypot(gx,gz);curvature=ndimage.gaussian_filter(ndimage.laplace(base),2)
forest=np.clip((510-base)/160,0,1)*np.clip((.88-slope)/.28,0,1)*np.clip((base-23)/7,0,1)
# Gullies carry avalanche debris rather than a uniform plantation.
forest*=np.clip(1+curvature*.9,.08,1)
shade=np.clip(curvature*.15+.5,0,1)
rgba=np.stack([forest,shade,np.clip(slope/1.5,0,1),sun],axis=-1)
Image.fromarray(np.uint8(rgba*255),'RGBA').save(p/'biome.png')
np.uint8(rgba*255).tofile(p/'biome.rgba')
print('Biomes and low-sun terrain visibility baked')
