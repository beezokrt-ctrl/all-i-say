import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { comparableRecords } from "../scripts/fixtures/gate-b-archive.js";

async function fixture() {
  const archive = new IndexedDBArchiveRepository({ name: "history", indexedDB: new IDBFactory() });
  await archive.createUtterance({ id: "a", text: '  Original\n"<& 😀  ' });
  await archive.createUtterance({ id: "b", text: "Other" });
  await archive.createRelation({
    id: "relation", fromId: "a", toId: "b", type: "responds-to", provenance: { origin: "author" },
  });
  await archive.createConstellation({ id: "place", name: "Synthetic place", provenance: { origin: "author" } });
  await archive.createMembership({
    id: "membership", utteranceId: "a", constellationId: "place", provenance: { origin: "author" },
  });
  return archive;
}

const operations = [
  ["withdrawMembership", "membership"],
  ["withdrawRelation", "relation"],
  ["tombstoneUtterance", "a"],
];

for (const [method, id] of operations) {
  test(`${method} preserves first history on repeats and after restore`, async () => {
    const archive = await fixture();
    const first = await archive[method](id, "First reason");
    const before = await comparableRecords(await archive.getExportSnapshot());
    assert.deepEqual(await archive[method](id, "Replacement reason"), first);
    assert.deepEqual(await archive[method](id), first);
    assert.deepEqual(await comparableRecords(await archive.getExportSnapshot()), before);
    const restored = new IndexedDBArchiveRepository({ name: "restored", indexedDB: new IDBFactory() });
    await restored.importAll(await archive.getExportSnapshot());
    assert.deepEqual(await restored[method](id, "After restore"), first);
    assert.deepEqual(await comparableRecords(await restored.getExportSnapshot()), before);
  });

  test(`${method} concurrent repeats keep the first committed assertion`, async () => {
    const archive = await fixture();
    const [first, repeated] = await Promise.all([
      archive[method](id, "First reason"), archive[method](id, "Second reason"),
    ]);
    assert.deepEqual(repeated, first);
    const reason = first.withdrawalReason ?? first.deletionReason;
    assert.equal(reason, "First reason");
    assert.equal((await archive.getUtterance("a")).text, '  Original\n"<& 😀  ');
  });
}
