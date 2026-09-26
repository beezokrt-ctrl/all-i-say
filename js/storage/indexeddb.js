import { ArchiveRepository } from './repository.js';
import { createUtterance } from '../domain/utterance.js';
import { createArtifact } from '../domain/artifact.js';
import { createTranscription } from '../domain/transcription.js';
import { createRelation } from '../domain/relation.js';
import { validateUtterance, validateTranscription, validateRelation, SCHEMA_VERSION } from '../../data/schema.js';

const DB_VERSION = 3;
const UTTERANCES = 'utterances';
const ARTIFACTS = 'artifacts';
const TRANSCRIPTIONS = 'transcriptions';
const RELATIONS = 'relations';
const META = 'meta';
const clone = value => value === undefined ? undefined : structuredClone(value);
const requestResult = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('IndexedDB request failed')); });
const transactionComplete = transaction => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed')); transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted')); });

export class IndexedDBArchiveRepository extends ArchiveRepository {
  constructor({ name = 'all-i-say', indexedDB = globalThis.indexedDB } = {}) { super(); if (!indexedDB) throw new Error('IndexedDB is not available in this environment'); this.name = name; this.indexedDB = indexedDB; this.databasePromise = null; }
  async open() {
    if (!this.databasePromise) this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.name, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result; const upgrade = request.transaction;
        const utterances = db.objectStoreNames.contains(UTTERANCES) ? upgrade.objectStore(UTTERANCES) : db.createObjectStore(UTTERANCES, { keyPath: 'id' });
        if (!utterances.indexNames.contains('createdAt')) utterances.createIndex('createdAt', 'createdAt');
        if (!utterances.indexNames.contains('spokenAt')) utterances.createIndex('spokenAt', 'spokenAt');
        if (!utterances.indexNames.contains('status')) utterances.createIndex('status', 'metadata.status');
        if (!db.objectStoreNames.contains(ARTIFACTS)) db.createObjectStore(ARTIFACTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(TRANSCRIPTIONS)) { const store = db.createObjectStore(TRANSCRIPTIONS, { keyPath: 'id' }); store.createIndex('artifactId', 'artifactId'); store.createIndex('utteranceId', 'utteranceId'); }
        if (!db.objectStoreNames.contains(RELATIONS)) { const store = db.createObjectStore(RELATIONS, { keyPath: 'id' }); store.createIndex('fromId', 'fromId'); store.createIndex('toId', 'toId'); store.createIndex('status', 'status'); }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB database')); request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'));
    });
    return this.databasePromise;
  }
  async getUtterance(id) { const db = await this.open(); return clone(await requestResult(db.transaction(UTTERANCES).objectStore(UTTERANCES).get(id))); }
  async listUtterances({ since, until, form, thread, status = 'kept', limit = 100, cursor } = {}) { const db = await this.open(); const tx = db.transaction(UTTERANCES, 'readonly'); const values = []; await new Promise((resolve, reject) => { const request = tx.objectStore(UTTERANCES).index('createdAt').openCursor(null, 'prev'); request.onsuccess = () => { const current = request.result; if (!current || values.length >= limit) return resolve(); const record = current.value; if ((!cursor || record.createdAt < cursor) && (!since || record.createdAt >= since) && (!until || record.createdAt <= until) && (status === undefined || record.metadata?.status === status) && (!form || record.metadata?.form === form) && (!thread || record.metadata?.threads?.includes(thread))) values.push(clone(record)); current.continue(); }; request.onerror = () => reject(request.error || new Error('Unable to list utterances')); }); return values; }
  async createUtterance(data) { const value = createUtterance(data); const db = await this.open(); const tx = db.transaction(UTTERANCES, 'readwrite'); tx.objectStore(UTTERANCES).add(clone(value)); await transactionComplete(tx); return clone(value); }
  async tombstoneUtterance(id, reason = null) { const db = await this.open(); const tx = db.transaction(UTTERANCES, 'readwrite'); const store = tx.objectStore(UTTERANCES); const current = await requestResult(store.get(id)); if (!current) throw new Error(`Unknown utterance: ${id}`); const value = { ...current, metadata: { ...current.metadata, status: 'tombstoned' }, deletedAt: new Date().toISOString(), deletionReason: reason }; validateUtterance(value); if (value.text !== current.text) throw new Error('Tombstoning cannot change utterance.text'); store.put(clone(value)); await transactionComplete(tx); return clone(value); }
  async createArtifact(blob, meta = {}) { if (!(blob instanceof Blob)) throw new Error('Artifact storage requires a Blob'); const artifact = createArtifact({ ...meta, storageRef: meta.storageRef || 'idb://artifact/pending' }); const db = await this.open(); const tx = db.transaction(ARTIFACTS, 'readwrite'); tx.objectStore(ARTIFACTS).put({ ...artifact, blob }); await transactionComplete(tx); return clone(artifact); }
  async getArtifact(id) { const db = await this.open(); return clone(await requestResult(db.transaction(ARTIFACTS).objectStore(ARTIFACTS).get(id))); }
  async createTranscription(data) { const value = createTranscription(data); const db = await this.open(); const tx = db.transaction(TRANSCRIPTIONS, 'readwrite'); tx.objectStore(TRANSCRIPTIONS).add(clone(value)); await transactionComplete(tx); return clone(value); }
  async listTranscriptions({ artifactId, utteranceId } = {}) { const db = await this.open(); const store = db.transaction(TRANSCRIPTIONS).objectStore(TRANSCRIPTIONS); const key = artifactId || utteranceId; const index = artifactId ? 'artifactId' : 'utteranceId'; return (await requestResult(store.index(index).getAll(key))).map(clone); }
  async confirmTranscription(id, attestation = {}) { const db = await this.open(); const tx = db.transaction(TRANSCRIPTIONS, 'readwrite'); const store = tx.objectStore(TRANSCRIPTIONS); const current = await requestResult(store.get(id)); if (!current) throw new Error(`Unknown transcription: ${id}`); const value = { ...current, attestation: { ...current.attestation, ...attestation, state: attestation.state || 'confirmed-by-author', confirmedAt: attestation.confirmedAt || new Date().toISOString() } }; validateTranscription(value); store.put(clone(value)); await transactionComplete(tx); return clone(value); }
  async createRelation(data) { const value = createRelation(data); const db = await this.open(); const tx = db.transaction(RELATIONS, 'readwrite'); tx.objectStore(RELATIONS).add(clone(value)); await transactionComplete(tx); return clone(value); }
  async listRelations({ utteranceId, status = 'active' } = {}) { const db = await this.open(); const store = db.transaction(RELATIONS).objectStore(RELATIONS); let values; if (utteranceId) { const [from, to] = await Promise.all([requestResult(store.index('fromId').getAll(utteranceId)), requestResult(store.index('toId').getAll(utteranceId))]); values = [...from, ...to]; } else values = await requestResult(store.getAll()); const seen = new Set(); return values.filter(value => { if (seen.has(value.id)) return false; seen.add(value.id); return status === undefined || value.status === status; }).map(clone); }
  async withdrawRelation(id, reason = null) { const db = await this.open(); const tx = db.transaction(RELATIONS, 'readwrite'); const store = tx.objectStore(RELATIONS); const current = await requestResult(store.get(id)); if (!current) throw new Error(`Unknown relation: ${id}`); const value = { ...current, status: 'withdrawn', deletedAt: new Date().toISOString(), withdrawalReason: reason }; validateRelation(value); store.put(clone(value)); await transactionComplete(tx); return clone(value); }
  async getSchemaVersion() { const db = await this.open(); const value = await requestResult(db.transaction(META).objectStore(META).get('schemaVersion')); return value?.value ?? SCHEMA_VERSION; }
}
export { DB_VERSION };
