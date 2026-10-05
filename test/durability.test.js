import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { exportAll, downloadExport } from "../js/storage/export.js";
import { importAll } from "../js/storage/import.js";
import { downloadArchiveExport } from "../js/services/export.js";
import { getStorageProtection, requestStorageProtection } from "../js/services/durability.js";
import { backupAge } from "../js/views/durability.js";
import { mountDurability } from "../js/durability-controls.js";

const archive = () => new IndexedDBArchiveRepository({ name: "durability-test", indexedDB: new IDBFactory() });

// Node has Blob but no FileReader; preserve the real asynchronous byte path.
class BlobReader {
  readAsDataURL(blob) {
    blob
      .arrayBuffer()
      .then((bytes) => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
        this.onload();
      })
      .catch((error) => {
        this.error = error;
        this.onerror();
      });
  }
}

test("backup snapshot includes every archive store, exact words and original artifact bytes", async () => {
  const previous = globalThis.FileReader;
  globalThis.FileReader = BlobReader;
  try {
    const repository = archive();
    const bytes = Uint8Array.from([0, 255, 13, 10, 1, 2, 3, 128]);
    const artifact = await repository.createArtifact(new Blob([bytes], { type: "image/png" }), {
      id: "photo",
      kind: "photo",
      mimeType: "image/png",
    });
    const utterance = await repository.createUtterance({
      id: "words",
      text: " unchanged\n\n  exact words ",
      source: { type: "imported", artifactIds: [artifact.id] },
      temporal: { earliest: null, latest: null, precision: "unknown", display: "around then" },
    });
    const transcription = await repository.createTranscription({
      artifactId: artifact.id,
      text: "a separate transcription",
      provenance: { origin: "author" },
    });
    const snapshot = await repository.getExportSnapshot();
    const db = await repository.open();
    for (const store of [...db.objectStoreNames].filter((name) => name !== "meta"))
      assert.ok(Array.isArray(snapshot[store]), `${store} omitted from snapshot`);
    const payload = await exportAll(repository),
      restored = archive();
    await importAll(restored, JSON.parse(JSON.stringify(payload)));
    assert.deepEqual(await restored.getUtterance(utterance.id), utterance);
    assert.deepEqual(await restored.listTranscriptions(), [transcription]);
    const restoredArtifact = await restored.getArtifact(artifact.id);
    assert.deepEqual(new Uint8Array(await restoredArtifact.blob.arrayBuffer()), bytes);
    assert.equal(restoredArtifact.blob.type, "image/png");
  } finally {
    if (previous === undefined) delete globalThis.FileReader;
    else globalThis.FileReader = previous;
  }
});

test("a snapshot is consistent while another operation withdraws a Relation", async () => {
  const repository = archive();
  await repository.createUtterance({ id: "one", text: "one" });
  await repository.createUtterance({ id: "two", text: "two" });
  await repository.createRelation({ id: "rel", fromId: "one", toId: "two", provenance: { origin: "author" } });
  const snapshot = repository.getExportSnapshot();
  const withdrawal = repository.withdrawRelation("rel", "later");
  assert.equal((await snapshot).relations[0].status, "active");
  await withdrawal;
  assert.equal((await repository.listRelations({ includeHistory: true }))[0].status, "withdrawn");
});

test("only a successful export handoff records a receipt, separate from canonical content", async () => {
  const repository = archive();
  const original = await repository.createUtterance({ id: "one", text: "the record" });
  let handedOff = false;
  const result = await downloadArchiveExport({
    archive: repository,
    download: async (payload, filename) => {
      assert.equal(await repository.getLastBackupExport(), null);
      assert.deepEqual(payload.utterances, [original]);
      handedOff = true;
      return { filename, url: "blob:test", release() {} };
    },
  });
  assert.ok(handedOff);
  assert.ok(result.receiptSaved);
  assert.deepEqual(await repository.getLastBackupExport(), result.receipt);
  assert.deepEqual((await exportAll(repository)).utterances, [original]);
  assert.equal("lastBackupExport" in (await exportAll(repository)), false);
  const receipt = await repository.getLastBackupExport();
  await assert.rejects(
    () =>
      downloadArchiveExport({
        archive: repository,
        download() {
          throw new Error("blocked");
        },
      }),
    /blocked/,
  );
  assert.deepEqual(await repository.getLastBackupExport(), receipt);
});

test("snapshot/encoding failure cannot initiate a download or advance history", async () => {
  let downloaded = false,
    recorded = false;
  await assert.rejects(
    () =>
      downloadArchiveExport({
        archive: {
          async getExportSnapshot() {
            throw new Error("storage unavailable");
          },
          async recordBackupExport() {
            recorded = true;
          },
        },
        download() {
          downloaded = true;
        },
      }),
    /storage unavailable/,
  );
  assert.equal(downloaded, false);
  assert.equal(recorded, false);
});

test("receipt-write failure reports an export without claiming remembered history", async () => {
  const repository = archive();
  repository.recordBackupExport = async () => {
    throw new Error("quota");
  };
  const result = await downloadArchiveExport({
    archive: repository,
    download: (_, filename) => ({ filename, url: "blob:test", release() {} }),
  });
  assert.equal(result.receiptSaved, false);
  assert.equal(await repository.getLastBackupExport(), null);
});

