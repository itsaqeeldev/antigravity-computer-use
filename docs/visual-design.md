# Native desktop control presentation

The phone photos and 10.5-second reference video supplied by the owner are the visual reference. The installed Gemini app (Argon High) reviewed the original video on 2026-10-22. Its numerical motion/color estimates are reviewer suggestions, not measured vendor specifications. It misidentified the arrow as a puck; the owner's clear arrow photo takes precedence. No vendor artwork, cursor resources or private code was copied.

The implemented design uses a continuous distance-based ice-blue glow, with a 21-DIP Gaussian spread and a transparent desktop center. There is no opaque cyan border. A 5.2-second sinusoidal brightness cycle runs from 78% to 100% of the cached glow's opacity. The cached surface is reused; it is not regenerated every animation frame. Windows' client-area animation preference disables breathing. Entrance and exit take 220 and 180 ms respectively.

The control bar is 384 by 44 DIPs, centered on the current monitor, with one line of typography, a small state indicator, a settings menu, an icon pause/resume/re-arm control, and a readable Stop control. Real native Button controls retain accessible names and tooltips. Hover feedback is restrained. Its window never takes keyboard focus. Active, paused and stopped states have distinct text and color.

The real Windows system arrow is temporarily replaced with original ice-blue swept-dart artwork and a white outline. It is sized to the system cursor metric and has a defined hotspot. Four common Windows roles (arrow, hand, text and background work) use the dart. Resize and app-owned cursors remain available. A brief 260 ms ripple marks physical clicks. A click-through halo follows the physical hotspot at 60 Hz; the real pointer follows a bounded minimum-jerk path with cancellation checked every frame. This avoids visually reporting a pointer position different from the action's target.

Cursor replacement is armed only after a separate native watchdog acknowledges readiness. Pause, end, stop and process exit restore the configured Windows cursor scheme without profile/registry writes. The watchdog also revokes the input fence, releases inputs and terminates recorded workers if the control UI dies while armed. This does not support simultaneous control by another product that also replaces the system cursor.

Overlays are excluded from captures when supported. `--visual-preview <directory>` exports the same rendering primitives at 100%, 125% and 200% for review without capturing private desktop data. `scripts/preview-glow.mjs` runs a real visual-only preview with zero application grants; Esc closes it.

Remaining validation must distinguish offscreen artwork, native component behavior, physical screen appearance, and an actual Antigravity model task. Mixed-DPI hardware and multi-monitor performance need physical validation; simulated coordinate coverage does not replace it.
