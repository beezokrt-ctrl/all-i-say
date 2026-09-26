import { escapeHTML } from '../views.js';

export async function renderLibrary(filters = {}) {
  const { getLibraryItems, getFormTypes, getThreads } = await import('./library.js');
  const forms = await getFormTypes();
  const threads = await getThreads();
  const items = await getLibraryItems(filters);
  
  const formCheckboxes = forms.map(f => `<label><input type="checkbox" name="form" value="${escapeHTML(f)}" ${filters.form === f ? 'checked' : ''}><span>${escapeHTML(f)}</span></label>`).join('');
  const threadCheckboxes = threads.map(t => `<label><input type="checkbox" name="thread" value="${escapeHTML(t)}" ${filters.thread === t ? 'checked' : ''}><span>${escapeHTML(t)}</span></label>`).join('');
  
  const itemsMarkup = items.length ? items.map(item => `<article class="library-item" data-entry-id="${escapeHTML(item.id)}"><div class="eyebrow">${escapeHTML(item.displayDate || 'Undated')}</div><blockquote class="entry-quote">${escapeHTML(item.text ?? '[Awaiting transcription]')}</blockquote><div class="meta">${(item.metadata?.threads || []).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('')}</div></article>`).join('') : '<p class="note">No utterances match the current filters.</p>';
  
  return `<section id="library" class="panel">
    <div class="library-controls">
      <div class="library-facet">
        <h3>Form</h3>
        <div class="facet-group">${formCheckboxes || '<p class="small">No forms found</p>'}</div>
      </div>
      <div class="library-facet">
        <h3>Thread</h3>
        <div class="facet-group">${threadCheckboxes || '<p class="small">No threads found</p>'}</div>
      </div>
    </div>
    <div class="library-results">
      ${itemsMarkup}
    </div>
  </section>`;
}
