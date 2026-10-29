# Prompt for the Mac qualification agent

Paste the following into an agent running on the Mac. It is a development task,
not the normal desktop-use skill. The report/PR is the handoff back to this repo.

```text
Qualify and repair Antigravity Computer Use on this Mac.
Repository: https://github.com/shayann07/antigravity-computer-use
Mac candidate PR: https://github.com/shayann07/antigravity-computer-use/pull/1

Read the current PR head and checks before checking out its branch. Preserve
local changes. Create a short-lived repair branch from the candidate. Read
AGENTS.md, HANDOFF.md, docs/MACOS.md, docs/RELIABILITY-IMPLEMENTATION.md,
VALIDATION.md and the shared skill. Documentation is not proof of functionality.

Keep one shared Node runtime, tool API, permission/observation/batch lifecycle,
installer and /computer-use skill. Add no separate agent, model or required MCP.
Record source/installed/running identities, architecture, macOS and Antigravity
versions. Keep all probes and private evidence inside ignored .localdata.

Run source/native checks, build and install the matching candidate in a private
per-user path using the supported installer. Preserve settings, Stop and rollback.
Do not weaken storage guards, change parent ACLs or bypass OS security.

Have the human complete TCC/OS permission prompts and physical re-arm/Stop checks.
Test actual Antigravity /computer-use: ready, visible stopped controls, human
re-arm, discovery, usable screenshot, semantic and real-pointer actions, Unicode,
scroll/drag, Open/Save with independently verified outputs, multiple approved apps
and owned dialogs, approval/denial, physical Esc during queued/held input,
pause/resume, End, a second task, permission revocation, sleep/wake, available
displays and cursor/glow restoration after crashes. Use disposable documents.

Qualify updater authenticity, idle deferral, preserved Stop/config/pins,
failed-start rollback and skill discovery after upgrade. Production releases need
a maintainer-pinned signing key; never create an unsigned bypass to run a test.
Use explicit inert fixtures for cryptographic tests and label their limits.
Never claim that a fixture proves physical input or Antigravity orchestration.

Fix reproducible defects and add meaningful regressions. Preserve unknown input
delivery and no replay. If host UI cannot be controlled through a supported tool,
prepare the exact task for human launch and independently inspect its results.

Maintain tracked docs/MACOS-QUALIFICATION.md with passed/failed/blocked/unrun
checks, build identities, reproduction, changes and evidence references. Keep
screenshots, recordings, personal paths and document content out of public data.

With available GitHub authentication, push the repair branch and create a draft
PR targeting the current Mac candidate branch. Reference PR #1. File deduplicated
sanitized issues for unresolved reproducible defects. These project reports are
authorized. Without auth, prepare commits/report/issue text locally and state
what remains unsent. Do not self-merge or publish a general Mac release.

Return the PR/issue links and tested identities, actual results and remaining
human/hardware blockers. The owner will paste the PR link into the Windows
Codex chat for independent review. Do not claim completion while required
interactive or update acceptance remains unrun.
```
