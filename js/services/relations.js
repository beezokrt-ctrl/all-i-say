import { makeEntityId } from "../domain/ids.js";
import { createRelation } from "../domain/relation.js";
import { getArchive, emit } from "./archive.js";

export { RELATION_TYPES as RELATION_OPTIONS } from "../../data/schema.js";

export async function listRelations(filters = {}) {
  const archive = await getArchive();
  return archive.listRelations(filters);
}

export async function createAuthorRelation(data) {
  const archive = await getArchive();
  const relation = createRelation({
    ...data,
    id: data.id || makeEntityId("rel"),
    provenance: { origin: "author", createdAt: new Date().toISOString() },
  });
  const stored = await archive.createRelation(relation);
  await emit("relation:created", stored);
  return stored;
}
