from PIL import Image
from pathlib import Path
import json,shutil
p=Path('screenshots/octa-bake').resolve();out=Path('public/assets/fir-octa');out.mkdir(exist_ok=True)
for kind in ['albedo','normal']:
 atlas=Image.new('RGBA',(2048,2048))
 for i in range(16):
  with Image.open(p/f'{kind}-{i}.png') as im:atlas.paste(im,((i%4)*512,(i//4)*512))
 atlas.save(out/f'{kind}.png')
(out/'metadata.json').write_text(json.dumps(dict(source='Poly Haven Fir Tree 01, optimized mature mesh',license='CC0-1.0',layout='4x4 hemi-octahedral views, orthographic 16m x 28m, root-normalized tree 22m high',normalSpace='object/world space, linear RGB',viewCenterHeight=11),indent=2))
if p==Path('screenshots/octa-bake').resolve():shutil.rmtree(p)
