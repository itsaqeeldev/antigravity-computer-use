import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectRoot,testRoot,testPath} from './paths.mjs';

test('test paths stay in the checkout even when launched from a drive root',()=>{
 const child=spawnSync(process.execPath,['--input-type=module','-e',
  `import {testPath} from ${JSON.stringify(new URL('./paths.mjs',import.meta.url).href)}; console.log(testPath('probe'));`],
  {cwd:path.parse(projectRoot).root,encoding:'utf8',windowsHide:true});
 assert.equal(child.status,0,child.stderr);
 assert.equal(child.stdout.trim(),path.join(projectRoot,'.localdata','tests','probe'));
});

test('test paths refuse traversal and absolute paths outside their root',()=>{
 assert.throws(()=>testPath('..','outside'));
 assert.throws(()=>testPath(path.parse(projectRoot).root));
 assert.equal(testPath('tmp','fixture'),path.join(testRoot,'tmp','fixture'));
});
