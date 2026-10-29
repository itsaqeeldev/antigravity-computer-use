# Reliability and updates implementation log

The active goal is the complete “Reliable computer use, automatic updates and
shared Mac support” plan. This log records implementation and evidence separately.
Development branch: `codex/macos-and-latency-review`. All private test output stays
in `.localdata/`. No release completion is claimed here.

| Requirement | Status | Evidence / next step |
| --- | --- | --- |
| Human launcher reveals controls, passive startup hidden | Local native lifecycle passed; affected-PC trial pending | Launcher uses `ready`; runtime requests native `show_controls` without re-arm. Native Windows visibility test passed hidden idle/latched startup, explicit controls, End, Stop dismissal, restart and latch preservation. |
| Guardian concurrency, timeout, early exit and bounded recovery | Implemented; focused tests passed | New process-fixture tests cover shared readiness and exit-before-ready; broader request/crash tests still being added. |
| Simple model workflow | First real Flash trial partial; Sonnet pending | Flash completed Notepad save/cleanup but took about 10 minutes and failed exact Unicode comparison. Structured error follow-up remains to be installed and compared. |
| Shared signed update staging | Implemented; release transport pending | Ed25519 verification, architecture/OS/channel/sequence checks, bounded hashed downloads and inventory checks. Protected key and Actions secret configured; local signing verified. No release published. |
| Idle update, settings, Stop, rollback and pins | Implemented; native qualification pending | Transaction tests drive the real installer through upgrade/rollback, failed health, settings/Stop preservation, task deferral and persisted interrupted-switch recovery. Production uses native updater and controller leases. Real interrupted-process/power-loss and installed updates still need qualification. |
| Automatic scheduling | Implemented; native qualification pending | Both passive and foreground Sidecar entrypoints schedule bounded workers; daily check policy, explicit manual/notify modes. No OS scheduled task. |
| Local failure diagnostics and consented GitHub reports | Implemented; mocked integration passed | Allowlisted local incidents, deduplication, daily consented submission, missing-auth handling and backoff tests passed. No actual public test issue was created. |
| Shared Windows/Mac implementation | Candidate exists | At `c79c6d6`, the PR matrix passed both Mac architectures; Windows checks passed. Native signed update/rollback previously passed both Mac runners. Interactive Mac acceptance remains unrun. |
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

The later full regression run passed **174 tests, zero failures, seven skips**.
`tests/guardian-visibility.mjs` passed on the actual Windows helper, with no target
app clicks or typing. It verified idle/stopped hidden startup, explicit controls,
End cleanup, capture non-resurrection, Stop auto-dismissal and latch preservation
across restart. Physical Esc/re-arm and affected-PC reproduction were not tested.
No helper process remained after cleanup. Private result:
`.localdata/tests/guardian-visibility/run-RztTZO/result.json`.

At `e1e861e`, Windows CI passed 176 tests with zero failures and seven skips,
native compilation, provenance and development-bundle packaging. Its native
updater integration explicitly **skipped** because of
`insecure_storage_ancestor`; parent ACLs were retained. This is not a Windows
native updater qualification pass. The Mac workflow now runs the signed update
and rollback with real native storage/services and isolated test signing data;
inspect the latest job logs for actual results. Desktop input remains unrun.

Known remaining implementation/release work: establish reviewed release-key
custody and pinned public key; signed published assets and bootstrap pin; real
hard-crash/power-loss qualification for multi-scope switching; native updater
acceptance; broader reporting/concurrency tests and actual model trials. Do not replace the
published beta or advertise updater readiness based on current fixtures alone.

Interrupted updates retain `update-switching.json` and rollback journal paths.
The service blocks new control while this marker exists. A scheduled worker
replays the retained rollback journals and checks passive startup before clearing
it. Manual mode still permits interrupted-transaction recovery; it disables new
update checks/installations. Download/check locks do not block an active task.
Every install journal is persisted before the first deployment switch.

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

## Maintainer key tools

`scripts/setup-release-signing.ps1` creates a public Ed25519 trust root and
stores the private key only as a current-user DPAPI envelope under ignored
`.localdata/release-signing/`. `-ConfigureGitHub` explicitly adds the private key
to the repository Actions secret `AGCU_RELEASE_SIGNING_KEY`. It refuses to
overwrite an existing key. Rotation needs a separate compatibility change.
Do not upload the protected key as an artifact; arrange maintainer custody and
backup before publishing the trust root. The envelope is tied to that user.

`scripts/sign-update-windows.ps1` decrypts into process memory and pipes the key
to `sign-update.mjs`; no plaintext private-key file is needed. Generic signing
also accepts `-` for standard input. These tools are not invoked by desktop tasks
or normal installations.

The release trust root has now been generated. Its public-key file SHA-256 is
`83db2823088968a42ad19ca2e65a7f89187455e86d139d757a4a6b10ceee9443`.
The private key is stored as a user-bound DPAPI envelope and the repository
Actions secret `AGCU_RELEASE_SIGNING_KEY`. No plaintext private key was written
or included in source. Signed release preparation and production transport still
need qualification; this setup did not publish or update any installation.
The source candidate is `0.3.0-beta.3`; the public bootstrap remains beta.2.

## Installed beta.3 and first real model trial

Global beta.3 candidate build
`83487f3a409d36dd615e2da2542a60ae0858cc0ddacb40ee2aa13adad514873d`
was installed through the supported installer and verified against all 102
sealed files and the global skill. Running status confirmed that build, idle,
host-managed policy, manual takeover and no cursor ownership before the trial.
The previous installation and configuration backups are retained. Project-local
deployment pins were not repointed. This is a development installation, not the
published release.

