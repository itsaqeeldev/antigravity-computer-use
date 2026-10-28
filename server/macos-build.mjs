// Native adapters only. Tool dispatch, control lifecycle and IPC stay shared.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export function buildMacStorage({force=false}={}) {
  if(process.platform!=='darwin')throw Object.assign(Error('The macOS storage adapter must be built on macOS.'),{code:'unsupported_platform'});
  const prebuilt=path.join(root,'bin','StorageGuard');
  const sources=['PrivateStorage.swift','StorageMain.swift'].map(name=>path.join(root,'server/native/macos',name));
  if(!force&&fs.existsSync(prebuilt)&&sources.every(file=>!fs.existsSync(file)))return prebuilt;
  const found=spawnSync('/usr/bin/xcrun',['--find','swiftc'],{encoding:'utf8',timeout:10000});
  if(found.status!==0)throw Error('Building from source requires Xcode Command Line Tools. Prebuilt bundles do not.');
  const compiler=found.stdout.trim();const digest=createHash('sha256');
  for(const file of sources)digest.update(fs.readFileSync(file));
  digest.update(compiler);const dir=path.join(root,'.localdata','mac-storage-bin');
  const output=path.join(dir,'StorageGuard-'+digest.digest('hex').slice(0,16));
  if(!force&&fs.existsSync(output))return output;
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const temporary=output+'-'+randomUUID();
  const build=spawnSync(compiler,['-O','-parse-as-library','-o',temporary,...sources],{encoding:'utf8',timeout:60000});
  if(build.status!==0)throw Error('macOS storage compilation failed: '+(build.stderr||build.stdout));
  fs.chmodSync(temporary,0o755);fs.renameSync(temporary,output);return output;
}
