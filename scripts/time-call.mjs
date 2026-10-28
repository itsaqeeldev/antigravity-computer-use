// Adapted stdio dispatch and tool vocabulary from ridelink0/claude-computer-use (MIT).
// Diagnostic timing wrapper for desktop CLI commands.
// Measures Node bootstrap, module loading, session lookup, IPC connect,
// service execution, transport overhead, and total CLI wall time.

import { performance } from 'node:perf_hooks';
const tEntry = performance.now();

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function timedRequest(session, command, args = {}, timeout = 100000, expectedPermissionMode, buildId) {
  return new Promise((resolve, reject) => {
    let buffer = '', settled = false, connected = false;
    const tConnect0 = performance.now();
    let tConnected = 0, tWriteDone = 0, tReceived = 0;

    const socket = net.createConnection(session.pipe);
    socket.setEncoding('utf8');

    const done = (error, result, meta = {}) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(Object.assign(error, meta));
      else resolve({ result, meta });
    };

    socket.setTimeout(timeout, () => {
      done(Object.assign(Error('Desktop request timed out; session was cancelled. Observe status before continuing.'), { code: 'request_timeout' }), null, { timed_out: true });
    });

    socket.on('connect', () => {
      connected = true;
      tConnected = performance.now();
      const payload = JSON.stringify({
        secret: session.secret,
        command,
        args,
        expected_build_id: buildId,
        expected_permission_mode: expectedPermissionMode
      }) + '\n';
      socket.write(payload);
      tWriteDone = performance.now();
    });

    socket.on('data', chunk => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 4 * 1024 * 1024) return done(Error('Desktop response too large'));
      if (buffer.includes('\n')) {
        tReceived = performance.now();
        try {
          const parsed = JSON.parse(buffer.slice(0, buffer.indexOf('\n')));
          const pipe_connect_ms = Math.round((tConnected - tConnect0) * 10) / 10;
          const service_ms = parsed.receipt?.elapsed_ms ?? 0;
          const roundtrip_ms = Math.round((tReceived - tWriteDone) * 10) / 10;
          const transport_ms = Math.max(0, Math.round((roundtrip_ms - service_ms) * 10) / 10);
          done(null, parsed, { pipe_connect_ms, service_ms, transport_ms, roundtrip_ms });
        } catch (err) {
          done(err);
        }
      }
    });

    socket.on('error', error => {
      const pipe_connect_ms = connected ? Math.round((tConnected - tConnect0) * 10) / 10 : Math.round((performance.now() - tConnect0) * 10) / 10;
      done(Object.assign(Error(connected
        ? 'Desktop connection lost; input delivery may be unknown. Do not replay the action. Inspect status and observe again.'
        : 'The saved desktop service is unreachable. Inspect/restart the installed Computer Use App sidecar or use its human starter from the normal Windows desktop, then discover apps and observe again. Isolated exebox terminals cannot start visible-desktop control. Do not use WMI or bypass host security. Emergency Stop remains latched.'),
        { code: connected ? 'connection_lost' : 'session_unavailable', cause: error }), null, { pipe_connect_ms });
    });

    socket.on('end', () => {
      if (!settled) {
        const pipe_connect_ms = connected ? Math.round((tConnected - tConnect0) * 10) / 10 : 0;
        done(Object.assign(Error('Desktop session disconnected; do not replay the action.'), { code: 'connection_lost' }), null, { pipe_connect_ms });
      }
    });

    socket.on('close', () => {
      if (!settled) {
        const pipe_connect_ms = connected ? Math.round((tConnected - tConnect0) * 10) / 10 : 0;
        done(Object.assign(Error(connected ? 'Desktop connection lost; input delivery may be unknown.' : 'The saved desktop service is unreachable.'), { code: connected ? 'connection_lost' : 'session_unavailable' }), null, { pipe_connect_ms });
      }
    });
  });
}

