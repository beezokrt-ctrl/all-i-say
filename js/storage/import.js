import { createUtterance } from '../domain/utterance.js';
import { SCHEMA_VERSION } from '../../data/schema.js';

export async function importAll(repository, payload, { dryRun = false } = {}) {
  if (!payload.exportFormatVersion || payload.exportFormatVersion !== 1) throw new Error('Unsupported export format version');
  if (!payload.utterances || !Array.isArray(payload.utterances)) throw new Error('Import payload missing utterances array');
  
  const errors = [];
  const validUtterances = [];
  
  for (const item of payload.utterances) {
    try {
      const utterance = createUtterance(item);
      validUtterances.push(utterance);
    } catch (error) {
      errors.push({ item, reason: error.message });
    }
  }
  
  if (errors.length > 0) {
    const err = new Error(`Import validation failed: ${errors.length} of ${payload.utterances.length} utterances are invalid`);
    err.failedEntries = errors;
    throw err;
  }
  
  if (dryRun) return { success: true, importedCount: validUtterances.length, dryRun: true };
  
  let importedCount = 0;
  for (const utterance of validUtterances) {
    try {
      await repository.createUtterance(utterance);
      importedCount++;
    } catch (error) {
      if (error.message.includes('Duplicate')) continue;
      throw error;
    }
  }
  
  return { success: true, importedCount, dryRun: false };
}
