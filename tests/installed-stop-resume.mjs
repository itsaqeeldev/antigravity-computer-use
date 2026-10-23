// Interactive Windows qualification against the EXACT installed release.
// The caller supplies coordinates from a freshly inspected real app screenshot.
// Never approves a dialog, changes takeover mode, or clears an emergency latch.
// After the automatic hotkey check, only the human can complete the re-arm/Esc
// sequence. No app input is sent while waiting for that physical interaction.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

assert.equal(process.platform,'win32','This qualification exercises the installed Windows native helper');
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert(Number.isSafeInteger(config.hwnd)&&config.hwnd>0,'A current HWND is required');
assert(config.from?.length===2&&config.to?.length===2,'Observed screenshot coordinates are required');
const install=JSON.parse(fs.readFileSync(config.installation||'D:/Tools/AntigravityComputerUse/installation.json','utf8'));
assert.equal(install.integration,'direct');
const release=install.release;
const policy=JSON.parse(fs.readFileSync(path.join(release,'desktop-policy.json'),'utf8'));
assert.equal(policy.permission_mode,'host-managed','This automated qualification requires an operator-selected host-managed install; it never bypasses standalone approvals');
const directory=policy.data_dir;
const manifest=JSON.parse(fs.readFileSync(path.join(release,'bundle-manifest.json'),'utf8'));
const {request}=await import(pathToFileURL(path.join(release,'scripts/desktop.mjs')));
const evidence=path.resolve(config.evidence);
fs.mkdirSync(evidence,{recursive:true});
const record={passed:false,stage:'preparing',version:manifest.version,build_id:manifest.build_id,checks:[],events:[]};
const save=()=>fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(record,null,2));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let sequence=0,lastState;

