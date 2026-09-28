import { getArchive } from '../archive.js';

const RELATION_TYPES=new Set(['corrects','returns-to','develops','contradicts','responds-to','continues','similar-to']);

export async function proposeRelation(input, { model, confidence, archive } = {}) {
  if (!model || !String(model).trim()) throw new Error('AI proposal requires an explicit model');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('AI relation proposal requires confidence between 0 and 1');
  if (!input?.fromId || !input?.toId) throw new Error('Relation proposal requires both utterances');
  if (!RELATION_TYPES.has(input.type)) throw new Error('Relation proposal type is invalid');
  const repository=archive || await getArchive();
  const [from,to]=await Promise.all([repository.getUtterance(input.fromId),repository.getUtterance(input.toId)]);
  if(!from)throw new Error(`Unknown utterance: ${input.fromId}`);
  if(!to)throw new Error(`Unknown utterance: ${input.toId}`);
  return repository.createSuggestion({
    kind:'relation',
    payload:{
      type:input.type,
      fromId:input.fromId,
      toId:input.toId,
      directional:input.directional !== false,
      note:input.note ?? null
    },
    provenance:{origin:'ai',model:String(model).trim(),confidence},
    status:'pending'
  });
}
