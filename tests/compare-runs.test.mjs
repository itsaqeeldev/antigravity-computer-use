import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {testDirectory} from './paths.mjs';
import {compareRuns, loadRunReport, formatComparisonMarkdown} from '../scripts/compare-runs.mjs';

test('compareRuns computes correct deltas and percentages across matched runs with verified output', () => {
  const before = {
    pid: '100',
    from: '2026-10-24T10:00:00.000Z',
    through: '100.15',
    wall_ms: 269280,
    calls: 15,
    service_ms: 11893,
    median_service_ms: 450,
    median_gap_ms: 9500,
    tool_failures: 0,
    verification_failures: 0,
    success: true,
    output_verified: true,
    groups: {
      computer_snapshot: { count: 5, service_ms: 4500 },
      computer_click: { count: 8, service_ms: 3600 },
      computer_file_dialog: { count: 2, service_ms: 3793 },
    }
  };

  const after = {
    pid: '200',
    from: '2026-10-28T10:00:00.000Z',
    through: '200.10',
    wall_ms: 185000,
    calls: 10,
    service_ms: 9200,
    median_service_ms: 410,
    median_gap_ms: 9200,
    tool_failures: 0,
    verification_failures: 0,
    success: true,
    output_verified: true,
    groups: {
      computer_snapshot: { count: 3, service_ms: 2100 },
      computer_run: { count: 3, service_ms: 3800 },
      computer_click: { count: 4, service_ms: 3300 },
    }
  };

  const result = compareRuns(before, after);

  assert.equal(result.deltas.wall_ms, -84280);
  assert.equal(result.deltas.wall_pct, -31.3);
  assert.equal(result.deltas.calls, -5);
  assert.equal(result.deltas.calls_pct, -33.3);
  assert.equal(result.deltas.service_ms, -2693);
  assert.equal(result.deltas.median_gap_ms, -300);
  assert.equal(result.conclusion.faster, true);
  assert.equal(result.conclusion.qualified, true);
  assert.equal(result.conclusion.qualification_status, 'qualified_speedup');
  assert.equal(result.conclusion.fewer_calls, true);
  assert.equal(result.conclusion.wall_savings_sec, 84.3);

  // Check command breakdown
  assert.equal(result.command_deltas.computer_snapshot.count_delta, -2);
  assert.equal(result.command_deltas.computer_run.count_delta, 3);
  assert.equal(result.command_deltas.computer_file_dialog.after_count, 0);
  assert.equal(result.command_deltas.computer_file_dialog.count_delta, -2);

  // Markdown formatting
  const md = formatComparisonMarkdown(result);
  assert.match(md, /Total Wall Time/);
  assert.match(md, /269,280 ms/);
  assert.match(md, /185,000 ms/);
  assert.match(md, /-84280 ms \(-31\.3%\)/);
  assert.match(md, /31\.3% faster/);
  assert.match(md, /qualified_speedup/);
});

test('failed-but-shorter run with tool failure is disqualified and not reported as faster', () => {
  const before = {
    wall_ms: 1000,
    calls: 15,
    service_ms: 400,
    tool_failures: 0,
    verification_failures: 0,
    success: true,
    output_verified: true
  };

  const after = {
    wall_ms: 100,
    calls: 1,
    service_ms: 40,
    tool_failures: 1,
    verification_failures: 0,
    success: false,
    output_verified: false
  };

  const result = compareRuns(before, after);
  assert.equal(result.conclusion.faster, false, 'Failed task must NOT be reported as faster');
  assert.equal(result.conclusion.qualified, false, 'Failed task must NOT be qualified');
  assert.equal(result.conclusion.qualification_status, 'disqualified_due_to_failure');
  assert.match(result.conclusion.summary, /shorter wall time cannot be claimed as an optimization/);

  const md = formatComparisonMarkdown(result);
  assert.doesNotMatch(md, /Run is 90% faster/, 'Markdown must not claim speedup on failed run');
  assert.match(md, /disqualified_due_to_failure/);
});

test('failed-but-shorter run with verification failure is disqualified', () => {
  const before = {
    wall_ms: 2000,
    calls: 5,
    service_ms: 500,
    tool_failures: 0,
    verification_failures: 0,
    success: true,
    output_verified: true
  };

  const after = {
    wall_ms: 500,
    calls: 2,
    service_ms: 100,
    tool_failures: 0,
    verification_failures: 1,
    success: false,
    output_verified: false
  };

  const result = compareRuns(before, after);
  assert.equal(result.conclusion.faster, false);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'disqualified_due_to_failure');
});

test('missing success or completion evidence leaves run unqualified', () => {
  const before = { wall_ms: 1000, calls: 5, service_ms: 200, success: true, output_verified: true };
  const after = { wall_ms: 500, calls: 3, service_ms: 100 }; // Missing success and output_verified
  const result = compareRuns(before, after);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'unqualified_missing_evidence');
  assert.equal(result.conclusion.faster, false);
});

