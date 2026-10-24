import {testDirectory} from './paths.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadDeployment,applyDeployment} from '../server/deployment.mjs';
test('installed service policy wins over unrelated plugin/environment overrides',()=>{
 const dir=fs.mkdtempSync(path.join(testDirectory('tmp'),'agcu-deploy-')),file=path.join(dir,'desktop-policy.json');
 try{
  fs.writeFileSync(file,JSON.stringify({permission_mode:'standalone',data_dir:path.join(dir,'private')}));
  const env={AGCU_PERMISSION_MODE:'host-managed',AGCU_DATA_DIR:'wrong',CU_PLUGIN_DATA:'wrong-plugin',CLAUDE_PLUGIN_DATA:'other-plugin'};
  applyDeployment(loadDeployment(file,env),env);
  assert.equal(env.AGCU_PERMISSION_MODE,'standalone');assert.equal(env.AGCU_DATA_DIR,path.join(dir,'private'));assert(!env.CU_PLUGIN_DATA);assert(!env.CLAUDE_PLUGIN_DATA);
  for(const policy of [{permission_mode:'turbo',data_dir:dir},{permission_mode:'standalone',data_dir:'relative'}]){fs.writeFileSync(file,JSON.stringify(policy));assert.throws(()=>loadDeployment(file,env),e=>e.code==='invalid_deployment_policy');}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
