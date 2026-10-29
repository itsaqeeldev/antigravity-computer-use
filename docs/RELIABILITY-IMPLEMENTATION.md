# Reliability and updates implementation log

The active goal is the complete “Reliable computer use, automatic updates and
shared Mac support” plan. This log records implementation and evidence separately.
Review branch: `codex/review-intel-mac`. All private test output stays
in `.localdata/`. No release completion is claimed here.

Open coordination gap: [issue #7](https://github.com/shayann07/antigravity-computer-use/issues/7)
tracks the shared direct Sidecar's lack of authenticated per-task ownership.
An isolated IPC probe using the actual service dispatch and `Runtime.finish`
showed that a second connection's `end` clears another connection's frames and
grants. No real desktop or two live agents were used in that probe. Individual
actions are serialized, but that does not prove whole-task isolation; coordinate
one task at a time until a host-compatible ownership design is qualified. The
skill now states that limit rather than promising safe concurrent tasks.

Agents can now record structured feedback about observed usability, speed or
missing-capability concerns that did not produce a runtime error. Categories,
operation and evidence level come from fixed lists; task text, paths, screenshots
and arbitrary model prose cannot be submitted through this command. Reports are
deduplicated locally and labeled unverified. The existing scheduler submits
sanitized metadata only when the installation explicitly enables reporting and
GitHub authentication is available. Runtime errors are still recorded without
model participation. The skill instructs agents to assess and report genuine
concerns, but cannot force an arbitrary model to notice or report every issue.
Focused tests cover consent, sanitization and the unverified label; the running
installation and real automatic GitHub submission are not yet qualified.

The shared visual contract now uses a four-second breathing cycle with a
0.64–1.00 opacity range. Windows requests opacity updates for its cached edge
bitmap every 50 ms instead of 100 ms; macOS reads the same cycle and amplitude.
Both retain a static 0.94 opacity when the operating system requests reduced
motion. A headless Windows native probe read the contract in the newly compiled
helper and sampled 0.640–1.000 over one cycle. Its preview render and alpha
falloff checks passed. This does not measure on-screen frame rate, CPU/GPU cost,
comfort, or the actual Mac UI. The change is source-only: the existing installed
controller was not replaced while the Upscaly task was active. The local suite
passed 259 tests with nine explicit skips.

The shared `wait` operation accepts up to eight explicit `abort_on` labels for
known app failure states. It observes without repeating input, prioritizes an
observed failure over a success label, returns a fresh frame, and stops later
batch steps. Focused tests exercise failure precedence, frame cleanup, argument
bounds and skipped input. Labels are literal substrings, so callers must choose
specific observed text and avoid queries that hide errors. This is source/test
evidence only; a real Antigravity app workflow and its latency remain unmeasured.
Text waits now check the final returned view as well as the initial match. A
success label that vanishes does not advance the batch, and a known failure
appearing in the final view stops it. Focused regressions cover both transitions;
the returned view is still a point-in-time observation, not a guarantee that an
application cannot change afterward.
If a failure first appears in the final timeout observation, the wait now
reports that failure instead of masking it as a generic timeout; an inert
regression covers this boundary.
Intermediate text waits in batches now omit the final screenshot when followed
by an accessible-target action, avoiding a redundant capture. Final waits keep
their image default unless explicitly or query-selected otherwise. A pixel action
immediately after either wait is rejected before any batch input because its
intermediate screenshot was not available for the agent to inspect. Focused
tests cover these defaults and refusal. Real-app latency is still unmeasured.

The separate `wait_change` command waits for a change in the exact accessible
tree shown by a fresh observation. It preserves that observation's query and
node limit, consumes the old frame, returns a fresh text-only frame, and rejects
app identity, worker or control changes. A tree change can be unrelated and a
canvas may not expose changes, so it is not an outcome-verification shortcut.
Focused tests cover changes, timeout, consumed/stale frames and identity/control
transitions. Real desktop/model behavior and speed benefit remain unqualified.
It can also run as a batch step: a fresh frame feeds the next action, timeouts
skip the rest, and its budget is combined with ordinary waits. The comparison
starts from the previous action's returned frame, so an earlier change can be
missed; a detected change can be unrelated and must not be treated as success.
A direct authenticated IPC test now exercises the batch and actual shared wait
logic with an inert runtime, checking fresh-frame propagation and one dispatch
per action. It does not operate a desktop or establish host/model latency.
An additional review found that rendered trees start with a changing native
snapshot ID, which made the initial implementation report a change on every
capture. The comparison now excludes that identifier. A regression using the
actual renderer verifies unchanged snapshots time out and a changed label is
detected. Observation-scoped row and focus indexes are also excluded from the
comparison because the Mac adapter can renumber controls between captures;
tests retain actual user text and focus details. This feature was not installed
when the defect was found.

Review found that Windows `set_value` could dispatch an accessibility write and
then silently repeat it as keyboard input if the provider threw or returned
stale/unreadable data. It now reports `input_outcome_unknown` after an uncertain
dispatch and requires a fresh observation; range writes also report uncertainty
on post-dispatch failures. A headless test invokes the real compiled policy with
fake providers and checks a single dispatch across ignored, throwing and
unreadable cases. The Mac adapter also previously ignored numeric input and
reported success without read-back; it now sends the supplied number and checks
the observed value before reporting success. Mac contract checks and real
provider/app acceptance must still run for this change.

Intel CI run `40956802016` compiled the native adapter but failed a passive
Sidecar regression: it checked that the fake runtime was still active after a
25 ms idle timeout, and a loaded runner had already released it. The test now
checks that the same listener actually dispatched the subsequent observation,
without assuming the response arrives before the idle timer. The production
timeout and idle behavior are unchanged. The focused Windows checks passed;
the exact revised head still needs fresh cross-platform CI.

| Requirement | Status | Evidence / next step |
| --- | --- | --- |
| Human launcher reveals controls, passive startup hidden | Source repaired; current affected-PC/native trial pending | Human launcher uses passive `start` then explicit `controls`, recovering cached `ready` failures without re-arm. Earlier native Windows visibility evidence exists; latest generated-launcher test uses inert IPC controls, not a real bar. Issue #3 tracks device acceptance. |
| Guardian concurrency, timeout, early exit and bounded recovery | Implemented; focused and CI checks passed | Shared readiness, early exit, invisible replies, cached failures, explicit recovery, isolated-desktop handoff and lost-acknowledgement tests pass. Physical crash/input cleanup remains separate. |
| Simple model workflow | Partial; real matched Notepad trials recorded | On installed `bc457343...`, Sonnet and Flash saved matching Unicode in 203,199 ms and 181,909 ms respectively. Flash had a close verification error; earlier Flash failure remains evidence. Affected-PC and matched Upscaly trials remain pending. See `docs/PERFORMANCE.md`. |
| Shared signed update staging | Implemented; release transport pending | Ed25519 verification, architecture/OS/channel/sequence checks, bounded hashed downloads and inventory checks. Protected key and Actions secret configured; local signing verified. No release published. |
| Idle update, settings, Stop, rollback and pins | Mac isolated native checks passed; full acceptance pending | Real installer/lease paths cover upgrade, failed health, settings/Stop/pins, deferral and recovery. Mac native update/rollback uses substituted release transport/test signing keys. Windows native checks skip unsafe ancestors. Native interruption/power-loss and production updates remain pending. |
| Automatic scheduling | Implemented; native qualification pending | Both passive and foreground Sidecar entrypoints schedule bounded workers; daily check policy, explicit manual/notify modes. No OS scheduled task. |
| Local failure diagnostics and consented GitHub reports | Implemented; mocked integration passed | Allowlisting, deduplication, consent, missing auth and backoff have regressions. Authorized development issues #2/#3 track real reports; automatic reporting from a consented user installation is not yet qualified. |
| Shared Windows/Mac implementation | Partial | Intel report and repairs were submitted in PRs #4/#5; source integration at `fc2b9ac` passed both Mac CI architectures. Independent interactive Mac acceptance remains incomplete. |
| Real app and physical/hardware acceptance | Partial | Physical Esc during a held Windows mouse drag, queued-action cancellation, restart and human re-arm were observed on `bc457343...`. Affected PC, fresh PC, Mac physical input, held-key, mixed-display and production updater acceptance remain pending. |
| Publication and bootstrap installer pin | Pending | Keep release draft until applicable gates pass. Existing published beta cannot acquire updater without one supported upgrade. |

Updater status and post-switch health must now explicitly report `ok:true` in
addition to the expected identity and passive state. Failed or missing health
acknowledgements trigger rollback; a failed initial status does not authorize
shutdown. Transaction tests cover these cases with isolated adapters, not a real
published update.
Reservation now requires both `ok:true` and `prepared:true`; every update-path
shutdown requires `ok:true` and `closed:true` before installation or rollback
continues. An isolated transaction test verifies ambiguous acknowledgements do
not switch files. Actual signed-update cleanup remains unqualified.
If the replacement never starts, a failed shutdown may now proceed to rollback
only after a positive `not_running` status and acquisition of the native data
lease. Initial cleanup has already been confirmed and the switch journal blocks
new input. Active, unresponsive or ambiguous status still requires operator
inspection. Isolated tests cover these branches; real failed-start recovery on a
published bundle remains pending.
Explicit rollback and interrupted-switch recovery also acquire the native
controller lease before restoring files, and release it before passive restart.
An isolated test checks ordering and confirms a competing owner leaves the
recovery journal intact. Real Sidecar/OS race qualification is still pending.
Lease release now waits for the ownership helper to exit even after requesting
termination. If the helper does not exit within the bounded cleanup period,
release reports `service_lease_cleanup_unconfirmed` instead of claiming success.
Inert helper tests exercise delayed exit and refusal; actual OS failure remains
separate from this test evidence. The updater retains its recovery journal and
does not start rollback if the helper's exit is unconfirmed, because it cannot
assume the old fence is still held. A transaction test covers that boundary.
If closing the helper's pipe throws, release still requests termination and
requires an exit acknowledgement; an inert broken-pipe test covers that path.
Rollback and interrupted recovery now validate that every rollback manifest is
an absolute, non-duplicate `backups/<entry>/rollback.json` inside this install,
and verify the private tree before shutdown or restoration. Tests cover external,
relative and duplicate paths and failed tree verification. They do not establish
protection against an attacker already able to alter trusted backup contents.

Mac Intel CI run `40946383380` failed during the compiler lookup after roughly
ten seconds and reported missing Xcode tools. The previous code discarded the
underlying spawn error, so the log cannot prove whether tools were absent or the
probe timed out. The storage-builder probe now distinguishes timeout, spawn failure
and unavailable tools, and allows a 30-second bounded lookup. A focused synthetic
test covers those distinctions; actual Intel CI and device checks remain required.
The Mac host build now uses the same bounded SDK probe and reports probe timeouts
accurately; Swift compilation also has a finite 120-second limit. A timeout is
not proof that the toolchain is missing or that the resulting build is valid.

Stop persistence errors are no longer reported as successful durable Stop. The
runtime invalidates control and cleans up input, reports `stop_persistence_failed`
without a private path, and refuses orderly shutdown until it can persist the
latch. A stopped event from the native guardian also checks that the latch exists
and reports a failure if it does not. Focused tests cover missing storage and
recovery; actual physical Esc under a failing disk remains unqualified.
When the in-memory stopped reason is a latch or guard persistence failure,
`ready`, grant and launch now report the storage problem without opening controls
or suggesting ordinary re-arm. The explicit human controls command remains
available to the operator; no model action clears Stop.
When visibility cannot be verified after a failure, `ready` reports it as unknown
rather than claiming the controls are hidden. An explicit native `false` remains
distinguishable from a timeout or an unobserved result.
On Windows, a failed native guardian state write now also forces stopped state
and attempts cursor restoration, worker termination, held-input recovery and
overlay removal independently before emitting `guard_persistence_failed`.
The native helper compiles and a headless cleanup-order test passes; an actual
guardian storage failure and physical-input cleanup still need device testing.

The operator authorized reconciling the Upscaly project-local pin. Source
`36bef78` was built after its Windows and both Mac CI jobs passed. Global and
`D:\Work\Extras\Upscaly\image upscaler` project scopes now both identify build
`22e47b7c1236c2d4052f579e307e7e327c7584ddf333b7c2a5ae0ff9336c44b8`; their
108 payload files and skill templates verified, native helper hashes match the
bundle, and settings, Stop state and unrelated pins were preserved. The project
scope remains explicitly pinned. A direct project-launcher smoke test observed
stable Upscaly 1.0.9, physically opened Settings (13 animated frames), verified
the displayed panel, closed the app and ended control. This is not an Antigravity
model-driven task, a signed automatic update, or completion of Mac qualification.
One prior attempt saw a Sidecar restart during staging and the installer refused
the project update. Its failure remains in `.localdata/`; the successful retry
held the native ownership lease through the project install. Rollback journals
were retained. A fresh Antigravity conversation is needed to load the updated
project skill; refresh the Sidecar only if the host has not loaded its definition.

An observed Upscaly project-local beta.2 skill was pinned to a different build
from the running global beta.3 service. Status now explicitly reports a client
build mismatch, and mismatched requests receive `resolve_version_mismatch`
without dispatching input. The skill instructs agents to stop and preserve pins;
this does not change or unpin any deployment. A real project-scoped task after
an operator reconciles the versions is still required.

The preceding Windows installation was locally upgraded from `a4e7234` to build
`50426a656d2374fca25706235407cafb80cb9c0719a19c3cf65760c49cc32474`. Its 108
files and global skill verified, settings and project pins were preserved, and
it started idle without desktop input. Stop was not latched at upgrade time.
Existing diagnostics were readable without submitting them. This is not
production signed-update or current-build Antigravity task qualification.

The preceding Windows installation was locally upgraded from source `f6bfa1f` to
build `6b4d9d967478f383c5cb620bee7f6d2a898510040b10926e08b534fd7a059c7b`.
Its 108 files and global skill match, the service starts passively idle, and
configuration and project pins were preserved. Stop was not latched during the
upgrade. Automatic signed-update acceptance and an actual model task on this
build remain pending. The upgrade receipt is kept in `.localdata/`.

Signed updater metadata now requires a three-component numeric minimum OS and
a valid detected OS version before comparison. Malformed and out-of-range
components are refused rather than coerced. Focused signature and transaction
tests pass; this does not qualify an actual published update.
Scheduled updates also clear stale availability when the signing key is absent
or an apply fails. The prior staged files remain available for inspection, but
the scheduler waits for a new check instead of repeatedly attempting an invalid
apply. Transaction tests cover both cases without a live installation.
Staging now writes each received chunk fully even if the operating system
returns a short write; a zero-progress writer fails and removes its partial file.
The focused test simulates short and stalled writes, without qualifying real
disk exhaustion or a published release.

The owner observed stationary cursor clicks in the direct Upscaly test. Named
clicks had defaulted to accessibility invocation; the shared runtime now requests
physical pointer movement by default, including batch steps. Explicit
`physical:false` retains semantic clicks when needed, while pixel targets always
remain physical. Native identity, target, occlusion, Stop and cancellation checks
remain in place. Runtime tests cover default and explicit selector behavior; the
new default was installed and tested against Upscaly on Windows: a named click
without `physical` moved the real pointer over 15 frames and opened Settings;
the app was closed and control ended. The installed skill and 108 files matched
build `a19b62d415801a03cd37b7c80bf6343148cdd404c8a84f133e0156f2e21abad9`.
Broader Windows and real Mac app qualification are still pending.

The default physical path exposed an earlier native behavior: a disabled indexed
control could be physically clicked and reported as delivered. Both native hosts
now refuse a known disabled accessibility target before sending a click. A pixel
target has no comparable semantic enabled state and still requires visual
verification. The Windows host compiled locally, and the installed new helper
refused the actual disabled Upscaly 2× button with `element_disabled`; it then
closed the app and ended control. Real Mac checks remain pending.
An attempted existing native fixture run stopped with `confirmation_required`;
it is not a pass and no approval was manufactured to make it proceed. The
failure is retained as local test evidence.
Follow-up identified the cause: the test reused a native snapshot after Driver
restarted its worker to clean up the rejected input. A fresh snapshot restored
the intended observed target. A separate attempt compared absolute cursor
positions and failed while physical input could occur, so that unstable assertion
was removed. The corrected fixture passed 13 checks, including disabled refusal;
its explicit fixture grant is a test double, not human approval or device-wide
qualification. The actual Upscaly refusal above remains the real-app evidence.

The supported Windows local upgrade to source `0a919f8` produced and installed
build `4d112e9e4137e1999750430cc3170995bc8cc421a76f998c517c3cd459a66910`.
All 108 payload files and the global skill verified; cleanup was confirmed and
settings and project pins were preserved. Stop was not latched at upgrade time.
The new service started idle and host-managed without desktop input. This is not
an automatic signed-update acceptance test or a real Antigravity task on the new
build. Private receipt and rollback location remain under the installation and
the upgrade evidence is under `.localdata/reliability-current/`.

Windows CI on documentation head `2ab0861` failed the real foreground-service
startup test after its 10-second readiness deadline; stderr was empty. The same
test passed in the local full suite and the preceding Windows CI, but those passes
do not establish why this run failed. The original failure remains in Actions run
`40934910247`; its failed job was rerun for comparison. Treat a successful retry
as a separate observation, not proof that startup cannot hang.
Another local full run timed out the human-launcher fixture and its immediate
cleanup masked the timeout with `EPERM`. The harness now terminates its own
Windows child process tree on timeout and waits for process closure before
cleanup, retaining the original timeout message. The focused test and a full
retry passed; this does not establish the underlying timeout cause.
A later full suite hit the same 10-second fixture deadline again. That harness
runs two separate launcher commands and native storage checks, whose own bounded
operations can exceed the test's shorter deadline. Its outer limit is now 30
seconds and it explicitly logs runs over 10 seconds. This changes the fixture
deadline only; it is not evidence that actual startup latency is acceptable.
Another Windows run (`40937717822`) timed out in the ownership helper and then
hit `EPERM` while removing its fixture directory. Source review identified a
possible cleanup race: startup rejected immediately after requesting helper
termination, before its directory handle was known to be released. The helper
startup path now waits for termination, and reports unconfirmed cleanup if it
cannot establish that the child exited. Focused tests cover both outcomes and
real kernel ownership; they do not establish the cause of the original CI stall.

The incident counter no longer clamps at one million when reading records: that
clamp could cause a new occurrence to appear already acknowledged. A regression
checks the transition past the former limit. Exhaustion of the safe integer range
is reported as diagnostic storage failure instead of silently losing occurrences.
This is source-level evidence, not qualification of automatic GitHub reporting.

Rollback previously accepted any successful start command without checking the
restored service's identity, and interrupted recovery checked state without its
build ID. Explicit rollback, interrupted recovery and automatic failure recovery
now require the expected restored build in an idle or stopped state. They retain
the recovery journal on a false or mismatched health result. Isolated transaction
tests exercise these failures; native interrupted-update acceptance is still open.

### Open diagnostics concurrency defect

The controller and
launcher can both call the synchronous recorder. A two-process barrier test had
both writers read the journal and publish through `incidents.json.tmp`; both
reported success but the final journal held only one of the two distinct events.
The reproduction and result are retained under `.localdata/tests/incident-race-*`.
The separate reporter acknowledgement repair below did not serialize incident
writers. The current candidate serializes production controller and launcher
writers using a separate private native lease and atomically publishes the bounded
journal. A two-process test covers distinct incidents, repeated occurrences and
recovery after terminating a writer. A lost-ownership check immediately before
publication is tested separately. Earlier pinned releases can still use the old
writer, and Mac device behavior needs further qualification. A further Windows
barrier test killed the lease helper just after the writer's ownership check,
allowed a second writer to commit, then resumed the first writer: both reported
success but the first overwrote the second. That JavaScript-side guard did not
close the helper-death race. The candidate now sends the bounded journal to the
native lease holder, which alone flushes and atomically publishes it while holding
the lock. A Windows test kills that helper immediately after the caller's liveness
check; the stale writer fails and the next holder's journal remains intact. The
original reproduction remains under `.localdata/reliability-current/`. Older
pinned runtimes do not use this protocol, and real Mac qualification remains open.
Malformed or oversized helper replies now fail the pending publication promptly
and retire that helper; the result remains outcome-unknown rather than replaying
a potentially committed incident. A focused protocol regression covers this path.
Native publication now uses one reserved temporary file. A later lease holder
checks that file's ownership and privacy before removing an interrupted write;
the Windows native regression exercises recovery and refuses a symlinked temporary
file without changing its target. Mac CI and hardware validation are still
required for the corresponding implementation.
The first asynchronous version delayed error responses while acquiring the lease,
causing a client timeout in the full suite. Recording is now queued off the reply
path; replies identify it as pending, status exposes pending/failure, and orderly
shutdown waits for queued records. Native storage checks run asynchronously.
The failed suite is retained under `.localdata/reliability-current/`, followed by
a full local pass. A subsequent full run also hit the human-launcher fixture's
10-second timeout; the focused test and a full retry passed, but the reason for
the timeout remains unproven. Abrupt process death can still interrupt an
in-flight record.
Another full run under load hit the incident writer's five-second contention
deadline and returned `service_already_running`. The background wait is now
bounded at 15 seconds. A focused retry passed, but this longer limit does not
prove loss-free reporting during sustained overload. The failed run is retained
as `visibility-unknown-suite.log` under `.localdata/reliability-current/`.
Malformed or oversized journal data and malformed acknowledgement files now
refuse recording and reporting with `diagnostic_journal_invalid`; existing bytes
are retained for inspection. This prevents a damaged journal from being treated
as an empty one and overwritten. Focused tests cover each case.

The old recorder and reporting worker both rewrote `incidents.json` through the
same `.tmp` pathname. A deterministic two-process test reproduced `ENOENT` when
a new incident arrived during publication. The candidate now stores bounded
report acknowledgements separately, and the regression verifies that a new
incident and a newer occurrence of the same incident remain pending. A separate
process-termination test confirms an interrupted acknowledgement publication
leaves the incident pending. A deterministic reentrant simulation reproduced two
issue-create calls when reporters both passed the backoff check before either
published it. No real GitHub issue was created. The candidate now acquires a
separate native reporting lease before reading reports and checking backoff; a
real Windows helper test confirms exclusion, detection of helper termination and
subsequent reacquisition. A mocked overlap test confirms the second reporter
defers. Consent is rechecked before submission. Mac native lease and power-loss
behavior remain to qualify. An uncertain remote create outcome still needs
human review if GitHub never reveals the issue: a durable send intent prevents
automatic replay while search may lag, and reconciliation clears it when the
issue appears. A user-facing resolution flow for a confirmed absent issue is
still needed; do not silently discard the intent.

Earlier runtime evidence: Windows 212 passed, zero failed, seven explicit skips;
[Windows CI](https://github.com/shayann07/antigravity-computer-use/actions/runs/40883552932)
and [Mac CI](https://github.com/shayann07/antigravity-computer-use/actions/runs/40883552937)
at `f97b748`. All 151 provenance entries matched then. The later installed/running
build `bc457343...` verified 107 files and the skill, with an idle service and
zero app grants. It remains older than the review branch. These records do not
clear the outstanding human/device gates or qualify a new public release.

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

## Historical source evidence

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

At that earlier checkpoint, release-key custody/public-key setup was pending;
it has since been configured and verified as recorded below. Remaining release
work includes signed published assets and the bootstrap pin; real
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

`update status` now emits a compact allowlisted result instead of the private
signed-manifest envelope and staging/rollback paths. It includes settings,
availability/version, whether staging/rollback exists, sanitized worker result,
an error code and one next action. Unknown settings/worker fields are dropped.
Notify-only installations receive `update_available`, not an automatic-apply
instruction. The complete signed material stays private for runtime verification.

## Signing workflow registration

A direct dispatch attempt returned HTTP 404 because GitHub requires the new
workflow to exist on the default branch. A temporary, explicitly named development
branch push trigger now qualifies the same preparation jobs without merging the
runtime. It runs only when signing scripts, the public key or the workflow change;
it is not a pull-request trigger. Repository permissions remain read-only, and
only unpublished artifact preparation is authorized by this workflow. Automatic
qualification uses its unique run ID as the sequence. Actual release dispatches
must use a sequence greater than any previously published metadata.

The development signing run at `11805ff` passed on Windows x64, Mac ARM64 and
Mac Intel: [workflow evidence](https://github.com/shayann07/antigravity-computer-use/actions/runs/40873372390).
Every prepared signature and payload was independently verified against the
pinned public key; Windows had 105 payloads, each Mac had 108. Signed artifacts
were uploaded with seven-day retention. None was published as a release or fed
to the installed updater. The sequence was `40873372390`.

The follow-up workflow now runs native installation/update/rollback checks on
the exact sealed bundle it signs before uploading assets. Windows ACL refusal
must still be recorded as unqualified. Interactive app/permission/physical tests
remain separate and required; this workflow cannot establish vendor parity.

## Exact signed native qualification result

At `455b126`, the [signed-bundle preparation run](https://github.com/shayann07/antigravity-computer-use/actions/runs/40873846760)
passed all three jobs. Independent public-key verification covered each signature
and every prepared payload. The exact signed Mac ARM64 and Intel bundles passed
native installation, passive service startup, update, rollback and Stop retention
in isolated homes. Windows native updater qualification explicitly skipped with
`insecure_storage_ancestor`; no parent ACL was changed. This is not a Windows
native update pass. All assets remain unpublished CI artifacts.

## Unicode transport isolation

The new no-input Windows transport regression sends the exact synthetic Urdu,
U+200C/U+200D and emoji string through real Windows PowerShell, the production
CLI/parser and authenticated IPC, `Runtime.action`, `Driver.call`, and a native
C# JSON serializer. Both literal `--text` and UTF-8 `--text-file` round trips
preserved every code point. The native endpoint is an inert JSON echo process;
approval/window/observation boundaries are injected fixtures and no clipboard,
app windows or desktop input APIs are used.

This narrows issue #2: the transport/runtime path does not strip the joiner in
the tested cases. It does not establish whether Flash omitted U+200D in its
original paste argument or whether the real clipboard/provider path changed it.
That remaining distinction needs a controlled native app test after the owner
resumes desktop qualification. The issue stays open and the earlier Flash run
remains a failed exact-text qualification.

The first full source run after adding that transport test had one unrelated
foreground-service readiness assertion failure (195 passed, one failed, seven
skipped). Its returned error was not included by the old assertion. The assertion
now retains the actual readiness reply for diagnosis. The focused foreground
test passed, and the next full run passed 196 tests, zero failures and seven
skips. The original failure output is retained privately; a successful retry is
not proof that an intermittent startup defect has been eliminated.

## Flushed recovery metadata

Update state, switching markers, installer journals and deployment pointers now
publish a fully written and `fsync`-flushed temporary file through a same-directory
atomic rename or exclusive link. A failed file flush or replacement retains the
previous metadata and cleans its unpublished temporary file. Before launcher
switching, the installer flushes staged payload files and saved rollback copies.
Host configuration and skill entrypoint text also use atomic publication.

The required file flush is never silently skipped. Directory flushing is
attempted; platforms where Node cannot open/flush directory handles report that
limit rather than treating it as a power-loss qualification pass. Fault-injection
tests verify old-state retention and write ordering. Real power-loss and native
interrupted-service acceptance remain pending, and no user desktop control was
resumed for these tests.

## Legacy project update migration

The installed registry audit found a pre-updater project deployment on a release
different from global, without an `update_pin` field. The updater now treats such
divergent legacy project scopes as pinned. Explicit boolean choices take
precedence, and new scopes retain the documented automatic-update default.
Manually upgrading a legacy scope retains its inferred pin unless the operator
uses `--unpin-version`. Tests verify global upgrade leaves the old project
launcher and release unchanged, and explicit unpin remains possible.

## Current acceptance audit

The full objective remains incomplete. At the audited checkpoint:

1. Recovery implementation and local visibility evidence exist; the affected
   second PC and positive tests of the newest native helper remain pending.
2. Flash produced a real file and ended control, but exact Unicode and speed
   failed qualification. Sonnet was not submitted after physical Esc. Those
   failures cannot be replaced by transport fixtures.
3. Signed preparation/verification passed all architectures. Native Mac update
   and rollback passed for exact signed bundles. Windows native updater
   acceptance is still skipped under unsafe project ancestors.
4. Installer/update preferences, migration, task deferral, pins, journal recovery
   and process-termination checks have source evidence. Real native interruption,
   power loss and production release transport remain pending.
5. Runtime logging and consented submission have fixture coverage and issue #2
   records the actual model failure. Automatic reporting on another user's
   authenticated installation is not yet qualified.
6. The Intel Mac prompt was supplied. No on-device report or repair PR was present
   in the GitHub audit; interactive Mac permission/app/physical checks are unrun.
7. Source/native CI is green at `16ef287`; newer source changes need their own
   checks. Skips remain explicitly unqualified.
8. Public release and one-line bootstrap remain beta.2. The installed global
   beta.3 build is `83487f3a...`, behind current source; its 102 payload files and
   global skill verified. No release/pin update is authorized by a green fixture
   alone. Physical desktop control remains stopped until the owner resumes it.

## Native risk-classification parity

Review found that Windows accepted an unlabeled click or drag as routine while
Mac required sensitive-action approval. The shared contract now explicitly lists
these ambiguous target operations, and both native classifiers require approval
when their risk label is empty or whitespace. Mac now also removes Unicode
format characters for risk matching, matching Windows: a hidden joiner cannot
split a sensitive label such as `delete` to evade classification. This does not
remove joiners, direction marks or other characters from observations or input.

The Windows regression invokes the actual compiled native classifier by
reflection without entering the host, inspecting applications, creating windows,
registering hooks or sending input. It failed on the prior implementation and
passed after the repair. The Mac native contract checks include the corresponding
hidden-label and ambiguous-target cases; their compilation/execution must be
verified on the exact CI head. These checks establish classifier behavior, not
real approval-dialog handling or physical Stop acceptance.

The local Windows suite after this repair passed 202 tests, failed zero and
skipped seven (five Windows ACL qualification checks and two Mac-only tests).
Native compilation succeeded. The historical before-fix failure and after-fix
results are retained under ignored `.localdata/mac-port/`. No live installation
was updated and desktop control was not resumed for this check.

## Invisible-control recovery and explicit human retry

`ready` previously returned no error when the guardian replied with
`controls_visible:false` without an error field. That reply produced no incident
and did not bound repeated attempts. The shared runtime now records
`guardian_controls_not_visible`, retains the failure episode, and returns one
diagnostic action. Isolated-desktop errors retain their explicit human-launcher
handoff even on a cached failure. Neither path claims visible controls or clears
Stop.

An explicit human launcher now performs passive `start` followed by `controls`.
It can retry showing controls after an earlier cached `ready` failure, while
ordinary agent `ready` calls remain bounded. Failed startup does not advance to
the controls command. Both launchers remain fixed and argument-free; they never
re-arm. The shared skill explains the visible-desktop handoff and stops repeated
startup advice if that attempt still fails.

New regressions failed before the runtime fix and passed afterward. An additional
integration test executes the generated human launcher against the real IPC
service with an inert controls provider, verifies one show request and confirms
Stop remains on disk. It does not create an actual bar or establish recovery on
the affected second PC; native visibility, physical re-arm and real host/model
qualification remain required.

## Lost acknowledgements preserve uncertainty

The direct client previously reduced lost, invalid or oversized replies to
ordinary errors, dropping the structured unknown-delivery state. A timeout also
said the session was cancelled without confirming native cleanup. Connected
transport failures now retain `delivery_unknown`, require observation before
continuing and return `inspect_effect_without_replay`. Closing the connection
requests cancellation; it is not reported as proof that input was never sent or
that cleanup completed. Invalid reply contents are not echoed in the error.

Requests now have an absolute deadline, rather than a socket inactivity timeout
that partial bytes could continually extend. Seven real-client/inert-peer cases
cover lost, malformed, non-object, missing-status, oversized, timed-out and
never-completing partial acknowledgements. The existing real-service cancellation
test now exercises an inert action, verifies one dispatch and one Stop request,
and checks the unknown-delivery advice. No test sends desktop input or establishes
the physical watchdog/held-input-cleanup acceptance gate.

The first Intel CI run timed out the 4 MiB oversized-response fixture at its
artificial 250 ms limit before the size condition arrived. The runtime retained
unknown delivery correctly. The fixture now separates that test's deadline from
the dedicated short-deadline cases; the failure is retained in run `40883083236`.

## Real Windows upgrade exposed updater-layout refusal

After the owner resumed Windows testing, the supported installer refused the
existing dedicated installation with `storage_not_dedicated`: native
`OwnInstall` omitted this project's own `update-settings.json`, `update-state.json`
and other updater entries. No configuration switch occurred. Shutdown cleanup
had succeeded, and the prior build was restarted passively and returned idle.

The Windows guard now recognizes exact updater filenames, its staging directory
and the narrow UUID temporary-metadata pattern used by atomic publication.
Unknown/lookalike files are still refused. Ancestor, ownership, ACL and reparse
checks are unchanged; no parent permissions were changed. A regression calls the
real compiled layout classifier without entering its ACL-changing entrypoint. It
failed on `update-settings.json` before the fix, then passed recognition,
unrelated-data refusal and unchanged-ACL checks. The real supported upgrade must
be retried with a fresh complete candidate; this classifier check does not itself
qualify installation or automatic signed updating.

## Incident reporting scheduler

An empty startup submission check previously consumed the retry window and the
daily scheduler timestamp, so a failure recorded immediately afterwards could
remain pending until the next day. Empty journals no longer consume a network
retry window or scheduler attempt; while the service is running, the next hourly
tick can report a new incident when reporting consent and authentication exist.
Actual submission attempts remain throttled to at most hourly. Concurrent
reporters still use the exclusive lease and unknown submission outcomes are not
replayed. Automated coverage uses isolated fixtures; real installed reporting
and GitHub submission are not yet qualified.

## Guardian cleanup confirmation

Shutdown previously returned after requesting termination of an unresponsive
guardian, even if its process had not exited. The controller now waits for the
process close event, reports `guardian_cleanup_unconfirmed` if it cannot confirm
exit, and refuses a replacement while the old process remains unresolved.
Concurrent close requests share the same outcome. Isolated process fixtures cover
late exit, missing exit, and startup timeout; real native failure injection is
still pending. This does not resolve shared task ownership issue #7.

## Concurrent native build cache

Windows CI run `40964379469` failed because a build's cleanup could delete a
different compiler's temporary executable before publication. Cleanup also
could remove a stamped executable another session was about to launch. The
compiler now leaves other builds and temporary files alone; a real Windows
compiler regression verifies both remain. This trades automatic cache pruning
for correctness until a coordinated, lifetime-aware cleanup exists. The CI
failure is retained as evidence; a passing local regression is not a substitute
for the new commit's CI results.
