// Transport qualification only: no windows, clipboard access or input APIs.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';import {fileURLToPath} from 'node:url';
import {testDirectory} from './paths.mjs';import {Driver} from '../server/driver.mjs';import {serveDesktop} from '../server/desktop-service.mjs';
import {Runtime,appKey} from '../server/runtime.mjs';
const childResult=(exe,args,env)=>new Promise((resolve,reject)=>{const p=spawn(exe,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);const timeout=setTimeout(()=>{p.kill();reject(Error('Transport fixture timed out'));},10000);p.once('error',e=>{clearTimeout(timeout);reject(e);});p.once('exit',code=>{clearTimeout(timeout);resolve({code,stdout,stderr});});});
test('ZWJ/ZWNJ and exact emoji survive PowerShell, CLI, IPC, Runtime, Driver and native JSON serialization',{skip:process.platform!=='win32'},async()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'unicode-transport-')),data=path.join(dir,'data');
 const cs=path.join(dir,'JsonEcho.cs'),exe=path.join(dir,'JsonEcho.exe');
 fs.writeFileSync(cs,`using System;using System.Text;using System.Collections.Generic;using System.Web.Script.Serialization;
class JsonEcho {static void Main(){Console.InputEncoding=new UTF8Encoding(false);Console.OutputEncoding=new UTF8Encoding(false);var json=new JavaScriptSerializer();string line;while((line=Console.ReadLine())!=null){var m=(Dictionary<string,object>)json.DeserializeObject(line);var a=(Dictionary<string,object>)m["args"];object result=(string)m["op"]=="authorize"?(object)new {sensitive=false}:(object)new {echo=a["text"]};Console.WriteLine(json.Serialize(new {id=m["id"],ok=true,result=result}));Console.Out.Flush();}}}`);
 const compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 const build=spawnSync(compiler,['-nologo','-r:System.Web.Extensions.dll','-out:'+exe,cs],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(build.status,0,build.stdout+build.stderr);
 const native=spawn(exe,[],{windowsHide:true,stdio:['pipe','pipe','pipe']});native.stdin.on('error',()=>{});native.stderr.resume();
 const nativeClosed=new Promise(resolve=>native.once('close',resolve));
 const driver=new Driver();driver.proc=native;driver.info={pid:native.pid};
 const lines=createInterface({input:native.stdout});lines.on('line',line=>driver._onLine(line));
 const window={hwnd:1,pid:123,started:'fixture-birth',path:'C:/owned/TextTarget.exe'};
 const runtime={permissionMode:'standalone',driver,frames:new Map(),generation:1,remaining:200,deadline:Date.now()+30000,
  guardian:{send(){}},sessions:{async withInput(_op,_meta,fn){return fn();}},check(){},stamp(){return {};},async grant(){return window;},async app(){return window;},async observe(){return {metadata:{observation_id:'returned-frame',tree:'inert transport target'}};},
  async action(op,args){assert.equal(op,'paste');this.frames.set('fixture',{at:Date.now(),hwnd:1,key:appKey(window),snapshot:'native-fixture',workerEpoch:driver.epoch});return Runtime.prototype.action.call(this,op,args);},async close(){}};
 const service=await serveDesktop({directory:data,runtime});
 try{
  const sample='Computer use qualification\nاردو — 4× 👩🏽\u200d💻\nمی\u200cخواهم\nDone.';
  const textFile=path.join(dir,'source.txt');fs.writeFileSync(textFile,'\ufeff'+sample,'utf8');
  const quote=s=>"'"+s.replaceAll("'","''")+"'",cli=fileURLToPath(new URL('../scripts/desktop.mjs',import.meta.url));
  const env={...process.env,AGCU_DATA_DIR:data,AGCU_PERMISSION_MODE:'standalone'};delete env.CU_PLUGIN_DATA;delete env.CLAUDE_PLUGIN_DATA;
  for(const args of ['--text '+quote(sample),'--text-file '+quote(textFile)]){
   const script=`& ${quote(process.execPath)} ${quote(cli)} paste --hwnd 1 --observation-id fixture --index 0 --reason 'Synthetic transport test' ${args}`;
   const result=await childResult(path.join(process.env.WINDIR||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],env);
   assert.equal(result.code,0,result.stderr);const reply=JSON.parse(result.stdout);assert.equal(reply.result.echo,sample);assert.deepEqual([...reply.result.echo].map(c=>c.codePointAt(0)),[...sample].map(c=>c.codePointAt(0)));
  }
 }finally{await service.shutdown();native.stdin.end();if(native.exitCode===null)native.kill();await nativeClosed;lines.close();driver._failAll(Error('Fixture closed'));fs.rmSync(dir,{recursive:true,force:true});}
});
