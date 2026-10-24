import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {Runtime,savedTakeoverMode,appKey,queryNodes} from '../server/runtime.mjs';
import {Driver} from '../server/driver.mjs';
import {EventEmitter} from 'node:events';import fs from 'node:fs';
import path from 'node:path';import {dataDir} from '../server/build.mjs';

test('unconfirmed held-input recovery requests Stop and returns an actionable failure',async()=>{
 for(const recovery of [async()=>false,async()=>{throw Error('helper missing');}]){
  const events=[];const driver={epoch:1,proc:null,pending:new Map(),inputMayBeHeld:true,info:null,ready:null,
   _failAll(){},releaseHeldInputs:recovery,onEvent:event=>events.push(event),onLog(){}};
  await assert.rejects(Driver.prototype._abort.call(driver),e=>e.code==='input_cleanup_failed');
  assert.deepEqual(events,[{event:'input_cleanup_failed'}]);assert.equal(driver.epoch,2);
 }
});

test('failed file-picker keyboard input requests held-input cleanup before rejecting',async()=>{
 let recoveries=0;
 const driver={seq:0,epoch:1,pending:new Map(),timeoutMs:1000,inputMayBeHeld:false,async start(){},onLog(){},
  async abort(){assert.equal(this.inputMayBeHeld,true);recoveries++;this.inputMayBeHeld=false;},
  proc:{stdin:{write(payload){const request=JSON.parse(payload);Driver.prototype._onLine.call(driver,JSON.stringify({id:request.id,ok:false,error:{code:'input_rejected',message:'Partial file dialog key delivery'}}));}}}};
 await assert.rejects(Driver.prototype.call.call(driver,'file_dialog',{}),error=>error.code==='input_rejected');
 assert.equal(recoveries,1);assert.equal(driver.pending.size,0);
});

test('window-free clipboard action registers its restarted worker and binds its epoch before approval',async()=>{
 const events=[];const r={generation:1,deadline:Date.now()+10000,remaining:10,check(){},stamp(){return {};},
  guardian:{send(message){events.push(message);},async prompt(){assert.deepEqual(events,[{op:'attach',pid:42}]);return {allowed:true,permit:'one-use'};}},
  sessions:{async withInput(_op,_target,run){return run();}},
  driver:{epoch:2,info:{pid:42},async start(){},async call(op,args){if(op==='authorize')return {result:{sensitive:true}};assert.equal(op,'clipboard');assert.equal(args.__worker_epoch,2);return {result:{has_text:false}};}}};
 const result=await Runtime.prototype.action.call(r,'clipboard',{reason:'Explicit clipboard read'});assert.equal(result.input_completed,true);
});
test('status fallback reads the same persisted takeover preference as the native UI',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'mode-'));const file=path.join(dir,'control-preferences.json');
 try {
  assert.equal(savedTakeoverMode(file,'manual'),'manual');
  for(const mode of ['manual','smart']){fs.writeFileSync(file,JSON.stringify({takeover_mode:mode}));assert.equal(savedTakeoverMode(file,'manual'),mode);}
  fs.writeFileSync(file,'\uFEFF'+JSON.stringify({takeover_mode:'smart'}));assert.equal(savedTakeoverMode(file,'manual'),'smart');
  for(const invalid of ['{broken',JSON.stringify({takeover_mode:'unknown'})]){fs.writeFileSync(file,invalid);assert.equal(savedTakeoverMode(file,'manual'),'manual');}
 }finally{fs.unlinkSync(file);fs.rmdirSync(dir);}
});
test('duplicate stop event preserves the emergency stop reason; resume starts fresh observations',()=>{
 const guardian=new EventEmitter();const r=new Runtime({guardian,driver:{abort:async()=>{}},sessions:{register(){}}});
 try {
  guardian.emit('state','active');r.frames.set('old',{});r.grants.set('app',{});r.token='old';
  guardian.emit('state','stopped','escape');guardian.emit('state','stopped');
  assert.equal(r.status().control_reason,'escape');assert.equal(r.frames.size,0);assert.equal(r.grants.size,0);assert.equal(r.token,'');
  guardian.emit('state','active');r.frames.set('pre-resume',{});r.deadline=0;guardian.emit('resume','active');
  assert.equal(r.frames.size,0);assert(r.deadline>Date.now());assert.equal(r.status().control_reason,'human_resume');
 }finally{fs.unlinkSync(r.guardFile);}
});

