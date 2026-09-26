import { shellView, feedView, optionView, bridgeView } from './views.js';
import { getArchive, createUtterance } from './services/archive.js';
import { createArtifact, createTranscription } from './services/artifacts.js';
import { createLegacyUtteranceEntry } from './services/legacy.js';

class AllISayApp {
  constructor(root) { this.root = root; this.entries = []; this.route = 'home'; }
  async init() {
    const archive = await getArchive();
    const existing = await archive.listUtterances({ status: 'kept', limit: Infinity });
    this.entries = existing.length ? existing : await this.seed();
  }
  async seed() {
    const fallback = [{ id: 'seed-1', text: 'The true weight of water is that it is there.', date: 'Earlier', threads: ['Is', 'Jala Yāna'], kind: 'statement' }, { id: 'seed-2', text: 'No cause cares what it causes and no effect cares what caused it.', date: 'Earlier', threads: ['Undir Sólu', 'causality'], kind: 'statement' }, { id: 'seed-3', text: 'I am caused, yet I cause.', date: 'Earlier', threads: ['sovereignty', 'causality'], kind: 'statement' }];
    for (const item of fallback) await createLegacyUtteranceEntry(item);
    return this.loadEntries();
  }
  async loadEntries() { const archive = await getArchive(); return archive.listUtterances({ status: 'kept', limit: Infinity }); }
  async refreshFromArchive() { this.entries = await this.loadEntries(); this.refreshDataViews(); }
  mount() { this.root.innerHTML = shellView(this.entries); this.bind(); this.refreshDataViews(); }
  bind() {
    this.root.addEventListener('click', event => { const route = event.target.closest('[data-route]')?.dataset.route; if (route) this.navigate(route); if (event.target.id === 'saveEntry') this.saveEntry(); if (event.target.id === 'newDrift') this.renderDrift(); });
    this.root.addEventListener('change', event => { if (event.target.matches('#betweenA,#betweenB')) this.renderBetween(); });
  }
  navigate(route) { this.route = route; document.querySelectorAll('.panel').forEach(el => el.classList.toggle('is-active', el.id === route)); document.querySelectorAll('.nav-button').forEach(el => el.classList.toggle('is-active', el.dataset.route === route)); window.scrollTo({ top: 0, behavior: 'instant' }); if (route === 'drift') this.renderDrift(); if (route === 'between') this.renderBetween(); }
  async saveEntry() {
    const input = document.querySelector('#entryText');
    const file = document.querySelector('#artifactFile')?.files?.[0];
    const transcriptionText = document.querySelector('#artifactTranscription')?.value.trim() || '';
    if (!input?.value.trim() && !file) return;
    let artifactId;
    if (file) {
      const artifact = await createArtifact(file, { kind: file.type.startsWith('audio/') ? 'audio' : 'photo', mimeType: file.type, capturedAt: new Date().toISOString() });
      artifactId = artifact.id;
      if (transcriptionText) await createTranscription({ artifactId, text: transcriptionText, attestation: { state: 'confirmed-by-author', confirmedAt: new Date().toISOString() }, provenance: { origin: 'author', actorId: 'owner' } });
    }
    await createUtterance({ text: input?.value.trim() || (transcriptionText || null), datePrecision: 'day', spokenAt: new Date().toISOString(), displayDate: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), source: { type: file ? 'imported' : 'typed', artifactIds: artifactId ? [artifactId] : [] }, metadata: { form: 'fragment', threads: ['Unplaced'], status: input?.value.trim() ? 'kept' : 'awaiting-transcription' } });
    if (input) input.value = '';
    if (document.querySelector('#artifactFile')) document.querySelector('#artifactFile').value = '';
    if (document.querySelector('#artifactTranscription')) document.querySelector('#artifactTranscription').value = '';
    await this.refreshFromArchive(); this.navigate('home');
  }
  refreshDataViews() { document.querySelector('#count').textContent = `${this.entries.length} positions`; document.querySelector('#feed').innerHTML = feedView(this.entries); const a = document.querySelector('#betweenA'); const b = document.querySelector('#betweenB'); if (a && b) { a.innerHTML = optionView(this.entries, 0); b.innerHTML = optionView(this.entries, Math.max(0, this.entries.length - 1)); this.renderBetween(); } }
  renderDrift() { if (!this.entries.length) return; const entry = this.entries[Math.floor(Math.random() * this.entries.length)]; document.querySelector('#driftQuote').textContent = entry.text ?? '[Awaiting transcription]'; document.querySelector('#driftMeta').textContent = `${entry.displayDate || 'Undated'} · ${(entry.metadata?.threads || ['Unplaced']).join(' · ')}`; }
  renderBetween() { if (!this.entries.length) return; const ai = Number(document.querySelector('#betweenA')?.value || 0); const bi = Number(document.querySelector('#betweenB')?.value || 0); document.querySelector('#bridge').innerHTML = bridgeView(this.entries[ai], this.entries[bi]); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', async () => { const app = new AllISayApp(document.querySelector('#app')); await app.init(); app.mount(); });
else { const app = new AllISayApp(document.querySelector('#app')); app.init().then(() => app.mount()); }
