# Historical exporter fixtures

These files contain **synthetic test content only**, never personal writing.

- export-v2.json was emitted by the original IndexedDB repository and exporter
  at commit fa72762 (Stabilize v3 archive integrity).
- export-v3.json was emitted by the original IndexedDB repository and exporter
  at commit 17ac0e0 (first-class constellations).

Both historical revisions were extracted with git archive and executed under
Node with fake-indexeddb. The original constructors, storage adapters and
exportAll functions generated these JSON files without modification. FileReader
was supplied only to encode Blob bytes in Node.

Each archive includes exact whitespace, unknown/month chronology, a synthetic
artifact byte sequence, separate Transcription and Relation; v3 also includes
Constellation and Membership. Tests import the emitted files into today's
repository and compare every record plus artifact bytes.

These prove actual historical-export compatibility. They do not establish that
any particular personal backup is complete; omissions made by old exporters
cannot be recovered from a file that never contained those records.
