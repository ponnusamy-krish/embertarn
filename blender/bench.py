"""Measure steady frame times, retaining cold-start and total process overhead."""
from pathlib import Path
import subprocess,json,time,statistics
import shots
R=Path(__file__).resolve().parent;start=time.perf_counter()
cmd=[str(R/'tools/blender/blender'),'-b',str(R/'embertarn.blend'),'--python-exit-code','1','-P',str(R/'render.py'),'--','--frames','80,81,82,400,401,402,560,561,562','--outdir',str(R/'benchmark')]
subprocess.run(cmd,check=True);elapsed=time.perf_counter()-start
rows=[json.loads(line) for line in (R/'benchmark/timings-0.jsonl').read_text().splitlines()]
byframe={r['frame']:r['seconds'] for r in rows}
wide=statistics.mean(byframe[i] for i in [81,82]);shore=statistics.mean(byframe[i] for i in [400,401,402]);forest=statistics.mean(byframe[i] for i in [560,561,562]);counts={k:sum(s['kind']==k for s in shots.SHOTS) for k in ['wide','close','forest','water']}
weighted=(counts['wide']*wide+counts['forest']*forest+(counts['close']+counts['water'])*shore)/45
result={'gpu':'RTX PRO 6000 Blackwell Server Edition','backend':'Cycles OptiX','resolution':[1920,1080],'fps':24,'wide_warm_seconds':wide,'shore_seconds':shore,'forest_seconds':forest,'cold_first_frame_seconds':byframe[80],'benchmark_process_seconds':elapsed,'shot_counts':counts,'estimated_7200_hours':weighted*7200/3600,'estimate_with_20_percent_margin_hours':weighted*7200/3600*1.2,'note':'Includes frame evaluation, rendering, PNG writing and validation. Estimate excludes spot downtime; wider tour is not exhaustively benchmarked.'}
(R/'benchmark-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2),flush=True)
