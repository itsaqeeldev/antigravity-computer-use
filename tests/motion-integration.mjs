import {testDirectory} from './paths.mjs';
// Real motion and cancellation against our disposable fixture only.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';import {Runtime} from '../server/runtime.mjs';
const dir=testDirectory('motion-integration');fs.mkdirSync(dir,{recursive:true});const sampler=path.join(dir,'CursorSampler.exe');
const build=spawnSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['-nologo','-out:'+sampler,path.resolve('tests/CursorSampler.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(build.status,0,build.stdout+build.stderr);
const wait=ms=>new Promise(r=>setTimeout(r,ms));const checks=[],record={passed:false};let r,fixture;
async function startSample(ms){let resolveReady;const ready=new Promise(r=>resolveReady=r),p=spawn(sampler,[String(ms)],{windowsHide:true});const samples=[];createInterface({input:p.stdout}).on('line',l=>l==='ready'?resolveReady():samples.push(l.split(',').map(Number)));const done=new Promise(resolve=>p.on('exit',()=>resolve(samples)));await ready;return {done};}
function pt(s,n,x=.5,y=.5){const im=s.image;return [Math.floor((n.rect[0]+n.rect[2]*x-im.source[0])*im.width/im.source[2]),Math.floor((n.rect[1]+n.rect[3]*y-im.source[1])*im.height/im.source[3])];}
try{
 fixture=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('tools/make-target.ps1'),'-Right'],{windowsHide:false});
 const target=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Fixture startup timed out')),15000);createInterface({input:fixture.stdout}).on('line',l=>{try{const v=JSON.parse(l);if(v.hwnd){clearTimeout(t);resolve(v);}}catch{}});});
 r=new Runtime({permissionMode:'host-managed'});let s=await r.observe({hwnd:target.hwnd});
 let n=s.metadata.elements.find(e=>e.name==='Pixel canvas');let from=pt(s,n,.05,.5);s=await r.action('move',{hwnd:target.hwnd,observation_id:s.metadata.observation_id,x:from[0],y:from[1],risk:'routine'});
 n=s.metadata.elements.find(e=>e.name==='Press Me');const to=pt(s,n);const sampling=await startSample(1500);
 s=await r.action('click',{hwnd:target.hwnd,observation_id:s.metadata.observation_id,x:to[0],y:to[1],risk:'routine'});const frames=await sampling.done;
 assert(s.metadata.elements.some(e=>e.name==='pressed:1'));assert(new Set(frames.map(f=>f[1]+','+f[2])).size>=5,'Real cursor must visit intermediate positions');assert(s.result.motion.animated);checks.push('Real cursor visits intermediate positions; click completes at destination');record.motion=frames;
 n=s.metadata.elements.find(e=>e.name==='Pixel canvas');const observing=await startSample(2000);
 const operation=r.action('drag',{hwnd:target.hwnd,observation_id:s.metadata.observation_id,from:pt(s,n,.05,.5),to:pt(s,n,.95,.5),steps:100,risk:'routine'}).then(()=>({ok:true}),e=>({error:e.code}));
 let held=false;for(let i=0;i<150;i++){if(fs.existsSync(r.guardFile+'.inputs')&&fs.readFileSync(r.guardFile+'.inputs','utf8').includes('m:4')){held=true;break;}await wait(10);}assert(held,'Test must stop while automation actually holds left button');
 await r.stop();const result=await operation;assert(result.error);const stopped=await observing.done;assert.equal(stopped.at(-1)[3],0,'Stop must release automation-held mouse');assert.equal(r.state,'stopped');assert.equal(fs.readFileSync(r.guardFile+'.inputs','utf8'),'');
 const tail=stopped.slice(-15);assert.equal(new Set(tail.map(f=>f[1]+','+f[2])).size,1,'No later motion after cancellation');checks.push('Stop during actual held drag releases button and prevents later cursor movement');record.cancel=result;record.stop_motion=stopped;
 await assert.rejects(r.action('move',{hwnd:target.hwnd,x:0,y:0,risk:'routine'}));checks.push('Stopped runtime rejects further movement without human re-arm');record.passed=true;
}catch(e){record.error=e.stack;process.exitCode=1;}finally{if(r)await r.close();fixture?.kill();record.checks=checks;fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(record,null,2));console.log(JSON.stringify({...record,motion:record.motion?.length,stop_motion:record.stop_motion?.length},null,2));}
