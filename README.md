# Antigravity Computer Use

[![Windows checks](https://github.com/shayann07/antigravity-computer-use/actions/workflows/windows.yml/badge.svg)](https://github.com/shayann07/antigravity-computer-use/actions/workflows/windows.yml)

[Download Windows beta](https://github.com/shayann07/antigravity-computer-use/releases/tag/v0.2.0) · [Installation guide](docs/INSTALLATION.md) · [Changelog](CHANGELOG.md)

Native Windows desktop tools for **Antigravity Agent Manager** and its existing LLM. Invoke **`/computer-use`** to inspect apps through accessibility and screenshots, move the real cursor, type, click, scroll and drag. A click-through screen-edge glow and compact control bar show when control is active. An original native dart cursor and breathing ice-blue glow restore on pause/stop; see [visual design](docs/visual-design.md).

This is a fork/adaptation of the published MIT `ridelink0/claude-computer-use` native implementation, with attributed OpenAI recovery and Anthropic sizing/batching adaptations. See `UPSTREAM.json` and `THIRD_PARTY_NOTICES.md`. It is not the proprietary Codex/Claude product engine.

## Status

Windows x64 beta. Tested in the real Antigravity Agent Manager across two consecutive desktop sessions, plus native fixtures and human Smart takeover/Resume. macOS and Linux are not supported release targets yet. See [validation](VALIDATION.md).

## Install

Download and extract the Windows portable ZIP from [GitHub Releases](https://github.com/shayann07/antigravity-computer-use/releases), or build `dist/AntigravityComputerUse-windows-x64` from source. Double-click **install.cmd** or run it in a terminal. Node and prebuilt native helpers are included: no Python, compiler, model key or new subscription is needed.

The installer uses `D:\Tools\AntigravityComputerUse` when D: exists (otherwise a per-user LocalAppData folder). It installs the global skill and merges its own MCP entry while preserving existing servers/settings. Each release has a separate directory; previous configs/skills are backed up under `backups/<timestamp>`. An optional `--workspace <path>` scopes configuration to one project. `--target <path>` changes installation location.

Refresh MCP servers or restart Antigravity after first installation. Open any workspace and invoke `/computer-use`. If the installed host does not discover global skills, explicitly ask it to read the installed `SKILL.md`; MCP image/tool delivery must still be available. The default target is Agent Manager: `~/.gemini/config/mcp_config.json` and `~/.gemini/config/skills/computer-use/SKILL.md`. Legacy IDE/CLI profiles are changed only when `--legacy-profiles` is explicitly requested.

Full instructions: [installation, update, rollback, removal and troubleshooting](docs/INSTALLATION.md).

Example first task: `/computer-use Open my disposable text document, type Hello, and verify the text. Stop before saving.`

## Permissions and controls

The installed integration uses Antigravity's **global security preset and MCP permissions**. Antigravity reviews or allows the tool call before it reaches this server. There are no duplicate native popups in this path. On Windows, Antigravity currently uses its older permission engine: an unconfigured MCP tool may still ask even with Turbo selected. Approve this server once at the desired host scope, using `mcp(antigravity-computer-use/*)`. See [Google’s platform-specific permissions](https://antigravity.google/docs/permissions). The installer does not change the selected preset or add blanket allow rules. The agent follows the host's review policy and the user's task scope for sensitive effects. Standard MCP does not expose an authenticated per-call preset value, so the server does not pretend to read Turbo independently.

App/session grants still bind to actual executable path, process ID and creation time. Sensitive operations use native one-use capabilities bound to their effect and identity. These are issued by the trusted broker for host-authorized calls. Model-supplied approval flags, permits, modes and session overrides remain rejected. A batch is authorized as one MCP invocation, not separately by the host for each substep.

For use outside an authorizing MCP host, start with `AGCU_PERMISSION_MODE=standalone` (the direct-source default). That mode retains local human application/sensitive-action dialogs. The mode is trusted startup configuration and cannot be switched through a tool call.

**Esc**, **Ctrl+Alt+F12**, or **STOP** invalidates pending work and releases held input. The native guardian can terminate its registered input worker independently of Node/the LLM. **Manual pause is the default:** ordinary mouse/keyboard activity does not interrupt. The control-bar menu offers **Smart takeover**, which ignores tiny pointer jitter and pauses on deliberate clicks, typing, scrolling, or sustained motion. The human selection is remembered. Resume/Re-arm is a local human action. Normal completion uses `computer_end`; a second task does not require restarting Antigravity.

Native checks enforce session state, expiry, app identity and action capabilities. Ending a task cannot clear a human pause or latched emergency stop. They do not form an OS sandbox against other programs or an agent with unrestricted shell access under the same Windows account. Unknown visual semantics cannot be perfectly classified: the LLM must declare sensitive effects and apply the host review policy. Native checks independently classify known controls, keys, clipboard and broad-access apps, but do not duplicate host approvals in host-managed mode. Use a separate account/VM for important data. Password/authentication/security surfaces and UAC are human handoffs.

Screenshots/UI text go through Antigravity to its configured provider. The tool has no telemetry service or separate model connection. Provider/host retention still applies. Do not enter secrets. Capture exclusion hides control overlays; unsupported capture exclusion uses temporary hiding.

## Tools

`computer_apps`, `computer_grant`, `computer_snapshot`, `computer_move`, `computer_click`, `computer_type`, `computer_set_value`, `computer_key`, `computer_scroll`, `computer_drag`, `computer_focus`, `computer_close_window`, `computer_clipboard`, `computer_launch`, `computer_open`, `computer_file_dialog`, `computer_run`, `computer_end`, `computer_pause`, `computer_stop`, `computer_status`.

Cursor travel eases to its exact destination before clicking (120–600 ms according to distance; instant for tiny moves or reduced motion). Four common Windows cursor roles use the custom dart; app-owned and resize cursors remain application-controlled.

Snapshot coordinates are returned-image pixels. Every action uses a one-use observation, native process identity and physical geometry; window movement requires re-observation. Batches run 1-8 predictable steps and stop on first failure. Sessions default to 10 minutes/200 input attempts. Multiple monitors and negative coordinates are supported by the mapping; actual monitor/DPI configurations must be validated before claiming coverage.

## Develop and validate

Requires Node 22+ and Windows' .NET Framework C# compiler for building from source. Production bundles use the prebuilt helper.

```text
npm test
npm run build
node tests/native-integration.mjs
node tests/guardian-integration.mjs
node tests/host-managed-integration.mjs
node tests/parent-crash.mjs
node tests/motion-integration.mjs
node tests/cursor-recovery.mjs
npm run bundle
```

Native tests operate disposable fixture windows. The direct native fixture grant file is a test double; the host-managed suite explicitly selects trusted host authorization and is not evidence of Antigravity's own permission engine. Guardian tests grant no app access and only activate the overlay and emergency-stop chord. Native component results do not prove an actual Antigravity model completed a task. See `VALIDATION.md` for current evidence and pending acceptance.

Rollback: run the bundled Node with `scripts/rollback.mjs <exact-backup-folder>/rollback.json`. Stop the MCP server before updates/rollback. Old installed release folders are deliberately preserved. Release binaries are currently unsigned.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [review guide](docs/review-guide.md). MIT licensed; upstream copyrights and licenses are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an independent compatibility project, not affiliated with Google, OpenAI or Anthropic.
