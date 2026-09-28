import { getArchive } from './archive.js';
import { getUtteranceGatheringState } from './constellations.js';
import { getPendingRelationSuggestions } from './suggestions.js';

export async function getUtteranceInspection(id, { archive } = {}) {
  const repository = archive || await getArchive();
  const utterance = await repository.getUtterance(id);
  if (!utterance) return null;
  const artifactIds = utterance.source?.artifactIds || [];
  const [artifacts, transcriptionGroups, relations, gatheringState, annotations, interpretations, pendingSuggestions] = await Promise.all([
    Promise.all(artifactIds.map(artifactId => repository.getArtifact(artifactId))),
    Promise.all(artifactIds.map(artifactId => repository.listTranscriptions({ artifactId }))),
    Promise.all([repository.listRelations({ utteranceId: id, status: 'active' }), repository.listRelations({ utteranceId: id, status: 'withdrawn' })]).then(([active, withdrawn]) => [...active, ...withdrawn]),
    getUtteranceGatheringState(id, { archive: repository }),
    repository.listAnnotations({ targetId: id, targetType: 'utterance' }),
    repository.listInterpretations({ targetId: id }),
    getPendingRelationSuggestions(id, { archive: repository })
  ]);
  const proposalOtherIds=[...new Set(pendingSuggestions.map(s=>s.payload.fromId===id?s.payload.toId:s.payload.fromId))];
  const proposalOthers=await Promise.all(proposalOtherIds.map(otherId=>repository.getUtterance(otherId)));
  const proposalUtterances=new Map(proposalOthers.filter(Boolean).map(value=>[value.id,value]));
  return {
    utterance,
    artifacts: artifacts.filter(Boolean),
    transcriptions: transcriptionGroups.flat(),
    relations,
    annotations,
    interpretations,
    pendingSuggestions:pendingSuggestions.map(suggestion=>({
      suggestion,
      otherUtterance:proposalUtterances.get(suggestion.payload.fromId===id?suggestion.payload.toId:suggestion.payload.fromId)||null
    })),
    ...gatheringState
  };
}
