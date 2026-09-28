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
  const relationOtherIds=[...new Set(relations.map(relation=>relation.fromId===id?relation.toId:relation.fromId))];
  const relationSuggestionIds=[...new Set(relations.map(relation=>relation.provenance?.suggestionId).filter(Boolean))];
  const [relationOthers, relationSuggestions]=await Promise.all([
    Promise.all(relationOtherIds.map(otherId=>repository.getUtterance(otherId))),
    Promise.all(relationSuggestionIds.map(suggestionId=>repository.getSuggestion(suggestionId)))
  ]);
  const relationUtterances=new Map(relationOthers.filter(Boolean).map(value=>[value.id,value]));
  const sourceSuggestions=new Map(relationSuggestions.filter(Boolean).map(value=>[value.id,value]));
  const relationContexts=relations.map(relation=>({
    relation,
    currentId:id,
    otherUtterance:relationUtterances.get(relation.fromId===id?relation.toId:relation.fromId)||null,
    sourceSuggestion:relation.provenance?.suggestionId ? sourceSuggestions.get(relation.provenance.suggestionId)||null : null
  }));
  const proposalOtherIds=[...new Set(pendingSuggestions.map(s=>s.payload.fromId===id?s.payload.toId:s.payload.fromId))];
  const proposalOthers=await Promise.all(proposalOtherIds.map(otherId=>repository.getUtterance(otherId)));
  const proposalUtterances=new Map(proposalOthers.filter(Boolean).map(value=>[value.id,value]));
  return {
    utterance,
    artifacts: artifacts.filter(Boolean),
    transcriptions: transcriptionGroups.flat(),
    relations,
    relationContexts,
    annotations,
    interpretations,
    pendingSuggestions:pendingSuggestions.map(suggestion=>({
      suggestion,
      currentId:id,
      otherUtterance:proposalUtterances.get(suggestion.payload.fromId===id?suggestion.payload.toId:suggestion.payload.fromId)||null
    })),
    ...gatheringState
  };
}
