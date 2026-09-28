import { getArchive } from './archive.js';

export async function getRelationSuggestions(utteranceId, { archive } = {}) {
  const repository=archive || await getArchive();
  const suggestions=await repository.listSuggestions({status:undefined,kind:'relation'});
  return suggestions.filter(suggestion=>suggestion.payload?.fromId===utteranceId||suggestion.payload?.toId===utteranceId);
}

export async function acceptRelationSuggestion(id, { archive } = {}) {
  const repository=archive || await getArchive();
  return repository.acceptRelationSuggestion(id);
}

export async function rejectSuggestion(id, { archive, reason = null } = {}) {
  const repository=archive || await getArchive();
  return repository.rejectSuggestion(id,reason);
}

export async function getPendingRelationSuggestions(utteranceId, options = {}) {
  return (await getRelationSuggestions(utteranceId,options)).filter(value=>value.status==='pending');
}
