import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root} from './capture-common.mjs';
const out=path.join(root,'output');fs.mkdirSync(out,{recursive:true});
const final=path.join(out,'ambience.wav'),meta=path.join(out,'ambience.json'),raw=path.join(out,'ambience.raw.partial'),tmp=path.join(out,'ambience.partial.wav');
const recipe='embertarn-procedural-cc0-v1';
const probe=f=>{const p=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',f],{encoding:'utf8'});try{return Number(JSON.parse(p.stdout).format.duration);}catch{return 0;}};
let prior={};try{prior=JSON.parse(fs.readFileSync(meta));}catch{}
if(prior.recipe===recipe&&Math.abs(probe(final)-300)<.01){console.log('Audio already valid');process.exit(0);}
function ff(args){const p=spawnSync('ffmpeg',['-hide_banner','-nostdin',...args],{encoding:'utf8',maxBuffer:8e6});if(p.status!==0)throw Error(p.stderr);return p.stderr;}
let seed=741,wind=0,water=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
// Original procedural ambience: continuous filtered wind, modulated shore wash,
// and sparse chirp trains. No third-party audio or audible loop seams.
const rate=48000,fd=fs.openSync(raw,'w'),chunk=Buffer.alloc(rate*4);
try{for(let sec=0;sec<300;sec++){for(let i=0;i<rate;i++){const t=sec+i/rate;wind=.997*wind+.003*rand();water=.88*water+.12*rand();const wash=(.5+.5*Math.sin(t*.83+Math.sin(t*.17)))**3;const cycle=t%11.7,chirpTime=cycle% .31;const chirp=cycle<1.0?Math.sin(2*Math.PI*(1900*chirpTime+1100*chirpTime*chirpTime)) * Math.sin(Math.PI*Math.min(1,chirpTime/.31))**6*.012:0;
 const base=wind*.6*(.65+.35*Math.sin(t*.13))+water*.035*wash+chirp;const pan=.18*Math.sin(t*.07);for(let c=0;c<2;c++)chunk.writeInt16LE(Math.round(Math.max(-1,Math.min(1,base*(1+(c?pan:-pan))))*32767),i*4+c*2);}fs.writeSync(fd,chunk);}fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
try{
 const input=['-f','s16le','-ar',String(rate),'-ac','2','-i',raw],fade='afade=t=in:d=3,afade=t=out:st=296:d=4';
 const analysis=ff([...input,'-af',fade+',loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']);
 const measured=JSON.parse(analysis.slice(analysis.lastIndexOf('{'),analysis.lastIndexOf('}')+1));
 const normalize=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
 ff(['-y',...input,'-af',fade+','+normalize,'-ar','48000','-c:a','pcm_s24le',tmp]);
 if(Math.abs(probe(tmp)-300)>.01)throw Error('Audio duration mismatch');fs.renameSync(tmp,final);fs.writeFileSync(meta+'.partial',JSON.stringify({recipe,duration:300,targetLUFS:-16,sourceMeasurement:measured},null,2));fs.renameSync(meta+'.partial',meta);console.log('Generated 300 s original CC0 ambience, two-pass -16 LUFS');
}finally{for(const f of [raw,tmp])if(fs.existsSync(f))fs.unlinkSync(f);}
