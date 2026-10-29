import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {Incidents} from '../server/incidents.mjs';import {updateSettings} from '../server/update-core.mjs';
import {writeAtomicJSON} from '../server/atomic-json.mjs';
import {storageOperationAsync} from '../server/storage.mjs';import {acquireServiceLease} from '../server/service-lease.mjs';
async function reportingLease(directory){await storageOperationAsync('verify',directory);const lockDir=path.join(directory,'reporting-lease');fs.mkdirSync(lockDir,{recursive:true,mode:0o700});return acquireServiceLease(lockDir);}
export async function diagnostics(directory,{submit=false,target=path.dirname(directory),run=spawnSync,now=Date.now(),acquire=reportingLease}={}){
 const incidents=new Incidents(directory);if(!submit){const reports=incidents.read();let intent;try{const value=JSON.parse(fs.readFileSync(path.join(directory,'reporting-intent.json')));if(/^[a-f0-9]{24}$/.test(value?.id||''))intent=value.id;}catch{}return {reports,pending:reports.filter(r=>r.pending).length,...(intent?{next_action:'github_submission_outcome_unknown',incident_id:intent}:{})};}
 if(!updateSettings(target).reporting)return {submitted:0,next_action:'reporting_consent_required'};
 let lease;try{lease=await acquire(directory);}catch(error){return {submitted:0,next_action:error.code==='service_already_running'?'reporting_in_progress':'reporting_lock_unavailable'};}
 try{
 const reports=incidents.read();
 const throttleFile=path.join(directory,'reporting-state.json');let last;try{last=JSON.parse(fs.readFileSync(throttleFile));}catch{}
 if(last?.attempt_at&&now-last.attempt_at<3600000)return {submitted:0,next_action:'reporting_backoff'};
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(throttleFile,JSON.stringify({attempt_at:now}),{mode:0o600});
 const intentFile=path.join(directory,'reporting-intent.json');let intent;
 if(fs.existsSync(intentFile)){try{intent=JSON.parse(fs.readFileSync(intentFile));if(!/^[a-f0-9]{24}$/.test(intent?.id||'')||!Number.isSafeInteger(intent.count)||intent.count<0)throw Error();}catch{return {submitted:0,next_action:'reporting_intent_invalid'};}
  try{const ack=JSON.parse(fs.readFileSync(incidents.ackFile));if(Number.isSafeInteger(ack[intent.id])&&ack[intent.id]>=intent.count){fs.unlinkSync(intentFile);intent=null;}}catch{}
 }
 let submitted=0;
 const pending=reports.filter(r=>r.pending);if(intent){const index=pending.findIndex(r=>r.id===intent.id);if(index<0)return {submitted:0,next_action:'github_submission_outcome_unknown',incident_id:intent.id};pending.unshift(...pending.splice(index,1));}
 for(const item of pending.slice(0,3)){
  lease.assertHeld();
  if(!updateSettings(target).reporting)return {submitted,next_action:'reporting_consent_required'};
  if(intent&&intent.id!==item.id)return {submitted,next_action:'github_submission_outcome_unknown',incident_id:intent.id};
  const title=`[automatic incident ${item.id}] ${item.platform}: ${item.code}`;
  const query=run('gh',['issue','list','--repo','shayann07/antigravity-computer-use','--state','all','--search',`in:title "${item.id}"`,'--json','number,title'],{encoding:'utf8',timeout:15000,windowsHide:true});
  if(query.status!==0)return {submitted,next_action:'github_authentication_or_network_required'};
  let matches;try{matches=JSON.parse(query.stdout);}catch{return {submitted,next_action:'github_lookup_invalid'};}if(!Array.isArray(matches)||matches.some(match=>!Number.isSafeInteger(match?.number)||typeof match?.title!=='string'))return {submitted,next_action:'github_lookup_invalid'};
  matches=matches.filter(match=>match.title===title);
  if(intent&&!matches.length)return {submitted,next_action:'github_submission_outcome_unknown',incident_id:item.id};
  if(!matches.length){lease.assertHeld();if(!updateSettings(target).reporting)return {submitted,next_action:'reporting_consent_required'};const body='Sanitized runtime incident (no screenshots, text, paths or arguments):\n\n```json\n'+JSON.stringify(item,null,2)+'\n```';
   writeAtomicJSON(intentFile,{id:item.id,count:item.count});intent={id:item.id,count:item.count};
   const result=run('gh',['issue','create','--repo','shayann07/antigravity-computer-use','--title',title,'--body-file','-'],{input:body,encoding:'utf8',timeout:15000,windowsHide:true});if(result.status!==0)return {submitted,next_action:'github_submission_outcome_unknown',incident_id:item.id};}
  item.pending=false;submitted++;
  let acks={};try{const value=JSON.parse(fs.readFileSync(incidents.ackFile));if(value&&typeof value==='object'&&!Array.isArray(value))acks=value;}catch{}
  acks[item.id]=intent?intent.count:item.count;const bounded=Object.fromEntries(Object.entries(acks).filter(([id,count])=>/^[a-f0-9]{24}$/.test(id)&&Number.isSafeInteger(count)&&count>=0).slice(-100));
  lease.assertHeld();writeAtomicJSON(incidents.ackFile,bounded);if(intent){fs.unlinkSync(intentFile);intent=null;}
 }
 // Report acknowledgements live separately: the reporting worker never rewrites
 // the controller's incident journal or its temporary file.
 return {submitted};
 }finally{await lease.release();}
}
