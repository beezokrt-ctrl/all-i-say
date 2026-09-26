import { makeEntityId } from './ids.js';
import { validateTranscription } from '../../data/schema.js';
export function createTranscription(input = {}) {
  const value = { id: input.id || makeEntityId('trn'), artifactId: input.artifactId, utteranceId: input.utteranceId ?? null, text: String(input.text ?? ''), createdAt: input.createdAt || new Date().toISOString(), provenance: { origin: input.provenance?.origin || 'author', actorId: input.provenance?.actorId ?? null, model: input.provenance?.model ?? null, createdAt: input.provenance?.createdAt || new Date().toISOString() }, attestation: { state: input.attestation?.state || 'unreviewed', confirmedAt: input.attestation?.confirmedAt ?? null, note: input.attestation?.note ?? null }, deletedAt: null };
  validateTranscription(value); return Object.freeze(value);
}
