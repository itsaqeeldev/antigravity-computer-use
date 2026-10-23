// Local, bounded timing receipts. Never record request text, clipboard contents,
// reasons, UI trees, credentials or the IPC capability.
import fs from 'node:fs';import path from 'node:path';
import {BUILD_ID} from './version.mjs';
export class Receipts {
 constructor(directory,{maxBytes=1024*1024}={}){this.file=path.join(directory,'desktop-receipts.jsonl');this.maxBytes=maxBytes;this.seq=0;this.previous=Date.now();}
 begin(command,args){const now=Date.now();return {id:process.pid+'.'+(++this.seq),at:new Date(now).toISOString(),command:/^computer_[a-z_]{1,32}$/.test(command)?command:'invalid_command',hwnd:Number.isSafeInteger(args?.hwnd)?args.hwnd:undefined,gap_ms:Math.max(0,now-this.previous),start:performance.now()};}
 finish(ticket,result){
  this.previous=Date.now();const {start,...record}=ticket;record.elapsed_ms=Math.round((performance.now()-start)*10)/10;
  record.build_id=BUILD_ID;
  record.ok=result.ok!==false;record.error_code=result.error?.code;record.input_completed=result.input_completed??null;
  record.verification_error=result.verification_error?.code;record.observation_id=result.metadata?.observation_id;
  record.image=result.image?.path;record.state=result.state;record.skipped=result.batch?.skipped??result.skipped;
  const receipt={id:record.id,path:this.file,elapsed_ms:record.elapsed_ms,gap_ms:record.gap_ms};
  try{
   fs.mkdirSync(path.dirname(this.file),{recursive:true});
   if(fs.existsSync(this.file)&&fs.statSync(this.file).size>this.maxBytes){if(fs.existsSync(this.file+'.previous'))fs.unlinkSync(this.file+'.previous');fs.renameSync(this.file,this.file+'.previous');}
   fs.appendFileSync(this.file,JSON.stringify(record)+'\n',{mode:0o600});
  }catch{receipt.error='receipt_storage_unavailable';}
  return receipt;
 }
}
