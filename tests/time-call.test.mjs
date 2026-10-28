// Automated test suite for scripts/time-call.mjs
// Verifies command execution, timing breakdown to stderr, stdout cleanliness,
// error handling taxonomy, timeouts, and temporary file isolation.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { testDirectory } from './paths.mjs';
import { serveDesktop } from '../server/desktop-service.mjs';

const timeCallScript = fileURLToPath(new URL('../scripts/time-call.mjs', import.meta.url));

function parseOutput({ status, stdout, stderr }) {
  let stdoutJson = null, stderrJson = null;
  try { stdoutJson = JSON.parse(stdout.trim()); } catch {}
  if (stderr) {
    const lines = stderr.trim().split('\n');
    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed && typeof parsed.total_cli_ms === 'number') {
          stderrJson = parsed;
          break;
        }
      } catch {}
    }
  }
  return { stdoutJson, stderrJson, rawStdout: stdout, rawStderr: stderr, status };
}

function runTimeCall(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [timeCallScript, ...args], {
      windowsHide: true,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('error', reject);
    child.on('close', status => {
      resolve(parseOutput({ status, stdout, stderr }));
    });
  });
}

function assertValidMetrics(metrics, { requireService = false } = {}) {
  assert(metrics, 'Stderr must contain valid JSON metrics');
  assert.equal(typeof metrics.node_startup_ms, 'number');
  assert.equal(typeof metrics.module_load_ms, 'number');
  assert.equal(typeof metrics.session_read_ms, 'number');
  assert.equal(typeof metrics.pipe_connect_ms, 'number');
  assert.equal(typeof metrics.service_ms, 'number');
  assert.equal(typeof metrics.transport_ms, 'number');
  assert.equal(typeof metrics.total_cli_ms, 'number');
  assert.equal(typeof metrics.external_wall_ms, 'number');
  assert.equal(typeof metrics.teardown_and_delivery_ms, 'number');
  assert.equal(typeof metrics.ok, 'boolean');
  assert.equal(typeof metrics.exit_code, 'number');
  assert(metrics.total_cli_ms > 0, 'total_cli_ms must be positive');
  assert(metrics.external_wall_ms >= 0, 'external_wall_ms must be non-negative');
  assert(metrics.node_startup_ms >= 0, 'node_startup_ms must be non-negative');
  assert(metrics.module_load_ms >= 0, 'module_load_ms must be non-negative');
  if (requireService) {
    assert(metrics.service_ms >= 0, 'service_ms must be non-negative');
  }
}

test('time-call --help outputs usage on stdout and timing metrics on stderr with exit code 0', async () => {
  const res = await runTimeCall(['--help']);
  assert.equal(res.status, 0, res.rawStderr);
  assert(res.rawStdout.includes('Native desktop skill') || res.rawStdout.includes('time-call'), 'Stdout must contain help');
  assertValidMetrics(res.stderrJson);
  assert.equal(res.stderrJson.ok, true);
});

test('time-call describe outputs command schema on stdout and timing metrics on stderr', async () => {
  const res = await runTimeCall(['describe', 'click']);
  assert.equal(res.status, 0, res.rawStderr);
  assert.equal(res.stdoutJson.command, 'click');
  assert.equal(res.stdoutJson.inputSchema.properties.button.type, 'string');
  assertValidMetrics(res.stderrJson);
  assert.equal(res.stderrJson.ok, true);
});

test('time-call describe --all outputs all tools and lifecycle commands with timing metrics', async () => {
  const res = await runTimeCall(['describe', '--all']);
  assert.equal(res.status, 0, res.rawStderr);
  assert(Array.isArray(res.stdoutJson.commands));
  assert(res.stdoutJson.commands.some(c => c.command === 'start'));
  assert(res.stdoutJson.commands.some(c => c.command === 'click'));
  assertValidMetrics(res.stderrJson);
  assert.equal(res.stderrJson.ok, true);
});

