import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {testDirectory} from './paths.mjs';
import {compareRuns, loadRunReport, formatComparisonMarkdown} from '../scripts/compare-runs.mjs';

test('compareRuns computes correct deltas and percentages across matched runs', () => {
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
});

test('compareRuns validates inputs and rejects missing or non-numeric metrics', () => {
  assert.throws(() => compareRuns(null, {}), /Provide both before and after reports/);
  assert.throws(() => compareRuns({}, null), /Provide both before and after reports/);
  assert.throws(() => compareRuns({ wall_ms: 'invalid' }, { wall_ms: 100 }), /valid numeric wall_ms/);
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
