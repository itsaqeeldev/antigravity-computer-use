# README media

`hero.svg` is original, editable vector branding for this repository. It is not
a screenshot or a product capability demonstration. `social-preview.png` is its
1280×640 raster derivative, prepared for GitHub's repository social-preview field;
the file's presence alone does not mean that field has been configured.

The README's actual task recording is separately labelled as historical v0.2.0
evidence; see [REAL-DEMO.md](REAL-DEMO.md). Do not replace its provenance with
claims about the current direct integration or real Upscaly acceptance.

The PNGs are exported by the production `DesktopVisuals` renderer using `node scripts/render-visuals.mjs docs/media`. They are clean interface renders, not captures of the owner's desktop.

`demo.html` is an eight-second illustrated workflow composed with HyperFrames 0.8.186. Render with:

```text
npx hyperframes@0.8.186 render docs/media --composition demo.html --format gif --fps 15 --output docs/media/demo.gif
```

The animation illustrates the interaction sequence and changes between the native active and paused artwork. It is not evidence of live input execution. Real integration verification is documented in ../../VALIDATION.md. All artwork is from this project's MIT implementation. No private photos, recordings, credentials, or desktop captures are included.
