// Native integration only, never a desktop/physical-input acceptance claim.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {install} from './install.mjs';import {qualifySignedUpdate} from './qualify-signed-update.mjs';
if(process.platform!=='win32')throw Error('Windows qualification requires Windows.');
const root=fileURLToPath(new URL('../',import.meta.url)),base=path.join(root,'.localdata/tests/windows-native-install');fs.mkdirSync(base,{recursive:true});
const directory=fs.mkdtempSync(path.join(base,'run-')),home=path.join(directory,'home'),target=path.join(directory,'installed'),bundle=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'.localdata/windows-bundle');fs.mkdirSync(home);
let record;
try{
 try{record=install({bundle,target,home,sidecar:true,updateMode:'manual'});}catch(error){if(error.code==='insecure_storage_ancestor'){const result={qualified:false,skipped:true,reason:error.code,parent_permissions_changed:false};fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(result));console.log(JSON.stringify(result));process.exit(0);}throw error;}
 const cli=name=>{const p=spawnSync(path.join(record.release,'node.exe'),[record.launcher,name],{encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(p.status,0,p.stderr||p.stdout);return JSON.parse(p.stdout);};
 assert.equal(cli('start').state,'idle');cli('stop');cli('shutdown');
 const result=await qualifySignedUpdate({target,bundle,directory});fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify({qualified:true,...result}));console.log(JSON.stringify({qualified:true,...result}));
}finally{if(record)spawnSync(path.join(record.release,'node.exe'),[record.launcher,'shutdown'],{encoding:'utf8',windowsHide:true,timeout:20000});}
