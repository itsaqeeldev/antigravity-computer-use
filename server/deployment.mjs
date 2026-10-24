import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const policyFile=fileURLToPath(new URL('../desktop-policy.json',import.meta.url));
export function loadDeployment(file=policyFile,env=process.env){
 const installed=fs.existsSync(file);
 const policy=installed?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{permission_mode:env.AGCU_PERMISSION_MODE||'standalone'};
 if(!['standalone','host-managed'].includes(policy.permission_mode))throw Object.assign(Error('Invalid fixed deployment permission policy.'),{code:'invalid_deployment_policy'});
 if(installed&&(typeof policy.data_dir!=='string'||!path.isAbsolute(policy.data_dir)))throw Object.assign(Error('Installed deployment needs an absolute private data directory.'),{code:'invalid_deployment_policy'});
 if(policy.idle_policy!=null&&!['release','shutdown'].includes(policy.idle_policy))throw Object.assign(Error('Invalid installed idle policy.'),{code:'invalid_deployment_policy'});
 return {...policy,installed};
}
export function applyDeployment(policy,env=process.env){
 env.AGCU_PERMISSION_MODE=policy.permission_mode;
 if(policy.installed){
  env.AGCU_DATA_DIR=policy.data_dir;
  delete env.CU_PLUGIN_DATA;delete env.CLAUDE_PLUGIN_DATA;
 }
 return policy;
}
