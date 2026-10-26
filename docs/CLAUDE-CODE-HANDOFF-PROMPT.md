# Claude Code continuation prompt

Take over the remaining speed and reliability work on Antigravity Computer Use.
Do the engineering and real qualification; do not stop at a review or plan, and
do not make premature completion claims.

Repository: https://github.com/shayann07/antigravity-computer-use
Current handoff: https://github.com/shayann07/antigravity-computer-use/blob/main/HANDOFF.md
Release: https://github.com/shayann07/antigravity-computer-use/releases/tag/v0.3.0-beta.2
Local checkout: D:\Work\AntigravityComputerUse

Read AGENTS.md and HANDOFF.md completely, then PROJECT-STATUS.md, VALIDATION.md,
docs/PERFORMANCE.md, the installed skill and relevant implementation/tests.
Verify current Git, installed pins, release identity and CI; recorded evidence
is historical until independently checked. Keep an auditable progress log with
done, partial, blocked and unrun items. Do not recreate the deleted overnight
automation or cleared goal.

The 26 October startup-bar bug has been fixed here: opening Antigravity or
reading status stays silent; passive preparation does not start the guardian.
The guardian itself starts hidden. End hides its bar even with Stop latched;
stopped controls dismiss after eight seconds and can be dismissed manually.
The explicit `controls` command reveals human re-arm controls for30seconds but
cannot clear Stop or grant permission. Blocked app-control requests reveal the
controls and refuse input. Capture completion must not resurrect hidden UI.
Preserve and review this fix, including tests/guardian-visibility.mjs. A changed
native helper requires fresh qualification; do not inherit old hardware or
physical Stop passes automatically.

Priorities:

1. Audit the code against the handoff and reproduce actual slow/failing tasks.
   Trace model/host/tool round trips, schema reads, images and native requests.
   The recorded real High-effort PNG/JPEG tasks took269280/272954ms,15 controller
   calls each, while controller request time was only11893/15937ms. Native AI
   inference was16272/18915ms. Most delay is outside native execution. The earlier
   PNG was326493ms/25calls; an earlier JPEG was235796ms. These individual witnesses
   are not a universal speedup or controlled A/B comparison.
2. Implement a materially faster orchestration path using Antigravity's own
   existing LLM, the supported skill and persistent native runtime. No required
   MCP, extra model, separate subscription or extension. Investigate compact
   result/image handling, startup observations, redundant discovery/schema reads
   and safe bounded batches. A small JavaScript IPC client was discussed but
   NEVER implemented. Decide from measurements whether it helps; do not pretend
   it already exists or batch across an uncertain decision boundary.
3. Reuse the existing attributed MIT foundation and utilities. Preserve source
   revisions, licenses, modification records and provenance. Do not replace the
   production implementation with another basic bridge or copy private vendor
   implementations. Publicly observable behavior can inform improvements.
4. Exercise the actual Antigravity Agent Manager App /computer-use workflow on
   real Upscaly, not just direct-controller fixtures. Compare original/feature
   builds where the handoff specifies. Complete real AI PNG/JPEG exports and
   independently verify decoded dimensions, file signatures, actual native NCNN
   execution and publication. No silent resize/CPU fallback. Preserve app settings,
   unrelated windows and existing dirty source. The private app handoff branch is
   linked in HANDOFF.md; keep its code and private evidence out of the public repo.
5. Keep observation-scoped references, app/process identity checks, unknown-input
   non-replay, input budgets, ownership lease, native approvals, independent Stop
   and held-input cleanup intact. Incidental human movement must not pause manual
   mode. Host-managed soft resume requires explicit user authorization and a fresh
   observation; emergency re-arm is human-only. Never manufacture physical input,
   approval or re-arm. Defer genuine human-only checks and continue independent
   work. Hardware mixed-DPI/multi-monitor and live queued/held-input interruption
   remain unqualified until actually exercised.
6. Keep the frontend minimal and polished. Show bar/glow/custom cursor only when
   appropriate, clean them up reliably, preserve smooth pointer motion and return
   the normal cursor after End/Pause/Stop/crashes. Never leave desktop control
   enabled while only reading or editing code. Preserve unrelated host settings
   and security presets. Do not treat host-managed mode as authenticated Turbo.

All tests, probes, recordings, backups and temporary evidence must remain under
this checkout's ignored .localdata directory. Follow tests/paths.mjs. Never widen
ancestor permissions, weaken guards or relocate refused ACL tests to force a pass.
Five ACL cases are explicit skips, not qualification passes. One desktop owner at
a time; do not interfere with another session or treat virtual desktops as isolation.

For final acceptance, use repeatable actual Antigravity tasks with matched app,
sample, model, settings and hardware. Measure task wall time separately from
controller and inference time; retain unsuccessful runs. Report before/after
numbers, errors, exact commits/builds and remaining limits. Run meaningful source,
native lifecycle and relevant real-app tests, provenance checks and GitHub CI.
Do not claim latency solved based only on fixtures, fewer calls or a single run.

When reviewed and qualified, update both global/project installation pins using
the supported installer, preserve configuration/Stop and rollback backups, and
verify the running exact build without re-arming a latched Stop. Update the public
handoff/README, push clean reviewed source and publish an honestly labelled beta
with prebuilt Windows helpers, manifest and checksums. Verify public downloads
and CI. If a gate cannot run, record it as blocked/unrun and retain the beta label.
Finish with changes, measured results, installed/published identity and outstanding
work. Continue authorized work independently; ask only for genuinely missing
decisions or human-only actions.