test('queries search a bounded larger hierarchy before compacting results',async()=>{
 let requested;const r={async grant(){return {pid:1,started:'one',path:'app.exe'};},check(){},guardian:{send(){}},stamp(){return {};},frames:new Map(),driver:{async call(op,args){assert.equal(op,'snapshot');requested=args.max_nodes;return {result:{snapshot_id:'s',nodes:[{i:1,name:'Toolbar',role:'Button'},{i:300,name:'Export PNG',role:'Button'}]}};}}};
 const result=await Runtime.prototype.observe.call(r,{hwnd:1,query:'PNG',with_image:false});
 assert.equal(requested,500);assert.match(result.metadata.tree,/Export PNG/);assert(!result.metadata.tree.includes('Toolbar'));
});

test('a section query includes its real child controls without unrelated siblings or invented labels',()=>{
 const nodes=[{i:0,depth:0,role:'Window',name:'App'},{i:1,depth:1,role:'Group',name:'Export format'},{i:2,depth:2,role:'Button',name:'PNG'},{i:3,depth:2,role:'Button',name:'JPEG',offscreen:true},{i:4,depth:1,role:'Group',name:'Security'},{i:5,depth:2,role:'Button',name:'Delete'}];
 const selected=queryNodes(nodes,'FORMAT');assert.deepEqual(selected.map(n=>n.i),[1,2,3]);assert.equal(selected[2],nodes[3]);assert.equal(selected[2].offscreen,true);assert.deepEqual(queryNodes(nodes,'JPEG').map(n=>n.i),[3]);
 assert.deepEqual(queryNodes([{i:1,role:'Slider',value:0},{i:2,name:'Other'}],'0').map(n=>n.i),[1]);
 assert.deepEqual(queryNodes(nodes,'missing'),[]);
});

test('explicit window fitting invalidates old frames and refuses a different virtual desktop before input',async()=>{
 const window={hwnd:1,pid:5,started:'one',path:'app.exe'};let delivered=0,observed=0;
 const r={frames:new Map([['old',{}]]),deadline:Date.now()+10000,remaining:10,generation:1,async grant(){return window;},check(){},stamp(){return {};},async app(){return window;},guardian:{send(){}},driver:{epoch:1,info:{pid:10},async start(){},async call(op){if(op==='authorize')return{result:{sensitive:false}};assert.equal(op,'fit_window');delivered++;return{result:{fully_visible:true}};}},sessions:{async withInput(_op,_meta,fn){return fn();}},async observe(){assert(!r.frames.has('old'));observed++;return{metadata:{observation_id:'fresh'}};}};
 const result=await Runtime.prototype.action.call(r,'fit_window',{hwnd:1,risk:'routine',reason:'Fit approved app'});assert.equal(delivered,1);assert.equal(observed,1);assert.equal(result.metadata.observation_id,'fresh');
 window.other_desktop=true;await assert.rejects(Runtime.prototype.action.call(r,'fit_window',{hwnd:1,risk:'routine',reason:'Must refuse'}),e=>e.code==='other_desktop');assert.equal(delivered,1);
});

test('an older helper cannot return covering-window pixels to the agent',async()=>{
 const r={generation:1,frames:new Map(),async grant(){return {pid:1,started:'one',path:'app.exe',rect:[0,0,100,100]};},check(){},guardian:{send(){},async request(){}},stamp(){return {};},driver:{epoch:1,async call(op){return op==='snapshot'?{result:{snapshot_id:'s',nodes:[]}}:{result:{capture:'screen_occluded',data:'private-cover-pixels'}};}}};
 await assert.rejects(Runtime.prototype.observe.call(r,{hwnd:1}),error=>error.code==='window_capture_unavailable');assert.equal(r.frames.size,0);
});
test('wait observes completion without repeating input',async()=>{
 let n=0;const r={check(){},frames:new Map(),async observe(){n++;return {metadata:{observation_id:String(n),tree:n===1?'Completed':'Completed'},image:{data:'screenshot'}};}};
 const result=await Runtime.prototype.wait.call(r,{hwnd:1,until:'Completed',timeout_ms:100});assert(result.matched);assert(result.image.data);assert.equal(n,2);
});
test('wait refuses work while paused instead of rearming control',async()=>{
 const r={check(){throw Object.assign(Error('paused'),{code:'control_inactive'});}};
 await assert.rejects(Runtime.prototype.wait.call(r,{hwnd:1,until:'Completed'}),e=>e.code==='control_inactive');
});

