import { makeEntityId } from './ids.js';
import { validateSuggestion, validateRelation } from '../../data/schema.js';

export function validateAcceptedRelation(suggestion, relation) {
  if (!suggestion || suggestion.status !== 'accepted' || suggestion.kind !== 'relation') {
    throw new Error('Suggested Relation requires an accepted relation Suggestion');
  }
  validateSuggestion(suggestion);
  if (!relation) throw new Error(`Accepted suggestion ${suggestion.id} references missing canonical relation`);
  validateRelation(relation);
  const payload=suggestion.payload;
  if (suggestion.decision.canonicalEntityId !== relation.id ||
      relation.provenance.suggestionId !== suggestion.id ||
      relation.provenance.origin !== 'author' ||
      relation.provenance.model != null || relation.provenance.confidence != null ||
      relation.fromId !== payload.fromId || relation.toId !== payload.toId ||
      relation.type !== payload.type || relation.directional !== (payload.directional ?? true)) {
    throw new Error(`Accepted suggestion ${suggestion.id} does not match its canonical relation`);
  }
  return true;
}

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