test('unverified output leaves run unqualified despite zero failures', () => {
  const before = { wall_ms: 1000, calls: 5, service_ms: 200, success: true, output_verified: true };
  const after = { wall_ms: 500, calls: 3, service_ms: 100, success: true, output_verified: false };
  const result = compareRuns(before, after);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'unqualified_missing_verification');
  assert.equal(result.conclusion.faster, false);
});

test('mismatched workloads are disqualified', () => {
  const before = { wall_ms: 1000, calls: 5, service_ms: 200, success: true, output_verified: true, workload: 'export_upscaly' };
  const after = { wall_ms: 500, calls: 3, service_ms: 100, success: true, output_verified: true, workload: 'open_notepad' };
  const result = compareRuns(before, after);
  assert.equal(result.matched_workload, false);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'disqualified_mismatched_workload');
});

test('compareRuns validates inputs and rejects missing or non-numeric metrics', () => {
  assert.throws(() => compareRuns(null, {}), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns({}, null), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns({ wall_ms: 'invalid', calls: 1, service_ms: 10 }, { wall_ms: 100, calls: 1, service_ms: 10 }), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns({ wall_ms: -50, calls: 1, service_ms: 10 }, { wall_ms: 100, calls: 1, service_ms: 10 }), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns({ wall_ms: 100, calls: -1, service_ms: 10 }, { wall_ms: 100, calls: 1, service_ms: 10 }), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns({ wall_ms: 100, calls: 1, service_ms: NaN }, { wall_ms: 100, calls: 1, service_ms: 10 }), error => error.code === 'invalid_report');
});

test('loadRunReport parses JSON report files correctly', () => {
  const dir = testDirectory('compare-runs');
  fs.mkdirSync(dir, { recursive: true });
  const reportFile = path.join(dir, 'test-report.json');
  try {
    const reportData = {
      pid: '300',
      from: '2026-10-28T12:00:00.000Z',
      through: '300.5',
      wall_ms: 50000,
      calls: 5,
      service_ms: 3000,
    };
    fs.writeFileSync(reportFile, JSON.stringify(reportData));
    const loaded = loadRunReport(reportFile);
    assert.equal(loaded.pid, '300');
    assert.equal(loaded.wall_ms, 50000);
    assert.equal(loaded.calls, 5);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('loadRunReport rejects raw receipts jsonl when explicit boundaries are missing', () => {
  const dir = testDirectory('compare-runs-raw');
  fs.mkdirSync(dir, { recursive: true });
  const receiptsFile = path.join(dir, 'receipts.jsonl');
  try {
    fs.writeFileSync(receiptsFile, '{"ts":"2026-10-28T00:00:00Z"}\n');
    assert.throws(() => loadRunReport(receiptsFile), error => error.code === 'missing_boundaries');
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('adversarial: completed: false is disqualified and never marked as success or faster', () => {
  const before = { wall_ms: 1000, calls: 5, service_ms: 200, success: true, output_verified: true };
  const after = { wall_ms: 200, calls: 2, service_ms: 50, completed: false, output_verified: true };
  const result = compareRuns(before, after);
  assert.equal(result.after.success, false);
  assert.equal(result.conclusion.faster, false);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'disqualified_due_to_failure');
});

test('adversarial: before run failure disqualifies comparison even if after run succeeded', () => {
  const before = { wall_ms: 2000, calls: 10, service_ms: 500, tool_failures: 2, success: false, output_verified: false };
  const after = { wall_ms: 500, calls: 3, service_ms: 100, success: true, output_verified: true };
  const result = compareRuns(before, after);
  assert.equal(result.before.success, false);
  assert.equal(result.conclusion.faster, false);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'disqualified_due_to_failure');
  assert.match(result.conclusion.summary, /Baseline run failed/);
});

test('adversarial: before run unverified leaves comparison unqualified', () => {
  const before = { wall_ms: 2000, calls: 10, service_ms: 500, success: true, output_verified: false };
  const after = { wall_ms: 500, calls: 3, service_ms: 100, success: true, output_verified: true };
  const result = compareRuns(before, after);
  assert.equal(result.conclusion.faster, false);
  assert.equal(result.conclusion.qualified, false);
  assert.equal(result.conclusion.qualification_status, 'unqualified_missing_verification');
  assert.match(result.conclusion.summary, /baseline lacks independent output verification/);
});

test('adversarial: invalid tool_failures or verification_failures or median gaps throw invalid_report', () => {
  const valid = { wall_ms: 1000, calls: 5, service_ms: 200, success: true, output_verified: true };
  assert.throws(() => compareRuns({ ...valid, tool_failures: -1 }, valid), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns({ ...valid, tool_failures: 'none' }, valid), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns(valid, { ...valid, verification_failures: -2 }), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns(valid, { ...valid, median_gap_ms: -10 }), error => error.code === 'invalid_report');
  assert.throws(() => compareRuns(valid, { ...valid, median_service_ms: NaN }), error => error.code === 'invalid_report');
});
