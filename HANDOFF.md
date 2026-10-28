# Antigravity Computer Use: handoff

Updated **28 October 2026**, Asia/Karachi. Release track: **v0.3.0-beta.2**, Windows x64 prerelease.

## 28 October repository presentation and branch cleanup

Compared the public LiquidGlass and ComposeDoc repositories, then rewrote this
README around the product, real labelled demo, install path and capabilities.
Added original SVG branding, live CI/release/license badges, repository topics,
a searchable About description and a download homepage. Corrected the installation
guide's obsolete draft/pending wording. The current speed and beta.2 qualification
limits remain explicit; presentation changes are not new runtime acceptance.

Retired six historical work branches after ancestry/open-PR checks. Five were
ancestors of `main`; the README-only unique draft is preserved under
`archive/readme-draft-20261028`. [Branch policy and exact commits](docs/BRANCHES.md).
The published Windows bundle and installed runtime were not changed by this cleanup.

## 27 October automatic-startup repair

The installed Sidecar had remained disabled after the startup-bar fix, so
Antigravity asked the owner to run the manual launcher. At the owner's request,
only this project's Sidecar entry was enabled; unrelated configuration was
verified unchanged. Antigravity's `language_server.exe` then started the pinned
beta.2 service automatically, without a manual launch or whole-App restart.

Recorded qualification on 27 October: the exact installed build was
`23ddd7bdfc2f2c19060308c441ef7fef43d700ccfdccaa88b76bb488105d2777` in
both global and Upscaly scopes, with all 75 sealed payload files checked in each.
The automatic passive startup created no guardian window/process. Read-only
native app discovery passed the visible-desktop preflight, returned three
windows, and End left no app grants. Emergency Stop remained latched; no physical
input or re-arm was sent. The passive listener was left available. The enabled
Sidecar setting was checked again on 28 October; the running service was not
retested in that documentation-only check.

This was a local configuration repair using the existing published beta.2 code,
not a new runtime build or full AI-workflow qualification. Private evidence is
retained under `.localdata/autostart-repair-20261027/`; do not publish the raw
host configuration. Silent background availability and human-only emergency
re-arm are separate: a saved Stop still needs the human even though the service
starts automatically. Remaining speed and hardware qualifications stay open.

## 26 October startup control-bar fix

The owner reported the stopped bar appearing on ordinary Antigravity startup,
despite not invoking computer use. Reproduced cause: passive service preparation
started the guardian whenever an old emergency latch existed; the native form
also showed itself at startup and never dismissed its stopped state.

The fix keeps passive startup, status, End and shutdown free of guardian startup.
The native guardian starts hidden, shows controls during an active/paused task,
and hides them at End. Stopped controls dismiss after eight seconds; the stopped
button and menu can dismiss them sooner. `controls` explicitly reveals controls
for human re-arm for30seconds, without changing state, grants or the latch.
Blocked grant/snapshot/launch requests reveal controls but refuse input until
the human re-arms. Late screenshot completion cannot resurrect a hidden bar.

`tests/guardian-visibility.mjs` exercises actual native visibility in both idle
and persisted-Stop startup, explicit reveal, active/End, capture cleanup,
dismissal, refused activation while stopped and automatic Stop dismissal.
It sends no target-app clicks/keys and does not qualify physical Stop. The new
helper changes the native binary: the older real Upscaly/physical evidence below
remains evidence for that older helper, not an automatic pass for this revision.
Source tests: **139 passed, 0 failed, 5 explicit ACL skips**.

The continuation prompt is [docs/CLAUDE-CODE-HANDOFF-PROMPT.md](docs/CLAUDE-CODE-HANDOFF-PROMPT.md).
Remaining speed/hardware/physical queued-input work below is still open.

## Read this first

The native desktop workflow works in the actual Antigravity Agent Manager App.
Real Upscaly AI PNG and JPEG exports passed, including independent file, database
and native-engine verification. **Overall latency is not fully solved**: the
tested Gemini 3.8 Flash High workflow still takes about four and a half minutes.
Do not describe this as finished vendor parity or complete hardware qualification.

This handoff records both completed work and remaining debt. Publishing the beta
does not turn skipped or incomplete checks into passes. The release page and its
manifest/checksums are authoritative for the published asset identity:

