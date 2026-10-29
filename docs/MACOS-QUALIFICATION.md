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
