import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { RELATION_TYPES } from "../data/schema.js";
import { RELATION_OPTIONS } from "../js/services/relations.js";

test("ordinary relation writes use the registry and reject unknown types without writing", async () => {
  const archive = new IndexedDBArchiveRepository({ name: "types", indexedDB: new IDBFactory() });
  await archive.createUtterance({ id: "a", text: "A" });
  await archive.createUtterance({ id: "b", text: "B" });
  for (const type of RELATION_OPTIONS) {
    await archive.createRelation({ fromId: "a", toId: "b", type, provenance: { origin: "author" } });
  }
  assert.deepEqual(new Set((await archive.listRelations()).map(r => r.type)), new Set(RELATION_TYPES));
  const before = await archive.listRelations();
  await assert.rejects(() => archive.createRelation({
    fromId: "a", toId: "b", type: "not-a-relation", provenance: { origin: "author" },
  }), /Invalid relation type/);
  assert.deepEqual(await archive.listRelations(), before);
  assert.equal(RELATION_OPTIONS, RELATION_TYPES);
});
