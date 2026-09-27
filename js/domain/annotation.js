import { makeEntityId } from './ids.js';
import { validateAnnotation } from '../../data/schema.js';

function explicitProvenance(input) {
  if (!input?.origin) throw new Error('annotation.provenance.origin is required');
  return input;
}
export function createAnnotation(input = {}) {
  const value = { id: input.id || makeEntityId('ann'), targetId: input.targetId, targetType: input.targetType || 'utterance', text: String(input.text ?? ''), createdAt: input.createdAt || new Date().toISOString(), provenance: { origin: explicitProvenance(input.provenance).origin, confidence: input.provenance?.confidence ?? null, model: input.provenance?.model ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString() } };
  validateAnnotation(value); return Object.freeze(value);
}
