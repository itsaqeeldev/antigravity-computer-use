// Compare two desktop task runs (either precomputed bounded reports or bounded raw receipts).
// Evaluates wall time, call count, service time, median gap, command breakdown,
// task completion, independent output verification, and speed qualification.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureRun } from './measure-run.mjs';

function validateReportMetrics(report, label) {
  if (!report || typeof report !== 'object') {
    throw Object.assign(Error(`${label} report must be a non-null object.`), { code: 'invalid_report' });
  }
  if (typeof report.wall_ms !== 'number' || !Number.isFinite(report.wall_ms) || report.wall_ms < 0) {
    throw Object.assign(Error(`${label} report must have non-negative finite numeric wall_ms.`), { code: 'invalid_report' });
  }
  if (typeof report.calls !== 'number' || !Number.isSafeInteger(report.calls) || report.calls < 0) {
    throw Object.assign(Error(`${label} report must have non-negative integer calls.`), { code: 'invalid_report' });
  }
  if (typeof report.service_ms !== 'number' || !Number.isFinite(report.service_ms) || report.service_ms < 0) {
    throw Object.assign(Error(`${label} report must have non-negative finite numeric service_ms.`), { code: 'invalid_report' });
  }
}

export function loadRunReport(input, options = {}) {
  if (typeof input === 'object' && input !== null && Number.isFinite(input.wall_ms)) {
    return input;
  }
  if (typeof input !== 'string') {
    throw Object.assign(Error('Report input must be a file path or report object.'), { code: 'bad_arguments' });
  }
  const content = fs.readFileSync(input, 'utf8').trim();
  if (content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      if (Number.isFinite(parsed.wall_ms)) return parsed;
    } catch {}
  }
  // Raw jsonl receipts: require explicit boundaries
  const hasStart = options.since != null || options.start != null;
  const hasThrough = options.through != null || options.final != null;
  if (!options.pid || !hasStart || !hasThrough) {
    throw Object.assign(Error('Raw receipts comparison requires explicit boundary parameters (pid, since/start, through/final). Supply precomputed bounded reports or provide boundary options.'), { code: 'missing_boundaries' });
  }
  const records = content.split('\n').filter(Boolean).map(JSON.parse);
  return measureRun(records, options);
}

export function compareRuns(beforeReport, afterReport) {
  validateReportMetrics(beforeReport, 'Before');
  validateReportMetrics(afterReport, 'After');

  const delta = (curr, prev) => curr - prev;
  const pctDelta = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

  // Task success and evidence assessment
  const assessSuccess = report => {
    const hasEvidence = report.success !== undefined || report.completed !== undefined;
    const explicitFailed = report.failed === true || report.success === false || report.ok === false;
    const hasToolFailures = (report.tool_failures || 0) > 0;
    const hasVerificationFailures = (report.verification_failures || 0) > 0;
    const isSuccess = hasEvidence && !explicitFailed && !hasToolFailures && !hasVerificationFailures;
    return {
      has_evidence: hasEvidence,
      failed: explicitFailed || hasToolFailures || hasVerificationFailures,
      success: isSuccess
    };
  };

  const beforeAssessment = assessSuccess(beforeReport);
  const afterAssessment = assessSuccess(afterReport);

  const beforeVerified = beforeReport.output_verified === true || beforeReport.verification?.verified === true;
  const afterVerified = afterReport.output_verified === true || afterReport.verification?.verified === true;

  // Workload comparison
  let matchedWorkload = true;
  if (beforeReport.workload && afterReport.workload && beforeReport.workload !== afterReport.workload) {
    matchedWorkload = false;
  }
  if (beforeReport.task && afterReport.task && beforeReport.task !== afterReport.task) {
    matchedWorkload = false;
  }

  // Derive qualified speed conclusion
  let qualified = false;
  let qualificationStatus = 'unqualified';
  let faster = false;
  let wallSavingsSec = 0;
  let summary = '';

  if (afterAssessment.failed) {
    qualified = false;
    qualificationStatus = 'disqualified_due_to_failure';
    faster = false;
    summary = `Task run failed with ${afterReport.tool_failures || 0} tool failures and ${afterReport.verification_failures || 0} verification failures; shorter wall time cannot be claimed as an optimization.`;
  } else if (!afterAssessment.has_evidence) {
    qualified = false;
    qualificationStatus = 'unqualified_missing_evidence';
    faster = false;
    summary = 'Run is unqualified: missing proof of successful task completion.';
  } else if (!matchedWorkload) {
    qualified = false;
    qualificationStatus = 'disqualified_mismatched_workload';
    faster = false;
    summary = 'Disqualified: Comparison between mismatched workloads or tasks.';
  } else if (!afterVerified) {
    qualified = false;
    qualificationStatus = 'unqualified_missing_verification';
    faster = false;
    summary = 'Run completed without errors but lacks independent output verification evidence.';
  } else {
    // Both completed successfully with verified outputs on matched workload
    if (afterReport.wall_ms < beforeReport.wall_ms) {
      qualified = true;
      qualificationStatus = 'qualified_speedup';
      faster = true;
      wallSavingsSec = Math.round((beforeReport.wall_ms - afterReport.wall_ms) / 100) / 10;
      summary = `Run is ${Math.abs(pctDelta(afterReport.wall_ms, beforeReport.wall_ms))}% faster (${wallSavingsSec}s saved) with zero failures and verified output.`;
    } else {
      qualified = true;
      qualificationStatus = 'no_speedup';
      faster = false;
      summary = 'Run completed successfully with verified output, but wall time did not improve.';
    }
  }

  const comparison = {
    matched_workload: matchedWorkload,
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
      has_completion_evidence: beforeAssessment.has_evidence,
      success: beforeAssessment.success,
      output_verified: beforeVerified
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
      has_completion_evidence: afterAssessment.has_evidence,
      success: afterAssessment.success,
      output_verified: afterVerified
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
      qualified,
      qualification_status: qualificationStatus,
      faster,
      fewer_calls: afterReport.calls < beforeReport.calls,
      wall_savings_sec: wallSavingsSec,
      summary
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
| Task Completed | ${comp.before.has_completion_evidence ? (comp.before.success ? 'Yes' : 'Failed') : 'Unqualified'} | ${comp.after.has_completion_evidence ? (comp.after.success ? 'Yes' : 'Failed') : 'Unqualified'} | - |
| Output Verified | ${comp.before.output_verified ? 'Yes' : 'Unverified'} | ${comp.after.output_verified ? 'Yes' : 'Unverified'} | - |
| Qualification Status | - | - | **${comp.conclusion.qualification_status}** |

## Command Breakdown
| Command | Before Calls | After Calls | Call Delta | Before Svc (ms) | After Svc (ms) | Svc Delta (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${Object.entries(comp.command_deltas).map(([cmd, d]) => `| \`${cmd}\` | ${d.before_count} | ${d.after_count} | ${sign(d.count_delta)} | ${d.before_service_ms} | ${d.after_service_ms} | ${sign(d.service_ms_delta)} |`).join('\n')}

**Conclusion**: ${comp.conclusion.summary} ${comp.conclusion.fewer_calls ? `Required ${Math.abs(comp.deltas.calls)} fewer controller round trips.` : ''}
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
