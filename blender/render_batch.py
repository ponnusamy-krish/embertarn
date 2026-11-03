"""Bounded multi-process rendering with deterministic disjoint frame ownership."""
from pathlib import Path
import argparse,subprocess,time,json,os,signal,hashlib
import shots
from frameio import valid_png
R=Path(__file__).resolve().parent

def main():
 def interrupted(signum,frame):raise KeyboardInterrupt('Render coordinator stopped')
 signal.signal(signal.SIGTERM,interrupted)
 p=argparse.ArgumentParser();p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=7199);p.add_argument('--workers',type=int);p.add_argument('--outdir',default='frames');p.add_argument('--samples',type=int);p.add_argument('--batch',type=int,default=160);a=p.parse_args()
 config=json.loads((R/'render-settings.json').read_text()) if (R/'render-settings.json').exists() else {}
 workers=a.workers or config.get('workers',1)
 if workers not in (1,2,3):raise ValueError('Only 1-3 workers supported')
 out=(R/a.outdir).resolve();out.mkdir(parents=True,exist_ok=True)
 import fcntl
 with open(out/'.batch.lock','w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  manifest=out/'manifest.json'
  if manifest.exists():
   h=hashlib.sha256()
   with open(R/'embertarn.blend','rb') as f:
    for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
   existing=json.loads(manifest.read_text());expected={'renderer':hashlib.sha256((R/'render.py').read_bytes()).hexdigest(),'blend':h.hexdigest(),'config':config,'samples':a.samples,'engine':None,'shots':shots.SHOTS}
   if any(existing.get(k)!=v for k,v in expected.items()):raise RuntimeError('Scene/settings differ from existing frames; use a new directory')
  for start in range(a.start,a.end+1,a.batch):
   end=min(a.end,start+a.batch-1)
   for attempt in range(3):
    if all(valid_png(out/f'f_{i:06d}.png') for i in range(start,end+1)):break
    jobs=[];logs=[]
    try:
     for worker in range(workers):
      log=open(out/f'worker-{worker}.log','a');logs.append(log)
      cmd=[str(R/'tools/blender/blender'),'-b',str(R/'embertarn.blend'),'--python-exit-code','1','-t',str(config.get('threads',48//workers)),'-P',str(R/'render.py'),'--','--start',str(start),'--end',str(end),'--stride',str(workers),'--offset',str(worker),'--outdir',str(out)]
      if a.samples:cmd+=['--samples',str(a.samples)]
      jobs.append(subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT))
     codes=[job.wait() for job in jobs]
    finally:
     for job in jobs:
      if job.poll() is None:job.terminate()
     for job in jobs:
      try:job.wait(timeout=20)
      except subprocess.TimeoutExpired:job.kill();job.wait()
     for log in logs:log.close()
    print('BATCH',start,end,'ATTEMPT',attempt+1,'EXIT',codes,flush=True)
    if all(valid_png(out/f'f_{i:06d}.png') for i in range(start,end+1)):break
    time.sleep(5)
   else:raise RuntimeError(f'Failed batch {start}-{end}')
if __name__=='__main__':main()
