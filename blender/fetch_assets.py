"""CC0 downloads with checksums and atomic promotion; standard library only."""
from pathlib import Path
import hashlib,json,os,shutil,time,urllib.request
ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
TEXTURES=['rock_face_03','rock_face','aerial_rocks_04','grass_ground','forest_ground_04','snow_02','dry_river_pebbles','forest_floor','forest_leaves_02']
MODELS=['fir_tree_01','pine_sapling_medium','boulder_01','namaqualand_boulder_02','fern_02','grass_medium_01','dead_tree_trunk']
HDR='table_mountain_2_puresky'
def request(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 Embertarn CC0 scene builder'}),timeout=120)
def digest(p):
 h=hashlib.md5()
 with open(p,'rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def download(entry,path):
 path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists() and path.stat().st_size==entry.get('size',path.stat().st_size) and digest(path)==entry['md5']:return
 # Existing web assets are read-only download caches, never modified.
 cache=ROOT.parent/'public/assets'; candidates=[]
 if (cache/'manifest.json').exists():
  candidates=[ROOT.parent/v['local'] for v in json.loads((cache/'manifest.json').read_text()) if v.get('md5')==entry['md5']]
 for p in candidates:
  if p.exists() and digest(p)==entry['md5']:shutil.copyfile(p,path);return
 temp=path.with_name(path.name+'.partial')
 for attempt in range(4):
  try:
   with request(entry['url']) as r,open(temp,'wb') as f:
    shutil.copyfileobj(r,f,1024*1024);f.flush();os.fsync(f.fileno())
   if digest(temp)!=entry['md5']:raise RuntimeError('Checksum mismatch: '+str(path))
   os.replace(temp,path);print('GET',path.relative_to(ROOT),flush=True);return
  except Exception:
   if attempt==3:raise
   time.sleep(2+attempt)
def api(kind,key):
 p=ASSETS/'metadata'/f'{kind}-{key}.json';p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():return json.loads(p.read_text())
 with request('https://api.polyhaven.com/'+kind+'/'+key) as r:d=json.load(r)
 temp=p.with_suffix('.partial');temp.write_text(json.dumps(d));os.replace(temp,p);return d
def main():
 manifest={'license':'CC0-1.0','textures':{},'models':{},'hdri':{}}
 for key in TEXTURES:
  data=api('files',key);maps={}
  for channel in ['Diffuse','nor_gl','Rough','Displacement']:
   resolution='4k' if key in ['rock_face_03','rock_face','aerial_rocks_04'] else '2k'
   e=data.get(channel,{}).get(resolution,{}).get('jpg') or data.get(channel,{}).get(resolution,{}).get('png')
   if e:
    ext=e['url'].split('.')[-1];p=ASSETS/'textures'/key/(channel+'.'+ext);download(e,p);maps[channel]=str(p.relative_to(ASSETS))
  manifest['textures'][key]=maps
 for key in MODELS:
  data=api('files',key);e=data['gltf']['2k' if key in ['fir_tree_01','boulder_01','namaqualand_boulder_02'] else '1k']['gltf'];base=ASSETS/'models'/key
  for rel,v in e.get('include',{}).items():
   p=(base/rel).resolve()
   if not p.is_relative_to(base.resolve()):raise ValueError('Unsafe include')
   download(v,p)
  p=base/(key+'.gltf');download(e,p);manifest['models'][key]=str(p.relative_to(ASSETS))
  for channel in ['Alpha','twig_alpha']:
   if channel in data:
    variants=data[channel]['2k' if key=='fir_tree_01' else '1k'];alpha=variants.get('png') or variants.get('jpg')
    if alpha:download(alpha,base/('opacity.'+alpha['url'].split('.')[-1]))
 e=api('files',HDR)['hdri']['4k']['hdr'];p=ASSETS/(HDR+'.hdr');download(e,p);manifest['hdri']={'path':p.name,'source':e}
 (ASSETS/'manifest.partial').write_text(json.dumps(manifest,indent=2));os.replace(ASSETS/'manifest.partial',ASSETS/'manifest.json')
 lines=['\n<!-- EMBERTARN_BLENDER_ASSETS -->','\n## Embertarn Blender V5 CC0 assets\n']
 for key in TEXTURES+MODELS+[HDR]:
  info=api('info',key);authors=', '.join(info.get('authors',{}));lines.append(f'- **{info.get("name",key)}** — {authors} — https://polyhaven.com/a/{key} — CC0 1.0.')
 lines+=['\nDownloads are checksum-verified via the Poly Haven API; Blender-local assets/metadata and assets/manifest.json retain provenance. Geometry simplification and procedural variants derive from these CC0 sources. Geographic DEM/OSM attribution remains as listed above.','<!-- /EMBERTARN_BLENDER_ASSETS -->\n']
 credits=ROOT.parent/'CREDITS.md';text=credits.read_text(encoding='utf-8') if credits.exists() else '# Embertarn asset credits\n'
 if '<!-- EMBERTARN_BLENDER_ASSETS -->' in text:text=text[:text.index('<!-- EMBERTARN_BLENDER_ASSETS -->')]+text[text.index('<!-- /EMBERTARN_BLENDER_ASSETS -->')+len('<!-- /EMBERTARN_BLENDER_ASSETS -->'):]
 credits.write_text(text.rstrip()+'\n'+'\n'.join(lines),encoding='utf-8');print('Assets complete',flush=True)
if __name__=='__main__':main()