The owner opened a dedicated No Project Antigravity chat for a Gemini 3.8 Flash
High Notepad Unicode/save task. The live trial reached `ready`, discovery,
launch and screenshot. It spent about 108 seconds between a screenshot and a
click, exceeding the 90-second frame limit; the controller refused stale input.
The agent subsequently re-observed, handled a minimized-window refusal, focused
the target, clicked and pasted. At this checkpoint the run is still active and
the output has not been independently qualified. Unnecessary directory/timing
file reads and large model decision gaps are retained as failures of efficiency.

Source follow-up now supplies deterministic `next_action` fields for expired
frames, minimized targets and unknown/completed delivery, with explicit
`replay_allowed:false`. Service integration tests cover stale-action refusal and
post-input verification failure without replay. This follow-up is not patched
into the active run; matched candidate trials remain required.

The Flash trial finished at 09:50:00 UTC with control idle. It made 21 controller
calls consuming about 20,999 ms, over 605,626 ms from submission to End. It saved
64 UTF-8 bytes and closed the created window. Independent comparison failed:
U+200D was missing between the emoji modifier and laptop. The original user
message's accessible text retained that joiner; exact model argument vs runtime
loss has not yet been isolated. The model's successful summary is not an exact
Unicode pass. Errors logged automatically: stale observation, minimized window
and obscured target. The agent recovered from these without automatic replay.

Private evidence is under
`.localdata/real-model-qualification-20261029/flash-run-summary.json` and its
receipts/output verification files. Output SHA-256:
`acf33b9ae945e678b208714a28114ea0cfea62e073dd38903bb59a8b896c4e3a`.
The dedicated chat is “Creating Notepad Qualification File”. A Sonnet comparison
was deferred after the desktop tool detected human input. No unrelated message
was edited or sent. The goal remains active; speed/reliability are not solved.

Local beta.3 release preparation passed signature verification and independent
verification of 102 payload files, using the configured protected signing key.
The signed metadata identifies build
`3ee48577631beee75b8e60619900f59d18f423d6f2ebc0094ef7cc5968b1dd2a`.
It was retained only under `.localdata`, not published or installed. Subsequent
source changes require fresh packaging; this is a signing-path witness only.

The manual `prepare-signed-release.yml` workflow prepares Windows x64, Mac ARM
and Mac Intel signed assets with the repository secret. It has read-only GitHub
permissions and does not publish, tag, merge or alter installer pins. The
workflow must exist on the default branch before GitHub permits dispatch; its
first actual run and production release-transport qualification remain pending.

## Guardian desktop preflight follow-up

Source review found that the guardian's `Visible` property did not establish
that its desktop was the user's current input desktop. The Windows guardian now
performs the existing read-only `DesktopContext` check before creating its UI
and again before showing controls. Hidden/isolated contexts return
`desktop_context_unavailable`; no desktop is created or switched. Active native
fences also refuse dispatch after an input-desktop change, and the guardian
latches Stop on that transition.

Local source regression passed 182 tests with zero failures and seven skips;
Windows native compilation passed. The new CI negative qualification launches no
guardian when the current desktop is interactive, and otherwise asserts native
refusal before creating controls. Positive interactive qualification of the new
helper remains pending: the owner pressed physical Esc during the previous
desktop trial, so further desktop work was not resumed by a goal continuation.

## Updater concurrency and staging follow-up

The updater now acquires installation ownership before reading deployment state
or claiming its daily schedule. Scheduled check/recovery/apply share that lease;
overlapping workers cannot overwrite timing or transaction state. Failed payload
transfers remove only their newly created stage, and a retry creates fresh private
storage. Metadata is read with a streaming size bound. Regression tests cover
concurrent scheduled workers, interrupted-transfer cleanup/retry, numeric version
ordering, insufficient space and malformed/oversized metadata.

Project pin tests verify the actual pinned launcher and installed skill remain
byte-identical while the global deployment upgrades. When all scopes are pinned,
the worker does not reserve, shut down or update the controller. Maintenance
reservation happens only after update validation. The affected-PC, Sonnet and
physical/hardware gates remain pending; desktop control has remained stopped
since the owner's physical Esc.

## Process termination and update notices

Actual child-process termination tests now interrupt the real installer after
the launcher switch and after the final installation-pointer switch. Scheduled
journal recovery restores the prior launcher, release pointer, unrelated config
and Stop. These tests inject only inert native storage/service boundaries and
do not constitute a physical power-loss or native service interruption test.

`ready` now supplies one concise `update_notice` for an applied update, an
available verified update, a recovered failure or an actionable error. Raw stored
messages and payload metadata never enter the notice, and unchanged notices are
deduplicated even when daily retry timestamps change. The skill relays the short
message once without derailing the user's task. No desktop UI is opened by the
notice reader. Native and real-agent notice behavior remain to be exercised.

Multi-scope update and rollback tests now retain the global Sidecar's permission
policy as the passive startup owner. Previously the last-installed project could
start the listener under its own policy. Project pins and launchers remain
independent; shared-desktop control still requires compatible active build/policy.
The post-change focused updater suite passed 20 tests. A preceding full source
run passed 191 tests with zero failures and seven explicit skips. The complete
suite and native architecture matrix must be checked again at the pushed head.
