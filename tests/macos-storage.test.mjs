import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {testDirectory} from './paths.mjs';
import {ensureStorageGuard,storageOperation} from '../server/storage.mjs';
import {acquireServiceLease} from '../server/service-lease.mjs';
const native=process.platform==='darwin'?test:test.skip;
native('Mac preparation waits for complete marker publication and handles concurrent first creation',async()=>{
 const base=testDirectory('mac-prepare-race'),directory=fs.mkdtempSync(path.join(base,'run-')),root=path.join(directory,'data'),writerFile=path.join(directory,'MarkerWriter');
 fs.mkdirSync(root,{mode:0o700});
 const compiled=spawnSync('/usr/bin/swiftc',['-parse-as-library',fileURLToPath(new URL('./MacStorageMarkerWriter.swift',import.meta.url)),'-o',writerFile],{encoding:'utf8',timeout:30000});
 assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
 const helper=ensureStorageGuard(),parentMode=fs.statSync(directory).mode;
 function child(exe,args){
  const process=spawn(exe,args,{stdio:['pipe','pipe','pipe']});let stdout='',stderr='',finished=false;
  process.stdout.on('data',data=>stdout+=data);process.stderr.on('data',data=>stderr+=data);
  const done=new Promise((resolve,reject)=>{process.once('error',reject);process.once('close',code=>{finished=true;resolve({code,stdout,stderr});});});
  return {process,done,get finished(){return finished;},get stdout(){return stdout;}};
 }
 const writer=child(writerFile,[root]);let preparer;
 try{
  const until=Date.now()+5000;while(!writer.stdout.includes('marker-open')&&Date.now()<until&&!writer.finished)await new Promise(resolve=>setTimeout(resolve,10));
  assert(writer.stdout.includes('marker-open'),'the inert producer must hold an unfinished marker');
  preparer=child(helper,['data',root]);
  await new Promise(resolve=>setTimeout(resolve,750));
  assert.equal(preparer.finished,false,'a concurrent preparer must wait, not reject or trust an incomplete marker');
  writer.process.stdin.end('commit\n');assert.equal((await writer.done).code,0);
  const result=await preparer.done;assert.equal(result.code,0,result.stdout+result.stderr);
  assert.equal(storageOperation('verify-tree',root,{helper}).private_storage,true);
  for(let round=0;round<3;round++){
   const fresh=path.join(directory,'fresh-'+round),attempts=Array.from({length:8},()=>child(helper,['data',fresh]));
   const results=await Promise.all(attempts.map(attempt=>attempt.done));
   for(const result of results)assert.equal(result.code,0,result.stdout+result.stderr);
   assert.equal(storageOperation('verify-tree',fresh,{helper}).private_storage,true);
  }
  assert.equal(fs.statSync(directory).mode,parentMode,'parent permissions must remain unchanged');
 }finally{
  if(!writer.process.stdin.destroyed)writer.process.stdin.end('commit\n');
  if(preparer&&!preparer.finished)preparer.process.kill();
  await Promise.allSettled([writer.done,...(preparer?[preparer.done]:[])]);
 }
});
native('Mac private storage refuses links, unsafe parents and extended Allow ACLs without changing parents',()=>{
 const base=testDirectory('mac-private-storage'),helper=ensureStorageGuard();fs.chmodSync(base,0o700);
 const privateDir=path.join(base,'private');storageOperation('data',privateDir,{helper});
 assert.equal(fs.statSync(privateDir).mode&0o777,0o700);
 const link=path.join(base,'link');if(!fs.existsSync(link))fs.symlinkSync(privateDir,link);
 assert.throws(()=>storageOperation('verify',link,{helper}));
 const unsafe=path.join(base,'unsafe');fs.mkdirSync(unsafe,{recursive:true});fs.chmodSync(unsafe,0o777);
 try {assert.throws(()=>storageOperation('data',path.join(unsafe,'child'),{helper}),e=>e.code==='storage_unsafe_ancestor');assert.equal(fs.statSync(unsafe).mode&0o777,0o777);}
 finally {fs.chmodSync(unsafe,0o700);}
 const acl=spawnSync('/bin/chmod',['+a','everyone allow read',privateDir],{encoding:'utf8'});assert.equal(acl.status,0,acl.stderr);
 try {assert.throws(()=>storageOperation('verify',privateDir,{helper}),e=>e.code==='storage_unsafe_acl');}
 finally {assert.equal(spawnSync('/bin/chmod',['-a','everyone allow read',privateDir]).status,0);}
 storageOperation('verify-tree',privateDir,{helper});
});
native('Mac source storage refuses an invalid marker hard link without changing its target',()=>{
 const base=testDirectory('mac-source-marker'),parent=fs.mkdtempSync(path.join(base,'run-'));
 const root=path.join(parent,'.localdata'),target=path.join(parent,'unrelated.txt');
 fs.writeFileSync(path.join(parent,'package.json'),JSON.stringify({name:'antigravity-native-computer-use'}));
 fs.mkdirSync(root,{mode:0o700});fs.writeFileSync(target,'unrelated data',{mode:0o600});
 fs.linkSync(target,path.join(root,'.agcu-private-storage'));
 fs.writeFileSync(path.join(root,'existing-evidence.txt'),'keep',{mode:0o600});
 try{
  assert.throws(()=>storageOperation('data',root,{helper:ensureStorageGuard()}));
  assert.equal(fs.readFileSync(target,'utf8'),'unrelated data');
 }finally{fs.rmSync(parent,{recursive:true,force:true});}
});
native('Mac kernel lease has one owner and reports directory replacement as ownership loss',async()=>{
 const base=testDirectory('mac-lease'),dir=path.join(base,'data'),helper=ensureStorageGuard();fs.chmodSync(base,0o700);
 storageOperation('data',dir,{helper});const first=await acquireServiceLease(dir);
 try {
  await assert.rejects(acquireServiceLease(dir),e=>e.code==='service_already_running');
  const renamed=dir+'-moved';fs.renameSync(dir,renamed);fs.mkdirSync(dir,{mode:0o700});
  try {
   await new Promise((resolve,reject)=>{if(first.lost)return resolve();const timer=setTimeout(()=>reject(Error('Lease did not detect replacement')),3000);first.once('lost',()=>{clearTimeout(timer);resolve();});});
   assert.throws(()=>first.assertHeld(),e=>e.code==='service_ownership_lost');
  } finally {await first.release();fs.rmdirSync(dir);fs.renameSync(renamed,dir);}
 }finally{await first.release();}
 const next=await acquireServiceLease(dir);await next.release();
});
