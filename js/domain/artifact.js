import { makeEntityId } from './ids.js';
import { validateArtifact } from '../../data/schema.js';
export function createArtifact(input = {}) {
  const value = { id: input.id || makeEntityId('art'), schemaVersion: 3, kind: input.kind || 'file', storageRef: input.storageRef || 'blob://pending', mimeType: input.mimeType || 'application/octet-stream', capturedAt: input.capturedAt ?? null, checksum: input.checksum || null };
  validateArtifact(value); return Object.freeze(value);
}
