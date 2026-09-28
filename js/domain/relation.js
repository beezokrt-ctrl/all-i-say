import { makeEntityId } from './ids.js';
import { validateRelation } from '../../data/schema.js';
function explicitProvenance(input) {
  if (!input?.origin) throw new Error('relation.provenance.origin is required');
  return input;
}
export function createRelation(input = {}) {
  const source=explicitProvenance(input.provenance);
  const value = { id: input.id || makeEntityId('rel'), type: input.type || 'develops', fromId: input.fromId, toId: input.toId, directional: input.directional !== false, provenance: { origin: source.origin, confidence: input.provenance?.confidence ?? null, model: input.provenance?.model ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString(), suggestionId: input.provenance?.suggestionId ?? null }, status: input.status || 'active', note: input.note ?? null, deletedAt: null };
  validateRelation(value); return Object.freeze(value);
}
