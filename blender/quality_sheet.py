"""Baseline/candidate comparisons and magnified display-pixel differences."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import numpy as np,sys
R=Path(__file__).resolve().parent;name=sys.argv[1]
canvas=Image.new('RGB',(1920,820),'#181818');draw=ImageDraw.Draw(canvas)
for j,frame in enumerate([80,560]):
 a=Image.open(R/'throughput/baseline'/f'f_{frame:06d}.png').convert('RGB');b=Image.open(R/'throughput'/name/f'f_{frame:06d}.png').convert('RGB')
 delta=np.abs(np.asarray(a,dtype=np.float32)-np.asarray(b,dtype=np.float32));diff=Image.fromarray(np.clip(delta*20,0,255).astype('uint8'))
 for k,(im,label) in enumerate([(a,'Current settings'),(b,name),(diff,'Absolute difference x20')]):
  canvas.paste(im.resize((640,360)),(k*640,j*410+30));draw.text((k*640+8,j*410+10),f'{label} / frame {frame}',fill='white')
canvas.save(R/'throughput'/f'quality-{name}.jpg',quality=95)
