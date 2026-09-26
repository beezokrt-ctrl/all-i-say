import { getArchive } from './archive.js';

export async function getLibraryItems(filters = {}) {
  const archive = await getArchive();
  const { form, thread, status = 'kept', since, until } = filters;
  return archive.listUtterances({ form, thread, status, since, until, limit: Infinity });
}

export async function getFormTypes() {
  const archive = await getArchive();
  const all = await archive.listUtterances({ status: undefined, limit: Infinity });
  const forms = new Set(all.map(u => u.metadata?.form).filter(Boolean));
  return Array.from(forms).sort();
}

export async function getThreads() {
  const archive = await getArchive();
  const all = await archive.listUtterances({ status: undefined, limit: Infinity });
  const threads = new Set();
  all.forEach(u => (u.metadata?.threads || []).forEach(t => threads.add(t)));
  return Array.from(threads).sort();
}
