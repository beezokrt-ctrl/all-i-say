import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBArchiveRepository } from '../js/storage/indexeddb.js';
import { exportAll } from '../js/storage/export.js';
import { importAll } from '../js/storage/import.js';
import { buildGateBArchive, comparableRecords, FIXED_TIME, EXACT_TEXT } from '../scripts/fixtures/gate-b-archive.js';

// Node lacks FileReader; exercise real Blob bytes through the exporter's asynchronous reader API.
class BlobReader {
  async readAsDataURL(blob) {
    try {
      const bytes = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type};base64,${bytes.toString('base64')}`;
      this.onload();
    } catch (error) {
      this.error = error;
      this.onerror();
    }
  }
}
const archive = () => new IndexedDBArchiveRepository({ name: 'gate-b', indexedDB: new IDBFactory() });

test('Gate B preserves every record and byte through export, empty-IDB import, and identical re-export', async t => {
  const previousReader = globalThis.FileReader;
  globalThis.FileReader = BlobReader;
  t.after(() => {
    if (previousReader === undefined) delete globalThis.FileReader;
    else globalThis.FileReader = previousReader;
  });
  // Pin only the test clock: exportedAt is compared too, never removed from either export.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(FIXED_TIME) });
  const source = archive(), restored = archive();
  t.after(async () => { (await source.open()).close(); (await restored.open()).close(); });
  const expected = await comparableRecords(await buildGateBArchive(source));
  assert.equal(expected.utterances.find(u => u.id === 'gate-b-original').text, EXACT_TEXT);
  assert.deepEqual(await comparableRecords(await source.getExportSnapshot()), expected);
  assert.ok(Object.values(await comparableRecords(await restored.getExportSnapshot())).every(rows => !rows.length));
  const first = await exportAll(source);
  assert.equal(first.exportedAt, FIXED_TIME);
  assert.deepEqual(first.utterances, expected.utterances);
  assert.deepEqual(first.relations, expected.relations);
  await importAll(restored, JSON.parse(JSON.stringify(first)));
  assert.deepEqual(await comparableRecords(await restored.getExportSnapshot()), expected);
  assert.deepEqual(await exportAll(restored), first);
});
