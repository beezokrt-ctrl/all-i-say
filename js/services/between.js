import { getArchive } from './archive.js';

export async function getBetweenData(fromId, toId) {
  const archive = await getArchive();
  const [from, to, relations] = await Promise.all([archive.getUtterance(fromId), archive.getUtterance(toId), archive.listRelations({ utteranceId: fromId, status: undefined })]);
  return { from, to, relations: relations.filter(relation => relation.fromId === toId || relation.toId === toId || relation.fromId === fromId || relation.toId === fromId) };
}
