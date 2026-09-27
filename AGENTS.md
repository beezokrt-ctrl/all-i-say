# AGENTS.md — All I Say

All I Say is a personal archive of one person's actual words. Preserve distinctions between evidence, declaration, and interpretation.

## Non-negotiable invariants

1. `Utterance.text` is immutable once created. Corrections are new Utterances plus Relations; never add an update/edit path.
2. Artifact, Transcription, Utterance, Annotation, Interpretation, Relation, Constellation, and Suggestion remain distinct entities.
3. AI operates only through `js/services/ai/aiGateway.js` and writes pending Suggestions, never canonical records directly.
4. Relations, Annotations, Constellations, and Memberships require explicit provenance. Constructors must never silently attribute missing provenance to the author. Machine provenance requires model and confidence where meaningful.
5. Deletion is tombstoning by default. Permanent purge must be explicit and confirmed. Membership withdrawal is not deletion and preserves the assertion history.
6. Views and services use the repository interface, never a storage adapter directly.
7. Migrations back up before writing, validate all transformed records, and fully no-op on failure.
8. Do not add a framework, build system, TypeScript, or backend without an ADR in `docs/adr/`.
9. Serif is for utterance text, sans-serif for UI chrome, and monospace for metadata/provenance.
10. Motion must serve Drift, Between, Record, Say, or Library and respect reduced motion.
11. Constellations gather words without owning them. Membership is an assertion of placement, may be multiple, and must never be inferred into canonical state automatically.

Before opening a PR, check that no text update path, silent deletion, storage bypass, unvalidated field, unbacked migration, or unapproved dependency was introduced.
