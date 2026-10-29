import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {Incidents} from '../server/incidents.mjs';import {diagnostics} from '../scripts/diagnostics.mjs';import {testDirectory} from './paths.mjs';
import {spawn} from 'node:child_process';
import {storageOperation} from '../server/storage.mjs';import {acquireServiceLease} from '../server/service-lease.mjs';
const acquire=async()=>({assertHeld(){},async release(){}});
function fixture(reporting){const target=fs.mkdtempSync(path.join(testDirectory('tmp'),'reporting-')),directory=path.join(target,'data');fs.mkdirSync(directory);fs.writeFileSync(path.join(target,'update-settings.json'),JSON.stringify({mode:'manual',channel:'stable',reporting}));const i=new Incidents(directory);i.record('computer_click',{error:{code:'stale_observation',message:'private password'}});return {target,directory,i,clean:()=>fs.rmSync(target,{recursive:true})};}
test('no reporting consent means no network command and reports stay pending',async()=>{const f=fixture(false);try{assert.equal((await diagnostics(f.directory,{submit:true,target:f.target,acquire,run:()=>assert.fail('must not contact GitHub')})).next_action,'reporting_consent_required');assert(f.i.read()[0].pending);}finally{f.clean();}});
test('missing GitHub authentication keeps pending reports and applies retry backoff',async()=>{const f=fixture(true);try{let calls=0;const run=()=>{calls++;return {status:1,stderr:'private credentials'};};assert.equal((await diagnostics(f.directory,{submit:true,target:f.target,acquire,run})).next_action,'github_authentication_or_network_required');assert.equal((await diagnostics(f.directory,{submit:true,target:f.target,acquire,run})).next_action,'reporting_backoff');assert.equal(calls,1);assert(f.i.read()[0].pending);}finally{f.clean();}});
test('consented submission sends sanitized metadata once and resolves duplicate issues',async()=>{for(const duplicate of [false,true]){const f=fixture(true);try{let created=0;const run=(_exe,args,options)=>{if(args[1]==='list')return {status:0,stdout:JSON.stringify(duplicate?[{number:1}]:[])};created++;assert(!options.input.includes('private password'));assert(args.includes('--body-file'));return {status:0,stdout:'https://github.com/example/issue'};};assert.equal((await diagnostics(f.directory,{submit:true,target:f.target,acquire,run})).submitted,1);assert.equal(created,duplicate?0:1);assert.equal(f.i.read()[0].pending,false);}finally{f.clean();}}});
test('submission revalidates stored incidents and drops injected private fields',async()=>{const f=fixture(true);try{const records=f.i.read();records[0].screenshot='C:/private-secret';records[0].clipboard='private-secret';fs.writeFileSync(f.i.file,JSON.stringify(records));let created=false;await diagnostics(f.directory,{submit:true,target:f.target,acquire,run:(_exe,args,options)=>{if(args[1]==='list')return {status:0,stdout:'[]'};created=true;assert(!options.input.includes('private-secret'));return {status:0};}});assert(created);}finally{f.clean();}});

test('overlapping reporters defer the second submission and preserve pending incidents',async()=>{
 const f=fixture(true);let held=false,entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let creates=0;
 const exclusive=async()=>{if(held)throw Object.assign(Error('held'),{code:'service_already_running'});held=true;entered();await gate;return {assertHeld(){assert(held);},async release(){held=false;}};};
 const run=(_exe,args)=>args[1]==='list'?{status:0,stdout:'[]'}:(creates++,{status:0});
 try{
  const first=diagnostics(f.directory,{submit:true,target:f.target,acquire:exclusive,run});await started;
  const second=await diagnostics(f.directory,{submit:true,target:f.target,acquire:exclusive,run});
  assert.equal(second.next_action,'reporting_in_progress');assert.equal(creates,0);assert(f.i.read()[0].pending);
  release();assert.equal((await first).submitted,1);assert.equal(creates,1);
 }finally{release();f.clean();}
});

test('revoked consent during issue lookup prevents submission',async()=>{
 const f=fixture(true);let created=0;
 try{
  const run=(_exe,args)=>{if(args[1]==='list'){fs.writeFileSync(path.join(f.target,'update-settings.json'),JSON.stringify({mode:'manual',channel:'stable',reporting:false}));return {status:0,stdout:'[]'};}created++;return {status:0};};
  const result=await diagnostics(f.directory,{submit:true,target:f.target,acquire,run});
  assert.equal(result.next_action,'reporting_consent_required');assert.equal(created,0);assert(f.i.read()[0].pending);
 }finally{f.clean();}
});

