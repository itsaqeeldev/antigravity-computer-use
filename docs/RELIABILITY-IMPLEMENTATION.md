# Reliability and updates implementation log

The active goal is the complete “Reliable computer use, automatic updates and
shared Mac support” plan. This log records implementation and evidence separately.
Review branch: `codex/review-intel-mac`. All private test output stays
in `.localdata/`. No release completion is claimed here.

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
