# Reliability rework — 2026-10-23

The owner reports ordinary task failures, unexpected stopping, poor cursor/glow quality, and intrusive tool/output-file handling. The prior completion/launch framing was premature. Controlled fixture results remain evidence only for their specific flows.

## Confirmed in source

- MCP dispatch converted every cancellation notification into a latched emergency stop, without matching a live request. Fixed locally to match active request IDs; emergency-stop tools and physical Esc remain intact.
- Transport repeated the accessibility controls as both a rendered tree and structured elements, with duplicated image metadata. Compacted locally while preserving the image content block and observation indexes. This may reduce output volume; it does not prove the host will stop producing output artifacts.
- Each action automatically re-observes and captures a screenshot, adding latency. This needs measurement on normal apps before redesign.
- Observation expiry is 90 seconds and session lifetime is 10 minutes/200 attempts. Host reasoning/permission delay can interact with these limits. Changing timeouts without failure evidence is not a reliability fix.
- Stop/paused state is deliberately latched. There is no evidence yet identifying which stop path caused the owner's ordinary-task failures. Human Resume is different from normal task completion.

## Integration investigation

Google documents skills as instruction packages with optional executable scripts, and MCP as a supported custom-tool mechanism. SDK custom tools belong to a custom-agent configuration; that is not evidence they can replace tools in the existing Agent Manager conversation. Investigate a skill + persistent local client/CLI using the same Windows runtime, preserving `/computer-use`, without another LLM. Gate the choice on actual screenshot delivery, latency, cancellation and task reliability in Agent Manager.

The bundled Codex skill in this environment uses `@oai/sky` through a persistent JavaScript runtime with integrated screenshot display. Renaming this project's entry point to a skill cannot reproduce that host integration by itself. No claim that Codex universally avoids MCP is made.

Official references: https://antigravity.google/docs/skills, https://antigravity.google/docs/mcp, https://antigravity.google/docs/sdk/tools.

## Next acceptance gates

1. Reproduce an owner-reported failed ordinary task and capture the actual stop reason, focus/geometry changes and observation timing locally.
2. Compare supported transports with the same task and native helper. Confirm the model can actually inspect the image; a returned image block alone is insufficient evidence.
3. Replace verbose output with compact observations and user-facing activity; measure whether Agent Manager still spills tool results to files.
4. Make pause/recovery understandable and dependable; keep physical stop independent.
5. Rework and review cursor/glow on the physical desktop, rather than relying on offscreen artwork.
6. Validate several un-scripted ordinary app tasks and repeated sessions before a new readiness claim or release.

These fixes are development changes. Do not replace the installed/published runtime or publish a new binary as reliable before the gates above pass.
