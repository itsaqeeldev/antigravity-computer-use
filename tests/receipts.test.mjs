import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Receipts} from '../server/receipts.mjs';import {serveDesktop} from '../server/desktop-service.mjs';import {request,briefReply} from '../scripts/desktop.mjs';
import {storageOperation} from '../server/storage.mjs';
test('automatic receipts record timing and outcomes without private payloads or capabilities',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agcu-receipts-'));try{
  const log=new Receipts(dir);const ticket=log.begin('computer_paste',{hwnd:123,text:'PRIVATE_TEXT',reason:'PRIVATE_REASON',secret:'PRIVATE_CAPABILITY'});
  const r=log.finish(ticket,{ok:true,input_completed:true,metadata:{observation_id:'fresh',tree:'PRIVATE_TREE'},result:{text:'PRIVATE_CLIPBOARD'}});
  assert(r.elapsed_ms>=0);assert(r.gap_ms>=0);const text=fs.readFileSync(r.path,'utf8');
  for(const privateValue of ['PRIVATE_TEXT','PRIVATE_REASON','PRIVATE_CAPABILITY','PRIVATE_TREE','PRIVATE_CLIPBOARD'])assert(!text.includes(privateValue));
  const record=JSON.parse(text);assert.equal(record.hwnd,123);assert.equal(record.input_completed,true);assert.equal(record.observation_id,'fresh');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('receipt rotation is bounded and failed receipt storage does not hide completed input',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agcu-receipts-'));try{
  const log=new Receipts(dir,{maxBytes:10});for(let i=0;i<5;i++)log.finish(log.begin('computer_status',{}),{ok:true,state:'idle'});
  assert.deepEqual(fs.readdirSync(dir).sort(),['desktop-receipts.jsonl','desktop-receipts.jsonl.previous']);
  const blocked=new Receipts(path.join(dir,'blocked'));fs.mkdirSync(blocked.file,{recursive:true});
  const value={ok:true,input_completed:true};const result=blocked.finish(blocked.begin('computer_click',{}),value);
  assert.equal(result.error,'receipt_storage_unavailable');assert.deepEqual(value,{ok:true,input_completed:true});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('failed image-file delivery preserves actual completed input and invalidates the unseen frame',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agcu-image-failure-'));storageOperation('data',dir);fs.writeFileSync(path.join(dir,'observations'),'blocked');let delivered=0;
 const runtime={frames:new Map([['new-frame',{}]]),async action(){delivered++;return {input_completed:true,metadata:{observation_id:'new-frame',tree:'Actual controls'},image:{data:Buffer.from('pixels').toString('base64'),width:100,height:80}};},async close(){}};
 const service=await serveDesktop({directory:dir,runtime});try{
  const session=JSON.parse(fs.readFileSync(service.file));const r=await request(session,'click',{hwnd:123,observation_id:'previous-frame',index:2,reason:'Click once'});
  assert.equal(r.ok,true);assert.equal(r.input_completed,true);assert.equal(r.verification_error.code,'image_delivery_failed');assert.equal(r.observation_valid,false);assert(!r.image);assert.equal(delivered,1);assert(!runtime.frames.has('new-frame'));assert(r.receipt.path);
 }finally{await service.shutdown();fs.rmSync(dir,{recursive:true,force:true});}
});
test('brief replies retain one-use references and delivery/failure evidence without duplicate metadata',()=>{
 const r=briefReply({ok:true,input_completed:true,verification_error:{code:'image_delivery_failed'},metadata:{hwnd:123,observation_id:'fresh',tree:'Controls',app:'Private path'},receipt:{elapsed_ms:7}});
 assert.equal(r.observation_id,'fresh');assert.equal(r.hwnd,123);assert.equal(r.tree,'Controls');assert.equal(r.input_completed,true);assert.equal(r.verification_error.code,'image_delivery_failed');assert.equal(r.receipt.elapsed_ms,7);assert(!r.metadata);
});
