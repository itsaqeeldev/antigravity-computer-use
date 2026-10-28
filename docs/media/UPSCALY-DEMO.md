# Real Upscaly demo recording

Recorded 28 October 2026 in the actual Antigravity Agent Manager App, using only
the installed direct custom controller for the Upscaly task. The owner manually
submitted the final task because the controller deliberately blocks its host UI.
The stock Codex controller was stopped before this final capture. Its purple
cursor highlight is absent from the public clip.

The visible blue edge glow, working bar and pointer are the actual native UI.
The target was the verified Upscaly **1.0.9** stable executable, not 1.1. The owner
selected the sample-data folder and authorized a different portrait for this
recording. Input: 700×1124 JPEG, SHA256
`7e64c3c98015ed6da27f2deb32c83f9c396ef137c339e3b23bb2464dafb406d1`.

## Task and independently checked result

Antigravity used the General Real-World model (`realesr-general-x4v3`) at 4×,
exported PNG, dragged the real before/after slider, restored settings and ended
control. The image was already marked Done at task start; the app ignored the
initial upscale attempts. Antigravity recovered through the GUI by re-importing
the sample. Those unsuccessful attempts remain in private raw footage/receipts.
They are not presented as successful processing in the edited excerpt.

The fresh PNG fully decoded as **2800×4496 RGB**, 14,171,211 bytes, SHA256
`f846a3934a00d603a7fcf0b840d70f63ced0621148acdbd0ced2170710de05a4`.
An independent process observer saw the stable app's `realesrgan-ncnn-vulkan.exe`
start at **13:31:50.876 UTC**, PID 20724, during this export. Its executable SHA256:
`07e49f7cbb4ede01ae4dd4c399d3a7e5846e3d2085c3128eff881e55cb7b1a0c`.
This is bounded evidence for this native-engine run, not a general fallback or
hardware qualification claim.

The final task receipts span `30048.6` through `30048.32`; End was recorded at
13:33:35.672 UTC. Physical clicks and the slider drag succeeded. Long host gaps
and recovery overhead remain: this is not evidence that orchestration latency
has been solved.

## Exact controller identity

The installed recording candidate reports version `0.3.0-beta.2`, build
`eec4740b3d76830f55c97c727a529dce54d126b995b494f6b98c046426d3fa0f`.
Native source SHA256:
`a6697556950aef2eb1d7629fb10dd2d8b10430ff21cecec7744e6aeadcebfe4e`.
The native recording-preference change is in source commit `7815cc2`.
It is newer than the published beta.2 bundle (`23ddd7…`); do not claim identical
installed and published manifests. The existing installer rollback backup was
preserved. After the task, control was idle and recording inclusion was disabled.

## Edit record

Private raw capture: 1920×1080, 30 fps, approximately 480 seconds. The public
MP4 retains the full screen and plays each retained segment at **1× speed**:

| Source seconds | Content |
| --- | --- |
| 124–129 | Physical settings interaction with active native chrome |
| 303.5–306.7 | Pointer approaches the real file-open control |
| 318.5–323.5 | Newly imported sample |
| 331.5–345.5 | Physical Upscale click, native processing and completion |
| 371.5–379.5 | Real comparison-slider drag |
| 437–441 | End releases the native controls and glow |

The silent MP4 is 39.27 seconds, 1920×1080. The README GIF is a 720-wide,
12 fps, 12-second preview of MP4 ranges0–4,23.2–27.2 and27.2–31.2seconds.
Each retained action still plays at normal speed. Setup, host UI, waiting, unsuccessful initial attempts and
the private file picker are omitted. There is no replacement cursor, synthetic
glow or reconstructed app UI. Full-screen and dense cursor-motion contact sheets
were visually reviewed. Re-editing requires another privacy and motion review.

Earlier black-window and stock-highlight-contaminated captures remain private
failure evidence under `.localdata/demo-capture-fix-20261028/`. The previous
cropped 3× excerpt hid the glow/control bar and has been replaced. The older
fixture recording remains documented separately in [REAL-DEMO.md](REAL-DEMO.md).
