import { getArchive, emit } from "./archive.js";

import { RESPONSE_TYPES } from "../../data/schema.js";
export { RESPONSE_TYPES } from "../../data/schema.js";

export async function respondToUtterance(
  { targetId, text, type = "responds-to", provenance },
  { archive, now = new Date() } = {},
) {
  if (typeof text !== "string" || !text.trim()) throw new Error("Write a response first.");
  if (!RESPONSE_TYPES.includes(type)) throw new Error("Choose a response relation.");
  if (provenance?.origin !== "author") throw new Error("A response requires explicit author provenance.");
  const repository = archive || (await getArchive());
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const saved = await repository.createResponse(
    {
      text,
      createdAt: now.toISOString(),
      temporal: {
        earliest: day,
        latest: day,
        precision: "day",
        display: now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      },
      source: { type: "typed" },
      metadata: { form: "fragment", status: "kept" },
    },
    { toId: targetId, type, directional: true, provenance: { ...provenance, createdAt: now.toISOString() } },
  );
  await emit("utterance:created", saved.utterance);
  return saved;
}
