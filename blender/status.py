"""Cheap status: inspect committed PNG names/mtimes, not full image contents."""
from pathlib import Path
import os,time,re
R=Path(__file__).resolve().parent;frames=R/'frames';now=time.time();timestamps=[]
if frames.exists():
 for p in frames.iterdir():
  if re.fullmatch(r'f_\d{6}\.png',p.name):
   stat=p.stat()
   if stat.st_size>0:timestamps.append(stat.st_mtime)
recent=sorted(timestamps)[-120:];rate=(len(recent)-1)*3600/max(.01,max(now,recent[-1])-recent[0]) if len(recent)>1 else 0
done=(R/'DONE').exists();hours=max(0,7200-len(timestamps))/rate if rate else None
eta='complete' if done else (f'{int(hours)}h{int((hours%1)*60):02d}m' if hours is not None else 'warming up')
workers=0
for p in Path('/proc').iterdir():
 if p.name.isdigit():
  try:
   cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
   if str(R/'render.py') in cmd and str(R/'tools/blender/blender') in cmd:workers+=1
  except (OSError,PermissionError):pass
errors=[]
for p in [R/'status.log',*frames.glob('worker-*.log')]:
 if p.exists():
  with p.open('rb') as f:f.seek(max(0,p.stat().st_size-65536));lines=f.read().decode(errors='replace').splitlines()
  errors.extend((p.stat().st_mtime,line.strip()) for line in lines if re.search(r'RuntimeError:|Error:|CUDA error|out of memory|Traceback',line))
error=max(errors)[1][:140] if errors else 'none'
print(f'{len(timestamps)}/7200 | {rate:.0f} frames/hour recent | ETA {eta} | workers {workers} | DONE {"yes" if done else "no"} | last error: {error}')