test('pause/resume during a pending observation cannot recreate an old frame',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);
 const r={generation:1,frames:new Map(),async grant(){return {pid:1,started:'one',path:'app.exe'};},check(){},guardian:{send(){}},stamp(){return {};},driver:{async call(){await pending;return {result:{snapshot_id:'old',nodes:[]}};}}};
 const observing=Runtime.prototype.observe.call(r,{hwnd:1,with_image:false});
 await new Promise(resolve=>setImmediate(resolve));r.generation++;release();
 await assert.rejects(observing,e=>e.code==='control_changed');assert.equal(r.frames.size,0);
});

test('worker restart during capture invalidates that observation even while control stays active',async()=>{
 const driver={epoch:1,async call(){this.epoch++;return {result:{snapshot_id:'s1',nodes:[]}};}};
 const r={generation:1,frames:new Map(),async grant(){return {pid:1,started:'one',path:'app.exe'};},check(){},guardian:{send(){}},stamp(){return {};},driver};
 await assert.rejects(Runtime.prototype.observe.call(r,{hwnd:1,with_image:false}),e=>e.code==='control_changed');assert.equal(r.frames.size,0);
});

test('last-moment worker restart refuses input before writing a command',async()=>{
 const driver={epoch:1,async start(){this.epoch=2;}};
 await assert.rejects(Driver.prototype.call.call(driver,'click',{__worker_epoch:1}),e=>e.code==='stale_observation');
});

test('post-click screenshot failure preserves delivery evidence instead of inviting replay',async()=>{
 const w={hwnd:1,pid:2,started:'one',path:'test.exe'};let clicks=0;
 const r={generation:1,deadline:Date.now()+10000,remaining:10,frames:new Map([['fresh',{at:Date.now(),hwnd:1,key:appKey(w),snapshot:'s1',workerEpoch:1}]]),
  async grant(){return w;},async app(){return w;},check(){},stamp(){return {};},guardian:{send(){}},sessions:{async withInput(_op,_target,run){return run();}},
  driver:{epoch:1,async call(op){if(op==='authorize')return {result:{sensitive:false}};assert.equal(op,'click');clicks++;return {result:{clicked:true}};}},
  async observe(){throw Object.assign(Error('App is transitioning'),{code:'op_timeout'});}};
 const result=await Runtime.prototype.action.call(r,'click',{hwnd:1,observation_id:'fresh',index:3,risk:'routine'});
 assert.equal(clicks,1);assert.equal(result.input_completed,true);assert.equal(result.result.clicked,true);assert.equal(result.verification_error.code,'op_timeout');
});

test('Stop invalidates an action waiting for the shared input lease before it can send input',async()=>{
 let release,entered;const waiting=new Promise(resolve=>release=resolve),inLease=new Promise(resolve=>entered=resolve);let delivered=0;
 const guardian=new EventEmitter();guardian.send=()=>{};
 const driver={epoch:1,async abort(){},async call(op){if(op==='authorize')return {result:{sensitive:false}};delivered++;return {result:{clicked:true}};}};
 const r=new Runtime({guardian,driver,sessions:{register(){},async withInput(_op,_target,run){entered();await waiting;return run();}}});
 const w={hwnd:1,pid:2,started:'one',path:'test.exe'};
 r.state='active';r.token='fixture';r.deadline=Date.now()+10000;r.app=r.grant=async()=>w;
 r.frames.set('fresh',{at:Date.now(),hwnd:1,key:appKey(w),snapshot:'s1',workerEpoch:1});
 try{
  const action=r.action('click',{hwnd:1,observation_id:'fresh',index:3,risk:'routine',reason:'Fixture only'});
  await inLease;await r.stop();release();
  await assert.rejects(action,error=>error.code==='control_inactive');assert.equal(delivered,0);assert.equal(r.state,'stopped');
 }finally{release();fs.unlinkSync(r.guardFile);}
});
