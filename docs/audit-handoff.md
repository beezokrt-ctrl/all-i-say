# Audit handoff — All I Say

## Review scope

Review the complete unmerged stack from `main` through `proposal-history`, plus each phase's own diff. Recheck GitHub branch heads and PR states first; do not assume this note freezes them. No merge is authorized by this handoff.

| Phase | Branch | Base |
| --- | --- | --- |
| Search sees Places (PR #7) | next-phase | main |
| Explicit reading provenance (PR #8) | readings-boundary | next-phase |
| Separate reading persistence (PR #9) | readings-persistence | readings-boundary |
| Readings beside exact words (PR #10) | readings-encounter | readings-persistence |
| Machine proposals and author decisions (PR #11) | suggestion-decisions | readings-encounter |
| Proposal history and connection integrity | proposal-history | suggestion-decisions |

The history phase starts at `d2a28bb6b7d878db1cb2e9ca57949794975c6943`. PR #13 was a duplicate and is closed as superseded by #11.

## Latest changes

- Inspect retains accepted/rejected relation proposals with original model metadata, exact referenced words, direction, decision time, and any recorded reason.
- Reciprocal links connect the original proposal/decision and its author Relation. A withdrawn Relation remains visibly withdrawn; its earlier acceptance remains recorded.
- Accepted-pair validation checks endpoints, relation type, direction, canonical ID, author provenance, and reciprocal Suggestion ID. Model/confidence must remain on the Suggestion.
- Both portable preflight and the atomic repository import validate incoming pairs and references to existing records. Direct Relation creation cannot invent a Suggestion source link.
- Explicit `status: undefined` now includes history. The former destructuring defaults excluded decided Suggestions and withdrawn Relations from export. The same fix preserves tombstoned Utterances, retired Constellations, and withdrawn Memberships.
- Constructors retain existing tombstone/withdrawal metadata on import. No database migration, provider execution, dependency, or build system was added.

## Evidence and limits

Run `npm install --ignore-scripts` then `npm test`. At preparation, 72 tests pass, including actual IndexedDB-adapter behavior through fake-indexeddb, atomic rollback, export/import round trips, tampered links, partial imports, and bound Accept/Reject actions refreshing the real Inspect service/view.

A browser visual check was attempted but Chromium could not be downloaded in the execution environment. The interaction tests use the app's event bindings and a minimal document stub; they are not a substitute for a mobile/desktop browser review. Check layout, keyboard navigation, fragment links, focus, and refresh behavior.

Malformed development exports with inconsistent accepted pairs are rejected; this phase does not invent provenance or silently repair them. Optional rejection reasons are supported by the decision API and displayed when present; the Reject button still records a decision without asking for a reason.

## Audit priorities before choosing the next direction

1. Check every creation/import route against AGENTS.md, especially canonical writes, explicit provenance, immutable Utterance text, and source/decision references.
2. Exercise history export/import with artifacts, uncertain dates, withdrawals, tombstones, and conflicts. Check older format compatibility and migration backup behavior separately.
3. Check whether all relevant malformed Suggestion payloads and metadata receive sufficient validation, including pending and rejected proposals.
4. Review the distinction between author assertion and machine proposal in Inspect, Between, and stored entities. No opening of a view should execute a model or infer a canonical relation.
5. Inspect the artifact experience: the photograph must remain available alongside its separate transcription. Current Inspect artifact markup displays metadata; broader artifact encounter work remains outside this phase.
6. Evaluate Relation encounters, which still primarily show endpoint IDs. Exact-word navigation is a possible next direction after this audit.

Report findings by severity with file locations and reproducible behavior. Separate defects from product choices that require the author's judgment. Recommend direction after reviewing the full stack, without merging it.
