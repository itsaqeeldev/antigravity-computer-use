// Real native window lifecycle regression; no target apps, clicks or keys.
// Run separately from other desktop owners (one emergency hotkey per desktop).
import {testDirectory} from './paths.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {Guardian} from '../server/guardian.mjs';
const dir=fs.mkdtempSync(path.join(testDirectory('guardian-visibility'),'run-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
for(const latched of [false,true]){
 const folder=path.join(dir,latched?'latched':'idle');fs.mkdirSync(folder);
 const guard=path.join(folder,'guard.state'),latch=path.join(folder,'emergency.stop');
 fs.writeFileSync(guard,'idle||0|');fs.writeFileSync(guard+'.inputs','');if(latched)fs.writeFileSync(latch,'owner-stop');
 const g=new Guardian({AGCU_GUARD_FILE:guard,AGCU_STOP_LATCH:latch,AGCU_PARENT_PID:String(process.pid),AGCU_REAL_CURSOR:'1',CU_OVERLAY:'off',CU_PRESENCE:'off'});
 const state=latched?'stopped':'idle';
 const status=()=>g.request({op:'visual_status'});
 try{
  await g.start();await pause(150);
  let s=await status();assert.equal(s.state,state);assert.equal(s.controls_visible,false);assert.equal(s.cursor,false);
  // A screenshot finishing after End/Stop must never resurrect the HUD.
  await g.request({op:'capture'});g.send({op:'capture_end'});
  s=await status();assert.equal(s.controls_visible,false);
  s=await g.request({op:'show_controls'});assert.equal(s.state,state);assert.equal(s.controls_visible,true);
  if(latched){
   s=await g.request({op:'activate',token:'must-refuse',deadline:'999999999999999999'});
   assert.equal(s.allowed,false);assert.equal(s.state,'stopped');assert(fs.existsSync(latch));
  }
  s=await g.request({op:'end'});assert.equal(s.controls_visible,false);assert.equal(s.state,state);
  await g.request({op:'capture'});g.send({op:'capture_end'});assert.equal((await status()).controls_visible,false);
  if(!latched){
   const deadline=(BigInt(Date.now()+30000)*10000n+621355968000000000n).toString();
   s=await g.request({op:'activate',token:'no-app-grants',deadline});assert.equal(s.allowed,true);
   s=await status();assert.equal(s.controls_visible,true);
   s=await g.request({op:'end'});assert.equal(s.state,'idle');assert.equal(s.controls_visible,false);
   assert.equal((await status()).cursor,false);
  }
  await g.request({op:'show_controls'});
  s=await g.request({op:'dismiss_controls'});assert.equal(s.controls_visible,false);assert.equal(s.state,state);
  g.send({op:'stop'});
  for(let i=0;i<20;i++){s=await status();if(s.state==='stopped'&&s.controls_visible)break;await pause(50);}
  assert.equal(s.state,'stopped');assert.equal(s.controls_visible,true);
  assert(fs.existsSync(latch));await pause(8300);
  s=await status();assert.equal(s.state,'stopped');assert.equal(s.controls_visible,false);assert.equal(s.cursor,false);
  g.send({op:'capture_end'});assert.equal((await status()).controls_visible,false);
  assert(fs.existsSync(latch));assert(fs.readFileSync(guard,'utf8').startsWith('stopped|'));
  await g.close();await g.start();s=await status();
  assert.equal(s.state,'stopped');assert.equal(s.controls_visible,false);assert.equal(s.cursor,false);assert(fs.existsSync(latch));
  results.push({startup:state,passed:true,hidden_startup:true,explicit_controls:true,end_hides:true,capture_does_not_resurrect:true,stop_auto_dismiss:true,latch_preserved:true});
 }finally{await g.close();}
}
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({passed:true,results,physical_stop_tested:false},null,2));
console.log(JSON.stringify({passed:true,dir,results}));
