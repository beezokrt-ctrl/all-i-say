import { getArchive } from './archive.js';

export async function getBetweenData(fromId, toId) {
  const archive = await getArchive();
  const [from, to, fromRelations, toRelations] = await Promise.all([
    archive.getUtterance(fromId),
    archive.getUtterance(toId),
    archive.listRelations({ utteranceId: fromId, status: undefined }),
    archive.listRelations({ utteranceId: toId, status: undefined })
  ]);
  const relations = [...fromRelations, ...toRelations].filter((relation, index, all) =>
    all.findIndex(item => item.id === relation.id) === index &&
    ((relation.fromId === fromId && relation.toId === toId) ||
     (relation.fromId === toId && relation.toId === fromId))
  );
  return { from, to, relations };
}
