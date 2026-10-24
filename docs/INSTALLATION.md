# Installation, update and removal

Version 0.3.0-beta.1 is a direct `/computer-use` candidate with bundled native helpers. Its release is still draft while real Agent Manager latency is repaired; public download is pending. The historical v0.2.0 uses the older MCP route; do not confuse its recording or download with this rework.

## Windows portable bundle

1. Once qualified, download the complete Windows ZIP and SHA256 checksums from [releases](https://github.com/shayann07/antigravity-computer-use/releases). Source builds use Node 24.20.0 and the Windows compiler: `npm test`, then `npm run bundle`. Release packaging can use `node scripts/bundle.mjs --output <new-empty-folder>` to preserve previous output.
2. Extract/copy the complete `dist/AntigravityComputerUse-windows-x64` folder. Its prebuilt helper and Node are required; normal installation needs no compiler, Python, new model account or credentials.
3. Run `install.cmd`. Direct integration is the default. The installer prints the release and exact backup paths.
4. Start a fresh Antigravity App conversation, invoke `/computer-use` and describe the task. The skill calls its pinned local script, opens returned screenshot files and uses native input. No MCP restart is required for this route. An old already-running MCP server may remain in an old conversation until the host refreshes; do not mix both controllers.

```powershell
.\install.cmd --target "D:\MyPrivateComputerUse" --integration direct
.\install.cmd --workspace "D:\Projects\Example" --integration direct
```

Private-storage candidate default: `D:\AntigravityComputerUse-<owner-hash>` when available, otherwise the current user's LocalAppData. The printed directory is stable for the Windows account. A writable/renamable parent such as an inherited shared `D:\Tools` is rejected; parent/global settings are never changed. Choose a private direct-drive or user-profile folder for `--target`. App skill location: `~/.gemini/config/skills/computer-use`. Project location: `.agents/skills/computer-use`. These match [the official App documentation](https://antigravity.google/docs/skills).

The installer verifies manifest file hashes before making changes and refuses to update a live service. A short `cu.mjs` entrypoint with bundled `cu-node.exe` calls the exact installed script without command-shell forwarding. Node uses a hard link to the immutable payload where supported, otherwise a copy. Project-local launchers have separate names so they cannot redirect an existing global skill. Updates and rollback preserve both launcher files alongside the skill and installation pointer. `verify-install.mjs` checks the launcher pin and Node bytes as well as the payload. Only this project's old MCP entry is removed during direct migration. Other servers, host security preferences and unrelated configuration survive. Backups are kept under `backups/<timestamp>`. `--legacy-profiles` is optional and never enabled implicitly.

## Permission policy

Direct installations default to standalone native app/session and sensitive-operation dialogs. To rely on the host's terminal execution review instead, the operator can explicitly use:

```powershell
.\install.cmd --integration direct --permission-mode host-managed
```

This does not read or change Antigravity's Turbo preset. The host agent is responsible for required user/sensitive-effect review before running the script. Broad terminal grants grant broad desktop authority. Native identity, frame, budget, watchdog and Stop checks remain active. The mode is fixed deployment configuration, not a model-controlled action flag.

Keep working is the default: normal physical mouse/keyboard activity does not pause. The bar's optional Yield on input mode pauses on deliberate input. Soft Resume follows local human Resume or, in host-managed mode, an explicit user message. Esc/Stop always requires local human re-arm; never restart a service to bypass it. Windows virtual desktops share one mouse, keyboard and active screen capture.

## Verify an installed development bundle

```powershell
.\node.exe .\scripts\verify-install.mjs "D:\MyPrivateComputerUse"
```

This checks manifest files, the pinned skill and the chosen integration. It does not perform desktop actions or establish real application qualification. `status` reports the running build ID; a new build refuses to silently reuse another version's active service.

## Update and rollback

Finish and `end` active tasks first. Use the currently installed direct command's `shutdown` to close the helper, then install the replacement. Each install gets an immutable release folder; user deployment policy and skill command paths are generated separately. Ordinary direct updates retain the previously chosen approval mode unless explicitly changed. The private-storage candidate detects known prior deployment roots, preserves Stop and takeover preferences across a move, and never copies old capabilities/permits. Existing roots/backups remain recoverable. First migration from the historical location should explicitly select the intended permission mode; do not infer a Turbo token.

```powershell
.\node.exe .\scripts\rollback.mjs "D:\MyPrivateComputerUse\backups\EXACT-TIMESTAMP\rollback.json"
```

Use the exact printed backup path. Rollback restores this project's prior entry/skill and installation pointer while preserving unrelated host configuration edits. Existing older backup formats may lack the installation pointer record; inspect the restored skill when using one. Release folders remain recoverable.

## Optional legacy MCP

`--integration mcp` registers the compatibility adapter. Its default policy remains host-managed; standalone can be selected explicitly. Only this route requires refreshing/restarting the host's MCP server. The direct skill does not call this adapter.

## Removal and troubleshooting

End/shutdown control. Remove only this project's MCP entry if present and its global/project skill. After processes exit, remove only the chosen installation folder if desired; retain backups for recovery. Never delete the whole `.gemini` or `.agents` folder.

- Missing slash command: verify the intended App global/project skill path, then open a fresh conversation.
- Missing screenshots: open the returned actual `image.path` with the host image viewer. Text alone is not visual verification.
- Animation/old frame: use a fresh snapshot with `settle_ms:600` or wait for expected visible text. Never repeat the preceding input merely because its first image was transitional.
- Refused filename: `file_dialog_path_mismatch` means the tool sent no Save/Open confirmation. Inspect the actual dialog; explicit `entry_method: clipboard` uses temporary clipboard-preserving filename paste when authorized. It is not a model approval flag or silent fallback. Unicode/emoji Save, longer ASCII/space Save As and Unicode-path Open passed on native3d; retain the original keyboard-stream failure as a separate result.
- Wrong desktop/minimized: discover with `include_hidden:true`, focus only the intended app and inspect fresh pixels.
- Different running build: end/shutdown the old owned session before starting the new build; do not interrupt someone else's task.
- Elevated app/UAC/security surface: human handoff. No normal-user bypass is supported.
- Cursor roles: common arrow/link/text/app-starting roles are temporary custom cursors; app-owned and resize shapes remain app-controlled.

Specific real Agent Manager tasks and installed human Stop/re-arm checks now have records. Broader application, hardware and release qualification remain open. See VALIDATION.md; passing an installer or fixture test does not prove ordinary-task reliability.
