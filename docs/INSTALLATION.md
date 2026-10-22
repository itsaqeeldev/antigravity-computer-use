# Installation and removal

## Portable Windows bundle

1. Install Antigravity Agent Manager on Windows x64.
2. Download the Windows ZIP from [GitHub Releases](https://github.com/shayann07/antigravity-computer-use/releases). During development, build it with `npm run bundle`.
3. Extract the ZIP completely. Run `install.cmd` from its extracted folder. Administrator access, Python, a compiler and separate model credentials are not required.
4. In Antigravity, open Customizations → Installed → MCP Servers. Restart `antigravity-computer-use`. Confirm Ready and 21 enabled tools.
5. In a conversation, invoke `/computer-use`, then describe an ordinary desktop task. Begin with a disposable document.

The default installation is `D:\Tools\AntigravityComputerUse` when D: exists, otherwise `%LOCALAPPDATA%\AntigravityComputerUse`. Configuration goes to `%USERPROFILE%\.gemini\config\mcp_config.json`; the global skill goes under that folder's `skills\computer-use`. Other MCP entries and host permission settings are preserved.

```powershell
.\install.cmd --target "D:\MyTools\AntigravityComputerUse"
.\install.cmd --workspace "D:\Projects\Example"
```

Project-local installation writes `.agents/mcp_config.json` and `.agents/skills/computer-use` in that project. `--legacy-profiles` is an explicit optional migration setting for older IDE/CLI profiles; the default targets Agent Manager.

## Permissions

Windows Antigravity can ask for MCP permission even with Turbo selected. Approve only the intended server and scope. A server rule is `mcp(antigravity-computer-use/*)`. The installer does not create allow rules. Manual pause is the default; select Smart takeover from the control bar for deliberate physical-input pausing. Esc always stops.

## Update and rollback

Finish active desktop tasks first. Run the new bundle's installer and restart this MCP server. Each installation creates a separate release folder and an exact configuration backup. The installer prints the backup location.

```powershell
.\node.exe .\scripts\verify-install.mjs "D:\Tools\AntigravityComputerUse"
.\node.exe .\scripts\rollback.mjs "D:\Tools\AntigravityComputerUse\backups\EXACT-TIMESTAMP\rollback.json"
```

Use your actual backup path, then restart the MCP server. Rollback restores this project's entry while preserving unrelated configuration changes. Old release folders remain available.

## Remove

End control, disable/remove only `antigravity-computer-use` in Antigravity, and remove only its global or project-local `skills/computer-use` directory. After its processes exit, the installation folder can be deleted. Keep backups if rollback is wanted. Do not delete the whole `.gemini` or `.agents` folder.

## Troubleshooting

- Missing slash command: check that the skill is installed at the intended global/project location and refresh the conversation.
- Server not Ready: check the configured executable exists; extract the complete ZIP and reinstall. Inspect host MCP diagnostics.
- Stopped/paused: use the native human Resume/Re-arm control, then request a fresh observation.
- Hotkey conflict: stop another active controller before starting this one.
- Input denied: elevated apps/UAC and secure desktop are outside normal-user control. Do not bypass them.
- Different cursor on an app: app-owned and resize cursors are not replaced.
