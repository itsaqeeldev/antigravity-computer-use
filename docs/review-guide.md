# Review guide

Start with `server/runtime.mjs`, `desktop-service.mjs`, `desktop-tools.mjs`, `scripts/desktop.mjs`, native `Guardian.cs`, `CursorSafety.cs`, and modified `AxonHost.cs`. `DesktopVisuals.cs` and Guardian-specific `Overlay.cs` paths implement presentation. `scripts/install.mjs` and `rollback.mjs` preserve configuration. Bundles exclude `upstream-index.mjs` and unused upstream modules.

Direct installs default to standalone mode with native human dialogs. An explicitly selected host-managed deployment instead relies on the host's terminal-execution authorization and fixed deployment configuration. The direct API has no MCP dependency or authenticated Turbo claim. Host-managed mode trusts the host's required review; action arguments cannot switch modes. Native identity/state/expiry/capability checks remain in both. Same-user unrestricted shell access is outside this boundary.

Prioritize stop races, queued/batch cancellation, one-use capabilities, process identity, coordinates after window/DPI changes, UIA failures, held-input cleanup, watchdog death and rollback after unrelated changes. Ending must never re-arm stop. Observe actual outcomes rather than trusting input success.

Run documented `tests/` on an interactive Windows desktop. Read `VALIDATION.md` before declaring acceptance. Hardware coverage, actual Agent Manager task, host Ask/Deny, code signing and remote CI are separate from component passes. Upstream `tools/` scripts are retained references, not claims of more passing replacement tests.

Revisions, licenses and byte hashes are in `UPSTREAM.json`, `THIRD_PARTY_NOTICES.md`, and `licenses/`. Visual/cursor artwork is original code. Owner photos/video and private local evidence are excluded from public source bundles.

Review direct IPC disconnect/timeout cancellation, Unicode stream boundaries, exact running-build binding, native persistent Stop across restart, and normal idle shutdown. Soft chat Resume requires an explicit user instruction and cannot clear emergency Stop. Actual application feedback is recorded separately from fixture assertions.

The latest actual App and physical Stop witnesses are summarized at the top of VALIDATION.md. Keep the original failed Stop-harness cleanup record alongside its separate recovery: passing safety assertions do not convert that run into a clean script exit. The capture hardening case passed locally, but the older suspected cover-pixel leak did not reproduce. Do not present it as an observed regression that fails old code.

For the exact installed-build procedure and human-only steps, see [qualification checks](qualification.md). These interactive checks require exclusive desktop ownership; ordinary automated source tests do not.
