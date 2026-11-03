"""Cloud-only destructive-interruption test, confined to its own Blender process."""
from pathlib import Path
import subprocess,time,json,hashlib
from frameio import valid_png
R=Path(__file__).resolve().parent;out=R/'frames-test';out.mkdir(exist_ok=True)
cmd=[str(R/'tools/blender/blender'),'-b',str(R/'embertarn.blend'),'--python-exit-code','1','-P',str(R/'render.py'),'--','--start','160','--end','183','--samples','8','--outdir',str(out)]
done=[p for p in out.glob('f_*.png') if valid_png(p)]
if len(done)<4:
 with open(R/'resume-interrupted.log','w') as log:
  job=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT)
  try:
   deadline=time.time()+900
   while job.poll() is None:
    done=[p for p in out.glob('f_*.png') if valid_png(p)]
    if len(done)>=4:job.kill();job.wait();break
    if time.time()>deadline:raise TimeoutError('No four frames within 15 minutes')
    time.sleep(.3)
  finally:
   if job.poll() is None:job.kill();job.wait()
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.glob('f_*.png') if valid_png(p)}
with open(R/'resume-completed.log','w') as log:subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,check=True)
assert all(valid_png(out/f'f_{i:06d}.png') for i in range(160,184))
assert all(hashlib.sha256((out/name).read_bytes()).hexdigest()==sha for name,sha in before.items())
log=(R/'resume-completed.log').read_text();assert all(f'SKIP {int(name[2:8])}' in log for name in before)
report={'valid_frames':24,'preserved_sha256':before,'interruption':'SIGKILL of the owned Blender process after four complete frames','resume_verified':True}
(R/'resume-result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
subprocess.run(['python3',str(R/'audio.py')],check=True)
subprocess.run(['python3',str(R/'encode.py'),'--frames','frames-test','--start','160','--count','24','--out','output/preview_test.mp4'],check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate:format=duration','-of','json',str(R/'output/preview_test.mp4')],check=True)
