# Qualification checks

Read VALIDATION.md for the latest result. Record the exact installed build ID, native SHA256 and app executable hash before a desktop check. Retain failures as well as successful recovery; do not overwrite a failing receipt with a later passing label.

## Source and installed files

Run `npm test` on Windows. This covers component behavior and native pure-function harnesses; it does not perform a full Antigravity task.

Run `node scripts/verify-install.mjs <installation-folder>` to verify the installed manifest and global skill pin. Compare any project-local skill too. File integrity proves identity, not application behavior.

## Actual Antigravity task

Use the Agent Manager App, a fresh No Project conversation and its registered `/computer-use` entry. Keep existing host settings. Ask it to report the build ID, discover command schemas, launch a real existing app and open an actual returned screenshot in its available image tool. The tested App uses `read_file`; do not assume IDE tools exist.

Exercise both semantic and screenshot-coordinate actions, an owned native dialog and a meaningful application result. Independently inspect produced files for an export task. Verify soft Pause blocks input, authorized Resume invalidates the previous observation, normal End clears grants, and another session works without restarting Antigravity. Never count accessibility text alone as image viewing.

## Installed Stop and physical re-arm

The interactive source harness `tests/installed-stop-resume.mjs` loads the current installation pointer. It requires Windows, an explicitly host-managed installation and an already inspected, idle real app. Reserve the physical desktop; close unrelated work that could take focus.

Create a private JSON file with:

```json
{
  "installation": "D:/Tools/AntigravityComputerUse/installation.json",
  "hwnd": 123456,
  "from": [100, 200],
  "to": [300, 200],
  "evidence": "D:/private-evidence/stop-check"
}
```

The HWND and coordinates above are examples. Replace them with a current discovered handle and harmless coordinates from its actual fresh screenshot. Use an empty canvas; do not drag over files, text or destructive controls. Then run:

```text
node tests/installed-stop-resume.mjs D:/private-evidence/stop-config.json
```

The harness compiles a test-only Stop chord sender. It observes an automation-held mouse button, sends the registered emergency chord, checks cleanup and seven skipped actions, and checks that service replacement cannot clear Stop. It never approves or re-arms control.

When prompted, the human must click local Re-arm, wait for active control, press physical Esc, and click local Re-arm again. The script verifies native state transitions and a fresh observation. Only run when that human is available. A timeout remains a failed/uncompleted check; it is not permission to clear the latch programmatically.

The original dev7 run passed all five safety/human checkpoints but failed its final close call because the test supplied an unsupported argument. The single harness argument was corrected; close/end were recovered separately and the original failure retained. Physical checks were not repeated. Do not report that record as a clean whole-script exit.

## Covered-window capture

`tests/capture-scope-live.mjs <release-folder> <private-evidence-folder>` launches two isolated test processes, grants only the target and checks that target capture contains no blue cover pixels. It changes visible windows and must respect desktop reservations. It requires the Windows compiler for its test fixture; normal installation does not.

The new helper passed this case. The suspected older-helper leak did not reproduce on the tested desktop. That is a limitation of the reproduction, not evidence of a failing-before regression. More display/provider combinations still need testing.

Never publish private desktop images, local capability files, approvals or user data as test artifacts. Hardware mixed-DPI/multi-monitor checks, host Ask/Deny behavior and broad app/model qualification need their own records.
