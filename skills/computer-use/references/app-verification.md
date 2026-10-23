# Application verification workflow

Start from the user's accepted requirements, actual source revision and running binary. Keep engine, UI and real execution-path coverage separate. Make a table of feature, GUI actions, output oracle, result and evidence; keep failed/blocked/not-run distinct.

For Upscaly, preserve the accepted IDs: F01 ROI/two-model comparison; F02 dimensions/print; F03 enhancement amount; F04 DNI denoise; F05 video ranges/samples; F06 clipboard; F07 recipes/mixed selection; F08 folders/sessions; F09 pause/resume; F10 protection; F11 still-image face restoration; F12 export/metadata/naming.

1. Start the existing development build and its required frontend server. Inspect the actual window and identify the source revision. Do not substitute a browser mock for the native application.
2. Import a disposable image through Choose files or the real file dialog. Verify that it appears on the canvas/queue.
3. Set an output directory dedicated to this test. Verify the observed field, including whether a textbox, browse dialog or settings persistence owns it. Preserve the owner's prior value for restoration.
4. Begin with a small deterministic export: 0% enhancement, 1x sizing, PNG. Start once. Wait for a terminal outcome. Inspect the produced file's dimensions, signature and pixels against the input/baseline.
5. Exercise JPEG/WebP, exact sizing, enhancement and naming separately. Inspect file bytes and properties; correct labels alone are insufficient.
6. Test preview/ROI, comparison, sliders, scrollable drawers and canvas gestures using actual screenshots. Keep semantic and pixel fallback available. Before/after UI quality requires matched views of the baseline and current revision.
7. Test denoise and face restoration on real authorized media and installed/consented models. Do not automate acceptance of model licenses. Distinguish missing weights, incompatible runtime, inference failure and a controller failure.
8. Test clipboard, recipes, mixed selection, queue cancel/retry and recovery with isolated test state. A pause must not restart completed work or resubmit the batch. Video tests need short disposable media and inspection of actual duration/frame selection/audio output.
9. On an application defect, record the exact trigger, observed result and output. Fix source only within the authorized repository scope, rebuild and rerun that GUI scenario. Do not replace the failing scenario with a fixture that merely tests the helper.
10. Close the control session normally; restore test-modified preferences. Report what actually ran. Remaining external hardware/Store tests remain explicit.
