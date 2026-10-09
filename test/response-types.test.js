import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { respondToUtterance } from "../js/services/responses.js";
import { responseComposer } from "../js/views/responses.js";

test("every rendered response option persists; unknown types write nothing", async () => {
  const archive = new IndexedDBArchiveRepository({ name: "response-types-" + crypto.randomUUID() });
  const target = await archive.createUtterance({ text: "  Original\n<& 🪶  " });
  const options = [...responseComposer().matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)];
  assert.equal(options.length, 6);
  assert.equal(new Set(options.map((option) => option[1])).size, options.length);
  for (const [, type] of options) {
    const saved = await respondToUtterance(
      { targetId: target.id, text: "  Reply\n<& 🪶  ", type, provenance: { origin: "author" } },
      { archive },
    );
    assert.equal((await archive.listRelations()).find((item) => item.id === saved.relation.id).type, type);
    assert.equal((await archive.getUtterance(saved.utterance.id)).text, "  Reply\n<& 🪶  ");
    assert.equal(saved.relation.toId, target.id);
    assert.equal(saved.relation.fromId, saved.utterance.id);
  }
  const { exportedAt: beforeTime, ...before } = await archive.getExportSnapshot();
  await assert.rejects(
    () => archive.createResponse(
      { text: "Must not survive" },
      { toId: target.id, type: "not-a-relation", provenance: { origin: "author" } },
    ),
    /Invalid response relation/,
  );
  const { exportedAt: afterTime, ...after } = await archive.getExportSnapshot();
  assert.deepEqual(after, before);
  assert.deepEqual(await archive.getUtterance(target.id), target);
});