test("download keeps its URL until released and cleans up a failed request", () => {
  const previousDocument = globalThis.document;
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  const events = [];
  globalThis.document = {
    body: {
      append() {
        events.push("append");
      },
    },
    createElement() {
      return {
        click() {
          events.push("click");
        },
        remove() {
          events.push("remove");
        },
      };
    },
  };
  URL.createObjectURL = () => {
    events.push("create");
    return "blob:backup";
  };
  URL.revokeObjectURL = () => events.push("revoke");
  try {
    const delivery = downloadExport({ utterances: [] }, "backup.json");
    assert.deepEqual(events, ["create", "append", "click", "remove"]);
    delivery.release();
    assert.equal(events.at(-1), "revoke");
    globalThis.document.createElement = () => ({
      click() {
        throw Error("blocked");
      },
      remove() {
        events.push("remove");
      },
    });
    assert.throws(() => downloadExport({}, "backup.json"), /blocked/);
    assert.deepEqual(events.slice(-2), ["revoke", "remove"]);
  } finally {
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("storage protection handles grant, denial, missing support and errors without archive writes", async () => {
  assert.equal(await getStorageProtection({ persisted: async () => true }), "granted");
  assert.equal(await getStorageProtection({ persisted: async () => false }), "best-effort");
  assert.equal(await requestStorageProtection({ persist: async () => true }), "granted");
  assert.equal(await requestStorageProtection({ persist: async () => false }), "denied");
  assert.equal(await requestStorageProtection({}), "unsupported");
  assert.equal(
    await requestStorageProtection({
      persist: async () => {
        throw Error();
      },
    }),
    "unavailable",
  );
  assert.equal(
    await getStorageProtection({
      persisted: async () => {
        throw Error();
      },
    }),
    "unavailable",
  );
});

test("bound backup controls prevent duplicate exports and preserve an honest failure state", async () => {
  const nodes = Object.fromEntries(
    [
      "backupNow",
      "requestStorageProtection",
      "backupMessage",
      "lastBackupExport",
      "backupDownload",
      "storageProtection",
      "offlineStatus",
    ].map((id) => [id, { textContent: "", hidden: true }]),
  );
  const root = {
    querySelector: (selector) => nodes[selector.slice(1)],
    addEventListener(type, handler) {
      this.click = handler;
    },
  };
  let release,
    calls = 0;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  mountDurability(root, {
    readReceipt: async () => null,
    checkStorage: async () => "best-effort",
    requestStorage: async () => "denied",
    setupOffline: (report) => report("ready"),
    exportBackup: async () => {
      calls++;
      await ready;
      throw Error("failed");
    },
  });
  await Promise.resolve();
  const event = (id) => ({ target: { closest: (selector) => (selector === "#" + id ? nodes[id] : null) } });
  const first = root.click(event("backupNow"));
  await root.click(event("backupNow"));
  assert.equal(calls, 1);
  assert.equal(nodes.backupNow.disabled, true);
  release();
  await first;
  assert.match(nodes.backupMessage.textContent, /Could not export/);
  assert.match(nodes.lastBackupExport.textContent, /No backup exported/);
  assert.equal(nodes.backupNow.disabled, false);
  await root.click(event("requestStorageProtection"));
  assert.match(nodes.storageProtection.textContent, /did not grant/);
  assert.equal(nodes.requestStorageProtection.disabled, false);
});

test("backup age never invents a successful backup or negative elapsed days", () => {
  const now = Date.parse("2026-09-28T00:00:00Z");
  assert.match(backupAge(null, now), /No backup exported/);
  assert.match(backupAge({ exportedAt: "bad" }, now), /No backup exported/);
  assert.equal(backupAge({ exportedAt: "2026-09-26T00:00:00Z" }, now), "Last backup exported 2 days ago");
  assert.doesNotMatch(backupAge({ exportedAt: "2026-09-29T00:00:00Z" }, now), /-1/);
});

test("import controls wait for the author, show atomic failure and refresh only after success", async () => {
  const nodes = Object.fromEntries(
    [
      "backupNow",
      "requestStorageProtection",
      "backupMessage",
      "lastBackupExport",
      "backupDownload",
      "storageProtection",
      "offlineStatus",
      "archiveImport",
      "importBackup",
      "importMessage",
    ].map((id) => [id, { textContent: "", files: [], hidden: true }]),
  );
  const root = {
    querySelector: (selector) => nodes[selector.slice(1)],
    addEventListener(type, handler) {
      this.click = handler;
    },
  };
  let writes = 0,
    refreshes = 0,
    fail = true;
  mountDurability(root, {
    readReceipt: async () => null,
    checkStorage: async () => "best-effort",
    setupOffline() {},
    importBackup: async () => {
      writes++;
      if (fail) throw new SyntaxError("bad JSON");
      return { counts: { utterances: 1 } };
    },
    onImported: async () => {
      refreshes++;
    },
  });
  const event = { target: { closest: (selector) => (selector === "#importBackup" ? nodes.importBackup : null) } };
  await Promise.resolve();
  assert.equal(writes, 0);
  await root.click(event);
  assert.equal(writes, 0);
  assert.match(nodes.importMessage.textContent, /Choose/);
  nodes.archiveImport.files = [new Blob(["{bad"])];
  assert.equal(writes, 0);
  await root.click(event);
  assert.match(nodes.importMessage.textContent, /No records were imported.*not valid JSON/);
  assert.equal(refreshes, 0);
  assert.equal(nodes.importBackup.disabled, false);
  fail = false;
  await root.click(event);
  assert.equal(refreshes, 1);
  assert.match(nodes.importMessage.textContent, /1 records added/);
});
