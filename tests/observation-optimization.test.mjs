import {testDirectory} from './paths.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Runtime} from '../server/runtime.mjs';
import {serveDesktop} from '../server/desktop-service.mjs';
import {request} from '../scripts/desktop.mjs';
import {BUILD_ID, VERSION} from '../server/version.mjs';

function runDesktop(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../scripts/desktop.mjs', import.meta.url)), ...args],
      {
        windowsHide: true,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('exit', code => resolve({ code, stdout, stderr }));
  });
}

function createMockRuntime({nodes = null} = {}) {
  let screenshotCalls = 0;
  let snapshotCalls = 0;
  let captureRequests = 0;
  const defaultNodes = nodes || [
    { i: 0, depth: 0, role: 'Window', name: 'App' },
    { i: 1, depth: 1, role: 'Button', name: 'Export PNG' },
    { i: 2, depth: 1, role: 'Button', name: 'Export JPEG' },
    { i: 3, depth: 1, role: 'Button', name: 'Cancel' }
  ];

  const r = {
    generation: 1,
    deadline: Date.now() + 60000,
    remaining: 10,
    frames: new Map(),
    check() {},
    stamp() { return { generation: 1 }; },
    status() {
      return {
        state: 'active',
        build_id: BUILD_ID,
        build_version: VERSION,
        permission_mode: 'standalone'
      };
    },
    async close() {},
    async grant() {
      return { pid: 100, started: 'fixture', path: 'C:/app.exe', rect: [0, 0, 800, 600] };
    },
    guardian: {
      send() {},
      async request(req) {
        if (req.op === 'capture') captureRequests++;
        return { allowed: true };
      }
    },
    driver: {
      epoch: 1,
      async call(op) {
        if (op === 'snapshot') {
          snapshotCalls++;
          return {
            result: {
              snapshot_id: 'snap-fixture',
              nodes: defaultNodes
            }
          };
        }
        if (op === 'screenshot') {
          screenshotCalls++;
          return {
            result: {
              width: 800,
              height: 600,
              source: [0, 0, 800, 600],
              capture: 'window_foreground',
              data: 'ZmFrZS1pbWFnZS1kYXRh'
            }
          };
        }
        throw Error(`Unexpected driver operation: ${op}`);
      }
    }
  };

  r.observe = Runtime.prototype.observe.bind(r);
  return { r, getCalls: () => ({ screenshotCalls, snapshotCalls, captureRequests }) };
}

test('query observation without with_image returns tree without image property', async () => {
  const { r, getCalls } = createMockRuntime();
  const result = await r.observe({ hwnd: 123, query: 'PNG' });

  assert.equal(result.image, undefined, 'Query observation must omit top-level image');
  assert.equal(result.metadata.image, undefined, 'Query observation must omit metadata image');
  assert.match(result.metadata.tree, /Export PNG/, 'Tree must contain query match');
  assert(!result.metadata.tree.includes('Cancel'), 'Tree must exclude unmatched elements');
  assert.equal(getCalls().screenshotCalls, 0, 'Driver screenshot must not be called');
  assert.equal(getCalls().captureRequests, 0, 'Guardian capture must not be requested');
  assert.equal(getCalls().snapshotCalls, 1, 'Driver snapshot must be called once');

  const cachedFrame = r.frames.get(result.metadata.observation_id);
  assert(cachedFrame, 'Frame must be cached');
  assert.equal(cachedFrame.image, undefined, 'Cached frame image must be undefined');
});

test('query observation with with_image: true captures screenshot and returns image', async () => {
  const { r, getCalls } = createMockRuntime();
  const result = await r.observe({ hwnd: 123, query: 'PNG', with_image: true });

  assert(result.image, 'Explicit with_image: true must return image');
  assert.equal(result.image.width, 800);
  assert.equal(result.image.height, 600);
  assert.equal(result.image.data, 'ZmFrZS1pbWFnZS1kYXRh');
  assert.equal(result.metadata.image.width, 800);
  assert.equal(result.metadata.image.data, undefined, 'Data must be stripped from metadata.image');
  assert.equal(getCalls().screenshotCalls, 1, 'Driver screenshot must be called');
  assert.equal(getCalls().captureRequests, 1, 'Guardian capture must be requested');

  const cachedFrame = r.frames.get(result.metadata.observation_id);
  assert(cachedFrame.image, 'Cached frame must retain image for visual actions');
});

test('non-query observation defaults to capturing screenshot and returns image', async () => {
  const { r, getCalls } = createMockRuntime();
  const result = await r.observe({ hwnd: 123 });

  assert(result.image, 'Non-query observation must default to capturing image');
  assert.equal(result.image.width, 800);
  assert.equal(getCalls().screenshotCalls, 1);
  assert.equal(getCalls().captureRequests, 1);
});

test('whitespace-only query observation treats query as empty and captures image', async () => {
  const { r, getCalls } = createMockRuntime();
  const result = await r.observe({ hwnd: 123, query: '   ' });

  assert(result.image, 'Whitespace query must be treated as empty and capture image');
  assert.equal(getCalls().screenshotCalls, 1);
});

test('non-query observation with explicit with_image: false returns tree without image', async () => {
  const { r, getCalls } = createMockRuntime();
  const result = await r.observe({ hwnd: 123, with_image: false });

  assert.equal(result.image, undefined);
  assert.equal(getCalls().screenshotCalls, 0);
  assert.equal(getCalls().captureRequests, 0);
});

