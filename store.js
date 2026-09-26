import { SEED_ENTRIES } from '../data/seed.js';
import { APP_CONFIG } from './config.js';

const clone = value => JSON.parse(JSON.stringify(value));

export class EntryStore {
  constructor(storage = window.localStorage) { this.storage = storage; }
  load() {
    try {
      const raw = this.storage.getItem(APP_CONFIG.storageKey);
      return raw ? JSON.parse(raw) : clone(SEED_ENTRIES);
    } catch { return clone(SEED_ENTRIES); }
  }
  save(entries) { this.storage.setItem(APP_CONFIG.storageKey, JSON.stringify(entries)); }
  add(entries, input) {
    const entry = {
      id: crypto.randomUUID?.() || `entry-${Date.now()}`,
      text: input.text.trim(),
      date: input.date || new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}),
      threads: input.threads?.length ? input.threads : ['Unplaced'],
      kind: input.kind || 'statement',
      createdAt: new Date().toISOString()
    };
    const next = [...entries, entry];
    this.save(next);
    return next;
  }
}