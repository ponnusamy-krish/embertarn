"""Original procedural wind/water/bird ambience; no third-party recording."""
from pathlib import Path
import subprocess,os
R=Path(__file__).resolve().parent;out=R/'output';out.mkdir(exist_ok=True);target=out/'ambience.wav'
if target.exists() and target.stat().st_size>50000000:raise SystemExit(0)
filters='[0:a]lowpass=f=950,highpass=f=70,volume=0.32,tremolo=f=0.1:d=0.45[w];[1:a]highpass=f=420,lowpass=f=3400,tremolo=f=0.32:d=0.8,volume=0.12[l];[2:a]volume=0.018,tremolo=f=3.7:d=1,afade=t=in:d=3[b];[w][l][b]amix=inputs=3:normalize=0,afade=t=in:d=3,afade=t=out:st=296:d=4,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
subprocess.run(['ffmpeg','-y','-f','lavfi','-i','anoisesrc=color=brown:seed=147:d=300','-f','lavfi','-i','anoisesrc=color=pink:seed=21:d=300','-f','lavfi','-i','aevalsrc=sin(2*PI*(2400+600*sin(2*PI*3*t))*t)*pow(max(0\\,sin(2*PI*0.13*t))\\,30):d=300','-filter_complex',filters,'-map','[a]','-ar','48000','-ac','2',str(out/'ambience.partial.wav')],check=True)
os.replace(out/'ambience.partial.wav',target)
