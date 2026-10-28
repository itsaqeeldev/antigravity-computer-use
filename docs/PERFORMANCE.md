# Measuring desktop task latency

Use a real app task in Antigravity and preserve its exact build, model, input,
settings, prompt start time and final task receipt ID. Save all local test
artifacts under the checkout's ignored `.localdata/` directory. Keep hardware,
model and inference-setting changes visible in any comparison.

```text
node scripts/measure-run.mjs RECEIPTS PID TASK_START FINAL_RECEIPT OUTPUT
node scripts/compare-runs.mjs BEFORE_JSON AFTER_JSON [OUTPUT_MD_OR_JSON]
node scripts/time-call.mjs COMMAND [ARGS...]
node scripts/benchmark-baseline.mjs
```

For example, use `123.18` as the final receipt if that was the task's final
status response. Later diagnostic polls are excluded. The report separates
controller execution, inter-call gaps and verification errors. Gaps include
host/model reasoning, terminal startup, image inspection and file tools; they
are not a measurement of model reasoning alone.

`compare-runs.mjs` evaluates matched before/after runs, computing deltas for
wall time, call counts, controller service time, median decision gaps, and
per-command breakdown. It strictly validates report metrics and requires task
success and independent output verification before qualifying any speedup. A
failed task is disqualified and never reported as faster despite shorter wall
time.

## Empirical timing measurements and orchestration findings (28 October 2026)

High-resolution timing harness (`scripts/time-call.mjs`, `scripts/benchmark-baseline.mjs`)
instruments external process wall time and internal phase breakdowns across cold and subsequent invocations.

### Metric definitions

- **`external_wall_ms`**: Complete parent-observed wall time from immediately before `spawn` until process close and stdio flush. Measured at ~110–180 ms for cold/warm process launches.
- **`teardown_and_delivery_ms`**: Wall time spent on stdio serialization, stream closing, and Node process teardown (`external_wall_ms - internal_cli_ms`), typically ~40–120 ms.
- **`entry_timestamp_ms`**: Timestamp recorded at the first script statement of `desktop.mjs`. Includes OS process bootstrap and Node runtime initialization up to script entry (~30–45 ms).
- **`module_load_ms`**: Elapsed time to resolve and evaluate local CLI modules (`build.mjs`, `version.mjs`, `desktop-tools.mjs`, `arguments.mjs`, `storage.mjs`, `deployment.mjs`). Excludes Node built-in module initialization (~10–20 ms cold, < 1 ms warm).
- **`session_read_ms`**: High-resolution file read and JSON parse of `desktop-session.json` (~0.1–0.5 ms).
- **`pipe_connect_ms`**: High-resolution elapsed time from `net.createConnection()` until the socket `connect` event (~1–3 ms).
- **`service_ms`**: Execution time reported by the native controller receipt.
- **`transport_ms`**: Pipe round-trip minus native service execution time (~1–4 ms).
- **`internal_cli_ms`**: Internal runtime up to output emission (~35–50 ms).

### Illustrative local measurements (Windows x64)

| Stage | First process invocation (cold) | Subsequent process invocations (5 runs median) | Mean | Max |
| --- | ---: | ---: | ---: | ---: |
| Process entry timestamp | 38.5 ms | 38.4 ms | 39.9 ms | 48.2 ms |
| Module load / imports | 14.2 ms | 0.0 ms | 0.0 ms | 0.0 ms |
| Session file read | 0.1 ms | 0.1 ms | 0.1 ms | 0.2 ms |
| Internal CLI wall time | 39.0 ms | 39.0 ms | 40.5 ms | 48.6 ms |
| Teardown & output delivery | 51.0 ms | 67.9 ms | 75.8 ms | 144.2 ms |
| **Total external wall time** | **90.0 ms** | **112.3 ms** | **116.4 ms** | **183.3 ms** |

*Note: Subsequent process launches reflect warm OS filesystem cache for separate Node processes, NOT a persistent in-memory warm JavaScript client.*

### Architectural analysis

1. **Persistent IPC client daemon analysis**:
   - Spawning a new Node CLI process incurs ~100–150 ms of external process wall time (including OS process creation and V8 teardown).
   - If a persistent client daemon were maintained instead of spawning per command, its **maximum plausible benefit is bounded at ~100–150 ms per invocation** (~1.0–1.5 seconds across a 10-call task).
   - A persistent client does NOT eliminate Antigravity host terminal scheduling (~200–500 ms) or model deliberation gaps (~8,000–15,000 ms per round trip).
   - The decision not to deploy a persistent client is not based on an arbitrary 500 ms threshold, but on the fact that round-trip elimination delivers an order of magnitude greater impact than process-spawn optimization.
