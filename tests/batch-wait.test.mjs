import test from 'node:test';
import assert from 'node:assert/strict';
import {call,TOOLS,validate} from '../server/desktop-tools.mjs';
import {Runtime} from '../server/runtime.mjs';
import {parseRunArguments} from '../scripts/arguments.mjs';
const args=steps=>({hwnd:7,observation_id:'initial',reason:'Verify once, never replay',steps});
const describe=kind=>({inputSchema:TOOLS.find(tool=>tool.name==='computer_'+kind).inputSchema});

test('a batch waits then uses the freshly verified frame for its next action',async()=>{
 const seen=[];
 const runtime={async action(op,a){seen.push({op,frame:a.observation_id});return{metadata:{observation_id:'after-click'}};},async wait(){seen.push({op:'wait'});return{matched:true,metadata:{observation_id:'verified'}};}};
 const plan=parseRunArguments(describe('run').inputSchema,['--hwnd','7','--observation-id','initial','--reason','Observe processing','--step','click','--name','Start','--step','wait','--until','Ready','--timeout-ms','30000','--step','click','--name','Details'],describe);
 const result=await call(runtime,'computer_run',plan);
 assert.deepEqual(seen,[{op:'click',frame:'initial'},{op:'wait'},{op:'click',frame:'verified'}]);
 assert.equal(result.batch.completed.length,3);
});

test('an unmet wait retains completed actions and never sends following input',async()=>{
 let inputs=0;
 const runtime={async action(){inputs++;return{metadata:{observation_id:'after'}};},async wait(){return{matched:false,timed_out:true,metadata:{observation_id:'inspect-this'}};}};
 const result=await call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:'Ready'},{kind:'click',name:'Publish'}]));
 assert.equal(inputs,1);assert.equal(result.ok,false);assert.equal(result.verification_error.code,'wait_condition_timeout');
 assert.equal(result.batch.completed.length,1);assert.equal(result.batch.failed_index,1);assert.equal(result.batch.skipped,1);assert.equal(result.metadata.observation_id,'inspect-this');
});

test('Stop during a wait prevents later actions, and invalid wait budgets refuse before input',async()=>{
 let inputs=0;
 const runtime={async action(){inputs++;return{};},async wait(){throw Object.assign(Error('Human stopped'),{code:'control_inactive'});}};
 const stopped=await call(runtime,'computer_run',args([{kind:'wait',until:'Ready'},{kind:'click',name:'Publish'}]));
 assert.equal(inputs,0);assert.equal(stopped.error.code,'control_inactive');assert.equal(stopped.skipped,1);
 await assert.rejects(call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:'Ready',timeout_ms:20000},{kind:'wait',until:'Saved',timeout_ms:20000}])),/Combined batch waits/);
 assert.equal(inputs,0);
 await assert.rejects(call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:' '}])));assert.equal(inputs,0);
});

test('known failure wins over success, returns a fresh frame and prevents subsequent batch input',async()=>{
 let inputs=0,observations=0;
 const runtime={frames:new Map(),check(){},async action(){inputs++;return{metadata:{observation_id:'after'}};},
  async observe(){const id='frame'+(++observations);this.frames.set(id,{});return{metadata:{observation_id:id,tree:'Completed — Failed'}};}};
 runtime.wait=Runtime.prototype.wait.bind(runtime);
 const result=await call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:'Completed',abort_on:['Failed','Cancelled']},{kind:'click',name:'Publish'}]));
 assert.equal(inputs,1);assert.equal(result.aborted,true);assert.equal(result.abort_match,'Failed');assert.equal(result.matched,false);
 assert.equal(result.verification_error.code,'wait_failure_observed');assert.equal(result.batch.skipped,1);assert.equal(result.metadata.observation_id,'frame2');assert(!runtime.frames.has('frame1'));
});

test('wait abort labels are bounded and success remains compatible',async()=>{
 const schema=describe('wait').inputSchema;
 const plan=parseRunArguments(describe('run').inputSchema,['--hwnd','7','--observation-id','initial','--reason','Wait safely','--step','wait','--until','Ready','--abort-on','["Failed","Cancelled"]'],describe);
 assert.deepEqual(plan.steps[0].abort_on,['Failed','Cancelled']);
 for(const abort_on of [[],[''],Array(9).fill('Failed')])assert.throws(()=>validate('computer_wait',{hwnd:7,until:'Ready',reason:'test',abort_on}));
 assert(schema.properties.abort_on);
 let count=0;const runtime={frames:new Map(),check(){},async observe(){const id='s'+(++count);this.frames.set(id,{});return{metadata:{observation_id:id,tree:'Ready'}};}};
 const result=await Runtime.prototype.wait.call(runtime,{hwnd:7,until:'ready',abort_on:['Failed']});
 assert.equal(result.matched,true);assert.equal(result.metadata.observation_id,'s2');assert(!runtime.frames.has('s1'));
});
