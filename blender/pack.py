from pathlib import Path
import tarfile
R=Path(__file__).resolve().parent
target=R.parent.parent/'embertarn-blender-upload.tar.gz'
with tarfile.open(target,'w:gz') as t:
 for f in R.iterdir():
  if f.suffix in ('.py','.sh','.ps1','.md') or f.name in ('render-settings.json','benchmark-config.json','terrain-scale-audit.json'):t.add(f,arcname='embertarn/blender/'+f.name)
 for name in ['terrain.f32','shore-distance.f32','lake-outline.json','metadata.json']:
  t.add(R.parent/'public/assets/moraine-dem'/name,arcname='embertarn/blender/dem/'+name)
 t.add(R.parent/'CREDITS.md',arcname='embertarn/CREDITS.md')
print(target)
