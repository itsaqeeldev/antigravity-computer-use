// Compare two desktop task runs (either raw receipts or measure-run JSON reports).
// Evaluates wall time, call count, service time, median gap, and command breakdown.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {measureRun} from './measure-run.mjs';

export function loadRunReport(input, options = {}) {
  if (typeof input === 'object' && input !== null && Number.isFinite(input.wall_ms)) {
    return input;
  }
  const content = fs.readFileSync(input, 'utf8').trim();
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (Number.isFinite(parsed.wall_ms)) return parsed;
    } catch {}
  }
  // If input is a jsonl receipts file, options must provide { pid, since, through }
  const records = content.split('\n').filter(Boolean).map(JSON.parse);
  return measureRun(records, options);
}

export function compareRuns(beforeReport, afterReport) {
  if (!beforeReport || !afterReport) throw Error('Provide both before and after reports to compare.');
  if (!Number.isFinite(beforeReport.wall_ms) || !Number.isFinite(afterReport.wall_ms)) {
    throw Error('Both reports must have valid numeric wall_ms.');
  }

  const delta = (curr, prev) => curr - prev;
  const pctDelta = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

  const comparison = {
    before: {
      pid: beforeReport.pid,
      from: beforeReport.from,
      through: beforeReport.through,
      wall_ms: beforeReport.wall_ms,
      calls: beforeReport.calls,
      service_ms: beforeReport.service_ms,
      median_service_ms: beforeReport.median_service_ms,
      median_gap_ms: beforeReport.median_gap_ms,
      tool_failures: beforeReport.tool_failures || 0,
      verification_failures: beforeReport.verification_failures || 0,
    },
    after: {
      pid: afterReport.pid,
      from: afterReport.from,
      through: afterReport.through,
      wall_ms: afterReport.wall_ms,
      calls: afterReport.calls,
      service_ms: afterReport.service_ms,
      median_service_ms: afterReport.median_service_ms,
      median_gap_ms: afterReport.median_gap_ms,
      tool_failures: afterReport.tool_failures || 0,
      verification_failures: afterReport.verification_failures || 0,
    },
    deltas: {
      wall_ms: delta(afterReport.wall_ms, beforeReport.wall_ms),
      wall_pct: pctDelta(afterReport.wall_ms, beforeReport.wall_ms),
      calls: delta(afterReport.calls, beforeReport.calls),
      calls_pct: pctDelta(afterReport.calls, beforeReport.calls),
      service_ms: delta(afterReport.service_ms, beforeReport.service_ms),
      service_pct: pctDelta(afterReport.service_ms, beforeReport.service_ms),
      median_gap_ms: (afterReport.median_gap_ms != null && beforeReport.median_gap_ms != null)
        ? delta(afterReport.median_gap_ms, beforeReport.median_gap_ms) : null,
      median_gap_pct: (afterReport.median_gap_ms != null && beforeReport.median_gap_ms != null)
        ? pctDelta(afterReport.median_gap_ms, beforeReport.median_gap_ms) : null,
    },
    command_deltas: {},
    conclusion: {
      faster: afterReport.wall_ms < beforeReport.wall_ms,
      fewer_calls: afterReport.calls < beforeReport.calls,
      wall_savings_sec: Math.round((beforeReport.wall_ms - afterReport.wall_ms) / 100) / 10,
    }
  };

  const allCommands = new Set([
    ...Object.keys(beforeReport.groups || {}),
    ...Object.keys(afterReport.groups || {})
  ]);

  for (const cmd of allCommands) {
    const bGroup = beforeReport.groups?.[cmd] || { count: 0, service_ms: 0 };
    const aGroup = afterReport.groups?.[cmd] || { count: 0, service_ms: 0 };
    comparison.command_deltas[cmd] = {
      before_count: bGroup.count,
      after_count: aGroup.count,
      count_delta: aGroup.count - bGroup.count,
      before_service_ms: bGroup.service_ms,
      after_service_ms: aGroup.service_ms,
      service_ms_delta: aGroup.service_ms - bGroup.service_ms,
    };
  }

  return comparison;
}

export function formatComparisonMarkdown(comp) {
  const sign = num => num > 0 ? `+${num}` : `${num}`;
  const pctStr = pct => pct != null ? ` (${sign(pct)}%)` : '';

  return `# Computer Use Latency Comparison

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Total Wall Time | ${comp.before.wall_ms.toLocaleString()} ms (${(comp.before.wall_ms / 1000).toFixed(1)}s) | ${comp.after.wall_ms.toLocaleString()} ms (${(comp.after.wall_ms / 1000).toFixed(1)}s) | ${sign(comp.deltas.wall_ms)} ms${pctStr(comp.deltas.wall_pct)} |
| Controller Calls | ${comp.before.calls} | ${comp.after.calls} | ${sign(comp.deltas.calls)}${pctStr(comp.deltas.calls_pct)} |
| Controller Service Time | ${comp.before.service_ms.toLocaleString()} ms | ${comp.after.service_ms.toLocaleString()} ms | ${sign(comp.deltas.service_ms)} ms${pctStr(comp.deltas.service_pct)} |
| Median Service Time | ${comp.before.median_service_ms ?? 'N/A'} ms | ${comp.after.median_service_ms ?? 'N/A'} ms | - |
| Median Decision Gap | ${comp.before.median_gap_ms ?? 'N/A'} ms | ${comp.after.median_gap_ms ?? 'N/A'} ms | ${comp.deltas.median_gap_ms != null ? sign(comp.deltas.median_gap_ms) + ' ms' + pctStr(comp.deltas.median_gap_pct) : 'N/A'} |
| Tool Failures | ${comp.before.tool_failures} | ${comp.after.tool_failures} | ${sign(comp.after.tool_failures - comp.before.tool_failures)} |
| Verification Failures | ${comp.before.verification_failures} | ${comp.after.verification_failures} | ${sign(comp.after.verification_failures - comp.before.verification_failures)} |

## Command Breakdown
| Command | Before Calls | After Calls | Call Delta | Before Svc (ms) | After Svc (ms) | Svc Delta (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${Object.entries(comp.command_deltas).map(([cmd, d]) => `| \`${cmd}\` | ${d.before_count} | ${d.after_count} | ${sign(d.count_delta)} | ${d.before_service_ms} | ${d.after_service_ms} | ${sign(d.service_ms_delta)} |`).join('\n')}

**Conclusion**: ${comp.conclusion.faster ? `Run is ${Math.abs(comp.deltas.wall_pct)}% faster (${comp.conclusion.wall_savings_sec}s saved)` : 'Run did not improve wall time'}. ${comp.conclusion.fewer_calls ? `Required ${Math.abs(comp.deltas.calls)} fewer controller round trips.` : ''}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [beforePath, afterPath, outputPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    throw Error('Usage: node scripts/compare-runs.mjs BEFORE_JSON AFTER_JSON [OUTPUT_MD_OR_JSON]');
  }
  const before = loadRunReport(beforePath);
  const after = loadRunReport(afterPath);
  const comparison = compareRuns(before, after);

  if (outputPath) {
    if (outputPath.endsWith('.json')) {
      fs.writeFileSync(outputPath, JSON.stringify(comparison, null, 2) + '\n');
    } else {
      fs.writeFileSync(outputPath, formatComparisonMarkdown(comparison));
    }
  }
  console.log(formatComparisonMarkdown(comparison));
}
