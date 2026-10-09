import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { createLegacyUtteranceEntry } from "../js/services/legacy.js";
import { EntryStore } from "../js/store.js";
const text = '  exact\n"<& 😀  ';

test("legacy repository capture preserves exact words and leaves classification unset", async () => {
  globalThis.indexedDB = new IDBFactory();
  const saved = await createLegacyUtteranceEntry({ text });
  assert.equal(saved.text, text);
  assert.deepEqual(saved.metadata.threads, []);
  assert.equal(saved.metadata.form, "unknown");
  const chosen = await createLegacyUtteranceEntry({ text, threads: ["chosen"], kind: "poem" });
  assert.deepEqual(chosen.metadata.threads, ["chosen"]);
  assert.equal(chosen.metadata.form, "poem");
});

test("legacy local capture preserves words and explicit empty placement without inventing a form", () => {
  let stored;
  const store = new EntryStore({ setItem: (_key, value) => { stored = JSON.parse(value); } });
  const previous = [{ id: "old", text: " old ", kind: "statement", threads: ["Unplaced"] }];
  store.add(previous, { text, threads: [] });
  assert.equal(stored[1].text, text);
  assert.deepEqual(stored[1].threads, []);
  assert.equal(stored[1].kind, "unknown");
  assert.deepEqual(stored[0], previous[0]);
});
