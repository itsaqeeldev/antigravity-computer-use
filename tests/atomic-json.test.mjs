import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {writeAtomicJSON,writeAtomicText,flushPreparedTree,readTaskRecord} from '../server/atomic-json.mjs';import {testDirectory} from './paths.mjs';
const fixture=()=>fs.mkdtempSync(path.join(testDirectory('tmp'),'atomic-metadata-'));
test('task state refuses linked files rather than treating them as idle',()=>{
 const dir=fixture(),file=path.join(dir,'task-state.json'),target=path.join(dir,'target');try{
  assert.equal(readTaskRecord(file).open,false);fs.writeFileSync(target,JSON.stringify({schema:1,open:false}));
  fs.linkSync(target,file);assert.throws(()=>readTaskRecord(file),e=>e.code==='task_state_invalid');fs.unlinkSync(file);
  if(process.platform!=='win32'){
   fs.symlinkSync(target,file);assert.throws(()=>readTaskRecord(file),e=>e.code==='task_state_invalid');fs.unlinkSync(file);
   fs.symlinkSync(path.join(dir,'missing'),file);assert.throws(()=>readTaskRecord(file),e=>e.code==='task_state_invalid');fs.unlinkSync(file);
  }
  fs.writeFileSync(file,JSON.stringify({schema:1,open:true}));assert.equal(readTaskRecord(file).open,true);
  const missingAfterInspection={...fs,openSync(){throw Object.assign(Error('replaced'),{code:'ENOENT'});}};
  assert.throws(()=>readTaskRecord(file,{io:missingAfterInspection}),e=>e.code==='task_state_invalid');
  let closed=false;const changedAfterInspection={...fs,fstatSync(fd){const stat=fs.fstatSync(fd);return Object.assign(stat,{ino:-1});},closeSync(fd){closed=true;return fs.closeSync(fd);}};
  assert.throws(()=>readTaskRecord(file,{io:changedAfterInspection}),e=>e.code==='task_state_invalid');assert.equal(closed,true);
  let inspections=0;const replacedDuringRead={...fs,lstatSync(p){const stat=fs.lstatSync(p);if(++inspections===2)stat.ino=-1;return stat;}};
  assert.throws(()=>readTaskRecord(file,{io:replacedDuringRead}),e=>e.code==='task_state_invalid');
  let bytesRead=0;const growingFile={...fs,readSync(fd,buffer,offset,length){buffer.fill(0x20,offset,offset+length);bytesRead+=length;return length;}};
  assert.throws(()=>readTaskRecord(file,{io:growingFile}),e=>e.code==='task_state_invalid');assert.equal(bytesRead,1025);
  let stats=0;const modifiedDuringRead={...fs,fstatSync(fd){const stat=fs.fstatSync(fd);if(++stats===2)stat.mtimeMs+=1;return stat;}};
  assert.throws(()=>readTaskRecord(file,{io:modifiedDuringRead}),e=>e.code==='task_state_invalid');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('metadata is flushed before replacement and exclusive creation cannot overwrite a journal',()=>{
 const dir=fixture(),file=path.join(dir,'journal.json');try{const calls=[];const io={...fs,fsyncSync(fd){calls.push('flush');return fs.fsyncSync(fd);},renameSync(a,b){calls.push('rename');return fs.renameSync(a,b);}};
  writeAtomicJSON(file,{old:true},{exclusive:true});const result=writeAtomicJSON(file,{new:true},{io});assert.equal(result.file_flushed,true);assert(calls.indexOf('flush')<calls.indexOf('rename'));assert.deepEqual(JSON.parse(fs.readFileSync(file)),{new:true});
  assert.throws(()=>writeAtomicJSON(file,{overwrite:true},{exclusive:true}),e=>e.code==='EEXIST');assert.deepEqual(JSON.parse(fs.readFileSync(file)),{new:true});assert.deepEqual(fs.readdirSync(dir),['journal.json']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('failed file flush or replacement keeps prior metadata and cleans unpublished temporary files',()=>{
 for(const failure of ['fsyncSync','renameSync']){const dir=fixture(),file=path.join(dir,'journal.json');try{writeAtomicJSON(file,{old:true});const io={...fs,[failure](){throw Object.assign(Error('simulated I/O failure'),{code:'EIO'});}};assert.throws(()=>writeAtomicJSON(file,{new:true},{io}),e=>e.code==='EIO');assert.deepEqual(JSON.parse(fs.readFileSync(file)),{old:true});assert.deepEqual(fs.readdirSync(dir),['journal.json']);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
});
test('unsupported directory flushing is reported without skipping mandatory file flush',()=>{
 const dir=fixture(),file=path.join(dir,'journal.json');try{let flushes=0;const io={...fs,fsyncSync(fd){flushes++;return fs.fsyncSync(fd);},openSync(p,...args){if(p===dir)throw Object.assign(Error('Directory handle unsupported'),{code:'EACCES'});return fs.openSync(p,...args);}};
  const result=writeAtomicJSON(file,{ready:true},{io});assert.equal(result.directory_flushed,false);assert.equal(result.file_flushed,true);assert.equal(flushes,1);assert.deepEqual(JSON.parse(fs.readFileSync(file)),{ready:true});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('atomic text preserves exact Unicode and staged-tree flushing refuses file links',()=>{
 const dir=fixture(),file=path.join(dir,'text.txt');try{const text='اردو — 4× 👩🏽\u200d💻\n';writeAtomicText(file,text);assert.equal(fs.readFileSync(file,'utf8'),text);flushPreparedTree(dir);
  // Hard links are ordinary files and safe to flush; symbolic links must not
  // redirect staging verification outside its owned tree.
  if(process.platform!=='win32'){fs.symlinkSync(file,path.join(dir,'link'));assert.throws(()=>flushPreparedTree(dir),/prepared_payload_not_regular/);}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
