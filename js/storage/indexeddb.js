import { ArchiveRepository } from './repository.js';
import { createUtterance } from '../domain/utterance.js';
import { createArtifact } from '../domain/artifact.js';
import { createTranscription } from '../domain/transcription.js';
import { validateUtterance, validateTranscription, SCHEMA_VERSION } from '../../data/schema.js';

const DB_VERSION = 2;
const UTTERANCES = 'utterances';
const ARTIFACTS = 'artifacts';
const TRANSCRIPTIONS = 'transcriptions';
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
          const upgrade = request.transaction;
          const utterances = database.objectStoreNames.contains(UTTERANCES)
            ? upgrade.objectStore(UTTERANCES)
            : database.createObjectStore(UTTERANCES, { keyPath: 'id' });
          if (!utterances.indexNames.contains('createdAt')) utterances.createIndex('createdAt', 'createdAt');
          if (!utterances.indexNames.contains('spokenAt')) utterances.createIndex('spokenAt', 'spokenAt');
          if (!utterances.indexNames.contains('status')) utterances.createIndex('status', 'metadata.status');
          if (!database.objectStoreNames.contains(ARTIFACTS)) database.createObjectStore(ARTIFACTS, { keyPath: 'id' });
          if (!database.objectStoreNames.contains(TRANSCRIPTIONS)) {
            const transcriptions = database.createObjectStore(TRANSCRIPTIONS, { keyPath: 'id' });
            transcriptions.createIndex('artifactId', 'artifactId');
            transcriptions.createIndex('utteranceId', 'utteranceId');
          }
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
    const db = await this.open();
    return clone(await requestResult(db.transaction(UTTERANCES).objectStore(UTTERANCES).get(id)));
  }

  async listUtterances({ since, until, form, thread, status = 'kept', limit = 100, cursor } = {}) {
    const db = await this.open();
    const transaction = db.transaction(UTTERANCES, 'readonly');
    const values = [];
    await new Promise((resolve, reject) => {
      const request = transaction.objectStore(UTTERANCES).index('createdAt').openCursor(null, 'prev');
      request.onsuccess = () => {
        const current = request.result;
        if (!current || values.length >= limit) return resolve();
        const record = current.value;
        const matches = (!cursor || record.createdAt < cursor)
          && (!since || record.createdAt >= since) && (!until || record.createdAt <= until)
          && (status === undefined || record.metadata?.status === status)
          && (!form || record.metadata?.form === form)
          && (!thread || record.metadata?.threads?.includes(thread));
        if (matches) values.push(clone(record));
        current.continue();
      };
      request.onerror = () => reject(request.error || new Error('Unable to list utterances'));
    });
    return values;
  }

  async createUtterance(data) {
    const utterance = createUtterance(data);
    const db = await this.open();
    const transaction = db.transaction(UTTERANCES, 'readwrite');
    transaction.objectStore(UTTERANCES).add(clone(utterance));
    await transactionComplete(transaction);
    return clone(utterance);
  }

  async tombstoneUtterance(id, reason = null) {
    const db = await this.open();
    const transaction = db.transaction(UTTERANCES, 'readwrite');
    const store = transaction.objectStore(UTTERANCES);
    const current = await requestResult(store.get(id));
    if (!current) throw new Error(`Unknown utterance: ${id}`);
    const tombstone = { ...current, metadata: { ...current.metadata, status: 'tombstoned' }, deletedAt: new Date().toISOString(), deletionReason: reason };
    validateUtterance(tombstone);
    if (tombstone.text !== current.text) throw new Error('Tombstoning cannot change utterance.text');
    store.put(clone(tombstone));
    await transactionComplete(transaction);
    return clone(tombstone);
  }

  async createArtifact(blob, meta = {}) {
    if (!(blob instanceof Blob)) throw new Error('Artifact storage requires a Blob');
    const artifact = createArtifact({ ...meta, storageRef: meta.storageRef || `idb://artifact/${meta.id || 'pending'}` });
    const stored = { ...artifact, blob };
    const db = await this.open();
    const transaction = db.transaction(ARTIFACTS, 'readwrite');
    transaction.objectStore(ARTIFACTS).put(stored);
    await transactionComplete(transaction);
    return clone(artifact);
  }

  async getArtifact(id) {
    const db = await this.open();
    return clone(await requestResult(db.transaction(ARTIFACTS).objectStore(ARTIFACTS).get(id)));
  }

  async createTranscription(data) {
    const transcription = createTranscription(data);
    const db = await this.open();
    const transaction = db.transaction(TRANSCRIPTIONS, 'readwrite');
    transaction.objectStore(TRANSCRIPTIONS).add(clone(transcription));
    await transactionComplete(transaction);
    return clone(transcription);
  }

  async confirmTranscription(id, attestation = {}) {
    const db = await this.open();
    const transaction = db.transaction(TRANSCRIPTIONS, 'readwrite');
    const store = transaction.objectStore(TRANSCRIPTIONS);
    const current = await requestResult(store.get(id));
    if (!current) throw new Error(`Unknown transcription: ${id}`);
    const confirmed = { ...current, attestation: { ...current.attestation, ...attestation, state: attestation.state || 'confirmed-by-author', confirmedAt: attestation.confirmedAt || new Date().toISOString() } };
    validateTranscription(confirmed);
    store.put(clone(confirmed));
    await transactionComplete(transaction);
    return clone(confirmed);
  }

  async getSchemaVersion() {
    const db = await this.open();
    const value = await requestResult(db.transaction(META).objectStore(META).get('schemaVersion'));
    return value?.value ?? SCHEMA_VERSION;
  }
}

export { DB_VERSION };
