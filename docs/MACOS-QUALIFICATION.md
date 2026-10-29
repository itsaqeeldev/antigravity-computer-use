# Intel Mac qualification: reported device results and review limits

This report documents on-device qualification and repairs on an Intel Mac,
tracking `codex/review-intel-mac` at `3020bf7fa43a86f51ea4766ce97c8395e8030bdf`
and repair branch `codex/intel-mac-repairs-p2`. Raw device evidence remains private on
that Mac in `.localdata/`.

## Identities

- Reported hardware: Intel MacBook Pro, i7-9750H, native x86_64.
- Reported OS tuple: macOS 26.6.2, Darwin 25.4.0, build 25G83.
- Reported Antigravity: 2.28.1; Node 24.20.0 darwin-x64; Swift 6.3.1.
- Baseline commit: `3020bf7fa43a86f51ea4766ce97c8395e8030bdf` (`origin/codex/review-intel-mac`).
- Tested repair branch: `codex/intel-mac-repairs-p2`.
- Candidate bundle: `17ac18b2d22fcc314c559ceba91ee22e3c51dc94837e08d21322208c47f8c4a0`,
  109 sealed files, 0.3.0-beta.3.
- Installed runtime location: `/Users/ghaz-webscare/Library/Application Support/AntigravityComputerUse/releases/0.3.0-beta.3-2026-10-29T15-42-41-094Z-352dfd3f`.

## Device evidence supplied

| Check | Evidence status | Boundary |
| --- | --- | --- |
| Priority 1 Storage Race Repair | Passed | Bounded directory synchronization with `flock(LOCK_EX \| LOCK_NB)` polling, atomic creation with fsync, and process death 0-byte recovery. Verified by `tests/macos-storage.test.mjs` against `MarkerWriter` regression fixture and 8 concurrent parallel processes. |
| Full Node suite | Passed (201 pass, 0 fail, 22 skips) | 223 tests total. 22 skips are genuinely Windows-only tests (PowerShell, .NET csc, Win32 desktop switching). All shared policy and Mac tests passed. |
| Native compilation & contract | Passed | `scripts/macos-native-check.mjs` verified shared state codec, canonical approval fingerprint, sensitive action classification, kernel process birth identity, Stop latches, and POSIX private storage. |
| Bundle, installation, signed update & rollback | Passed | `scripts/macos-install-check.mjs` verified sealed bundle, passive listener, End cleanup, Stop persistence, signed native update, rollback to prior release, and host settings preservation. Verified installed runtime with `scripts/verify-install.mjs`. |
| Provenance | 155 / 155 entries match | Updated `UPSTREAM.json` with `node scripts/check-provenance.mjs --write`. |
| Passive startup, HUD & status | Passed | `ready` returns active `native-macos` runtime, `permission_mode: standalone`, `guardian_running: true`, `controls_visible: true`, without competing controllers. |
| Human OS grants and app approval/denial | Passed | Accessibility, capture, listen/post permissions tested. Standalone app approval dialog verified; human denial cleanly returned `permission_denied` with incident ID `b04638131bda18532bcdf7b5`. |
| Second complete task after End | Passed | Listener cleanly reuses after `end` without Antigravity restart. |
| External monitor & physical Esc | Pending hardware / physical human | Physical Esc during held/queued input requires physical keypress on keyboard; secondary display requires external monitor hardware. |

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
