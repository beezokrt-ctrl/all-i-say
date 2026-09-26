import { getArchive } from './archive.js';

export async function getUtteranceInspection(id) {
  const archive = await getArchive();
  const utterance = await archive.getUtterance(id);
  if (!utterance) return null;
  const artifacts = await Promise.all((utterance.source?.artifactIds || []).map(artifactId => archive.getArtifact(artifactId)));
  const transcriptions = (await Promise.all((utterance.source?.artifactIds || []).map(artifactId => archive.listTranscriptions({ artifactId })))).flat();
  return { utterance, artifacts: artifacts.filter(Boolean), transcriptions };
}