- [Controller repository](https://github.com/shayann07/antigravity-computer-use)
- [Windows beta and downloads](https://github.com/shayann07/antigravity-computer-use/releases/tag/v0.3.0-beta.2)
- [Installation](README.md#install-on-windows), [security](SECURITY.md),
  [validation history](VALIDATION.md), [performance](docs/PERFORMANCE.md)

## Current status

| Area | Status and limits |
| --- | --- |
| Invocation | Global `/computer-use` skill in Antigravity App; project-local installation is supported. App 2.26 was exercised. Do not substitute IDE-only assumptions. |
| Runtime | One Node/C# Windows implementation. The direct skill uses private local IPC and the App's Sidecar lifecycle. No MCP, extra model, model subscription or browser extension is required. The optional legacy MCP adapter is retained for compatibility. |
| Desktop operations | Screenshots, accessibility inspection/actions, real cursor input, typing/paste, scrolling, dragging, shortcuts, native file dialogs, app/window management and bounded sequential batches are implemented. |
| Observation safety | One-use frames bind native snapshots to app identity and worker epoch. Exact name/role/automation-ID selectors resolve inside the observed snapshot; missing or ambiguous targets refuse. Pixels require an actual screenshot and centrally mapped coordinates. |
| Control | Manual/Keep working is the default; incidental human movement does not pause. Optional Smart takeover yields on input. Esc, Ctrl+Alt+F12 and Stop use an independent guardian. Emergency re-arm is local human-only. |
| Permissions | Standalone mode uses native approval dialogs. Operator-selected host-managed mode relies on host execution permissions. It does not inspect or authenticate the Turbo preset. Model approval flags cannot grant permission. |
| Interface | Minimal control bar, breathing edge glow, custom arrow/text cursor, eased pointer travel and input restoration exist. Final visual feedback is still open; semantic actions can execute without pointer travel. |
| Installation | Portable Node and prebuilt helpers, per-user protected installation, immutable release pins, global/project scopes, preserved configuration and rollback backups are implemented. Normal bundle installation needs no compiler or Python. |
| Tests | Beta2 source checks: **139 passed, 0 failed, 5 skipped**. The five installation-ACL cases are refused under replaceable checkout ancestors. Those skips are not ACL qualification passes. Provenance and native compilation checks passed. |
| Stop handoff | Owner reported physical Esc/Stopped/re-arm complete. Installed status subsequently showed `idle`, `control_reason: human_resume`, empty grants and cursor overlay off. The instrumented queued-wait attempts timed out before physical input; live queued/held-input interruption on the final helper remains separately unqualified. |
| Scheduling | The owner deleted the overnight automation and cleared the goal. Both were confirmed. **Do not recreate or resume recurring work without a new request.** The passive installed Sidecar is a product component, not the deleted automation. |

## What changed in this work

1. Reused the MIT Windows implementation from
   `ridelink0/claude-computer-use` at its pinned revision. Kept the persistent native
   host, UI Automation, capture/input, guardian and relevant test infrastructure.
   OpenAI/Anthropic public MIT references and modification records are retained in
   [UPSTREAM.json](UPSTREAM.json), [notices](THIRD_PARTY_NOTICES.md) and `licenses/`.
   No private vendor implementation or helper protocol was copied.
2. Replaced routine MCP integration with a supported global skill and managed App
   Sidecar. This also fixed the discovered App terminal `exebox` desktop/lifetime
   problem. Starting a controller from an isolated terminal cannot control the
   visible desktop; do not bypass that boundary with WMI or desktop switching.
3. Added fixed deployment policy, exact build binding, native permission/identity
   checks, independent cancellation, input cleanup and OS-owned service ownership.
   Provider errors preserve unknown delivery without replaying a click or Enter.
4. Added short pinned launchers, named flags, exact observed selectors, section
   queries with their child controls, tree-only query defaults and batches that
   stop on failure. A batch can include observed-text waits with a combined
   maximum wait budget of 30 seconds. Common command forms are in the skill.
5. Added explicit clipboard-preserving filename entry/readback and Unicode
   handling. Preserved the failed keyboard-entry and provider-replay evidence.
6. Kept all test/probe/recording/evidence folders under this checkout's ignored
   `.localdata/`. `tests/paths.mjs` resolves paths from the module, independently of
   the caller's working directory. Do not restore drive-root or OS-temp fixtures.
7. Diagnosed a related Upscaly integrated-GPU configuration defect and accessibility
   labels. Those changes belong to the separate private app repository below.

## Real-app evidence and performance

The latest successful tasks used fresh No Project conversations, Gemini 3.8 Flash
High and the existing Turbo preset. The sample was a 480×330 image; both outputs
were RealESRGAN Ultra, 100% enhancement, 4×, with no software fallback.

| Measurement | PNG | JPEG |
| --- | ---: | ---: |
| Whole task, including setup and cleanup | 269,280 ms (4m29s) | 272,954 ms (4m33s) |
| Controller calls | 15 | 15 |
| Time inside controller requests | 11,893 ms | 15,937 ms |
| Native inference, measured by app | 16,272 ms | 18,915 ms |
| Published output | 1920×1320, 3,424,092 bytes | 1920×1320, 174,151 bytes |

PNG SHA256: `7945386ae3df58d29b96fd303d922716a12bc5894cac494278311c7c9ec46b6c`.
JPEG SHA256: `5fb3342865f9e85e75572e21d8d791d321f1787211a737dce0038a2ba29fd13b`.
File signatures, decoded pixels, SQLite publication and actual NCNN completion
were checked independently. Settings were restored and owned app instances closed.
A second task completed without restarting Antigravity.

The previous successful High PNG witness took 326,493 ms with 25 controller calls:
the latest witness was about **17.5% faster with 40% fewer calls**. An earlier JPEG
witness took 235,796 ms, which is faster than the latest JPEG result. These are
individual witnesses with application/profile changes, not a controlled statistical
speed claim. Model/host decision gaps, terminal scheduling and image/file tools
remain dominant. The App's picker exposed only the selected Flash High variant;
the proposed lower-effort comparison was not run and the model was not changed.

The exact AI-tested controller build was
`de4708498a561ebaddd55ec60ea606df14d11bd43a907084ebf84a66783542cd`.
A later documentation-only bundle, `19b3e952562cc7b430c06002b554ca5ced6301aa7013568b12c2a5771bea2026`,
had 34 runtime/script/skill/helper/Node files identical to that build and was
installed and inspected. Final release packaging adds this handoff; compare its
manifest and the publication audit rather than assuming the old full build ID.
The qualified native helper SHA256 is
`5e2cbf2060ee228006234dd90fb0832adaed6dc8f63c9bd80e1c08863088aa1a`.

Private receipts, recordings and transcripts are intentionally not published.
On the owner's checkout, evidence is under `.localdata/speed-resume-20261024/`:
`host-final/`, `custom-real/`, `physical-stop/`, build/test logs and the incremental
Upscaly patch. Publication audits and checksums are under `.localdata/handoff-publish/`.
Earlier failed runs remain evidence of failure, not replacement acceptance passes.

## Related Upscaly handoff — separate private repository

The existing feature working tree and required dependencies were preserved on:

- Branch: `handoff/computer-use-2026-10-24`
- Snapshot: `53cb838743d600e7ed76f3da61ae1ef1f5b0246d`
- [Private app handoff](https://github.com/shayann07/Upscaly/blob/handoff/computer-use-2026-10-24/docs/COMPUTER-USE-HANDOFF.md)

This is a WIP source snapshot, not an Upscaly binary release. Its main branch,
active checkout and original index were not changed. Local `.agents/` settings,
`skills-lock.json`, models, recordings, runtime data and binaries were excluded.
The private branch retains an incremental compatibility patch and explains the
inherited feature work. It is not part of this project's MIT source distribution.

The Intel device reported a 16,198 MB shared heap. Treating that as dedicated VRAM
selected two GPU workers and unsafe AUTO/256px work. A conservative integrated-GPU
profile now uses a 512 MB budget, at most 64px tiles and one GPU worker, keeping the
chosen native GPU/model. Device loss (`VkResult -4`) is reported distinctly from
proven allocation failure. Output directory, Tile size and Upscale received stable
accessible names/groups. The qualified app EXE SHA256 is
`20ce0c45a7c91659992fbdb6392b0420655c45ba1f4e99b520ce27c197232a24`.
Focused app checks passed: 2 GPU-profile tests, 1 existing NCNN-options regression,
6 SettingsPanel tests and the TypeScript/Vite/Tauri debug build. This does not
qualify every feature on the snapshot branch.

## Prioritized TODOs and acceptance criteria

### P0 — remaining latency

- Separate launch/readiness, inference, model/terminal/image calls and cleanup in
  the next trace. Inspect actual tool calls, not private model reasoning.
- Avoid the first loading-only screenshot round trip, repeated schema discovery,
  unnecessary field queries and individual restore/close commands. Preserve the
  current one-use-frame, identity, native approval and Stop checks.
- A small JavaScript IPC client that maintains frame state and chains predictable
  verified steps is a possible next approach. **It was discussed but not implemented
  or installed.** There is no hidden SDK or second agent framework in this release.
- Benchmark before changing the default skill workflow. Use the same app binary,
  input, model/effort, preset, device, tile, format and fresh session across repeated
  trials. Record a task start and explicit final receipt ID with
  `scripts/measure-run.mjs`; exclude later diagnostic polls. Verify real outputs.
- Agree an explicit latency target before declaring this work complete. Do not
  claim general improvement from fewer calls or a faster isolated primitive.

### P1 — finish safety, hardware and distribution qualification

- In an owner-ready physical session, interrupt an actual queued operation and
  held input on the final helper; record cancellation, independent release and
  refusal of old observations. Native re-arm must remain human-only. Previous
  timeout/skipped-action results are not proof of physical cancellation.
- Qualify mixed DPI, multiple physical displays, negative monitor origins,
  display gaps and hot-plug changes. Simulation and single-display math tests do
  not establish hardware coverage.
- Run the five skipped installation-ACL tests in a trusted, owner-approved
  checkout. Keep its test artifacts inside that checkout. Do not change parent
  ACLs or silently move individual tests outside the project to force a pass.
- Recheck install/update/rollback after unrelated configuration changes and App
  restarts, preserving Stop across updates. End/shutdown before replacing files.
- Review signing/SmartScreen/distribution expectations. Do not claim signed or
  universally trusted experimental helper binaries.

### P2 — usability and broader application testing

- Get final feedback on glow intensity, animation, cursor roles and minimal bar
  behavior. Keep controls legible, click-through edges and reliable teardown.
- Evaluate visible feedback for semantic actions that execute without cursor
  travel. Do not replace safe accessibility actions with blind pixel replay.
- Complete the original-versus-feature Upscaly matrix: F01 ROI/two-model comparison;
  F02 sizing/print; F03 enhancement blending; F04 DNI; F05 video ranges/samples;
  F06 clipboard; F07 recipes/mixed selection; F08 folders/sessions; F09 pause/resume;
  F10 protection; F11 face restoration; F12 export/metadata/naming. Current bounded
  PNG/JPEG witnesses do not qualify all those features.
- Revisit effective shared-memory GPU budgets and displayed profile consistency
  in the app. The current integrated-device cap is conservative, not universal
  performance tuning. Do not make OS driver/security changes as automatic recovery.
- macOS/Linux ports remain future work. Do not advertise the Windows beta as
  equivalent cross-platform qualification.

## Safe continuation checklist

1. Read this file, `AGENTS.md`, `PROJECT-STATUS.md`, `VALIDATION.md` and the latest
   local checkpoint. Verify current Git, CI, installed manifest and native status.
2. Keep one physical desktop task active. Coordinate with other sessions; virtual
   desktops are not isolated mouse/keyboard workspaces.
3. Preserve host settings and the installed permission mode. Host-managed mode
   is an explicit operator choice, not proof that Turbo is active.
4. View actual returned screenshots before pixel actions or visual claims. On
   unknown/completed delivery, observe effects before continuing; never replay.
5. Ask the owner to be ready before an interactive physical check. Activate its
   bar immediately before the handoff; account for ordinary idle auto-release.
   Do not leave stale prompts or report a timed-out check as passed.
6. Restore test-modified settings, close only owned disposable windows, call `end`
   and verify idle/empty grants/cursor restoration. Keep passive Sidecar lifecycle
   separate from removed recurring work.

For a source review start with `server/runtime.mjs`, `desktop-tools.mjs`,
`desktop-service.mjs`, `service-lease.mjs`, `scripts/desktop.mjs`, `arguments.mjs`,
`install.mjs`, `rollback.mjs` and native `Guardian.cs`, `AxonHost.cs`, `CursorSafety.cs`
and `DesktopVisuals.cs`. See [review guidance](docs/review-guide.md).
