// Local, capability-authenticated IPC for skill scripts. No MCP or model SDK.
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {Runtime} from './runtime.mjs';
import {call} from './desktop-tools.mjs';
import {dataDir} from './build.mjs';
import {BUILD_ID} from './version.mjs';

export function compact(result,dir){
  const value={...result};
  if(value.metadata){value.metadata={...value.metadata};delete value.metadata.elements;}
  if(result.image?.data){
    const folder=path.join(dir,'observations');fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,result.metadata.observation_id+'.jpg');
    fs.writeFileSync(file,Buffer.from(result.image.data,'base64'),{mode:0o600});
    value.image={path:file,width:result.image.width,height:result.image.height,source:result.image.source};
    // Observations are short-lived local data, not an unbounded screen archive.
    const files=fs.readdirSync(folder).map(name=>({name,at:fs.statSync(path.join(folder,name)).mtimeMs})).sort((a,b)=>b.at-a.at);
    for(const old of files.slice(50))fs.unlinkSync(path.join(folder,old.name));
  }
  return value;
}

export async function serveDesktop({directory=dataDir(),runtime=new Runtime()}={}){
  fs.mkdirSync(directory,{recursive:true});
  await runtime.prepare?.();
  const secret=randomBytes(32).toString('hex');
  const pipe=process.platform==='win32'?`\\\\.\\pipe\\agcu-${randomBytes(18).toString('hex')}`:path.join(directory,`desktop-${process.pid}.sock`);
  const file=path.join(directory,'desktop-session.json');
  let busy=false,closing=false,lastCall=Date.now(),expiry,shutdownPending;
  const sockets=new Set();
  const shutdown=()=>{
    if(shutdownPending)return shutdownPending;
    shutdownPending=(async()=>{closing=true;
    try{await runtime.close();}catch(error){closing=false;throw error;}
    clearInterval(expiry);
    for(const socket of sockets)socket.end();server.close();
    try{if(JSON.parse(fs.readFileSync(file)).pid===process.pid)fs.unlinkSync(file);}catch{}
    })().catch(error=>{shutdownPending=null;throw error;});
    return shutdownPending;
  };
  const server=net.createServer(socket=>{
    socket.setEncoding('utf8');
    sockets.add(socket);let buffer='',received=false,executing=false,finished=false;
    socket.setTimeout(105000,()=>socket.destroy());
    socket.on('error',()=>{});
    socket.on('close',()=>{sockets.delete(socket);if(executing&&!finished)runtime.stop().catch(()=>{});});
    socket.on('data',chunk=>{
      if(received)return;buffer+=chunk;
      if(Buffer.byteLength(buffer)>1024*1024){received=true;socket.destroy();return;}
      if(!buffer.includes('\n'))return;received=true;
      (async()=>{
        let request;try{request=JSON.parse(buffer.slice(0,buffer.indexOf('\n')));}catch{throw Error('Invalid request');}
        const given=Buffer.from(String(request.secret||''));const expected=Buffer.from(secret);
        if(given.length!==expected.length||!timingSafeEqual(given,expected))throw Error('Unauthorized local client');
        lastCall=Date.now();
        const name=request.command?.startsWith('computer_')?request.command:'computer_'+request.command;
        if(closing&&!['computer_status','computer_stop','computer_shutdown'].includes(name))throw Error('Desktop service is shutting down; no more actions are accepted.');
        if(request.expected_build_id!==BUILD_ID&&!['computer_status','computer_stop','computer_pause','computer_end','computer_shutdown'].includes(name))
          throw Object.assign(Error('This command belongs to a different build. Use the running release; do not silently mix runtime versions.'),{code:'version_mismatch'});
        const control=['computer_status','computer_stop','computer_pause','computer_shutdown'].includes(name);
        if(busy&&!control)throw Error('Desktop operation pending; send one action at a time.');
        if(name==='computer_shutdown'){
          // Do not acknowledge a closed service before native cleanup succeeds.
          // Keep this reply socket alive while retiring all other clients.
          sockets.delete(socket);await shutdown();finished=true;
          socket.end(JSON.stringify({ok:true,closed:true})+'\n');return;
        }
        if(!control){busy=true;executing=true;}
        try{
          const result=compact(await call(runtime,name,request.args||{}),directory);
          finished=true;socket.end(JSON.stringify({ok:true,...result})+'\n');
        }finally{if(!control)busy=false;}
      })().catch(error=>{finished=true;socket.end(JSON.stringify({ok:false,error:{code:error.code||'refused',message:error.message,...(error.hint?{hint:error.hint}:{})}})+'\n');});
    });
  });
  server.on('error',()=>shutdown().catch(()=>{}));
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(pipe,resolve);});
  fs.writeFileSync(file,JSON.stringify({pid:process.pid,pipe,secret}),{mode:0o600});
  expiry=setInterval(()=>{if(Date.now()-lastCall>15*60000)shutdown().catch(()=>{});},10000);expiry.unref();
  process.once('SIGTERM',()=>shutdown().catch(()=>{}));process.once('SIGINT',()=>shutdown().catch(()=>{}));
  return {shutdown,server,file};
}

if(process.argv.includes('--serve'))await serveDesktop();
