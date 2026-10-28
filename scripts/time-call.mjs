// Diagnostic timing wrapper for desktop CLI commands.
// Measures external process wall time (before spawn until process close),
// internal milestones (entry timestamp, module load, session read, pipe connect,
// service execution, transport), teardown/output delivery, and process/delivery status.
//
// Timing Definitions:
// - external_wall_ms: Parent-observed wall time from immediately before spawn
//   until the child process exits and all stdio streams close. Complete invocation wall time.
// - entry_timestamp_ms: Timestamp recorded at the first script statement of the CLI.
//   Includes OS process initialization, V8 runtime startup, and script compilation.
//   (Retained with backward-compatible alias node_startup_ms).
// - module_load_ms: Elapsed time to resolve and evaluate local CLI modules.
//   Excludes Node built-in module initialization.
// - session_read_ms: Elapsed time to read and parse desktop-session.json.
// - pipe_connect_ms: Elapsed time from net.createConnection() until socket connect event.
// - service_ms: Service execution time reported by the native controller receipt.
// - transport_ms: Roundtrip minus service execution time.
// - internal_cli_ms: Internal CLI runtime up to output emission (alias: total_cli_ms).
// - teardown_and_delivery_ms: Difference between external_wall_ms and internal_cli_ms,
//   accounting for output buffering, stdio flush, and process teardown.

import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export { request as timedRequest } from './desktop.mjs';

export function runTimedCommand(args, { env = {}, stdout = process.stdout, stderr = process.stderr, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const desktopScript = fileURLToPath(new URL('./desktop.mjs', import.meta.url));
    const t0 = performance.now();
    const child = spawn(process.execPath, [desktopScript, ...args], {
      windowsHide: true,
      env: { ...process.env, ...env, AGCU_TIMING: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let rawStdout = '';
    let rawStderr = '';
    let internalMetrics = null;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => {
      rawStdout += chunk;
      if (stdout) stdout.write(chunk);
    });

    child.stderr.on('data', chunk => {
      rawStderr += chunk;
    });

    let timer = null;
    if (timeout > 0) {
      timer = setTimeout(() => {
        child.kill('SIGTERM');
      }, timeout);
    }

    child.on('error', err => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on('close', (status, signal) => {
      if (timer) clearTimeout(timer);
      const tClose = performance.now();
      const external_wall_ms = Math.round((tClose - t0) * 10) / 10;

      // Extract internal timing JSON from stderr
      const stderrLines = rawStderr.split('\n');
      const forwardStderrLines = [];
      for (const line of stderrLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!internalMetrics && trimmed.startsWith('{') && trimmed.includes('"timing_schema"')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed.internal_cli_ms === 'number') {
              internalMetrics = parsed;
              continue;
            }
          } catch {}
        }
        forwardStderrLines.push(line);
      }

      // Forward any non-timing stderr to stderr output
      if (stderr && forwardStderrLines.length > 0) {
        stderr.write(forwardStderrLines.join('\n') + '\n');
      }

      let stdoutJson = null;
      try { stdoutJson = JSON.parse(rawStdout.trim()); } catch {}

      const internal_cli_ms = internalMetrics?.internal_cli_ms ?? external_wall_ms;
      const teardown_and_delivery_ms = Math.max(0, Math.round((external_wall_ms - internal_cli_ms) * 10) / 10);

      const isSuccess = status === 0 && (stdoutJson?.ok !== false);
      const delivery_uncertain = stdoutJson?.delivery_unknown === true || internalMetrics?.delivery_uncertain === true;

      const metrics = {
        // External parent-observed timing (complete wall time)
        external_wall_ms,
        teardown_and_delivery_ms,

        // Internal milestone timings
        entry_timestamp_ms: internalMetrics?.entry_timestamp_ms ?? 0,
        module_load_ms: internalMetrics?.module_load_ms ?? 0,
        session_read_ms: internalMetrics?.session_read_ms ?? 0,
        pipe_connect_ms: internalMetrics?.pipe_connect_ms ?? 0,
        service_ms: internalMetrics?.service_ms ?? 0,
        transport_ms: internalMetrics?.transport_ms ?? 0,
        internal_cli_ms,

        // Backward compatibility aliases
        node_startup_ms: internalMetrics?.entry_timestamp_ms ?? 0,
        total_cli_ms: internal_cli_ms,

        // Execution status and reliability evidence
        exit_code: status,
        ok: isSuccess,
        success: isSuccess,
        delivery_uncertain,
        error_code: stdoutJson?.error?.code ?? (status !== 0 ? 'command_failed' : undefined)
      };

      if (stderr) {
        stderr.write(JSON.stringify(metrics) + '\n');
      }

      resolve({
        stdout: rawStdout,
        stdoutJson,
        stderr: rawStderr,
        timing: metrics,
        timings: metrics,
        exitCode: status ?? (signal ? 1 : 0)
      });
    });
  });
}

export async function timeCall(argv = process.argv.slice(2), options = {}) {
  return runTimedCommand(argv, options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  timeCall().then(({ exitCode }) => {
    process.exitCode = exitCode;
  }).catch(() => {
    process.exitCode = 1;
  });
}