test('native reporting lease excludes another reporter and releases normally',async t=>{
 const base=testDirectory('tmp'),target=fs.mkdtempSync(path.join(base,'report-native-')),directory=path.join(target,'data'),lockDir=path.join(directory,'reporting-lease');let held;
 try{
  try{storageOperation('data',directory);storageOperation('data',lockDir);held=await acquireServiceLease(lockDir);}
  catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){t.skip('native private storage qualification refused: '+error.code);return;}throw error;}
  fs.writeFileSync(path.join(target,'update-settings.json'),JSON.stringify({mode:'manual',channel:'stable',reporting:true}));
  const incidents=new Incidents(directory);incidents.record('computer_click',{error:{code:'stale_observation'}});let created=0;
  const run=(_exe,args)=>args[1]==='list'?{status:0,stdout:'[]'}:(created++,{status:0});
  assert.equal((await diagnostics(directory,{submit:true,target,run})).next_action,'reporting_in_progress');assert.equal(created,0);assert(incidents.read()[0].pending);
  await held.release();held=null;assert.equal((await diagnostics(directory,{submit:true,target,run})).submitted,1);assert.equal(created,1);
 }finally{if(held)await held.release();fs.rmSync(target,{recursive:true,force:true});}
});

test('incident recording survives overlapping report publication',async()=>{
 const f=fixture(true);
 const script=`import fs from 'node:fs';import {diagnostics} from ${JSON.stringify(new URL('../scripts/diagnostics.mjs',import.meta.url).href)};
 const rename=fs.renameSync;fs.renameSync=(from,to)=>{if(String(to).endsWith('incident-acks.json')){console.log('before-rename');const b=Buffer.alloc(1);fs.readSync(0,b,0,1,null);}return rename(from,to);};
 await diagnostics(${JSON.stringify(f.directory)},{submit:true,target:${JSON.stringify(f.target)},acquire:async()=>({assertHeld(){},async release(){}}),run:(_exe,args)=>args[1]==='list'?{status:0,stdout:'[]'}:{status:0}});`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
 const closed=new Promise(resolve=>child.once('close',resolve));
 try{
  const deadline=Date.now()+5000;while(!output.includes('before-rename')&&child.exitCode===null&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  assert(output.includes('before-rename'),'reporter must reach the publication barrier: '+errors);
  f.i.record('computer_click',{error:{code:'stale_observation'}});
  f.i.record('computer_snapshot',{error:{code:'capture_failed'}});
  child.stdin.end('x');assert.equal(await closed,0,errors);
  assert(f.i.read().some(item=>item.code==='capture_failed'),'concurrent incident must survive');
  assert(f.i.read().find(item=>item.code==='stale_observation').pending,'a newer occurrence remains pending');
 }finally{if(child.exitCode===null)child.kill();await closed;f.clean();}
});

test('interrupted acknowledgement publication leaves the incident pending',async()=>{
 const f=fixture(true);
 const script=`import fs from 'node:fs';import {diagnostics} from ${JSON.stringify(new URL('../scripts/diagnostics.mjs',import.meta.url).href)};
 const rename=fs.renameSync;fs.renameSync=(from,to)=>{if(String(to).endsWith('incident-acks.json')){console.log('before-rename');const b=Buffer.alloc(1);fs.readSync(0,b,0,1,null);}return rename(from,to);};
 await diagnostics(${JSON.stringify(f.directory)},{submit:true,target:${JSON.stringify(f.target)},acquire:async()=>({assertHeld(){},async release(){}}),run:(_exe,args)=>args[1]==='list'?{status:0,stdout:'[]'}:{status:0}});`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['pipe','pipe','pipe'],windowsHide:true});let output='';child.stdout.on('data',chunk=>output+=chunk);
 const closed=new Promise(resolve=>child.once('close',resolve));
 try{
  const deadline=Date.now()+5000;while(!output.includes('before-rename')&&child.exitCode===null&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  assert(output.includes('before-rename'),'reporter must reach acknowledgement publication');
  child.kill();await closed;
  assert.equal(f.i.read()[0].pending,true);
 }finally{if(child.exitCode===null)child.kill();await closed;f.clean();}
});
