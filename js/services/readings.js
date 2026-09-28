import { getArchive } from './archive.js';

export async function addAnnotation(targetId, text, { archive } = {}) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Annotation cannot be empty');
  const repository = archive || await getArchive();
  return repository.createAnnotation({
    targetId,
    targetType: 'utterance',
    text: clean,
    provenance: { origin: 'author' }
  });
}

export async function addInterpretation(targetId, reading, { archive } = {}) {
  const clean = String(reading || '').trim();
  if (!clean) throw new Error('Interpretation cannot be empty');
  const repository = archive || await getArchive();
  return repository.createInterpretation({
    targetId,
    reading: clean,
    provenance: { origin: 'author' }
  });
}
