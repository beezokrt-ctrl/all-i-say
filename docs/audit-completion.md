# Audit completion and the next path

Status: builder verification complete; independent review and phone acceptance open.
No merge, deployment, release tag, or new stacked PR is authorized by this document.

## Reproducible review target

App and tests: commit 1a97808131c2fc11f0591938268c7c384300e1b7 on audit-completion.
The following documentation/CI commit changes no app code.
Base for the six integrated repair commits: 20b7ec774e1262b6e860870d2eafa1b781a16054.

Review the real diff:
https://github.com/beezokrt-ctrl/all-i-say/compare/20b7ec7...1a97808

No PR was opened because the author's no-fifth-stacked-PR rule remains binding.
The author chooses the merge path for #20–#23. Parked proposal/readings work is
not silently included or rebased.

## Evidence per repair

| Claim | Test/evidence | Failing-first result |
| --- | --- | --- |
| Shared response vocabulary | test/response-types.test.js | Gate C1 evidence retained in its original commit |
| Ordinary relation vocabulary enforced | test/relation-vocabulary.test.js | Unknown type was accepted before the fix |
| Source artifacts must exist | test/utterance-artifact-references.test.js | Utterance and Response cases both failed before fix |
| Say capture is atomic | test/atomic-capture.test.js | Missing operation failed first; duplicate final insert now rolls back all records |
| Exact legacy capture, neutral classification | test/capture-exactness.test.js | Both paths trimmed the expected whitespace before fix |
| UI failure retains draft; retry creates one capture | scripts/atomic-capture-browser.cjs | Deliberately writing an artifact outside the transaction failed with 1 !== 0; mutation reverted |
| Complete history and artifact bytes survive backup | test/gate-b-round-trip.test.js; scripts/gate-b-browser.cjs | Gate B history-skipping mutation evidence retained in Gate B commit |

Touched runtime files: data/schema.js; js/app.js; js/services/artifacts.js;
js/services/legacy.js; js/services/relations.js; js/services/responses.js;
js/storage/indexeddb.js; js/storage/repository.js; js/store.js;
js/views/responses.js; sw.js. Test files are listed above.

Ran on the candidate: npm test (96 passing); mobile Chromium at 320px and
390px; eight surfaces; offline reload; keyboard navigation; 200% text; axe;
real backup/restore controls; IndexedDB upgrade/recovery; Gate B round trip.
Existing tests were not weakened to pass. Browser attachment test opens the
actual attachment panel before interacting with its controls.

Not run: physical iPhone, Safari, VoiceOver, personal archive restoration.
Not obtained: independent Claude sign-off, author phone acceptance.
GitHub CI success must be checked on the exact head; local results do not certify it.

## Invariant inspection

- Exact text is stored without trim; remaining trim calls validate emptiness.
- No text update or hard-delete path was added.
- Canonical transcription provenance is explicit; machine capture is rejected.
- Services call repository operations. Compound capture is one transaction.
- Existing artifact references are read and checked inside that transaction.
- Existing historical classifications are not rewritten.
- Database/export versions are unchanged; no runtime dependency or private seed.
- Shell version was bumped; no new runtime module needs cache registration.

## Next slice after gate approval: durable drafts

This is a testable handoff, not approval to bypass the freeze or add a store.
Current response drafts live in AllISayApp.responseDrafts, an in-memory Map.
Say holds unsaved input in the page. Neither survives a process restart.

Requirements for the next implementation:

1. Keep unfinished Say and response text separate from canonical archive entities.
   Restoring a draft must never create an Utterance, Relation or export entry.
2. Preserve exact characters, selected response type and target id; a response
   draft must never reopen against a different target.
3. Persist as input changes, not only during unload. Do not promise protection
   against OS termination until actual iPhone testing verifies the behavior.
4. Use a separate draft repository interface. Storage choice and any new store
   require the author's approval and an ADR before implementation.
5. Clear only the submitted draft revision after canonical commit succeeds.
   A failed save retains it; new typing during a save must not be cleared.
6. Treat committed-save, draft-cleanup and view-refresh failures separately so
   retrying cleanup or rendering cannot duplicate already committed words.
7. Specify attachment handling before claiming a whole capture survives reload.
   Text-only recovery must not imply that an unsaved photograph survived.
8. Prove reload recovery, failed-save retention, double-tap protection,
   cross-target isolation, export exclusion and concurrent-edit retention.

This prepares the index path: encounter exact words, open their context, respond,
and return without losing unfinished text or navigation position. Index matches
remain derived references; they never become author-declared Relations by lookup.
No Name, Composition, new relation vocabulary or index view is implemented here.
