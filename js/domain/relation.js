import { makeEntityId } from './ids.js';
import { validateRelation } from '../../data/schema.js';
export function createRelation(input = {}) {
  const value = { id: input.id || makeEntityId('rel'), type: input.type || 'develops', fromId: input.fromId, toId: input.toId, directional: input.directional !== false, provenance: { origin: input.provenance?.origin, confidence: input.provenance?.confidence ?? null, model: input.provenance?.model ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString(), suggestionId: input.provenance?.suggestionId ?? null }, status: input.status || 'active', note: input.note ?? null, deletedAt: input.deletedAt ?? null, ...(input.withdrawalReason !== undefined ? {withdrawalReason: input.withdrawalReason} : {}) };
  validateRelation(value); return Object.freeze(value);
}
