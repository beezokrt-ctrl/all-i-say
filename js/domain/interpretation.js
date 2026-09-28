import { makeEntityId } from './ids.js';
import { validateInterpretation } from '../../data/schema.js';
export function createInterpretation(input = {}) {
  const value = { id: input.id || makeEntityId('int'), targetId: input.targetId, reading: String(input.reading ?? ''), createdAt: input.createdAt || new Date().toISOString(), provenance: { origin: input.provenance?.origin, model: input.provenance?.model ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString() }, relationIds: Array.isArray(input.relationIds) ? [...input.relationIds] : [] };
  validateInterpretation(value); return Object.freeze(value);
}
