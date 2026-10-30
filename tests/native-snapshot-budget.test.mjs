import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {testDirectory} from './paths.mjs';import {ensureHost} from '../server/build.mjs';import {fileURLToPath} from 'node:url';
test('native snapshot budget never widens configured limit',{skip:process.platform!=='win32'},()=>{
 const exe=path.join(testDirectory('native-snapshot-budget'),'SnapshotBudgetTests.exe');
 const csc=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 const build=spawnSync(csc,['-nologo','-out:'+exe,fileURLToPath(new URL('./NativeSnapshotBudgetTests.cs',import.meta.url))],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(build.status,0,build.stdout+build.stderr);
 const run=spawnSync(exe,[ensureHost().exe],{windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/no input APIs used/);
});
