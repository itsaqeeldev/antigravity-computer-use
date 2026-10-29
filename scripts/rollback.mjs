import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readTaskState} from '../server/atomic-json.mjs';
export function rollback(file){
if(!file)throw new Error('Pass the exact backups/<timestamp>/rollback.json to restore.');
const data=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
const target=path.resolve(data.release,'..','..'),roots=new Set([target]);
// A cross-folder installation may restore a skill pointing to a previous root.
// Check both sides before touching configuration; either may own a live task.
for(const record of data.records){if(record.kind==='deployment'&&record.existed){
 const previous=JSON.parse(fs.readFileSync(record.saved,'utf8'));
 if(typeof previous.target!=='string'||!path.isAbsolute(previous.target))throw Error('invalid_previous_deployment');
 roots.add(path.resolve(previous.target));
}}
for(const root of roots){
if(readTaskState(path.join(root,'data','task-state.json')))throw Error('task_open_finish_before_rollback');
const sessionFile=path.join(root,'data/desktop-session.json');if(fs.existsSync(sessionFile)){
 const session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));if(!Number.isSafeInteger(session.pid)||session.pid<=0)throw Error('Invalid live-session metadata; inspect before rollback.');
 let alive=true;try{process.kill(session.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
 if(alive)throw Error('A desktop service is still running. End and shutdown its task before rollback; no configuration was changed.');
}
}
for(const r of data.records){
 if(r.kind==='sidecar-config'){
  const current=fs.existsSync(r.file)?JSON.parse(fs.readFileSync(r.file)):{};
  const previous=r.existed?JSON.parse(fs.readFileSync(r.saved)):{};
  current.sidecars??={};const old=previous.sidecars?.['antigravity-computer-use'];
  if(old)current.sidecars['antigravity-computer-use']=old;else delete current.sidecars['antigravity-computer-use'];
  fs.mkdirSync(path.dirname(r.file),{recursive:true});fs.writeFileSync(r.file,JSON.stringify(current,null,2)+'\n');
 }
 else if(r.kind==='config'){
  const c=fs.existsSync(r.file)?JSON.parse(fs.readFileSync(r.file)):{};
  const previous=r.existed?JSON.parse(fs.readFileSync(r.saved)):{};
  c.mcpServers??={};const old=previous.mcpServers?.['antigravity-computer-use'];
  if(old)c.mcpServers['antigravity-computer-use']=old;else delete c.mcpServers['antigravity-computer-use'];
  fs.mkdirSync(path.dirname(r.file),{recursive:true});fs.writeFileSync(r.file,JSON.stringify(c,null,2)+'\n');
 }
 else if(r.existed){
  if(fs.statSync(r.saved).isDirectory())fs.cpSync(r.saved,r.file,{recursive:true});
  else {fs.copyFileSync(r.saved,r.file+'.rollback.tmp');fs.chmodSync(r.file+'.rollback.tmp',fs.statSync(r.saved).mode);fs.renameSync(r.file+'.rollback.tmp',r.file);}
 }
 else if(['installation','launcher','deployment','deployment-registry','sidecar-definition'].includes(r.kind)&&fs.existsSync(r.file))fs.unlinkSync(r.file);
 else if(r.kind==='skill'&&fs.existsSync(path.join(r.file,'SKILL.md')))fs.unlinkSync(path.join(r.file,'SKILL.md'));
}
return {restored:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){rollback(process.argv[2]);console.log('Prior configuration and skill files restored. Installed release folders were preserved.');}
