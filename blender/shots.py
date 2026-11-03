"""45 hard-cut shots, 160 frames each, 24 fps. Coordinates match the DEM/web space."""
import math
FPS=24;TOTAL=7200;SHOT_FRAMES=160;ELEVATION_OFFSET=1862.0
# Names are fictional/editorial. No real geographic branding.
VIEWS=[
 ('Embertarn',(210,245,1000),(110,350,-1550),30,'wide'),
 ('Mirror',(-30,32,560),(-160,260,-1600),24,'water'),
 ('Shore',(-180,25.5,300),(-105,23,240),35,'close'),
 ('Under the firs',(-235,32,380),(-195,35,290),32,'forest'),
 ('Ridge',(-450,650,1000),(-1200,800,-2400),35,'wide'),
 ('Waterline',(-110,26,390),(-150,26,270),50,'close'),
 ('Light across the lake',(-60,65,-220),(-350,100,700),35,'water'),
 ('Along the shore',(-175,26,310),(-80,28,170),32,'close'),
 ('Last light',(10,38,-350),(-50,190,1500),28,'water')]
SHOTS=[]
for i in range(45):
 view=2 if i%9==0 and i//9 in (1,3) else (3 if i%9==4 and i//9 in (1,2,4) else i%9)
 kind=VIEWS[view][4]
 SHOTS.append({'index':i,'name':VIEWS[view][0],'start':i*160,'end':i*160+159,'engine':'CYCLES','samples':48 if kind=='wide' else 64,'kind':kind,'view':view,'exposure':2.85 if kind=='forest' else (1.6 if kind=='close' else 1.35)})

STILLS={'aerial':80,'reflection':240,'forest':560,'shoreline':400,'ridge':720,'last-light':1360,'low-shore':1200,'forest-detail':2000}
def pose(frame,height):
 i=min(44,max(0,int(frame)//160));s=SHOTS[i];name,p,q,lens,kind=VIEWS[s['view']];u=max(0,min(1,(frame-s['start'])/159));e=u*u*(3-2*u);cycle=i//9
 x,y,z=p;x+=(cycle-2)*5+(e-.5)*(4 if kind in ('close','forest') else 35);z+=(e-.5)*(5 if kind in ('close','forest') else 25)
 y=max(y,height(x,z)+(2 if kind in ('close','forest') else 32),24.5)
 if kind=='forest':y=height(x,z)+2.2;q=(q[0],height(q[0],q[2])+3,q[2])
 p=(x+.035*math.sin(frame*.031),-z,y+ELEVATION_OFFSET+.025*math.sin(frame*.041));q=(q[0],-q[2],q[1]+ELEVATION_OFFSET)
 return p,q,lens,kind
