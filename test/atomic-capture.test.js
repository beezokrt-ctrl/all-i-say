import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { comparableRecords } from "../scripts/fixtures/gate-b-archive.js";

test("capture commits bytes, transcription and exact words together; failed retry leaves no partial records", async () => {
  const archive = new IndexedDBArchiveRepository({ name: "capture", indexedDB: new IDBFactory() });
  const text = '  words\n"<& 😀  ';
  const blob = new Blob([new Uint8Array([0, 255, 42])], { type: "image/png" });
  const data = { text, id: "words" };
  const transcription = { text: "  read\n ", provenance: { origin: "author" } };
  const saved = await archive.createCapture(blob, { id: "photo" }, data, transcription);
  assert.equal((await archive.getUtterance("words")).text, text);
  assert.deepEqual(saved.utterance.source.artifactIds, ["photo"]);
  assert.deepEqual([...new Uint8Array(await (await archive.getArtifact("photo")).blob.arrayBuffer())], [0, 255, 42]);
  assert.equal((await archive.listTranscriptions())[0].text, transcription.text);
  const before = await comparableRecords(await archive.getExportSnapshot());
  await assert.rejects(() => archive.createCapture(blob, { id: "retry" }, data, transcription));
  assert.deepEqual(await comparableRecords(await archive.getExportSnapshot()), before);
  await assert.rejects(() => archive.createCapture(blob, {}, { text }, {
    text: "machine", provenance: { origin: "ai", model: "test" },
  }), /pending Suggestion/);
  assert.deepEqual(await comparableRecords(await archive.getExportSnapshot()), before);
});
