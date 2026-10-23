// Explicit packaging regression: no app interaction and no desktop grants.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import {ensureHost} from '../server/build.mjs';
const host=ensureHost();const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before={sha:sha(host.exe),mtime:fs.statSync(host.exe).mtimeMs};let previous;
for(let i=0;i<2;i++){
 const run=spawnSync(process.execPath,['scripts/bundle.mjs'],{windowsHide:true,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.resolve('dist/AntigravityComputerUse-windows-x64/bundle-manifest.json'),'utf8'));
 assert.equal(manifest.host_sha256,before.sha);assert.equal(sha(host.exe),before.sha);assert.equal(fs.statSync(host.exe).mtimeMs,before.mtime);
 assert.match(manifest.native_source_sha256,/^[0-9a-f]{64}$/);
 if(previous)assert.equal(manifest.build_id,previous.build_id);previous=manifest;
}
console.log(JSON.stringify({passed:true,repeated_packages:2,native_sha256:before.sha,native_source_sha256:previous.native_source_sha256,build_id:previous.build_id,helper_not_recompiled:true},null,2));