test('time-call describe multiple commands outputs array of requested schemas', async () => {
  const res = await runTimeCall(['describe', 'click', 'move']);
  assert.equal(res.status, 0, res.rawStderr);
  assert(Array.isArray(res.stdoutJson.commands));
  assert.equal(res.stdoutJson.commands.length, 2);
  assert.equal(res.stdoutJson.commands[0].command, 'click');
  assert.equal(res.stdoutJson.commands[1].command, 'move');
  assertValidMetrics(res.stderrJson);
  assert.equal(res.stderrJson.ok, true);
});

test('time-call unknown command reports unknown_command error and exits with code 1 while emitting metrics', async () => {
  const res = await runTimeCall(['unsupported_test_cmd']);
  assert.equal(res.status, 1);
  assert.equal(res.stdoutJson.ok, false);
  assert.equal(res.stdoutJson.error.code, 'unknown_command');
  assertValidMetrics(res.stderrJson);
  assert.equal(res.stderrJson.ok, false);
  assert.equal(res.stderrJson.exit_code, 1);
});

test('time-call missing or invalid arguments reports bad_arguments and exits with code 1', async () => {
  const res = await runTimeCall(['click', '--hwnd', 'not_a_number']);
  assert.equal(res.status, 1);
  assert.equal(res.stdoutJson.ok, false);
  assert.equal(res.stdoutJson.error.code, 'bad_arguments');
  assertValidMetrics(res.stderrJson);
  assert.equal(res.stderrJson.ok, false);
  assert.equal(res.stderrJson.exit_code, 1);
});

