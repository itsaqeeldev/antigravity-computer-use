import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
export function scheduleUpdates(policy){
 if(!policy.installed||!policy.data_dir)return ()=>{};
 const target=path.dirname(policy.data_dir),script=fileURLToPath(new URL('../scripts/update.mjs',import.meta.url));let child;
 const check=()=>{if(child)return;child=spawn(process.execPath,[script,target,'scheduled'],{windowsHide:true,stdio:'ignore'});child.once('error',()=>{child=null;});child.once('exit',()=>{child=null;});};
 const initial=setTimeout(check,10000);initial.unref();const timer=setInterval(check,3600000);timer.unref();
 return ()=>{clearTimeout(initial);clearInterval(timer);};
}
