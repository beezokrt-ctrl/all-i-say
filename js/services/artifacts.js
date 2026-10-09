import { getArchive, emit } from './archive.js';
import { createArtifact as buildArtifact } from '../domain/artifact.js';
import { createTranscription as buildTranscription } from '../domain/transcription.js';

export async function createArtifact(blob, meta = {}) {
  const archive = await getArchive();
  const artifact = await archive.createArtifact(blob, { ...meta, id: meta.id || undefined });
  await emit('artifact:created', artifact);
  return artifact;
}

export async function createTranscription(data) {
  const archive = await getArchive();
  const transcription = await archive.createTranscription(data);
  await emit('transcription:created', transcription);
  return transcription;
}

export async function confirmTranscription(id, attestation = {}) {
  const archive = await getArchive();
  const transcription = await archive.confirmTranscription(id, attestation);
  await emit('transcription:confirmed', transcription);
  return transcription;
}

export { buildArtifact, buildTranscription };


export async function createCapture(blob, artifactData, utteranceData, transcriptionData = null) {
  const archive = await getArchive();
  const capture = await archive.createCapture(blob, artifactData, utteranceData, transcriptionData);
  await emit('artifact:created', capture.artifact);
  if (capture.transcription) await emit('transcription:created', capture.transcription);
  await emit('utterance:created', capture.utterance);
  return capture;
}
