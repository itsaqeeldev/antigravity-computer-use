# Validation boundary — 2026-10-22



The old Python draft's 55 tests do not validate this replacement.



| Check | Latest local result | Scope |

|---|---|---|

| `node --test tests/*.test.mjs` | 34 pass | Real stdio, schemas/forged flags, bounded input, stale/one-use observations, negative origins, image sizing/content, batches, lifecycle latches, preserving install/update/rollback |

| `tests/native-integration.mjs` | 12 pass | Actual C# UIA/Unicode/real click/capture; native denials, identity change, hung-operation termination, pause/revocation |

| `tests/host-managed-integration.mjs` | 11 pass | Native image, hover, accessible/pixel click, Unicode/emoji, drag/wheel, owned dialog, two identities, second session, end/activate cannot bypass stop |

| `tests/cursor-recovery.mjs` | 7 pass | Glow actually animates; system-arrow pixels change; pause restores; hard UI crash independently revokes/kills/restores; watchdog crash triggers stop/restore |

| `tests/guardian-integration.mjs` | 5 pass | Native control UI, no-app glow, global stop chord, revocation, worker termination |

| `tests/parent-crash.mjs` | Pass | Killing fixture Node parent terminates native helper through Windows watchdog |

| `tests/human-acceptance.mjs` | Earlier human pass | Standalone app Allow and sensitive Deny; no input on denial; normal finish. Predates host-managed UX and new visuals. |

| `tests/physical-escape.mjs` | Human pass, including cursor restoration | Physical Esc, native revocation and worker exit. Revised harness additionally checks restored cursor pixels. |

| `scripts/render-visuals.mjs` | Pass, images inspected | Renderer primitives at 100/125/200%; center/falloff alpha assertions. Offscreen artwork, not a physical-screen capture. |



Tests create disposable fixtures and close them afterward. Direct native grant files are test doubles, not human consent. The host-managed suite explicitly selects operator-authorized mode; it does not test Antigravity's permission engine. Injected stop chords do not count as physical human Esc. Cursor tests send no application input and grant no apps.



Observed through Codex computer use in actual Agent Manager: Turbo selected; `/computer-use` Global skill listed; MCP Ready with 21 tools in the earlier build. The final build has 21 tools including `computer_move`. Actual model dispatch/image/action acceptance through Agent Manager is pending. The separate IDE does not count as Agent Manager evidence.



Negative origins/image mapping are automated coverage; physical mixed-DPI/multiple-display hardware remains unverified. Native fixtures ran on the existing 125% desktop. Unicode/emoji round trips do not claim complete IME/script editing coverage. UAC/secure desktop remains a human handoff.



The provided GitHub source workflow has not run remotely. Old `tools/*-test.mjs` scripts are attributed upstream references for its original protocol, not additional passing replacement tests.



Do not call the complete release acceptance-verified until actual Agent Manager and remaining human/hardware checks have records. Private local evidence under `.localdata/` is excluded from source releases.


2026-10-23: Added persisted automation-owned input recovery and 7 failure/partial-delivery cases; real sampled motion and mid-drag stop passed. Minimal graphite/ice-blue frontend installed. Project-local update/rollback test passed. Actual Agent Manager continuation dispatched against fresh fixtures; final result pending.

## Actual Agent Manager result — 2026-10-23

The updated installed runtime ran in the existing no-project Desktop Acceptance Task Automation conversation. Fresh fixture processes 24220 and 20984 were selected. The live UI showed Unicode text, drag events, checkbox toggle, owned-dialog workflow, and a second session writing Second session verified. The final report showed computer_end returned idle with restart_required false; computer_status showed idle, empty approved_apps, host-managed and manual. The native fence independently read idle. No host restart between the two sessions.

Antigravity reported zero failures. Its scroll step used UIA scroll_pattern (value 0 to 7), not a wheel action; actual wheel delivery remains covered by the native fixture suite. This distinction is retained. Sensitive Allow/Deny and physical Esc have earlier human/native records, not new host-policy tests. Physical Smart takeover/Resume subsequently passed with the owner. Mixed-DPI hardware and public CI/signing remain outside completed evidence.

2026-10-23 human verification: Smart takeover and Resume PASS. Physical input paused control, cleared observations and blocked fresh observation while paused. Human Resume restored control; the old observation was rejected, a fresh screenshot succeeded, and normal completion returned idle. Evidence: .localdata/smart-takeover-live/result.json. This supersedes earlier pending Smart takeover/resume statements.

Final packaging checkpoint (2026-10-23): includes minimal graphite/ice-blue controls, eased cursor, owned-input cleanup, Manual/Smart modes, real Agent Manager two-session acceptance and human Smart takeover/Resume evidence. Remaining external validation: physical mixed-DPI/multiple displays, remote CI, signing/publication. Earlier pending statements above are historical checkpoints.

Open-source review, 2026-10-23: input lease acquisition now fails closed instead of continuing without serialization. Added regression coverage, contributor/security guidance and complete installation/removal documentation. The new source/bundle supersedes the previously installed build; publishing and remote CI remain pending.
