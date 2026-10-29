// Same-directory metadata publication. Flush the complete file before exposing
// it; never truncate the previous recovery journal in place.
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
export function readTaskRecord(file){
 try{if(fs.statSync(file).size>1024)throw Error();const value=JSON.parse(fs.readFileSync(file,'utf8'));if(value?.schema!==1||typeof value.open!=='boolean')throw Error();
  if(value.guard!==undefined&&(typeof value.guard!=='string'||!/^guard-[1-9][0-9]{0,9}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.state$/.test(value.guard)))throw Error();
  return {open:value.open,guard:value.guard??null};}
 catch(error){if(error.code==='ENOENT')return {open:false,guard:null};throw Object.assign(Error('task_state_invalid: inspect private storage before continuing.'),{code:'task_state_invalid'});}
}
export function readTaskState(file){return readTaskRecord(file).open;}
export function writeAtomicJSON(file,value,{exclusive=false,io=fs}={}){
 return writeAtomicText(file,JSON.stringify(value),{exclusive,io});
}
export function writeAtomicText(file,bytes,{exclusive=false,io=fs}={}){
 const directory=path.dirname(file),temporary=path.join(directory,'.'+path.basename(file)+'.'+randomUUID()+'.tmp');
 let descriptor;
 try{
  descriptor=io.openSync(temporary,'wx',0o600);io.writeFileSync(descriptor,bytes);io.fsyncSync(descriptor);io.closeSync(descriptor);descriptor=undefined;
  if(exclusive){io.linkSync(temporary,file);io.unlinkSync(temporary);}else io.renameSync(temporary,file);
  let folder;
  try{folder=io.openSync(directory,'r');io.fsyncSync(folder);return {file_flushed:true,directory_flushed:true};}
  catch(error){
   // Node/Windows cannot always open or flush directory handles. The file flush
   // above is mandatory; unsupported directory flush is not a power-loss pass.
   if(!['EPERM','EACCES','EISDIR','EINVAL','ENOTSUP','EOPNOTSUPP'].includes(error.code))throw error;
   return {file_flushed:true,directory_flushed:false};
  }finally{if(folder!==undefined)io.closeSync(folder);}
 }finally{
  if(descriptor!==undefined)io.closeSync(descriptor);
  if(io.existsSync(temporary))io.unlinkSync(temporary);
 }
}
export function flushPreparedFile(file){const info=fs.lstatSync(file);if(!info.isFile()||info.isSymbolicLink())throw Error('prepared_payload_not_regular');const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
export function flushPreparedTree(directory){
 const info=fs.lstatSync(directory);if(!info.isDirectory()||info.isSymbolicLink())throw Error('prepared_payload_not_directory');
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())flushPreparedTree(file);else flushPreparedFile(file);}
}
