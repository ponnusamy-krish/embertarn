"""Cloud-only bounded experiments; never launches the complete film."""
from pathlib import Path
import subprocess,time,json,threading,os,argparse,hashlib
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parent
B=R/'tools/blender/blender'
PROFILES={
 'baseline':{},
 'threads8':{'reuse_engine':True,'compression':0,'threads':8},
 'threads16':{'reuse_engine':True,'compression':0,'threads':16},
 'reuse_engine':{'reuse_engine':True,'compression':0},
 'png0':{'compression':0},
 'png3':{'compression':3},
 'camera_static':{'compression':0,'camera_only_blur':True},
 'oidn':{'compression':0,'denoiser':'OPENIMAGEDENOISE'},
 'hybrid':{'compression':0,'hybrid':True},
 'adaptive':{'compression':0,'adaptive_threshold':.06,'adaptive_min_samples':8},
 'bounces':{'compression':0,'max_bounces':4,'glossy_bounces':2,'transmission_bounces':4},
 'tile512':{'compression':0,'tile_size':512},
 'gpu_compositor':{'compression':0,'compositor_device':'GPU'},
}

for name,c in PROFILES.items():
 if name not in ('baseline','png0','png3'):c['reuse_engine']=True

def telemetry(stop,path):
 with open(path,'w') as f:
  last=None
  while not stop.is_set():
   try:
    gpu=subprocess.check_output(['nvidia-smi','--query-gpu=utilization.gpu,utilization.memory,memory.used,power.draw','--format=csv,noheader,nounits'],text=True).strip()
    cpu=list(map(int,Path('/proc/stat').read_text().splitlines()[0].split()[1:]));total=sum(cpu);idle=cpu[3]+cpu[4]
    load=None if last is None else 100*(1-(idle-last[1])/max(1,total-last[0]));last=(total,idle)
    f.write(json.dumps({'time':time.time(),'gpu':gpu,'cpu_percent':load})+'\n');f.flush()
   except Exception as e:f.write(json.dumps({'error':str(e)})+'\n')
   stop.wait(.3)

def experiment(name,config,workers=1,frames=None):
 frames=frames or [80,81,82,560,561,562]
 out=R/'throughput'/name;out.mkdir(parents=True,exist_ok=True)
 result=out/'result.json'
 if result.exists():
  manifest=json.loads((out/'manifest.json').read_text());h=hashlib.sha256()
  with open(R/'embertarn.blend','rb') as f:
   for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
  if manifest['blend']!=h.hexdigest() or manifest['renderer']!=hashlib.sha256((R/'render.py').read_bytes()).hexdigest() or manifest['config']!=config:raise RuntimeError('Stale benchmark: preserve/rename throughput directory before testing changed scene/code')
  return json.loads(result.read_text())
 cfg=out/'config.json';cfg.write_text(json.dumps(config));stop=threading.Event();monitor=threading.Thread(target=telemetry,args=(stop,out/'telemetry.jsonl'));monitor.start()
 start=time.monotonic();jobs=[];logs=[]
 try:
  for worker in range(workers):
   log=open(out/f'worker-{worker}.log','w');logs.append(log)
   command=[str(B),'--debug-cycles','-b',str(R/'embertarn.blend'),'--python-exit-code','1','-t',str(config.get('threads',max(8,48//workers))),'-P',str(R/'render.py'),'--','--frames',','.join(map(str,frames)),'--outdir',str(out),'--config',str(cfg),'--stride',str(workers),'--offset',str(worker)]
   jobs.append(subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'CYCLES_LOG_LEVEL':'2'}))
  codes=[j.wait() for j in jobs]
 finally:
  stop.set();monitor.join()
  for log in logs:log.close()
 elapsed=time.monotonic()-start
 timings=[json.loads(line) for p in out.glob('timings-*.jsonl') for line in p.read_text().splitlines()]
 data={'config':config,'workers':workers,'frames':len(timings),'wall_seconds':elapsed,'frames_hour_including_startup':len(timings)*3600/elapsed,'exit_codes':codes,'timings':timings}
 if timings:
  data['mean_seconds']=sum(x['seconds'] for x in timings)/len(timings)
  data['stage_means']={k:sum(x[k] for x in timings)/len(timings) for k in ['evaluation','render','save','validation']}
 # Same seeded frame, comparing decoded display pixels; retain max and spatial differences.
 data['diffs']={}
 for frame in [80,560]:
  baseline=R/'throughput/baseline'/f'f_{frame:06d}.png';candidate=out/f'f_{frame:06d}.png'
  if baseline.exists() and candidate.exists():
   a=np.asarray(Image.open(baseline).convert('RGB'),dtype=np.float32)/255;b=np.asarray(Image.open(candidate).convert('RGB'),dtype=np.float32)/255;delta=np.abs(a-b)
   data['diffs'][str(frame)]={'mae':float(delta.mean()),'rmse':float(np.sqrt((delta**2).mean())),'p99':float(np.percentile(delta,99)),'max':float(delta.max())}
 result.write_text(json.dumps(data,indent=2));print(name,json.dumps({k:v for k,v in data.items() if k!='timings'}),flush=True);return data

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--profiles',default=','.join(PROFILES));p.add_argument('--concurrent',type=int);p.add_argument('--config');a=p.parse_args()
 if a.concurrent:
  config=json.loads(Path(a.config).read_text());experiment(f'concurrent{a.concurrent}',config,a.concurrent,list(range(80,92))+list(range(560,572)))
 else:
  for name in a.profiles.split(','):experiment(name,PROFILES[name])
