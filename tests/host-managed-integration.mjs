import {testDirectory} from './paths.mjs';
// Real native components under operator-selected host authorization. The only
// target apps are fixtures created here. This does not test Antigravity's own
// permission engine or pretend a direct test invocation came from its model.
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import assert from 'node:assert/strict';
import {Runtime} from '../server/runtime.mjs';
const children=[];const checks=[];const evidence=testDirectory('host-managed');fs.mkdirSync(evidence,{recursive:true});
async function fixture(){
 const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('tools/make-target.ps1'),'-Right'],{windowsHide:false,stdio:['ignore','pipe','pipe']});children.push(p);
 return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Fixture startup timeout')),15000);createInterface({input:p.stdout}).on('line',l=>{try{const v=JSON.parse(l);if(v.hwnd){clearTimeout(t);resolve(v);}}catch{}});p.stderr.on('data',d=>process.stderr.write(d));});
}
const r=new Runtime({permissionMode:'host-managed'});const record={passed:false,host_engine_tested:false};
r.guardian.on('state',(state,reason)=>{(record.states??=[]).push({state,reason});});
function node(s,name){const n=s.metadata.elements.find(n=>n.name===name);assert(n,'Missing '+name);return n;}
function pixel(s,n,dx=.5,dy=.5){const im=s.image;return [Math.floor((n.rect[0]+n.rect[2]*dx-im.source[0])*im.width/im.source[2]),Math.floor((n.rect[1]+n.rect[3]*dy-im.source[1])*im.height/im.source[3])];}
try {
 const a=await fixture();let s=await r.observe({hwnd:a.hwnd});assert(s.image.data);checks.push('Native screenshot without a duplicate app popup');
 let hover=node(s,'Press Me');let hoverPoint=pixel(s,hover);record.hover_mapping={rect:hover.rect,image:s.image.source,size:[s.image.width,s.image.height],point:hoverPoint};
 s=await r.action('move',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,x:hoverPoint[0],y:hoverPoint[1],risk:'routine',reason:'Hover fixture without clicking'});
 assert.equal(s.result.clicked,false);assert(s.metadata.elements.some(n=>n.name==='idle'));checks.push('Real pointer hover does not click');
 let n=node(s,'Press Me');s=await r.action('click',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,index:n.i,risk:'routine',reason:'Invoke fixture button'});
 assert(s.metadata.elements.some(n=>n.name==='pressed:1'));checks.push('Accessible invoke verified');
 n=node(s,'Press Me');const [x,y]=pixel(s,n);s=await r.action('click',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,x,y,risk:'routine',reason:'Real pixel click in fixture'});
 assert(s.metadata.elements.some(n=>n.name==='pressed:2'));checks.push('Screenshot coordinates move the real pointer and click');
 n=node(s,'Name field');s=await r.action('set_value',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,index:n.i,text:'Hello دنیا 😀',risk:'routine',reason:'Unicode fixture text'});
 assert(s.metadata.elements.some(n=>n.text==='Hello دنیا 😀'));checks.push('Unicode and emoji round trip');
 n=node(s,'Name field');s=await r.action('type',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,index:n.i,text:' می\u200cخواهم',risk:'routine',reason:'Verify native Unicode packet typing into the actual focused edit'});
 assert(s.metadata.elements.some(n=>n.text?.includes('می\u200cخواهم')));checks.push('Native keyboard packets preserve joiners and complex-script text');
 const clipBefore=await r.action('clipboard',{risk:'sensitive',reason:'Remember clipboard text only in memory for restoration verification'});
 n=node(s,'Name field');s=await r.action('paste',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,index:n.i,text:' explicit paste 😀',risk:'sensitive',reason:'Verify the reused clipboard-preserving native paste'});
 assert(s.result.clipboard_restored);assert(s.metadata.elements.some(n=>n.text?.includes('explicit paste 😀')));checks.push('Explicit native paste restores the clipboard and verifies actual text');
 const clipAfter=await r.action('clipboard',{risk:'sensitive',reason:'Verify original clipboard text was restored'});assert.equal(clipBefore.result.text===clipAfter.result.text,true,'Original clipboard text must survive paste');
 n=node(s,'Pixel canvas');s=await r.action('drag',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,from:pixel(s,n,.15,.5),to:pixel(s,n,.85,.5),steps:12,risk:'routine',reason:'Drag on fixture pixel canvas'});
 assert(s.metadata.elements.some(n=>/^drag:[2-9]\d*$|^drag:1[0-9]+$/.test(n.name||'')));checks.push('Pixel canvas receives multiple drag events');
 n=node(s,'Notes');const pt=pixel(s,n);s=await r.action('scroll',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,x:pt[0],y:pt[1],amount:-3,risk:'routine',reason:'Scroll fixture notes'});
 assert(s.metadata.elements.some(n=>n.name==='wheel:-360'));assert(!s.result.cursor_restored);checks.push('Real wheel scroll delivered without cursor restoration');
 n=node(s,'Open dialog');s=await r.action('click',{hwnd:a.hwnd,observation_id:s.metadata.observation_id,index:n.i,risk:'routine',reason:'Open owned fixture dialog'});
 const wins=(await r.driver.call('list_apps')).result.windows;const dialog=wins.find(w=>w.title===`Owned Test Dialog ${a.pid}`);assert(dialog,'Owned dialog listed');
 let ds=await r.observe({hwnd:dialog.hwnd});assert(ds.metadata.elements.some(n=>n.name==='Owned dialog verified'));await r.action('close_window',{hwnd:dialog.hwnd,risk:'sensitive',reason:'Close disposable dialog'});checks.push('Owned dialog shares process grant');
 const b=await fixture();let second=await r.observe({hwnd:b.hwnd});assert(second.image.data);assert.equal(r.grants.size,2);checks.push('Two independent application identities in one task');
 await r.finish();assert.equal(r.state,'idle');await r.observe({hwnd:a.hwnd});await r.finish();checks.push('Second session without restarting runtime');
 await r.stop();await r.finish();assert.equal(r.state,'stopped');await assert.rejects(r.observe({hwnd:a.hwnd}),e=>e.code==='control_inactive');
 const denied=await r.guardian.request({op:'activate',token:'cannot-rearm',deadline:'3155378975999999999'});assert.equal(denied.allowed,false);checks.push('End and activate cannot bypass latched native stop');
 record.passed=true;
} catch(e){record.error=e.stack;record.hint=e.hint;const actual=/actual=(\d+)/.exec(e.hint||'');if(actual)record.obscuring_identity=await r.identity(Number(actual[1])).catch(()=>null);process.exitCode=1;}
finally {await r.close();for(const p of children)p.kill();record.checks=checks;fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));}
