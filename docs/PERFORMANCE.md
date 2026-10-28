# Measuring desktop task latency

Use a real app task in Antigravity and preserve its exact build, model, input,
settings, prompt start time and final task receipt ID. Save all local test
artifacts under the checkout's ignored `.localdata/` directory. Keep hardware,
model and inference-setting changes visible in any comparison.

```text
node scripts/measure-run.mjs RECEIPTS PID TASK_START FINAL_RECEIPT OUTPUT
node scripts/compare-runs.mjs BEFORE_JSON AFTER_JSON [OUTPUT_MD_OR_JSON]
node scripts/time-call.mjs COMMAND [ARGS...]
```

For example, use `123.18` as the final receipt if that was the task's final
status response. Later diagnostic polls are excluded. The report separates
controller execution, inter-call gaps and verification errors. Gaps include
host/model reasoning, terminal startup, image inspection and file tools; they
are not a measurement of model reasoning alone.

`compare-runs.mjs` evaluates matched before/after runs, computing deltas for
wall time, call counts, controller service time, median decision gaps, and
per-command breakdown.

## Empirical timing measurements and orchestration findings (28 October 2026)

High-resolution timing harness (`scripts/time-call.mjs`, `scripts/benchmark-baseline.mjs`)
measured empirical per-call overhead across cold and warm invocations:

| Stage | Median cold | Median warm (10 runs) | Mean warm | Max warm |
| --- | ---: | ---: | ---: | ---: |
| Node startup (`node.exe` init) | 27.6 ms | 27.0 ms | 27.6 ms | 34.7 ms |
| Module load / imports | 14.4 ms | 13.6 ms | 14.1 ms | 17.9 ms |
| Session file read | 0.0 ms | 0.1 ms | 0.1 ms | 0.2 ms |
| **Total CLI invocation** | **44.5 ms** | **43.8 ms** | **44.2 ms** | **54.7 ms** |

### Key architectural conclusions

1. **Persistent IPC client daemon is unnecessary**: Node CLI invocation is under
   50 ms (> 10× below the 500 ms threshold where a daemon would provide measurable
   benefit). Per-call terminal spawn is not the source of the ~235s non-controller
   overhead.
2. **Round-trip elimination is the primary lever**: With median inter-call decision
   gaps at ~9,500 ms (model reasoning + host dispatch + image viewing), reducing
   controller calls from 15 to ~9–10 via multi-step batches (`computer_run`)
   saves ~50–60 seconds of wall time.
3. **Query observations default to tree-only**: `server/runtime.mjs` now skips
   screenshot capture and disk writing for query-filtered observations (`wantImage =
   with_image === true || (with_image !== false && !hasQuery)`), saving ~1.0–1.5s
   per query while retaining `--image` for visual checkpoints.
4. **Fast reconnect**: `start --quick` skips redundant storage guard checks on warm
   running services.

## Durable status log

| Item | Status | Evidence |
| --- | --- | --- |
| Timing instrumentation harness | **DONE** | `scripts/time-call.mjs`, 12 tests in `tests/time-call.test.mjs` pass |
| Empirical baseline measurement | **DONE** | `.localdata/benchmarks/baseline-results.json` logs 10-iteration stats |
| Observation query tree-only default | **DONE** | `server/runtime.mjs`, 9 tests in `tests/observation-optimization.test.mjs` pass |
| Fast start / reconnect (`--quick`) | **DONE** | `scripts/desktop.mjs`, verified in `tests/observation-optimization.test.mjs` |
| Multi-step workflow patterns | **DONE** | Documented in `skills/computer-use/SKILL.md` (import, settings, export+wait) |
| Run comparison harness | **DONE** | `scripts/compare-runs.mjs`, 3 tests in `tests/compare-runs.test.mjs` pass |
| Live service non-interference | **DONE** | Running beta.2 service (`D:\AntigravityComputerUse-ed035f9812`) remains idle and available |
| Automated test suite | **DONE** | 178 passing tests, 0 failures, 1 explicit ACL skip |
| Provenance verification | **DONE** | 104 files clean in `scripts/check-provenance.mjs` |
| End-to-end human benchmark | **PARTIAL** | Exact Upscaly benchmark prompt prepared; direct agent UI driving blocked by controller policy |
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


---

The records below are retained historical snapshots. Their pending status, test counts and next-candidate descriptions refer to those earlier builds, not the current checkout.

# Historical qualification record

The final Agent Manager run of the first beta candidate was cancelled after roughly 8minutes at import, with about 9 desktop actions. It is a latency failure, not acceptance. The release remains draft.

