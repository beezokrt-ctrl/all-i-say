import { getArchive } from './archive.js';
import { getUtteranceGatheringState } from './constellations.js';
import { getPendingRelationProposals } from './proposals.js';

export async function getUtteranceInspection(id, { archive } = {}) {
  const repository = archive || await getArchive();
  const utterance = await repository.getUtterance(id);
  if (!utterance) return null;
  const artifactIds = utterance.source?.artifactIds || [];
  const [artifacts, transcriptionGroups, relations, gatheringState, annotations, interpretations, proposals] = await Promise.all([
    Promise.all(artifactIds.map(artifactId => repository.getArtifact(artifactId))),
    Promise.all(artifactIds.map(artifactId => repository.listTranscriptions({ artifactId }))),
    Promise.all([repository.listRelations({ utteranceId: id, status: 'active' }), repository.listRelations({ utteranceId: id, status: 'withdrawn' })]).then(([active, withdrawn]) => [...active, ...withdrawn]),
    getUtteranceGatheringState(id, { archive: repository }),
    repository.listAnnotations({ targetId: id, targetType: 'utterance' }),
    repository.listInterpretations({ targetId: id }),
    getPendingRelationProposals(id, { archive: repository })
  ]);
  return {
    utterance,
    artifacts: artifacts.filter(Boolean),
    transcriptions: transcriptionGroups.flat(),
    relations,
    annotations,
    interpretations,
    proposals,
    ...gatheringState
  };
}
