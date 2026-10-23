import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {launcherSource} from './install.mjs';
const target=path.resolve(process.argv[2]||'D:/Tools/AntigravityComputerUse');
const install=JSON.parse(fs.readFileSync(path.join(target,'installation.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(install.release,'bundle-manifest.json')));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(install.launcher){
 const workspace=install.workspace?path.resolve(install.workspace):null;
 const scope=workspace?createHash('sha256').update(process.platform==='win32'?workspace.toLowerCase():workspace).digest('hex').slice(0,12):null;
 assert.equal(path.resolve(install.launcher),path.join(target,scope?`cu-${scope}.mjs`:'cu.mjs'));
 assert.equal(fs.readFileSync(install.launcher,'utf8'),launcherSource(install.release),'short launcher differs from installed build pin');
 assert.equal(path.resolve(install.launcher_node),path.join(target,scope?`cu-${scope}-node.exe`:'cu-node.exe'));
 assert.equal(sha(install.launcher_node),manifest.files['node.exe'],'launcher Node differs from bundled Node');
}
for(const [file,hash] of Object.entries(manifest.files))assert.equal(sha(path.join(install.release,file)),hash,file+' differs from bundle');
for(const file of install.configs){
 const cfg=JSON.parse(fs.readFileSync(file));
 if(install.integration==='direct')assert(!cfg.mcpServers?.['antigravity-computer-use']);
 else {assert.equal(cfg.mcpServers['antigravity-computer-use'].command,path.join(install.release,'node.exe'));assert.equal(cfg.mcpServers['antigravity-computer-use'].args[0],path.join(install.release,'server/index.mjs'));}
}
for(const dir of install.skills){
 const template=fs.readFileSync(path.join(install.release,'skills/computer-use/SKILL.md'),'utf8');
 const command=install.launcher?`& '${install.launcher_node.replaceAll("'","''")}' '${install.launcher.replaceAll("'","''")}'`:`& '${path.join(install.release,'node.exe').replaceAll("'","''")}' '${path.join(install.release,'scripts','desktop.mjs').replaceAll("'","''")}'`;
 assert.equal(fs.readFileSync(path.join(dir,'SKILL.md'),'utf8'),template.replaceAll('{{DESKTOP_COMMAND}}',command));
}
console.log(JSON.stringify({verified:true,release:install.release,build_id:manifest.build_id,files:Object.keys(manifest.files).length,skill_matches:true},null,2));
