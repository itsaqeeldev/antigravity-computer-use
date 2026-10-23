import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
test('native keyboard scope accepts child surfaces but refuses other roots and unknown handles',()=>{
 const dir=path.resolve('.localdata/keyboard-target-tests');fs.mkdirSync(dir,{recursive:true});const exe=path.join(dir,'KeyboardTargetTests.exe');
 const csc=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 const built=spawnSync(csc,['-nologo','-out:'+exe,path.resolve('server/native/KeyboardTargetPolicy.cs'),path.resolve('tests/KeyboardTargetTests.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(built.status,0,built.stdout+built.stderr);
 const run=spawnSync(exe,[],{windowsHide:true,encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
});
