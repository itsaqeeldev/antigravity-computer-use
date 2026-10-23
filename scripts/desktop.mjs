// One command per observed desktop step. Persistent native session via local IPC.
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {dataDir} from '../server/build.mjs';
import {VERSION,BUILD_ID} from '../server/version.mjs';
import {TOOLS} from '../server/desktop-tools.mjs';
const EMPTY_INPUT={type:'object',properties:{},required:[],additionalProperties:false};
const LIFECYCLE=[
  {command:'start',description:'Start or reconnect to this exact installed build. No arguments. Never clears emergency Stop or changes the installed permission policy.',inputSchema:EMPTY_INPUT},
  {command:'shutdown',description:'Shut down the native service after input cleanup. No arguments. Preserves emergency Stop for human re-arm.',inputSchema:EMPTY_INPUT},
  {command:'describe',description:'Read command descriptions or the exact argument schema for one command, without desktop access.',usage:'describe [COMMAND]',inputSchema:{type:'object',properties:{command:{type:'string'}},required:[],additionalProperties:false}}
];

export function describeCommand(name){
  const normalized=String(name).replace(/^computer_/,'');
  const intrinsic=LIFECYCLE.find(tool=>tool.command===normalized);if(intrinsic)return intrinsic;
  const tool=TOOLS.find(tool=>tool.name==='computer_'+normalized);
  if(!tool)throw Object.assign(Error('Unknown desktop command. Run --help for the command list.'),{code:'unknown_command'});
  return {command:tool.name.replace(/^computer_/,''),description:tool.description,inputSchema:tool.inputSchema};
}

// Windows PowerShell can decode native stdout using its legacy OEM code page
// before piping it to UTF-8. ASCII JSON preserves every Unicode code unit even
// through that boundary; JSON.parse restores the original text exactly.
export function encodeReply(value){return JSON.stringify(value).replace(/[^\x00-\x7f]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));}
const printReply=value=>console.log(encodeReply(value));

export function request(session,command,args={},timeout=100000){
  return new Promise((resolve,reject)=>{
    let buffer='',settled=false,connected=false;
    const socket=net.createConnection(session.pipe);
    socket.setEncoding('utf8');
    const done=(error,result)=>{if(settled)return;settled=true;socket.destroy();error?reject(error):resolve(result);};
    socket.setTimeout(timeout,()=>done(Error('Desktop request timed out; session was cancelled. Observe status before continuing.')));
    socket.on('connect',()=>{connected=true;socket.write(JSON.stringify({secret:session.secret,command,args,expected_build_id:BUILD_ID})+'\n');});
    socket.on('data',chunk=>{buffer+=chunk;if(Buffer.byteLength(buffer)>4*1024*1024)return done(Error('Desktop response too large'));if(buffer.includes('\n')){try{done(null,JSON.parse(buffer.slice(0,buffer.indexOf('\n'))));}catch(error){done(error);}}});
    socket.on('error',error=>done(Object.assign(Error(connected?'Desktop connection lost; input delivery may be unknown. Do not replay the action. Inspect status and observe again.':'The saved desktop service is unreachable. Run start to recover, then discover apps and observe again. Emergency Stop remains latched.'),{code:connected?'connection_lost':'session_unavailable',cause:error})));
    socket.on('end',()=>{if(!settled)done(Error('Desktop session disconnected; do not replay the action.'));});
  });
}

async function main(){
  const [command,...rest]=process.argv.slice(2);
  if(rest[0]==='--help'){printReply(describeCommand(command));return;}
  if(command==='describe'||(command==='--help'&&rest[0])){
    printReply(rest[0]?describeCommand(rest[0]):{commands:[...LIFECYCLE,...TOOLS.map(tool=>({command:tool.name.replace(/^computer_/,''),description:tool.description}))].map(({command,description})=>({command,description}))});return;
  }
  if(!command||command==='--help'){
    console.log('Native desktop skill (no MCP)\nstart | shutdown | describe [COMMAND] | '+TOOLS.map(tool=>tool.name.replace(/^computer_/,'' )).join(' | ')+'\nRun describe COMMAND (or --help COMMAND) for its exact JSON argument schema; no source inspection or desktop access is needed. Pass JSON inline or --request FILE. Every targeted action requires a fresh observation_id. Open image.path with your host image viewer. Esc stops; only the human can re-arm.');return;
  }
  const policyFile=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','desktop-policy.json');
  const policy=fs.existsSync(policyFile)?JSON.parse(fs.readFileSync(policyFile)):{permission_mode:'standalone'};
  if(policy.data_dir&&!process.env.AGCU_DATA_DIR)process.env.AGCU_DATA_DIR=policy.data_dir;
  const file=path.join(dataDir(),'desktop-session.json');
  if(command==='start'){
    let existing,saved;
    try{saved=JSON.parse(fs.readFileSync(file));existing=await request(saved,'status',{},1500);}catch{}
    if(existing?.ok){
      if(existing.build_id!==BUILD_ID||existing.build_version!==VERSION)throw Error('A different runtime version owns the live session. End and shutdown that session before starting this build; do not interrupt another task.');
      printReply(existing);return;
    }
    // An unresponsive live service may still be controlling the desktop. Never
    // replace its capability file or create a competing guardian after timeout.
    if(Number.isSafeInteger(saved?.pid)&&saved.pid>0){
      let alive=true;try{process.kill(saved.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
      if(alive)throw Object.assign(Error('The existing desktop service is still running but did not answer. Do not start another controller. Wait for recovery or use the local Stop control; no replacement was launched.'),{code:'session_unresponsive'});
    }
    // Fixed deployment policy: never accept permission overrides in an action.
    // Host-managed is opt-in at installation; default is local human dialogs.
    if(!['standalone','host-managed'].includes(policy.permission_mode))throw Error('Invalid installed desktop policy');
    const child=spawn(process.execPath,[fileURLToPath(new URL('../server/desktop-service.mjs',import.meta.url)),'--serve'],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env,AGCU_PERMISSION_MODE:policy.permission_mode}});child.unref();
    for(let i=0;i<100;i++){
      await new Promise(resolve=>setTimeout(resolve,100));
      try{const session=JSON.parse(fs.readFileSync(file));if(session.pid===child.pid){printReply(await request(session,'status'));return;}}catch{}
    }
    throw Error('Native session did not start; run the service in foreground for diagnostics.');
  }
  const args=rest[0]==='--request'?JSON.parse(fs.readFileSync(rest[1],'utf8').replace(/^\uFEFF/,'')):rest[0]?JSON.parse(rest[0]):{};
  if(!fs.existsSync(file)){
    if(command==='status'){printReply({ok:true,state:fs.existsSync(path.join(dataDir(),'emergency.stop'))?'stopped':'not_running',build_version:VERSION,build_id:BUILD_ID,reconnect_required:true});return;}
    throw Object.assign(Error('No desktop session is running (it may have expired after15 idle minutes). Run start, then discover apps and take a fresh observation. Antigravity does not need to restart; emergency Stop remains latched.'),{code:'no_session'});
  }
  const session=JSON.parse(fs.readFileSync(file));
  if(command==='shutdown'){
    const previous=await request(session,'status');
    // Preserve an old adapter's stop during migration, before that process exits.
    if(previous.state==='stopped')fs.writeFileSync(path.join(dataDir(),'emergency.stop'),'stopped');
  }
  const result=await request(session,command,args);printReply(result);if(!result.ok)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{printReply({ok:false,error:{code:error.code||'refused',message:error.message}});process.exitCode=1;});
