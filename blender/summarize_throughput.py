"""Summarize measured wall throughput and Cycles diagnostic stage timings."""
from pathlib import Path
import json,re,statistics
R=Path(__file__).resolve().parent
def mean(a):return statistics.mean(a) if a else None
def stamp(line):
 m=re.match(r'(\d+):(\d+\.\d+)',line)
 return int(m[1])*60+float(m[2]) if m else None
results={}
for directory in sorted((R/'throughput').iterdir()):
 if not (directory/'result.json').exists():continue
 result=json.loads((directory/'result.json').read_text());profiles=[]
 for log in directory.glob('worker-*.log'):
  for block in log.read_text().split('PROFILE_EVALUATED')[1:]:
   frame=int(block.split()[0]);sync=re.findall(r'Total time spent synchronizing data: ([\d.]+)',block);path=re.findall(r'Path Tracing\s+([\d.]+)\s+',block);denoise=re.findall(r'Denoiser\s+([\d.]+)\s+',block);bvh=[stamp(line) for line in block.splitlines() if 'Using fast to trace OptiX BVH' in line];bvh=[x for x in bvh if x is not None]
   profiles.append({'frame':frame,'scene_sync_seconds':sum(map(float,sync)),'path_trace_seconds':sum(map(float,path)),'denoise_seconds':sum(map(float,denoise)),'bvh_submission_span_seconds':max(bvh)-min(bvh) if len(bvh)>1 else 0,'bvh_submissions':len(bvh)})
 samples=[json.loads(line) for line in (directory/'telemetry.jsonl').read_text().splitlines()];samples=[s for s in samples if 'gpu' in s]
 gpu=[[float(v.strip()) for v in s['gpu'].split(',')] for s in samples]
 result['telemetry_summary']={'mean_gpu_percent':mean([v[0] for v in gpu]),'peak_gpu_percent':max([v[0] for v in gpu],default=0),'peak_vram_mib':max([v[2] for v in gpu],default=0),'mean_cpu_percent_all_48_vcpus':mean([s['cpu_percent'] for s in samples if s.get('cpu_percent') is not None])}
 result['cycles_stages']=profiles
 result['profiling_note']='Cycles logs provide synchronization/path/denoise durations. BVH submission span is timestamped first-to-last OptiX BVH submission, not an isolated GPU timer; device upload/setup overlaps and is included in total render duration.'
 results[directory.name]=result
(R/'throughput-summary.json').write_text(json.dumps(results,indent=2))
for name,r in results.items():print(name,round(r['frames_hour_including_startup']),r['exit_codes'],r['telemetry_summary'],r['diffs'])
