// Raw recovery copies preserve every old store, key, index definition and Blob.
// They are independent of export-format normalization and commit before upgrade writes.
export function backUpBeforeUpgrade({ indexedDB, name, request, oldVersion, upgrade, onError }) {
  const db = request.result,
    tx = request.transaction;
  if (oldVersion === 0) {
    upgrade();
    return;
  }
  const names = [...db.objectStoreNames];
  let pending = names.length,
    ready = false,
    failed = false;
  const snapshot = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), version: oldVersion, stores: {} };
  const fail = (error) => {
    if (failed) return;
    failed = true;
    onError(error);
    try {
      tx.abort();
    } catch {}
  };
  const save = () => {
    const r = indexedDB.open(name + "-upgrade-recovery", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("snapshots", { keyPath: "id" });
    r.onerror = () => fail(r.error || new Error("Could not create upgrade backup"));
    r.onblocked = () => fail(new Error("Upgrade backup is blocked. Close other archive windows and retry."));
    r.onsuccess = () => {
      const backup = r.result;
      if (failed) {
        backup.close();
        return;
      }
      try {
        const write = backup.transaction("snapshots", "readwrite");
        write.objectStore("snapshots").add(snapshot);
        write.oncomplete = () => {
          backup.close();
          ready = true;
        };
        write.onabort = write.onerror = () => {
          backup.close();
          fail(write.error || new Error("Could not save upgrade backup"));
        };
      } catch (error) {
        backup.close();
        fail(error);
      }
    };
  };
  for (const name of names) {
    const store = tx.objectStore(name);
    const entry = {
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexes: [...store.indexNames].map((key) => {
        const index = store.index(key);
        return { name: key, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
      }),
    };
    snapshot.stores[name] = entry;
    const keys = store.getAllKeys(),
      values = store.getAll();
    keys.onsuccess = () => {
      entry.keys = keys.result;
    };
    values.onsuccess = () => {
      entry.values = values.result;
      if (--pending === 0) save();
    };
  }
  if (!names.length) {
    fail(new Error("Cannot safely back up a database without stores"));
    return;
  }
  // Keep the versionchange transaction alive while the independent copy commits.
  // Run schema changes only inside an IDB callback, when that transaction is active.
  const pump = () => {
    if (failed) return;
    const r = tx.objectStore(names[0]).count();
    r.onsuccess = () => {
      if (failed) return;
      if (ready) {
        try {
          upgrade();
        } catch (error) {
          fail(error);
        }
      } else pump();
    };
    r.onerror = () => fail(r.error);
  };
  pump();
}
