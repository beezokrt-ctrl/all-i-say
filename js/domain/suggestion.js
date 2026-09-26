import { makeEntityId } from './ids.js';
import { validateSuggestion } from '../../data/schema.js';
export function createSuggestion(input = {}) {
  const value = { id: input.id || makeEntityId('sug'), kind: input.kind || 'relation', payload: input.payload || {}, provenance: { origin: input.provenance?.origin || 'ai', model: input.provenance?.model || 'unknown', confidence: input.provenance?.confidence ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString() }, status: input.status || 'pending' };
  validateSuggestion(value); return Object.freeze(value);
}
