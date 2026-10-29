import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {Incidents} from '../server/incidents.mjs';import {updateSettings} from '../server/update-core.mjs';
export function diagnostics(directory,{submit=false,target=path.dirname(directory)}={}){
 const incidents=new Incidents(directory),reports=incidents.read();if(!submit)return {reports,pending:reports.filter(r=>r.pending).length};
 if(!updateSettings(target).reporting)return {submitted:0,next_action:'reporting_consent_required'};
 let submitted=0;
 for(const item of reports.filter(r=>r.pending).slice(0,3)){
  const title=`[automatic incident ${item.id}] ${item.platform}: ${item.code}`;
  const query=spawnSync('gh',['issue','list','--repo','shayann07/antigravity-computer-use','--state','all','--search',`in:title "${item.id}"`,'--json','number'],{encoding:'utf8',timeout:15000,windowsHide:true});
  if(query.status!==0)return {submitted,next_action:'github_authentication_or_network_required'};
  if(!JSON.parse(query.stdout).length){const body='Sanitized runtime incident (no screenshots, text, paths or arguments):\n\n```json\n'+JSON.stringify(item,null,2)+'\n```';
   const result=spawnSync('gh',['issue','create','--repo','shayann07/antigravity-computer-use','--title',title,'--body-file','-'],{input:body,encoding:'utf8',timeout:15000,windowsHide:true});if(result.status!==0)return {submitted,next_action:'github_submission_failed'};}
  item.pending=false;submitted++;
 }
 // Reload after network work so incidents created meanwhile are not discarded.
 const latest=incidents.read();for(const item of latest){const sent=reports.find(r=>r.id===item.id&&!r.pending);if(sent)item.pending=false;}
 fs.writeFileSync(incidents.file+'.tmp',JSON.stringify(latest),{mode:0o600});fs.renameSync(incidents.file+'.tmp',incidents.file);return {submitted};
}
