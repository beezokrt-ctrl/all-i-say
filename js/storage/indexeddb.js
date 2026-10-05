import { migrateLegacyTemporal } from "./migrations/legacy-temporal.js";
import { backUpBeforeUpgrade } from "./upgrade-backup.js";
import { ArchiveRepository } from "./repository.js";
import { createUtterance } from "../domain/utterance.js";
import { createArtifact } from "../domain/artifact.js";
import { createTranscription } from "../domain/transcription.js";
import { createRelation } from "../domain/relation.js";
import { createConstellation, createMembership } from "../domain/constellation.js";
import {
  validateUtterance,
  validateTranscription,
  validateRelation,
  validateMembership,
  SCHEMA_VERSION,
  RESPONSE_TYPES,
} from "../../data/schema.js";
import { recordsEquivalent, recordsStructurallyEquivalent } from "./conflict.js";
const DB_VERSION = 5,
  UTTERANCES = "utterances",
  ARTIFACTS = "artifacts",
  TRANSCRIPTIONS = "transcriptions",
  RELATIONS = "relations",
  CONSTELLATIONS = "constellations",
  MEMBERSHIPS = "memberships",
  META = "meta";
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
const result = (r) =>
  new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error || new Error("IndexedDB request failed"));
  });
const complete = (t) =>
  new Promise((ok, no) => {
    t.oncomplete = ok;
    t.onerror = () => no(t.error || new Error("IndexedDB transaction failed"));
    t.onabort = () => no(t.error || new Error("IndexedDB transaction aborted"));
  });
