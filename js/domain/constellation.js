import { makeEntityId } from './ids.js';
import { validateConstellation, validateMembership } from '../../data/schema.js';

export function createConstellation(input = {}) {
  const value = {
    id: input.id || makeEntityId('con'),
    name: input.name,
    aliases: Array.isArray(input.aliases) ? [...input.aliases] : [],
    description: input.description ?? null,
    createdAt: input.createdAt || new Date().toISOString(),
    status: input.status || 'active',
    provenance: {
      origin: input.provenance?.origin || 'author',
      createdAt: input.provenance?.createdAt || new Date().toISOString()
    }
  };
  validateConstellation(value);
  return Object.freeze(value);
}

export function createMembership(input = {}) {
  const value = {
    id: input.id || makeEntityId('mem'),
    constellationId: input.constellationId,
    utteranceId: input.utteranceId,
    createdAt: input.createdAt || new Date().toISOString(),
    status: input.status || 'active',
    provenance: {
      origin: input.provenance?.origin || 'author',
      createdAt: input.provenance?.createdAt || new Date().toISOString()
    },
    note: input.note ?? null,
    deletedAt: input.deletedAt ?? null
  };
  validateMembership(value);
  return Object.freeze(value);
}
