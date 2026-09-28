# ADR-009: A committed recovery copy before a database upgrade

Status: proposed with the release-hardening PR.

## Problem

The old IndexedDB open handler modified stores without a backup and inspected
the request's nonexistent oldVersion property. Older temporal fields could
therefore miss conversion. Portable v2 imports also discarded those fields.

## Decision

During versionchange, collect every existing store's keys, raw values and index
definitions. Blob values remain original bytes. Commit this snapshot to a
separate IndexedDB database named `<archive-name>-upgrade-recovery`, in its
`snapshots` store, before any schema or record modification in the source.
A harmless count request keeps the source transaction alive while this independent
commit completes. Apply schema changes inside its next request callback.

If copying fails, abort the source transaction. Validate each transformed
Utterance; a transformation failure rolls back all source changes while keeping
the already committed recovery copy. New empty installations need no recovery
copy. Merely reopening the current version does not create copies.

Both old database migration and portable import share the legacy temporal
conversion. Preserve display labels and original text; never infer spoken time
from recording time. Database version 5 and portable export format 3 stay
unchanged: this repairs the existing upgrade path, with no new canonical stores.

## Consequences

The upgrade temporarily requires space for another full archive. Insufficient
space blocks the upgrade instead of risking an unbacked transformation.
Recovery copies are local to the same origin and can also be evicted; they do
not replace downloaded backups. They are retained without automatic cleanup.

Recovery snapshots are raw database evidence, not portable JSON exports.
Recovery is currently a technical operation: preserve the recovery database,
inspect the chosen snapshot's version and stores, then restore to a separate
database using those store definitions and key/value pairs. Do not overwrite
the only surviving archive. No automatic rollback UI is introduced.

Tests cover commit-before-schema-write ordering, byte preservation, rollback on
backup failure, rollback on invalid transformed data, current-version reopening,
and both accepted portable export versions. Chromium also exercises the real
IndexedDB upgrade path. Real Safari validation remains a release gate.
