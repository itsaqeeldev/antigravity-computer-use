// Shareable incidents are allowlisted metadata, never raw error messages or args.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {BUILD_ID} from './version.mjs';import {storageOperationAsync} from './storage.mjs';import {acquireServiceLease} from './service-lease.mjs';import {writeAtomicJSON} from './atomic-json.mjs';
const safe=value=>/^[a-z][a-z0-9_]{0,63}$/.test(value||'')?value:'unknown';
function incident(command,result){const code=result.error?.code||result.verification_error?.code;if(!code)return;
 const event={build:BUILD_ID,platform:process.platform,arch:process.arch,operation:safe(command),code:safe(code),state:safe(result.state),delivery_unknown:result.delivery_unknown===true||code==='input_outcome_unknown',exit_code:Number.isSafeInteger(result.guardian_exit?.code)?result.guardian_exit.code:null};
 return {event,id:createHash('sha256').update(JSON.stringify(event)).digest('hex').slice(0,24)};
}
export class Incidents {
 constructor(directory){this.directory=directory;this.file=path.join(directory,'incidents.json');this.ackFile=path.join(directory,'incident-acks.json');}
 read(){
  try{
   if(fs.statSync(this.file).size>256*1024)return [];
   const data=JSON.parse(fs.readFileSync(this.file));if(!Array.isArray(data))return [];
   let acknowledgements={};try{const a=JSON.parse(fs.readFileSync(this.ackFile));if(a&&typeof a==='object'&&!Array.isArray(a))acknowledgements=a;}catch{}
   return data.slice(-100).filter(e=>/^[a-f0-9]{24}$/.test(e.id||'')).map(e=>({
    id:e.id,build:/^[a-zA-Z0-9_-]{1,64}$/.test(e.build||'')?e.build:'unknown',platform:['win32','darwin','linux'].includes(e.platform)?e.platform:'unknown',arch:['x64','arm64'].includes(e.arch)?e.arch:'unknown',
    operation:safe(e.operation),code:safe(e.code),state:safe(e.state),delivery_unknown:e.delivery_unknown===true,exit_code:Number.isSafeInteger(e.exit_code)?e.exit_code:null,
    count:Number.isSafeInteger(e.count)&&e.count>=0?e.count:0,
    first:/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(e.first||'')?String(e.first).slice(0,24):null,
    last:/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(e.last||'')?String(e.last).slice(0,24):null,pending:e.pending!==false&&!(Number.isSafeInteger(acknowledgements[e.id])&&acknowledgements[e.id]>=(e.count||0))
   }));
  }catch{return [];}
 }
 record(command,result,{guard}={}){
  const details=incident(command,result);if(!details)return;const {event,id}=details;
  const all=this.read();let item=all.find(e=>e.id===id);if(!item){item={id,...event,count:0,first:new Date().toISOString(),pending:true};all.push(item);}if(item.count===Number.MAX_SAFE_INTEGER)throw Object.assign(new Error('Incident counter exhausted'),{code:'incident_counter_exhausted'});item.count++;item.pending=true;item.last=new Date().toISOString();
  const io=guard?{...fs,renameSync(from,to){guard();return fs.renameSync(from,to);}}:fs;
  writeAtomicJSON(this.file,all.slice(-100),{io});return id;
 }
 identify(command,result){return incident(command,result)?.id;}
 // Production writers use the separate kernel lease across the complete
 // read/modify/publish operation. record() remains for isolated test setup.
 async recordSerialized(command,result){
  if(!(result.error?.code||result.verification_error?.code))return;
  // Claim the lease before native marker/ACL initialization. Initializing the
  // marker outside the lease lets simultaneous first writers race each other.
  await storageOperationAsync('verify',this.directory);const lockDir=path.join(this.directory,'incident-writer-lease');fs.mkdirSync(lockDir,{recursive:true,mode:0o700});
  const deadline=Date.now()+5000;let lease;
  do{try{lease=await acquireServiceLease(lockDir);break;}catch(error){if(error.code!=='service_already_running'||Date.now()>=deadline)throw error;await new Promise(resolve=>setTimeout(resolve,50));}}while(true);
  try{lease.assertHeld();return this.record(command,result,{guard:()=>lease.assertHeld()});}finally{await lease.release();}
 }
}
