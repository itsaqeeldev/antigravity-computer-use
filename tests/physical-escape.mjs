// Requires a REAL human Esc key. Never injects a key or approves an application.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {ensureHost} from '../server/build.mjs';
import {Guardian} from '../server/guardian.mjs';import {Driver} from '../server/driver.mjs';
const dir=path.resolve('.localdata/physical-escape');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'guard.state');fs.writeFileSync(file,'idle||0|');
const env={AGCU_GUARD_FILE:file,AGCU_PARENT_PID:String(process.pid),CU_PRESENCE:'off',CU_OVERLAY:'off'};
const g=new Guardian(env);const d=new Driver({env});const record={passed:false,no_app_grants:true,pending:true,started_at:new Date().toISOString()};
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(record,null,2));
const probe=name=>{const file=path.join(dir,name+'.png');const p=spawnSync(ensureHost().exe,['--cursor-probe',file],{windowsHide:true});assert.equal(p.status,0);return fs.readFileSync(file);};
try{
 const baseline=probe('before');
 await g.start();await d.start();const pid=d.info.pid;g.send({op:'attach',pid});
 const wait=new Promise(resolve=>{g.on('state',(state,reason)=>{if(state==='stopped'&&reason==='escape')resolve();});});
 await g.request({op:'activate',token:'physical-escape-only',deadline:'3155378975999999999'});
 console.log('New custom visuals active until physical Esc. No app is approved and no app input is sent.');
 await wait;await new Promise(r=>setTimeout(r,200));assert.throws(()=>process.kill(pid,0));assert(fs.readFileSync(file,'utf8').startsWith('stopped|'));
 assert(probe('after').equals(baseline));record.cursor_restored=true;
 record.passed=true;record.physical_Esc=true;record.worker_terminated=true;console.log('Physical Esc invalidated native state, terminated input worker and restored Windows cursor.');
}catch(e){record.error=e.message;console.error(e.message);}
finally{g.close();await d.abort();record.pending=false;record.ended_at=new Date().toISOString();fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(record,null,2));}
