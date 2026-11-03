from pathlib import Path
import requests,json,io
from PIL import Image
urls=[
'https://morainelakesunriseshuttle.com/wp-content/uploads/2025/09/moraine-lake-sunrise-shuttle-hero-2-1440.webp',
'https://morainelakesunriseshuttle.com/wp-content/uploads/2025/09/H8A8912_02_1920.webp',
'https://morainelakesunriseshuttle.com/wp-content/uploads/2025/01/moraine-lake-sunrise-shuttle-home-scaled-1-scaled.webp',
'https://morainelakesunriseshuttle.com/wp-content/uploads/2025/01/girl-yellow-coat-scaled-qlzioazz7qyb796uq5z19evs29acvbx3yjm9d1vxue.jpeg.webp',
'https://images.squarespace-cdn.com/content/v1/57a5aa74d2b857268e9f0864/0c89a0bd-07af-4f70-9ebe-0f3c3e848c7b/Lago%2BDi%2BBRaies%2BSunset.jpg']
out=Path('screenshots/reference');out.mkdir(parents=True,exist_ok=True);records=[]
for i,url in enumerate(urls):
 r=requests.get(url,timeout=60);r.raise_for_status();im=Image.open(io.BytesIO(r.content)).convert('RGB');im.thumbnail((1920,1280));im.save(out/f'photo-{i+1}.jpg',quality=92);records.append(dict(file=f'photo-{i+1}.jpg',url=url,author='Mark Unrau / Moraine Lake Sunrise Shuttle' if i<4 else 'Tezya Photography (visible watermark)',use='Private visual comparison only; not a render asset'))
(out/'sources.json').write_text(json.dumps(records,indent=2),encoding='utf8')
print('Downloaded',len(records),'reference photographs')
