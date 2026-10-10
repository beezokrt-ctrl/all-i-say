import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { AllISayApp } from "../js/app.js";
import { getArchive } from "../js/services/archive.js";
import { responseComposer } from "../js/views/responses.js";

test("response form carries its escaped rendered target", () => {
  assert.match(responseComposer('target"<&'), /data-target-id="target&quot;&lt;&amp;"/);
});

for (const refresh of [false, true]) {
  test(`a late ${refresh ? "refresh" : "inspection"} cannot replace newer visible words or target`, async () => {
    const archive = await getArchive();
    const a = await archive.createUtterance({ text: "Slow original" });
    const b = await archive.createUtterance({ text: "Latest original" });
    let release, started;
    const pending = new Promise((resolve) => { release = resolve; });
    const began = new Promise((resolve) => { started = resolve; });
    const original = archive.getUtterance;
    archive.getUtterance = async function (id) {
      if (id === a.id) { started(); await pending; }
      return original.call(this, id);
    };
    const mount = { innerHTML: "" };
    const oldDocument = globalThis.document, oldWindow = globalThis.window;
    globalThis.document = { querySelector: (id) => id === "#inspectMount" ? mount : null };
    globalThis.window = { scrollY: 0 };
    try {
      const app = new AllISayApp(null);
      app.navigate = (route) => { app.route = route; };
      app.restoreResponseDraft = () => {};
      app.inspectId = a.id;
      const slow = refresh ? app.refreshInspect() : app.inspect(a.id);
      await began;
      await app.inspect(b.id);
      release();
      await slow;
      assert.equal(app.inspectId, b.id);
      assert.equal(app.inspectedText, b.text);
      assert.ok(mount.innerHTML.includes(b.text));
      assert.ok(!mount.innerHTML.includes(a.text));
      assert.ok(mount.innerHTML.includes(`data-target-id="${b.id}"`));
    } finally {
      release();
      archive.getUtterance = original;
      globalThis.document = oldDocument;
      globalThis.window = oldWindow;
    }
  });
}

test("a mismatched response form keeps its words and creates no record", async () => {
  const archive = await getArchive();
  const a = await archive.createUtterance({ text: "Shown" });
  const b = await archive.createUtterance({ text: "Pending" });
  const before = (await archive.listUtterances()).length;
  const input = { value: "  Reply\n<&  " }, message = {}, button = {};
  const nodes = { "#responseText": input, "#responseMessage": message,
    "#saveResponse": button, "#responseType": { value: "responds-to" } };
  const form = { dataset: { targetId: a.id }, querySelector: (id) => nodes[id] };
  const old = globalThis.document;
  globalThis.document = { querySelector: (id) => id === "#responseForm" ? form : nodes[id] };
  try {
    const app = new AllISayApp(null);
    app.inspectId = b.id;
    app.refreshFromArchive = async () => {};
    await app.saveResponse();
    assert.equal((await archive.listUtterances()).length, before);
    assert.equal(input.value, "  Reply\n<&  ");
    assert.match(message.textContent, /Your words are still here/);
  } finally { globalThis.document = old; }
});
