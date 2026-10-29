// Negative native qualification on the current CI desktop only. Never creates,
// switches or injects input into another desktop. Never starts UI if interactive.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {ensureHost} from '../server/build.mjs';
if(process.platform!=='win32')throw Error('Windows native preflight requires Windows.');
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'.localdata/tests/guardian-desktop-preflight');fs.mkdirSync(dir,{recursive:true});
const {exe}=ensureHost();const probe=spawnSync(exe,['--desktop-context'],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(probe.status,0);const context=JSON.parse(probe.stdout);
let result;
if(context.interactive===true)result={qualified:false,skipped:true,reason:'interactive_desktop_no_negative_launch',desktop_input_sent:false};
else {
 const process=spawnSync(exe,['--guardian'],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(process.status,1,process.stderr||process.stdout);
 const message=JSON.parse(process.stdout.trim());assert.equal(message.ev,'error');assert.equal(message.code,'desktop_context_unavailable');assert.equal(message.desktop_context.interactive,false);
 result={qualified:true,guardian_refused_hidden_desktop:true,controls_created:false,desktop_input_sent:false};
}
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result));console.log(JSON.stringify(result));
