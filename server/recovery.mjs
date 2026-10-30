// Deterministic guidance accompanies errors; it never executes a retry.
import fs from 'node:fs';import path from 'node:path';
// Inspect only a recorded prior Windows guard. Never inject input, kill a PID,
// clear Stop, or trust a PID that is still alive (including possible reuse).
export function priorWindowsCleanupVerified(directory,record,{platform=process.platform,probe=process.kill}={}){
 if(platform!=='win32'||record?.dispatched!==true||record.watchdogs_complete!==true||!Array.isArray(record.children)||record.children.length<3||typeof record.guard!=='string'||!/^guard-[1-9][0-9]{0,9}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.state$/.test(record.guard))return false;
 const read=(file,limit)=>{
  const info=fs.lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>limit)throw Error('untrusted recovery record');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));try{
   const opened=fs.fstatSync(fd);if(!opened.isFile()||opened.nlink!==1||opened.size>limit||opened.dev!==info.dev||opened.ino!==info.ino)throw Error('recovery record replaced');
   const bytes=Buffer.alloc(limit+1);let used=0;while(used<bytes.length){const n=fs.readSync(fd,bytes,used,bytes.length-used,null);if(!n)break;used+=n;}
   const after=fs.fstatSync(fd),current=fs.lstatSync(file);
   if(used>limit||used!==opened.size||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs||!current.isFile()||current.isSymbolicLink()||current.nlink!==1||current.dev!==opened.dev||current.ino!==opened.ino)throw Error('recovery record changed');
   return bytes.subarray(0,used).toString('utf8');
  }finally{fs.closeSync(fd);}
 };
 const gone=pid=>{if(!Number.isSafeInteger(pid)||pid<=0||pid>4294967295)return false;try{probe(pid,0);return false;}catch(error){return error.code==='ESRCH';}};
 try{
  const guard=path.join(directory,record.guard),parent=Number(/^guard-(\d+)-/.exec(record.guard)[1]);
  const watchdog=/^([1-9][0-9]{0,9})\|([1-9][0-9]{0,19})$/.exec(read(guard+'.watchdog',128));if(!watchdog||!record.children.includes(Number(watchdog[1])))return false;
  const pids=[parent,...record.children,Number(watchdog[1])];if(!pids.every(gone))return false;
  const fields=read(guard,4096).split('|');if(fields.length<4||!['idle','stopped'].includes(fields[0]))return false;
  // Windows InputLedger.Save writes exactly zero bytes for an empty ledger.
  if(read(guard+'.inputs',65536)!=='')return false;
  return pids.every(gone);
 }catch{return false;}
}
export function recoveryAdvice(result){
 const code=result.error?.code||result.verification_error?.code;
 if(result.delivery_unknown===true||result.input_completed===true&&code||code==='input_outcome_unknown')return {next_action:'inspect_effect_without_replay',replay_allowed:false};
 if(['stale_observation','element_stale','window_moved','no_image','control_changed','focus_changed'].includes(code))return {next_action:'observe_again',replay_allowed:false};
 if(code==='window_minimized')return {next_action:'focus_target_then_observe',replay_allowed:false};
 if(code==='desktop_context_unavailable')return {next_action:'human_start_on_visible_desktop',replay_allowed:false};
 if(code==='version_mismatch')return {next_action:'resolve_version_mismatch',replay_allowed:false};
 if(code==='recovered_task_requires_end')return {next_action:'inspect_recovered_task',replay_allowed:false};
 if(code==='another_session_busy')return {next_action:'wait_for_controller_then_observe',replay_allowed:false};
 if(code==='session_limit')return {next_action:'end_owned_task_then_reauthorize',replay_allowed:false};
 if(['recovered_cleanup_unverified','input_lease_stale'].includes(code))return {next_action:'inspect_prior_input_cleanup',replay_allowed:false};
 if(['stop_persistence_failed','guard_persistence_failed'].includes(code))return {next_action:'inspect_stop_persistence_without_restart',replay_allowed:false};
 if(code==='input_cleanup_failed')return {next_action:'inspect_input_cleanup',replay_allowed:false};
 if(['permission_denied','approval_timeout','confirmation_required'].includes(code))return {next_action:'await_user_decision',replay_allowed:false};
 if(['control_stopped','control_inactive'].includes(code))return {next_action:'inspect_status_then_human_controls',replay_allowed:false};
 return {next_action:'inspect_diagnostics',replay_allowed:false};
}
