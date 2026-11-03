"""Bounded launch check; does not monitor or wait for the full render."""
from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw
from frameio import valid_png
R=Path(__file__).resolve().parent;frames=R/'frames'
valid=[i for i in range(30) if valid_png(frames/f'f_{i:06d}.png')]
if len(valid)!=30:raise SystemExit(f'Waiting: {len(valid)}/30 initial frames valid')
manifest=json.loads((frames/'manifest.json').read_text())
assert manifest['config']==json.loads((R/'render-settings.json').read_text())
assert all(s['engine']=='CYCLES' for s in manifest['shots'])
state=subprocess.check_output(['systemctl','is-active','embertarn-render.service'],text=True).strip();assert state=='active'
enabled=subprocess.check_output(['systemctl','is-enabled','embertarn-render.service'],text=True).strip();assert enabled=='enabled'
start=subprocess.check_output(['systemctl','show','embertarn-render.service','--property=ActiveEnterTimestamp','--value'],text=True).strip()
status=subprocess.check_output(['bash',str(R/'status.sh')],text=True).strip()
report={'first_30_valid':True,'service':state,'boot':enabled,'started':start,'status':status,'engine':'CYCLES'}
(R/'launch-verification.json').write_text(json.dumps(report,indent=2))
sheet=Image.new('RGB',(1280,770),'#161616');draw=ImageDraw.Draw(sheet)
for j,f in enumerate([0,9,19,29]):
 with Image.open(frames/f'f_{f:06d}.png') as im:sheet.paste(im.convert('RGB').resize((640,360)),((j%2)*640,(j//2)*385+25))
 draw.text(((j%2)*640+8,(j//2)*385+8),f'Production frame {f}',fill='white')
sheet.save(R/'stills/production-first30.jpg',quality=94)
print(json.dumps(report),flush=True)
