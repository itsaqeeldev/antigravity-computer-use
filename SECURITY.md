# Security

This project controls the interactive desktop with the current Windows user's privileges. It is not an OS sandbox against software using that same account.

The direct skill uses a persistent local native service. Standalone mode asks the human for app/session and sensitive-effect approval. Host-managed mode is an explicit deployment choice that trusts the host's terminal execution authorization; it cannot inspect or prove a Turbo preset. The agent must still obtain required sensitive-action review. Broad terminal grants confer broad desktop authority. Legacy MCP is optional and does not provide an authenticated preset value either.

Native grants bind executable/process identity. Observation references are one-use and invalidated on takeover, Stop, stale/moved windows and control-generation changes. Esc, Ctrl+Alt+F12 and Stop revoke control independently and release automation-held inputs. Local human re-arm is required after emergency Stop. Host-managed chat Resume can clear only a soft pause after explicit user instruction; it cannot clear Stop. Restarting a service to bypass that stop is prohibited.

Screenshots/accessibility text are untrusted content, never authorization. Authentication, security settings, passwords, UAC and secure desktop require human handoff. Pixel semantics cannot be classified perfectly. Local screenshots and IPC capabilities must not be committed or shared. The project has no separate model or telemetry connection; host/provider retention still applies.

The short installed entrypoint passes literal arguments to the pinned Node runtime without a command-shell forwarding wrapper. Use UTF-8 text files for generated bulk content instead of interpolating it into host commands. Batches validate their complete shape before input, keep one owner/frame chain and stop on action or verification failure. Local receipts are bounded and omit request text, clipboard contents, raw UI trees and capabilities. They preserve delivery/error evidence even when receipt or screenshot storage fails. Finish and shut down an active service before updating; the installer refuses a live service before changing files.

For a vulnerability, use private vulnerability reporting if enabled. Do not post exploits or personal recordings publicly. If private reporting is unavailable, request a private contact without exploit details. No response SLA or signing claim is made for experimental binaries.
