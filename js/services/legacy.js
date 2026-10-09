import { getArchive } from "./archive.js";
import { parseLegacyDate } from "../storage/migrations/002_v2_to_v3.js";
export async function createLegacyUtteranceEntry(input = {}) {
  const text = String(input.text ?? "");
  if (!text.trim()) throw new Error("A non-empty utterance is required");
  const archive = await getArchive();
  return archive.createUtterance({
    text,
    createdAt: input.createdAt || new Date().toISOString(),
    temporal: input.temporal || parseLegacyDate(input.date),
    source: {
      type: input.source?.type || "typed",
      conversationId: input.source?.conversationId ?? null,
      context: input.source?.context ?? null,
      artifactIds: Array.isArray(input.source?.artifactIds) ? input.source.artifactIds : [],
    },
    metadata: {
      form: input.kind || "unknown",
      threads: Array.isArray(input.threads) ? input.threads : [],
      status: "kept",
    },
  });
}
