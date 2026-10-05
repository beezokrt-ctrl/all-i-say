import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedDBArchiveRepository } from "../js/storage/indexeddb.js";
import { createArtifact } from "../js/domain/artifact.js";
import { createTranscription } from "../js/domain/transcription.js";
import { importAll } from "../js/storage/import.js";
import { exportAll } from "../js/storage/export.js";

const archive = () => new IndexedDBArchiveRepository({ indexedDB: new IDBFactory() });
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

test("unknown artifact capture dates stay unknown instead of becoming import time", () => {
  assert.equal(createArtifact({ capturedAt: null }).capturedAt, null);
  assert.equal(createArtifact({}).capturedAt, null);
});

test("withdrawn transcription keeps its deletion timestamp through reconstruction", () => {
  const record = createTranscription({
    artifactId: "photo",
    text: " original reading ",
    provenance: { origin: "author" },
    attestation: { state: "withdrawn" },
  });
  const historical = { ...record, deletedAt: "2020-01-02T00:00:00Z" };
  assert.deepEqual(createTranscription(historical), historical);
});

test("artifact-only tombstone survives full JSON round trip without inventing words or chronology", async () => {
  const previous = globalThis.FileReader;
  globalThis.FileReader = BlobReader;
  try {
    const source = archive();
    const photo = await source.createArtifact(new Blob([Uint8Array.from([0, 10, 255])], { type: "image/png" }), {
      id: "photo",
      capturedAt: null,
    });
    const pending = await source.createUtterance({
      id: "pending",
      text: null,
      source: { type: "imported", artifactIds: [photo.id] },
      metadata: { status: "awaiting-transcription" },
    });
    const tombstone = await source.tombstoneUtterance(pending.id, "retained source");
    assert.equal(tombstone.text, null);
    const transcription = await source.createTranscription({
      id: "reading",
      artifactId: photo.id,
      text: " separate reading ",
      provenance: { origin: "author" },
      attestation: { state: "withdrawn" },
      deletedAt: "2020-01-02T00:00:00Z",
    });
    const payload = JSON.parse(JSON.stringify(await exportAll(source)));
    const restored = archive();
    await importAll(restored, payload);
    assert.deepEqual(await restored.getUtterance(pending.id), tombstone);
    assert.deepEqual(await restored.listTranscriptions(), [transcription]);
    const artifact = await restored.getArtifact(photo.id);
    assert.equal(artifact.capturedAt, null);
    assert.deepEqual([...new Uint8Array(await artifact.blob.arrayBuffer())], [0, 10, 255]);
    const repeated = await importAll(restored, payload, { conflict: "skip" });
    assert.equal(repeated.skipped.utterances, 1);
    assert.equal(repeated.skipped.artifacts, 1);
    assert.equal(repeated.skipped.transcriptions, 1);
  } finally {
    if (previous === undefined) delete globalThis.FileReader;
    else globalThis.FileReader = previous;
  }
});

for (const version of [2, 3])
  test(`actual historical exporter v${version} restores every emitted record and artifact byte`, async () => {
    const { readFile } = await import("node:fs/promises");
    const payload = JSON.parse(
      await readFile(new URL(`./fixtures/historical/export-v${version}.json`, import.meta.url), "utf8"),
    );
    const repository = archive();
    await importAll(repository, payload);
    const restored = await repository.getExportSnapshot();
    const ordered = (items) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    for (const name of ["utterances", "transcriptions", "relations", "constellations", "memberships"]) {
      assert.deepEqual(ordered(restored[name]), ordered(payload[name] || []), name);
    }
    for (const original of payload.artifacts) {
      const { data, ...metadata } = original;
      const { blob, ...actual } = await repository.getArtifact(original.id);
      assert.deepEqual(actual, metadata);
      assert.equal(Buffer.from(await blob.arrayBuffer()).toString("base64"), data.split(",")[1]);
    }
  });
