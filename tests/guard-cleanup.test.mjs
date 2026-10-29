import {testDirectory} from './paths.mjs';import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('native guardian cleanup continues after individual failures',{skip:process.platform!=='win32'},()=>{
 const dir=testDirectory('guard-cleanup');fs.mkdirSync(dir,{recursive:true});const exe=path.join(dir,'GuardCleanupTests.exe');
 const csc=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 const build=spawnSync(csc,['-nologo','-out:'+exe,path.resolve('server/native/GuardCleanup.cs'),path.resolve('tests/GuardCleanupTests.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(build.status,0,build.stdout+build.stderr);
 const result=spawnSync(exe,[],{windowsHide:true,encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/all cleanup operations attempted/);
});
