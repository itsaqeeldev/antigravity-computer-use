// Real human grant/denial flow. No synthetic approval or test bypass.
import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {Runtime} from '../server/runtime.mjs';
const fixture=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('tools/make-target.ps1')],{windowsHide:false,stdio:['ignore','pipe','pipe']});
const info=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Fixture startup timeout')),15000);createInterface({input:fixture.stdout}).on('line',l=>{try{const o=JSON.parse(l);if(o.hwnd){clearTimeout(t);resolve(o);}}catch{}});});
const r=new Runtime();const record={human:true,passed:false,checks:[]};
try{
 await r.grant(info.hwnd,'Native acceptance test: APPROVE this disposable WinForms test window. It does not use a terminal or your files.');record.checks.push('Human approved app in native UI');
 let snap=await r.observe({hwnd:info.hwnd});record.checks.push('Real MCP-adapter observation and image');
 const edit=snap.metadata.elements.find(n=>n.name==='Name field');assert(edit);
 snap=await r.action('set_value',{hwnd:info.hwnd,observation_id:snap.metadata.observation_id,index:edit.i,text:'Antigravity native acceptance',risk:'routine',reason:'Enter sample text in disposable GUI'});
 assert(snap.metadata.elements.some(n=>n.text==='Antigravity native acceptance'));record.checks.push('Routine action runs without another prompt');
 const send=snap.metadata.elements.find(n=>n.name==='Send Payment');assert(send);
 let denied=false;
 try{await r.action('click',{hwnd:info.hwnd,observation_id:snap.metadata.observation_id,index:send.i,risk:'sensitive',reason:'DENIAL TEST: click the DENY button this time. This disposable fixture button only counts clicks; no payment or network operation exists.'});record.checks.push('Human approved sensitive action and native one-use permit executed');}
 catch(e){if(e.code!=='permission_denied')throw e;denied=true;record.checks.push('Human denied sensitive action; no input executed');}
 await r.finish();record.checks.push('Normal finish without server restart');record.denial_test_passed=denied;record.passed=denied;
}catch(e){record.error=e.message;console.error(e.stack);}
finally{await r.close();fixture.kill();fs.mkdirSync('.localdata/acceptance',{recursive:true});fs.writeFileSync('.localdata/acceptance/human.json',JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));}
