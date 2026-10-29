// One concise notice per update event, delivered by ready. No raw state/errors.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export function updateNotice(directory){
 try{
  const target=path.dirname(directory),file=path.join(target,'update-state.json');
  if(!fs.existsSync(path.join(target,'installation.json'))||!fs.existsSync(file)||fs.statSync(file).size>262144)return;
  const state=JSON.parse(fs.readFileSync(file));let notice;
  if(state.last_error==='update_rolled_back'||state.last_error==='interrupted_update_rolled_back')notice={kind:'recovered',message:'Computer Use restored the previous version after an update failed. Your settings and Stop were retained.'};
  else if(state.last_error)notice={kind:'action_required',message:'A Computer Use update needs attention. Run update status for the recorded result.'};
  else if(state.available===true)notice={kind:'available',version:/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(state.available_version||'')?state.available_version:undefined,message:'A verified Computer Use update is available. Run update status for details.'};
  else if(state.applied_version&&/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(state.applied_version))notice={kind:'applied',version:state.applied_version,message:`Computer Use updated to ${state.applied_version}.`};
  if(!notice)return;
  // Daily retry timestamps must not cause identical failures to notify again.
  const id=createHash('sha256').update(JSON.stringify({notice,sequence:state.sequence||null})).digest('hex');
  const delivery=path.join(directory,'update-notice-delivered.json');
  try{if(JSON.parse(fs.readFileSync(delivery)).id===id)return;}catch{}
  fs.writeFileSync(delivery+'.tmp',JSON.stringify({id}),{mode:0o600});fs.renameSync(delivery+'.tmp',delivery);
  return notice;
 }catch{return;}
}
