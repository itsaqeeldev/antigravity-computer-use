// Baseline measurement runner for Antigravity Computer Use CLI operations.
// Measures external process wall time and internal phases for cold and subsequent invocations.
// Saves all benchmark outputs strictly into .localdata/benchmarks/.
//
// Reliability & Safety Rules:
// 1. Default diagnostics NEVER select an arbitrary window/app.
// 2. Native observation benchmarks require an explicit target (--hwnd).
// 3. Desktop-sensitive benchmarking refuses when another task owns active control.
// 4. Child processes have bounded lifetimes (timeouts) and cleanup.
// 5. Failed/refused runs remain in raw results but are never mixed into successful timing summaries.
// 6. First-process and subsequent process invocations are accurately labeled.
//    Subsequent process launches reflect warm OS filesystem cache, NOT a persistent warm JS client.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultOutputDir = path.join(projectRoot, '.localdata', 'benchmarks');

export function computeStats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted.length % 2 === 0
    ? Math.round(((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) * 10) / 10
    : sorted[Math.floor(sorted.length / 2)];
  const mean = Math.round((sorted.reduce((sum, v) => sum + v, 0) / sorted.length) * 10) / 10;
  return { min, median, mean, max };
}

export function aggregateMetrics(records) {
  const metricKeys = [
    'external_wall_ms',
    'teardown_and_delivery_ms',
    'entry_timestamp_ms',
    'module_load_ms',
    'session_read_ms',
    'pipe_connect_ms',
    'service_ms',
    'transport_ms',
    'internal_cli_ms',
    // Aliases
    'node_startup_ms',
    'total_cli_ms'
  ];

  const aggregated = {};
  for (const key of metricKeys) {
    const vals = records
      .map(r => r[key])
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    if (vals.length > 0) {
      aggregated[key] = computeStats(vals);
    }
  }
  return aggregated;
}

export function runBenchmarkIteration(commandArgs, envOverrides = {}, options = {}) {
  const timeCallScript = path.join(projectRoot, 'scripts', 'time-call.mjs');
  const timeoutMs = options.timeoutMs || 30000;
  const result = spawnSync(process.execPath, [timeCallScript, ...commandArgs], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
    env: { ...process.env, ...envOverrides }
  });

  let timing = null;
  if (result.stderr) {
    const lines = result.stderr.trim().split('\n');
    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed && typeof parsed.external_wall_ms === 'number') {
          timing = parsed;
          break;
        } else if (parsed && typeof parsed.total_cli_ms === 'number') {
          timing = parsed;
          break;
        }
      } catch {}
    }
  }

  let stdoutJson = null;
  if (result.stdout) {
    try { stdoutJson = JSON.parse(result.stdout.trim()); } catch {}
  }

  return {
    exitCode: result.status,
    stdout: result.stdout,
    stdoutJson,
    stderr: result.stderr,
    timing
  };
}

export async function runBenchmarkSuite(options = {}) {
  const warmRunsCount = options.warmRuns || 5;
  const settleMs = options.settleMs || 50;
  const timeoutMs = options.timeoutMs || 30000;
  const outputDir = options.outputDir || defaultOutputDir;
  fs.mkdirSync(outputDir, { recursive: true });

  // 1. Probe service availability
  const probe = runBenchmarkIteration(['status'], options.env, { timeoutMs });
  const serviceAvailable = probe.exitCode === 0 &&
    probe.stdoutJson &&
    probe.stdoutJson.reconnect_required !== true &&
    probe.stdoutJson.state !== 'not_running' &&
    probe.stdoutJson.state !== 'stopped';

  // 2. Check for active control conflict
  const activeTaskRunning = probe.stdoutJson?.active === true || probe.stdoutJson?.state === 'running';

  const suiteCommands = [
    { name: 'describe_click', args: ['describe', 'click'], type: 'client_offline' },
    { name: 'describe_all', args: ['describe', '--all'], type: 'client_offline' },
    { name: 'status', args: ['status'], type: 'ipc_healthcheck' }
  ];

  if (serviceAvailable) {
    if (activeTaskRunning) {
      console.warn('Notice: Another task owns active desktop control. Desktop-sensitive benchmarks refused.');
    } else {
      if (options.includeApps) {
        suiteCommands.push({ name: 'apps', args: ['apps'], type: 'native_enumeration' });
      }
      // Explicit target only: NEVER select an arbitrary window
      if (options.hwnd) {
        suiteCommands.push({ name: 'snapshot_explicit', args: ['snapshot', '--hwnd', String(options.hwnd)], type: 'ui_observation' });
      }
    }
  }

  const suiteResults = {
    timestamp: new Date().toISOString(),
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    subsequent_iterations_requested: warmRunsCount,
    service_available: serviceAvailable,
    active_control_detected: activeTaskRunning,
    environment_notes: 'Subsequent process launches measure separate Node processes with warm OS filesystem cache, not a persistent V8 client.',
    commands: {}
  };

  for (const item of suiteCommands) {
    console.log(`Executing benchmark: ${item.name} (${item.type})...`);

    const rawRuns = [];
    const successfulWarmRecords = [];
    let failedRunsCount = 0;

    // Iteration 0: First-process invocation (cold OS/disk cache)
    const cold = runBenchmarkIteration(item.args, options.env, { timeoutMs });
    const coldOk = cold.exitCode === 0 && cold.stdoutJson?.ok !== false;
    rawRuns.push({
      iteration: 0,
      kind: 'first_process_invocation',
      exit_code: cold.exitCode,
      ok: coldOk,
      timing: cold.timing,
      error: cold.stdoutJson?.error
    });

    await new Promise(r => setTimeout(r, settleMs));

    // Iterations 1..N: Subsequent process invocations (warm OS/disk cache, separate processes)
    for (let i = 1; i <= warmRunsCount; i++) {
      const run = runBenchmarkIteration(item.args, options.env, { timeoutMs });
      const isOk = run.exitCode === 0 && run.stdoutJson?.ok !== false;
      rawRuns.push({
        iteration: i,
        kind: 'subsequent_process_invocation',
        exit_code: run.exitCode,
        ok: isOk,
        timing: run.timing,
        error: run.stdoutJson?.error
      });

      // Filter: ONLY successful runs are aggregated into timing summaries
      if (isOk && run.timing) {
        successfulWarmRecords.push(run.timing);
      } else {
        failedRunsCount++;
      }
      await new Promise(r => setTimeout(r, settleMs));
    }

    suiteResults.commands[item.name] = {
      type: item.type,
      args: item.args,
      first_process_invocation: cold.timing,
      subsequent_runs_count: warmRunsCount,
      successful_runs_count: successfulWarmRecords.length,
      failed_runs_count: failedRunsCount,
      warm_summary: successfulWarmRecords.length > 0 ? aggregateMetrics(successfulWarmRecords) : null,
      status: failedRunsCount === 0 ? 'success' : (successfulWarmRecords.length > 0 ? 'partial_failure' : 'all_failed'),
      raw_runs: rawRuns
    };
  }

  const resultFilePath = path.join(outputDir, 'baseline-results.json');
  fs.writeFileSync(resultFilePath, JSON.stringify(suiteResults, null, 2) + '\n');
  console.log(`Benchmark completed. Results written to: ${resultFilePath}`);
  return suiteResults;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBenchmarkSuite().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
  });
}
