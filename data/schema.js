export const SCHEMA_VERSION = 3;
export const DATE_PRECISIONS = ['exact', 'day', 'month', 'year', 'unknown', 'approximate'];
export const RELATION_TYPES = ['corrects', 'returns-to', 'develops', 'contradicts', 'responds-to', 'continues', 'similar-to'];
export const FORM_TYPES = ['fragment', 'lyric', 'fiction', 'question', 'essay', 'note', 'correction', 'unknown'];

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (value, field, { nullable = false, empty = false } = {}) => {
  if (value === null && nullable) return;
  if (typeof value !== 'string' || (!empty && !value.trim())) throw new Error(`${field} must be a ${nullable ? 'nullable ' : ''}string`);
};
const provenance = (value, field) => {
  if (!object(value)) throw new Error(`${field}.provenance must be an object`);
  string(value.origin, `${field}.provenance.origin`);
};

export function validateUtterance(value) {
  if (!object(value)) throw new Error('Utterance must be an object');
  string(value.id, 'utterance.id');
  const awaiting = value.metadata?.status === 'awaiting-transcription';
  string(value.text, 'utterance.text', { nullable: awaiting, empty: awaiting });
  string(value.createdAt, 'utterance.createdAt');
  if (value.spokenAt !== null && value.spokenAt !== undefined) string(value.spokenAt, 'utterance.spokenAt');
  if (value.datePrecision && !DATE_PRECISIONS.includes(value.datePrecision)) throw new Error('utterance.datePrecision is invalid');
  if (value.source !== undefined && !object(value.source)) throw new Error('utterance.source must be an object');
  if (value.metadata !== undefined && !object(value.metadata)) throw new Error('utterance.metadata must be an object');
  return true;
}

export function validateArtifact(value) {
  if (!object(value)) throw new Error('Artifact must be an object');
  string(value.id, 'artifact.id'); string(value.kind, 'artifact.kind'); string(value.storageRef, 'artifact.storageRef'); string(value.mimeType, 'artifact.mimeType');
  return true;
}

export function validateTranscription(value) {
  if (!object(value)) throw new Error('Transcription must be an object');
  string(value.id, 'transcription.id'); string(value.artifactId, 'transcription.artifactId'); string(value.text, 'transcription.text', { empty: true }); string(value.createdAt, 'transcription.createdAt');
  provenance(value, 'transcription');
  if (!object(value.attestation)) throw new Error('transcription.attestation must be an object');
  return true;
}

export function validateAnnotation(value) {
  if (!object(value)) throw new Error('Annotation must be an object');
  string(value.id, 'annotation.id'); string(value.targetId, 'annotation.targetId'); string(value.targetType, 'annotation.targetType'); string(value.text, 'annotation.text'); string(value.createdAt, 'annotation.createdAt'); provenance(value, 'annotation');
  return true;
}

export function validateInterpretation(value) {
  if (!object(value)) throw new Error('Interpretation must be an object');
  string(value.id, 'interpretation.id'); string(value.targetId, 'interpretation.targetId'); string(value.reading, 'interpretation.reading'); string(value.createdAt, 'interpretation.createdAt'); provenance(value, 'interpretation');
  return true;
}

export function validateRelation(value) {
  if (!object(value)) throw new Error('Relation must be an object');
  string(value.id, 'relation.id'); string(value.type, 'relation.type'); string(value.fromId, 'relation.fromId'); string(value.toId, 'relation.toId');
  if (typeof value.directional !== 'boolean') throw new Error('relation.directional must be boolean');
  provenance(value, 'relation');
  return true;
}

export function validateConstellation(value) {
  if (!object(value)) throw new Error('Constellation must be an object');
  string(value.id, 'constellation.id'); string(value.name, 'constellation.name'); string(value.createdAt, 'constellation.createdAt'); provenance(value, 'constellation');
  return true;
}

export function validateSuggestion(value) {
  if (!object(value)) throw new Error('Suggestion must be an object');
  string(value.id, 'suggestion.id'); string(value.kind, 'suggestion.kind');
  if (!object(value.payload)) throw new Error('suggestion.payload must be an object');
  provenance(value, 'suggestion');
  if (!['pending', 'accepted', 'rejected'].includes(value.status)) throw new Error('suggestion.status is invalid');
  return true;
}

export function validateTemporalWindow(value = {}) {
  if (value.earliest !== undefined) string(value.earliest, 'temporal.earliest');
  if (value.latest !== undefined) string(value.latest, 'temporal.latest');
  if (value.precision && !DATE_PRECISIONS.includes(value.precision)) throw new Error('temporal.precision is invalid');
  if (value.display !== undefined) string(value.display, 'temporal.display', { empty: true });
  return true;
}
