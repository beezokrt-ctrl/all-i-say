import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryArchiveRepository } from "../js/storage/in-memory.js";

test("memory adapter preserves the first tombstone through concurrent and repeated calls", async () => {
  const archive = new InMemoryArchiveRepository();
  const text = '  Original\n"<& 😀  ';
  await archive.createUtterance({ id: "words", text });
  const [first, repeated] = await Promise.all([
    archive.tombstoneUtterance("words", "First reason"),
    archive.tombstoneUtterance("words", "Replacement reason"),
  ]);
  assert.deepEqual(repeated, first);
  assert.deepEqual(await archive.tombstoneUtterance("words"), first);
  assert.equal((await archive.getUtterance("words")).text, text);
  first.deletionReason = "Mutating the returned copy";
  assert.equal((await archive.getUtterance("words")).deletionReason, "First reason");
  assert.equal((await archive.listUtterances()).length, 0);
  assert.equal((await archive.listUtterances({ includeHistory: true })).length, 1);
});
