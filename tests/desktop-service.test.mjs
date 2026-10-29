import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {serveDesktop,compact} from '../server/desktop-service.mjs';
import {request,describeCommand,encodeReply,failureReply} from '../scripts/desktop.mjs';
import net from 'node:net';
import {BUILD_ID} from '../server/version.mjs';
import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {storageOperation} from '../server/storage.mjs';
import {Incidents} from '../server/incidents.mjs';

test('direct command discovery exposes action schemas without source or session access',()=>{
 const click=describeCommand('click');assert.equal(click.command,'click');assert(click.inputSchema.required.includes('observation_id'));assert.deepEqual(click.inputSchema.properties.button.enum,['left','right','middle']);assert.equal(click.inputSchema.additionalProperties,false);
 assert.equal(describeCommand('computer_launch').inputSchema.properties.app.type,'string');
 const paste=describeCommand('paste');assert(paste.cliAliases.some(alias=>alias.flag==='--text-file'&&alias.replaces==='--text'));assert.equal(paste.inputSchema.additionalProperties,false);
 assert(describeCommand('run').cliAliases.some(alias=>alias.flag==='--steps-file'));
 assert.equal(describeCommand('click').cliAliases,undefined);
 assert.equal(describeCommand('snapshot').inputSchema.properties.settle_ms.maximum,2000);
 for(const command of ['start','shutdown','describe'])assert.equal(describeCommand(command).inputSchema.additionalProperties,false);
 assert.deepEqual(describeCommand('start').inputSchema.required,[]);
 assert.throws(()=>describeCommand('invented'),error=>error.code==='unknown_command');
});

test('one offline discovery call exposes multiple schemas and never creates a desktop session',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-describe-'));
 try {
  for(const args of [['describe','click','paste','run'],['describe','--all']]){
   const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/desktop.mjs',import.meta.url)),...args],{windowsHide:true,encoding:'utf8',env:{...process.env,AGCU_DATA_DIR:dir}});
   assert.equal(result.status,0,result.stderr);const value=JSON.parse(result.stdout);assert(value.commands.length>=3);assert(value.commands.every(c=>c.inputSchema));
  }
  assert.deepEqual(fs.readdirSync(dir),[]);
 }finally{fs.rmdirSync(dir);}
});

test('importing the service library never treats an unrelated --serve argument as activation',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-import-only-'));
 try{
  const script=`await import(${JSON.stringify(new URL('../server/desktop-service.mjs',import.meta.url).href)});console.log('import only');`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script,'--','--serve'],{windowsHide:true,encoding:'utf8',timeout:4000,env:{...process.env,AGCU_DATA_DIR:dir}});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'import only');assert.deepEqual(fs.readdirSync(dir),[]);
 }finally{fs.rmdirSync(dir);}
});

test('foreground serve stays resident for host-owned background execution and shuts down normally',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-foreground-'));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/desktop.mjs',import.meta.url)),'serve'],{windowsHide:true,env:{...process.env,AGCU_DATA_DIR:dir,AGCU_PERMISSION_MODE:'standalone'},stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',s=>stderr+=s);
 try{
  const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Foreground startup timed out: '+stderr)),10000);child.once('error',reject);createInterface({input:child.stdout}).once('line',line=>{clearTimeout(timer);try{resolve(JSON.parse(line));}catch(error){reject(error);}});});
  assert.equal(ready.ok,true,JSON.stringify(ready));assert.equal(ready.service_mode,'foreground',JSON.stringify(ready));assert.equal(ready.private_data_storage,true);assert.equal(ready.state,'idle');
  await new Promise(resolve=>setTimeout(resolve,100));assert.equal(child.exitCode,null,'Do not exit after printing readiness');
  const session=JSON.parse(fs.readFileSync(path.join(dir,'desktop-session.json')));
  assert.equal((await request(session,'status')).state,'idle');const exited=new Promise(resolve=>child.once('exit',resolve));assert.equal((await request(session,'shutdown')).closed,true);assert.equal(await exited,0,stderr);
 }finally{if(child.exitCode===null)child.kill();fs.rmSync(dir,{recursive:true,force:true});}
});

