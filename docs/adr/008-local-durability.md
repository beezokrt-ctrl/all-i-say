# ADR-008: Local durability, explicit backups, and an offline shell

Status: proposed with the release-hardening PR.

The archive remains local to the browser and origin. Durability has three distinct parts: an external backup file, a browser persistence request, and an offline application shell. None establishes a server copy or a guarantee against deletion.

## Backups

Back up now takes one readonly repository snapshot across every archive entity store. It includes artifact Blobs, all statuses, and history. Blob encoding happens after the transaction completes so asynchronous file reads cannot end a live transaction early. Views and services use the repository interface.

The full JSON file retains export format 3 on this branch. A separate receipt in the existing metadata store records the snapshot time, download-request time, and filename only after download handoff. It is not a canonical archive entity or part of the portable archive. Failure to write a receipt does not undo a requested download. The UI says “Last backup exported,” asks the author to check Files/Downloads, and never claims that the file was saved. A visible link allows a second, direct user click when browser download policy requires one.

Adding an archive store in a future phase must extend the snapshot and export/import format together. The store-coverage test guards against a new store being silently omitted. The parked reading/Suggestion stack must reconcile this before it lands.

## Browser storage

The app checks persisted() and offers an explicit persist() request. Unsupported APIs, denied requests, and failures remain normal states. A persistence grant does not replace a backup. The receipt uses existing IndexedDB metadata; no database-version bump or data migration is needed.

## Offline and updates

A manifest and PNG icons support standalone installation. The service worker preloads an allowlist of static application files under its own scope. It never stores archive exports, artifact bytes, private paths, third-party responses, or arbitrary network responses in Cache Storage. System font fallbacks keep the app usable when remote fonts cannot load.

Each shell uses its own versioned cache. Installation fails if any required asset fails. Navigation and modules use the same cached version. Updates wait for old windows to close; they do not force a reload or replace an unsaved editor. Activation removes only old All I Say shell caches for this scope and never touches IndexedDB. Serve through HTTPS (localhost is suitable for development), preserve the origin across deployments, and do not move an existing archive to another hostname accidentally.

For every release that changes cached files: update SHELL_VERSION in sw.js, maintain SHELL_ASSETS, and run the offline tests. The dependency-closure test catches missing local modules. No bundler or runtime dependency is introduced.

## Verification before release

- Export and restore an archive containing photos, transcriptions, tombstones, withdrawals, and uncertain dates; compare exact records and artifact bytes.
- Exercise download failure, receipt-write failure, denied persistence, unsupported APIs, and repeat clicks.
- On a real iPhone, verify Save to Files, Add to Home Screen, offline relaunch, and archive continuity at the deployed origin. Desktop tests do not establish iPhone behavior.
- Verify offline cache installation, scope isolation, excluded URLs, and updates while an editor is open.
