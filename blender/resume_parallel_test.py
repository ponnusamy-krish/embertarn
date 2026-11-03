"""Kill the owned coordinator/process group, then resume the chosen configuration."""
from pathlib import Path
import subprocess,os,signal,time,hashlib,json
from frameio import valid_png
R=Path(__file__).resolve().parent;out=R/'frames-resume-round9';out.mkdir(exist_ok=True)
cmd=['python3',str(R/'render_batch.py'),'--start','160','--end','183','--samples','8','--outdir',str(out)]
existing=[p for p in out.glob('f_*.png') if valid_png(p)]
if not existing:
 with open(R/'resume-round9-interrupted.log','w') as log:
  job=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:
   deadline=time.monotonic()+900
   while job.poll() is None:
    if sum(valid_png(p) for p in out.glob('f_*.png'))>=4:
     os.killpg(job.pid,signal.SIGKILL);job.wait();break
    if time.monotonic()>deadline:raise TimeoutError('Resume test timed out')
    time.sleep(.15)
  finally:
   if job.poll() is None:os.killpg(job.pid,signal.SIGKILL);job.wait()
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('f_*.png') if valid_png(p)}
with open(R/'resume-round9-completed.log','w') as log:subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,check=True)
assert len(before)>=4
assert all(valid_png(out/f'f_{i:06d}.png') for i in range(160,184))
assert all(hashlib.sha256((out/name).read_bytes()).hexdigest()==sha for name,sha in before.items())
logs='\n'.join(p.read_text() for p in out.glob('worker-*.log'))
assert all(f'SKIP {int(name[2:8])}' in logs for name in before)
report={'valid_frames':24,'preserved_sha256':before,'resume_verified':True,'interruption':'SIGKILL owned process group, including all Blender workers','config':json.loads((R/'render-settings.json').read_text())}
(R/'resume-round9-result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