test('CLI JSON survives legacy PowerShell stdout decoding without corrupting Unicode',()=>{
 const original={tree:'اردو — 4× 👩🏽‍💻 می\u200cخواهم',path:'D:/تصاویر/عکس.png'};
 const wire=encodeReply(original);assert(!/[^\x00-\x7f]/.test(wire));
 assert.deepEqual(JSON.parse(Buffer.from(wire,'ascii').toString('ascii')),original);
 assert.match(wire,/\\u200c/);assert.match(wire,/\\ud83d/);
});

test('a passive sidecar releases idle control and serves a later session without restarting',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-idle-'));let state='active',finishes=0;
 const runtime={status:()=>({state}),async finish(){finishes++;state='idle';},async observe(){state='active';return {metadata:{observation_id:'next-session'}};},async close(){}};
 const service=await serveDesktop({directory:dir,runtime,idlePolicy:'release',idleTimeoutMs:25,idleCheckMs:5});const session=JSON.parse(fs.readFileSync(service.file));
 try{
  for(let i=0;i<30&&!finishes;i++)await new Promise(r=>setTimeout(r,10));assert.equal(finishes,1);assert(fs.existsSync(service.file));
  const status=await request(session,'status');assert.equal(status.state,'idle');assert.equal(status.listener_idle_policy,'release');
  assert.equal((await request(session,'snapshot',{hwnd:1})).metadata.observation_id,'next-session');assert.equal(state,'active');
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});