The trace included about 17 separate schema descriptions, model-created request/result files per action, old artifact reads, screenshot copies and 6–35second gaps between operations. Native input time alone does not explain the wall time. Model deliberation, terminal tool scheduling and image viewing are also part of the experience.

## Candidate changes

- Short installer-managed launcher and strict named flags eliminate routine per-action request files.
- One-call multi-schema discovery and skill quick reference remove catalogue setup loops.
- Brief replies omit duplicate metadata. Semantic action replies default to tree-only; pixel decisions still require an actual viewed screenshot.
- Bounded local receipts automatically record service time, gaps, delivery and verification outcomes. They omit text, clipboard data, UI trees, permission reasons and capabilities. Storage failures never hide delivered input.
- Optional launch-and-observe uses only an unambiguous exact launched PID/executable; ambiguity and capture failure preserve launch evidence without inviting relaunch.
- Small batches validate the complete plan first, observe freshly between steps, capture at the final checkpoint and stop on action or verification failure.

## Required comparison

Run a fresh No Project conversation in the real Agent Manager, preserving the selected model and permission preset. Compare the same real Upscaly launch/import prefix, then finish AI PNG export, view the actual output, and complete a second-session Unicode paste/save task. Record total time, model/terminal/image calls, avoidable artifact files, service time and gaps. Keep failed runs intact. Unit/mock timing is not proof of host speed.

Status:88 source tests pass. Installed speed1 build8d9d8082 launched actual Upscaly with its first image in3.7seconds; a two-step real-file import batch took6.8seconds and left no picker. A second real Notepad session refused paused input and the old frame after Resume, then saved an exact1319-unit Unicode sample with clipboard restoration. These are direct controller timings, not Agent Manager wall-time improvement. The stock host-control API could not restore minimized Antigravity; the actual host comparison remains pending human restoration. Hardware-dependent mixed-DPI checks and physical emergency re-arm remain separately scoped.

The short entrypoint uses bundled Node and an exact-release JavaScript import, with no command-shell forwarding. Literal quotes, percent signs, metacharacters, Urdu and emoji are covered by an executable argv regression. Project-local launchers are isolated from the global launcher. Installing over a live service is refused before writes; end and shutdown the task first.

Further direct witness: private2 returned Notepad's exited-starter handoff in1517ms, with the actual window discovered223ms later and no duplicate launch. Earlier runs waited roughly8.5seconds for a window belonging to the already exited starter. This removes that bounded wait without guessing the handed-off process. Explicit filename paste then saved exact Unicode content in a2932ms command. Actual Agent Manager call/gap/wall-time comparison remains required.

## Actual Windows host finding (24 October)

Agent Manager terminal processes were attached to an `exebox` desktop while the visible input desktop was `Default`, even with Turbo selected. Detached children also died between ordinary terminal calls. A foreground service in a host background task survived independent calls but its launched app was hidden and UI Automation failed. These failed attempts are retained; process lifetime alone was not the fix.

A native read-only desktop preflight now refuses mismatched/unavailable input desktops before app operations. Starting the pinned local companion on the normal desktop allowed the real global `/computer-use` skill in a fresh No Project conversation to import Upscaly media, perform native RealESRGAN AI PNG export, restore settings and finish normally. Independent file/database/engine checks confirmed PNG1920x1320 and actual NCNN inference23468ms. This task took roughly five minutes; its successful completion is not a claim that remaining latency is solved. Most native actions were400-900ms, with6-35second gaps between decisions and one30second wait. Model deliberation, image viewing and host task delivery still dominate.

The next candidate adds opt-in App Sidecars for host-managed local process lifecycle, and a passive listener that releases idle control while remaining available for the next session. Sidecars are documented at https://www.antigravity.google/docs/sidecars/ . Registration, rollback and idle Pause/Stop preservation have component tests; actual App-managed startup must be verified separately. No desktop switching, WMI recovery or host security changes are used.

Named no-file batches were exercised in the actual host on the installed AEA05 build: one real JPEG export task finished in235796ms with17controllercalls,18356service-ms and median native call436ms. JPEG differs from the prior PNG benchmark; these are bounded individual witnesses, not a statistical format-independent speed guarantee. Remaining median gap9479ms includes model/host/tool work. The actual executed --step command was inspected, rather than inferred from a requested example.

A real settings-discovery defect was reproduced: query `format` returned only FORMAT/Export format labels while a separate JPEG query found the button. The candidate now reuses the foundation subtree traversal to include a matching section’s child controls, preserving observation indexes and offscreen state. This should remove extra catalogue/full-tree reads; packaged real-app qualification is separate from the source test. No Upscaly source or preferences were changed for this fix.
