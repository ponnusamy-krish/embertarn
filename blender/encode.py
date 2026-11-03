from pathlib import Path
import subprocess,argparse,os
from frameio import valid_png
R=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--frames',default='frames');p.add_argument('--start',type=int,default=0);p.add_argument('--count',type=int,default=7200);p.add_argument('--out',default='output/embertarn_5min.mp4');a=p.parse_args()
out=R/a.out;out.parent.mkdir(parents=True,exist_ok=True)
for i in range(a.start,a.start+a.count):
 f=R/a.frames/f'f_{i:06d}.png'
 if not valid_png(f):raise RuntimeError(f'Missing or corrupt frame {f}')
base=['ffmpeg','-y','-framerate','24','-start_number',str(a.start),'-i',str(R/a.frames/'f_%06d.png'),'-i',str(R/'output/ambience.wav')]
duration=a.count/24
vf=f'format=gbrpf32le,zscale=pin=bt709:tin=iec61966-2-1:min=gbr:rin=full:p=bt709:t=bt709:m=bt709:r=limited,format=yuv420p,vignette=angle=PI/12,noise=alls=1:allf=t,fade=t=out:st={max(0,duration-1)}:d=1'
if a.count>=7200:vf+=",drawtext=text='Embertarn':fontcolor=white:fontsize=56:x=(w-tw)/2:y=h*0.80:alpha='if(lt(t,1),t,if(lt(t,3),1,if(lt(t,4),4-t,0)))'"
tmp=out.with_name(out.stem+'.partial.mp4');common=['-vf',vf,'-frames:v',str(a.count),'-t',str(duration),'-profile:v','high','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-c:a','aac','-b:a','320k','-movflags','+faststart',str(tmp)]
for codec in [['-c:v','h264_nvenc','-cq','18','-preset','p6'],['-c:v','libx264','-crf','17','-preset','slow']]:
 if subprocess.run(base+codec+common).returncode==0:os.replace(tmp,out);break
else:raise RuntimeError('Encoding failed')
