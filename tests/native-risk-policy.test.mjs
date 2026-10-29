import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {testDirectory} from './paths.mjs';import {ensureHost} from '../server/build.mjs';import {fileURLToPath} from 'node:url';
test('real native classifier treats ambiguous targets and hidden sensitive labels consistently',{skip:process.platform!=='win32'},()=>{
 const dir=testDirectory('native-risk-policy'),exe=path.join(dir,'RiskPolicyTests.exe');
 const build=spawnSync(path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['-nologo','-out:'+exe,fileURLToPath(new URL('./NativeRiskPolicyTests.cs',import.meta.url))],{windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(build.status,0,build.stdout+build.stderr);
 const host=ensureHost().exe;const run=spawnSync(exe,[host],{windowsHide:true,encoding:'utf8',timeout:10000,env:{...process.env,AGCU_CONTRACT_FILE:fileURLToPath(new URL('../server/control-contract.json',import.meta.url))}});assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/no input APIs used/);
});
