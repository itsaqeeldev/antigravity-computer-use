# Real desktop task recording

Captured locally on 23 October 2026 (Asia/Karachi), using Antigravity Agent Manager's existing Gemini model and the published v0.2.0 native MCP runtime. A new no-project conversation invoked the global `/computer-use` skill. The target was a fresh instance of the repository's `tools/make-target.ps1` disposable WinForms fixture. No manual fixture changes were made during the recorded sequence.

Task: discover and snapshot the test window, focus it, enter `Hello from Antigravity`, physically click Press Me twice and verify `pressed:2`, toggle I agree, select Blue, and end normally. The recording shows the app effects through Blue selection; it does not establish normal completion or the subsequent physical Esc stop. The Send Payment button is an inert fixture and was outside the task.

## Capture and edits

- FFmpeg gdigrab captured only the target window by its title at 20 fps, with mouse drawing enabled. The source capture was 680×526 and 240 seconds, silent.
- A single continuous excerpt from source time 102s through 238s is retained. No interior action cuts or reordered frames.
- Crop: `552:422:0:0`, removing black capture padding. The result contains only the disposable app's client area, not the owner's files, sidebar, project names or conversation.
- `real-demo-realtime.mp4`: the 136-second excerpt at original speed, H.264/yuv420p.
- `real-demo-4x.mp4`: uniform 4× speed, with an explicit speed label in added top padding. Encoded at 20 fps; duration approximately 34.6s due to frame timestamp rounding.
- `real-demo.gif`: the same sped-up MP4 converted to 10 fps with a generated palette for inline GitHub display.
- The window-only capture excludes the native screen-edge glow/control bar. It demonstrates task execution, not overlay appearance. See the separately labeled native-rendered frontend images for the latter.

The private original remains outside Git under `.localdata`. Only the reviewed app-only excerpts are public. The raw capture and final excerpts were visually checked for all task changes and unrelated content before upload.
