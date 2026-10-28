import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {testDirectory} from './paths.mjs';
import {ensureStorageGuard,storageOperation} from '../server/storage.mjs';
import {acquireServiceLease} from '../server/service-lease.mjs';
const native=process.platform==='darwin'?test:test.skip;
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
