// Adapted stdio dispatch and tool vocabulary from ridelink0/claude-computer-use (MIT).
// Baseline measurement runner for Antigravity Computer Use CLI operations.
// Executes cold and warm iterations of benchmark commands, capturing timing breakdowns.
// Saves all benchmark outputs strictly into .localdata/benchmarks/.

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
    'node_startup_ms',
    'module_load_ms',
    'session_read_ms',
    'pipe_connect_ms',
    'service_ms',
    'transport_ms',
    'total_cli_ms'
  ];

  const aggregated = {};
  for (const key of metricKeys) {
    const vals = records
      .map(r => r[key])
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    aggregated[key] = computeStats(vals);
  }
  return aggregated;
}

export function runBenchmarkIteration(commandArgs, envOverrides = {}) {
  const timeCallScript = path.join(projectRoot, 'scripts', 'time-call.mjs');
  const result = spawnSync(process.execPath, [timeCallScript, ...commandArgs], {
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...envOverrides }
  });

  let timing = null;
  if (result.stderr) {
    const lines = result.stderr.trim().split('\n');
    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed && typeof parsed.total_cli_ms === 'number') {
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
  const warmRunsCount = options.warmRuns || 10;
  const settleMs = options.settleMs || 50;
  const outputDir = options.outputDir || defaultOutputDir;
  fs.mkdirSync(outputDir, { recursive: true });

  // Probe service availability
  const probe = runBenchmarkIteration(['status'], options.env);
  const serviceAvailable = probe.exitCode === 0 &&
    probe.stdoutJson &&
    probe.stdoutJson.reconnect_required !== true &&
    probe.stdoutJson.state !== 'not_running' &&
    probe.stdoutJson.state !== 'stopped';

  const suiteCommands = [
    { name: 'describe_click', args: ['describe', 'click'], type: 'client_offline' },
    { name: 'status', args: ['status'], type: 'ipc_healthcheck' }
  ];

  if (serviceAvailable) {
    suiteCommands.push({ name: 'apps', args: ['apps'], type: 'native_enumeration' });
    let hwnd = options.hwnd;
    if (!hwnd) {
      const appsProbe = runBenchmarkIteration(['apps'], options.env);
      if (appsProbe.stdoutJson && Array.isArray(appsProbe.stdoutJson.windows) && appsProbe.stdoutJson.windows.length > 0) {
        hwnd = appsProbe.stdoutJson.windows[0].hwnd;
      }
    }
    if (hwnd) {
      suiteCommands.push({ name: 'snapshot', args: ['snapshot', '--hwnd', String(hwnd)], type: 'ui_observation' });
    }
  }

  const suiteResults = {
    timestamp: new Date().toISOString(),
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    warm_iterations: warmRunsCount,
    service_available: serviceAvailable,
    commands: {}
  };

  for (const item of suiteCommands) {
    console.log(`Executing benchmark: ${item.name} (${item.type})...`);

    // Cold run (Iteration 0)
    const cold = runBenchmarkIteration(item.args, options.env);
    await new Promise(r => setTimeout(r, settleMs));

    // Warm runs (Iterations 1..N)
    const warmRecords = [];
    for (let i = 0; i < warmRunsCount; i++) {
      const run = runBenchmarkIteration(item.args, options.env);
      if (run.timing) {
        warmRecords.push(run.timing);
      }
      await new Promise(r => setTimeout(r, settleMs));
    }

    suiteResults.commands[item.name] = {
      type: item.type,
      args: item.args,
      cold_run: cold.timing,
      warm_runs_count: warmRecords.length,
      warm_summary: aggregateMetrics(warmRecords),
      raw_warm: warmRecords
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