export class IndexedDBArchiveRepository extends ArchiveRepository {
  constructor({ name = "all-i-say", indexedDB = globalThis.indexedDB } = {}) {
    super();
    if (!indexedDB) throw new Error("IndexedDB is not available");
    this.name = name;
    this.indexedDB = indexedDB;
    this.databasePromise = null;
  }
  async open() {
    if (!this.databasePromise)
      this.databasePromise = new Promise((ok, no) => {
        let upgradeError,
          blocked = false;
        const r = this.indexedDB.open(this.name, DB_VERSION);
        r.onupgradeneeded = (event) => {
          if (blocked) {
            r.transaction.abort();
            return;
          }
          backUpBeforeUpgrade({
            indexedDB: this.indexedDB,
            name: this.name,
            request: r,
            oldVersion: event.oldVersion,
            onError: (error) => {
              upgradeError = error;
            },
            upgrade: () => {
              const db = r.result,
                tx = r.transaction;
              const u = db.objectStoreNames.contains(UTTERANCES)
                ? tx.objectStore(UTTERANCES)
                : db.createObjectStore(UTTERANCES, {
                    keyPath: "id",
                  });
              if (!u.indexNames.contains("createdAt")) u.createIndex("createdAt", "createdAt");
              if (u.indexNames.contains("spokenAt")) u.deleteIndex("spokenAt");
              if (!u.indexNames.contains("temporalEarliest")) u.createIndex("temporalEarliest", "temporal.earliest");
              if (!u.indexNames.contains("status")) u.createIndex("status", "metadata.status");
              if (!db.objectStoreNames.contains(ARTIFACTS))
                db.createObjectStore(ARTIFACTS, {
                  keyPath: "id",
                });
              if (!db.objectStoreNames.contains(TRANSCRIPTIONS)) {
                const s = db.createObjectStore(TRANSCRIPTIONS, {
                  keyPath: "id",
                });
                s.createIndex("artifactId", "artifactId");
                s.createIndex("utteranceId", "utteranceId");
              }
              if (!db.objectStoreNames.contains(RELATIONS)) {
                const s = db.createObjectStore(RELATIONS, {
                  keyPath: "id",
                });
                s.createIndex("fromId", "fromId");
                s.createIndex("toId", "toId");
                s.createIndex("status", "status");
              }
              if (!db.objectStoreNames.contains(CONSTELLATIONS)) {
                const s = db.createObjectStore(CONSTELLATIONS, {
                  keyPath: "id",
                });
                s.createIndex("status", "status");
                s.createIndex("createdAt", "createdAt");
              }
              if (!db.objectStoreNames.contains(MEMBERSHIPS)) {
                const s = db.createObjectStore(MEMBERSHIPS, {
                  keyPath: "id",
                });
                s.createIndex("constellationId", "constellationId");
                s.createIndex("utteranceId", "utteranceId");
                s.createIndex("status", "status");
              }
              if (!db.objectStoreNames.contains(META))
                db.createObjectStore(META, {
                  keyPath: "key",
                });
              if (event.oldVersion < 4) {
                const req = u.openCursor();
                req.onsuccess = () => {
                  const c = req.result;
                  if (!c) return;
                  const v = c.value;
                  try {
                    const migrated = migrateLegacyTemporal(v);
                    if (!v.temporal) c.update(migrated);
                  } catch (error) {
                    upgradeError = error;
                    tx.abort();
                    return;
                  }
                  c.continue();
                };
              }
            },
          });
        };
        r.onsuccess = () => {
          if (blocked) {
            r.result.close();
            return;
          }
          r.result.onversionchange = () => r.result.close();
          ok(r.result);
        };
        r.onerror = () => {
          this.databasePromise = null;
          no(upgradeError || r.error || new Error("Unable to open IndexedDB"));
        };
        r.onblocked = () => {
          blocked = true;
          no(new Error("IndexedDB upgrade is blocked. Close other archive windows and reload."));
        };
      });
    return this.databasePromise;
  }
  async getUtterance(id) {
    const db = await this.open();
    return clone(await result(db.transaction(UTTERANCES).objectStore(UTTERANCES).get(id)));
  }
  async listUtterances({
    since,
    until,
    form,
    thread,
    status = "kept",
    includeHistory = false,
    limit = 100,
    cursor,
  } = {}) {
    const db = await this.open(),
      tx = db.transaction(UTTERANCES, "readonly"),
      values = [];
    await new Promise((ok, no) => {
      const r = tx.objectStore(UTTERANCES).index("createdAt").openCursor(null, "prev");
      r.onsuccess = () => {
        const c = r.result;
        if (!c || values.length >= limit) return ok();
        const v = c.value,
          t = v.temporal || {};
        if (
          (!cursor || v.createdAt < cursor) &&
          (!since || !t.latest || t.latest >= since) &&
          (!until || !t.earliest || t.earliest <= until) &&
          (includeHistory === true || v.metadata?.status === status) &&
          (!form || v.metadata?.form === form) &&
          (!thread || v.metadata?.threads?.includes(thread))
        )
          values.push(clone(v));
        c.continue();
      };
      r.onerror = () => no(r.error);
    });
    return values;
  }
  async createUtterance(data) {
    const v = createUtterance(data),
      db = await this.open(),
      tx = db.transaction(UTTERANCES, "readwrite");
    tx.objectStore(UTTERANCES).add(clone(v));
    await complete(tx);
    return clone(v);
  }
  async createResponse(utteranceData, relationData) {
    if (relationData.provenance?.origin !== "author") throw new Error("A response requires explicit author provenance");
    if (!RESPONSE_TYPES.includes(relationData.type))
      throw new Error("Invalid response relation");
    const utterance = createUtterance(utteranceData);
    if (utterance.metadata.status !== "kept" || typeof utterance.text !== "string" || !utterance.text.trim())
      throw new Error("A response requires kept words");
    const relation = createRelation({ ...relationData, fromId: utterance.id, directional: true, status: "active" });
    if (relation.toId === utterance.id) throw new Error("A response must address an existing different utterance");
    const db = await this.open(),
      tx = db.transaction([UTTERANCES, RELATIONS], "readwrite");
    const done = complete(tx);
    try {
      const target = await result(tx.objectStore(UTTERANCES).get(relation.toId));
      if (!target || target.metadata?.status === "tombstoned")
        throw new Error("These words are unavailable for a new response");
      tx.objectStore(UTTERANCES).add(clone(utterance));
      tx.objectStore(RELATIONS).add(clone(relation));
      await done;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      await done.catch(() => {});
      throw error;
    }
    return { utterance: clone(utterance), relation: clone(relation) };
  }
  async tombstoneUtterance(id, reason = null) {
    const db = await this.open(),
      tx = db.transaction(UTTERANCES, "readwrite"),
      s = tx.objectStore(UTTERANCES),
      cur = await result(s.get(id));
    if (!cur) throw new Error(`Unknown utterance: ${id}`);
    const v = {
      ...cur,
      metadata: {
        ...cur.metadata,
        status: "tombstoned",
      },
      deletedAt: new Date().toISOString(),
      deletionReason: reason,
    };
    validateUtterance(v);
    s.put(clone(v));
    await complete(tx);
    return clone(v);
  }
  async createArtifact(blob, meta = {}) {
    if (!(blob instanceof Blob)) throw new Error("Artifact storage requires a Blob");
    const a = createArtifact({
        ...meta,
        storageRef: meta.storageRef || "idb://artifact/pending",
      }),
      db = await this.open(),
      tx = db.transaction(ARTIFACTS, "readwrite");
    tx.objectStore(ARTIFACTS).add({
      ...a,
      blob,
    });
    await complete(tx);
    return clone(a);
  }
  async getArtifact(id) {
    const db = await this.open();
    return clone(await result(db.transaction(ARTIFACTS).objectStore(ARTIFACTS).get(id)));
  }
  async listArtifacts() {
    const db = await this.open();
    return (await result(db.transaction(ARTIFACTS).objectStore(ARTIFACTS).getAll())).map(clone);
  }
  async createTranscription(data) {
    if (data.provenance?.origin === "ai") throw new Error("Machine output must remain a pending Suggestion");
    const v = createTranscription(data),
      db = await this.open(),
      tx = db.transaction(TRANSCRIPTIONS, "readwrite");
    tx.objectStore(TRANSCRIPTIONS).add(clone(v));
    await complete(tx);
    return clone(v);
  }
  async listTranscriptions({ artifactId, utteranceId } = {}) {
    const db = await this.open(),
      s = db.transaction(TRANSCRIPTIONS).objectStore(TRANSCRIPTIONS);
    if (!artifactId && !utteranceId) return (await result(s.getAll())).map(clone);
    return (await result(s.index(artifactId ? "artifactId" : "utteranceId").getAll(artifactId || utteranceId))).map(
      clone,
    );
  }
  async confirmTranscription(id, attestation = {}) {
    const db = await this.open(),
      tx = db.transaction(TRANSCRIPTIONS, "readwrite"),
      s = tx.objectStore(TRANSCRIPTIONS),
      cur = await result(s.get(id));
    if (!cur) throw new Error(`Unknown transcription: ${id}`);
    const v = {
      ...cur,
      attestation: {
        ...cur.attestation,
        ...attestation,
        state: attestation.state || "confirmed-by-author",
        confirmedAt: attestation.confirmedAt || new Date().toISOString(),
      },
    };
    validateTranscription(v);
    s.put(clone(v));
    await complete(tx);
    return clone(v);
  }
  async createRelation(data) {
    if (data.provenance?.origin === "ai") throw new Error("Machine output must remain a pending Suggestion");
    const v = createRelation(data),
      db = await this.open(),
      tx = db.transaction(RELATIONS, "readwrite");
    tx.objectStore(RELATIONS).add(clone(v));
    await complete(tx);
    return clone(v);
  }
  async listRelations({ utteranceId, status = "active", includeHistory = false } = {}) {
    const db = await this.open(),
      s = db.transaction(RELATIONS).objectStore(RELATIONS);
    let vs;
    if (utteranceId) {
      const [a, b] = await Promise.all([
        result(s.index("fromId").getAll(utteranceId)),
        result(s.index("toId").getAll(utteranceId)),
      ]);
      vs = [...a, ...b];
    } else vs = await result(s.getAll());
    const seen = new Set();
    return vs
      .filter((v) => !seen.has(v.id) && seen.add(v.id) && (includeHistory === true || v.status === status))
      .map(clone);
  }
  async withdrawRelation(id, reason = null) {
    const db = await this.open(),
      tx = db.transaction(RELATIONS, "readwrite"),
      s = tx.objectStore(RELATIONS),
      cur = await result(s.get(id));
    if (!cur) throw new Error(`Unknown relation: ${id}`);
    const v = {
      ...cur,
      status: "withdrawn",
      deletedAt: new Date().toISOString(),
      withdrawalReason: reason,
    };
    validateRelation(v);
    s.put(clone(v));
    await complete(tx);
    return clone(v);
  }
  async createConstellation(data) {
    if (data.provenance?.origin === "ai") throw new Error("Machine output must remain a pending Suggestion");
    const v = createConstellation(data),
      db = await this.open(),
      tx = db.transaction(CONSTELLATIONS, "readwrite");
    tx.objectStore(CONSTELLATIONS).add(clone(v));
    await complete(tx);
    return clone(v);
  }
  async createConstellationWithMembership(constellationData, membershipData) {
    if ([constellationData, membershipData].some((value) => value.provenance?.origin === "ai"))
      throw new Error("Machine output must remain a pending Suggestion");
    const constellation = createConstellation(constellationData);
    const membership = createMembership({ ...membershipData, constellationId: constellation.id });
    const db = await this.open(),
      tx = db.transaction([CONSTELLATIONS, MEMBERSHIPS, UTTERANCES], "readwrite");
    const cs = tx.objectStore(CONSTELLATIONS),
      ms = tx.objectStore(MEMBERSHIPS),
      us = tx.objectStore(UTTERANCES);
    try {
      if (!(await result(us.get(membership.utteranceId))))
        throw new Error(`Unknown utterance: ${membership.utteranceId}`);
      cs.add(clone(constellation));
      ms.add(clone(membership));
    } catch (error) {
      tx.abort();
      throw error;
    }
    await complete(tx);
    return { constellation: clone(constellation), membership: clone(membership) };
  }
  async getConstellation(id) {
    const db = await this.open();
    return clone(await result(db.transaction(CONSTELLATIONS).objectStore(CONSTELLATIONS).get(id)));
  }
  async listConstellations({ status = "active", includeHistory = false } = {}) {
    const db = await this.open(),
      vs = await result(db.transaction(CONSTELLATIONS).objectStore(CONSTELLATIONS).getAll());
    return vs
      .filter((v) => includeHistory === true || v.status === status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(clone);
  }
  async createMembership(data) {
    if (data.provenance?.origin === "ai") throw new Error("Machine output must remain a pending Suggestion");
    const v = createMembership(data),
      db = await this.open(),
      tx = db.transaction([MEMBERSHIPS, CONSTELLATIONS, UTTERANCES], "readwrite"),
      m = tx.objectStore(MEMBERSHIPS),
      cs = tx.objectStore(CONSTELLATIONS),
      us = tx.objectStore(UTTERANCES);
    try {
      if (!(await result(cs.get(v.constellationId)))) throw new Error(`Unknown constellation: ${v.constellationId}`);
      if (!(await result(us.get(v.utteranceId)))) throw new Error(`Unknown utterance: ${v.utteranceId}`);
      const existing = await result(m.index("constellationId").getAll(v.constellationId));
      if (existing.some((x) => x.utteranceId === v.utteranceId && x.status === "active"))
        throw new Error("Active membership already exists");
      m.add(clone(v));
    } catch (error) {
      tx.abort();
      throw error;
    }
    await complete(tx);
    return clone(v);
  }
  async listMemberships({ constellationId, utteranceId, status = "active", includeHistory = false } = {}) {
    const db = await this.open(),
      s = db.transaction(MEMBERSHIPS).objectStore(MEMBERSHIPS);
    let vs;
    if (constellationId) vs = await result(s.index("constellationId").getAll(constellationId));
    else if (utteranceId) vs = await result(s.index("utteranceId").getAll(utteranceId));
    else vs = await result(s.getAll());
    return vs.filter((v) => includeHistory === true || v.status === status).map(clone);
  }
  async withdrawMembership(id, reason = null) {
    const db = await this.open(),
      tx = db.transaction(MEMBERSHIPS, "readwrite"),
      s = tx.objectStore(MEMBERSHIPS),
      cur = await result(s.get(id));
    if (!cur) throw new Error(`Unknown membership: ${id}`);
    const v = {
      ...cur,
      status: "withdrawn",
      withdrawnAt: new Date().toISOString(),
      withdrawalReason: reason,
    };
    delete v.deletedAt;
    validateMembership(v);
    s.put(clone(v));
    await complete(tx);
    return clone(v);
  }
  async importAll(payload, { conflict = "error" } = {}) {
    if (!["error", "skip"].includes(conflict)) throw new Error("Unsupported import conflict policy");
    const db = await this.open();
    const specs = [
      ["utterances", UTTERANCES, payload.utterances, (x) => x],
      ["artifacts", ARTIFACTS, payload.artifacts, (x) => ({ ...x.meta, blob: x.blob })],
      ["transcriptions", TRANSCRIPTIONS, payload.transcriptions, (x) => x],
      ["relations", RELATIONS, payload.relations, (x) => x],
      ["constellations", CONSTELLATIONS, payload.constellations, (x) => x],
      ["memberships", MEMBERSHIPS, payload.memberships, (x) => x],
    ];
    const tx = db.transaction([...specs.map((x) => x[1]), META], "readwrite");
    const done = complete(tx);
    // recordsEquivalent may await Blob.arrayBuffer(). IndexedDB can auto-commit
    // while code awaits non-IDB work, so a harmless META read keeps this one
    // transaction live until validation and all writes have been scheduled.
    let keepAlive = true;
    const pump = () => {
      if (!keepAlive) return;
      let request;
      try {
        request = tx.objectStore(META).get("__import_keepalive__");
      } catch {
        return;
      }
      request.onsuccess = () => {
        if (keepAlive) pump();
      };
    };
    pump();

    const skipped = Object.fromEntries(specs.map(([label]) => [label, 0]));
    const planned = [];
    const incomingUtterances = new Set(payload.utterances.map((x) => x.id));
    const incomingArtifacts = new Set(payload.artifacts.map((x) => x.meta.id));
    const incomingConstellations = new Set(payload.constellations.map((x) => x.id));

    const requireExisting = async (storeName, id, message) => {
      if (!(await result(tx.objectStore(storeName).get(id)))) throw new Error(message);
    };

    try {
      for (const [label, storeName, items, materialize] of specs) {
        for (const item of items) {
          const value = materialize(item);
          const existing = await result(tx.objectStore(storeName).get(value.id));
          if (existing) {
            if (conflict === "error") throw new Error(`Import conflict: ${label.slice(0, -1)} ${value.id}`);
            if (!(await recordsEquivalent(existing, value)))
              throw new Error(`Import conflict differs: ${label.slice(0, -1)} ${value.id}`);
            skipped[label] += 1;
          } else {
            planned.push({ storeName, value });
          }
        }
      }

      for (const transcription of payload.transcriptions) {
        if (!incomingArtifacts.has(transcription.artifactId))
          await requireExisting(
            ARTIFACTS,
            transcription.artifactId,
            `Transcription ${transcription.id} references missing artifact ${transcription.artifactId}`,
          );
        if (transcription.utteranceId && !incomingUtterances.has(transcription.utteranceId))
          await requireExisting(
            UTTERANCES,
            transcription.utteranceId,
            `Transcription ${transcription.id} references missing utterance ${transcription.utteranceId}`,
          );
      }
      for (const relation of payload.relations) {
        if (!incomingUtterances.has(relation.fromId))
          await requireExisting(
            UTTERANCES,
            relation.fromId,
            `Relation ${relation.id} references missing utterance ${relation.fromId}`,
          );
        if (!incomingUtterances.has(relation.toId))
          await requireExisting(
            UTTERANCES,
            relation.toId,
            `Relation ${relation.id} references missing utterance ${relation.toId}`,
          );
      }
      for (const utterance of payload.utterances) {
        for (const artifactId of utterance.source?.artifactIds || []) {
          if (!incomingArtifacts.has(artifactId))
            await requireExisting(
              ARTIFACTS,
              artifactId,
              `Utterance ${utterance.id} references missing artifact ${artifactId}`,
            );
        }
      }
      for (const membership of payload.memberships) {
        if (!incomingConstellations.has(membership.constellationId))
          await requireExisting(
            CONSTELLATIONS,
            membership.constellationId,
            `Membership ${membership.id} references missing constellation ${membership.constellationId}`,
          );
        if (!incomingUtterances.has(membership.utteranceId))
          await requireExisting(
            UTTERANCES,
            membership.utteranceId,
            `Membership ${membership.id} references missing utterance ${membership.utteranceId}`,
          );
        if (membership.status === "active") {
          const existing = await result(
            tx.objectStore(MEMBERSHIPS).index("constellationId").getAll(membership.constellationId),
          );
          if (
            existing.some(
              (x) => x.id !== membership.id && x.utteranceId === membership.utteranceId && x.status === "active",
            )
          ) {
            throw new Error(
              `Active membership already exists for ${membership.constellationId} / ${membership.utteranceId}`,
            );
          }
        }
      }

      for (const { storeName, value } of planned) tx.objectStore(storeName).add(clone(value));
      keepAlive = false;
      await done;
    } catch (error) {
      keepAlive = false;
      try {
        tx.abort();
      } catch {}
      try {
        await done;
      } catch {}
      throw error;
    }

    const counts = Object.fromEntries(specs.map(([label, , items]) => [label, items.length - skipped[label]]));
    return { success: true, dryRun: false, counts, skipped, conflict };
  }

  async getSchemaVersion() {
    return SCHEMA_VERSION;
  }
  async getExportSnapshot() {
    const db = await this.open();
    const stores = [UTTERANCES, ARTIFACTS, TRANSCRIPTIONS, RELATIONS, CONSTELLATIONS, MEMBERSHIPS];
    const tx = db.transaction(stores, "readonly");
    const exportedAt = new Date().toISOString();
    const [records] = await Promise.all([
      Promise.all(stores.map((name) => result(tx.objectStore(name).getAll()))),
      complete(tx),
    ]);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      ...Object.fromEntries(stores.map((name, index) => [name, records[index]])),
    };
  }
  async getLastBackupExport() {
    const db = await this.open();
    const record = await result(db.transaction(META).objectStore(META).get("last-backup-export"));
    return clone(record?.value ?? null);
  }
  async recordBackupExport(receipt) {
    if (!receipt || typeof receipt.filename !== "string" || !receipt.filename.trim())
      throw new Error("Backup filename is required");
    for (const field of ["exportedAt", "requestedAt"]) {
      if (typeof receipt[field] !== "string" || !Number.isFinite(Date.parse(receipt[field])))
        throw new Error(`Invalid backup ${field}`);
    }
    const value = { filename: receipt.filename, exportedAt: receipt.exportedAt, requestedAt: receipt.requestedAt };
    const db = await this.open(),
      tx = db.transaction(META, "readwrite");
    tx.objectStore(META).put({ key: "last-backup-export", value });
    await complete(tx);
    return clone(value);
  }
}
export { DB_VERSION };
