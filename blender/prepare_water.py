"""Buffer the closed water shell under dry land, hiding its vertical boundary."""
from pathlib import Path
import json,os
from shapely.geometry import Polygon
R=Path(__file__).resolve().parent
outline=json.loads((R/'dem/lake-outline.json').read_text())['worldOutline']
polygon=Polygon(outline).buffer(20,resolution=4)
assert polygon.is_valid and polygon.geom_type=='Polygon'
p=R/'erosion/water-shell.json';tmp=p.with_suffix('.partial');tmp.write_text(json.dumps({'worldOutline':list(polygon.exterior.coords)[:-1],'buffer_metres':20}));os.replace(tmp,p)
