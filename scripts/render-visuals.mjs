import path from 'node:path';import {spawnSync} from 'node:child_process';import {ensureHost} from '../server/build.mjs';
const result=spawnSync(ensureHost().exe,['--visual-preview',path.resolve(process.argv[2]||'.localdata/visual-review')],{windowsHide:true,stdio:'inherit'});
process.exitCode=result.status??1;
