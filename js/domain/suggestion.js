import { makeEntityId } from './ids.js';
import { validateSuggestion } from '../../data/schema.js';

function explicitProvenance(input) {
  if (!input?.origin) throw new Error('suggestion.provenance.origin is required');
  return input;
}
export function createSuggestion(input = {}) {
  const value = { id: input.id || makeEntityId('sug'), kind: input.kind || 'relation', payload: input.payload || {}, provenance: { origin: explicitProvenance(input.provenance).origin, model: input.provenance?.model ?? null, confidence: input.provenance?.confidence ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString() }, status: input.status || 'pending' };
  validateSuggestion(value); return Object.freeze(value);
}
