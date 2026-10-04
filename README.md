# All I Say

All I Say is a local-first archive of one person's actual words. The record and interpretations of the record are deliberately separate.

## Mission

A recursive way to talk to yourself: say something, return to it, respond, and follow the exchange. Each response is new words linked by an explicitly declared relation; the earlier words remain intact.

In Inspect, open **Respond to these words**, write, choose how the response relates, and **Keep response**. Connected words let you follow the exchange in either direction.

## Archive invariants

- `Utterance.text` is immutable. A correction is a new utterance plus a relation.
- Artifact, Transcription, Utterance, Relation, Annotation, Interpretation, Constellation, and Suggestion are distinct concepts.
- Uncertain time stays uncertain. The canonical temporal shape is `{ earliest, latest, precision, display }`; month/year precision is represented as an interval rather than a fabricated exact day.
- Artifact media is preserved separately from any transcription or accepted utterance.
- Deletion is tombstoning by default.
- Storage is accessed through the repository contract.

## Architecture

The app is intentionally framework-free and statically hostable.

- `js/domain/` — entity construction and invariants.
- `js/storage/repository.js` — storage contract.
- `js/storage/indexeddb.js` — browser persistence.
- `js/storage/import.js` and `export.js` — portable archive boundary.
- `js/services/` — application operations.
- `js/views/` and `js/views.js` — rendering.
- `data/schema.js` — validation and schema constants.
- `docs/adr/` — architectural decisions.
- `AGENTS.md` — non-negotiable implementation rules.

## Development

Serve the repository through a static server rather than opening `index.html` as `file://`.

```sh
python3 -m http.server 8080
```

Tests use Node's built-in test runner and add no runtime dependency:

```sh
npm test
```

## Content and licensing

The software source is MIT-licensed. Personal writing/archive content is not part of that grant and should not be committed to the public source tree. New installations therefore begin with an empty archive. Personal archive data should move through the app's local storage and explicit export/import path.

See `docs/adr/007-licensing-boundary.md`.

## Backups and offline use

Use **Back up now** to export the full archive, including artifact files and preserved history. Confirm that the JSON file appears in Files or Downloads and keep a copy outside this browser. “Last backup exported” records a download request, not proof that the file was saved. Use **Import a backup** to restore a JSON export. Import adds records atomically and never overwrites existing words. Identical existing records are skipped; conflicting records stop the whole import.

Under **Storage & offline access**, request browser storage protection and check that the page says **Ready for offline use**. On iPhone, open the same HTTPS address in Safari, then use Share → Add to Home Screen. Keep backups even if storage protection is granted.

The service worker caches only static app files. Updates wait until all old app windows close. Before publishing any changes to cached files, bump `SHELL_VERSION` and maintain `SHELL_ASSETS` in `sw.js`; tests verify that the app's local module dependencies are covered. See ADR-008 for durability boundaries and the device test checklist.

## Release status and upgrade recovery

Release preparation is tracked in [the v1.0 checklist](docs/release-v1-checklist.md).
A passing automated suite does not establish real iPhone compatibility.

Existing database upgrades first commit a raw recovery copy, including original
artifact bytes, to a separate local recovery database. Copy or validation failure
aborts the upgrade. Recovery copies remain on the same browser origin and are
not a substitute for an external backup. See
[ADR-009](docs/adr/009-upgrade-recovery.md).
