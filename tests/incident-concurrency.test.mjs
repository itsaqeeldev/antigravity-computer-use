import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {spawn} from 'node:child_process';import {pathToFileURL} from 'node:url';import {testDirectory} from './paths.mjs';
import {storageOperation} from '../server/storage.mjs';import {Incidents} from '../server/incidents.mjs';
import {acquireServiceLease} from '../server/service-lease.mjs';

test('independent incident writers serialize read and publication',async t=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'incident-writers-'));let children=[];
 try{
  try{storageOperation('data',dir);}catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){t.skip('native private storage refused: '+error.code);return;}throw error;}
  const mod=pathToFileURL(path.resolve('server/incidents.mjs')).href;
  const source=`import fs from 'node:fs';import {Incidents} from ${JSON.stringify(mod)};
const old=Incidents.prototype.prepare;Incidents.prototype.prepare=function(...args){const result=old.apply(this,args);if(process.argv[2]==='hold'){console.log('held');let b=Buffer.alloc(1);fs.readSync(0,b,0,1,null);}return result;};
await new Incidents(${JSON.stringify(dir)}).recordSerialized(process.argv[1],{error:{code:'guardian_exited'}});console.log('done');`;
  const make=(op,hold)=>{const c=spawn(process.execPath,['--input-type=module','-e',source,op,hold],{stdio:['pipe','pipe','pipe'],windowsHide:true});let output='';c.stdout.on('data',v=>output+=v);c.stderr.on('data',v=>output+=v);const done=new Promise(resolve=>c.once('close',code=>resolve({code,output})));children.push({c,done});return {c,done,get output(){return output;}};};
  const first=make('computer_ready','hold');const until=Date.now()+10000;while(!first.output.includes('held')&&first.c.exitCode===null&&Date.now()<until)await new Promise(r=>setTimeout(r,20));assert(first.output.includes('held'),first.output);
  const second=make('computer_startup','normal');await new Promise(r=>setTimeout(r,400));assert.equal(second.c.exitCode,null,'second writer must wait while first owns the lease');
  first.c.stdin.end('x');const results=await Promise.all([first.done,second.done]);assert.deepEqual(results.map(x=>x.code),[0,0],JSON.stringify(results));
  assert.deepEqual(new Incidents(dir).read().map(x=>x.operation).sort(),['computer_ready','computer_startup']);
  const interrupted=make('computer_guardian','hold');const limit=Date.now()+10000;while(!interrupted.output.includes('held')&&interrupted.c.exitCode===null&&Date.now()<limit)await new Promise(r=>setTimeout(r,20));assert(interrupted.output.includes('held'),interrupted.output);
  interrupted.c.kill();await interrupted.done;const next=make('computer_snapshot','normal');const recovered=await next.done;assert.equal(recovered.code,0,recovered.output);
  assert.deepEqual(new Incidents(dir).read().map(x=>x.operation).sort(),['computer_ready','computer_snapshot','computer_startup']);
  const same1=make('computer_ready','normal'),same2=make('computer_ready','normal');const repeated=await Promise.all([same1.done,same2.done]);assert.deepEqual(repeated.map(x=>x.code),[0,0],JSON.stringify(repeated));
  assert.equal(new Incidents(dir).read().find(x=>x.operation==='computer_ready').count,3);
 }finally{for(const {c} of children)if(c.exitCode===null&&c.signalCode===null)c.kill();await Promise.all(children.map(({done})=>done));fs.rmSync(dir,{recursive:true,force:true});}
});

test('a killed lease helper cannot publish a stale incident journal',async t=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'incident-helper-death-'));let oldLease,newLease;const originalKill=process.kill;
 try{
  try{storageOperation('data',dir);}catch(error){if(['storage_unsafe_ancestor','insecure_storage_ancestor','storage_permissions_conflict'].includes(error.code)){t.skip('native private storage refused: '+error.code);return;}throw error;}
  const lock=path.join(dir,'incident-writer-lease');fs.mkdirSync(lock);oldLease=await acquireServiceLease(lock);
  let killed=false;process.kill=(pid,signal)=>{if(pid===oldLease.pid&&signal===0&&!killed){killed=true;originalKill(pid);return true;}return originalKill(pid,signal);};
  try{await assert.rejects(oldLease.publishIncidents(Buffer.from('[{"old":true}]')),e=>['incident_publish_outcome_unknown','service_ownership_lost'].includes(e.code));}finally{process.kill=originalKill;}
  await oldLease.release();oldLease=null;newLease=await acquireServiceLease(lock);await newLease.publishIncidents(Buffer.from('[{"new":true}]'));await newLease.release();newLease=null;
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'incidents.json'))),[{new:true}]);
 }finally{process.kill=originalKill;if(oldLease)await oldLease.release();if(newLease)await newLease.release();fs.rmSync(dir,{recursive:true,force:true});}
});
