import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {testDirectory} from './paths.mjs';import {ensureStorageGuard} from '../server/storage.mjs';
test('native Windows layout admits its updater files while refusing unrelated data',{skip:process.platform!=='win32'},()=>{
 const directory=testDirectory('native-storage-layout'),fixture=fs.mkdtempSync(path.join(directory,'fixture-')),exe=path.join(directory,'LayoutTests.exe');
 try{
  const built=spawnSync(path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['-nologo','-out:'+exe,fileURLToPath(new URL('./NativeStorageLayoutTests.cs',import.meta.url))],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(built.status,0,built.stdout+built.stderr);
  const result=spawnSync(exe,[ensureStorageGuard(),fixture],{windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/no ACL or input changes/);
 }finally{fs.rmSync(fixture,{recursive:true,force:true});}
});