test('time-call status when no session exists succeeds with state not_running and exit code 0', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-offline-'));
  try {
    const res = await runTimeCall(['status'], { AGCU_DATA_DIR: dir });
    assert.equal(res.status, 0, res.rawStderr);
    assert.equal(res.stdoutJson.ok, true);
    assert.equal(res.stdoutJson.state, 'not_running');
    assertValidMetrics(res.stderrJson);
    assert.equal(res.stderrJson.pipe_connect_ms, 0);
    assert.equal(res.stderrJson.service_ms, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call action command when no session exists reports no_session and exit code 1', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-nosession-'));
  try {
    const res = await runTimeCall(['apps'], { AGCU_DATA_DIR: dir });
    assert.equal(res.status, 1);
    assert.equal(res.stdoutJson.ok, false);
    assert.equal(res.stdoutJson.error.code, 'no_session');
    assertValidMetrics(res.stderrJson);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call reports session_unavailable when pipe is stale/dead and exits with code 1', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-stale-'));
  const staleSession = path.join(dir, 'desktop-session.json');
  fs.writeFileSync(staleSession, JSON.stringify({
    pid: 999998,
    pipe: process.platform === 'win32' ? '\\\\.\\pipe\\agcu-dead-test-' + Date.now() : path.join(dir, 'dead.sock'),
    secret: 'dummy-secret'
  }));
  try {
    const res = await runTimeCall(['apps'], { AGCU_DATA_DIR: dir });
    assert.equal(res.status, 1);
    assert.equal(res.stdoutJson.ok, false);
    assert.equal(res.stdoutJson.error.code, 'session_unavailable');
    assertValidMetrics(res.stderrJson);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call live execution against mock service returns full breakdown on status and apps', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-live-'));
  const mockRuntime = {
    status: () => ({ state: 'idle', active: false }),
    driver: {
      call: async () => ({ result: { windows: [{ hwnd: 101, title: 'Test App', process: 'test.exe', pid: 12345 }] } })
    },
    guardian: { pid: 99999 },
    async close() {}
  };
  const service = await serveDesktop({ directory: dir, runtime: mockRuntime });
  try {
    // 1. Test status command
    const resStatus = await runTimeCall(['status'], { AGCU_DATA_DIR: dir });
    assert.equal(resStatus.status, 0, resStatus.rawStderr);
    assert.equal(resStatus.stdoutJson.ok, true);
    assert.equal(resStatus.stdoutJson.state, 'idle');
    assertValidMetrics(resStatus.stderrJson, { requireService: true });

    // 2. Test apps command
    const resApps = await runTimeCall(['apps'], { AGCU_DATA_DIR: dir });
    assert.equal(resApps.status, 0, resApps.rawStderr);
    assert.equal(resApps.stdoutJson.ok, true);
    assert.equal(resApps.stdoutJson.windows.length, 1);
    assertValidMetrics(resApps.stderrJson, { requireService: true });
    assert(resApps.stderrJson.pipe_connect_ms >= 0);
  } finally {
    await service.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call captures service execution time even when service returns verification/action error', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-errortiming-'));
  const mockRuntime = {
    status: () => ({ state: 'idle' }),
    async observe() {
      throw Object.assign(Error('Window not found'), { code: 'window_not_found' });
    },
    async close() {}
  };
  const service = await serveDesktop({ directory: dir, runtime: mockRuntime });
  try {
    const res = await runTimeCall(['snapshot', '--hwnd', '999'], { AGCU_DATA_DIR: dir });
    assert.equal(res.status, 1);
    assert.equal(res.stdoutJson.ok, false);
    assert.equal(res.stdoutJson.error.code, 'window_not_found');
    assertValidMetrics(res.stderrJson, { requireService: true });
    assert(res.stderrJson.service_ms >= 0, 'service_ms must be recorded from receipt even on error');
  } finally {
    await service.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call handles IPC timeout gracefully and reports request_timeout error', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-timeout-'));
  const pipePath = process.platform === 'win32'
    ? '\\\\.\\pipe\\agcu-timeout-test-' + Date.now()
    : path.join(dir, 'timeout.sock');
  
  const sockets = new Set();
  const dummyServer = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise(resolve => dummyServer.listen(pipePath, resolve));
  fs.writeFileSync(path.join(dir, 'desktop-session.json'), JSON.stringify({
    pid: process.pid,
    pipe: pipePath,
    secret: 'test-secret'
  }));

  try {
    const res = await runTimeCall(['apps'], { AGCU_DATA_DIR: dir, AGCU_REQUEST_TIMEOUT_MS: '200' });
    assert.equal(res.status, 1);
    assert.equal(res.stdoutJson.ok, false);
    assert(res.stdoutJson.error.code === 'request_timeout' || res.stdoutJson.error.code === 'refused' || res.stdoutJson.error.message.includes('timed out'));
    assertValidMetrics(res.stderrJson);
    assert(res.stderrJson.total_cli_ms >= 150, 'total_cli_ms must reflect timeout duration');
  } finally {
    for (const s of sockets) s.destroy();
    await new Promise(resolve => dummyServer.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call handles mid-flight connection loss gracefully', async () => {
  const dir = fs.mkdtempSync(path.join(testDirectory('tmp'), 'agcu-timecall-drop-'));
  const pipePath = process.platform === 'win32'
    ? '\\\\.\\pipe\\agcu-drop-test-' + Date.now()
    : path.join(dir, 'drop.sock');
  
  const sockets = new Set();
  const dropServer = net.createServer(socket => {
    sockets.add(socket);
    socket.on('data', () => {
      socket.destroy();
    });
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise(resolve => dropServer.listen(pipePath, resolve));
  fs.writeFileSync(path.join(dir, 'desktop-session.json'), JSON.stringify({
    pid: process.pid,
    pipe: pipePath,
    secret: 'drop-secret'
  }));

  try {
    const res = await runTimeCall(['apps'], { AGCU_DATA_DIR: dir });
    assert.equal(res.status, 1);
    assert.equal(res.stdoutJson.ok, false);
    assert(res.stdoutJson.error.code === 'connection_lost' || res.stdoutJson.error.message.includes('disconnected') || res.stdoutJson.error.message.includes('lost'));
    assertValidMetrics(res.stderrJson);
  } finally {
    for (const s of sockets) s.destroy();
    await new Promise(resolve => dropServer.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('time-call preserves temporary test isolation inside .localdata/tests/ strictly', () => {
  const target = testDirectory('tmp', 'isolation-check');
  assert(target.includes(path.join('.localdata', 'tests', 'tmp')), 'Path must be within .localdata/tests/tmp');
  fs.rmdirSync(target);
});
