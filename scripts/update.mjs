import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
import {install} from './install.mjs';import {storageOperation} from '../server/storage.mjs';
import {verifyRelease,verifyStaged,downloadFile,updateSettings,acquireUpdateLock,newerVersion} from '../server/update-core.mjs';
import {nativePlatform} from '../server/platform.mjs';
import {randomUUID} from 'node:crypto';
import {diagnostics} from './diagnostics.mjs';
import {acquireServiceLease} from '../server/service-lease.mjs';
import {request} from './desktop.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function update(target,command,{fetcher=fetch,adapters={}}={}){
 // Only imported tests inject inert native/installer boundaries; no CLI/env bypass.
 const storage=adapters.storage||storageOperation,installer=adapters.install||install;
 target=path.resolve(target);storage('verify',target);
 const installed=JSON.parse(fs.readFileSync(path.join(target,'installation.json')));
 const bundle=JSON.parse(fs.readFileSync(path.join(installed.release,'bundle-manifest.json')));
 const settings=updateSettings(target,bundle.version),stateFile=path.join(target,'update-state.json');
 const read=()=>{try{return JSON.parse(fs.readFileSync(stateFile));}catch{return {};}};
 const save=v=>{fs.writeFileSync(stateFile+'.tmp',JSON.stringify(v),{mode:0o600});fs.renameSync(stateFile+'.tmp',stateFile);};
 if(command==='scheduled'){
  const now=Date.now(),last=read();
  if(fs.existsSync(path.join(target,'update-switching.json'))){try{return await update(target,'recover',{fetcher,adapters});}catch{return {deferred:true,next_action:'inspect_interrupted_update'};}}
  if(settings.reporting&&(!last.reporting_at||now-last.reporting_at>=86400000)){
   const result=diagnostics(path.join(target,'data'),{submit:true,target});save({...read(),reporting_at:now,reporting_status:result.next_action||'complete'});
  }
  if(settings.mode==='manual')return {skipped:true};
  if(!last.attempt_at||now-last.attempt_at>=86400000){
   save({...read(),attempt_at:now});
   try{await update(target,'check',{fetcher,adapters});}catch(error){save({...read(),attempt_at:now,last_error:/^[a-z_]+$/.test(error.message)?error.message:'update_check_failed'});return {deferred:true,next_action:'retry_next_day'};}
  }
  if(settings.mode==='automatic'&&read().available){try{return await update(target,'apply',{fetcher,adapters});}catch(error){save({...read(),last_error:/^[a-z_]+$/.test(error.message)?error.message:'update_apply_failed'});return {deferred:true,next_action:'inspect_update_status'};}}
  return {checked:true};
 }
 if(command==='status'){let worker;try{worker=JSON.parse(fs.readFileSync(path.join(target,'update-worker-result.json')));}catch{}return {settings,...read(),worker,interrupted_switch:fs.existsSync(path.join(target,'update-switching.json'))};}
 if(!['check','apply','rollback','recover'].includes(command))throw Error('Use update status|check|apply|rollback');
 let ownership;
 if(!adapters.storage){
  ownership=await acquireServiceLease(target);
  const lockFile=path.join(target,'update.lock');
  if(fs.existsSync(lockFile)){
   try{const saved=JSON.parse(fs.readFileSync(lockFile));let alive=true;try{process.kill(saved.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)throw Error('update_lock_requires_review');fs.unlinkSync(lockFile);}
   catch(error){await ownership.release();throw error;}
  }
 }
 let unlock;try{unlock=acquireUpdateLock(target);}catch(error){await ownership?.release();throw error;}
 const switchingFile=path.join(target,'update-switching.json');let switching=false,safeToUnlock=true;
 try{
  const state=read();
  const cli=adapters.cli||((record,args)=>{const p=spawnSync(path.join(record.release,nativePlatform().node),[record.launcher,...args],{encoding:'utf8',timeout:20000,windowsHide:true});if(p.status!==0)throw Error('update_controller_check_failed');return JSON.parse(p.stdout);});
  if(command==='check'){
   const keyFile=adapters.keyFile||path.join(root,'release-public-key.pem');if(!fs.existsSync(keyFile)){save({...state,attempt_at:Date.now(),last_error:'release_signing_not_configured'});return {available:false,next_action:'release_signing_not_configured'};}
   const endpoint='https://api.github.com/repos/shayann07/antigravity-computer-use/releases'+(settings.channel==='stable'?'/latest':'?per_page=20');
   const response=await fetcher(endpoint,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('update_release_unavailable');let release=await response.json();
   if(Array.isArray(release))release=release.find(r=>!r.draft);if(!release||release.draft)throw Error('update_release_unavailable');
   const asset=release.assets?.find(a=>a.name===`update-${process.platform}-${process.arch}.json`);if(!asset)return {available:false,next_action:'no_signed_release_for_platform'};
   const envelopeResponse=await fetcher(asset.browser_download_url,{signal:AbortSignal.timeout(15000)});if(!envelopeResponse.ok)throw Error('update_metadata_unavailable');
   const text=await envelopeResponse.text();if(text.length>262144)throw Error('update_metadata_size');const envelope=JSON.parse(text);
   const bytes=Buffer.from(envelope.manifest,'base64'),m=verifyRelease(bytes,envelope.signature,fs.readFileSync(keyFile),{channel:settings.channel});
   if(m.sequence<=(state.sequence||0)||!newerVersion(m.version,bundle.version)){save({...state,available:false,attempt_at:Date.now()});return {available:false};}
   // A fresh directory lets an interrupted download retry without adopting partial bytes.
   const stage=path.join(target,'updates',String(m.sequence)+'-'+randomUUID());fs.mkdirSync(stage,{recursive:true,mode:0o700});
   const required=Object.values(m.files).reduce((n,f)=>n+f.size,0)*2+100*1024*1024;const disk=fs.statfsSync(stage);if(disk.bavail*disk.bsize<required)throw Error('update_insufficient_space');
   for(const [name,f]of Object.entries(m.files)){const destination=path.join(stage,name);fs.mkdirSync(path.dirname(destination),{recursive:true});await downloadFile(f.url,destination,{size:f.size,hash:f.sha256,fetcher});if(process.platform!=='win32'&&(name==='node'||name.startsWith('bin/')||name.endsWith('.command')))fs.chmodSync(destination,0o700);}
   verifyStaged(stage,m);save({...state,attempt_at:Date.now(),checked_at:Date.now(),staged:stage,envelope,available:true,last_error:null});return {available:true,version:m.version,next_action:settings.mode==='automatic'?'apply_when_idle':'update_available'};
  }
  const current=cli(installed,['status']);if(!['idle','not_running','stopped'].includes(current.state)||current.approved_apps?.length)return {deferred:true,next_action:'wait_for_task_end'};
  if(current.state!=='not_running'){
   const session=adapters.prepare?null:JSON.parse(fs.readFileSync(path.join(target,'data/desktop-session.json')));
   const prepared=adapters.prepare?await adapters.prepare(current):await request(session,'prepare_update',{},5000,current.permission_mode);
   if(!prepared.prepared)return {deferred:true,next_action:'wait_for_task_end'};
  }
  const runRollback=adapters.rollback||(file=>{const p=spawnSync(path.join(installed.release,nativePlatform().node),[path.join(installed.release,'scripts/rollback.mjs'),file],{encoding:'utf8',timeout:30000,windowsHide:true});if(p.status!==0)throw Error('update_rollback_failed');});
  if(command==='recover'){
   if(!fs.existsSync(switchingFile))return {recovered:false};
   const interrupted=JSON.parse(fs.readFileSync(switchingFile));
   if(!Array.isArray(interrupted.rollback)||!interrupted.previous_installation)throw Error('update_recovery_journal_invalid');
   for(const file of interrupted.rollback){if(path.dirname(path.dirname(path.resolve(file)))!==path.join(target,'backups')||path.basename(file)!=='rollback.json')throw Error('update_recovery_journal_invalid');}
   switching=true;safeToUnlock=false;
   if(current.state!=='not_running')cli(installed,['shutdown']);
   for(const file of [...interrupted.rollback].reverse())runRollback(file);
   const prior=interrupted.previous_installation,health=cli(prior,['start']);
   if(!['idle','stopped'].includes(health.state))throw Error('update_recovery_health_failed');
   save({...state,available:false,last_error:'interrupted_update_rolled_back'});safeToUnlock=true;return {recovered:true,rolled_back:true};
  }
  let journal;
  const markSwitch=()=>{if(fs.existsSync(switchingFile))throw Error('update_interrupted_requires_recovery');journal={pid:process.pid,previous_installation:installed,rollback:[]};fs.writeFileSync(switchingFile,JSON.stringify(journal),{mode:0o600,flag:'wx'});switching=true;};
  const addJournal=file=>{journal.rollback.push(file);fs.writeFileSync(switchingFile+'.tmp',JSON.stringify(journal),{mode:0o600});fs.renameSync(switchingFile+'.tmp',switchingFile);};
  if(command==='rollback'){
   if(!state.rollback?.length)throw Error('update_no_rollback');markSwitch();
   const firstRollback=JSON.parse(fs.readFileSync(state.rollback[0]));const priorRecord=firstRollback.records.find(r=>r.kind==='installation'&&r.existed);
   if(!priorRecord)throw Error('update_rollback_journal_invalid');journal.previous_installation=JSON.parse(fs.readFileSync(priorRecord.saved));journal.rollback=[...state.rollback];fs.writeFileSync(switchingFile,JSON.stringify(journal),{mode:0o600});
   if(current.state!=='not_running')cli(installed,['shutdown']);safeToUnlock=false;for(const file of [...state.rollback].reverse())runRollback(file);
   const restored=JSON.parse(fs.readFileSync(path.join(target,'installation.json')));cli(restored,['start']);save({...state,available:false,rollback:[]});safeToUnlock=true;return {rolled_back:true};
  }
  if(!state.staged||!state.envelope)throw Error('update_not_staged');
  const m=verifyRelease(Buffer.from(state.envelope.manifest,'base64'),state.envelope.signature,fs.readFileSync(adapters.keyFile||path.join(root,'release-public-key.pem')),{channel:settings.channel});
  if(path.dirname(state.staged)!==path.join(target,'updates'))throw Error('update_stage_outside_installation');
  storage('verify-tree',target);verifyStaged(state.staged,m);
  if(m.sequence<=(state.sequence||0)||!newerVersion(m.version,bundle.version))throw Error('update_downgrade_refused');
  const stagedBundle=JSON.parse(fs.readFileSync(path.join(state.staged,'bundle-manifest.json')));
  if(stagedBundle.build_id!==m.build_id||stagedBundle.version!==m.version||stagedBundle.platform!==m.platform||stagedBundle.arch!==m.arch)throw Error('update_bundle_identity_mismatch');
  const registry=JSON.parse(fs.readFileSync(path.join(target,'deployments.json')));
  if(!Object.values(registry).some(scope=>!scope.update_pin))return {deferred:true,next_action:'all_deployments_pinned'};
  markSwitch();
  // Installer refuses live controllers. Shutdown independently confirms native cleanup.
  if(current.state!=='not_running')cli(installed,['shutdown']);
  // Hold the same native lease used by controllers while swapping files. An
  // old Sidecar cannot restart into a half-switched deployment.
  let controllerLease;if(!adapters.storage)controllerLease=await acquireServiceLease(path.join(target,'data'));
  const records=[];let next;
  try{
   for(const scope of Object.values(registry)){
    if(scope.integration!=='direct')throw Error('update_legacy_scope_requires_manual_upgrade');
    if(scope.update_pin)continue;
    safeToUnlock=false;next=installer({bundle:state.staged,target,home:installed.home,workspace:scope.workspace,permissionMode:scope.permission_mode,sidecar:scope.workspace?undefined:scope.sidecar,stagedUpdate:true,journalCreated:addJournal});records.push(path.join(next.backup,'rollback.json'));
   }
   if(!next)throw Error('update_no_deployment');await controllerLease?.release();controllerLease=null;
   const health=cli(next,['start']);if(health.build_id!==m.build_id||!['idle','stopped'].includes(health.state))throw Error('update_health_failed');
   save({sequence:m.sequence,attempt_at:Date.now(),checked_at:Date.now(),available:false,rollback:records,applied_version:m.version});safeToUnlock=true;return {applied:true,version:m.version};
  }catch(error){
   if(error.code==='installation_recovery_failed')throw Error('update_recovery_requires_operator');
   if(next)try{cli(next,['shutdown']);}catch{throw Error('update_recovery_requires_operator');}
   for(const file of records.reverse())runRollback(file);await controllerLease?.release();controllerLease=null;cli(installed,['start']);save({...state,available:false,last_error:'update_rolled_back'});safeToUnlock=true;throw error;
  }
  finally{await controllerLease?.release();}
 }finally{if(switching&&safeToUnlock)fs.unlinkSync(switchingFile);unlock();await ownership?.release();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [target,command,parent]=process.argv.slice(2);
 const run=async()=>{
  if(parent){if(!/^\d+$/.test(parent)||Number(parent)<=0)throw Error('update_invalid_launcher');const until=Date.now()+10000;while(Date.now()<until){let alive=true;try{process.kill(Number(parent),0);}catch(e){if(e.code==='ESRCH')alive=false;}if(!alive)break;await new Promise(r=>setTimeout(r,100));}try{process.kill(Number(parent),0);throw Error('update_launcher_still_running');}catch(e){if(e.code!=='ESRCH')throw e;}}
  return update(target,command);
 };
 run().then(r=>{if(parent)fs.writeFileSync(path.join(target,'update-worker-result.json'),JSON.stringify(r),{mode:0o600});else console.log(JSON.stringify(r));}).catch(e=>{const result={ok:false,error:{code:/^[a-z_]+$/.test(e.message)?e.message:'update_worker_failed'}};if(parent)fs.writeFileSync(path.join(target,'update-worker-result.json'),JSON.stringify(result),{mode:0o600});else console.log(JSON.stringify(result));process.exitCode=1;});
}
