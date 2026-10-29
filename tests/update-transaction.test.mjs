// Exercise the real updater and installer; only native storage and service calls
// are inert. No live home, installation, network or desktop is touched.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {install} from '../scripts/install.mjs';import {rollback} from '../scripts/rollback.mjs';import {update} from '../scripts/update.mjs';
import {sha256,newerVersion,updateSettings} from '../server/update-core.mjs';import {nativePlatform} from '../server/platform.mjs';import {testDirectory} from './paths.mjs';
function fixture(){
 const directory=fs.mkdtempSync(path.join(testDirectory('tmp'),'update-transaction-')),target=path.join(directory,'installed'),home=path.join(directory,'home');
 const native=nativePlatform(),storage=()=>({ok:true,private_storage:true});
 const createBundle=(name,version)=>{
  const bundle=path.join(directory,name);fs.mkdirSync(bundle,{recursive:true});
  const data={[native.node]:'inert node fixture',['bin/'+native.host]:'inert host fixture',['bin/'+native.storage]:'inert storage fixture','skills/computer-use/SKILL.md':'Use {{DESKTOP_COMMAND}} ready '+version,'scripts/desktop.mjs':'inert CLI fixture'};
  for(const [name,bytes]of Object.entries(data)){const file=path.join(bundle,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  const files=Object.fromEntries(Object.entries(data).map(([name,bytes])=>[name,sha256(bytes)]));const build_id=sha256(JSON.stringify(files));
  fs.writeFileSync(path.join(bundle,'bundle-manifest.json'),JSON.stringify({version,build_id,platform:process.platform,arch:process.arch,files}));return {bundle,build_id};
 };
 const old=createBundle('old','1.0.0'),fresh=createBundle('fresh','1.1.0');
 const installer=options=>install({home,prepareStorage:storage,...options});
 installer({bundle:old.bundle,target,sidecar:true});
 const {privateKey,publicKey}=generateKeyPairSync('ed25519'),keyFile=path.join(directory,'public.pem');fs.writeFileSync(keyFile,publicKey.export({type:'spki',format:'pem'}));
 const payload={};const files={};const walk=folder=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else {const name=path.relative(fresh.bundle,file).replaceAll('\\','/'),bytes=fs.readFileSync(file),url='https://github.com/shayann07/antigravity-computer-use/releases/download/v1.1.0/'+sha256(bytes);files[name]={size:bytes.length,sha256:sha256(bytes),url};payload[url]=bytes;}}};walk(fresh.bundle);
 const bytes=Buffer.from(JSON.stringify({schema:1,version:'1.1.0',build_id:fresh.build_id,platform:process.platform,arch:process.arch,sequence:2,min_os:'0.0.0',expires:'2099-01-01',files}));
 const envelope={manifest:bytes.toString('base64'),signature:sign(null,bytes,privateKey).toString('base64')};let fetches=0,state='idle',failHealth=false;const calls=[];
 const adapters={storage,install:installer,keyFile,rollback,prepare:async()=>({prepared:true}),cli(record,args){calls.push(args[0]);if(args[0]==='shutdown'){state='not_running';return {ok:true};}if(args[0]==='start'){const b=JSON.parse(fs.readFileSync(path.join(record.release,'bundle-manifest.json')));if(failHealth&&b.build_id===fresh.build_id)throw Error('native health fixture failure');state='idle';return {state,build_id:b.build_id};}return {state,approved_apps:[]};}};
 const fetcher=async url=>{fetches++;if(url.includes('api.github.com'))return {ok:true,json:async()=>({assets:[{name:`update-${process.platform}-${process.arch}.json`,browser_download_url:'metadata'}]})};if(url==='metadata')return {ok:true,text:async()=>JSON.stringify(envelope)};return {ok:true,body:(async function*(){yield payload[url];})()};};
 return {directory,target,home,old,fresh,adapters,fetcher,calls,setState:v=>state=v,setFailHealth:()=>failHealth=true,fetches:()=>fetches,cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
test('signed full-bundle update preserves settings and Stop, then rollback restores old pins',async()=>{
 const f=fixture();try{
  const config=path.join(f.home,'.gemini/config/config.json');const before=JSON.parse(fs.readFileSync(config));before.unrelated={keep:true};fs.writeFileSync(config,JSON.stringify(before));
  fs.mkdirSync(path.join(f.target,'data'),{recursive:true});fs.writeFileSync(path.join(f.target,'data/emergency.stop'),'stopped');
  await update(f.target,'check',f);assert((await update(f.target,'status',f)).available);
  const result=await update(f.target,'apply',f);assert(result.applied);const current=JSON.parse(fs.readFileSync(path.join(f.target,'installation.json')));assert.equal(JSON.parse(fs.readFileSync(path.join(current.release,'bundle-manifest.json'))).build_id,f.fresh.build_id);
  assert(fs.existsSync(path.join(f.target,'data/emergency.stop')));assert(JSON.parse(fs.readFileSync(config)).unrelated.keep);assert.equal(updateSettings(f.target).mode,'automatic');
  assert((await update(f.target,'rollback',f)).rolled_back);const restored=JSON.parse(fs.readFileSync(path.join(f.target,'installation.json')));assert.equal(JSON.parse(fs.readFileSync(path.join(restored.release,'bundle-manifest.json'))).build_id,f.old.build_id);
 }finally{f.cleanup();}
});
test('active and paused tasks defer before shutdown or installation',async()=>{
 const f=fixture();try{await update(f.target,'check',f);for(const state of ['active','paused']){f.setState(state);assert((await update(f.target,'apply',f)).deferred);}assert(!f.calls.includes('shutdown'));}finally{f.cleanup();}
});
test('new service health failure rolls back actual installer changes and restarts prior build',async()=>{
 const f=fixture();try{await update(f.target,'check',f);f.setFailHealth();await assert.rejects(update(f.target,'apply',f),/native health fixture failure/);const restored=JSON.parse(fs.readFileSync(path.join(f.target,'installation.json')));assert.equal(JSON.parse(fs.readFileSync(path.join(restored.release,'bundle-manifest.json'))).build_id,f.old.build_id);assert.equal((await update(f.target,'status',f)).last_error,'update_rolled_back');}finally{f.cleanup();}
});
test('daily scheduler throttles checks and manual mode performs no network work',async()=>{
 const f=fixture();try{fs.writeFileSync(path.join(f.target,'update-settings.json'),JSON.stringify({mode:'notify',channel:'stable',reporting:false}));await update(f.target,'scheduled',f);const first=f.fetches();await update(f.target,'scheduled',f);assert.equal(f.fetches(),first);fs.writeFileSync(path.join(f.target,'update-settings.json'),JSON.stringify({mode:'manual',channel:'stable',reporting:false}));await update(f.target,'scheduled',f);assert.equal(f.fetches(),first);}finally{f.cleanup();}
});
test('version ordering blocks downgrade and respects numeric prerelease segments',()=>{assert(!newerVersion('1.0.0','2.0.0'));assert(newerVersion('1.0.0-beta.10','1.0.0-beta.2'));assert(newerVersion('1.0.0','1.0.0-beta.10'));assert(!newerVersion('1.0.0-beta.2','1.0.0'));});
test('corrupted staged bundle is refused before any service shutdown',async()=>{
 const f=fixture();try{await update(f.target,'check',f);const state=await update(f.target,'status',f);fs.appendFileSync(path.join(state.staged,'scripts/desktop.mjs'),'tamper');await assert.rejects(update(f.target,'apply',f),/release_payload_mismatch/);assert(!f.calls.includes('shutdown'));}finally{f.cleanup();}
});
test('offline checks retain the working installation and throttle scheduled retries',async()=>{
 const f=fixture();try{let attempts=0;const offline={...f,fetcher:async()=>{attempts++;throw Error('network_failure');}};await update(f.target,'scheduled',offline);await update(f.target,'scheduled',offline);assert.equal(attempts,1);assert(!f.calls.includes('shutdown'));assert.equal((await update(f.target,'status',f)).last_error,'network_failure');}finally{f.cleanup();}
});
test('explicit install update preferences and reporting consent survive upgrades',()=>{
 const f=fixture();try{f.adapters.install({bundle:f.fresh.bundle,target:f.target,updateMode:'manual',updateChannel:'beta',reporting:true});f.adapters.install({bundle:f.fresh.bundle,target:f.target});assert.deepEqual(updateSettings(f.target),{mode:'manual',channel:'beta',reporting:true});}finally{f.cleanup();}
});
