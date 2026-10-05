import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { getArchive } from "../js/services/archive.js";
import { respondToUtterance } from "../js/services/responses.js";
import { createLegacyUtteranceEntry } from "../js/services/legacy.js";
import { AllISayApp } from "../js/app.js";

const words = "  Unclassified\n\"<& 🪶  ";

test("responses keep unknown form instead of choosing a classification", async () => {
  const archive = await getArchive();
  const target = await archive.createUtterance({ text: "Before", metadata: { form: "lyric" } });
  const reply = await respondToUtterance(
    { targetId: target.id, text: words, provenance: { origin: "author" } },
    { archive },
  );
  const stored = await archive.getUtterance(reply.utterance.id);
  assert.equal(stored.metadata.form, "unknown");
  assert.equal(stored.text, words);
  assert.deepEqual(await archive.getUtterance(target.id), target);
  const chosen = await archive.createResponse(
    { text: words, metadata: { form: "note" } },
    { toId: target.id, type: "responds-to", provenance: { origin: "author" } },
  );
  assert.equal((await archive.getUtterance(chosen.utterance.id)).metadata.form, "note");
});

test("Say stores exact words with unknown form", async () => {
  const sayWords = words + "Say";
  const input = { value: sayWords, blur() {} };
  const nodes = { "#entryText": input, "#recordMessage": {} };
  const previous = globalThis.document;
  globalThis.document = { querySelector: (selector) => nodes[selector] };
  try {
    const app = new AllISayApp(null);
    app.refreshFromArchive = async () => {};
    app.navigate = () => {};
    await app.persistEntry();
    const archive = await getArchive();
    const records = await archive.listUtterances();
    const saved = records.find((record) => record.text === sayWords && record.metadata.form === "unknown");
    assert.ok(saved, "Say persisted unknown form");
    assert.equal(input.value, "");
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test("legacy capture defaults to unknown and preserves an explicit form", async () => {
  const unclassified = await createLegacyUtteranceEntry({ text: "Legacy without a form" });
  const chosen = await createLegacyUtteranceEntry({ text: "Legacy chosen form", kind: "lyric" });
  const archive = await getArchive();
  assert.equal((await archive.getUtterance(unclassified.id)).metadata.form, "unknown");
  assert.equal((await archive.getUtterance(chosen.id)).metadata.form, "lyric");
});
