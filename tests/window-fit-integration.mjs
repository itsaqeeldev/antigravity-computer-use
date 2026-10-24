// Interactive native component regression, not a substitute for real-app QA.
// Pass an exact built bundle and NEW evidence folder. Uses only its owned target.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';import assert from 'node:assert/strict';
const [releaseArg,evidenceArg]=process.argv.slice(2);if(!releaseArg||!evidenceArg)throw Error('Pass exact bundle and NEW evidence folder; requires exclusive interactive desktop.');
const release=path.resolve(releaseArg),evidence=path.resolve(evidenceArg);if(fs.existsSync(evidence))throw Error('Preserve existing evidence.');fs.mkdirSync(evidence,{recursive:true});
const exe=path.join(evidence,'OffscreenTarget.exe'),csc=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const build=spawnSync(csc,['-nologo','-target:winexe','-r:System.Windows.Forms.dll','-r:System.Drawing.dll','-r:System.Web.Extensions.dll','-out:'+exe,fileURLToPath(new URL('./OffscreenWindowTarget.cs',import.meta.url))],{windowsHide:true,encoding:'utf8'});fs.writeFileSync(path.join(evidence,'compile.json'),JSON.stringify({status:build.status,stdout:build.stdout,stderr:build.stderr},null,2));assert.equal(build.status,0,'Owned fixture compilation failed');
process.env.AGCU_DATA_DIR=path.join(evidence,'data');delete process.env.CU_PLUGIN_DATA;delete process.env.CLAUDE_PLUGIN_DATA;
const {Runtime}=await import(pathToFileURL(path.join(release,'server/runtime.mjs')).href);const manifest=JSON.parse(fs.readFileSync(path.join(release,'bundle-manifest.json')));
const r=new Runtime({permissionMode:'host-managed'}),child=spawn(exe,[],{windowsHide:false,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',s=>stderr+=s);
const record={passed:false,fixture:true,build_id:manifest.build_id,native_sha:manifest.host_sha256,cases:[]};
try{
 const info=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Owned target startup timeout: '+stderr)),10000);child.once('error',reject);createInterface({input:child.stdout}).once('line',line=>{clearTimeout(t);try{resolve(JSON.parse(line));}catch(e){reject(e);}});});assert.equal(info.pid,child.pid);
 let discovered=false;for(let i=0;i<20&&!discovered;i++){discovered=(await r.driver.call('list_apps',{include_hidden:true})).result.windows.some(w=>w.hwnd===info.hwnd&&w.pid===info.pid);if(!discovered)await new Promise(resolve=>setTimeout(resolve,100));}assert(discovered,'The owned visible fixture must be discoverable');
 let s=await r.observe({hwnd:info.hwnd});assert(s.image.source[1]<0);fs.writeFileSync(path.join(evidence,'before.jpg'),Buffer.from(s.image.data,'base64'));
 const before=(await r.identity(info.hwnd)).cursor;const old=s.metadata.observation_id;
 await assert.rejects(r.action('move',{hwnd:info.hwnd,observation_id:old,x:Math.min(40,s.image.width-1),y:1,risk:'routine',reason:'Owned regression: refuse unreachable endpoint before cursor motion'}),e=>e.code==='point_off_desktop');assert.deepEqual((await r.identity(info.hwnd)).cursor,before);record.cases.push('unreachable move refused before cursor travel');
 s=await r.observe({hwnd:info.hwnd});const preDrag=(await r.identity(info.hwnd)).cursor;
 await assert.rejects(r.action('drag',{hwnd:info.hwnd,observation_id:s.metadata.observation_id,from:[Math.min(40,s.image.width-1),s.image.height-10],to:[Math.min(40,s.image.width-1),1],steps:12,risk:'routine',reason:'Owned regression: invalid drag endpoint must refuse before mouse down'}),e=>e.code==='point_off_desktop');assert.deepEqual((await r.identity(info.hwnd)).cursor,preDrag);
 const afterRejectedDrag=await r.observe({hwnd:info.hwnd,with_image:false});assert(afterRejectedDrag.metadata.tree.includes('downs:0'));record.cases.push('unreachable drag endpoint refused before movement or mouse down');
 s=await r.observe({hwnd:info.hwnd});const stale=s.metadata.observation_id;
 const fitted=await r.action('fit_window',{hwnd:info.hwnd,risk:'routine',reason:'Explicitly fit only the owned offscreen target',observe:{with_image:true}});assert(fitted.result.fully_visible);assert(!r.frames.has(stale));assert(fitted.metadata.observation_id!==stale);fs.writeFileSync(path.join(evidence,'after.jpg'),Buffer.from(fitted.image.data,'base64'));record.placement=fitted.result;record.cases.push('explicit fit returns fully visible bounds and fresh observation');
 const button=fitted.metadata.elements.find(n=>n.name==='Offscreen target');assert(button);
 await assert.rejects(r.action('click',{hwnd:info.hwnd,observation_id:stale,index:button.i,risk:'routine',reason:'Owned regression: stale pre-fit frame must refuse'}),e=>e.code==='stale_observation');
 const clicked=await r.action('click',{hwnd:info.hwnd,observation_id:fitted.metadata.observation_id,index:button.i,risk:'routine',reason:'Verify a fresh accessible control after fitting',observe:{with_image:false}});assert(clicked.metadata.tree.includes('presses:1'));record.cases.push('stale frame refused; fresh accessible control succeeds once');
 await r.finish();assert.equal(r.status().state,'idle');record.passed=true;
}catch(error){record.error={code:error.code,message:error.message,stack:error.stack};process.exitCode=1;}
finally{await r.finish().catch(()=>{});await r.close().catch(()=>{});child.kill();fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));}
