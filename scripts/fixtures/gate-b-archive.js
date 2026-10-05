// Synthetic test content only. Shared by Node and the browser backup-button check.
export const FIXED_TIME = '2026-01-20T12:34:56.000Z';
export const EXACT_TEXT = '  "synthetic" <tag> & \'quoted\'\n\nʋ ȵ Ă A\u0306 🪶  end  ';
export const ARTIFACT_BYTES = Uint8Array.from([0, 255, 13, 10, 128, 34, 38, 60, 240, 159, 170, 182]);
const provenance = () => ({ origin: 'author', createdAt: '2020-02-03T04:05:06.000Z' });
const words = (id, text) => ({
  id, text, createdAt: '2019-06-15T10:20:30.000Z',
  metadata: { form: 'unknown', threads: [], status: 'kept' },
  source: { type: 'typed', context: 'Synthetic Gate B fixture' }
});

async function responseChain(archive, original) {
  const utterances = [original], relations = [];
  for (let index = 1; index <= 3; index += 1) {
    const response = await archive.createResponse(words(`gate-b-reply-${index}`, `${EXACT_TEXT}\n${index}`), {
      id: `gate-b-link-${index}`, toId: utterances.at(-1).id, type: 'responds-to',
      provenance: provenance(), note: `Synthetic link ${index}`
    });
    utterances.push(response.utterance);
    relations.push(response.relation);
  }
  return { utterances, relations };
}

async function withdrawnPlacement(archive, utteranceId) {
  const constellation = await archive.createConstellation({
    id: 'gate-b-place', name: 'Synthetic place', aliases: ['Synthetic alias'],
    description: '  Synthetic description\n<&  ', status: 'retired',
    createdAt: '2021-01-02T03:04:05.000Z', provenance: provenance()
  });
  const membership = await archive.createMembership({
    id: 'gate-b-membership', utteranceId, constellationId: constellation.id,
    createdAt: '2021-02-03T04:05:06.000Z', provenance: provenance(), note: '  Placement note  '
  });
  const withdrawn = await archive.withdrawMembership(membership.id, 'Synthetic withdrawal');
  return { constellations: [constellation], memberships: [withdrawn] };
}

export async function buildGateBArchive(archive) {
  const blob = new Blob([ARTIFACT_BYTES], { type: 'application/octet-stream' });
  const artifact = await archive.createArtifact(blob, {
    id: 'gate-b-artifact', kind: 'file', mimeType: blob.type,
    capturedAt: '2018-03-04T05:06:07.000Z', storageRef: 'idb://artifact/gate-b-artifact'
  });
  const original = await archive.createUtterance({
    ...words('gate-b-original', EXACT_TEXT), source: { type: 'imported', artifactIds: [artifact.id] }
  });
  const chain = await responseChain(archive, original);
  const uncertain = await archive.createUtterance({
    ...words('gate-b-uncertain', EXACT_TEXT),
    temporal: { earliest: '2019-03-01', latest: '2019-05-31', precision: 'approximate', display: 'spring 2019?' }
  });
  const transcription = await archive.createTranscription({
    id: 'gate-b-transcription', artifactId: artifact.id, utteranceId: original.id, text: EXACT_TEXT,
    createdAt: '2020-03-04T05:06:07.000Z', provenance: provenance(),
    attestation: { state: 'unreviewed', note: 'Synthetic transcription; separate from its artifact' }
  });
  const placement = await withdrawnPlacement(archive, original.id);
  const relation = await archive.createRelation({
    id: 'gate-b-withdrawn', fromId: uncertain.id, toId: original.id, type: 'returns-to',
    provenance: provenance(), note: '  Relation note\n<&  '
  });
  chain.relations.push(await archive.withdrawRelation(relation.id, 'Synthetic relation withdrawal'));
  chain.utterances[0] = await archive.tombstoneUtterance(original.id, 'Synthetic tombstone');
  chain.utterances.push(uncertain);
  return { ...chain, ...placement, artifacts: [{ ...artifact, blob }], transcriptions: [transcription] };
}

// Enumerate every snapshot array, so an unexpected extra/missing store also fails deep equality.
export async function comparableRecords(snapshot) {
  const result = {};
  for (const [kind, records] of Object.entries(snapshot)) {
    if (kind === 'exportedAt' || kind === 'schemaVersion') continue;
    result[kind] = await Promise.all(records.map(async record => {
      if (!(record.blob instanceof Blob)) return record;
      const { blob, ...fields } = record;
      const bytes = [...new Uint8Array(await blob.arrayBuffer())];
      return { ...fields, blob: { type: blob.type, size: blob.size, bytes } };
    }));
    result[kind].sort((a, b) => a.id.localeCompare(b.id));
  }
  return result;
}
