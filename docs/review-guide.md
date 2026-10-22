# Review guide

Start with `server/runtime.mjs`, `mcp.mjs`, native `Guardian.cs`, `CursorSafety.cs`, and modified `AxonHost.cs`. `DesktopVisuals.cs` and Guardian-specific `Overlay.cs` paths implement presentation. `scripts/install.mjs` and `rollback.mjs` preserve configuration. Bundles exclude `upstream-index.mjs` and unused upstream modules.

The trust boundary is an authorizing Antigravity MCP host plus fixed stdio startup configuration. Standard MCP provides no trusted Turbo claim. Host-managed mode receives already-authorized invocations; tool arguments cannot switch modes. Standalone mode uses native human dialogs. Native identity/state/expiry/capability checks remain in both. Same-user unrestricted shell access is outside this boundary.

Prioritize stop races, queued/batch cancellation, one-use capabilities, process identity, coordinates after window/DPI changes, UIA failures, held-input cleanup, watchdog death and rollback after unrelated changes. Ending must never re-arm stop. Observe actual outcomes rather than trusting input success.

Run documented `tests/` on an interactive Windows desktop. Read `VALIDATION.md` before declaring acceptance. Hardware coverage, actual Agent Manager task, host Ask/Deny, code signing and remote CI are separate from component passes. Upstream `tools/` scripts are retained references, not claims of more passing replacement tests.

Revisions, licenses and byte hashes are in `UPSTREAM.json`, `THIRD_PARTY_NOTICES.md`, and `licenses/`. Visual/cursor artwork is original code. Owner photos/video and private local evidence are excluded from public source bundles.
