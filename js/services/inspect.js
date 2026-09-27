import { getArchive } from './archive.js';
import { getUtteranceGatheringState } from './constellations.js';

export async function getUtteranceInspection(id) {
  const archive = await getArchive();
  const utterance = await archive.getUtterance(id);
  if (!utterance) return null;
  const artifactIds = utterance.source?.artifactIds || [];
  const [artifacts, transcriptionGroups, relations, gatheringState] = await Promise.all([
    Promise.all(artifactIds.map(artifactId => archive.getArtifact(artifactId))),
    Promise.all(artifactIds.map(artifactId => archive.listTranscriptions({ artifactId }))),
    archive.listRelations({ utteranceId: id, status: undefined }),
    getUtteranceGatheringState(id, { archive })
  ]);
  return {
    utterance,
    artifacts: artifacts.filter(Boolean),
    transcriptions: transcriptionGroups.flat(),
    relations,
    ...gatheringState
  };
}
