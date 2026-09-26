import { shellView, feedView, optionView, bridgeView } from './views.js';
import { getArchive, createUtterance } from './services/archive.js';
import { createArtifact, createTranscription } from './services/artifacts.js';
import { renderLibrary } from './views/library.js';
import { getUtteranceInspection } from './services/inspect.js';
import { inspectView } from './views/inspect.js';
import { searchArchive } from './services/search.js';
import { getPlaces } from './services/places.js';
import { getBetweenData } from './services/between.js';

class AllISayApp {
  constructor(root) { this.root = root; this.entries = []; this.route = 'home'; this.returnRoute = 'home'; this.driftId = null; }
  async init() {
    const archive = await getArchive();
    const existing = await archive.listUtterances({ status: 'kept', limit: Infinity });
    this.entries = existing.length ? existing : await this.seed();
  }
  async seed() { return this.loadEntries(); }
  async loadEntries() { const archive = await getArchive(); return archive.listUtterances({ status: 'kept', limit: Infinity }); }
  async refreshFromArchive() { this.entries = await this.loadEntries(); this.refreshDataViews(); }
  mount() { this.root.innerHTML = shellView(this.entries); this.bind(); this.refreshDataViews(); }
  bind() {
    this.root.addEventListener('click', event => { const route = event.target.closest('[data-route]')?.dataset.route; if (route) this.navigate(route); if (event.target.id === 'saveEntry') this.saveEntry(); if (event.target.id === 'newDrift') this.renderDrift(); if (event.target.id === 'driftInspect' && this.driftId) this.inspect(this.driftId); if (event.target.id === 'inspectBack') this.navigate(this.returnRoute || 'home'); if (event.target.matches('[data-place]')) this.renderPlace(event.target.closest('[data-place]').dataset.place); const entry=event.target.closest('[data-entry-id]'); if(entry) this.inspect(entry.dataset.entryId); });
    this.root.addEventListener('submit', event => { if (event.target.id === 'searchForm') { event.preventDefault(); this.renderSearch(document.querySelector('#searchInput')?.value || ''); } });
    this.root.addEventListener('change', event => { if (event.target.matches('#betweenA,#betweenB')) this.renderBetween(); });
    this.root.addEventListener('keydown', event => { const entry=event.target.closest?.('[data-entry-id]'); if(entry && (event.key==='Enter'||event.key===' ')){ event.preventDefault(); this.inspect(entry.dataset.entryId); } });
  }
  navigate(route) { this.route = route; document.querySelectorAll('.panel').forEach(el => el.classList.toggle('is-active', el.id === route)); document.querySelectorAll('.nav-button').forEach(el => el.classList.toggle('is-active', el.dataset.route === route)); window.scrollTo({ top: 0, behavior: 'instant' }); if (route === 'drift') this.renderDrift(); if (route === 'between') this.renderBetween(); if (route === 'library') this.renderLibrary(); if (route === 'search') this.renderSearch(''); if (route === 'places') this.renderPlaces(); }
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
    const now = new Date();
    const localDay = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
    await createUtterance({ text: input?.value.trim() || null, temporal: { earliest: localDay, latest: localDay, precision: 'day', display: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }, source: { type: file ? 'imported' : 'typed', artifactIds: artifactId ? [artifactId] : [] }, metadata: { form: 'fragment', threads: ['Unplaced'], status: input?.value.trim() ? 'kept' : 'awaiting-transcription' } });
    if (input) input.value = '';
    if (document.querySelector('#artifactFile')) document.querySelector('#artifactFile').value = '';
    if (document.querySelector('#artifactTranscription')) document.querySelector('#artifactTranscription').value = '';
    await this.refreshFromArchive(); this.navigate('home');
  }
  refreshDataViews() { document.querySelector('#count').textContent = `${this.entries.length} positions`; document.querySelector('#feed').innerHTML = feedView(this.entries); const a = document.querySelector('#betweenA'); const b = document.querySelector('#betweenB'); if (a && b) { a.innerHTML = optionView(this.entries, 0); b.innerHTML = optionView(this.entries, Math.max(0, this.entries.length - 1)); this.renderBetween(); } }
  renderDrift() { if (!this.entries.length) return; const pool=this.entries.length>1?this.entries.filter(e=>e.id!==this.driftId):this.entries; const entry=pool[Math.floor(Math.random()*pool.length)]; this.driftId=entry.id; document.querySelector('#driftQuote').textContent=entry.text??'[Artifact preserved; no canonical utterance text]'; document.querySelector('#driftMeta').textContent=entry.temporal?.display||'Undated'; const inspect=document.querySelector('#driftInspect'); if(inspect) inspect.hidden=false; }
  async renderBetween() { if (!this.entries.length) return; const aid=document.querySelector('#betweenA')?.value, bid=document.querySelector('#betweenB')?.value, mount=document.querySelector('#bridge'); if(!aid||!bid||!mount)return; const data=await getBetweenData(aid,bid); mount.innerHTML=bridgeView(data.from,data.to,data.relations); }
  async renderLibrary(){ const mount=document.querySelector('#libraryMount'); if(mount) mount.innerHTML=await renderLibrary({}); }
  async renderSearch(query=''){ const mount=document.querySelector('#searchMount'); if(!mount)return; const results=query?await searchArchive(query):[]; mount.innerHTML=this.searchMarkup(results,query); }
  searchMarkup(results,query){ const items=results.map(item=>'<article class="library-item" data-entry-id="'+this.escape(item.id)+'"><div class="eyebrow">'+this.escape(item.temporal?.display||'Undated')+'</div><blockquote class="entry-quote">'+this.escape(item.text??'[Artifact preserved]')+'</blockquote></article>').join(''); return '<div class="eyebrow">Search</div><h2 class="big-title">Find your exact words.</h2><form id="searchForm" class="search-form"><input id="searchInput" class="search-input" value="'+this.escape(query)+'" placeholder="Words, thread, or form"><button class="button-primary">Search</button></form><div class="library-results">'+(query?(items||'<p class="note">Nothing matches those words.</p>'):'<p class="note">Search the record without changing it.</p>')+'</div>'; }
  escape(value){ return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  async renderPlaces(){ const mount=document.querySelector('#placesMount'); if(!mount)return; this.places=await getPlaces(); mount.innerHTML='<div class="eyebrow">Places</div><h2 class="big-title">Where your words have gathered.</h2><p class="hero-copy">A place does not own what was said. It is one way of standing among it.</p><div class="places-grid">'+(this.places.map(p=>'<button class="place-card" data-place="'+this.escape(p.name)+'"><span class="place-name">'+this.escape(p.name)+'</span><span class="small">'+p.count+' positions</span></button>').join('')||'<p class="note">No places yet.</p>')+'</div><div id="placeDetail"></div>'; }
  renderPlace(name){ const p=this.places?.find(x=>x.name===name),mount=document.querySelector('#placeDetail'); if(!p||!mount)return; mount.innerHTML='<div class="eyebrow">Place · '+this.escape(p.name)+'</div>'+p.utterances.map(u=>'<article class="entry" data-entry-id="'+this.escape(u.id)+'"><div class="eyebrow">'+this.escape(u.temporal?.display||'Undated')+'</div><blockquote class="entry-quote">'+this.escape(u.text??'[Artifact preserved]')+'</blockquote></article>').join(''); mount.scrollIntoView({behavior:'smooth'}); }
  async inspect(id){ const mount=document.querySelector('#inspectMount'); if(!mount)return; if(this.route!=='inspect')this.returnRoute=this.route; mount.innerHTML=inspectView(await getUtteranceInspection(id)); this.navigate('inspect'); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', async () => { const app = new AllISayApp(document.querySelector('#app')); await app.init(); app.mount(); });
else { const app = new AllISayApp(document.querySelector('#app')); app.init().then(() => app.mount()); }
