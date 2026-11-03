import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
export const root=path.resolve(import.meta.dirname,'..');
export async function serve(){
 const base=path.join(root,'dist');if(!fs.existsSync(path.join(base,'index.html')))throw Error('Run npm run build first');
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.hdr':'application/octet-stream'};
 const server=http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(base,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}const stat=fs.statSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'public, max-age=0'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return{server,url:`http://127.0.0.1:${server.address().port}`};
}
export async function launch(){
 const args=['--enable-unsafe-webgpu','--enable-gpu','--ignore-gpu-blocklist','--force-color-profile=srgb','--disable-background-timer-throttling'];
 if(process.platform==='linux')args.push('--enable-features=Vulkan,VulkanFromANGLE','--use-angle=vulkan');else args.push('--use-angle=d3d11');
 // Prefer an unprivileged VM user; root containers need the explicit opt-in.
 if(process.env.CHROME_NO_SANDBOX==='1')args.push('--no-sandbox');
 if(process.env.CHROME_EXTRA_ARGS)args.push(...JSON.parse(process.env.CHROME_EXTRA_ARGS));
 return puppeteer.launch({headless:true,args,executablePath:process.env.CHROME_BIN||undefined,protocolTimeout:300000});
}
export async function checkBackend(page){
 const b=await page.evaluate(()=>window.__backend);
 if(!b?.isWebGPUBackend)throw Error('Native WebGPU backend required');
 const info=JSON.stringify(b.adapter).toLowerCase();
 if(b.fallback||/swiftshader|llvmpipe|lavapipe|software|microsoft basic/.test(info)||!/(nvidia|intel|amd|apple|qualcomm)/.test(info))throw Error('Hardware GPU required: '+info);
 console.log('WEBGPU',JSON.stringify(b));return b;
}
