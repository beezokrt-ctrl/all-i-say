import { getArchive } from './archive.js';

export async function getPendingRelationSuggestions(utteranceId, { archive } = {}) {
  const repository=archive || await getArchive();
  const suggestions=await repository.listSuggestions({status:'pending',kind:'relation'});
  return suggestions.filter(suggestion=>suggestion.payload?.fromId===utteranceId||suggestion.payload?.toId===utteranceId);
}

export async function acceptRelationSuggestion(id, { archive } = {}) {
  const repository=archive || await getArchive();
  return repository.acceptRelationSuggestion(id);
}

export async function rejectSuggestion(id, { archive } = {}) {
  const repository=archive || await getArchive();
  return repository.rejectSuggestion(id);
}
