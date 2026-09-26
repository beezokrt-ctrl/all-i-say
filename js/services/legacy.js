import { createUtterance } from '../domain/utterance.js';
import { getArchive } from './archive.js';

/**
 * Legacy-compatible adapter for the old entry shape.
 *
 * It converts a simple text/date/threads/kind object into the v3 Utterance
 * schema while preserving the shape required by the existing UI.
 */
export async function createLegacyUtteranceEntry(input = {}) {
  const text = String(input.text ?? '').trim();
  if (!text) throw new Error('A non-empty utterance is required');

  const archive = await getArchive();
  const utterance = await archive.createUtterance({
    text,
    createdAt: new Date().toISOString(),
    spokenAt: input.spokenAt ?? null,
    datePrecision: input.datePrecision || 'unknown',
    displayDate: input.date || null,
    source: {
      type: input.source?.type || 'typed',
      conversationId: input.source?.conversationId ?? null,
      context: input.source?.context ?? null,
      artifactIds: Array.isArray(input.source?.artifactIds) ? input.source.artifactIds : []
    },
    metadata: {
      form: input.kind || 'fragment',
      threads: Array.isArray(input.threads) ? input.threads : ['Unplaced'],
      status: 'kept'
    }
  });

  return utterance;
}
