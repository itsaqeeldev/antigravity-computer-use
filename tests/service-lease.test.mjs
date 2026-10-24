import {testDirectory} from './paths.mjs';
// Real Windows kernel ownership, using inert runtimes: no screenshots or input.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {once} from 'node:events';
import {acquireServiceLease} from '../server/service-lease.mjs';import {serveDesktop} from '../server/desktop-service.mjs';import {request} from '../scripts/desktop.mjs';
import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
const base=testDirectory('service-lease-tests');fs.mkdirSync(base,{recursive:true});
const temporary=()=>fs.mkdtempSync(path.join(base,'owner-'));
test('one real kernel owner covers path-case aliases and prevents directory replacement until release',async()=>{
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
 const dir=temporary(),file=path.join(dir,'desktop-session.json'),saved=JSON.stringify({pid:process.pid,secret:'inert fixture; never log'});fs.writeFileSync(file,saved);let prepared=0;
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
