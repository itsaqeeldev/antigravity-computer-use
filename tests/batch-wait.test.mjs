import test from 'node:test';
import assert from 'node:assert/strict';
import {call,TOOLS,validate} from '../server/desktop-tools.mjs';
import {Runtime,appKey,comparableView} from '../server/runtime.mjs';
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

test('batch waits skip intermediate images and reject unseen pixel targets before input',async()=>{
 let inputs=0;const imageFlags=[];
 const runtime={async action(){inputs++;return{metadata:{observation_id:'next'}};},async wait(a){imageFlags.push(a.with_image);return{matched:true,metadata:{observation_id:'wait-frame'}};}};
 await call(runtime,'computer_run',args([{kind:'wait',until:'Ready'},{kind:'click',name:'Details'}]));
 await call(runtime,'computer_run',args([{kind:'wait',until:'Ready'}]));
 await call(runtime,'computer_run',args([{kind:'wait',until:'Ready',with_image:true},{kind:'click',name:'Details'}]));
 assert.deepEqual(imageFlags,[false,true,true]);
 const before=inputs;
 await assert.rejects(call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:'Ready',with_image:true},{kind:'click',x:2,y:3}])),/unseen batch observation/);
 assert.equal(inputs,before,'invalid batch must refuse before any input');
 await assert.rejects(call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait_change'},{kind:'click',x:2,y:3}])),/unseen batch observation/);
 assert.equal(inputs,before,'text-only change wait cannot feed a pixel action');
 const parsed=parseRunArguments(describe('run').inputSchema,['--hwnd','7','--observation-id','initial','--reason','Wait','--step','wait','--until','Ready','--image','--step','click','--x','2','--y','3'],describe);
 assert.equal(parsed.steps[0].with_image,true);
});

test('a text-only wait confirms the final tree without capturing a screenshot',async()=>{
 const flags=[],frames=new Map();let count=0;
 const runtime={frames,check(){},async observe(a){flags.push(a.with_image);const id='s'+(++count);frames.set(id,{});return{metadata:{observation_id:id,tree:'Ready'}};}};
 const result=await Runtime.prototype.wait.call(runtime,{hwnd:7,until:'Ready',with_image:false});
 assert.equal(result.matched,true);assert.deepEqual(flags,[false,false]);assert(!frames.has('s1'));assert(frames.has('s2'));
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

test('wait rechecks the returned frame and aborts a batch if failure replaces a transient success',async()=>{
 let input=0,reads=0;const frames=new Map();
 const runtime={frames,check(){},async action(){input++;return{metadata:{observation_id:'post-action'}};},
  async observe(){const id='v'+(++reads);frames.set(id,{});return{metadata:{observation_id:id,tree:reads===1?'Ready':'Failed'}};}};
 runtime.wait=Runtime.prototype.wait.bind(runtime);
 const result=await call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:'Ready',abort_on:['Failed']},{kind:'click',name:'Publish'}]));
 assert.equal(input,1);assert.equal(result.aborted,true);assert.equal(result.abort_match,'Failed');assert.equal(result.verification_error.code,'wait_failure_observed');assert.equal(result.batch.skipped,1);assert.equal(result.metadata.observation_id,'v2');assert(!frames.has('v1'));
});

test('wait does not treat a vanished success label as confirmation',async()=>{
 let reads=0;const frames=new Map();
 const runtime={frames,check(){},async observe(){const id='v'+(++reads);frames.set(id,{});return{metadata:{observation_id:id,tree:reads===1?'Ready':'Loading'}};}};
 const result=await Runtime.prototype.wait.call(runtime,{hwnd:7,until:'Ready',timeout_ms:100});
 assert.equal(result.matched,false);assert.equal(result.timed_out,true);assert.equal(result.metadata.tree,'Loading');
});

test('wait reports a known failure first appearing in its final timeout observation',async()=>{
 let reads=0;const frames=new Map();
 const runtime={frames,check(){},async observe(){const id='v'+(++reads);frames.set(id,{});if(reads===1)await new Promise(r=>setTimeout(r,120));return{metadata:{observation_id:id,tree:reads===1?'Loading':'Failed'}};}};
 const result=await Runtime.prototype.wait.call(runtime,{hwnd:7,until:'Ready',abort_on:['Failed'],timeout_ms:100});
 assert.equal(result.matched,false);assert.equal(result.aborted,true);assert.equal(result.abort_match,'Failed');assert.equal(result.metadata.observation_id,'v2');assert(!frames.has('v1'));
});

test('wait_change compares the original view and returns a fresh usable observation',async()=>{
 const app={hwnd:7,pid:9,started:'one',path:'example.exe'};const key=appKey(app);
 const frames=new Map([['initial',{at:Date.now(),hwnd:7,key,workerEpoch:1,viewTree:'"App" hwnd=7\nLoading',viewQuery:'Status',viewMaxNodes:250}]]);let observed;
 const runtime={frames,generation:1,driver:{epoch:1},check(){},async grant(){return app;},async observe(a){observed=a;frames.set('fresh',{key,workerEpoch:1});return{metadata:{observation_id:'fresh',tree:'new-snapshot "App" hwnd=7\nComplete'}};}};
 const result=await Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:'initial',reason:'Inspect view'});
 assert.equal(result.changed,true);assert.equal(result.metadata.observation_id,'fresh');assert(!frames.has('initial'));assert(frames.has('fresh'));
 assert.equal(observed.query,'Status');assert.equal(observed.max_nodes,250);assert.equal(observed.with_image,false);
 const dispatched=await call({async waitChange(a){return {received:a.observation_id};}},'computer_wait_change',{hwnd:7,observation_id:'fresh',reason:'Observe'});
 assert.equal(dispatched.received,'fresh');
 assert.throws(()=>validate('computer_wait_change',{hwnd:7,reason:'No frame'}));
});

