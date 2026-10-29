// Shareable incidents are allowlisted metadata, never raw error messages or args.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {BUILD_ID} from './version.mjs';
const safe=value=>/^[a-z][a-z0-9_]{0,63}$/.test(value||'')?value:'unknown';
export class Incidents {
 constructor(directory){this.file=path.join(directory,'incidents.json');this.ackFile=path.join(directory,'incident-acks.json');}
 read(){
  try{
   if(fs.statSync(this.file).size>256*1024)return [];
   const data=JSON.parse(fs.readFileSync(this.file));if(!Array.isArray(data))return [];
   let acknowledgements={};try{const a=JSON.parse(fs.readFileSync(this.ackFile));if(a&&typeof a==='object'&&!Array.isArray(a))acknowledgements=a;}catch{}
   return data.slice(-100).filter(e=>/^[a-f0-9]{24}$/.test(e.id||'')).map(e=>({
    id:e.id,build:/^[a-zA-Z0-9_-]{1,64}$/.test(e.build||'')?e.build:'unknown',platform:['win32','darwin','linux'].includes(e.platform)?e.platform:'unknown',arch:['x64','arm64'].includes(e.arch)?e.arch:'unknown',
    operation:safe(e.operation),code:safe(e.code),state:safe(e.state),delivery_unknown:e.delivery_unknown===true,exit_code:Number.isSafeInteger(e.exit_code)?e.exit_code:null,
    count:Number.isSafeInteger(e.count)&&e.count>=0?Math.min(e.count,1000000):0,
    first:/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(e.first||'')?String(e.first).slice(0,24):null,
    last:/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(e.last||'')?String(e.last).slice(0,24):null,pending:e.pending!==false&&!(Number.isSafeInteger(acknowledgements[e.id])&&acknowledgements[e.id]>=(e.count||0))
   }));
  }catch{return [];}
 }
 record(command,result){
  const code=result.error?.code||result.verification_error?.code;if(!code)return;
  const event={build:BUILD_ID,platform:process.platform,arch:process.arch,operation:safe(command),code:safe(code),state:safe(result.state),delivery_unknown:result.delivery_unknown===true||code==='input_outcome_unknown',exit_code:Number.isSafeInteger(result.guardian_exit?.code)?result.guardian_exit.code:null};
  const id=createHash('sha256').update(JSON.stringify(event)).digest('hex').slice(0,24);
  const all=this.read();let item=all.find(e=>e.id===id);if(!item){item={id,...event,count:0,first:new Date().toISOString(),pending:true};all.push(item);}item.count++;item.pending=true;item.last=new Date().toISOString();
  fs.writeFileSync(this.file+'.tmp',JSON.stringify(all.slice(-100)),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);return id;
 }
}
