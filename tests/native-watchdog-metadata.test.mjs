import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {testDirectory} from './paths.mjs';import {ensureHost} from '../server/build.mjs';
test('native watchdog metadata replacement is atomic and preserves prior evidence on failure',{skip:process.platform!=='win32',timeout:60000},t=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'watchdog-metadata-')),exe=path.join(dir,'test.exe');
 try{
  const compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const build=spawnSync(compiler,['-nologo','-out:'+exe,fileURLToPath(new URL('./NativeWatchdogMetadataTests.cs',import.meta.url))],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(build.status,0,build.stdout+build.stderr);
  const run=spawnSync(exe,[ensureHost().exe,dir],{windowsHide:true,encoding:'utf8',timeout:15000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/no input APIs used/);t.diagnostic(run.stdout.trim());
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
