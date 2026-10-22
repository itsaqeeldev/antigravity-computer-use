// Requires real human motion/click and real human Resume. Never synthesizes
// physical-input events or operates the control bar on the human's behalf.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
const dir=path.resolve('.localdata/smart-takeover-live');fs.mkdirSync(dir,{recursive:true});
process.env.AGCU_DATA_DIR=dir;
const {Runtime}=await import('../server/runtime.mjs');
const r=new Runtime({permissionMode:'host-managed',takeoverMode:'smart'});
const result={passed:false,pending:true,started_at:new Date().toISOString(),events:[],checks:[]};
const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));
r.guardian.on('state',(state,reason)=>{result.events.push({state,reason,at:new Date().toISOString()});save();});
let fixture;
const waitFor=async(predicate,ms=600000)=>{const until=Date.now()+ms;while(!predicate()){if(Date.now()>until)throw Error('Human test timed out');await new Promise(r=>setTimeout(r,100));}};
try{
 fixture=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve('tools/make-target.ps1'),'-Right'],{windowsHide:false,stdio:['ignore','pipe','pipe']});
 const target=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Fixture startup timeout')),15000);createInterface({input:fixture.stdout}).on('line',line=>{try{const v=JSON.parse(line);if(v.hwnd){clearTimeout(t);resolve(v);}}catch{}});});
 const old=await r.observe({hwnd:target.hwnd});assert.equal(r.guardian.takeoverMode,'smart');result.stage='awaiting_physical_takeover';save();console.log('SMART ACTIVE: deliberately move the mouse or click in the disposable test window. Then click Resume on the actual control bar.');
 await waitFor(()=>r.state==='paused');assert.equal(r.frames.size,0);await assert.rejects(r.observe({hwnd:target.hwnd}),e=>e.code==='control_inactive');
 result.checks.push('Physical input paused Smart mode; observations cleared; new observation blocked while paused');result.stage='awaiting_human_resume';save();console.log('PAUSE VERIFIED. Click the triangle Resume control on the bar.');
 await waitFor(()=>r.state==='active');
 await assert.rejects(r.action('move',{hwnd:target.hwnd,observation_id:old.metadata.observation_id,x:10,y:10,risk:'routine',reason:'Verify stale pre-pause observation rejection'}),e=>e.code==='stale_observation');
 const fresh=await r.observe({hwnd:target.hwnd});assert(fresh.image.data);assert.notEqual(fresh.metadata.observation_id,old.metadata.observation_id);
 result.checks.push('Human Resume restored control; old observation rejected; fresh screenshot returned');
 await r.finish();assert.equal(r.state,'idle');result.checks.push('Normal finish after resume returned idle');result.passed=true;result.pending=false;result.stage='passed';save();console.log('SMART TAKEOVER AND HUMAN RESUME PASSED.');
}catch(e){result.error=e.stack;result.pending=false;save();process.exitCode=1;}
finally{await r.close();fixture?.kill();result.ended_at=new Date().toISOString();save();}
