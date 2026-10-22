import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {Runtime} from '../server/runtime.mjs';
function fixture(){
 const guardian=new EventEmitter();guardian.messages=[];guardian.send=m=>guardian.messages.push(m);guardian.close=()=>{};guardian.pid=998;
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
test('normal finish returns idle without requiring host restart',async()=>{
 const r=fixture();r.state='active';r.token='old';r.grants.set('app',{});const result=await r.finish();assert.equal(r.state,'idle');assert.equal(r.token,'');assert.equal(r.grants.size,0);assert.equal(result.restart_required,false);assert.equal(r.guardian.messages[0].op,'end');
});
test('native human pause notification invalidates cached observations',async()=>{
 const r=fixture();r.state='active';r.frames.set('old',{});r.guardian.emit('state','paused');assert.equal(r.state,'paused');assert.equal(r.frames.size,0);assert.equal(r.driver.abortCalls,1);
});
test('normal end cannot bypass emergency stop or human takeover',async()=>{
 for(const state of ['stopped','paused']) {
  const r=fixture();r.state=state;await r.finish();assert.equal(r.state,state);
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
