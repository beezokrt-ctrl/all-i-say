# All I Say

All I Say is a local-first archive of one person's actual words. The record and interpretations of the record are deliberately separate.

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
