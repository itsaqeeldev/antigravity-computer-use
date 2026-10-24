import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('native recovery journals owned inputs and survives partial delivery/release failure',()=>{
 const dir=testDirectory('input-ledger');fs.mkdirSync(dir,{recursive:true});const exe=path.join(dir,'InputLedgerTests.exe');
 const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 const build=spawnSync(compiler,['-nologo','-out:'+exe,path.resolve('server/native/InputLedger.cs'),path.resolve('tests/InputLedgerTests.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(build.status,0,build.stdout+build.stderr);
 const run=spawnSync(exe,[dir],{windowsHide:true,encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/TOTAL 9/);fs.writeFileSync(path.join(dir,'result.txt'),run.stdout);
});