test('wait_change refuses stale frames and stops on identity or control changes',async()=>{
 const app={hwnd:7,pid:9,started:'one',path:'example.exe'},key=appKey(app);
 const runtime={frames:new Map(),generation:1,driver:{epoch:1},check(){},async grant(){return app;},async observe(){this.frames.set('fresh',{key:'different',workerEpoch:1});return{metadata:{observation_id:'fresh',tree:'new-snapshot "App" hwnd=7\nChanged'}};}};
 await assert.rejects(Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:'missing'}),e=>e.code==='stale_observation');
 runtime.frames.set('initial',{at:Date.now(),hwnd:7,key,workerEpoch:1,viewTree:'Loading'});
 await assert.rejects(Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:'initial'}),e=>e.code==='identity_changed');assert(!runtime.frames.has('fresh'));
 runtime.frames.set('initial',{at:Date.now(),hwnd:7,key,workerEpoch:1,viewTree:'Loading'});
 runtime.observe=async()=>{runtime.generation++;return{metadata:{observation_id:'new',tree:'Changed'}};};
 await assert.rejects(Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:'initial'}),e=>e.code==='control_changed');
});

test('wait_change times out with a fresh frame without sending input or retaining polling frames',async()=>{
 const app={hwnd:7,pid:9,started:'one',path:'example.exe'},key=appKey(app),frames=new Map();let reads=0;
 frames.set('initial',{at:Date.now(),hwnd:7,key,workerEpoch:1,viewTree:'"App" hwnd=7\nLoading'});
 const runtime={frames,generation:1,driver:{epoch:1},check(){},async grant(){return app;},async observe(){const id='poll'+(++reads);frames.set(id,{key,workerEpoch:1});return{metadata:{observation_id:id,tree:id+' "App" hwnd=7\nLoading'}};}};
 const result=await Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:'initial',timeout_ms:100,reason:'Wait for a view'});
 assert.equal(result.changed,false);assert.equal(result.timed_out,true);assert(frames.has(result.metadata.observation_id));assert.equal(frames.size,1);
});

test('real rendered snapshots do not count new snapshot IDs or element indexes as view changes',async()=>{
 const app={hwnd:7,pid:9,started:'one',path:'example.exe'},frames=new Map();let capture=0,label='Loading';
 const runtime={frames,generation:1,driver:{epoch:1,async call(op){assert.equal(op,'snapshot');const index=++capture;return{result:{snapshot_id:'s'+index,title:'App',hwnd:7,nodes:[{i:index,role:'Text',name:label,depth:0}]}};}},
  guardian:{send(){}},check(){},stamp(){return{};},async grant(){return app;}};
 runtime.observe=Runtime.prototype.observe.bind(runtime);
 const first=await runtime.observe({hwnd:7,with_image:false});
 const unchanged=await Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:first.metadata.observation_id,timeout_ms:100,reason:'Wait'});
 assert.equal(unchanged.changed,false);assert.equal(unchanged.timed_out,true);assert(capture>=2);
 const next=await runtime.observe({hwnd:7,with_image:false});label='Complete';
 const changed=await Runtime.prototype.waitChange.call(runtime,{hwnd:7,observation_id:next.metadata.observation_id,timeout_ms:100,reason:'Wait'});
 assert.equal(changed.changed,true);assert.match(changed.metadata.tree,/Complete/);
});

test('change comparison preserves user text and focus details while ignoring transport indexes',()=>{
 const first='s1 "App" hwnd=7 | focus [2] Edit "Name"\n[2] Edit "Order [12]" = "One"';
 const same='s2 "App" hwnd=7 | focus [99] Edit "Name"\n[99] Edit "Order [12]" = "One"';
 assert.equal(comparableView(first),comparableView(same));
 assert.notEqual(comparableView(first),comparableView(same.replace('Order [12]','Order [13]')));
 assert.notEqual(comparableView(first),comparableView(same.replace('Edit "Name"','Edit "Other"')));
});

test('batched wait_change passes the fresh frame forward and stops after timeout',async()=>{
 const seen=[];let changed=true;
 const runtime={async action(op,a){seen.push({op,frame:a.observation_id});return{metadata:{observation_id:'after-click'}};},
  async waitChange(a){seen.push({op:'wait_change',frame:a.observation_id});return{changed,timed_out:!changed,metadata:{observation_id:'after-change'}};}};
 const plan=args([{kind:'click',name:'Start'},{kind:'wait_change',timeout_ms:5000},{kind:'click',name:'Details'}]);
 const result=await call(runtime,'computer_run',plan);
 assert.deepEqual(seen,[{op:'click',frame:'initial'},{op:'wait_change',frame:'after-click'},{op:'click',frame:'after-change'}]);assert.equal(result.batch.completed.length,3);
 seen.length=0;changed=false;const timeout=await call(runtime,'computer_run',plan);
 assert.equal(seen.length,2);assert.equal(timeout.ok,false);assert.equal(timeout.verification_error.code,'wait_change_timeout');assert.equal(timeout.batch.skipped,1);assert.equal(timeout.metadata.observation_id,'after-change');
 seen.length=0;await assert.rejects(call(runtime,'computer_run',args([{kind:'click',name:'Start'},{kind:'wait',until:'Ready',timeout_ms:20000},{kind:'wait_change',timeout_ms:20000}])),/Combined batch waits/);assert.equal(seen.length,0);
});
