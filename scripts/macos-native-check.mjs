// Headless native checks only. Never request TCC, screenshots or desktop input.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ensureHost,dataDir} from '../server/build.mjs';
import {storageOperation,ensureStorageGuard} from '../server/storage.mjs';
if(process.platform!=='darwin')throw Error('Run this native check on macOS.');
const root=fileURLToPath(new URL('../',import.meta.url));
const storage=ensureStorageGuard();storageOperation('data',dataDir(),{helper:storage});
const {exe}=ensureHost({log:message=>console.log(message)});
const fence=path.join(dataDir(),'tests','mac-fence-contract');fs.mkdirSync(path.dirname(fence),{recursive:true,mode:0o700});storageOperation('data',fence,{helper:storage});
const result=spawnSync(exe,['--contract-test'],{encoding:'utf8',timeout:15000,env:{...process.env,AGCU_CONTRACT_FILE:path.join(root,'server/control-contract.json'),AGCU_PARENT_PID:String(process.pid),AGCU_GUARD_FILE:path.join(fence,'guard-state'),AGCU_STOP_LATCH:path.join(fence,'emergency.stop')}});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.status!==0)throw Error('Native Mac contract checks failed. No desktop qualification is implied.');
const dir=path.join(dataDir(),'tests','mac-storage-contract');fs.mkdirSync(path.dirname(dir),{recursive:true,mode:0o700});
storageOperation('data',dir,{helper:storage});storageOperation('verify-tree',dir,{helper:storage});
console.log(JSON.stringify({ok:true,checks:['native compilation','native control contract','POSIX private storage'],interactive_desktop_qualified:false}));
