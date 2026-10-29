import {testDirectory} from './paths.mjs';
// Explicit native component test. Grants are a FIXTURE TEST DOUBLE, not human consent.
// It only authorizes its own throwaway WinForms target. No production auto-approval mode exists.
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import assert from 'node:assert/strict';
import {Driver} from '../server/driver.mjs';
const evidence=testDirectory('native-evidence');fs.mkdirSync(evidence,{recursive:true});
const guard=path.join(evidence,'fixture.state');const token='native-fixture-'+process.pid;
const deadline=(BigInt(Date.now()+60000)*10000n+621355968000000000n).toString();
fs.writeFileSync(guard,'idle||0|');
const fixture=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('tools/make-target.ps1')],{windowsHide:false,stdio:['ignore','pipe','pipe']});
const info=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Fixture did not start')),15000);createInterface({input:fixture.stdout}).on('line',l=>{try{const v=JSON.parse(l);if(v.title){clearTimeout(t);resolve(v);}}catch{}});fixture.stderr.on('data',d=>process.stderr.write(d));});
const d=new Driver({env:{AGCU_GUARD_FILE:guard,AGCU_PARENT_PID:String(process.pid),AGCU_REAL_CURSOR:'1',CU_OVERLAY:'off',CU_PRESENCE:'off',CU_MODE:'take'}});
const results=[];let hwnd;
try{
 let w; for(let attempt=0;attempt<20&&!w;attempt++){const windows=(await d.call('list_apps')).result.windows;w=windows.find(w=>w.title===info.title);if(!w)await new Promise(r=>setTimeout(r,250));}assert(w,'Fixture must be returned');hwnd=w.hwnd;
 const identity=(await d.call('identity',{hwnd})).result;
 const fields={hwnd,__session:token,__pid:identity.pid,__started:identity.started,__risk:'routine',mode:'take'};
 await assert.rejects(d.call('snapshot',fields),e=>e.code==='control_stopped');results.push('Native rejects inactive session');
 fs.writeFileSync(guard,'active|'+token+'|'+deadline+'|'+Buffer.from(identity.key).toString('base64'));
 const snap=(await d.call('snapshot',fields)).result;assert(snap.nodes.length>3);results.push('Native UIA tree');
 const disabled=snap.nodes.find(n=>n.name==='Disabled');assert(disabled);
 const beforeDisabled=(await d.call('identity',{hwnd})).result.cursor;
 await assert.rejects(d.call('click',{...fields,snapshot_id:snap.snapshot_id,index:disabled.i,physical:true}),e=>e.code==='element_disabled');
 assert.deepEqual((await d.call('identity',{hwnd})).result.cursor,beforeDisabled);results.push('Disabled selector refuses before moving the cursor');
 const button=snap.nodes.find(n=>n.name==='Press Me');assert(button);
 await d.call('click',{...fields,snapshot_id:snap.snapshot_id,index:button.i});
 await d.call('focus',fields);
 const real=(await d.call('click',{...fields,snapshot_id:snap.snapshot_id,index:button.i,physical:true})).result;
 assert(!real.cursor_restored);const moved=(await d.call('identity',{hwnd})).result.cursor;assert(moved[0]>=button.rect[0]&&moved[0]<=button.rect[0]+button.rect[2],JSON.stringify({moved,button:button.rect,real}));results.push('REAL cursor physical click without restore');
 const after=(await d.call('snapshot',fields)).result;assert(after.nodes.some(n=>String(n.name).includes('pressed:2')));results.push('UIA invoke verified in app');
 const edit=after.nodes.find(n=>n.role==='Edit');assert(edit);
 await d.call('set_value',{...fields,snapshot_id:after.snapshot_id,index:edit.i,text:'Hello دنیا 😀'});
 const typed=(await d.call('snapshot',fields)).result;assert(typed.nodes.some(n=>String(n.text).includes('دنیا')));results.push('Unicode field value verified');
 const pic=(await d.call('screenshot',{...fields,max_width:900})).result;assert(pic.width>0&&pic.height>0&&pic.source.length===4);fs.writeFileSync(path.join(evidence,'fixture.jpg'),Buffer.from(pic.data,'base64'));results.push('Native screenshot and physical coordinate source');
 await assert.rejects(d.call('key',{...fields,keys:'enter'}),e=>e.code==='confirmation_required');results.push('Native escalates Enter despite routine label');
 await assert.rejects(d.call('clipboard',{__session:token,__risk:'routine',__permit:'0'.repeat(32)}),e=>e.code==='confirmation_required');results.push('Native rejects forged action approval');
 await assert.rejects(d.call('type',{...fields,__started:'1',text:'must not type'}),e=>e.code==='identity_changed');results.push('Native process identity revalidation');
 await d.start();const timeoutWorker=d.info.pid;
 await assert.rejects(d.call('wait_for',{...fields,selector:{name:'A fixture control that does not exist'},timeout_ms:8000},{timeoutMs:150}),e=>e.code==='op_timeout');
 await d.abort();assert.throws(()=>process.kill(timeoutWorker,0));results.push('Timed-out native operation terminated; no worker left running');
 fs.writeFileSync(guard,'paused|'+token+'|'+deadline+'|'+Buffer.from(identity.key).toString('base64'));
 await assert.rejects(d.call('key',{...fields,keys:'ctrl+a'}),e=>e.code==='control_stopped');results.push('Native pause invalidates later input');
 fs.writeFileSync(guard,'active|'+token+'|'+deadline+'|');
 await assert.rejects(d.call('snapshot',fields),e=>e.code==='app_not_approved');results.push('Native denies revoked app');
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({passed:true,checks:results,human_consent_tested:false},null,2));console.log(JSON.stringify({passed:results.length,checks:results},null,2));
}finally{await d.abort();fixture.kill();}
