import { IndexedDBArchiveRepository } from '../storage/indexeddb.js';

let repositoryInstance = null;
const eventListeners = {};

/**
 * Singleton archive service. Views and services depend on this, never on
 * storage adapters directly. The repository is swappable; the service
 * contract is stable.
 */
export async function getArchive() {
  if (!repositoryInstance) {
    repositoryInstance = new IndexedDBArchiveRepository({ name: 'all-i-say' });
    await repositoryInstance.open();
  }
  return repositoryInstance;
}

/**
 * Minimal pub/sub for archive mutations.
 */
export function on(eventName, callback) {
  if (!eventListeners[eventName]) eventListeners[eventName] = [];
  eventListeners[eventName].push(callback);
  return () => {
    eventListeners[eventName] = eventListeners[eventName].filter(cb => cb !== callback);
  };
}

export async function emit(eventName, payload) {
  const callbacks = eventListeners[eventName] || [];
  for (const cb of callbacks) {
    try {
      await cb(payload);
    } catch (error) {
      console.error(`Error in ${eventName} listener:`, error);
    }
  }
}

/**
 * Facade for common archive queries.
 */
export async function getUtterances(filters = {}) {
  const archive = await getArchive();
  return archive.listUtterances(filters);
}

export async function getUtterance(id) {
  const archive = await getArchive();
  return archive.getUtterance(id);
}

export async function createUtterance(data) {
  const archive = await getArchive();
  const utterance = await archive.createUtterance(data);
  await emit('utterance:created', utterance);
  return utterance;
}
