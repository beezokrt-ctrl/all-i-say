import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { createRelation } from "../js/domain/relation.js";
import { createTranscription } from "../js/domain/transcription.js";
import { createAnnotation } from "../js/domain/annotation.js";
import { createInterpretation } from "../js/domain/interpretation.js";
import { createSuggestion } from "../js/domain/suggestion.js";
import { createConstellation, createMembership } from "../js/domain/constellation.js";
import { importArchiveFromFile } from "../js/services/export.js";
import { SEED_ENTRIES } from "../data/seed.js";

test("every provenance-bearing constructor rejects missing provenance and an unidentified machine", () => {
  for (const [create, fields] of [
    [createRelation, { fromId: "a", toId: "b" }],
    [createTranscription, { artifactId: "a", text: "transcription" }],
    [createAnnotation, { targetId: "a", text: "note" }],
    [createInterpretation, { targetId: "a", reading: "later" }],
    [createSuggestion, { payload: {} }],
    [createConstellation, { name: "place" }],
    [createMembership, { utteranceId: "a", constellationId: "b" }],
  ]) {
    assert.throws(() => create(fields), /provenance/);
    assert.throws(() => create({ ...fields, provenance: { origin: "ai" } }), /model/);
  }
});

test("stored words survive caller mutation, attempted replacement and tombstoning", async () => {
  const repository = new IndexedDBArchiveRepository({ indexedDB: new IDBFactory() });
  const text = " exact\n words ",
    original = await repository.createUtterance({ id: "immutable", text });
  original.text = "changed";
  assert.equal((await repository.getUtterance(original.id)).text, text);
  await assert.rejects(() => repository.createUtterance({ id: original.id, text: "replacement" }));
  const tombstone = await repository.tombstoneUtterance(original.id, "withdrawn");
  assert.equal(tombstone.text, text);
  assert.equal(tombstone.metadata.status, "tombstoned");
  assert.equal((await repository.getUtterance(original.id)).text, text);
});

test("new archive is empty and machine relation writes cannot create canonical structure", async () => {
  assert.deepEqual(SEED_ENTRIES, []);
  const repository = new IndexedDBArchiveRepository({ indexedDB: new IDBFactory() });
  const snapshot = await repository.getExportSnapshot();
  for (const key of ["utterances", "artifacts", "transcriptions", "relations", "constellations", "memberships"])
    assert.deepEqual(snapshot[key], []);
  await assert.rejects(
    () => repository.createRelation({ fromId: "a", toId: "b", provenance: { origin: "ai", model: "test-model" } }),
    /pending Suggestion/,
  );
  await assert.rejects(
    () =>
      repository.createTranscription({
        artifactId: "a",
        text: "machine",
        provenance: { origin: "ai", model: "test-model" },
      }),
    /pending Suggestion/,
  );
  await assert.rejects(
    () => repository.createConstellation({ name: "machine place", provenance: { origin: "ai", model: "test-model" } }),
    /pending Suggestion/,
  );
  await assert.rejects(
    () =>
      repository.createMembership({
        utteranceId: "a",
        constellationId: "b",
        provenance: { origin: "ai", model: "test-model" },
      }),
    /pending Suggestion/,
  );
  assert.deepEqual(await repository.listRelations({ includeHistory: true }), []);
});

test("file import failure preserves the archive and repeated identical backups are safe", async () => {
  const repository = new IndexedDBArchiveRepository({ indexedDB: new IDBFactory() });
  const original = await repository.createUtterance({ id: "one", text: "preserved" });
  await assert.rejects(() => importArchiveFromFile(new Blob(["{bad"]), { archive: repository }), SyntaxError);
  assert.deepEqual(await repository.getUtterance("one"), original);
  const payload = { exportFormatVersion: 3, utterances: [original], artifacts: [], transcriptions: [], relations: [] };
  const result = await importArchiveFromFile(new Blob([JSON.stringify(payload)]), { archive: repository });
  assert.equal(result.skipped.utterances, 1);
});
