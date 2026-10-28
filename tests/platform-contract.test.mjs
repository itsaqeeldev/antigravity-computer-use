import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePlatform,verifyNativeContract,contract} from '../server/platform.mjs';
import {Runtime,requireObservation} from '../server/runtime.mjs';
import {call} from '../server/desktop-tools.mjs';

test('both native adapters expose one shared lifecycle and tool core',()=>{
 for(const os of ['win32','darwin'])assert.equal(nativePlatform(os).platform,os);
 assert.equal(contract.action_budget,200);assert.equal(contract.frame_ms,90000);
 assert.throws(()=>nativePlatform('linux'),e=>e.code==='unsupported_platform');
 assert.equal(nativePlatform('win32').runtime,'native-windows');
 assert.equal(nativePlatform('darwin').runtime,'native-macos');
});
test('an old or partially guarded Mac helper is refused before control',()=>{
 for(const info of [{},{control_contract:1},{control_contract:1,native_fence:true}])
  assert.throws(()=>verifyNativeContract(info,'darwin'),e=>e.code==='native_contract_mismatch');
 assert.doesNotThrow(()=>verifyNativeContract({control_contract:1,native_fence:true,held_input_cleanup:true},'darwin'));
});
test('observation lifetime and one-use semantics are platform independent',()=>{
 const frames=new Map([['f',{hwnd:1,at:0}]]);
 assert.throws(()=>requireObservation(frames,'f',1,contract.frame_ms+1),e=>e.code==='stale_observation');
 assert.equal(frames.size,0);
});
test('both adapters use the same batch failure boundary, with no later input',async()=>{
 for(const platform of ['win32','darwin']){
  const sent=[];const runtime={async action(op,args){sent.push(op);return {input_completed:true,verification_error:{code:'input_outcome_unknown'},metadata:{observation_id:'new'}};}};
  const reply=await call(runtime,'computer_run',{hwnd:1,observation_id:'f',reason:platform,steps:[{kind:'click',index:1},{kind:'key',keys:'enter'}]});
  assert.deepEqual(sent,['click']);assert.equal(reply.batch.skipped,1);
 }
});
