// Exact installed script/manifest check. No screenshot or application grant.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const install=JSON.parse(fs.readFileSync(process.argv[2]||'D:/Tools/AntigravityComputerUse/installation.json','utf8'));
assert.equal(install.integration,'direct');const dir=install.release;
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'bundle-manifest.json'),'utf8'));
for(const [file,hash] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex'),hash,file);
const run=(command)=>{const r=spawnSync(path.join(dir,'node.exe'),[path.join(dir,'scripts/desktop.mjs'),command],{windowsHide:true,encoding:'utf8',timeout:12000});assert.equal(r.status,0,r.stdout+r.stderr);return JSON.parse(r.stdout);};
run('start');const status=run('status');assert.equal(status.state,'idle');assert.equal(status.approved_apps.length,0);assert.equal(status.build_id,manifest.build_id);assert.equal(status.build_version,manifest.version);
for(const skill of install.skills){const text=fs.readFileSync(path.join(skill,'SKILL.md'),'utf8');assert(text.includes(install.launcher||path.join(dir,'scripts','desktop.mjs')));assert(!text.includes('{{DESKTOP_COMMAND}}'));}
if(install.launcher)assert(fs.readFileSync(install.launcher,'utf8').includes(install.launcher_node?pathToFileURL(path.join(dir,'scripts','desktop.mjs')).href:path.join(dir,'scripts','desktop.mjs')));
for(const config of install.configs)assert(!JSON.parse(fs.readFileSync(config)).mcpServers?.['antigravity-computer-use']);
console.log(JSON.stringify({passed:true,integration:'direct',version:manifest.version,build_id:manifest.build_id,files:Object.keys(manifest.files).length,no_desktop_access:true},null,2));
