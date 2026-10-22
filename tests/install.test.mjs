import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {mergeConfig,install} from '../scripts/install.mjs';
import {spawnSync} from 'node:child_process';
const root=path.resolve('.localdata/test-install');fs.mkdirSync(root,{recursive:true});
test('configuration merge preserves unrelated servers/settings',()=>{
 const f=path.join(root,'merge.json');fs.writeFileSync(f,JSON.stringify({custom:7,mcpServers:{keep:{command:'keep'}}}));
 const c=JSON.parse(mergeConfig(f,{command:'native'}));assert.equal(c.custom,7);assert.equal(c.mcpServers.keep.command,'keep');assert.equal(c.mcpServers['antigravity-computer-use'].command,'native');
});
test('invalid configuration is untouched',()=>{const f=path.join(root,'invalid.json');fs.writeFileSync(f,'{broken');assert.throws(()=>mergeConfig(f,{}));assert.equal(fs.readFileSync(f,'utf8'),'{broken');});
test('project-local installation and update rollback preserve later unrelated changes',()=>{
 const dir=fs.mkdtempSync(path.join(root,'workspace-')),bundle=path.join(dir,'bundle'),target=path.join(dir,'installed'),workspace=path.join(dir,'project');
 fs.mkdirSync(path.join(bundle,'bin'),{recursive:true});fs.mkdirSync(path.join(bundle,'skills','computer-use'),{recursive:true});fs.writeFileSync(path.join(bundle,'node.exe'),'fixture');fs.writeFileSync(path.join(bundle,'bin','AxonHost.exe'),'fixture');fs.writeFileSync(path.join(bundle,'skills/computer-use/SKILL.md'),'v1');
 const first=install({bundle,target,workspace});const cfg=first.configs[0];assert.equal(cfg,path.join(workspace,'.agents/mcp_config.json'));assert.equal(first.skills[0],path.join(workspace,'.agents/skills/computer-use'));
 fs.writeFileSync(path.join(bundle,'skills/computer-use/SKILL.md'),'v2');const second=install({bundle,target,workspace});assert.notEqual(first.release,second.release);
 const state=JSON.parse(fs.readFileSync(cfg));state.mcpServers.unrelated={command:'keep'};fs.writeFileSync(cfg,JSON.stringify(state));
 const rollback=spawnSync(process.execPath,['scripts/rollback.mjs',path.join(second.backup,'rollback.json')],{windowsHide:true,encoding:'utf8'});assert.equal(rollback.status,0,rollback.stderr);
 const restored=JSON.parse(fs.readFileSync(cfg));assert.equal(restored.mcpServers.unrelated.command,'keep');assert.equal(restored.mcpServers['antigravity-computer-use'].command,path.join(first.release,'node.exe'));assert.equal(fs.readFileSync(path.join(first.skills[0],'SKILL.md'),'utf8'),'v1');
});
test('installer copies prebuilt runtime, backs up exact config and registers global skill',()=>{
 const dir=fs.mkdtempSync(path.join(root,'case-'));const bundle=path.join(dir,'bundle'),home=path.join(dir,'home'),target=path.join(dir,'installed');
 fs.mkdirSync(path.join(bundle,'bin'),{recursive:true});fs.mkdirSync(path.join(bundle,'skills','computer-use'),{recursive:true});
 fs.writeFileSync(path.join(bundle,'node.exe'),'fixture');fs.writeFileSync(path.join(bundle,'bin','AxonHost.exe'),'fixture');fs.writeFileSync(path.join(bundle,'skills','computer-use','SKILL.md'),'fixture skill');
 const cfg=path.join(home,'.gemini','config','mcp_config.json');fs.mkdirSync(path.dirname(cfg),{recursive:true});const original='{"mcpServers":{"keep":{"command":"keep"}},"custom":8}';fs.writeFileSync(cfg,original);
 const result=install({bundle,home,target});const manifest=JSON.parse(fs.readFileSync(path.join(result.backup,'rollback.json')));
 assert.equal(result.configs.length,1);assert.equal(result.skills.length,1);
 assert.equal(JSON.parse(fs.readFileSync(cfg)).mcpServers['antigravity-computer-use'].env.AGCU_PERMISSION_MODE,'host-managed');
 assert.equal(fs.readFileSync(manifest.records[0].saved,'utf8'),original);assert.equal(JSON.parse(fs.readFileSync(cfg)).custom,8);assert(fs.existsSync(path.join(result.skills[0],'SKILL.md')));assert(fs.existsSync(path.join(result.release,'node.exe')));
 const modified=JSON.parse(fs.readFileSync(cfg));modified.added_after_install=true;modified.mcpServers.later={command:'preserve-me'};fs.writeFileSync(cfg,JSON.stringify(modified));
 const rolled=spawnSync(process.execPath,['scripts/rollback.mjs',path.join(result.backup,'rollback.json')],{windowsHide:true,encoding:'utf8'});assert.equal(rolled.status,0,rolled.stderr);
 const restored=JSON.parse(fs.readFileSync(cfg));assert.equal(restored.mcpServers.keep.command,'keep');assert.equal(restored.mcpServers.later.command,'preserve-me');assert(restored.added_after_install);assert(!restored.mcpServers['antigravity-computer-use']);
});
