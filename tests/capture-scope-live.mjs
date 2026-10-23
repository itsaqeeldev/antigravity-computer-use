// Native old/new regression only; not an application-workflow acceptance demo.
// No input is injected. The second process is never granted to the controller.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';import {pathToFileURL} from 'node:url';
const [releaseArg,evidenceArg,expectation='private']=process.argv.slice(2);
const release=path.resolve(releaseArg),evidence=path.resolve(evidenceArg);fs.mkdirSync(evidence,{recursive:true});
process.env.AGCU_DATA_DIR=path.join(evidence,'runtime');
const {Runtime}=await import(pathToFileURL(path.join(release,'server/runtime.mjs')));
const exe=path.join(evidence,'CaptureScopeTarget.exe');
const csc=path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe');
const built=spawnSync(csc,['-nologo','-r:System.Windows.Forms.dll','-r:System.Drawing.dll','-r:System.Web.Extensions.dll','-out:'+exe,path.resolve('tests/CaptureScopeTarget.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(built.status,0,built.stdout+built.stderr);
const children=[];const open=(role,x,y)=>new Promise((resolve,reject)=>{
 const p=spawn(exe,[role,String(x),String(y)],{windowsHide:true,stdio:['ignore','pipe','pipe']});children.push(p);
 const timer=setTimeout(()=>reject(Error('Owned capture target did not start')),15000);p.on('error',reject);
 createInterface({input:p.stdout}).once('line',line=>{clearTimeout(timer);resolve(JSON.parse(line));});
});
const runtime=new Runtime({permissionMode:'host-managed'});const record={passed:false,expected:expectation,kind:'native capture privacy regression; two isolated test processes'};
try{
 const target=await open('target',280,180);const cover=await open('cover',target.rect[0]+80,target.rect[1]+110);
 record.target=target;record.cover=cover;
 await new Promise(resolve=>setTimeout(resolve,300));
 const observed=await runtime.observe({hwnd:target.hwnd,max_width:1200});assert.equal(runtime.grants.size,1);
 const listed=(await runtime.driver.call('list_apps',{include_hidden:true})).result.windows;
 const coverWindow=listed.find(window=>Number(window.hwnd)===cover.hwnd);assert(coverWindow?.rect,'Cover must remain visible for the native regression');
 const coverBounds=coverWindow.rect;record.native_cover=coverBounds;record.source=observed.image.source;
 const file=path.join(evidence,'capture.jpg');fs.writeFileSync(file,Buffer.from(observed.image.data,'base64'));
 const image=observed.image;const x=Math.floor((coverBounds[0]+coverBounds[2]/2-image.source[0])*image.width/image.source[2])-8;
 const y=Math.floor((coverBounds[1]+coverBounds[3]/2-image.source[1])*image.height/image.source[3])-8;
 const inspected=spawnSync(exe,['inspect',file,String(x),String(y)],{windowsHide:true,encoding:'utf8'});assert.equal(inspected.status,0,inspected.stderr);
 const pixels=JSON.parse(inspected.stdout);Object.assign(record,{capture:image.capture,blue_pixels:pixels.blue_pixels,only_target_granted:true,version:runtime.status().build_version});
 if(expectation==='leak')assert(pixels.blue_pixels>0,'Old capture did not reproduce the covering-window leak');
 else {assert.equal(pixels.blue_pixels,0,'Covering process pixels leaked into the target capture');assert.equal(image.capture,'window');}
 record.passed=true;
}catch(error){record.error=error.stack;process.exitCode=1;}
finally{await runtime.finish();await runtime.close();for(const p of children)p.kill();fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));}
