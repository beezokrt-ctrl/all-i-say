# iPhone test hosting

The test build is hosted at https://all-i-say-iphone-test.netlify.app/.
Netlify project ID: `3d7927be-5270-4ce0-82ab-be73b56e84b2`.

The deployed app starts empty. Archive content stays in the visiting browser's
IndexedDB; there are no server functions, archive uploads or cloud sync.
The public site contains only application files and build metadata.

The initial build uses main commit `eb6afb74d35f5a58af20f2a2b35bd03324561afa`
plus the mobile hosting-layout fix. Check `/build-info.json` for the deployed
source revision. This is a test build, not the v1.0 tag.

Publish only `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `icons/`,
`js/`, `data/schema.js` and `LICENSE` from the selected Git revision. Exclude
local archives, dependencies and test fixtures. The deployment's netlify.toml
uses `publish = "."`, with `Cache-Control = "no-cache"` for `/sw.js` and
`/index.html`. No build command or app framework is needed.

Use the same site address for subsequent tests so the browser keeps the same
archive origin. Export before changing origins; a different deployment URL has
separate local storage. The service worker waits for old app windows to close
before activating an update.

Netlify injects a floating badge on this hosting plan. On mobile, the app reserves
its observed 64px collapsed height when that iframe is present, so the badge
cannot cover navigation. The badge remains visible and functional. If the badge
is absent or removed through its own Hide control, normal spacing returns.

## Device check

Open in Safari, save a disposable test entry, and try every surface. Check the
Say keyboard, Inspect Back, and the placement sheet. Use Share → Add to Home
Screen, wait for "Ready for offline use", then test airplane-mode reload and
reopening. Confirm the test entry remains. Download a backup and find it in Files.
Emulated Chromium checks do not replace this real-iPhone pass.