function cli(command){
  const p=spawnSync(path.join(release,'node.exe'),[path.join(release,'scripts/desktop.mjs'),command],{windowsHide:true,encoding:'utf8',timeout:20000});
  assert.equal(p.status,0,p.stdout+p.stderr);return JSON.parse(p.stdout);
}
async function call(command,args={}){
  const session=JSON.parse(fs.readFileSync(path.join(directory,'desktop-session.json'),'utf8'));
  const result=await request(session,command,args);
  if(command!=='status')fs.writeFileSync(path.join(evidence,`${String(++sequence).padStart(2,'0')}-${command}.json`),JSON.stringify({command,args,result},null,2));
  else if(result.state!==lastState){lastState=result.state;record.events.push({state:result.state,reason:result.control_reason,at:new Date().toISOString()});save();}
  return result;
}
async function until(check,timeout=600000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const result=await check();if(result)return result;await sleep(150);}
  throw Error('Human/native checkpoint timed out; no re-arm was fabricated.');
}
async function snapshot(){
  const result=await call('snapshot',{hwnd:config.hwnd,reason:'Observe the real app for native stop/resume qualification'});
  assert(result.ok,result.error?.message);assert(result.image?.path,'Actual image delivery required');return result;
}
function held(file){try{return fs.readFileSync(file,'utf8').trim();}catch{return '';}}
const stopFile=path.join(directory,'emergency.stop');
try{
  const status=await call('status');assert.equal(status.build_id,manifest.build_id);assert.notEqual(status.state,'stopped','Existing Stop must be re-armed by the human before beginning');
  let image=await snapshot();
  for(const point of [config.from,config.to])assert(point.every(Number.isInteger)&&point[0]>=0&&point[1]>=0&&point[0]<image.image.width&&point[1]<image.image.height);
  // Prepare at the drag start so the approach cannot outlast the input test.
  const moved=await call('move',{hwnd:config.hwnd,observation_id:image.metadata.observation_id,x:config.from[0],y:config.from[1],risk:'routine',reason:'Prepare a harmless drag in the real test app'});
  assert(moved.ok&&moved.metadata,moved.error?.message);
  const session=JSON.parse(fs.readFileSync(path.join(directory,'desktop-session.json'),'utf8'));
  const guard=fs.readdirSync(directory).find(name=>name.startsWith(`guard-${session.pid}-`)&&name.endsWith('.state'));
  assert(guard,'The installed service must own its native input fence');
  const journal=path.join(directory,guard+'.inputs');
  const compiler=path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  const probe=path.join(evidence,'StopProbe.exe');
  const build=spawnSync(compiler,['-nologo','-out:'+probe,path.resolve('tests/StopProbe.cs')],{windowsHide:true,encoding:'utf8'});
  assert.equal(build.status,0,build.stdout+build.stderr);
  // Pay antivirus/.NET startup costs before holding a button, without sending
  // the hotkey during warmup. This helper can only stop, never approve/re-arm.
  assert.equal(spawnSync(probe,['--warmup'],{windowsHide:true,timeout:30000}).status,0);
  const steps=Array.from({length:8},()=>({kind:'drag',from:config.from,to:config.to,steps:120,risk:'routine'}));
  record.stage='native_hotkey_during_drag';save();
  let settled;
  const pending=call('run',{hwnd:config.hwnd,observation_id:moved.metadata.observation_id,steps,reason:'Verify emergency Stop cancels a held drag and skips queued actions in this real app'})
    .then(result=>{settled=result;return result;},error=>{settled={ok:false,error:{message:error.message}};return settled;});
  await until(()=>{if(settled)throw Error('The drag ended before a held button was observed: '+JSON.stringify(settled));return held(journal).includes('m:4');},5000);
  record.held_before_stop=held(journal);
  const stop=spawnSync(probe,[],{windowsHide:true,timeout:5000});assert.equal(stop.status,0);
  const batch=await pending;
  const stopped=await until(async()=>{const value=await call('status');return value.state==='stopped'&&value;},10000);
  assert.equal(stopped.control_reason,'hotkey');assert(fs.existsSync(stopFile));
  const batchSummary=batch.batch||batch;
  assert.equal(batchSummary.failed_index,0,JSON.stringify(batch));assert.equal(batchSummary.completed.length,0);assert.equal(batchSummary.skipped,7);
  await until(()=>!held(journal),5000);
  record.checks.push('Native registered hotkey stopped a held real-app drag, released the owned button and skipped all seven later actions');
  assert.equal((await call('resume')).ok,false);
  assert.equal((await call('snapshot',{hwnd:config.hwnd})).ok,false);
  assert.equal((await call('end')).state,'stopped');
  cli('shutdown');const restarted=cli('start');assert.equal(restarted.state,'stopped');assert(fs.existsSync(stopFile));
  record.checks.push('Resume, observe, end and service replacement cannot bypass persistent emergency Stop');
  record.stage='awaiting_first_local_rearm';save();
  console.log('LOCAL HUMAN REQUIRED: click triangle Re-arm. Wait for the blue custom glow and working bar, press physical Esc, then click triangle Re-arm once more. No automated re-arm is possible.');
  await until(async()=>{const s=await call('status');return s.state==='idle'&&!fs.existsSync(stopFile);});
  record.checks.push('First local human re-arm observed');
  record.stage='awaiting_physical_escape';save();
  const firstImage=await call('snapshot',{hwnd:config.hwnd,reason:'Re-arm the real app for the physical Esc test; no further input'});
  if(!firstImage.ok){
    const s=await call('status');assert(s.state==='stopped'&&s.control_reason==='escape',JSON.stringify(firstImage));
    record.first_observation_interrupted_by_physical_escape=true;
  }
  await until(async()=>{const s=await call('status');return s.state==='stopped'&&s.control_reason==='escape';});
  assert(fs.existsSync(stopFile));assert.equal((await call('resume')).ok,false);
  record.checks.push('Physical Esc stopped the native session and left the emergency latch armed');
  record.stage='awaiting_second_local_rearm';save();
  await until(async()=>{const s=await call('status');return s.state==='idle'&&!fs.existsSync(stopFile);});
  image=await snapshot();assert(image.image.path);record.checks.push('Second local re-arm allowed a fresh usable observation without restarting Antigravity');
  const closed=await call('close_window',{hwnd:config.hwnd,reason:'Close only the owned, idle qualification app'});assert(closed.ok,closed.error?.message);
  assert.equal((await call('end')).state,'idle');const final=await call('status');assert.equal(final.approved_apps.length,0);assert.equal(final.custom_cursor,false);
  record.final_status=final;record.stage='complete';record.passed=true;save();console.log('PASS: installed native hotkey, queued cancellation, held-input cleanup, persistent Stop, physical Esc and human re-arm.');
}catch(error){
  record.error=error.stack;record.stage='failed';save();
  // Preserve a stopped session for the human. Normal finish is allowed only if
  // the test was still active, and never deletes the emergency latch.
  try{if((await call('status')).state==='active')await call('end');}catch{}
  throw error;
}
