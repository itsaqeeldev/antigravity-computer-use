// One command per observed desktop step. Persistent native session via local IPC.
import {performance} from 'node:perf_hooks';
const tBootstrap = performance.nodeTiming?.bootstrapComplete ?? 0;
const tEntry = performance.now();
// Entry timestamp records script top-level execution start relative to process initialization.
// Includes OS process bootstrap, Node/V8 runtime initialization, and resolution/evaluation of static imports.

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {dataDir} from '../server/build.mjs';
import {VERSION,BUILD_ID} from '../server/version.mjs';
import {TOOLS,validate,validateSchema} from '../server/desktop-tools.mjs';
import {parseArguments,parseRunArguments} from './arguments.mjs';
import {storageOperation} from '../server/storage.mjs';
import {loadDeployment,applyDeployment} from '../server/deployment.mjs';

const moduleLoadMs = tBootstrap > 0 ? Math.max(0, Math.round((tEntry - tBootstrap) * 10) / 10) : 0;
// Module timing measures elapsed time from Node bootstrap completion until top-level execution,
// capturing resolution, parsing, and execution of this module and its static import graph.

const EMPTY_INPUT={type:'object',properties:{},required:[],additionalProperties:false};
const LIFECYCLE=[
  {command:'start',description:'Start or reconnect to this exact installed build. Never clears emergency Stop or changes the installed permission policy.',inputSchema:{type:'object',properties:{quick:{type:'boolean',description:'Fast verification without verbose status or redundant storage operations.'}},required:[],additionalProperties:false}},
  {command:'serve',description:'Run the exact installed service in the foreground. For an interactive host terminal use run_command IsDaemon:true and WaitMsBeforeAsync:1000. Windows exebox terminals need the installed App sidecar or local starter. No permission/data overrides. Reuses only a matching live build/policy.',inputSchema:EMPTY_INPUT},
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
export function briefReply(value){
 const out={...value};
 if(out.metadata){const m=out.metadata;delete out.metadata;out.observation_id=m.observation_id;out.hwnd=m.hwnd;out.tree=m.tree;}
 if(out.image){out.image={path:out.image.path,width:out.image.width,height:out.image.height};}
 if(out.windows)out.windows=out.windows.map(({hwnd,title,process,minimized,foreground})=>({hwnd,title,process,minimized,foreground}));
 return out;
}
let replyMode='json';
const printReply=value=>console.log(encodeReply(replyMode==='brief'?briefReply(value):value));

export function request(session,command,args={},timeout=100000,expectedPermissionMode){
  return new Promise((resolve,reject)=>{
    let buffer='',settled=false,connected=false;
    const t0=performance.now();
    let tConn=0,tWrite=0;
    const socket=net.createConnection(session.pipe);
    socket.setEncoding('utf8');
    const done=(error,result)=>{
      if(settled)return;
      settled=true;
      socket.destroy();
      if(error){
        error.pipe_connect_ms=tConn?Math.round((tConn-t0)*10)/10:Math.round((performance.now()-t0)*10)/10;
        reject(error);
      }else{
        resolve(result);
      }
    };
    socket.setTimeout(timeout,()=>done(Object.assign(Error('Desktop request timed out; session was cancelled. Observe status before continuing.'),{code:'request_timeout'})));
    socket.on('connect',()=>{
      connected=true;
      tConn=performance.now();
      tWrite=tConn;
      socket.write(JSON.stringify({secret:session.secret,command,args,expected_build_id:BUILD_ID,expected_permission_mode:expectedPermissionMode})+'\n');
    });
    socket.on('data',chunk=>{
      buffer+=chunk;
      if(Buffer.byteLength(buffer)>4*1024*1024)return done(Object.assign(Error('Desktop response too large'),{code:'response_too_large'}));
      if(buffer.includes('\n')){
        const tReceived=performance.now();
        try{
          const parsed=JSON.parse(buffer.slice(0,buffer.indexOf('\n')));
          if(tConn){
            parsed.__pipe_connect_ms=Math.round((tConn-t0)*10)/10;
            const roundtrip=Math.round((tReceived-tWrite)*10)/10;
            parsed.__service_ms=parsed.receipt?.elapsed_ms??0;
            parsed.__transport_ms=Math.max(0,Math.round((roundtrip-parsed.__service_ms)*10)/10);
          }
          done(null,parsed);
        }catch(error){
          done(Object.assign(Error('Malformed JSON response from desktop service: '+error.message),{code:'malformed_response',cause:error}));
        }
      }
    });
    socket.on('error',error=>done(Object.assign(Error(connected?'Desktop connection lost; input delivery may be unknown. Do not replay the action. Inspect status and observe again.':'The saved desktop service is unreachable. Inspect/restart the installed Computer Use App sidecar or use its human starter from the normal Windows desktop, then discover apps and observe again. Isolated exebox terminals cannot start visible-desktop control. Do not use WMI or bypass host security. Emergency Stop remains latched.'),{code:connected?'connection_lost':'session_unavailable',cause:error})));
    socket.on('end',()=>{if(!settled)done(Object.assign(Error('Desktop session disconnected; do not replay the action.'),{code:'connection_lost'}));});
  });
}

export async function main(){
  let sessionReadMs=0,pipeConnectMs=0,serviceMs=0,transportMs=0;
  const [rawCommand,...rest]=process.argv.slice(2);const command=rawCommand?.replace(/^computer_/,'');
  const emitTiming=(res,err)=>{
    if(process.env.AGCU_TIMING!=='1')return;
    const tNow=performance.now();
    const payload={
      timing_schema:'agcu-timing-v2',
      entry_timestamp_ms:Math.round(tEntry*10)/10,
      module_load_ms:Math.round(moduleLoadMs*10)/10,
      session_read_ms:sessionReadMs,
      pipe_connect_ms:res?.__pipe_connect_ms??err?.pipe_connect_ms??pipeConnectMs,
      service_ms:res?.__service_ms??serviceMs,
      transport_ms:res?.__transport_ms??transportMs,
      internal_cli_ms:Math.round(tNow*10)/10,
      node_startup_ms:Math.round(tEntry*10)/10,
      total_cli_ms:Math.round(tNow*10)/10,
      ok:!err&&(res?.ok!==false),
      command:command||'none',
      delivery_uncertain:res?.delivery_unknown===true||err?.code==='connection_lost'
    };
    if(res){delete res.__pipe_connect_ms;delete res.__service_ms;delete res.__transport_ms;}
    process.stderr.write(JSON.stringify(payload)+'\n');
  };

  const jsonIdx = rest.indexOf('--json');
  const jsonMode = jsonIdx !== -1;
  if(jsonMode) rest.splice(jsonIdx, 1);
  replyMode = jsonMode || (rest.length && (!rest[0].startsWith('--') || rest[0] === '--request')) ? 'json' : 'brief';

  if(rest[0]==='--help'){const desc=describeCommand(command);emitTiming(desc);printReply(desc);return;}
  if(command==='describe'||(command==='--help'&&rest[0])){
    let reply;
    if(rest[0]==='--all')reply={commands:[...LIFECYCLE,...TOOLS.map(tool=>describeCommand(tool.name))]};
    else if(rest.length>1)reply={commands:rest.map(describeCommand)};
    else reply=rest[0]?describeCommand(rest[0]):{commands:[...LIFECYCLE,...TOOLS.map(tool=>({command:tool.name.replace(/^computer_/,''),description:tool.description}))].map(({command,description})=>({command,description}))};
    emitTiming(reply);printReply(reply);return;
  }
  if(!command||command==='--help'){
    console.log('Native desktop skill (no MCP)\nserve | start | shutdown | describe [COMMAND...] | describe --all | '+TOOLS.map(tool=>tool.name.replace(/^computer_/,'' )).join(' | ')+'\nAntigravity: reuse the installed App sidecar; isolated exebox terminals cannot start visible-desktop control. The human starter runs on the normal Windows desktop. Interactive external terminals may use start or foreground serve. Fast path: snapshot --hwnd 123; click --hwnd 123 --observation-id FRAME --index 7 --reason "Open settings". Named action flags return a compact tree without a new image unless --image is requested. Open actual image.path at visual checkpoints. Use --text-file for generated bulk text. Fast batches: run --hwnd 123 --observation-id FRAME --reason "Import sample" --step click --index 7 --risk routine --step file_dialog --path "D:/sample.png" --action open --entry-method clipboard. Owner/frame/reason precede all --step groups. No JSON/plan file is needed; the final step returns an image by default. No per-action request/result files or JPEG copies are needed. One describe call can fetch multiple schemas; do not interrogate every command at startup. JSON inline and --request FILE remain supported; --json retains full output. Esc stops; only the human can re-arm.');
    emitTiming({ok:true});return;
  }
  const schema=describeCommand(command).inputSchema;
  const args=command==='run'?parseRunArguments(schema,rest,describeCommand):parseArguments(schema,rest);
  try{
    validateSchema(schema,args,'arguments');
    if(TOOLS.some(tool=>tool.name==='computer_'+command))validate('computer_'+command,args);
  }catch(error){
    throw Object.assign(error,{code:error.code||'bad_arguments'});
  }
  const policy=applyDeployment(loadDeployment());
  const file=path.join(dataDir(),'desktop-session.json');
  if(command==='start'||command==='serve'){
    storageOperation('data',dataDir());
    let existing,saved;
    const tS0=performance.now();
    try{
      saved=JSON.parse(fs.readFileSync(file,'utf8'));
      sessionReadMs=Math.round((performance.now()-tS0)*10)/10;
      existing=await request(saved,'status',{},1500,policy.permission_mode);
      pipeConnectMs=existing.__pipe_connect_ms??0;
      serviceMs=existing.__service_ms??0;
      transportMs=existing.__transport_ms??0;
    }catch{}
    if(existing?.ok){
      if(existing.build_id!==BUILD_ID||existing.build_version!==VERSION)throw Error('A different runtime version owns the live session. End and shutdown that session before starting this build; do not interrupt another task.');
      if(existing.permission_mode!==policy.permission_mode)throw Object.assign(Error('A different permission policy owns the live session. Finish and shutdown its task before using this installed policy; no override was applied.'),{code:'deployment_policy_mismatch'});
      const reply=args.quick?{ok:true,state:existing.state,build_id:existing.build_id,build_version:existing.build_version}:existing;
      emitTiming(reply);
      printReply(reply);
      return;
    }
    // An unresponsive live service may still be controlling the desktop. Never
    // replace its capability file or create a competing guardian after timeout.
    if(Number.isSafeInteger(saved?.pid)&&saved.pid>0){
      let alive=true;try{process.kill(saved.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
      if(alive)throw Object.assign(Error('The existing desktop service is still running but did not answer. Do not start another controller. Wait for recovery or use the local Stop control; no replacement was launched.'),{code:'session_unresponsive'});
    }
    if(command==='serve'){
      const {serveDesktop}=await import('../server/desktop-service.mjs');
      const service=await serveDesktop({idlePolicy:policy.idle_policy||'shutdown'});
      const rep={ok:true,...service.status(),service_mode:'foreground',requires_background_execution:true};
      emitTiming(rep);
      printReply(rep);
      return;
    }
    // Fixed deployment policy: never accept permission overrides in an action.
    // Host-managed is opt-in at installation; default is local human dialogs.
    if(!['standalone','host-managed'].includes(policy.permission_mode))throw Error('Invalid installed desktop policy');
    const child=spawn(process.execPath,[fileURLToPath(new URL('../server/desktop-service.mjs',import.meta.url)),'--serve'],{detached:true,windowsHide:true,stdio:'ignore',env:{...process.env,AGCU_PERMISSION_MODE:policy.permission_mode}});child.unref();
    for(let i=0;i<100;i++){
      await new Promise(resolve=>setTimeout(resolve,100));
      try{
        const session=JSON.parse(fs.readFileSync(file,'utf8'));
        const found=await request(session,'status',{},1500,policy.permission_mode);
        if(found.ok&&found.build_id===BUILD_ID&&found.permission_mode===policy.permission_mode){
          const rep=args.quick?{ok:true,state:found.state,build_id:found.build_id,build_version:found.build_version}:found;
          emitTiming(rep);
          printReply(rep);
          return;
        }
      }catch{}
    }
    throw Error('Native session did not start; run the service in foreground for diagnostics.');
  }
  const tS0=performance.now();
  if(!fs.existsSync(file)){
    sessionReadMs=Math.round((performance.now()-tS0)*10)/10;
    if(command==='status'){
      const rep={ok:true,state:fs.existsSync(path.join(dataDir(),'emergency.stop'))?'stopped':'not_running',build_version:VERSION,build_id:BUILD_ID,reconnect_required:true};
      emitTiming(rep);
      printReply(rep);
      return;
    }
    throw Object.assign(Error('No desktop session is running (it may have expired after 15 idle minutes). Restart the installed App sidecar (or use its human starter on the normal Windows desktop), then discover apps and take a fresh observation. Antigravity does not need to restart; emergency Stop remains latched.'),{code:'no_session'});
  }
  const session=JSON.parse(fs.readFileSync(file,'utf8'));
  sessionReadMs=Math.round((performance.now()-tS0)*10)/10;
  if(command==='shutdown'){
    const previous=await request(session,'status',{},100000,policy.permission_mode);
    // Preserve an old adapter's stop during migration, before that process exits.
    if(previous.state==='stopped')fs.writeFileSync(path.join(dataDir(),'emergency.stop'),'stopped');
  }
  const timeout=Number(process.env.AGCU_REQUEST_TIMEOUT_MS)||100000;
  const result=await request(session,command,args,timeout,policy.permission_mode);
  pipeConnectMs=result.__pipe_connect_ms??0;
  serviceMs=result.__service_ms??0;
  transportMs=result.__transport_ms??0;
  emitTiming(result);
  printReply(result);
  if(!result.ok)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    if(process.env.AGCU_TIMING==='1'){
      const tNow=performance.now();
      const payload={
        timing_schema:'agcu-timing-v2',
        entry_timestamp_ms:Math.round(tEntry*10)/10,
        module_load_ms:Math.round(moduleLoadMs*10)/10,
        session_read_ms:0,
        pipe_connect_ms:error?.pipe_connect_ms??0,
        service_ms:0,
        transport_ms:0,
        internal_cli_ms:Math.round(tNow*10)/10,
        node_startup_ms:Math.round(tEntry*10)/10,
        total_cli_ms:Math.round(tNow*10)/10,
        ok:false,
        command:process.argv[2]?.replace(/^computer_/,'')||'none',
        delivery_uncertain:error?.code==='connection_lost'
      };
      process.stderr.write(JSON.stringify(payload)+'\n');
    }
    printReply({ok:false,error:{code:error.code||'refused',message:error.message}});
    process.exitCode=1;
  });
}

