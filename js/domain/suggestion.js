import { makeEntityId } from './ids.js';
import { validateSuggestion } from '../../data/schema.js';

function explicitProvenance(input) {
  if (!input?.origin) throw new Error('suggestion.provenance.origin is required');
  return input;
}

export function createSuggestion(input = {}) {
  const source=explicitProvenance(input.provenance);
  const value = {
    id: input.id || makeEntityId('sug'),
    kind: input.kind || 'relation',
    payload: input.payload || {},
    provenance: {
      origin: source.origin,
      model: source.model ?? null,
      confidence: source.confidence ?? null,
      createdAt: source.createdAt || new Date().toISOString()
    },
    status: input.status || 'pending',
    decision: input.decision ?? null
  };
  validateSuggestion(value);
  return Object.freeze(value);
}
