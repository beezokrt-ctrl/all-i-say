import { ArchiveRepository } from './repository.js';
import { createUtterance } from '../domain/utterance.js';

const clone = value => value === undefined ? value : structuredClone(value);

/**
 * Small repository double for domain/service tests.
 * It intentionally implements only the first Issue 2 contract needed by
 * tests; unimplemented capabilities retain the base repository behavior.
 */
export class InMemoryArchiveRepository extends ArchiveRepository {
  constructor(initialUtterances = []) {
    super();
    this.utterances = new Map();
    initialUtterances.forEach(value => this._insert(value));
  }

  _insert(value) {
    const utterance = createUtterance(value);
    if (this.utterances.has(utterance.id)) throw new Error(`Duplicate utterance id: ${utterance.id}`);
    this.utterances.set(utterance.id, clone(utterance));
    return utterance;
  }

  async getUtterance(id) {
    return clone(this.utterances.get(id));
  }

  async listUtterances({ status = 'kept', includeHistory = false, limit = Infinity } = {}) {
    return [...this.utterances.values()]
      .filter(value => includeHistory === true || value.metadata.status === status)
      .slice(0, limit)
      .map(clone);
  }

  async createUtterance(data) {
    return clone(this._insert(data));
  }

  async tombstoneUtterance(id, reason = null) {
    const current = this.utterances.get(id);
    if (!current) throw new Error(`Unknown utterance: ${id}`);
    const tombstone = {
      ...current,
      metadata: { ...current.metadata, status: 'tombstoned' },
      deletedAt: new Date().toISOString(),
      deletionReason: reason
    };
    this.utterances.set(id, tombstone);
    return clone(tombstone);
  }
}
