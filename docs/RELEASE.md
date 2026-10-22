# Release checklist

- Run `npm test` and `npm run build` on Windows. Run native tests sequentially on an interactive disposable desktop; human tests require real human input.
- Refresh UPSTREAM.json modification hashes without changing original upstream hashes. Retain all licenses.
- Use Node 24.20.0 with its recorded license for `npm run bundle`.
- Verify the bundle manifest, install into a test destination, run `scripts/verify-install.mjs`, and test update/rollback.
- Package source without .git, .localdata, dist, node_modules, logs, private recordings or personal screenshots. Package the portable folder separately.
- Inspect ZIP contents and publish SHA-256 checksums with release assets.
- Create the intended public GitHub repository, enable private vulnerability reporting, and run its Windows workflow before labeling CI verified.
- Publish the source tree and portable ZIP only after reviewing repository identity, license attribution and release notes. Signing is not currently configured; do not claim signed binaries.
- Record hardware coverage precisely. Physical mixed-DPI/multi-monitor validation remains outstanding.

Public repository: https://github.com/shayann07/antigravity-computer-use. Release assets must correspond to a commit whose Windows checks passed.
