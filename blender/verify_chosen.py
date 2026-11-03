from pathlib import Path
import json,subprocess
from throughput import experiment
R=Path(__file__).resolve().parent
c=json.loads((R/'render-settings.json').read_text())
r=experiment('chosen',c,c['workers'],list(range(80,92))+list(range(560,572)))
assert all(code==0 for code in r['exit_codes']) and r['frames']==24
subprocess.run(['python3',str(R/'quality_sheet.py'),'chosen'],check=True)
subprocess.run(['python3',str(R/'resume_parallel_test.py')],check=True)
subprocess.run(['python3',str(R/'summarize_throughput.py')],check=True)
