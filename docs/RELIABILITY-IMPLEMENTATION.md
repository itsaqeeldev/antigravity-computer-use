# Reliability and updates implementation log

The active goal is the complete “Reliable computer use, automatic updates and
shared Mac support” plan. This log records implementation and evidence separately.
Development branch: `codex/macos-and-latency-review`. All private test output stays
in `.localdata/`. No release completion is claimed here.

| Requirement | Status | Evidence / next step |
| --- | --- | --- |
| Human launcher reveals controls, passive startup hidden | Implemented; qualification pending | Launcher uses `ready`; runtime requests native `show_controls` without re-arm. Need affected-PC reproduction and actual native lifecycle check. |
| Guardian concurrency, timeout, early exit and bounded recovery | Implemented; focused tests passed | New process-fixture tests cover shared readiness and exit-before-ready; broader request/crash tests still being added. |
| Simple model workflow | Implemented instructions; real trials pending | One entrypoint and structured next action. Actual Flash/Sonnet end-to-end measurements remain unrun. |
| Shared signed update staging | Implemented; release setup pending | Ed25519 verifier, architecture/OS/channel/sequence checks, streamed bounded downloads, complete inventory verification. No production signing key or signed release is configured. |
| Idle update, settings, Stop, rollback and pins | Partial | Transaction tests drive the real installer through upgrade and rollback, including failed new-service health, settings/Stop preservation and task deferral. Production uses a native updater ownership lease. Power-loss recovery and real installed updates still need qualification. |
| Automatic scheduling | Implemented; native qualification pending | Both passive and foreground Sidecar entrypoints schedule bounded workers; daily check policy, explicit manual/notify modes. No OS scheduled task. |
| Local failure diagnostics and consented GitHub reports | Implemented; mocked integration passed | Allowlisted local incidents, deduplication, daily consented submission, missing-auth handling and backoff tests passed. No actual public test issue was created. |
| Shared Windows/Mac implementation | Candidate exists | Mac PR #1 previously passed both architecture CI matrices. These changed sources need new CI; interactive Mac hardware checks remain unrun. |
| Real app and physical/hardware acceptance | Pending | Affected PC, fresh PC, Mac, physical Stop/re-arm, held-input cancellation, actual skill rediscovery and updater acceptance required. |
| Publication and bootstrap installer pin | Pending | Keep release draft until applicable gates pass. Existing published beta cannot acquire updater without one supported upgrade. |

## Release signing prerequisite

Updater metadata must be signed using a maintainer-held Ed25519 private key.
Commit only the matching `release-public-key.pem`; keep the private key outside
source, bundles, logs and CI artifacts. `scripts/sign-update.mjs` verifies the
matching public key and prepares per-platform signed metadata and payload assets
for a published release. It does not upload or publish anything.

Without a pinned public key or matching signed release asset, checks return an
explicit prerequisite status and never execute an unsigned update. Key custody,
rotation, release expiry, rollback floor and the qualified release build must be
reviewed before distribution. Kernel minimum versions are recorded per platform
(macOS uses Darwin kernel version). Ad-hoc Mac builds may need renewed human OS
permission approval; never bypass Gatekeeper.

Installer options: `--updates automatic|notify|manual`, `--update-channel
stable|beta`, `--report-incidents` or `--no-report-incidents`. Existing choices
are preserved unless explicitly changed. Reporting is off until the operator
consents. No maintainer GitHub credential is shipped.

Use `--pin-version` / `--unpin-version` to control automatic updates for a
deployment scope. Separately installed projects keep their own root/policy.
`update apply` and `update rollback` queue a worker using immutable release Node
and let the short launcher exit before replacing it on Windows. Inspect
`update status` for the worker result; queuing is not an installation success.

## Current source evidence

The initial complete local regression run passed 168 tests, failed zero and
explicitly skipped seven (five native installation ACL qualifications and two
Mac-only checks). The newer focused updater/recovery run passed 14 tests. Native
Windows compilation passed. These results do not qualify the affected PC, a
fresh production installation, real Flash/Sonnet tasks or Mac desktop input.

Known remaining implementation/release work: establish reviewed release-key
custody and pinned public key; signed published assets and bootstrap pin; hard
crash/power-loss recovery for multi-scope switching; native updater acceptance;
broader reporting/rate-limit tests and actual model trials. Do not replace the
published beta or advertise updater readiness based on current fixtures alone.

## Acceptance and delivery gates

1. Run focused regressions and source suite; retain actual failure output.
2. Run native compilation and provenance checks on Windows and both Mac runners.
3. Exercise signed staging, upgrade, health failure, rollback, task deferral,
   pins, preserved settings/Stop and a second session in isolated installations.
4. Qualify actual Antigravity tasks, affected PC and physical/hardware boundaries.
5. Prepare signed release assets, bootstrap upgrade and exact installed/published
   identity evidence. Update installer pins only for the qualified release.

Agent parity is not guaranteed by prose. Runtime checks enforce limits and log
failures; real model trials establish operational evidence. The overall goal
remains active until all required acceptance and delivery work is verified.
