import { makeEntityId } from './ids.js';
import { validateAnnotation } from '../../data/schema.js';
export function createAnnotation(input = {}) {
  const value = { id: input.id || makeEntityId('ann'), targetId: input.targetId, targetType: input.targetType || 'utterance', text: String(input.text ?? ''), createdAt: input.createdAt || new Date().toISOString(), provenance: { origin: input.provenance?.origin, confidence: input.provenance?.confidence ?? null, model: input.provenance?.model ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString() } };
  validateAnnotation(value); return Object.freeze(value);
}