export async function timeCall(argv = process.argv.slice(2), { stdout = process.stdout, stderr = process.stderr } = {}) {
  const node_startup_ms = Math.round(tEntry * 10) / 10;

  // 1. Measure module import
  const tModule0 = performance.now();
  const [
    desktop,
    { dataDir },
    { BUILD_ID, VERSION },
    { TOOLS, validate },
    { parseArguments, parseRunArguments },
    { loadDeployment, applyDeployment }
  ] = await Promise.all([
    import('./desktop.mjs'),
    import('../server/build.mjs'),
    import('../server/version.mjs'),
    import('../server/desktop-tools.mjs'),
    import('./arguments.mjs'),
    import('../server/deployment.mjs')
  ]);
  const module_load_ms = Math.round((performance.now() - tModule0) * 10) / 10;

  const { describeCommand, encodeReply, briefReply } = desktop;

  let session_read_ms = 0;
  let pipe_connect_ms = 0;
  let service_ms = 0;
  let transport_ms = 0;

  const emit = (result, isError = false) => {
    const total_cli_ms = Math.round(performance.now() * 10) / 10;
    const timings = {
      node_startup_ms,
      module_load_ms,
      session_read_ms,
      pipe_connect_ms,
      service_ms,
      transport_ms,
      total_cli_ms
    };
    stdout.write(encodeReply(result) + '\n');
    stderr.write(JSON.stringify(timings) + '\n');
    return { result, timings, exitCode: isError || (result && result.ok === false) ? 1 : 0 };
  };

  try {
    const argsCopy = [...argv];
    let jsonMode = false;
    if (argsCopy[0] === '--json') { jsonMode = true; argsCopy.shift(); }
    const rawCommand = argsCopy.shift();
    const command = rawCommand?.replace(/^computer_/, '');
    if (argsCopy[0] === '--json') { jsonMode = true; argsCopy.shift(); }

    if (!command || command === '--help') {
      const helpText = 'Native desktop skill (no MCP)\nUsage: node scripts/time-call.mjs [--json] <command> [args...]\n';
      stdout.write(helpText);
      const total_cli_ms = Math.round(performance.now() * 10) / 10;
      const timings = {
        node_startup_ms,
        module_load_ms,
        session_read_ms: 0,
        pipe_connect_ms: 0,
        service_ms: 0,
        transport_ms: 0,
        total_cli_ms
      };
      stderr.write(JSON.stringify(timings) + '\n');
      return { result: { ok: true, usage: helpText }, timings, exitCode: 0 };
    }

    if (command === 'describe') {
      const target = argsCopy[0];
      const desc = target ? describeCommand(target) : { commands: TOOLS.map(t => t.name) };
      return emit(desc);
    }

    const replyMode = jsonMode || (argsCopy.length && (!argsCopy[0].startsWith('--') || argsCopy[0] === '--request')) ? 'json' : 'brief';
    const schema = describeCommand(command).inputSchema;
    let args;
    try {
      args = command === 'run' ? parseRunArguments(schema, argsCopy, describeCommand) : parseArguments(schema, argsCopy);
      if (TOOLS.some(t => t.name === 'computer_' + command)) validate('computer_' + command, args);
      else if (Object.keys(args).length) throw Object.assign(Error('This lifecycle command takes no arguments.'), { code: 'bad_arguments' });
    } catch (argErr) {
      argErr.code = argErr.code || 'bad_arguments';
      throw argErr;
    }

    const policy = applyDeployment(loadDeployment());
    const file = path.join(dataDir(), 'desktop-session.json');

    // 2. Measure session file lookup
    const tSession0 = performance.now();
    const exists = fs.existsSync(file);
    let session = null;
    if (exists) {
      session = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    session_read_ms = Math.round((performance.now() - tSession0) * 10) / 10;

    if (!exists) {
      if (command === 'status') {
        const stopFile = path.join(dataDir(), 'emergency.stop');
        const state = fs.existsSync(stopFile) ? 'stopped' : 'not_running';
        return emit({ ok: true, state, build_version: VERSION, build_id: BUILD_ID, reconnect_required: true }, false);
      }
      throw Object.assign(Error('No desktop session is running (it may have expired after 15 idle minutes). Start the desktop service before sending actions.'), { code: 'no_session' });
    }

    // 3. Timed request over IPC pipe
    const timeout = Number(process.env.AGCU_REQUEST_TIMEOUT_MS) || 100000;
    const { result, meta } = await timedRequest(session, command, args, timeout, policy.permission_mode, BUILD_ID);
    pipe_connect_ms = meta.pipe_connect_ms ?? 0;
    service_ms = meta.service_ms ?? 0;
    transport_ms = meta.transport_ms ?? 0;

    const formatted = replyMode === 'brief' ? briefReply(result) : result;
    return emit(formatted, !result.ok);
  } catch (err) {
    if (err.pipe_connect_ms !== undefined) pipe_connect_ms = err.pipe_connect_ms;
    if (err.service_ms !== undefined) service_ms = err.service_ms;
    if (err.transport_ms !== undefined) transport_ms = err.transport_ms;
    return emit({ ok: false, error: { code: err.code || 'refused', message: err.message } }, true);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  timeCall().then(({ exitCode }) => {
    process.exitCode = exitCode;
  }).catch(() => {
    process.exitCode = 1;
  });
}
