import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
test('native observation preserves joiners, bidi marks and emoji while risk matching normalizes spoofed labels',{skip:process.platform!=='win32'},()=>{
 const dir=testDirectory('text-tests');fs.mkdirSync(dir,{recursive:true});const exe=path.join(dir,'SnapshotTextTests.exe');
 const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 const built=spawnSync(compiler,['-nologo','-out:'+exe,path.resolve('server/native/SnapshotText.cs'),path.resolve('tests/SnapshotTextTests.cs')],{windowsHide:true,encoding:'utf8'});assert.equal(built.status,0,built.stdout+built.stderr);
 const run=spawnSync(exe,[],{windowsHide:true,encoding:'utf8'});assert.equal(run.status,0,run.stdout+run.stderr);
});
