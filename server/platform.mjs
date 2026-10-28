// One protocol and lifecycle; only native implementation details vary by OS.
import contract from './control-contract.json' with {type:'json'};
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export {contract};
export function nativePlatform(platform=process.platform){
  if(platform==='win32')return {platform,runtime:'native-windows',node:'node.exe',host:'AxonHost.exe',storage:'StorageGuard.exe',shortcut:'ctrl'};
  if(platform==='darwin')return {platform,runtime:'native-macos',node:'node',host:'AxonHost.app/Contents/MacOS/AxonHost',storage:'StorageGuard',shortcut:'cmd'};
  throw Object.assign(Error('Native desktop control is available only on Windows and macOS.'),{code:'unsupported_platform'});
}
export function verifyNativeContract(info,platform=process.platform){
  // The existing Windows helper already enforces this lifecycle. A Mac adapter
  // must explicitly attest integration; the old unguarded upstream port cannot run.
  if(platform==='darwin'&&(info?.control_contract!==contract.version||info?.native_fence!==true||info?.held_input_cleanup!==true))
    throw Object.assign(Error('This Mac helper lacks the shared native control contract. Update the complete installation.'),{code:'native_contract_mismatch'});
}
export function launchTarget(raw,platform=process.platform){
  const app=path.resolve(raw);
  if(platform==='win32'){
    if(!fs.existsSync(app)||path.extname(app).toLowerCase()!=='.exe')throw Object.assign(Error('Supply an existing .exe path.'),{code:'invalid_application'});
    return {app,executable:app};
  }
  if(platform!=='darwin'||path.extname(app)!=='.app'||!fs.statSync(app,{throwIfNoEntry:false})?.isDirectory())
    throw Object.assign(Error('Supply an existing GUI .app bundle.'),{code:'invalid_application'});
  const plist=spawnSync('/usr/bin/plutil',['-extract','CFBundleExecutable','raw','-o','-',path.join(app,'Contents/Info.plist')],{encoding:'utf8',timeout:5000,maxBuffer:65536});
  const name=plist.stdout?.trim();
  if(plist.status!==0||!name||name.includes('/')||name==='.'||name==='..')throw Object.assign(Error('The application has no valid executable entry.'),{code:'invalid_application'});
  const executable=fs.realpathSync(path.join(app,'Contents/MacOS',name));
  if(!fs.statSync(executable).isFile())throw Object.assign(Error('The app executable is unavailable.'),{code:'invalid_application'});
  return {app,executable};
}
