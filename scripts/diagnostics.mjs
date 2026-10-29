import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {Incidents} from '../server/incidents.mjs';import {updateSettings} from '../server/update-core.mjs';
import {writeAtomicJSON} from '../server/atomic-json.mjs';
export function diagnostics(directory,{submit=false,target=path.dirname(directory),run=spawnSync,now=Date.now()}={}){
 const incidents=new Incidents(directory),reports=incidents.read();if(!submit)return {reports,pending:reports.filter(r=>r.pending).length};
 if(!updateSettings(target).reporting)return {submitted:0,next_action:'reporting_consent_required'};
 const throttleFile=path.join(directory,'reporting-state.json');let last;try{last=JSON.parse(fs.readFileSync(throttleFile));}catch{}
 if(last?.attempt_at&&now-last.attempt_at<3600000)return {submitted:0,next_action:'reporting_backoff'};
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(throttleFile,JSON.stringify({attempt_at:now}),{mode:0o600});
 let submitted=0;
 for(const item of reports.filter(r=>r.pending).slice(0,3)){
  const title=`[automatic incident ${item.id}] ${item.platform}: ${item.code}`;
  const query=run('gh',['issue','list','--repo','shayann07/antigravity-computer-use','--state','all','--search',`in:title "${item.id}"`,'--json','number'],{encoding:'utf8',timeout:15000,windowsHide:true});
  if(query.status!==0)return {submitted,next_action:'github_authentication_or_network_required'};
  let matches;try{matches=JSON.parse(query.stdout);}catch{return {submitted,next_action:'github_lookup_invalid'};}if(!Array.isArray(matches))return {submitted,next_action:'github_lookup_invalid'};
  if(!matches.length){const body='Sanitized runtime incident (no screenshots, text, paths or arguments):\n\n```json\n'+JSON.stringify(item,null,2)+'\n```';
   const result=run('gh',['issue','create','--repo','shayann07/antigravity-computer-use','--title',title,'--body-file','-'],{input:body,encoding:'utf8',timeout:15000,windowsHide:true});if(result.status!==0)return {submitted,next_action:'github_submission_failed'};}
  item.pending=false;submitted++;
 }
 // Report acknowledgements live separately: the reporting worker never rewrites
 // the controller's incident journal or its temporary file.
 let acks={};try{const value=JSON.parse(fs.readFileSync(incidents.ackFile));if(value&&typeof value==='object'&&!Array.isArray(value))acks=value;}catch{}
 for(const item of reports.filter(r=>!r.pending))acks[item.id]=item.count;
 const bounded=Object.fromEntries(Object.entries(acks).filter(([id,count])=>/^[a-f0-9]{24}$/.test(id)&&Number.isSafeInteger(count)&&count>=0).slice(-100));
 writeAtomicJSON(incidents.ackFile,bounded);return {submitted};
}
