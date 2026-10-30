import {testDirectory} from './paths.mjs';
// Real Windows kernel ownership, using inert runtimes: no screenshots or input.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {once} from 'node:events';
import {acquireServiceLease} from '../server/service-lease.mjs';import {serveDesktop} from '../server/desktop-service.mjs';import {request} from '../scripts/desktop.mjs';
import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {storageOperation} from '../server/storage.mjs';
import {rollbackGuarded} from '../scripts/rollback.mjs';
const base=testDirectory('service-lease-tests');fs.mkdirSync(base,{recursive:true});
const temporary=()=>fs.mkdtempSync(path.join(base,'owner-'));
test('structured refusal survives helper exit before stdout is drained',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',spawnProcess:()=>child});
 process.nextTick(()=>{child.exitCode=1;child.emit('exit',1);child.stdout.write('{"ok":false,"error":{"code":"service_already_running","message":"Already owned."}}\n');child.emit('close',1);});
 await assert.rejects(pending,e=>e.code==='service_already_running');
});
test('helper exit without a complete reply still fails closed',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',spawnProcess:()=>child});
 process.nextTick(()=>{child.exitCode=1;child.emit('exit',1);child.stdout.write('{');child.emit('close',1);});
 await assert.rejects(pending,e=>e.code==='service_lease_exited');
});
test('a late success from an exited helper cannot grant ownership',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',spawnProcess:()=>child,prepareStorage:async()=>{}});
 process.nextTick(()=>{child.exitCode=1;child.emit('exit',1);child.stdout.write('{"ok":true,"lease_acquired":true}\n');child.emit('close',1);});
 await assert.rejects(pending,e=>e.code==='service_ownership_lost');
});
test('native lease preparation refuses unrelated nonempty storage',async t=>{
 const dir=temporary(),file=path.join(dir,'unrelated.txt');fs.writeFileSync(file,'preserve');
 try{
  let error,unexpected;try{unexpected=await acquireServiceLease(dir);}catch(e){error=e;}if(unexpected){await unexpected.release();assert.fail('unrelated data was adopted');}
  if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error?.code)){t.skip('native private storage qualification refused: '+error.code);return;}assert.equal(error?.code,'storage_not_dedicated');
  assert.equal(fs.readFileSync(file,'utf8'),'preserve');assert.equal(fs.readdirSync(dir).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('native lease acknowledgement leaves a verifiably private data tree',async t=>{
 const dir=temporary();let lease;
 try{
  try{lease=await acquireServiceLease(dir);}catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){t.skip('native private storage qualification refused: '+error.code);return;}throw error;}
  const checked=storageOperation('verify-data-tree',dir);assert.equal(checked.ok,true);assert.equal(checked.private_storage,true);lease.assertHeld();
 }finally{if(lease)await lease.release();fs.rmSync(dir,{recursive:true,force:true});}
});
test('injected storage verification is not skipped by a helper acknowledgement',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;let checks=0;
 child.stdin.on('finish',()=>{child.exitCode=0;child.emit('exit',0);child.emit('close',0);});child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',spawnProcess:()=>child,prepareStorage:async()=>{checks++;}});process.nextTick(()=>child.stdout.write('{"ok":true,"lease_acquired":true,"private_storage_verified":true}\n'));
 const lease=await pending;assert.equal(checks,1);await lease.release();
});
test('a storage verifier refusal releases the acknowledged native lease',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;let closed=false;
 child.stdin.on('finish',()=>{closed=true;child.exitCode=0;child.emit('exit',0);child.emit('close',0);});child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',spawnProcess:()=>child,prepareStorage:async()=>{throw Object.assign(Error('fixture refusal'),{code:'storage_not_private'});}});process.nextTick(()=>child.stdout.write('{"ok":true,"lease_acquired":true,"private_storage_verified":true}\n'));
 await assert.rejects(pending,e=>e.code==='storage_not_private');assert(closed);
});
test('measure macOS native lease verification overhead',{skip:process.platform!=='darwin',timeout:30000},async t=>{
 const dir=temporary();let lease;
 try{
  try{lease=await acquireServiceLease(dir);}catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){t.skip('native private storage qualification refused: '+error.code);return;}throw error;}
  const samples=[];for(let i=0;i<20;i++){const started=performance.now();lease.assertHeld();samples.push(performance.now()-started);}
  samples.sort((a,b)=>a-b);t.diagnostic(JSON.stringify({scope:'lease_assert_only_not_agent_or_workflow',samples:samples.length,median_ms:(samples[9]+samples[10])/2,p95_ms:samples[18]}));
 }finally{if(lease)await lease.release();fs.rmSync(dir,{recursive:true,force:true});}
});
test('lost rollback lease prevents subsequent restoration and retains the journal',async()=>{
 const folder=temporary(),current=path.join(folder,'current'),data=path.join(current,'data'),journal=path.join(folder,'rollback.json');fs.mkdirSync(data,{recursive:true});
 const first=path.join(folder,'first'),second=path.join(folder,'second'),old1=path.join(folder,'old1'),old2=path.join(folder,'old2');
 for(const file of [first,second])fs.writeFileSync(file,'new');for(const file of [old1,old2])fs.writeFileSync(file,'old');
 fs.writeFileSync(journal,JSON.stringify({release:path.join(current,'releases','candidate'),records:[{kind:'launcher',existed:true,file:first,saved:old1},{kind:'launcher',existed:true,file:second,saved:old2}]}));
 let lost=false;const lease={assertHeld(){if(lost)throw Object.assign(Error('ownership lost'),{code:'service_ownership_lost'});}};const rename=fs.renameSync;
 try{
  fs.renameSync=(from,to)=>{const result=rename(from,to);if(to===first)lost=true;return result;};
  await assert.rejects(rollbackGuarded(journal,{held:new Map([[data,lease]])}),e=>e.code==='service_ownership_lost');
  assert.equal(fs.readFileSync(first,'utf8'),'old');assert.equal(fs.readFileSync(second,'utf8'),'new');assert(fs.existsSync(journal));
 }finally{fs.renameSync=rename;fs.rmSync(folder,{recursive:true,force:true});}
});
test('real lease-helper death interrupts a partially completed rollback',{timeout:30000},async t=>{
 const folder=temporary(),current=path.join(folder,'current'),data=path.join(current,'data'),journal=path.join(folder,'rollback.json');fs.mkdirSync(data,{recursive:true});
 const first=path.join(folder,'first'),second=path.join(folder,'second'),old1=path.join(folder,'old1'),old2=path.join(folder,'old2');
 for(const file of [first,second])fs.writeFileSync(file,'new');for(const file of [old1,old2])fs.writeFileSync(file,'old');
 fs.writeFileSync(journal,JSON.stringify({release:path.join(current,'releases','candidate'),records:[{kind:'launcher',existed:true,file:first,saved:old1},{kind:'launcher',existed:true,file:second,saved:old2}]}));
 try{storageOperation('data',data);}catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){fs.rmSync(folder,{recursive:true,force:true});t.skip('native private storage qualification refused: '+error.code);return;}throw error;}
 const script=`import fs from 'node:fs';import {rollbackGuarded} from ${JSON.stringify(new URL('../scripts/rollback.mjs',import.meta.url).href)};import {acquireServiceLease} from ${JSON.stringify(new URL('../server/service-lease.mjs',import.meta.url).href)};
 const rename=fs.renameSync;fs.renameSync=(from,to)=>{const value=rename(from,to);if(to===process.argv[2]){console.log('barrier');const b=Buffer.alloc(1);fs.readSync(0,b,0,1,null);}return value;};
 try{await rollbackGuarded(process.argv[1],{acquire:async dir=>{const lease=await acquireServiceLease(dir);console.log('lease:'+lease.pid);return lease;}});console.log('unexpected_success');}catch(error){console.log('result:'+error.code);}`;
 const child=spawn(process.execPath,['--input-type=module','-e',script,journal,first],{stdio:['pipe','pipe','pipe'],windowsHide:true});let output='',errors='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>errors+=x);const closed=new Promise(resolve=>child.once('close',resolve));
 try{
  const until=Date.now()+15000;while(!output.includes('barrier')&&child.exitCode===null&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
  assert(output.includes('barrier'),errors+' '+output);const pid=Number(/lease:(\d+)/.exec(output)?.[1]);assert(pid>0);process.kill(pid);
  let alive=true;while(alive&&Date.now()<until){try{process.kill(pid,0);if(process.platform==='darwin'){const state=spawnSync('/bin/ps',['-o','stat=','-p',String(pid)],{encoding:'utf8',timeout:3000});if(state.status!==0||/^\s*Z/.test(state.stdout||'')){alive=false;break;}}await new Promise(resolve=>setTimeout(resolve,20));}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}}assert.equal(alive,false,'helper must terminate before resuming restore');
  child.stdin.end('x');assert.equal(await closed,0,errors);assert.match(output,/result:service_ownership_lost/);assert(!output.includes('unexpected_success'));assert.equal(fs.readFileSync(first,'utf8'),'old');assert.equal(fs.readFileSync(second,'utf8'),'new');assert(fs.existsSync(journal));
 }finally{if(child.exitCode===null&&child.signalCode===null)child.kill();await closed;fs.rmSync(folder,{recursive:true,force:true});}
});
test('cross-root rollback fences real competing controller leases',{timeout:30000},async t=>{
 const folder=temporary(),current=path.join(folder,'current'),previous=path.join(folder,'previous'),data=path.join(previous,'data');fs.mkdirSync(data,{recursive:true});
 const saved=path.join(folder,'saved-deployment.json'),source=path.join(folder,'saved-launcher'),destination=path.join(folder,'launcher'),journal=path.join(folder,'rollback.json');
 fs.writeFileSync(saved,JSON.stringify({target:previous}));fs.writeFileSync(source,'old');fs.writeFileSync(destination,'new');
 fs.writeFileSync(journal,JSON.stringify({release:path.join(current,'releases','candidate'),records:[{kind:'deployment',existed:true,saved,file:path.join(folder,'deployment.json')},{kind:'launcher',existed:true,saved:source,file:destination}]}));let lease;
 try{
  try{lease=await acquireServiceLease(data);}catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){t.skip('native private storage qualification refused: '+error.code);return;}throw error;}
  await assert.rejects(rollbackGuarded(journal),e=>e.code==='service_already_running');assert.equal(fs.readFileSync(destination,'utf8'),'new');
  await lease.release();lease=null;const currentData=path.join(current,'data');fs.mkdirSync(currentData,{recursive:true});lease=await acquireServiceLease(currentData);
  assert((await rollbackGuarded(journal,{held:new Map([[currentData,lease]])})).restored);lease.assertHeld();assert.equal(fs.readFileSync(destination,'utf8'),'old');
 }finally{if(lease)await lease.release();fs.rmSync(folder,{recursive:true,force:true});}
});
test('timed-out ownership helper is reaped before startup rejects',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.exitCode=null;let closed=false;
 child.kill=()=>{setTimeout(()=>{closed=true;child.exitCode=1;child.emit('exit',1);child.emit('close',1);},40);};
 await assert.rejects(acquireServiceLease(base,{helper:'inert',startupTimeout:10,spawnProcess:()=>child}),e=>e.code==='service_lease_timeout');
 assert(closed,'caller must not recover while the helper still holds handles');
});
test('a helper that cannot be reaped reports unconfirmed cleanup',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.exitCode=null;child.kill=()=>false;
 await assert.rejects(acquireServiceLease(base,{helper:'inert',startupTimeout:10,cleanupTimeout:25,spawnProcess:()=>child}),e=>e.code==='service_lease_cleanup_unconfirmed'&&e.cause?.code==='service_lease_timeout');
});
test('lease release waits for a killed helper to exit before reporting success',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;let exited=false;
 child.kill=()=>{setTimeout(()=>{exited=true;child.exitCode=1;child.emit('exit',1);child.emit('close',1);},30);return true;};
 const pending=acquireServiceLease(base,{helper:'inert',releaseTimeout:10,cleanupTimeout:100,spawnProcess:()=>child,prepareStorage:async()=>({ok:true})});process.nextTick(()=>child.stdout.write('{"ok":true,"lease_acquired":true}\n'));
 const lease=await pending;await lease.release();assert(exited,'release must not finish until the helper exits');
});
test('lease release reports unconfirmed cleanup when a helper does not exit',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',releaseTimeout:10,cleanupTimeout:30,spawnProcess:()=>child,prepareStorage:async()=>({ok:true})});process.nextTick(()=>child.stdout.write('{"ok":true,"lease_acquired":true}\n'));
 const lease=await pending;await assert.rejects(lease.release(),e=>e.code==='service_lease_cleanup_unconfirmed');
});
test('a broken lease pipe still requires confirmed helper termination',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;child.stdin.end=()=>{throw Error('broken pipe');};child.kill=()=>false;
 const pending=acquireServiceLease(base,{helper:'inert',releaseTimeout:10,cleanupTimeout:30,spawnProcess:()=>child,prepareStorage:async()=>({ok:true})});process.nextTick(()=>child.stdout.write('{"ok":true,"lease_acquired":true}\n'));
 const lease=await pending;await assert.rejects(lease.release(),e=>e.code==='service_lease_cleanup_unconfirmed');
});
test('malformed publication acknowledgement fails promptly and retires the helper',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.pid=process.pid;child.exitCode=null;child.signalCode=null;
 child.kill=()=>{child.exitCode=1;child.emit('exit',1);child.emit('close',1);};
 child.stdin.on('data',()=>child.stdout.write('not-json\n'));
 const pending=acquireServiceLease(base,{helper:'inert',spawnProcess:()=>child,prepareStorage:async()=>({ok:true})});process.nextTick(()=>child.stdout.write('{"ok":true,"lease_acquired":true}\n'));
 const lease=await pending;await assert.rejects(lease.publishIncidents(Buffer.from('[]')),e=>e.code==='incident_publish_outcome_unknown');assert.equal(lease.lost,true);assert.equal(child.exitCode,1);await lease.release();
});
test('one real kernel owner covers path-case aliases and prevents directory replacement until release',{skip:process.platform!=='win32'},async()=>{
 const dir=temporary(),moved=dir+'-moved';const lease=await acquireServiceLease(dir);
 try{
  await assert.rejects(acquireServiceLease(dir.toUpperCase()),e=>e.code==='service_already_running');
  assert.throws(()=>fs.renameSync(dir,moved));assert(fs.existsSync(dir));
 }finally{await lease.release();}
 fs.renameSync(dir,moved);fs.renameSync(moved,dir);
 const next=await acquireServiceLease(dir);await next.release();fs.rmSync(dir,{recursive:true,force:true});
});

