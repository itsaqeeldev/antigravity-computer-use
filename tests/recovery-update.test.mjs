import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {PassThrough} from 'node:stream';import {EventEmitter} from 'node:events';import {generateKeyPairSync,sign} from 'node:crypto';
import {Guardian} from '../server/guardian.mjs';import {Runtime} from '../server/runtime.mjs';import {Incidents} from '../server/incidents.mjs';import {verifyRelease,verifyStaged,sha256,acquireUpdateLock,downloadFile} from '../server/update-core.mjs';import {testDirectory} from './paths.mjs';import {controllerStartSource} from '../scripts/install.mjs';
import {failureReply} from '../scripts/desktop.mjs';import {readBoundedJSON} from '../server/update-core.mjs';
import {spawn} from 'node:child_process';
import {serveDesktop} from '../server/desktop-service.mjs';import {BUILD_ID,VERSION} from '../server/version.mjs';
test('concurrent guardian requests wait for one ready process',async()=>{
 let starts=0,child;const spawnProcess=()=>{starts++;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',1);return child;};
 const g=new Guardian({}, {spawnProcess,host:()=>({exe:'fixture'}),bootTimeout:500});const a=g.start(),b=g.start();assert.equal(starts,1);child.stdout.write('{"ev":"ready","pid":123}\n');await Promise.all([a,b]);assert(g.initialized);child.emit('close',2);assert.equal(g.proc,null);assert.equal(g.state,'stopped');
});
test('early guardian exit rejects startup promptly and permits one explicit retry',async()=>{
 let child;const spawnProcess=()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',1);return child;};
 const g=new Guardian({}, {spawnProcess,host:()=>({exe:'fixture'}),bootTimeout:500});const first=g.start();child.emit('close',3);await assert.rejects(first,e=>e.code==='guardian_exited');const next=g.start();child.stdout.write('{"ev":"ready","pid":123}\n');await next;child.emit('close',0);
});
test('guardian readiness timeout terminates the failed helper and clears startup state',async()=>{
 let killed=0;const spawnProcess=()=>{const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{killed++;child.emit('close',null,'SIGTERM');};return child;};
 const g=new Guardian({}, {spawnProcess,host:()=>({exe:'fixture'}),bootTimeout:5});await assert.rejects(g.start(),e=>e.code==='guardian_start_timeout');assert.equal(killed,1);assert.equal(g.starting,null);assert.equal(g.proc,null);
});
test('ready reveals stopped controls without rearming; failure is bounded',async()=>{
 let calls=0;const r={state:'stopped',status:()=>({state:'stopped'}),guardian:{proc:{}},async showControls(){calls++;return{controls_visible:true};}};
 const ready=await Runtime.prototype.ready.call(r);assert.equal(ready.next_action,'awaiting_human_rearm');assert.equal(r.state,'stopped');
 r.showControls=async()=>{calls++;throw Error('private stderr');};assert.equal((await Runtime.prototype.ready.call(r)).next_action,'inspect_diagnostics');await Runtime.prototype.ready.call(r);assert.equal(calls,2);
 for(const platform of ['win32','darwin']){
  const source=controllerStartSource(null,platform);
  assert.match(source,/mjs" start/);assert.match(source,/mjs" controls/);
  assert(source.indexOf('mjs" start')<source.indexOf('mjs" controls'));
  assert(!source.includes('rearm'),'the human launcher reveals controls; only the local button clears Stop');
 }
});
test('ready treats an invisible control reply as a bounded diagnostic failure',async()=>{
 let calls=0;
 const runtime={state:'stopped',status:()=>({state:'stopped'}),guardian:{proc:{},initialized:true},async showControls(){calls++;return {state:'stopped',controls_visible:false};}};
 for(let i=0;i<2;i++){
  const result=await Runtime.prototype.ready.call(runtime);
  assert.equal(result.ready,false);assert.equal(result.controls_visible,false);
  assert.equal(result.error?.code,'guardian_controls_not_visible');
  assert.equal(result.next_action,'inspect_diagnostics');
  assert.equal(result.guardian_running,true);
 }
 assert.equal(calls,1,'an unresolved episode must not repeat startup');
 assert.equal(runtime.state,'stopped');
 const directory=fs.mkdtempSync(path.join(testDirectory('tmp'),'hidden-controls-'));
 try{const incidents=new Incidents(directory);assert(incidents.record('computer_ready',await Runtime.prototype.ready.call(runtime)));assert.equal(incidents.read()[0].code,'guardian_controls_not_visible');}
 finally{fs.rmSync(directory,{recursive:true});}
});
test('ready keeps the visible-desktop handoff explicit across repeated failed calls',async()=>{
 let calls=0;
 const runtime={state:'stopped',status:()=>({state:'stopped'}),guardian:{proc:null},async showControls(){calls++;throw Object.assign(Error('Isolated desktop'),{code:'desktop_context_unavailable'});}};
 for(let i=0;i<2;i++){
  const result=await Runtime.prototype.ready.call(runtime);
  assert.equal(result.next_action,'human_start_on_visible_desktop');
  assert.equal(result.guardian_running,false);assert.equal(result.controls_visible,false);assert.equal(result.ready,false);
 }
 assert.equal(calls,1);assert.equal(runtime.state,'stopped');
});
test('the actual human launcher can reveal controls after cached ready failure without clearing Stop',async()=>{
 const folder=fs.mkdtempSync(path.join(testDirectory('tmp'),'human-starter-'));
 const directory=path.join(folder,'data');let shows=0;
 const runtime={state:'stopped',permissionMode:'standalone',recoveryFailure:{code:'guardian_exited'},
  status(){return {state:this.state,build_id:BUILD_ID,build_version:VERSION,permission_mode:this.permissionMode};},
  guardian:{async request(){shows++;return {state:'stopped',controls_visible:true};}},
  showControls:Runtime.prototype.showControls,async close(){}};
 const service=await serveDesktop({directory,runtime});
 try{
  const latch=path.join(directory,'emergency.stop');fs.writeFileSync(latch,'stopped');
  const starter=path.join(folder,process.platform==='win32'?'Start Computer Use.cmd':'Start Computer Use.command');
  fs.copyFileSync(process.execPath,path.join(folder,process.platform==='win32'?'cu-node.exe':'cu-node'));
  if(process.platform!=='win32')fs.chmodSync(path.join(folder,'cu-node'),0o700);
  fs.writeFileSync(path.join(folder,'cu.mjs'),`import {main} from ${JSON.stringify(new URL('../scripts/desktop.mjs',import.meta.url).href)}; await main();\n`);
  fs.writeFileSync(starter,controllerStartSource(null));
  const output=await new Promise((resolve,reject)=>{
   const child=process.platform==='win32'?spawn(process.env.ComSpec||'C:/Windows/System32/cmd.exe',['/d','/s','/c',`""${starter}""`],{windowsVerbatimArguments:true,windowsHide:true,env:{...process.env,AGCU_DATA_DIR:directory,AGCU_PERMISSION_MODE:'standalone'},stdio:['ignore','pipe','pipe']}):spawn('/bin/sh',[starter],{env:{...process.env,AGCU_DATA_DIR:directory,AGCU_PERMISSION_MODE:'standalone'},stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(Error('Human launcher fixture timed out'));},10000);
   child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
   child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve(stdout):reject(Error(stderr||stdout));});
  });
  assert.equal(shows,1);assert.equal(runtime.recoveryFailure,null);assert.equal(runtime.state,'stopped');
  assert.equal(fs.readFileSync(latch,'utf8'),'stopped');assert.match(output,/"controls_visible":true/);
 }finally{await service.shutdown();fs.rmSync(folder,{recursive:true,force:true});}
});
test('incidents deduplicate and never contain error messages or request text',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'incident-'));try{const i=new Incidents(dir);for(let n=0;n<2;n++)i.record('computer_click',{error:{code:'guardian_exited',message:'SECRET C:/private'},text:'password'});const records=i.read();assert.equal(records.length,1);assert.equal(records[0].count,2);assert(!fs.readFileSync(i.file,'utf8').includes('SECRET'));}finally{fs.rmSync(dir,{recursive:true});}
});
test('signed update metadata refuses tampering, wrong platform, expired releases and unsafe paths',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');const manifest={schema:1,build_id:'a'.repeat(64),version:'1.0.0',sequence:1,platform:process.platform,arch:process.arch,min_os:'0.0.0',expires:'2099-01-01',files:{'node':{size:3,sha256:sha256('abc'),url:'https://github.com/shayann07/antigravity-computer-use/releases/download/v1/node'}}};
 const check=m=>{const bytes=Buffer.from(JSON.stringify(m));return verifyRelease(bytes,sign(null,bytes,privateKey).toString('base64'),publicKey);};assert.equal(check(manifest).version,'1.0.0');
 assert.throws(()=>verifyRelease(Buffer.from('{}'),'bad',publicKey));assert.throws(()=>check({...manifest,arch:'wrong'}));assert.throws(()=>check({...manifest,min_os:'9999.0.0'}));assert.throws(()=>check({...manifest,expires:'2020-01-01'}));assert.throws(()=>check({...manifest,files:{'../escape':manifest.files.node}}));
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'update-'));try{fs.writeFileSync(path.join(dir,'node'),'abc');verifyStaged(dir,manifest);fs.writeFileSync(path.join(dir,'node'),'bad');assert.throws(()=>verifyStaged(dir,manifest));const release=acquireUpdateLock(dir);assert.throws(()=>acquireUpdateLock(dir));release();}finally{fs.rmSync(dir,{recursive:true});}
});
test('interrupted or oversized downloads never publish a partial payload',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'download-'));try{const destination=path.join(dir,'payload');await assert.rejects(downloadFile('fixture',destination,{size:3,hash:sha256('abc'),fetcher:async()=>({ok:true,body:(async function*(){yield Buffer.from('oversized');})()})}));assert(!fs.existsSync(destination));assert(!fs.existsSync(destination+'.part'));}finally{fs.rmSync(dir,{recursive:true});}
});
test('explicit controls can recover a failed episode without clearing emergency Stop',async()=>{
 const r={state:'stopped',recoveryFailure:{code:'guardian_unavailable'},guardian:{async request(){return {state:'stopped',controls_visible:true};}}};
 const response=await Runtime.prototype.showControls.call(r);assert(response.controls_visible);assert.equal(r.recoveryFailure,null);assert.equal(r.state,'stopped');
});
test('launcher failures have a structured recovery action without exposing synthetic approval',()=>{
 const result=failureReply(Object.assign(Error('Local setup failed'),{code:'guardian_spawn_failed'}),{record:false});assert.equal(result.ok,false);assert.equal(result.next_action,'inspect_diagnostics');assert.equal(result.error.code,'guardian_spawn_failed');assert(!Object.hasOwn(result,'approved'));
});
test('isolated-desktop guardian errors survive startup and never report visible controls',async()=>{
 let child;const spawnProcess=()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>child.emit('close',1);return child;};
 const guardian=new Guardian({}, {spawnProcess,host:()=>({exe:'fixture'}),bootTimeout:500});const boot=guardian.start();child.stdout.write(JSON.stringify({ev:'error',code:'desktop_context_unavailable',message:'Hidden desktop'})+'\n');await assert.rejects(boot,e=>e.code==='desktop_context_unavailable');assert.equal(guardian.initialized,false);
 const runtime={guardian,state:'idle',status:()=>({state:'idle'}),async showControls(){return {controls_visible:false,error:{code:'desktop_context_unavailable',message:'Hidden desktop'}};}};
 const result=await Runtime.prototype.ready.call(runtime);assert.equal(result.ready,false);assert.equal(result.controls_visible,false);assert.equal(result.error.code,'desktop_context_unavailable');
});
test('streamed release metadata refuses oversized bodies before buffering all chunks',async()=>{
 let chunks=0;const reply={ok:true,body:(async function*(){for(let i=0;i<20;i++){chunks++;yield Buffer.alloc(8);}})()};await assert.rejects(readBoundedJSON(reply,12),/update_metadata_size/);assert.equal(chunks,2);
 assert.deepEqual(await readBoundedJSON({ok:true,body:(async function*(){yield Buffer.from('{"ok":');yield Buffer.from('true}');})()},100),{ok:true});
});
