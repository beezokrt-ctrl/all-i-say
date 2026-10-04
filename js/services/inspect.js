import { getArchive } from './archive.js';
import { getUtteranceGatheringState } from './constellations.js';

export async function getUtteranceInspection(id, { archive } = {}) {
  const repository = archive || await getArchive();
  const utterance = await repository.getUtterance(id);
  if (!utterance) return null;
  const artifactIds = utterance.source?.artifactIds || [];
  const [artifacts, transcriptionGroups, relations, gatheringState] = await Promise.all([
    Promise.all(artifactIds.map(artifactId => repository.getArtifact(artifactId))),
    Promise.all(artifactIds.map(artifactId => repository.listTranscriptions({ artifactId }))),
    Promise.all([repository.listRelations({ utteranceId: id, status: 'active' }), repository.listRelations({ utteranceId: id, status: 'withdrawn' })]).then(([active, withdrawn]) => [...active, ...withdrawn]),
    getUtteranceGatheringState(id, { archive: repository })
  ]);
  const relatedIds=[...new Set(relations.map(r=>r.fromId===id?r.toId:r.fromId))];
  const relatedUtterances=await Promise.all(relatedIds.map(otherId=>repository.getUtterance(otherId)));
  return {
    relatedUtterances:relatedUtterances.filter(Boolean),
    utterance,
    artifacts: artifacts.filter(Boolean),
    transcriptions: transcriptionGroups.flat(),
    relations,
    ...gatheringState
  };
}
