// Resolve from this module, never the caller's working directory or OS temp.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const testRoot = path.join(projectRoot, '.localdata', 'tests');

export function testPath(...parts) {
  const target = path.resolve(testRoot, ...parts);
  const relative = path.relative(testRoot, target);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Test artifacts must stay inside the project test directory.');
  }
  return target;
}

export function testDirectory(...parts) {
  const target = testPath(...parts);
  fs.mkdirSync(target, {recursive:true});
  return target;
}
