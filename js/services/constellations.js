import { getArchive } from "./archive.js";

export async function getConstellationPlaces() {
  const archive = await getArchive();
  const [constellations, memberships, utterances] = await Promise.all([
    archive.listConstellations({ status: "active" }),
    archive.listMemberships({ status: "active" }),
    archive.listUtterances({ status: "kept", limit: Infinity }),
  ]);
  const byId = new Map(utterances.map((u) => [u.id, u]));
  return constellations
    .map((constellation) => {
      const memberIds = memberships.filter((m) => m.constellationId === constellation.id).map((m) => m.utteranceId);
      const gathered = memberIds.map((id) => byId.get(id)).filter(Boolean);
      return { constellation, count: gathered.length, utterances: gathered };
    })
    .sort(
      (a, b) =>
        a.constellation.createdAt.localeCompare(b.constellation.createdAt) ||
        a.constellation.name.localeCompare(b.constellation.name),
    );
}

export async function getLegacyThreadGatherings() {
  const archive = await getArchive();
  const utterances = await archive.listUtterances({ status: "kept", limit: Infinity });
  const groups = new Map();
  for (const utterance of utterances)
    for (const name of utterance.metadata?.threads || []) {
      if (!name || name === "Unplaced") continue;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(utterance);
    }
  return [...groups]
    .map(([name, items]) => ({ name, count: items.length, utterances: items }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUtteranceGatheringState(utteranceId, { archive } = {}) {
  const repository = archive || (await getArchive());
  const [memberships, constellations] = await Promise.all([
    repository.listMemberships({ utteranceId, status: "active" }),
    repository.listConstellations({ status: "active" }),
  ]);
  const byId = new Map(constellations.map((constellation) => [constellation.id, constellation]));
  const gatherings = memberships
    .map((membership) => ({ membership, constellation: byId.get(membership.constellationId) }))
    .filter((item) => item.constellation);
  const gatheredIds = new Set(gatherings.map((item) => item.constellation.id));
  return {
    gatherings,
    available: constellations.filter((constellation) => !gatheredIds.has(constellation.id)),
  };
}

export async function placeUtterance(utteranceId, constellationId, { archive } = {}) {
  const repository = archive || (await getArchive());
  return repository.createMembership({
    utteranceId,
    constellationId,
    provenance: { origin: "author" },
  });
}

export async function withdrawUtteranceMembership(membershipId, { archive, reason = "author withdrawal" } = {}) {
  const repository = archive || (await getArchive());
  return repository.withdrawMembership(membershipId, reason);
}

export async function startConstellationFromUtterance(name, utteranceId, { archive } = {}) {
  const repository = archive || (await getArchive());
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("Constellation name is required");
  return repository.createConstellationWithMembership(
    { name: cleanName, provenance: { origin: "author" } },
    { utteranceId, provenance: { origin: "author" } },
  );
}
