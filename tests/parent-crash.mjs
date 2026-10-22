// Kills only its own test Node process; the native watchdog must remove its child.
import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import assert from 'node:assert/strict';import fs from 'node:fs';
const p=spawn(process.execPath,['tests/parent-worker.mjs'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
const host=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Test host startup timeout')),10000);createInterface({input:p.stdout}).on('line',l=>{try{const m=JSON.parse(l);if(m.host){clearTimeout(timer);resolve(m.host);}}catch{}});p.once('error',reject);});
p.kill();let exited=false;
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100));try{process.kill(host,0);}catch{exited=true;break;}}
assert(exited,'Native child must exit when its broker parent dies');
fs.mkdirSync('.localdata/native-evidence',{recursive:true});fs.writeFileSync('.localdata/native-evidence/parent-crash.json',JSON.stringify({passed:true,check:'Windows native watchdog exits/recovery after broker death'},null,2));console.log('Windows parent-death watchdog passed');
