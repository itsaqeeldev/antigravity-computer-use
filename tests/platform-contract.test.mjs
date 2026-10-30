import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePlatform,verifyNativeContract,contract,ipcEndpoint} from '../server/platform.mjs';
import {Runtime,requireObservation,appKey} from '../server/runtime.mjs';
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
test('app grants do not conflate executables on case-sensitive Mac volumes',()=>{
 const first={pid:123,started:'birth',path:'/Applications/Example.app/Contents/MacOS/Example'};
 const second={...first,path:'/Applications/example.app/Contents/MacOS/example'};
 assert.notEqual(appKey(first,'darwin'),appKey(second,'darwin'));
 assert.equal(appKey(first,'win32'),appKey(second,'win32'));
});
test('Mac IPC stays loopback-only even with installation paths beyond the Unix socket limit',()=>{
 assert.deepEqual(ipcEndpoint('/very-long-private-home/'.repeat(20),'test','darwin'),{host:'127.0.0.1',port:0});
 assert.equal(ipcEndpoint('D:/private','test','win32'),'\\\\.\\pipe\\agcu-test');
});
test('observation lifetime and one-use semantics are platform independent',()=>{
 const frames=new Map([['f',{hwnd:1,at:0}]]);
 assert.throws(()=>requireObservation(frames,'f',1,contract.frame_ms+1),e=>e.code==='stale_observation');
 assert.equal(frames.size,0);
});
test('a backwards wall-clock adjustment invalidates an observation',()=>{
 const frames=new Map([['future',{hwnd:1,at:1000}],['invalid',{hwnd:1,at:NaN}]]);
 assert.throws(()=>requireObservation(frames,'future',1,999),e=>e.code==='stale_observation');
 assert.throws(()=>requireObservation(frames,'invalid',1,999),e=>e.code==='stale_observation');assert.equal(frames.size,0);
});
test('monotonic frame age prevents a rewound clock from extending its lifetime',()=>{
 const frames=new Map([['expired',{hwnd:1,at:1000,atMono:100}],['bad',{hwnd:1,at:1000,atMono:NaN}],['future',{hwnd:1,at:1000,atMono:200}]]);
 assert.throws(()=>requireObservation(frames,'expired',1,1001,100+contract.frame_ms+1),e=>e.code==='stale_observation');
 assert.throws(()=>requireObservation(frames,'bad',1,1001,100),e=>e.code==='stale_observation');
 assert.throws(()=>requireObservation(frames,'future',1,1001,100),e=>e.code==='stale_observation');assert.equal(frames.size,0);
});
test('both adapters use the same batch failure boundary, with no later input',async()=>{
 for(const platform of ['win32','darwin']){
  const sent=[];const runtime={async action(op,args){sent.push(op);return {input_completed:true,verification_error:{code:'input_outcome_unknown'},metadata:{observation_id:'new'}};}};
  const reply=await call(runtime,'computer_run',{hwnd:1,observation_id:'f',reason:platform,steps:[{kind:'click',index:1},{kind:'key',keys:'enter'}]});
  assert.deepEqual(sent,['click']);assert.equal(reply.batch.skipped,1);
 }
});
