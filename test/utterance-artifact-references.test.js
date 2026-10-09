import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { comparableRecords } from "../scripts/fixtures/gate-b-archive.js";

for (const response of [false, true]) {
  test(`${response ? "Response" : "Utterance"} rejects a missing source artifact without any write`, async () => {
    const archive = new IndexedDBArchiveRepository({ name: "source-refs", indexedDB: new IDBFactory() });
    await archive.createUtterance({ id: "target", text: "Original" });
    const words = { id: "new", text: "  New\n<&  ", source: { artifactIds: ["absent"] } };
    const before = await comparableRecords(await archive.getExportSnapshot());
    await assert.rejects(() => response
      ? archive.createResponse(words, { toId: "target", type: "responds-to", provenance: { origin: "author" } })
      : archive.createUtterance(words), /missing artifact/);
    assert.deepEqual(await comparableRecords(await archive.getExportSnapshot()), before);
    await archive.createArtifact(new Blob(["source"]), { id: "absent" });
    const saved = response
      ? (await archive.createResponse(words, {
        toId: "target", type: "responds-to", provenance: { origin: "author" },
      })).utterance
      : await archive.createUtterance(words);
    assert.equal((await archive.getUtterance(saved.id)).text, words.text);
    assert.deepEqual(saved.source.artifactIds, ["absent"]);
  });
}
