// Interactive real-application check, never unattended CI. Opens only its own
// Upscaly instance, inspects settings without modifying preferences, then closes.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const [releaseArg,evidenceArg,appArg]=process.argv.slice(2);if(!releaseArg||!evidenceArg||!appArg)throw Error('Pass exact bundle, NEW evidence folder and authorized Upscaly executable.');
const release=path.resolve(releaseArg),evidence=path.resolve(evidenceArg);if(fs.existsSync(evidence))throw Error('Preserve prior evidence.');fs.mkdirSync(evidence,{recursive:true});
process.env.AGCU_DATA_DIR=path.join(evidence,'data');delete process.env.CU_PLUGIN_DATA;delete process.env.CLAUDE_PLUGIN_DATA;
const {Runtime}=await import(pathToFileURL(path.join(release,'server/runtime.mjs')).href);const {call}=await import(pathToFileURL(path.join(release,'server/desktop-tools.mjs')).href);
const manifest=JSON.parse(fs.readFileSync(path.join(release,'bundle-manifest.json'))),r=new Runtime({permissionMode:'host-managed'});let hwnd;
const record={passed:false,actual_app:'Upscaly',build_id:manifest.build_id,native_sha:manifest.host_sha256,preferences_changed:false,cases:[]};
try{
 let s=await r.launch({app:path.resolve(appArg),observe:true,reason:'Authorized real-app test of observation-bound names'});hwnd=s.metadata?.hwnd;
 assert(hwnd,'Launch must return an unambiguous owned window; do not relaunch');
 const deadline=Date.now()+10000;
 while(!s.metadata.elements.some(n=>n.name==='Settings'&&n.role==='Button')){assert(Date.now()<deadline,'App readiness timed out');await new Promise(resolve=>setTimeout(resolve,250));s=await r.observe({hwnd});}
 fs.writeFileSync(path.join(evidence,'initial.jpg'),Buffer.from(s.image.data,'base64'));
 await assert.rejects(r.action('click',{hwnd,observation_id:s.metadata.observation_id,role:'Button',risk:'routine',reason:'Ambiguous role must refuse'}),e=>e.code==='ambiguous_observed_target');record.cases.push('ambiguous observed role refused');
 s=await r.observe({hwnd});await assert.rejects(r.action('click',{hwnd,observation_id:s.metadata.observation_id,name:'No such control 927',risk:'routine',reason:'Missing control must refuse'}),e=>e.code==='target_not_observed');record.cases.push('missing name refused');
 s=await r.observe({hwnd});const started=performance.now();
 const done=await call(r,'computer_run',{hwnd,observation_id:s.metadata.observation_id,reason:'Open then close observed settings without preference changes',steps:[{kind:'click',name:'Settings',role:'Button',risk:'routine',observe:{max_nodes:500}},{kind:'click',name:'Close settings',role:'Button',risk:'routine'}]});
 assert.equal(done.batch?.completed.length,2);assert(!done.verification_error);assert(!done.metadata.elements.some(n=>n.name==='Close settings'));
 record.batch_elapsed_ms=Math.round(performance.now()-started);record.cases.push('name-based batch follows fresh changed layout and closes settings');
 fs.writeFileSync(path.join(evidence,'after.jpg'),Buffer.from(done.image.data,'base64'));
 await r.action('close_window',{hwnd,reason:'Close only the owned real-app selector test instance'});hwnd=null;await r.finish();assert.equal(r.status().state,'idle');record.passed=true;
}catch(error){record.error={code:error.code,message:error.message,stack:error.stack};process.exitCode=1;}
finally{if(hwnd)await r.action('close_window',{hwnd,reason:'Clean up only the owned selector test instance'}).catch(()=>{});await r.finish().catch(()=>{});await r.close().catch(()=>{});fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));}
