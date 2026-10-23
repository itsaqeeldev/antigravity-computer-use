import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
test('MCP cancellation stops only the matching live request',async()=>{
 const code=`import {serve} from './server/mcp.mjs';let stops=0;serve({permissionMode:'host-managed',status:()=>({stops}),stop:async()=>{stops++;},close:async()=>{},grant:async()=>{await new Promise(r=>setTimeout(r,300));return {fixture:true};}});`;
 const p=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true,stdio:['pipe','pipe','pipe']});const pending=new Map();let seq=10;
 createInterface({input:p.stdout}).on('line',line=>{const m=JSON.parse(line);pending.get(m.id)?.(m.result);pending.delete(m.id);});
 const send=m=>p.stdin.write(JSON.stringify({jsonrpc:'2.0',...m})+'\n');
 const ask=(method,params={},id=++seq)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('protocol timeout')),4000);pending.set(id,r=>{clearTimeout(timer);resolve(r);});send({id,method,params});});
 const cancel=requestId=>send({method:'notifications/cancelled',params:{requestId}});
 const status=async()=>JSON.parse((await ask('tools/call',{name:'computer_status',arguments:{}})).content[0].text).stops;
 try{
  await ask('initialize');cancel(999);assert.equal(await status(),0);
  const active=ask('tools/call',{name:'computer_grant',arguments:{hwnd:1,reason:'fixture'}},1);
  cancel(2);assert.equal(await status(),0);cancel(1);assert.equal(await status(),1);await active;
  cancel(1);assert.equal(await status(),1);
 }finally{p.stdin.end();p.kill();}
});
