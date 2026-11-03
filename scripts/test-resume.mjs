import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {root} from './capture-common.mjs';
const out=path.join(root,'frames/preview'),args=['scripts/render.mjs','--fps','30','--sub','2','--segments','1:30,22:30,57:30','--restart','30','--out','frames/preview'];
const hashes=()=>Object.fromEntries(fs.readdirSync(out).filter(x=>/^f_\d+\.png$/.test(x)).map(x=>[x,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,x))).digest('hex')]));
// Kill the complete owned process tree, including Chrome, like a VM stop.
let killed=false;const child=spawn(process.execPath,args,{cwd:root,detached:process.platform!=='win32',stdio:['ignore','pipe','inherit']});
child.stdout.on('data',b=>{const s=b.toString();process.stdout.write(s);if(!killed&&s.includes('FRAME 4 saved')){killed=true;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});else process.kill(-child.pid,'SIGKILL');}});
await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
if(!killed)throw Error('Use a fresh frames/preview directory for the interruption test');
const before=hashes();
// Include a corrupt final file: decoder validation must regenerate it.
fs.writeFileSync(path.join(out,'f_000089.png'),'interrupted PNG');
const result=spawn(process.execPath,args,{cwd:root,stdio:'inherit'});const code=await new Promise((resolve,reject)=>{result.on('exit',resolve);result.on('error',reject);});if(code!==0)throw Error('Resume failed');
const after=hashes(),progress=JSON.parse(fs.readFileSync(path.join(out,'progress.json')));
const unchanged=Object.entries(before).every(([k,v])=>after[k]===v);
const report={forcedProcessTreeKill:true,preserved:Object.keys(before).length,unchanged,completed:Object.keys(after).length,skipped:progress.skippedThisRun,corruptFrameRegenerated:fs.statSync(path.join(out,'f_000089.png')).size>100};
fs.mkdirSync(path.join(root,'screenshots/film'),{recursive:true});fs.writeFileSync(path.join(root,'screenshots/film/resume-test.json'),JSON.stringify(report,null,2));console.log(report);if(!unchanged||report.completed!==90||report.skipped<report.preserved||!report.corruptFrameRegenerated)throw Error('Resume invariant failed');