test('service shutdown removes its process signal handlers',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-signal-cleanup-'));
 const before={term:process.listenerCount('SIGTERM'),int:process.listenerCount('SIGINT')};
 const runtime={status:()=>({state:'idle'}),async close(){}};
 try{
  const service=await serveDesktop({directory:dir,runtime});
  assert.equal(process.listenerCount('SIGTERM'),before.term+1);
  assert.equal(process.listenerCount('SIGINT'),before.int+1);
  await service.shutdown();
  assert.equal(process.listenerCount('SIGTERM'),before.term);
  assert.equal(process.listenerCount('SIGINT'),before.int);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('passive idle cleanup never resumes or clears a human Pause or Stop',async()=>{
 for(const state of ['paused','stopped']){
  const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-idle-stop-'));let finishes=0;
  const runtime={status:()=>({state}),async finish(){finishes++;},async close(){}};
  const service=await serveDesktop({directory:dir,runtime,idlePolicy:'release',idleTimeoutMs:10,idleCheckMs:5});
  try{await new Promise(r=>setTimeout(r,60));assert.equal(finishes,0);assert.equal((await request(JSON.parse(fs.readFileSync(service.file)),'status')).state,state);}
  finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
 }
});

test('an unreachable saved service has a recovery message, never raw pipe errors',async()=>{
 await assert.rejects(request({pipe:process.platform==='win32'?'\\\\.\\pipe\\agcu-missing-'+process.pid:path.join(testDirectory('tmp'),'missing-agcu-'+process.pid),secret:'test'},'status'),error=>error.code==='session_unavailable'&&/Emergency Stop remains latched/.test(error.message));
});

test('a standalone client cannot silently reuse a host-managed service with the same build',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-policy-'));let inputs=0;
 const runtime={permissionMode:'host-managed',status:()=>({state:'active',permission_mode:'host-managed'}),async action(){inputs++;return {};},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});try{
  const session=JSON.parse(fs.readFileSync(service.file));
  for(const mode of ['standalone',undefined]){
   const result=await request(session,'clipboard',{reason:'Explicit access'},1000,mode);assert.equal(result.ok,false);assert.equal(result.error.code,'deployment_policy_mismatch');
  }
  assert.equal(inputs,0);const result=await request(session,'clipboard',{reason:'Explicit access'},1000,'host-managed');assert.equal(result.ok,true);assert.equal(inputs,1);
  assert.equal((await request(session,'status',{},1000,'standalone')).permission_mode,'host-managed');
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
test('diagnostic persistence does not delay an error reply and shutdown waits for it',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-async-incident-'));let release,started;const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r),original=Incidents.prototype.recordSerialized;
 Incidents.prototype.recordSerialized=async()=>{started();await gate;};
 const runtime={permissionMode:'host-managed',status:()=>({state:'idle',permission_mode:'host-managed'}),async close(){}};let service;
 try{
  service=await serveDesktop({directory:dir,runtime});const session=JSON.parse(fs.readFileSync(service.file));
  const result=await request(session,'clipboard',{reason:'Denied policy'},1000,'standalone');assert.equal(result.error.code,'deployment_policy_mismatch');assert.equal(result.diagnostic_pending,true);assert.match(result.incident_id,/^[a-f0-9]{24}$/);await entered;assert.equal((await request(session,'status',{},1000,'host-managed')).diagnostic_pending,1);
  let closed=false;const shutting=service.shutdown().then(()=>{closed=true;});await new Promise(r=>setTimeout(r,30));assert.equal(closed,false);release();await shutting;assert.equal(closed,true);
 }finally{release();if(service)await service.shutdown();Incidents.prototype.recordSerialized=original;fs.rmSync(dir,{recursive:true,force:true});}
});

test('start refuses to replace a live but unresponsive service',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-start-'));const file=path.join(dir,'desktop-session.json');
 // Establish a dedicated native data root before populating a saved session.
 // macOS correctly refuses to adopt arbitrary nonempty, unmarked directories.
 if(process.platform==='darwin')storageOperation('data',dir);
 const raw=JSON.stringify({pid:process.pid,pipe:process.platform==='win32'?'\\\\.\\pipe\\agcu-unresponsive-'+process.pid:path.join(dir,'missing.sock'),secret:'fixture'});fs.writeFileSync(file,raw);
 try{
  const result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/desktop.mjs',import.meta.url)),'start'],{windowsHide:true,env:{...process.env,AGCU_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);child.on('error',reject);child.on('exit',code=>resolve({code,stdout,stderr}));
  });
  assert.equal(result.code,1,result.stderr);assert.equal(JSON.parse(result.stdout).error.code,'session_unresponsive');assert.equal(fs.readFileSync(file,'utf8'),raw);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('shutdown reports cleanup failure and remains reachable for recovery',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-close-'));let fail=true;
 const runtime={status:()=>({state:'stopped'}),async close(){await new Promise(r=>setTimeout(r,20));if(fail)throw Object.assign(Error('Held-input cleanup failed'),{code:'input_cleanup_failed'});}};
 const service=await serveDesktop({directory:dir,runtime});const session=JSON.parse(fs.readFileSync(service.file));
 try{
  for(const rejected of await Promise.all([request(session,'shutdown'),request(session,'shutdown')])){assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'input_cleanup_failed');}
  assert(fs.existsSync(service.file));assert.equal((await request(session,'status')).state,'stopped');
  fail=false;assert.equal((await request(session,'shutdown')).closed,true);assert(!fs.existsSync(service.file));
 }finally{fail=false;await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
test('direct skill IPC authenticates, rejects overlapping actions, and permits independent stop',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-direct-'));let release,stops=0,calls=0;
 const runtime={status(){return {state:'idle'};},async stop(){stops++;return {stopped:true};},async close(){},async observe(){calls++;return new Promise(resolve=>{release=()=>resolve({metadata:{observation_id:'test'}});});}};
 const service=await serveDesktop({directory:dir,runtime});const session=JSON.parse(fs.readFileSync(service.file));
 try{
  assert.equal((await request(session,'status')).state,'idle');
  assert.equal((await request({...session,secret:'wrong'},'status')).ok,false);
  const pending=request(session,'snapshot',{hwnd:1});
  while(!release)await new Promise(r=>setTimeout(r,5));
  const blocked=await request(session,'snapshot',{hwnd:1});assert.equal(blocked.ok,false);assert.match(blocked.error.message,/pending/);
  assert.equal((await request(session,'stop')).stopped,true);assert.equal(stops,1);assert.equal(calls,1);
  release();await pending;
  assert.equal((await request(session,'click',{hwnd:1,confirmed:true})).ok,false);
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
test('direct IPC client timeout cancels active work without replay',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-direct-'));let stops=0,actions=0,release;
 const runtime={async action(){actions++;return new Promise(resolve=>release=()=>resolve({input_completed:true}));},async stop(){stops++;},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});const session=JSON.parse(fs.readFileSync(service.file));
 try{
  await assert.rejects(request(session,'click',{hwnd:1,observation_id:'observed',index:1,reason:'Inert action'},100),error=>{
   const result=failureReply(error,{record:false});assert.equal(result.delivery_unknown,true);assert.equal(result.next_action,'inspect_effect_without_replay');return /timed out/.test(error.message);
  });
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(stops,1);assert.equal(actions,1);release();
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
test('direct observations return an actual local image without duplicate tree payload',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-image-'));
 try{const r=compact({metadata:{observation_id:'abc',tree:'controls',elements:[1]},image:{data:Buffer.from('image').toString('base64'),width:100,height:80,source:[-100,0,100,80]}},dir);
 assert.equal(fs.readFileSync(r.image.path,'utf8'),'image');assert(!r.metadata.elements);assert(!r.image.data);assert.equal(r.metadata.tree,'controls');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('updater health startup stays passive and rejects tasks until installation unlocks',async()=>{
 const parent=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-update-gate-')),dir=path.join(parent,'data');let inputs=0;
 const runtime={status:()=>({state:'idle'}),async ready(){inputs++;return {};},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});const session=JSON.parse(fs.readFileSync(service.file));
 try{fs.writeFileSync(path.join(parent,'update-switching.json'),'fixture');assert.equal((await request(session,'status')).state,'idle');assert.equal((await request(session,'ready')).error.code,'update_in_progress');assert.equal(inputs,0);fs.unlinkSync(path.join(parent,'update-switching.json'));assert.equal((await request(session,'ready')).ok,true);assert.equal(inputs,1);}finally{await service.shutdown();fs.rmSync(parent,{recursive:true,force:true});}
});
test('stale input returns an explicit fresh-observation instruction without retrying',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-stale-advice-'));let calls=0;
 const runtime={async action(){calls++;throw Object.assign(Error('Expired frame'),{code:'stale_observation'});},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});try{const result=await request(JSON.parse(fs.readFileSync(service.file)),'click',{hwnd:1,observation_id:'expired',index:1,reason:'Observed target'});assert.equal(result.error.code,'stale_observation');assert.equal(result.next_action,'observe_again');assert.equal(result.replay_allowed,false);assert.equal(calls,1);}finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
test('completed input with a stale verification error directs inspection without replay',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-completed-advice-'));let calls=0;
 const runtime={async action(){calls++;return {input_completed:true,verification_error:{code:'stale_observation'}};},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});try{const result=await request(JSON.parse(fs.readFileSync(service.file)),'click',{hwnd:1,observation_id:'fresh',index:1,reason:'Observed target'});assert.equal(result.next_action,'inspect_effect_without_replay');assert.equal(result.replay_allowed,false);assert.equal(result.input_completed,true);assert.equal(calls,1);}finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});

test('direct IPC preserves Urdu and emoji when UTF-8 bytes arrive separately',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-utf8-'));const unicode='اردو — café 👩🏽‍💻';
 const runtime={async observe(args){return {metadata:{tree:args.query}};},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});const session=JSON.parse(fs.readFileSync(service.file));
 try {
  const result=await new Promise((resolve,reject)=>{
   const socket=net.createConnection(session.pipe);socket.setEncoding('utf8');let output='';socket.on('error',reject);
   socket.on('data',part=>output+=part);socket.on('end',()=>resolve(JSON.parse(output)));
   socket.on('connect',async()=>{
    const bytes=Buffer.from(JSON.stringify({secret:session.secret,command:'snapshot',expected_build_id:BUILD_ID,args:{hwnd:1,query:unicode}})+'\n');
    for(const byte of bytes){socket.write(Buffer.from([byte]));await new Promise(r=>setImmediate(r));}
   });
  });
  assert.equal(result.metadata.tree,unicode);
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