test('service-level snapshot over IPC defaults queries to tree-only and omits disk file', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-obs-ipc-'));
  const { r } = createMockRuntime();
  const service = await serveDesktop({ directory: dir, runtime: r });
  const session = JSON.parse(fs.readFileSync(service.file));

  try {
    // 1. Query-only snapshot via IPC
    const queryRes = await request(session, 'snapshot', { hwnd: 123, query: 'PNG' });
    assert.equal(queryRes.ok, true);
    assert(queryRes.metadata.tree.includes('Export PNG'));
    assert.equal(queryRes.image, undefined, 'IPC query reply must have no image');

    const obsDir = path.join(dir, 'observations');
    if (fs.existsSync(obsDir)) {
      const files = fs.readdirSync(obsDir);
      assert.equal(files.length, 0, 'No image file should be written for query observation');
    }

    // 2. Query snapshot with explicit with_image: true
    const imgRes = await request(session, 'snapshot', { hwnd: 123, query: 'PNG', with_image: true });
    assert.equal(imgRes.ok, true);
    assert(imgRes.image?.path, 'Explicit with_image must write file and return image path');
    assert(fs.existsSync(imgRes.image.path), 'Image file must exist on disk');

    // 3. Non-query snapshot defaults to image
    const fullRes = await request(session, 'snapshot', { hwnd: 123 });
    assert.equal(fullRes.ok, true);
    assert(fullRes.image?.path, 'Non-query snapshot must write file and return image path');
  } finally {
    await service.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('start --quick succeeds when service is alive, returns non-verbose status, and skips redundant operations', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-quick-live-'));
  const runtime = {
    status: () => ({
      state: 'active',
      build_id: BUILD_ID,
      build_version: VERSION,
      permission_mode: 'standalone',
      approved_apps: ['C:/app.exe'],
      control_reason: 'User approved'
    }),
    async close() {}
  };
  const service = await serveDesktop({ directory: dir, runtime });

  try {
    // Test start --quick against live service
    const child = await runDesktop(['start', '--quick'], {
      AGCU_DATA_DIR: dir,
      AGCU_PERMISSION_MODE: 'standalone'
    });
    assert.equal(child.code, 0, child.stderr);
    const reply = JSON.parse(child.stdout);
    assert.equal(reply.ok, true);
    assert.equal(reply.state, 'active');
    assert.equal(reply.build_id, BUILD_ID);
    assert.equal(reply.build_version, VERSION);
    assert.equal(reply.approved_apps, undefined, 'Quick reply must omit verbose approved_apps');
    assert.equal(reply.control_reason, undefined, 'Quick reply must omit verbose control_reason');

    // Test standard start against live service returns full status
    const normalChild = await runDesktop(['start'], {
      AGCU_DATA_DIR: dir,
      AGCU_PERMISSION_MODE: 'standalone'
    });
    assert.equal(normalChild.code, 0, normalChild.stderr);
    const normalReply = JSON.parse(normalChild.stdout);
    assert.equal(normalReply.ok, true);
    assert.equal(normalReply.state, 'active');
    assert.deepEqual(normalReply.approved_apps, ['C:/app.exe']);
  } finally {
    await service.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('start --quick starts background daemon when service is not running and reports quick status', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-quick-cold-'));

  try {
    const child = await runDesktop(['start', '--quick'], {
      AGCU_DATA_DIR: dir,
      AGCU_PERMISSION_MODE: 'standalone'
    });
    assert.equal(child.code, 0, child.stderr);
    const reply = JSON.parse(child.stdout);
    assert.equal(reply.ok, true);
    assert.equal(reply.build_id, BUILD_ID);
    assert.equal(reply.build_version, VERSION);
    assert.equal(reply.state, 'idle');
    assert.equal(reply.approved_apps, undefined, 'Cold start --quick must omit verbose approved_apps');

    // Shut down the newly spawned daemon
    const sessionFile = path.join(dir, 'desktop-session.json');
    assert(fs.existsSync(sessionFile), 'Session file must exist after start');
    const session = JSON.parse(fs.readFileSync(sessionFile));
    const shutdownRes = await request(session, 'shutdown');
    assert.equal(shutdownRes.closed, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('start rejects unrecognized flags and lifecycle rejects invalid quick arguments', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-arg-reject-'));
  try {
    // 1. Unknown flag on start
    const res1 = await runDesktop(['start', '--unknown-flag'], { AGCU_DATA_DIR: dir });
    assert.equal(res1.code, 1);
    const json1 = JSON.parse(res1.stdout);
    assert.equal(json1.ok, false);
    assert.equal(json1.error.code, 'bad_arguments');

    // 2. Non-boolean value for --quick
    const res2 = await runDesktop(['start', '--quick=invalid'], { AGCU_DATA_DIR: dir });
    assert.equal(res2.code, 1);
    const json2 = JSON.parse(res2.stdout);
    assert.equal(json2.ok, false);
    assert.equal(json2.error.code, 'bad_arguments');

    // 3. --quick flag on lifecycle command that does not accept it (shutdown)
    const res3 = await runDesktop(['shutdown', '--quick'], { AGCU_DATA_DIR: dir });
    assert.equal(res3.code, 1);
    const json3 = JSON.parse(res3.stdout);
    assert.equal(json3.ok, false);
    assert.equal(json3.error.code, 'bad_arguments');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
