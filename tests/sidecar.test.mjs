import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {mergeSidecarConfig,sidecarDefinition,SIDECAR_ID} from '../scripts/sidecar.mjs';
test('sidecar configuration preserves permissions and unrelated sidecars, and respects a disabled entry on update',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-sidecar-')),file=path.join(dir,'config.json');
 try{
  const original={permissions:{preset:'unchanged'},model:'same',sidecars:{other:{enabled:true},[SIDECAR_ID]:{enabled:false,projectId:'preserved'}}};fs.writeFileSync(file,JSON.stringify(original));
  const updated=JSON.parse(mergeSidecarConfig(file));assert.deepEqual(updated,original);
  const enabled=JSON.parse(mergeSidecarConfig(file,{enable:true}));assert.equal(enabled.sidecars[SIDECAR_ID].enabled,true);assert.equal(enabled.sidecars[SIDECAR_ID].projectId,'preserved');assert.deepEqual(enabled.permissions,original.permissions);assert.deepEqual(enabled.sidecars.other,original.sidecars.other);
  assert.deepEqual(sidecarDefinition('node.exe','cu.mjs').args,['cu.mjs','serve']);assert.equal(sidecarDefinition('node.exe','cu.mjs').restart_policy,'on-failure');
  fs.writeFileSync(file,'{bad');assert.throws(()=>mergeSidecarConfig(file));assert.equal(fs.readFileSync(file,'utf8'),'{bad');
 }finally{fs.unlinkSync(file);fs.rmdirSync(dir);}
});
