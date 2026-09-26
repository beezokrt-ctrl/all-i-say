import { ArchiveRepository } from './repository.js';
import { createUtterance } from '../domain/utterance.js';
import { validateUtterance, SCHEMA_VERSION } from '../../data/schema.js';

const DB_VERSION = 1;
const UTTERANCES = 'utterances';
const META = 'meta';

const clone = value => value === undefined ? undefined : structuredClone(value);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

/**
 * Local-first IndexedDB repository.
 *
 * Issue 3 deliberately implements only the utterance CRUD subset. The
 * remaining repository methods continue to throw NotImplementedError through
 * ArchiveRepository until their roadmap issues are implemented.
 */
export class IndexedDBArchiveRepository extends ArchiveRepository {
  constructor({ name = 'all-i-say', indexedDB = globalThis.indexedDB } = {}) {
    super();
    if (!indexedDB) throw new Error('IndexedDB is not available in this environment');
    this.name = name;
    this.indexedDB = indexedDB;
    this.databasePromise = null;
  }

  async open() {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = this.indexedDB.open(this.name, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          const store = database.objectStoreNames.contains(UTTERANCES)
            ? request.transaction.objectStore(UTTERANCES)
            : database.createObjectStore(UTTERANCES, { keyPath: 'id' });

          if (!store.indexNames.contains('createdAt')) store.createIndex('createdAt', 'createdAt', { unique: false });
          if (!store.indexNames.contains('spokenAt')) store.createIndex('spokenAt', 'spokenAt', { unique: false });
          if (!store.indexNames.contains('status')) store.createIndex('status', 'metadata.status', { unique: false });

          if (!database.objectStoreNames.contains(META)) database.createObjectStore(META, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB database'));
        request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open connection'));
      });
    }
    return this.databasePromise;
  }

  async getUtterance(id) {
    const database = await this.open();
    const transaction = database.transaction(UTTERANCES, 'readonly');
    return clone(await requestResult(transaction.objectStore(UTTERANCES).get(id)));
  }

  async listUtterances({ since, until, form, thread, status = 'kept', limit = 100, cursor } = {}) {
    const database = await this.open();
    const transaction = database.transaction(UTTERANCES, 'readonly');
    const store = transaction.objectStore(UTTERANCES);
    const values = [];

    await new Promise((resolve, reject) => {
      const request = store.index('createdAt').openCursor(null, 'prev');
      request.onsuccess = () => {
        const record = request.result?.value;
        if (!record) return resolve();
        const afterCursor = !cursor || record.createdAt < cursor;
        const inRange = (!since || record.createdAt >= since) && (!until || record.createdAt <= until);
        const matches = afterCursor && inRange
          && (status === undefined || record.metadata?.status === status)
          && (!form || record.metadata?.form === form)
          && (!thread || record.metadata?.threads?.includes(thread));
        if (matches) values.push(clone(record));
        if (values.length >= limit) return resolve();
        request.result.continue();
      };
      request.onerror = () => reject(request.error || new Error('Unable to list utterances'));
    });

    return values;
  }

  async createUtterance(data) {
    const utterance = createUtterance(data);
    const database = await this.open();
    const transaction = database.transaction(UTTERANCES, 'readwrite');
    transaction.objectStore(UTTERANCES).add(clone(utterance));
    await transactionComplete(transaction);
    return clone(utterance);
  }

  async tombstoneUtterance(id, reason = null) {
    const database = await this.open();
    const transaction = database.transaction(UTTERANCES, 'readwrite');
    const store = transaction.objectStore(UTTERANCES);
    const current = await requestResult(store.get(id));
    if (!current) throw new Error(`Unknown utterance: ${id}`);

    const tombstone = {
      ...current,
      metadata: { ...current.metadata, status: 'tombstoned' },
      deletedAt: new Date().toISOString(),
      deletionReason: reason
    };
    validateUtterance(tombstone);
    if (tombstone.text !== current.text) throw new Error('Tombstoning cannot change utterance.text');
    store.put(clone(tombstone));
    await transactionComplete(transaction);
    return clone(tombstone);
  }

  async getSchemaVersion() {
    const database = await this.open();
    const transaction = database.transaction(META, 'readonly');
    const value = await requestResult(transaction.objectStore(META).get('schemaVersion'));
    return value?.value ?? SCHEMA_VERSION;
  }
}

export { DB_VERSION };
