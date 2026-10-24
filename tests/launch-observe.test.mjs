import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Runtime} from '../server/runtime.mjs';
import {parseArguments} from '../scripts/arguments.mjs';import {TOOLS,validate} from '../server/desktop-tools.mjs';
import {spawnSync} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agcu-launch-'));
const app=path.join(dir,'OwnedTest.exe');fs.writeFileSync(app,'not executed: mock tests only');
process.on('exit',()=>{fs.unlinkSync(app);fs.rmdirSync(dir);});
function harness(windows){
 let launches=0,observations=0,attached=false;
 const r={state:'idle',generation:1,token:'',check(){if(this.state!=='active')throw Object.assign(Error('stopped'),{code:'control_inactive'});},stamp(){return {};},
 guardian:{send(message){assert.deepEqual(message,{op:'attach',pid:99});attached=true;},async start(){},async request(){return {allowed:true};},async prompt(){assert.equal(attached,true,'Register the worker before permission/dispatch');return {allowed:true,permit:'native-permit'};}},
 driver:{epoch:1,info:{pid:99},async start(){},async call(op,args){if(op==='launch'){assert.equal(args.__permit,'native-permit');assert.equal(args.__worker_epoch,1);launches++;return {result:{pid:123,path:app}};}assert.equal(op,'list_apps');return {result:{windows}};}},
 async observe(args){observations++;assert.equal(args.hwnd,8);return {metadata:{hwnd:8,observation_id:'fresh'},image:{data:'actual-mock-image'}};}};
 return {r,counts:()=>({launches,observations})};
}
test('launch --observe uses boolean schema and observes only exact PID and executable',async()=>{
 const schema=TOOLS.find(t=>t.name==='computer_launch').inputSchema;
 const args=parseArguments(schema,['--app',app,'--observe','--reason','Open owned app']);validate('computer_launch',args);assert.equal(args.observe,true);
 const {r,counts}=harness([{hwnd:7,pid:124,path:app,rect:[0,0,100,100]},{hwnd:9,pid:123,path:app+'other',rect:[0,0,100,100]},{hwnd:8,pid:123,path:app,rect:[0,0,100,100]}]);
 const result=await Runtime.prototype.launch.call(r,args);assert.equal(result.input_completed,true);assert.equal(result.metadata.observation_id,'fresh');assert.deepEqual(counts(),{launches:1,observations:1});
});
test('ambiguous post-launch windows return pending without guessing or relaunching',async()=>{
 const {r,counts}=harness([8,9].map(hwnd=>({hwnd,pid:123,path:app,rect:[0,0,100,100]})));
 const result=await Runtime.prototype.launch.call(r,{app,observe:true,reason:'test'});assert.equal(result.observe_pending,true);assert.equal(result.input_completed,true);assert.deepEqual(counts(),{launches:1,observations:0});
});
test('post-launch Stop and observation failure retain delivery evidence without replay',async()=>{
 for(const stopped of [true,false]){
  const {r,counts}=harness([{hwnd:8,pid:123,path:app,rect:[0,0,100,100]}]);
  if(stopped){const original=r.driver.call;r.driver.call=async(...args)=>{const reply=await original(...args);if(args[0]==='launch'){r.state='stopped';r.generation++;}return reply;};}
  else r.observe=async()=>{throw Object.assign(Error('capture unavailable'),{code:'window_capture_unavailable'});};
  const result=await Runtime.prototype.launch.call(r,{app,observe:true,reason:'test'});assert.equal(result.input_completed,true);assert.equal(result.verification_error.code,stopped?'control_inactive':'window_capture_unavailable');assert.equal(counts().launches,1);
 }
});
test('legacy launch remains a launch-only operation',async()=>{
 const {r,counts}=harness([]);const result=await Runtime.prototype.launch.call(r,{app,reason:'test'});assert.deepEqual(result,{pid:123,path:app});assert.deepEqual(counts(),{launches:1,observations:0});
});

test('an exited starter returns pending promptly without guessing a handoff or relaunching',async()=>{
 const exited=spawnSync(process.execPath,['-e',''],{windowsHide:true});assert.equal(exited.status,0);
 const {r,counts}=harness([]),original=r.driver.call;
 r.driver.call=async(op,args)=>{const reply=await original(op,args);if(op==='launch')reply.result.pid=exited.pid;return reply;};
 const started=Date.now(),result=await Runtime.prototype.launch.call(r,{app,observe:true,reason:'Owned exited starter'});
 assert.equal(result.launcher_exited,true);assert.equal(result.observe_pending,true);assert.equal(result.input_completed,true);assert(Date.now()-started<2000,'Do not wait out8seconds after definite starter exit');assert.deepEqual(counts(),{launches:1,observations:0});
});