test('a competing service cannot replace capability metadata or prepare its runtime',async()=>{
 const dir=temporary();let prepared=0;
 const first=await serveDesktop({directory:dir,runtime:{status:()=>({state:'idle'}),async close(){}}});
 try{
  const original=fs.readFileSync(first.file,'utf8');
  await assert.rejects(serveDesktop({directory:dir,runtime:{async prepare(){prepared++;},async close(){}}}),e=>e.code==='service_already_running');
  assert.equal(prepared,0);assert.equal(fs.readFileSync(first.file,'utf8'),original);assert.equal((await request(JSON.parse(original),'status')).state,'idle');
 }finally{await first.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});

test('a live legacy controller is respected even without a kernel lease',async()=>{
 const dir=temporary(),file=path.join(dir,'desktop-session.json'),saved=JSON.stringify({pid:process.pid,secret:'inert fixture; never log'});
 if(process.platform==='darwin')storageOperation('data',dir);
 fs.writeFileSync(file,saved);let prepared=0;
 try{await assert.rejects(serveDesktop({directory:dir,runtime:{async prepare(){prepared++;},async close(){}}}),e=>e.code==='service_already_running');assert.equal(prepared,0);assert.equal(fs.readFileSync(file,'utf8'),saved);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('ownership-helper death stops control and rejects input without replay or replacement',async()=>{
 const dir=temporary();let state='active',stops=0,delivered=0;
 const runtime={status:()=>({state}),async stop(){stops++;state='stopped';},async action(){delivered++;},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});
 try{
  const session=JSON.parse(fs.readFileSync(service.file));const lost=once(service.ownership,'lost');process.kill(service.ownership.pid,'SIGKILL');await lost;
  const status=await request(session,'status');assert.equal(status.state,'stopped');assert.equal(status.controller_ownership_lost,true);assert.equal(stops,1);
  const refused=await request(session,'key',{hwnd:1,observation_id:'old',keys:'enter',reason:'Must not execute'});assert.equal(refused.error.code,'service_ownership_lost');assert.equal(delivered,0);
  // The OS lease disappeared, but the still-live service metadata also guards
  // against a replacement while failed control is waiting for human recovery.
  await assert.rejects(serveDesktop({directory:dir,runtime:{async close(){}}}),e=>e.code==='service_already_running');
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});

test('independent concurrent server processes have exactly one owner',async()=>{
 const dir=temporary();
 const source=`import {serveDesktop} from ${JSON.stringify(new URL('../server/desktop-service.mjs',import.meta.url).href)};try{const service=await serveDesktop({directory:process.argv[1],runtime:{status:()=>({state:'idle'}),async close(){}}});console.log(JSON.stringify({owned:true,pid:process.pid}));process.stdin.once('data',async()=>{await service.shutdown();process.stdin.destroy();});}catch(e){console.log(JSON.stringify({owned:false,error:e.code}));}`;
 function worker(){
  const child=spawn(process.execPath,['--input-type=module','-e',source,dir],{windowsHide:true,stdio:['pipe','pipe','pipe']});child.stdin.on('error',()=>{});let errors='';child.stderr.on('data',s=>errors+=s);
  const exited=once(child,'exit');const ready=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Ownership worker timed out: '+errors)),8000);createInterface({input:child.stdout}).once('line',line=>{clearTimeout(t);try{resolve(JSON.parse(line));}catch(e){reject(e);}});child.once('error',reject);});return{child,ready,exited};
 }
 const a=worker(),b=worker();
 try{const result=await Promise.all([a.ready,b.ready]);assert.equal(result.filter(x=>x.owned).length,1);assert.equal(result.find(x=>!x.owned).error,'service_already_running');}
 finally{for(const w of [a,b])if(w.child.exitCode===null)w.child.stdin.end('close\n');let timer;try{await Promise.race([Promise.all([a.exited,b.exited]),new Promise((_,reject)=>{timer=setTimeout(()=>{for(const w of [a,b])if(w.child.exitCode===null)w.child.kill();reject(Error('Ownership workers did not close'));},5000);})]);}finally{clearTimeout(timer);fs.rmSync(dir,{recursive:true,force:true});}}
});

test('failed runtime preparation releases ownership without publishing a session',async()=>{
 const dir=temporary();let closed=0;
 try{
  await assert.rejects(serveDesktop({directory:dir,runtime:{async prepare(){throw Error('Controlled preparation failure');},async close(){closed++;}}}),/Controlled preparation failure/);assert.equal(closed,1);assert(!fs.existsSync(path.join(dir,'desktop-session.json')));
  const next=await serveDesktop({directory:dir,runtime:{status:()=>({state:'idle'}),async close(){}}});await next.shutdown();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
