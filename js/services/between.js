import { getArchive } from './archive.js';

export async function getBetweenData(fromId, toId) {
  const archive = await getArchive();
  const [from, to, fromRelations] = await Promise.all([
    archive.getUtterance(fromId),
    archive.getUtterance(toId),
    archive.listRelations({ utteranceId: fromId, status: undefined })
  ]);
  const relations = fromRelations.filter(relation =>
    ((relation.fromId === fromId && relation.toId === toId) ||
     (relation.fromId === toId && relation.toId === fromId))
  );
  return { from, to, relations };
}
