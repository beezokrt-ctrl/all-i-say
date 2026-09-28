import { getArchive } from './archive.js';
import { getUtteranceGatheringState } from './constellations.js';
import { getRelationSuggestions } from './suggestions.js';

export async function getUtteranceInspection(id, { archive } = {}) {
  const repository = archive || await getArchive();
  const utterance = await repository.getUtterance(id);
  if (!utterance) return null;
  const artifactIds = utterance.source?.artifactIds || [];
  const [artifacts, transcriptionGroups, relations, gatheringState, annotations, interpretations, suggestions] = await Promise.all([
    Promise.all(artifactIds.map(artifactId => repository.getArtifact(artifactId))),
    Promise.all(artifactIds.map(artifactId => repository.listTranscriptions({ artifactId }))),
    Promise.all([repository.listRelations({ utteranceId: id, status: 'active' }), repository.listRelations({ utteranceId: id, status: 'withdrawn' })]).then(([active, withdrawn]) => [...active, ...withdrawn]),
    getUtteranceGatheringState(id, { archive: repository }),
    repository.listAnnotations({ targetId: id, targetType: 'utterance' }),
    repository.listInterpretations({ targetId: id }),
    getRelationSuggestions(id, { archive: repository })
  ]);
  const proposalOtherIds=[...new Set(suggestions.map(s=>s.payload.fromId===id?s.payload.toId:s.payload.fromId))];
  const proposalOthers=await Promise.all(proposalOtherIds.map(otherId=>repository.getUtterance(otherId)));
  const proposalUtterances=new Map(proposalOthers.filter(Boolean).map(value=>[value.id,value]));
  const accepted=suggestions.filter(value=>value.status==='accepted');
  const canonicalRelations=await Promise.all(accepted.map(value=>repository.getRelation(value.decision.canonicalEntityId)));
  const canonicalById=new Map(canonicalRelations.filter(Boolean).map(value=>[value.id,value]));
  const proposalContext=suggestions.map(suggestion=>({
    suggestion,
    currentId:id,
    otherUtterance:proposalUtterances.get(suggestion.payload.fromId===id?suggestion.payload.toId:suggestion.payload.fromId)||null,
    canonicalRelation:canonicalById.get(suggestion.decision?.canonicalEntityId)||null
  }));
  return {
    utterance,
    artifacts: artifacts.filter(Boolean),
    transcriptions: transcriptionGroups.flat(),
    relations,
    annotations,
    interpretations,
    pendingSuggestions:proposalContext.filter(value=>value.suggestion.status==='pending'),
    proposalHistory:proposalContext.filter(value=>value.suggestion.status!=='pending')
      .sort((a,b)=>String(a.suggestion.decision?.decidedAt||'').localeCompare(String(b.suggestion.decision?.decidedAt||'')) || a.suggestion.id.localeCompare(b.suggestion.id)),
    ...gatheringState
  };
}
