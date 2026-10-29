// Lifetime ownership for one controller per private data directory. The small
// existing Windows storage helper holds a kernel mutex until this pipe closes.
import {spawn} from 'node:child_process';import path from 'node:path';import {EventEmitter} from 'node:events';
import {ensureStorageGuard,storageOperation} from './storage.mjs';
export async function acquireServiceLease(directory,{spawnProcess=spawn,helper=ensureStorageGuard(),startupTimeout=5000,cleanupTimeout=2000}={}){
 const child=spawnProcess(helper,['lease',path.resolve(directory)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdout.setEncoding('utf8');
 const lease=new EventEmitter();let ready=false,releasing=false,settled=false,buffer='',releasePending;
 let resolveExit;const exited=new Promise(resolve=>resolveExit=resolve);
 child.once('close',resolveExit);
 lease.pid=child.pid;lease.lost=false;
 const ownershipError=()=>Object.assign(Error('Controller ownership helper is unavailable. Control must stop.'),{code:'service_ownership_lost'});
 const markLost=()=>{if(!lease.lost){lease.lost=true;lease.emit('lost',ownershipError());}};
 lease.assertHeld=()=>{if(releasing||lease.lost||child.exitCode!==null){markLost();throw ownershipError();}try{process.kill(child.pid,0);}catch{markLost();throw ownershipError();}};
 const startup=new Promise((resolve,reject)=>{
  const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);releasing=true;try{child.kill();}catch{}
   // A killed helper may still hold the directory until Windows reaps it.
   // Wait for termination before the caller attempts recovery or cleanup.
   let wait;Promise.race([exited.then(()=>true),new Promise(resolve=>{wait=setTimeout(()=>resolve(false),cleanupTimeout);})]).then(closed=>{clearTimeout(wait);reject(closed?error:Object.assign(Error('Ownership helper termination could not be confirmed. Do not start another controller.'),{code:'service_lease_cleanup_unconfirmed',cause:error}));});};
  const timer=setTimeout(()=>fail(Object.assign(Error('Controller ownership helper did not answer; no controller was started.'),{code:'service_lease_timeout'})),startupTimeout);
  child.on('error',error=>fail(error));child.stderr.on('data',()=>{});
  child.stdin.on('error',()=>{});
  child.stdout.on('data',chunk=>{
   if(ready||settled)return;buffer+=chunk;if(buffer.length>8192)return fail(Error('Invalid ownership-helper reply.'));
   if(!buffer.includes('\n'))return;
   try{const result=JSON.parse(buffer.slice(0,buffer.indexOf('\n')));if(!result.ok)throw Object.assign(Error(result.error?.message||'Controller ownership refused.'),{code:result.error?.code||'service_lease_refused'});if(!result.lease_acquired)throw Error('Missing controller ownership acknowledgement.');clearTimeout(timer);settled=true;ready=true;resolve(lease);}catch(error){fail(error);}
  });
  child.once('exit',code=>{
   resolveExit(code);
   if(!ready){fail(Object.assign(Error('Controller ownership helper exited before readiness.'),{code:'service_lease_exited'}));return;}
   if(!releasing)markLost();
  });
 });
 lease.release=()=>releasePending??=(async()=>{releasing=true;child.stdin.end();let timer;await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(()=>{child.kill();resolve();},2000);})]);clearTimeout(timer);})();
 const held=await startup;
 try{storageOperation('data',directory,{helper});held.assertHeld();return held;}
 catch(error){await held.release();throw error;}
}
