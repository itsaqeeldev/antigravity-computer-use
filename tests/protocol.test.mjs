import {testDirectory} from './paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import fs from 'node:fs';import path from 'node:path';
test('real stdio MCP startup and discovery without screen access',async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-protocol-'));
 const p=spawn(process.execPath,['server/index.mjs'],{windowsHide:true,env:{...process.env,AGCU_DATA_DIR:dir},stdio:['pipe','pipe','pipe']});
 const pending=new Map();let seq=0;let stderr='';p.stderr.on('data',d=>stderr+=d);
 createInterface({input:p.stdout}).on('line',line=>{const m=JSON.parse(line);const f=pending.get(m.id);if(f){pending.delete(m.id);f(m);}});
 const ask=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const t=setTimeout(()=>reject(new Error('timeout '+stderr)),5000);pending.set(id,m=>{clearTimeout(t);resolve(m.result);});p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 try{assert((await ask('initialize')).serverInfo.name.includes('antigravity'));assert((await ask('tools/list')).tools.length>=18);const status=await ask('tools/call',{name:'computer_status',arguments:{}});assert(status.content[0].text.includes('idle'));}
 finally{p.stdin.end();await new Promise(resolve=>{p.once('exit',resolve);setTimeout(()=>{p.kill();resolve();},3000).unref();});fs.rmSync(dir,{recursive:true,force:true});}
});
