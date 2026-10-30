# Intel Mac qualification: reported device results and review limits

The on-device agent submitted [PR #4](https://github.com/shayann07/antigravity-computer-use/pull/4)
at `65f22c4c0f085d6b3df9f891bd17c7f3ebf66b89`. This is useful partial device
qualification, not a general Mac release or proof that every acceptance gate
passed. Raw device evidence remains private on that Mac; the Windows reviewer
has inspected the submitted source/report, not replayed those physical actions.

## Identities

- Reported hardware: Intel MacBook Pro, i7-9750H, native x86_64.
- Reported OS tuple: macOS 26.6.2, Darwin 25.4.0, build 25G83. Retain raw
  `sw_vers`/`uname` output privately when refreshing the report.
- Reported Antigravity: 2.28.1; Node 24.20.0 darwin-x64; Swift 6.3.1.
- Verified Git merge base of PR #4: **`f97b748fc97a9c1f97ba97a415d445d7e61822a2`**.
  The original report printed a different full hash with the same short prefix;
  that string must not be used as the tested source identity.
- Runtime repair commit on the fork: `6b38f83fd8bf2b5d2ffa85b3f662ed13928c2bc8`;
  report-only head: `65f22c4c0f085d6b3df9f891bd17c7f3ebf66b89`.
- Reported installed bundle: `75989c9a63fe5c1f7ce3b8212e9393e7d1e1385e88d09a9b4b6a456e9e6c2cb2`,
  108 sealed files, beta.3. Preserve its manifest and match compiled native/source
  hashes before treating it as equivalent to a newer checkout or candidate.

## Device evidence supplied

| Check | Evidence status | Boundary |
| --- | --- | --- |
| Native compilation, contract, bundle and installation | Reported pass | Refresh on the reviewed integration head; source build alone is not desktop acceptance. |
| Full suite | Reported 198 pass / 0 fail / 22 skips | Windows-only skips are legitimate; shared ownership tests must stay enabled on Mac. |
| Provenance | Original report said 150 matches | Its map dropped the existing transport regression and omitted the new report; that count is incomplete. Integration preserves all prior entries. |
| Passive startup and explicit HUD | Reported pass | Actual on-device observation; current-helper recovery still needs requalification after changes. |
| Human OS grants and app approval/denial | Reported pass | Accessibility, capture, listen/post permissions and native Allow/Deny were reported. No permission is manufactured by CI. |
| Discovery, window capture, semantic AX action | Reported pass | Finder/Antigravity discovery is not proof of controlling several approved apps. |
| Unicode | Reported matching AX text | Urdu, U+200C/U+200D and emoji were inspected in TextEdit; independently decoded Open/Save output is still pending. |
| Stop, restart and human re-arm | Reported latch/restart/re-arm | No supplied trace establishes physical Esc while a key/button is held or queued input is pending. Do not mark that physical gate passed. |
| End and reuse | Reported End followed by app discovery | This establishes listener reuse only; a second complete app task/output remains pending. |
| Signed updater/rollback | Isolated native check reported pass | Test signing key and substituted release transport; explicit rollback is distinct from native failed-start automatic rollback. |

Private references supplied: `.localdata/evidence/01-textedit-open-panel.jpg`,
`02-textedit-untitled.jpg`, `03-textedit-unicode-typed.jpg`,
`.localdata/unicode-test.txt`, `.localdata/macos-bundle/` and the installed receipt
log. Keep screenshots, actual document text, personal paths and credentials out
of public issues. Sanitized command/status summaries and manifest hashes can
support the next report.

## Source review and corrections

- Empty/whitespace configuration parsing is useful and retains invalid-JSON
  refusal and unrelated configuration. Both MCP and Sidecar merges need coverage.
- The proposed `EEXIST` handling does not serialize initial directory/marker
  creation. A helper can still inspect an unfinished marker. Native concurrency
  qualification must cover this before accepting the repair as complete.
- PR #5 (`1356308aa30fd2b466ec1d7d2037df4e1c2ac1db`) reports 201 passing
  tests and 22 skips on Intel hardware and adds directory locking. Its raw logs
  have not been independently reviewed. The follow-up source could truncate an
  invalid hard-linked marker in source storage; the integration replaces that
  open with exclusive creation and adds a regression. The integration itself
  requires Mac CI and renewed device qualification.
- Qualification runs now get unique directories under `.localdata/tests/`;
  deleting the prior installation/evidence before each run is not acceptable.
- Native C#/NTFS checks are Windows-only, but legacy-controller exclusion is a
  shared policy. Its Mac fixture initializes private storage rather than skipping
  the check.
- Mac CI should run the complete suite after precompiling native adapters,
  retaining explicit platform skips and the original provenance entries.

## Remaining device and distribution acceptance

1. Rebuild/install the reviewed head; record checkout, bundle, installed and
   running identities, exact exit codes and all skips.
2. Through actual Antigravity `/computer-use`, save plain UTF-8 Unicode text,
   reopen it through the native picker and independently compare decoded bytes/
   code points, allowing only explicitly stated encoding/line-ending differences.
3. Exercise real smooth pointer clicks, right/double click, drag and both scroll
   directions, screenshot coordinate fallback and several approved apps/dialogs.
4. Physically press Esc during held/queued input, verify cleanup and skipped
   steps, retain Stop across restart, then perform human-only re-arm and a second
   complete app task without restarting Antigravity.
5. Verify soft pause/resume freshness, worker/guardian crash and cursor restoration,
   permission revocation, sleep/wake and available Retina/display configurations.
   External/negative-origin monitor checks stay pending without that hardware.
6. Qualify native failed-start update rollback, persistent pins/settings/Stop,
   live skill discovery after upgrade and real published-release transport.
   Existing ad-hoc signing does not establish a qualified public distribution or
   Gatekeeper/renewed-permission update path.

Keep Mac experimental and the public release unchanged while these gates are
missing. Source/CI fixes and reported hardware observations are separate evidence.

## 30 October 2026 qualification checkpoint: covering-window defect repair and candidate smoke

### Tested Identities

- Hardware: Intel MacBook Pro (16-inch, 2019), Intel Core i7-9750H CPU @ 2.60GHz, native x86_64.
- OS tuple: macOS 26.6.2, Darwin Kernel Version 25.6.0 (x86_64), build 25G83.
- Toolchain: Node v24.20.0 (`darwin-x64`), Swift 6.3.1 (`swiftlang-6.3.1.1.2 clang-2100.0.123.102`), target `x86_64-apple-macosx26.0`.
- Antigravity IDE: 2.28.2 (PID 2355 `/Applications/Antigravity.app/Contents/Resources/bin/language_server`).
- Upstream base requested: `32fb9916a215fc60b7f172774ea41c29dca2f600`.
- Actual upstream head fetched: `fb6cb0dba7d319ece00908e07b8f76028554368c` on `origin/codex/review-intel-mac`.
- Built bundle: `1eb8de7825d00230bdd4f51fbfc2c2e412463127924b7aa6535e56aa2969435c`, version `0.3.0-beta.3`, 110 sealed files (`darwin-x64`).
- Installed release: `/Users/ghaz-webscare/Library/Application Support/AntigravityComputerUse/releases/0.3.0-beta.3-2026-10-30T08-01-46-194Z-eb6e744d`.
- Skill pointer: verified matching `/Users/ghaz-webscare/.gemini/config/skills/computer-use`.

### Defect Identified and Repaired

- **Mac Covering-Window System Daemon Collision (`MacOperations.swift`)**:
  In `verifyCoveringWindow`, `CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)` returns the macOS `Dock` window (PID 536, layer 20, name `"Dock"`) with full-screen bounds `(0, 0, 1792, 1120)` as well as `Window Server` (layer 24). Because `verifyCoveringWindow` previously only skipped the guardian's own click-through HUD, any click coordinates inside the approved application window (e.g. TextEdit) matched candidate Dock first in Z-order. Dock's window number (26) did not match the expected window (483), causing every click on macOS to fail closed with `obscured: "Another window covers this point. No click was sent."`.
- **Repair**:
  In `server/native/macos/MacOperations.swift`, candidate evaluation now explicitly skips system background daemons:
  ```swift
  let ownerName = candidate[kCGWindowOwnerName as String] as? String ?? ""
  if ownerName == "Dock" || ownerName == "Window Server" { continue }
  ```
  On-device Swift verification proved that target application windows (TextEdit window 483) are correctly matched and verified, while covering application windows (such as overlapping Antigravity or Claude windows) remain strictly detected and refused.

### Test Results

| Test Suite / Script | Result | Details |
| --- | --- | --- |
| Full Node Test Suite | PASSED | 414 passed, 0 failed, 30 skipped (Windows NTFS/C# only), 79.4s |
| `tests/macos-storage.test.mjs` | PASSED | 4/4 passed (concurrency, private ACLs, link refusal, kernel lease) |
| `tests/macos-tool-probe.test.mjs` | PASSED | 8/8 passed (concurrent builds, publication, tool probing) |
| `scripts/macos-native-check.mjs` | PASSED | AxonHost control contract 1 checks passed; POSIX private storage verified |
| `scripts/check-provenance.mjs` | PASSED | 175 of 175 recorded hashes verified (updated for `MacOperations.swift`) |
| `scripts/verify-install.mjs` | PASSED | 110 files verified, build ID `1eb8de78...` matched, skill matched |
| `scripts/macos-install-check.mjs` | PASSED | Signed update, rollback, Stop preservation, sealed installation |

### Device Acceptance Results

- **Application & Window Discovery**: `apps` correctly enumerated running GUI windows (TextEdit `Untitled 2`, Google Chrome with Slack, Antigravity, Android Studio, Finder).
- **Snapshot & Accessibility**: `snapshot` returned structured accessibility tree elements (`Edit #First Text View`, checkboxes, combo boxes) and 586x488 JPEG visual observation.
- **Window Activation**: `focus` successfully brought TextEdit to foreground with verified observation frame and image.
- **Sensitive Operation Policy**: Sensitive action prompted native human approval modal; timed out after 90 seconds and properly failed closed with `permission_denied` and `await_user_decision`.
- **Emergency Stop & Issue #26**: Emergency Stop state survived controller shutdown and restart (`persisted_emergency_stop`), explicit controls refused start, and human-only re-arm requirement enforced on native HUD bar.
- **Update and Rollback**: Isolated test-signing qualification passed (36/36 recovery-update tests, rollback preserved settings and pins).

### Evidence Boundaries

- Ad-hoc and local test signing with substituted transport qualifies atomic rollback and deployment invariants, not production Apple Developer ID notarization or Gatekeeper distribution.
- Physical Esc/Stop requires human physical keyboard input; simulated physical input was not manufactured.

