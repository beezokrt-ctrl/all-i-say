import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { AllISayApp } from "../js/app.js";
import { getArchive } from "../js/services/archive.js";

function editor() {
  const nodes = {
    "#entryText": { value: '  Original\n<& 😀  ', blur() {} },
    "#artifactFile": { files: [], value: "" },
    "#artifactTranscription": { value: "" },
    "#saveEntry": {}, "#saveMessage": {}, "#recordMessage": {},
  };
  const app = new AllISayApp(null);
  app.route = "write";
  app.refreshFromArchive = async () => {};
  app.navigate = (route) => { app.route = route; };
  return { nodes, app };
}

for (const field of ["#entryText", "#artifactTranscription", "#artifactFile"]) {
  test(`Say retains a changed ${field} during commit and ignores a second save tap`, async () => {
    const { nodes, app } = editor();
    const old = globalThis.document;
    globalThis.document = { querySelector: (id) => nodes[id] };
    const archive = await getArchive(), original = archive.createUtterance;
    let release, started;
    const wait = new Promise((resolve) => { release = resolve; });
    const began = new Promise((resolve) => { started = resolve; });
    const before = (await archive.listUtterances()).length;
    archive.createUtterance = async function (data) { started(); await wait; return original.call(this, data); };
    try {
      const savedText = nodes["#entryText"].value;
      const saving = app.saveEntry();
      await began;
      if (field === "#artifactFile") {
        nodes[field].files = [new Blob(["new attachment"])];
        nodes[field].value = "new-file";
      } else nodes[field].value = "  New draft\n  ";
      const changed = nodes[field].value;
      await app.saveEntry();
      release();
      await saving;
      assert.equal(nodes[field].value, changed);
      assert.equal(app.route, "write");
      const records = await archive.listUtterances();
      assert.equal(records.length, before + 1);
      assert.equal(records[0].text, savedText);
      assert.equal(nodes["#saveEntry"].disabled, false);
    } finally {
      release();
      archive.createUtterance = original;
      globalThis.document = old;
    }
  });
}

for (const changed of [false, true]) {
  test(`Say reports committed words after refresh failure (new input: ${changed})`, async () => {
    const { nodes, app } = editor();
    const old = globalThis.document;
    globalThis.document = { querySelector: (id) => nodes[id] };
    const archive = await getArchive(), original = archive.createUtterance;
    const before = (await archive.listUtterances()).length;
    archive.createUtterance = async function (data) {
      const saved = await original.call(this, data);
      if (changed) nodes["#entryText"].value = "Later words";
      return saved;
    };
    app.refreshFromArchive = async () => { throw new Error("refresh failed"); };
    try {
      await app.saveEntry();
      assert.equal((await archive.listUtterances()).length, before + 1);
      assert.match(nodes["#saveMessage"].textContent, /Kept in your record/);
      assert.doesNotMatch(nodes["#saveMessage"].textContent, /Try again|Could not/);
      assert.equal(nodes["#entryText"].value, changed ? "Later words" : "");
      assert.equal(nodes["#saveEntry"].disabled, false);
    } finally {
      archive.createUtterance = original;
      globalThis.document = old;
    }
  });
}
