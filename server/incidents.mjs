// Shareable incidents are allowlisted metadata, never raw error messages or args.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {BUILD_ID} from './version.mjs';
const safe=value=>/^[a-z][a-z0-9_]{0,63}$/.test(value||'')?value:'unknown';
export class Incidents {
 constructor(directory){this.file=path.join(directory,'incidents.json');}
 read(){try{return JSON.parse(fs.readFileSync(this.file));}catch{return [];}}
 record(command,result){
  const code=result.error?.code||result.verification_error?.code;if(!code)return;
  const event={build:BUILD_ID,platform:process.platform,arch:process.arch,operation:safe(command),code:safe(code),state:safe(result.state),delivery_unknown:result.delivery_unknown===true||code==='input_outcome_unknown'};
  const id=createHash('sha256').update(JSON.stringify(event)).digest('hex').slice(0,24);
  const all=this.read();let item=all.find(e=>e.id===id);if(!item){item={id,...event,count:0,first:new Date().toISOString(),pending:true};all.push(item);}item.count++;item.last=new Date().toISOString();
  fs.writeFileSync(this.file+'.tmp',JSON.stringify(all.slice(-100)),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);return id;
 }
}
