import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {Runtime} from '../server/runtime.mjs';
import fs from 'node:fs';import path from 'node:path';
function fixture(){
 const guardian=new EventEmitter();guardian.messages=[];guardian.send=m=>guardian.messages.push(m);guardian.request=async m=>{guardian.messages.push(m);return {state:'stopped',controls_visible:true};};guardian.close=()=>{};guardian.pid=998;
 const driver={abortCalls:0,async abort(){this.abortCalls++;},info:{pid:999}};
 const sessions={register(){},close(){}};
 return new Runtime({guardian,driver,sessions});
}
test('pause invalidates frames synchronously and keeps per-app session grants',async()=>{
 const r=fixture();r.state='active';r.frames.set('old',{});r.grants.set('app',{});const generation=r.generation;const pending=r.pause();assert.equal(r.state,'paused');assert(r.generation>generation);assert.equal(r.frames.size,0);assert.equal(r.grants.size,1);await pending;assert.equal(r.driver.abortCalls,1);
});
test('emergency stop invalidates grants/frames before awaiting the native worker',async()=>{
 const r=fixture();r.state='active';r.frames.set('old',{});r.grants.set('app',{});const pending=r.stop();assert.equal(r.state,'stopped');assert.equal(r.frames.size,0);assert.equal(r.grants.size,0);await pending;
 await assert.rejects(r.grant(123,'cannot self-rearm'),e=>e.code==='control_inactive');
});
test('failed Stop persistence keeps the service stopped and refuses shutdown until repaired',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-stop-write-'));try{
  const r=fixture();r.state='active';r.latchFile=path.join(dir,'missing','emergency.stop');r.frames.set('old',{});r.grants.set('app',{});
  await assert.rejects(r.stop(),e=>e.code==='stop_persistence_failed');assert.equal(r.state,'stopped');assert.equal(r.frames.size,0);assert.equal(r.grants.size,0);assert.equal(r.driver.abortCalls,1);assert.equal(r.lastControlReason,'stop_persistence_failed');
  await assert.rejects(r.close(),e=>e.code==='stop_persistence_failed');assert.equal(r.state,'stopped');
  fs.mkdirSync(path.dirname(r.latchFile));await r.stop();assert.equal(fs.readFileSync(r.latchFile,'utf8'),'stopped');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('a native Stop event reports a missing latch while keeping control stopped',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-native-stop-'));const guardian=new EventEmitter();guardian.send=()=>{};const driver={abort:async()=>{}};
 try{const r=new Runtime({guardian,driver,sessions:{register(){},close(){}},latchFile:path.join(dir,'emergency.stop')});r.state='active';guardian.emit('state','stopped','escape');
  assert.equal(r.state,'stopped');assert.equal(r.lastControlReason,'stop_persistence_failed');assert.equal(r.diagnosticError,'stop_persistence_failed');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('normal finish returns idle without requiring host restart',async()=>{
 const r=fixture();r.state='active';r.token='old';r.grants.set('app',{});const result=await r.finish();assert.equal(r.state,'idle');assert.equal(r.token,'');assert.equal(r.grants.size,0);assert.equal(result.restart_required,false);assert.equal(r.guardian.messages[0].op,'end');assert.equal(r.status().control_reason,'completed');r.guardian.emit('state','idle');assert.equal(r.status().control_reason,'completed');
});
test('native human pause notification invalidates cached observations',async()=>{
 const r=fixture();r.state='active';r.frames.set('old',{});r.guardian.emit('state','paused');assert.equal(r.state,'paused');assert.equal(r.frames.size,0);assert.equal(r.driver.abortCalls,1);
});
test('normal end cannot bypass emergency stop or human takeover',async()=>{
 for(const state of ['stopped','paused']) {
  const r=fixture();r.state=state;r.lastControlReason='human_takeover';await r.finish();assert.equal(r.state,state);assert.equal(r.status().control_reason,'human_takeover');
  await assert.rejects(r.grant(123,'cannot bypass human re-arm'),e=>e.code==='control_inactive');
 }
});
test('launch cannot restart a stopped guardian before checking the stop latch',async()=>{
 const r=fixture();r.state='stopped';let starts=0;r.guardian.start=async()=>{starts++;r.state='idle';};
 await assert.rejects(r.launch({app:'nonexistent.exe',reason:'must not re-arm'}),e=>e.code==='control_inactive');assert.equal(starts,0);
});
test('permission authority is fixed at startup and surfaced in status',()=>{
 const r=fixture();assert.equal(r.status().permission_mode,'standalone');
 assert.throws(()=>new Runtime({permissionMode:'turbo-from-model'}),/Invalid startup/);
});


test('host-authorized soft resume requires native consent and invalidates old observations',async()=>{
 const r=fixture();r.permissionMode='host-managed';r.state='paused';r.frames.set('old',{});const generation=r.generation;
 r.guardian.request=async m=>{assert.equal(m.op,'resume');return {allowed:true,state:'active'};};
 const result=await r.resume();assert.equal(r.state,'active');assert.equal(r.frames.size,0);assert(r.generation>generation);assert.equal(result.replayed_actions,0);assert.equal(r.status().control_reason,'host_authorized_resume');
});
test('chat resume never clears emergency stop or standalone human approval',async()=>{
 for(const [mode,state] of [['host-managed','stopped'],['standalone','paused'],['host-managed','idle']]){
  const r=fixture();r.permissionMode=mode;r.state=state;r.guardian.request=()=>{throw Error('must not ask native');};
  await assert.rejects(r.resume(),e=>e.code==='human_resume_required');assert.equal(r.state,state);
 }
});

test('emergency Stop wins a race with a successful native soft-resume reply',async()=>{
 const r=fixture();r.permissionMode='host-managed';r.state='paused';
 r.guardian.request=async()=>{r.guardian.emit('state','stopped','escape');return {allowed:true,state:'active'};};
 await assert.rejects(r.resume(),e=>e.code==='human_resume_required');assert.equal(r.state,'stopped');
 assert.equal(r.status().control_reason,'escape');
});

test('emergency Stop survives service replacement; ordinary idle shutdown does not create a latch',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-latch-'));const file=path.join(dir,'emergency.stop');
 const make=()=>{const r=fixture();r.latchFile=file;return r;};
 try {
  const ordinary=make();await ordinary.close();assert(!fs.existsSync(file));
  const stopped=make();await stopped.stop();assert(fs.existsSync(file));await stopped.finish();assert(fs.existsSync(file));
  const guardian=new EventEmitter();guardian.send=()=>{};guardian.request=async()=>({state:'stopped',controls_visible:true});
  const replacement=new Runtime({latchFile:file,guardian,driver:{abort:async()=>{}},sessions:{register(){}}});
  assert.equal(replacement.state,'stopped');await assert.rejects(replacement.grant(1),e=>e.code==='control_inactive');
  replacement.permissionMode='host-managed';await assert.rejects(replacement.resume(),e=>e.code==='human_resume_required');
  assert(fs.existsSync(file),'model operations must not remove the native human re-arm latch');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
