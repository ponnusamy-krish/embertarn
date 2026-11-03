import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root} from './capture-common.mjs';
const a={frames:'frames',out:'output/alpine_lake_5min.mp4',audio:'output/ambience.wav',fps:30,count:9000,start:0,title:0};
for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i].slice(2);if(!(k in a))throw Error('Unknown '+k);a[k]=['fps','count','start','title'].includes(k)?Number(process.argv[i+1]):process.argv[i+1];}
for(const k of ['fps','count'])if(!Number.isInteger(a[k])||a[k]<1)throw Error('Invalid '+k);
const output=path.resolve(root,a.out),frames=path.resolve(root,a.frames),audio=path.resolve(root,a.audio),duration=a.count/a.fps;
fs.mkdirSync(path.dirname(output),{recursive:true});
const metadata=output+'.json',tmp=output+'.partial.mp4',titleFile=path.join(path.dirname(output),'title.partial.txt');
function run(bin,args){return spawnSync(bin,args,{encoding:'utf8',maxBuffer:8e6});}
function valid(file){const p=run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,pix_fmt,nb_frames','-of','json',file]);try{const d=JSON.parse(p.stdout);return Math.abs(+d.format.duration-duration)<.1&&d.streams.some(s=>s.codec_name==='h264'&&s.pix_fmt==='yuv420p'&&+s.nb_frames===a.count)&&d.streams.some(s=>s.codec_name==='aac');}catch{return false;}}
const manifest=JSON.parse(fs.readFileSync(path.join(frames,'manifest.json')));if(manifest.fps!==a.fps||a.start+a.count>manifest.total)throw Error('Frame manifest/range mismatch');
const hash=crypto.createHash('sha256');hash.update(JSON.stringify(a));hash.update(JSON.stringify(manifest));hash.update(fs.readFileSync(audio));
// Include every actual input PNG so replacing a frame invalidates a previous encode.
for(let i=a.start;i<a.start+a.count;i++){const f=path.join(frames,`f_${String(i).padStart(6,'0')}.png`);if(!fs.existsSync(f)||fs.statSync(f).size<100)throw Error('Missing frame '+i);hash.update(fs.readFileSync(f));}
const fingerprint=hash.digest('hex');
let prior={};try{prior=JSON.parse(fs.readFileSync(metadata));}catch{}
if(prior.fingerprint===fingerprint&&valid(output)){console.log('Video already valid');process.exit(0);}
const probe=run('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=s=256x256:d=0.1','-c:v','h264_nvenc','-f','null','-']);
let encoder=probe.status===0?'h264_nvenc':'libx264';
const filters=[`fade=t=out:st=${Math.max(0,duration-1)}:d=${Math.min(1,duration)}`];
if(a.title){fs.writeFileSync(titleFile,'Embertarn');const escaped=titleFile.replaceAll('\\','/').replaceAll(':','\\:').replaceAll("'","\\'");const font=(process.env.FONT_FILE||(process.platform==='win32'?'C:/Windows/Fonts/arial.ttf':'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')).replaceAll(':','\\:');filters.unshift(`drawtext=fontfile='${font}':textfile='${escaped}':fontcolor=white:fontsize=46:x=(w-tw)/2:y=h*0.82:alpha='if(lt(t,1),t,if(lt(t,2),1,max(0,3-t)))'`);}
try{
 function encode(enc){const quality=enc==='h264_nvenc'?['-preset','p6','-rc','vbr','-cq','18','-b:v','0']:['-preset','slow','-crf','16'];return run('ffmpeg',['-hide_banner','-nostdin','-y','-framerate',String(a.fps),'-start_number',String(a.start),'-i',path.join(frames,'f_%06d.png'),'-i',audio,'-t',String(duration),'-vf',filters.join(','),'-c:v',enc,...quality,'-profile:v','high','-pix_fmt','yuv420p','-r',String(a.fps),'-c:a','aac','-b:a','320k','-ar','48000','-movflags','+faststart',tmp]);}
 let result=encode(encoder);if(result.status!==0&&encoder==='h264_nvenc'){console.warn('NVENC encode failed; trying libx264',result.stderr.slice(-1500));encoder='libx264';result=encode(encoder);}if(result.status!==0)throw Error(result.stderr);if(!valid(tmp))throw Error('Encoded stream validation failed');fs.renameSync(tmp,output);fs.writeFileSync(metadata+'.partial',JSON.stringify({fingerprint,encoder,duration,frames:a.count,fps:a.fps},null,2));fs.renameSync(metadata+'.partial',metadata);console.log('Encoded',output,encoder);
}finally{for(const f of [tmp,titleFile])if(fs.existsSync(f))fs.unlinkSync(f);}
