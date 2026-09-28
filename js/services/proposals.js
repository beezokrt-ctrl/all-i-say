import { getArchive } from './archive.js';

export async function getPendingRelationProposals(utteranceId, { archive } = {}) {
  const repository=archive || await getArchive();
  const pending=await repository.listSuggestions({status:'pending',kind:'relation'});
  const touching=pending.filter(({payload={}})=>payload.fromId===utteranceId||payload.toId===utteranceId);
  return Promise.all(touching.map(async suggestion=>{
    const {fromId,toId}=suggestion.payload||{};
    const otherId=fromId===utteranceId?toId:fromId;
    return {suggestion,other:otherId?await repository.getUtterance(otherId):null};
  }));
}

export async function acceptRelationProposal(id, { archive } = {}) {
  const repository=archive || await getArchive();
  return repository.acceptRelationSuggestion(id);
}

export async function rejectProposal(id, reason=null, { archive } = {}) {
  const repository=archive || await getArchive();
  return repository.rejectSuggestion(id,reason);
}
