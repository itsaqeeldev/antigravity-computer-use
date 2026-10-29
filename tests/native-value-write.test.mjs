import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {testDirectory} from './paths.mjs';import {ensureHost} from '../server/build.mjs';import {fileURLToPath} from 'node:url';
test('native value setter never replays an uncertain provider operation',{skip:process.platform!=='win32'},()=>{
 const dir=testDirectory('native-value-write'),exe=path.join(dir,'NativeValueWriteTests.exe');
 const compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
 const build=spawnSync(compiler,['-nologo','-out:'+exe,fileURLToPath(new URL('./NativeValueWriteTests.cs',import.meta.url))],{windowsHide:true,encoding:'utf8',timeout:30000});
 assert.equal(build.status,0,build.stdout+build.stderr);
 const run=spawnSync(exe,[ensureHost().exe],{windowsHide:true,encoding:'utf8',timeout:10000});
 assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/no input APIs used/);
});
