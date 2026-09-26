import { SEED_ENTRIES } from '../data/seed.js';
import { getArchive } from './archive.js';

/**
 * Initialize the archive with seed data on first run.
 * Called once during app startup to populate IndexedDB if empty.
 */
export async function seedArchiveIfEmpty() {
  const archive = await getArchive();
  const existing = await archive.listUtterances({ status: undefined, limit: 1 });
  if (existing.length === 0) {
    for (const seed of SEED_ENTRIES) {
      await archive.createUtterance(seed);
    }
  }
}
