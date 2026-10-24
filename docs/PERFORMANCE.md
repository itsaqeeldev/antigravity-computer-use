# Performance qualification

The final Agent Manager run of the first beta candidate was cancelled after roughly 8minutes at import, with about 9 desktop actions. It is a latency failure, not acceptance. The release remains draft.

The trace included about 17 separate schema descriptions, model-created request/result files per action, old artifact reads, screenshot copies and 6–35second gaps between operations. Native input time alone does not explain the wall time. Model deliberation, terminal tool scheduling and image viewing are also part of the experience.

## Candidate changes

- Short installer-managed launcher and strict named flags eliminate routine per-action request files.
- One-call multi-schema discovery and skill quick reference remove catalogue setup loops.
- Brief replies omit duplicate metadata. Semantic action replies default to tree-only; pixel decisions still require an actual viewed screenshot.
- Bounded local receipts automatically record service time, gaps, delivery and verification outcomes. They omit text, clipboard data, UI trees, permission reasons and capabilities. Storage failures never hide delivered input.
- Optional launch-and-observe uses only an unambiguous exact launched PID/executable; ambiguity and capture failure preserve launch evidence without inviting relaunch.
- Small batches validate the complete plan first, observe freshly between steps, capture at the final checkpoint and stop on action or verification failure.

## Required comparison

Run a fresh No Project conversation in the real Agent Manager, preserving the selected model and permission preset. Compare the same real Upscaly launch/import prefix, then finish AI PNG export, view the actual output, and complete a second-session Unicode paste/save task. Record total time, model/terminal/image calls, avoidable artifact files, service time and gaps. Keep failed runs intact. Unit/mock timing is not proof of host speed.

Status:88 source tests pass. Installed speed1 build8d9d8082 launched actual Upscaly with its first image in3.7seconds; a two-step real-file import batch took6.8seconds and left no picker. A second real Notepad session refused paused input and the old frame after Resume, then saved an exact1319-unit Unicode sample with clipboard restoration. These are direct controller timings, not Agent Manager wall-time improvement. The stock host-control API could not restore minimized Antigravity; the actual host comparison remains pending human restoration. Hardware-dependent mixed-DPI checks and physical emergency re-arm remain separately scoped.

The short entrypoint uses bundled Node and an exact-release JavaScript import, with no command-shell forwarding. Literal quotes, percent signs, metacharacters, Urdu and emoji are covered by an executable argv regression. Project-local launchers are isolated from the global launcher. Installing over a live service is refused before writes; end and shutdown the task first.

Further direct witness: private2 returned Notepad's exited-starter handoff in1517ms, with the actual window discovered223ms later and no duplicate launch. Earlier runs waited roughly8.5seconds for a window belonging to the already exited starter. This removes that bounded wait without guessing the handed-off process. Explicit filename paste then saved exact Unicode content in a2932ms command. Actual Agent Manager call/gap/wall-time comparison remains required.

## Actual Windows host finding (24 October)

Agent Manager terminal processes were attached to an `exebox` desktop while the visible input desktop was `Default`, even with Turbo selected. Detached children also died between ordinary terminal calls. A foreground service in a host background task survived independent calls but its launched app was hidden and UI Automation failed. These failed attempts are retained; process lifetime alone was not the fix.

A native read-only desktop preflight now refuses mismatched/unavailable input desktops before app operations. Starting the pinned local companion on the normal desktop allowed the real global `/computer-use` skill in a fresh No Project conversation to import Upscaly media, perform native RealESRGAN AI PNG export, restore settings and finish normally. Independent file/database/engine checks confirmed PNG1920x1320 and actual NCNN inference23468ms. This task took roughly five minutes; its successful completion is not a claim that remaining latency is solved. Most native actions were400-900ms, with6-35second gaps between decisions and one30second wait. Model deliberation, image viewing and host task delivery still dominate.

The next candidate adds opt-in App Sidecars for host-managed local process lifecycle, and a passive listener that releases idle control while remaining available for the next session. Sidecars are documented at https://www.antigravity.google/docs/sidecars/ . Registration, rollback and idle Pause/Stop preservation have component tests; actual App-managed startup must be verified separately. No desktop switching, WMI recovery or host security changes are used.
