import { escapeHTML } from '../views.js';

export async function renderLibrary(filters = {}) {
  const { getLibraryItems } = await import('../services/library.js');
  const items = await getLibraryItems(filters);
  const groups = new Map();

  for (const item of items) {
    const label = item.temporal?.earliest?.slice(0, 4) || 'Undated';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }

  const years = [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Undated') return 1;
    if (b === 'Undated') return -1;
    return Number(b) - Number(a);
  });

  const record = years.map(([year, entries]) =>
    '<section class="library-year"><div class="library-year-mark"><span>' + escapeHTML(year) +
    '</span><span class="small">' + entries.length + ' position' + (entries.length === 1 ? '' : 's') +
    '</span></div><div class="library-year-entries">' +
    entries.map(item =>
      '<article class="library-item" data-entry-id="' + escapeHTML(item.id) + '" tabindex="0">' +
      '<div class="eyebrow">' + escapeHTML(item.temporal?.display || 'Undated') + '</div>' +
      '<blockquote class="entry-quote">' + escapeHTML(item.text ?? '[Artifact preserved; no canonical utterance text]') +
      '</blockquote><div class="meta">' +
      (item.metadata?.threads || []).map(t => '<span class="tag">' + escapeHTML(t) + '</span>').join('') +
      '</div></article>'
    ).join('') + '</div></section>'
  ).join('');

  return '<div class="library-view"><header class="library-intro"><div class="eyebrow">Library</div>' +
    '<h2 class="big-title">The whole record.</h2>' +
    '<button class="button-ghost" data-route="search">Search your words</button></header>' +
    '<div class="library-record">' + (record || '<p class="note">Nothing has been kept yet.</p>') + '</div></div>';
}
