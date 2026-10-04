# AGENTS.md — All I Say

All I Say is a personal archive of one person's actual words. Preserve distinctions between evidence, declaration, and
interpretation.

## Non-negotiable invariants

1. `Utterance.text` is immutable once created. Corrections are new Utterances plus Relations; never add an update/edit
   path.
2. Artifact, Transcription, Utterance, Annotation, Interpretation, Relation, Constellation, Membership, and Suggestion
   remain distinct entities.
3. No AI producer is enabled on this branch. Any future machine output must enter as a pending Suggestion through a
   reviewed gateway, never as a canonical record. The proposal gateway and decision UI remain in an unmerged feature
   stack.
4. Relations, Transcriptions, Annotations, Interpretations, Suggestions, Constellations, and Memberships require
   explicit provenance. Constructors must never silently attribute missing provenance to the author. Machine provenance
   requires model and confidence where meaningful.
5. Deletion is tombstoning by default. Permanent purge must be explicit and confirmed. Membership withdrawal is not
   deletion and preserves the assertion history.
6. Views and services use the repository interface, never a storage adapter directly.
7. Migrations back up before writing, validate all transformed records, and fully no-op on failure.
8. Do not add a framework, build system, TypeScript, or backend without an ADR in `docs/adr/`.
9. Serif is for utterance text, sans-serif for UI chrome, and monospace for metadata/provenance.
10. Motion must serve Drift, Between, Record, Say, or Library and respect reduced motion.
11. Constellations gather words without owning them. Membership is an assertion of placement, may be multiple, and must
    never be inferred into canonical state automatically.

Before opening a PR, check that no text update path, silent deletion, storage bypass, unvalidated field, unbacked
migration, or unapproved dependency was introduced.

## Release verification

- Run `npm test`. Node 22 and the test-only `fake-indexeddb` dependency are used; no runtime dependencies or build
  system.
- Database upgrades must commit a raw copy of every existing store (including original Blob bytes) to the separate
  `<archive-name>-upgrade-recovery` database before schema or record changes. Backup failure aborts the original
  versionchange transaction. Never remove recovery copies automatically.
- Portable backups remain export format 3; imports accept formats 2 and 3. Current database version is 5. These are
  independent version numbers.
- Any cached file change requires a new `SHELL_VERSION`; maintain static and dynamic module coverage in `sw.js`.
- Optional `scripts/release-browser-check.cjs` uses an externally installed Playwright and Chromium. It is mobile
  Chromium emulation, not proof of iPhone Safari behavior.
- Follow `docs/release-v1-checklist.md` before tagging. Do not mark real-device or personal-archive checks passed using
  synthetic fixtures.
- Keep PRs unmerged until the author explicitly authorizes merging. A request to continue or prepare a release is not
  merge authorization.
