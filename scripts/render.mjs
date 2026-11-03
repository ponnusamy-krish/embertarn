import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import {root,serve,launch,checkBackend} from './capture-common.mjs';
const args={fps:30,width:1920,height:1080,sub:16,out:'frames',start:0,end:undefined,restart:500};
for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i].replace(/^--/,'');if(!(k in args)&&!['segments','stop-after'].includes(k))throw Error('Unknown option '+k);if(!process.argv[i+1])throw Error('Missing value '+k);args[k]=['out','segments'].includes(k)?process.argv[i+1]:Number(process.argv[i+1]);}
for(const k of ['fps','width','height','sub','restart'])if(!Number.isInteger(args[k])||args[k]<1)throw Error('Invalid '+k);
if(args.sub>128)throw Error('sub must be <=128');
let timeline=null;if(args.segments){timeline=[];for(const s of args.segments.split(',')){const [seconds,count]=s.split(':').map(Number);if(!Number.isFinite(seconds)||seconds<0||!Number.isInteger(count)||count<1||seconds+count/args.fps>300)throw Error('Invalid segments');for(let i=0;i<count;i++)timeline.push(seconds+i/args.fps);}}
const total=timeline?.length??300*args.fps,end=args.end??total;
if(!Number.isInteger(args.start)||!Number.isInteger(end)||args.start<0||end>total||end<=args.start)throw Error('Invalid [start,end) range');
const out=path.resolve(root,args.out);fs.mkdirSync(out,{recursive:true});
const atomic=(file,data)=>{const tmp=file+'.partial';const fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);};
const lock=path.join(out,'render.lock');
if(fs.existsSync(lock)){let old;try{old=JSON.parse(fs.readFileSync(lock));}catch{old={};}let alive=false;if(old.host===os.hostname()){try{process.kill(old.pid,0);alive=true;}catch{}}if(alive)throw Error('Another renderer owns '+out);fs.unlinkSync(lock);}
fs.writeFileSync(lock,JSON.stringify({pid:process.pid,host:os.hostname()}),{flag:'wx'});
let browser,page,server,stopping=false,errors=[],backend,rendered=0,skipped=0,done=0,elapsed=0,restarts=0;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
function valid(file){try{const b=fs.readFileSync(file);if(b.length<100)return false;const png=PNG.sync.read(b,{checkCRC:true});let light=0;for(let i=0;i<png.data.length;i+=400)light+=png.data[i]+png.data[i+1]+png.data[i+2];return light>1000&&png.width===args.width&&png.height===args.height;}catch{return false;}}
async function fingerprint(){const hash=crypto.createHash('sha256');async function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else{hash.update(path.relative(path.join(root,'dist'),f).replaceAll('\\','/'));for await(const chunk of fs.createReadStream(f))hash.update(chunk);}}}await walk(path.join(root,'dist'));return hash.digest('hex');}
try{
 const config={version:4,build:await fingerprint(),fps:args.fps,width:args.width,height:args.height,sub:args.sub,total,timeline,shutter:180};
 const manifest=path.join(out,'manifest.json');if(fs.existsSync(manifest)){if(JSON.stringify(JSON.parse(fs.readFileSync(manifest)))!==JSON.stringify(config))throw Error('Render configuration/build differs. Use a new --out directory.');}else atomic(manifest,JSON.stringify(config));
 let previous={};try{previous=JSON.parse(fs.readFileSync(path.join(out,'progress.json')));}catch{}backend=previous.backend;
 const progress=(last)=>atomic(path.join(out,'progress.json'),JSON.stringify({updated:new Date().toISOString(),done,total,range:[args.start,end],renderedThisRun:rendered,skippedThisRun:skipped,lastFrame:last,secondsPerFrame:rendered?elapsed/rendered:(previous.secondsPerFrame??null),fps:rendered?rendered/elapsed:(previous.fps??null),etaSeconds:rendered?(end-args.start-rendered-skipped)*elapsed/rendered:null,restarts,backend},null,2));
 for(let i=0;i<total;i++)if(valid(path.join(out,`f_${String(i).padStart(6,'0')}.png`)))done++;
 const service=await serve();server=service.server;
 async function open(){if(browser)await browser.close().catch(()=>{});browser=await launch();page=await browser.newPage();errors=[];await page.setViewport({width:args.width,height:args.height,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});await page.goto(service.url+'/?capture=1&cinematic=1&quality=ultra&film=1',{waitUntil:'networkidle0',timeout:240000});await page.waitForFunction(()=>window.__ready||window.__errors?.length,{timeout:240000});if(!await page.evaluate(()=>window.__ready))throw Error('Scene failed to initialize');backend=await checkBackend(page);if(errors.length)throw Error(errors.join('\n'));}
 for(let i=args.start;i<end&&!stopping;i++){
  const file=path.join(out,`f_${String(i).padStart(6,'0')}.png`);if(valid(file)){skipped++;if(skipped%30===0)progress(i);continue;}
  if(!browser||rendered>0&&rendered%args.restart===0){await open();restarts++;}
  const begin=performance.now();let completed=false;
  for(let attempt=0;attempt<4&&!completed;attempt++){
   try{if(!browser)await open();const data=await page.evaluate(async ({t,sub,fps})=>{await window.__renderFrame(t,{sub,fps});if(window.__errors.length)throw Error(window.__errors.join('\n'));return window.__framePNG();},{t:timeline?.[i]??i/args.fps,sub:args.sub,fps:args.fps});if(errors.length)throw Error(errors.join('\n'));const bytes=Buffer.from(data,'base64');const decoded=PNG.sync.read(bytes);let luminance=0;for(let k=0;k<decoded.data.length;k+=400)luminance+=decoded.data[k]+decoded.data[k+1]+decoded.data[k+2];if(luminance<1000||decoded.width!==args.width||decoded.height!==args.height)throw Error('Blank frame or invalid dimensions');atomic(file,bytes);completed=true;}
   catch(e){console.error(`Frame ${i} attempt ${attempt+1}: ${e.message}`);await browser?.close().catch(()=>{});browser=null;if(attempt===3)throw e;await open();restarts++;}
  }
  elapsed+=(performance.now()-begin)/1000;rendered++;done++;progress(i);console.log(`FRAME ${i} saved; ${done}/${total}; ${(elapsed/rendered).toFixed(3)} s/frame`);
  if(args['stop-after']&&rendered>=args['stop-after'])stopping=true;
 }
 progress(null);console.log(JSON.stringify({done,rendered,skipped,secondsPerFrame:elapsed/rendered,stopped:stopping}));if(stopping)process.exitCode=130;
}finally{await browser?.close().catch(()=>{});if(server)await new Promise(r=>server.close(r));if(fs.existsSync(lock))fs.unlinkSync(lock);}
