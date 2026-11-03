import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {serve,launch,checkBackend,root} from './capture-common.mjs';
const {server,url}=await serve();let browser;const out=path.join(root,'screenshots/film');fs.mkdirSync(out,{recursive:true});
try{
 browser=await launch();const page=await browser.newPage(),errors=[];await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(url+'/?capture=1&quality=ultra&film=1',{waitUntil:'networkidle0',timeout:240000});await page.waitForFunction(()=>window.__ready||window.__errors?.length,{timeout:240000});if(!await page.evaluate(()=>window.__ready))throw Error('Initialization failed');const backend=await checkBackend(page);
 async function frame(t,sub=2){return Buffer.from(await page.evaluate(async({t,sub})=>{await window.__renderFrame(t,{sub,fps:30});return window.__framePNG();},{t,sub}),'base64');}
 for(const t of [1,22,37,57])fs.writeFileSync(path.join(out,`film-${String(t).padStart(3,'0')}.png`),await frame(t));
 const digest=b=>crypto.createHash('sha256').update(b).digest('hex');const a=digest(await frame(46.8));await frame(80);const b=digest(await frame(46.8));
 const timings=[];for(const t of [1,22,37,57]){const begin=performance.now();await frame(t,16);timings.push({time:t,seconds:(performance.now()-begin)/1000});}
 const clearance=await page.evaluate(()=>window.__tourCollisionCheck());const assetErrors=await page.evaluate(()=>window.__errors);
 const report={backend,errors,assetErrors,deterministicCrossfade:a===b,clearance,sub16At1080p:timings,meanSeconds:timings.reduce((s,v)=>s+v.seconds,0)/timings.length};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length||assetErrors.length||a!==b||clearance.groundMargin<1.5||clearance.treeMargin<0)throw Error('Film validation failed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