2. **Round-trip elimination (Projected Hypothesis)**:
   - Median inter-call decision gaps are ~9,500 ms (model reasoning + host dispatch + image viewing).
   - The hypothesis that reducing controller calls from 15 to ~9–10 via multi-step batches (`computer_run`) could save ~50–60 seconds remains a **projection until validated in matched real-host end-to-end runs**.
3. **Query observations tree-only qualification**:
   - The existing named-argument parser (`scripts/arguments.mjs`) already set `with_image: false` for named `--query` CLI calls before the runtime change.
   - The runtime change in `server/runtime.mjs` (`wantImage = with_image === true || (with_image !== false && !hasQuery)`) optimizes direct JSON/IPC callers that omit `with_image`.
   - The four distinct paths:
     1. Named CLI query without `--image`: Tree-only (parsed via `arguments.mjs`).
     2. JSON/IPC query without `with_image`: Tree-only (defaulted in `runtime.mjs`).
     3. Explicit `--image` / `with_image: true`: Screenshot captured and returned.
     4. Non-query default observation: Screenshot captured and returned.
   - Regressions in `tests/observation-optimization.test.mjs` verify that tree-only frames strictly refuse pixel `click`, `move`, and `drag` with code `no_image` before input, and that fresh observation with `--image` recovers full pixel capability.
4. **Lifecycle verification and fast reconnect (`start --quick`)**:
   - `start --quick` returns a compact status response (`{ok: true, state, build_id, build_version}`) bypassing verbose window/lease serialization (~1–3 ms saving on status response).
   - The private storage security boundary (`storageOperation('data', dataDir())`) is strictly preserved before reading `desktop-session.json`, upholding private capability-file requirements.
   - Rigorous schema validation (`validateSchema`) checks types and forbids unknown properties for named flags, inline JSON, and request files (rejecting string/object values for `quick`).

## Durable status log

| Item | Status | Evidence |
| --- | --- | --- |
| Timing instrumentation harness | **DONE** | `scripts/time-call.mjs`, 14 tests in `tests/time-call.test.mjs` pass |
| Empirical baseline measurement | **DONE** | `.localdata/benchmarks/baseline-results.json` logs external wall and internal milestones |
| Observation query tree-only default | **DONE** | `server/runtime.mjs`, 13 tests in `tests/observation-optimization.test.mjs` pass |
| Tree-only pixel input refusal regressions | **DONE** | Verified in `tests/observation-optimization.test.mjs` (`no_image` refusal on click/move/drag) |
| Fast start / reconnect (`--quick`) | **DONE** | `scripts/desktop.mjs`, verified in `tests/observation-optimization.test.mjs` |
| Lifecycle schema validation (types & unknown fields) | **DONE** | `server/desktop-tools.mjs`, tested for named flags and inline JSON |
| Multi-step workflow patterns | **DONE** | Documented in `skills/computer-use/SKILL.md` (import, settings, export+wait) |
| Run comparison harness & failure disqualification | **DONE** | `scripts/compare-runs.mjs`, 9 tests in `tests/compare-runs.test.mjs` pass |
| Live service non-interference | **DONE** | Running beta.2 service remains idle and available; no live files overwritten |
| Automated test suite | **DONE** | 190 tests total: 189 passed, 0 failed, 1 skip (C: drive) / 5 skips (D: drive replaceable ACLs) |
| Provenance verification | **DONE** | 111 files clean in `scripts/check-provenance.mjs` |
| Matched end-to-end human benchmark | **PENDING** | Projected ~50–60s saving remains a hypothesis; pending matched human run on real host |
| Live queued input physical interruption | **BLOCKED** | Hardware/human-only check; requires human at physical console |
| Multi-monitor mixed-DPI qualification | **BLOCKED** | Hardware-dependent; coordinate simulation does not substitute for physical displays |

Verify exported bytes and actual native-engine completion separately. An app
can fail while every controller call succeeds. Failed exports do not qualify
as faster successful workflows. A different tile size or GPU is a different
workload; distinguish orchestration improvement from faster inference.

The current speed work reduces round trips through observation-bound exact
selectors, sequential action/wait batches, text-only section queries and shorter
skill instructions. It preserves native permission/identity checks, fresh
observations and independent Stop. A timed-out wait stops the batch without
replaying its earlier input. Real-app qualification remains separate from unit
tests and native component fixtures.
