// Explicit native fault injection. Run only in an exclusive desktop window.
// This is not actual application/Agent Manager acceptance.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';import {createInterface} from 'node:readline';
const [releaseArg,evidenceArg]=process.argv.slice(2);
if(!releaseArg||!evidenceArg)throw Error('Pass exact release folder and NEW private evidence folder. Requires an exclusive interactive Windows desktop.');
const release=path.resolve(releaseArg),evidence=path.resolve(evidenceArg),target=path.join(evidence,'FailureTarget.exe');
if(fs.existsSync(evidence))throw Error('Preserve prior evidence: choose a new folder');
fs.mkdirSync(evidence,{recursive:true});
const framework=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319');
const refs=['PresentationFramework','PresentationCore','WindowsBase','UIAutomationProvider','UIAutomationTypes'].map(name=>'-r:'+path.join(framework,'WPF',name+'.dll'));
const compiled=spawnSync(path.join(framework,'csc.exe'),['-nologo','-target:winexe','-out:'+target,'-r:System.Xaml.dll',...refs,fileURLToPath(new URL('./ProviderFailureTarget.cs',import.meta.url))],{windowsHide:true,encoding:'utf8'});
fs.writeFileSync(path.join(evidence,'compile.json'),JSON.stringify({status:compiled.status,stdout:compiled.stdout,stderr:compiled.stderr,error:compiled.error?.message},null,2));
if(compiled.status!==0)throw Error('Owned target compilation failed; see compile.json. No desktop target was started.');
process.env.AGCU_DATA_DIR=path.join(evidence,'runtime');
delete process.env.CU_PLUGIN_DATA;delete process.env.CLAUDE_PLUGIN_DATA;
const {Runtime}=await import(pathToFileURL(path.join(release,'server/runtime.mjs')).href);
const manifest=JSON.parse(fs.readFileSync(path.join(release,'bundle-manifest.json'),'utf8'));
const record={completed:false,safety_pass:false,fixture:true,build_id:manifest.build_id,native_sha:manifest.host_sha256,cases:[],states:[]};
const r=new Runtime({permissionMode:'host-managed'});
r.guardian.on('state',(state,reason)=>record.states.push({state,reason}));
const child=spawn(target,[],{windowsHide:false,stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',s=>stderr+=s);
try {
 const info=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Owned provider target did not become ready')),15000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);reject(Error('Owned provider target exited before ready: '+code));});
  createInterface({input:child.stdout}).on('line',line=>{try{const info=JSON.parse(line);if(info.pid===child.pid&&Number.isSafeInteger(info.hwnd)&&info.hwnd>0){clearTimeout(timer);resolve(info);}}catch{}});
 });
 record.target_pid=info.pid;record.target_hwnd=info.hwnd;
 for(const [id,label,expected] of [['after-effect','After effect',1],['before-effect','Before effect',0]]){
  const before=await r.observe({hwnd:info.hwnd});
  if(!record.initial_image){const file=path.join(evidence,'initial.jpg');fs.writeFileSync(file,Buffer.from(before.image.data,'base64'));record.initial_image=file;}
  const button=before.metadata.elements.find(n=>n.id===id||n.automation_id===id||n.name===(id==='after-effect'?'Dispatch then throw':'Refuse without effect'));
  if(!button)throw Error('Expected owned provider button missing: '+id);
  let result,error;
  try{result=await r.action('click',{hwnd:info.hwnd,observation_id:before.metadata.observation_id,index:button.i,risk:'routine',reason:'Owned fault provider: one action then inspect, never retry',observe:{with_image:false}});}
  catch(e){error={code:e.code,message:e.message,hint:e.hint};}
  const after=await r.observe({hwnd:info.hwnd,with_image:false});
  const text=after.metadata.tree;
  const counters=after.metadata.elements.map(n=>String(n.name||n.text||'')).find(n=>n.startsWith(label+': dispatches='));
  const numbers=counters&&/dispatches=(\d+), effects=(\d+), physical=(\d+)/.exec(counters);
  const safe=!!numbers&&Number(numbers[1])===1&&Number(numbers[2])===expected&&Number(numbers[3])===0&&error?.code==='input_outcome_unknown';
  record.cases.push({id,safe,counters,result,error,tree:text});
 }
 record.completed=true;record.safety_pass=record.cases.every(c=>c.safe);
 if(!record.safety_pass)process.exitCode=1;
}catch(error){record.error=error.stack;process.exitCode=1;}
finally {
 try{await r.finish();await r.close();}catch(error){record.cleanup_error=error.message;process.exitCode=1;}
 child.kill();record.target_stderr=stderr;
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(record,null,2));
 console.log(JSON.stringify({completed:record.completed,safety_pass:record.safety_pass,fixture:true,build_id:record.build_id,native_sha:record.native_sha,cases:record.cases.map(({id,safe,counters,error})=>({id,safe,counters,error})),error:record.error,cleanup_error:record.cleanup_error,evidence},null,2));
}
