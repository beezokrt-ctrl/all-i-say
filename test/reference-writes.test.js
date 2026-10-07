import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { exportAll } from "../js/storage/export.js";
import { importAll } from "../js/storage/import.js";
import { comparableRecords } from "../scripts/fixtures/gate-b-archive.js";

const archive = () => new IndexedDBArchiveRepository({ name: "references", indexedDB: new IDBFactory() });
const provenance = { origin: "author", createdAt: "2020-01-01T00:00:00.000Z" };

for (const missing of ["fromId", "toId"]) {
  test(`Relation rejects missing ${missing} without writing`, async () => {
    const repository = archive();
    await repository.createUtterance({ id: "known", text: "  Known\n<& 🪶  " });
    const before = await comparableRecords(await repository.getExportSnapshot());
    await assert.rejects(() => repository.createRelation({
      id: "invalid", fromId: "known", toId: "known", [missing]: "missing", type: "responds-to", provenance,
    }), /missing utterance/);
    assert.deepEqual(await comparableRecords(await repository.getExportSnapshot()), before);
  });
}

for (const missing of ["artifactId", "utteranceId"]) {
  test(`Transcription rejects missing ${missing} without writing`, async () => {
    const repository = archive();
    await repository.createUtterance({ id: "known", text: "Original" });
    await repository.createArtifact(new Blob(["bytes"]), { id: "photo" });
    const before = await comparableRecords(await repository.getExportSnapshot());
    await assert.rejects(() => repository.createTranscription({
      id: "invalid", artifactId: "photo", utteranceId: "known", [missing]: "missing", text: " Reading ", provenance,
    }), /missing (artifact|utterance)/);
    assert.deepEqual(await comparableRecords(await repository.getExportSnapshot()), before);
  });
}

test("valid historical references preserve exact records through export and restore", async (t) => {
  const previous = globalThis.FileReader;
  globalThis.FileReader = class {
    async readAsDataURL(blob) {
      this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
      this.onload();
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.FileReader;
    else globalThis.FileReader = previous;
  });
  const source = archive(), restored = archive();
  await source.createUtterance({ id: "old", text: "  Old\n<& 🪶  " });
  await source.tombstoneUtterance("old", "synthetic history");
  await source.createArtifact(new Blob([Uint8Array.from([0, 255, 13])], { type: "image/png" }), { id: "photo" });
  await source.createRelation({ fromId: "old", toId: "old", type: "returns-to", provenance });
  await source.createTranscription({ artifactId: "photo", utteranceId: "old", text: "  Separate\n<&  ", provenance });
  await source.createTranscription({ artifactId: "photo", text: "No utterance link", provenance });
  const before = await comparableRecords(await source.getExportSnapshot());
  await importAll(restored, JSON.parse(JSON.stringify(await exportAll(source))));
  assert.deepEqual(await comparableRecords(await restored.getExportSnapshot()), before);
});

for (const kind of ["Relation", "Transcription"]) {
  test(`${kind} checks references and writes in one transaction`, async () => {
    const repository = archive();
    await repository.createUtterance({ id: "old", text: "Before" });
    await repository.createArtifact(new Blob(["source"]), { id: "photo" });
    const db = await repository.open();
    const original = db.transaction.bind(db), transactions = [];
    db.transaction = (names, mode, ...rest) => {
      transactions.push({ stores: [names].flat().sort(), mode });
      return original(names, mode, ...rest);
    };
    try {
      if (kind === "Relation") {
        await repository.createRelation({ fromId: "old", toId: "old", type: "returns-to", provenance });
      } else {
        await repository.createTranscription({ artifactId: "photo", utteranceId: "old", text: "Reading", provenance });
      }
    } finally {
      db.transaction = original;
    }
    const stores = kind === "Relation" ? ["relations", "utterances"] : ["artifacts", "transcriptions", "utterances"];
    assert.deepEqual(transactions, [{ stores, mode: "readwrite" }]);
  });
}
