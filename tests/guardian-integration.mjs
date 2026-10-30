import {testDirectory} from './paths.mjs';
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {Guardian} from '../server/guardian.mjs';import {Driver} from '../server/driver.mjs';
const dir=fs.mkdtempSync(path.join(testDirectory('guardian-test'),'run-'));const file=path.join(dir,'guard.state');fs.writeFileSync(file,'idle||0|');fs.writeFileSync(file+'.inputs','');
const env={AGCU_GUARD_FILE:file,AGCU_PARENT_PID:String(process.pid),AGCU_REAL_CURSOR:'1',CU_OVERLAY:'off',CU_PRESENCE:'off'};
const g=new Guardian(env);const d=new Driver({env});
try{
 await g.start();assert(g.pid);assert.equal(g.state,'idle');
 await d.start();const originalWorker=d.info.pid;g.send({op:'attach',pid:originalWorker});
 const active=await g.request({op:'activate',token:'visual-test-no-apps',deadline:(BigInt(Date.now()+30000)*10000n+621355968000000000n).toString()});assert(active.allowed);
 await new Promise(r=>setTimeout(r,500));
 const csc=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');const probe=path.join(dir,'StopProbe.exe');
 const built=spawnSync(csc,['-nologo','-out:'+probe,path.resolve('tests/StopProbe.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(built.status,0,built.stdout+built.stderr);
 spawnSync(probe,[],{windowsHide:true});
 await new Promise(r=>setTimeout(r,600));assert.equal(g.state,'stopped');assert(fs.readFileSync(file,'utf8').startsWith('stopped|'));
 assert.throws(()=>process.kill(originalWorker,0),'Native guardian must terminate its registered worker');
 await assert.rejects(d.call('snapshot',{hwnd:123,__session:'visual-test-no-apps'}));
 const result={passed:true,checks:['native permission/control UI started','native glow session activated without app grants','global emergency-stop chord latched in native runtime','native state invalidated independently','registered input worker terminated'],human_approval_granted:false,physical_Esc_tested:false};
 fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{g.close();await d.abort();}
