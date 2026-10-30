import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = fs.readFileSync(path.join(root, 'skills', 'computer-use', 'SKILL.md'), 'utf8');

test('computer-use skill puts weak models on the ready-first path', () => {
  const fast = skill.indexOf('## Mandatory weak-model fast path');
  const ready = skill.indexOf('{{DESKTOP_COMMAND}} ready');
  assert(fast >= 0, 'weak-model fast path is missing');
  assert(ready >= 0 && ready < fast, 'ready command must precede the fast-path guidance');
  assert.match(skill.slice(fast, fast + 900), /Run exactly one\s+`ready` call/);
  assert.match(skill.slice(fast, fast + 900), /Do \*\*not\*\* open a terminal/);
  assert.match(skill.slice(fast, fast + 900), /runtime's authority/);
});
