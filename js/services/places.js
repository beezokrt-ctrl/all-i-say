import { getArchive } from './archive.js';

export async function getPlaces() {
  const archive = await getArchive();
  const items = await archive.listUtterances({ status: 'kept', limit: Infinity });
  const groups = new Map();
  for (const item of items) {
    for (const name of item.metadata?.threads || []) {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    }
  }
  return [...groups].map(([name, utterances]) => ({
    name,
    count: utterances.length,
    utterances
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
