import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('native desktop preflight refuses hidden, different and unavailable input desktops without switching them',()=>{
 const dir=testDirectory('desktop-context');fs.mkdirSync(dir,{recursive:true});const exe=path.join(dir,'DesktopContextTests.exe');
 const csc=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
 const build=spawnSync(csc,['-nologo','-out:'+exe,path.resolve('server/native/DesktopContext.cs'),path.resolve('tests/DesktopContextTests.cs')],{encoding:'utf8',windowsHide:true});assert.equal(build.status,0,build.stdout+build.stderr);
 const run=spawnSync(exe,[],{encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/TOTAL 6/);
});
