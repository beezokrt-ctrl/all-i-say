import { makeEntityId } from './ids.js';
import { validateUtterance } from '../../data/schema.js';

export function createUtterance(input = {}) {
  const status = input.metadata?.status || 'kept';
  const utterance = {
    id: input.id || makeEntityId('utr'),
    text: input.text === null ? null : String(input.text ?? ''),
    schemaVersion: 3,
    createdAt: input.createdAt || new Date().toISOString(),
    spokenAt: input.spokenAt ?? null,
    datePrecision: input.datePrecision || 'unknown',
    displayDate: input.displayDate ?? null,
    source: {
      type: input.source?.type || 'unknown',
      conversationId: input.source?.conversationId ?? null,
      context: input.source?.context ?? null,
      artifactIds: Array.isArray(input.source?.artifactIds) ? [...input.source.artifactIds] : []
    },
    metadata: {
      form: input.metadata?.form || 'unknown',
      threads: Array.isArray(input.metadata?.threads) ? [...input.metadata.threads] : [],
      status
    }
  };
  validateUtterance(utterance);
  return Object.freeze(utterance);
}

export function updateUtteranceText() {
  throw new Error('Utterance text is immutable; create a new Utterance and Relation instead.');
}
