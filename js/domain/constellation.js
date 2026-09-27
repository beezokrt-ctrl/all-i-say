import { makeEntityId } from './ids.js';
import { validateConstellation, validateMembership } from '../../data/schema.js';

function explicitProvenance(input, entity) {
  if (!input?.origin) throw new Error(`${entity}.provenance.origin is required`);
  return {
    ...input,
    origin: input.origin,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function createConstellation(input = {}) {
  const aliases = input.aliases === undefined ? [] : input.aliases;
  const value = {
    id: input.id || makeEntityId('con'),
    name: input.name,
    aliases: Array.isArray(aliases) ? [...aliases] : aliases,
    description: input.description ?? null,
    createdAt: input.createdAt || new Date().toISOString(),
    status: input.status || 'active',
    provenance: explicitProvenance(input.provenance, 'constellation')
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
    provenance: explicitProvenance(input.provenance, 'membership'),
    note: input.note ?? null,
    withdrawnAt: input.withdrawnAt ?? null,
    withdrawalReason: input.withdrawalReason ?? null
  };
  validateMembership(value);
  return Object.freeze(value);
}
