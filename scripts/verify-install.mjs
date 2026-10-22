import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const target=path.resolve(process.argv[2]||'D:/Tools/AntigravityComputerUse');
const install=JSON.parse(fs.readFileSync(path.join(target,'installation.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(install.release,'bundle-manifest.json')));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [file,hash] of Object.entries(manifest.files))assert.equal(sha(path.join(install.release,file)),hash,file+' differs from bundle');
for(const file of install.configs){const cfg=JSON.parse(fs.readFileSync(file));assert.equal(cfg.mcpServers['antigravity-computer-use'].command,path.join(install.release,'node.exe'));assert.equal(cfg.mcpServers['antigravity-computer-use'].args[0],path.join(install.release,'server/index.mjs'));}
for(const dir of install.skills)assert.equal(sha(path.join(dir,'SKILL.md')),manifest.files['skills/computer-use/SKILL.md']);
console.log(JSON.stringify({verified:true,release:install.release,build_id:manifest.build_id,files:Object.keys(manifest.files).length,skill_matches:true},null,2));
