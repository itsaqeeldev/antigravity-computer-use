# Antigravity Computer Use

Give Antigravityâ€™s existing agent real Windows desktop control through **/computer-use**. Inspect applications, move the real cursor, use accessible controls, type, scroll, drag and work with native dialogs. A minimal control bar and breathing edge glow show when control is active.

**Windows beta under final qualification.** The direct v0.3.0 bundle is not published yet. Public v0.2.0 uses the older MCP route. Remaining checks are listed below.

## How it works

Antigravity makes the decisions. A supported global skill sends commands through private local IPC to a Node/C# Windows runtime, which returns screenshots and accessibility evidence. The App manages the background process through its [documented Sidecars feature](https://www.antigravity.google/docs/sidecars/).

No MCP is required. No separate LLM, model subscription, browser extension or additional model credentials. Screenshots still go to the model/provider selected in Antigravity. This is an independent project, not a Google, OpenAI or Anthropic product.

## Install on Windows

When qualified, the complete portable ZIP and SHA256 checksums will be available on the [releases page](https://github.com/shayann07/antigravity-computer-use/releases). Normal bundle installation needs no compiler or Python. Use Windows x64 with the standard .NET Framework runtime.

1. Extract the complete Windows bundle.
2. Run the following from its folder:

   ~~~powershell
   .\install.cmd --integration direct --sidecar
   ~~~

3. Allow a few seconds for Antigravity to load the Sidecar. Open a fresh **No Project** or project conversation and select **/computer-use** from slash autocomplete.
4. Describe the application task and the result to verify.

The installer pins the skill and Sidecar to the exact release, verifies the payload, preserves unrelated configuration and creates rollback backups. Its private per-user location defaults to **D:\AntigravityComputerUse-&lt;owner-hash&gt;** when available, otherwise LocalAppData. It does not change host security presets or register a Windows login task. Only this projectâ€™s old MCP entry is removed.

Use **--workspace "D:\Projects\Example"** for a project-local skill that can reuse the global companion, or **--target &lt;private-path&gt;** for another installation location. See [installation, updates, verification and rollback](docs/INSTALLATION.md).

If App-managed startup is unavailable, the printed **Start Computer Use.cmd** starts the pinned controller from the normal Windows desktop. Agent Manager terminal jobs were observed on an isolated **exebox** desktop even with Turbo selected; launching a controller there cannot supply visible-desktop access. The runtime refuses that context rather than switching desktops or bypassing host security.

## Permissions and stopping

Standalone native approval is the default: approve an application once per control session, then review sensitive effects separately. Grants bind to executable, process identity and creation time. The model cannot approve its own native dialogs or supply confirmation flags.

An operator who wants host-managed execution review can explicitly install:

~~~powershell
.\install.cmd --integration direct --sidecar --permission-mode host-managed
~~~

This trusts the hostâ€™s terminal execution permissions instead of duplicate native dialogs. **It does not inspect or authenticate Antigravityâ€™s Turbo preset.** The agent must obtain the review required by the host/user for consequential actions. Broad terminal allow rules grant broad desktop authority. Native identity, frame, budget, ownership and watchdog checks stay active.

- **Keep working** is the default. Ordinary physical mouse/keyboard input does not pause automation. Use the barâ€™s Pause control deliberately.
- **Yield on input** is optional. Resume requires local human Resume or an explicitly authorized chat resume under host-managed policy. Observations are refreshed; interrupted input is not replayed.
- **Esc / Ctrl+Alt+F12 / Stop** invalidates control and releases automation-held input. Emergency Stop requires local human re-arm; the model cannot clear it.
- Normal tasks use **end**. The passive Sidecar remains available for another task without restarting Antigravity. **shutdown** performs cleanup and exits for updates/removal.

Use one active desktop task at a time. One physical Windows desktop has one cursor and keyboard; this does not provide independent virtual-desktop or concurrent-conversation isolation. Authentication, security surfaces, UAC and secure desktop are human handoffs. See [SECURITY.md](SECURITY.md).

## Reliable observation and input

Each observation supplies one-use references. Actions revalidate the app identity and target, and return evidence for verification. Accessible controls are preferred; custom canvases use coordinates from an actual viewed screenshot. Screen scaling, monitor origins and screenshot mapping are handled centrally.

Compact named flags, selective screenshots and small ordered batches reduce round trips. Repeated **--step** groups need neither JSON quoting nor temporary plan files. Every step is validated first; batches observe between actions and stop on failure or uncertain delivery. Section queries include their actual child controls.

**fit_window** explicitly restores/fits an approved window to its nearest display work area and invalidates old observations. Unreachable physical endpoints, including display gaps, are refused before cursor travel; both drag endpoints are checked before mouse-down. Valid negative monitor origins remain supported.

Native typing is bounded. Explicit clipboard-preserving paste supports larger text. Filename paste commits the field and refuses Save/Open if readback does not match. Unpreservable clipboard formats are refused. Completed or uncertain input is never automatically retried merely because verification failed.

Only one direct controller can own a private data folder. OS-owned synchronization prevents competing starts and releases on process death; ownership loss stops control. Local timing receipts omit typed text, clipboard contents, raw accessibility trees and capabilities. There is no project telemetry.

## What has actually been tested

Real tasks in Antigravity App 2.26 on Windows exercised the global skill, actual screenshot viewing, native file pickers, Upscaly AI PNG/JPEG export, settings restoration, Unicode Notepad saves and repeat sessions. Independent file, database and NCNN checks distinguished actual AI inference from software resizing. The managed Sidecar survived a real fifteen-minute idle interval and recovered from an idle parent crash.

Controlled native tests additionally cover provider exceptions without fallback replay, offscreen-window recovery, stale frames, input cleanup and ownership failures. These component tests do not replace actual application acceptance. Current Windows source checks report **137 passed and 5 explicitly skipped** locally and in CI. The skipped installation-ACL cases require trusted ancestors; parent permissions are never changed to force a pass; [validation](VALIDATION.md), [current status](PROJECT-STATUS.md) and [performance findings](docs/PERFORMANCE.md) record exact build boundaries.

Remaining qualification includes physical Esc/re-arm on the final native build, real mixed-DPI/multiple-display hardware, broader application coverage and final visual feedback. The latest real High-effort tasks took **4m29s PNG** and **4m33s JPEG**. PNG improved from a previous 5m26s witness and used15 instead of 25 controller calls; JPEG was slower than an earlier 3m56s witness. These individual runs include application GPU-profile repairs and do not establish a general speed guarantee. Host/model decision gaps remain the main latency problem. macOS/Linux are not release targets yet.

## Build and contribute

Source builds require Windows x64, Node **24.20.0** and the inbox .NET Framework compiler:

~~~text
npm test
npm run bundle
~~~

The output is **dist/AntigravityComputerUse-windows-x64**, including Node and prebuilt helpers. Use **node scripts/bundle.mjs --output &lt;new-empty-folder&gt;** to preserve previous artifacts. Do not run interactive native integration scripts while someone else controls the desktop.

[Review guide](docs/review-guide.md) Â· [Contributing](CONTRIBUTING.md) Â· [Implementation log](IMPLEMENTATION_PROGRESS.md)

## Historical demo and interface

![Historical real Antigravity v0.2.0 fixture recording](docs/media/real-demo.gif)

[Real-time excerpt](docs/media/real-demo-realtime.mp4) Â· [4x recording](docs/media/real-demo-4x.mp4) Â· [Recording details](docs/media/REAL-DEMO.md). This is an actual older fixture task, not the current direct integration or Upscaly acceptance run.

[Minimal interface preview](docs/media/desktop-1.png) Â· [Actual text-cursor capture](docs/media/live-text-cursor.png) Â· [Visual design](docs/visual-design.md). Renderer previews are labelled separately from live application evidence.

## License and provenance

MIT. The foundation is the published MIT native implementation from **ridelink0/claude-computer-use**, with attributed adaptations from OpenAIâ€™s MIT sample and Anthropicâ€™s MIT quickstarts. [UPSTREAM.json](UPSTREAM.json) records exact revisions, local hashes and modifications; [third-party notices](THIRD_PARTY_NOTICES.md) retain the licenses. No private vendor implementation is included. Development binaries are unsigned.

[LICENSE](LICENSE) Â· [SECURITY.md](SECURITY.md)
