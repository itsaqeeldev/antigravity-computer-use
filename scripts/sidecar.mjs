import fs from 'node:fs';
export const SIDECAR_ID='antigravity-computer-use';
export function sidecarDefinition(node,launcher){return {command:node,args:[launcher,'serve'],restart_policy:'on-failure',display_name:'Computer Use',description:'Local Windows desktop controller for /computer-use; no MCP or separate model.'};}
export function mergeSidecarConfig(file,{enable}={}){
 const value=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):{};
 if(!value||typeof value!=='object'||Array.isArray(value)||value.sidecars&&(typeof value.sidecars!=='object'||Array.isArray(value.sidecars)))throw Error('Invalid Antigravity sidecar configuration: '+file);
 const old=value.sidecars?.[SIDECAR_ID];
 if(old!=null&&(typeof old!=='object'||Array.isArray(old)))throw Error('Invalid computer-use sidecar entry.');
 if(old?.enabled!=null&&typeof old.enabled!=='boolean')throw Error('Sidecar enabled must be boolean.');
 value.sidecars??={};value.sidecars[SIDECAR_ID]={...old,enabled:enable??old?.enabled??true};
 return JSON.stringify(value,null,2)+'\n';
}
