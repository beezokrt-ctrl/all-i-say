import { shellView, feedView, optionView, bridgeView } from './views.js';
import { getArchive, createUtterance } from './services/archive.js';
import { createArtifact, createTranscription } from './services/artifacts.js';
import { renderLibrary } from './views/library.js';
import { getUtteranceInspection } from './services/inspect.js';
import { inspectView } from './views/inspect.js';
import { searchArchive, searchConstellations } from './services/search.js';
import { getConstellationPlaces, getLegacyThreadGatherings, placeUtterance, withdrawUtteranceMembership, startConstellationFromUtterance } from './services/constellations.js';
import { placesView, constellationDetailView, legacyGatheringDetailView } from './views/places.js';
import { getBetweenData } from './services/between.js';
import { addAnnotation, addInterpretation } from './services/readings.js';

export class AllISayApp {
  constructor(root) { this.root = root; this.entries = []; this.route = 'home'; this.returnRoute = 'home'; this.returnScroll = 0; this.driftId = null; this.inspectId = null; this.placesDirty = false; this.placeDetail = null; }
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
    this.root.addEventListener('click', async event => { const route = event.target.closest('[data-route]')?.dataset.route; if (route) this.navigate(route); if (event.target.id === 'saveEntry') this.saveEntry(); if (event.target.id === 'mobileMore') this.toggleMobileMore(); if (event.target.id === 'newDrift') this.renderDrift(); if (event.target.id === 'driftInspect' && this.driftId) this.inspect(this.driftId); if (event.target.id === 'inspectBack') { if(this.returnRoute==='places'&&this.placesDirty){await this.renderPlaces();this.placesDirty=false;} this.navigate(this.returnRoute || 'home', { refresh: false, scrollTop: this.returnScroll }); } if(event.target.id==='openConstellationPicker')this.toggleConstellationPicker(true); if(event.target.id==='closeConstellationPicker')this.toggleConstellationPicker(false); const gather=event.target.closest('[data-gather-constellation]'); if(gather)await this.gatherInto(gather.dataset.gatherConstellation); const withdrawal=event.target.closest('[data-withdraw-membership]'); if(withdrawal)await this.withdrawGathering(withdrawal.dataset.withdrawMembership); const searchConstellation=event.target.closest('[data-search-constellation]'); if(searchConstellation)await this.openSearchConstellation(searchConstellation.dataset.searchConstellation); const constellation=event.target.closest('[data-constellation-id]'); if(constellation)this.renderConstellation(constellation.dataset.constellationId); const legacy=event.target.closest('[data-legacy-place]'); if(legacy)this.renderLegacyPlace(legacy.dataset.legacyPlace); const entry=event.target.closest('[data-entry-id]'); if(entry) this.inspect(entry.dataset.entryId); });
    this.root.addEventListener('submit', async event => { if (event.target.id === 'searchForm') { event.preventDefault(); this.renderSearch(document.querySelector('#searchInput')?.value || ''); } if(event.target.id==='newConstellationForm'){event.preventDefault();await this.startConstellation(document.querySelector('#newConstellationName')?.value||'');} if(event.target.id==='annotationForm'){event.preventDefault();await this.keepAnnotation(document.querySelector('#annotationText')?.value||'');} if(event.target.id==='interpretationForm'){event.preventDefault();await this.keepInterpretation(document.querySelector('#interpretationText')?.value||'');} });
    this.root.addEventListener('input', event => { if(event.target.id==='constellationFilter')this.filterConstellations(event.target.value); });
    this.root.addEventListener('change', event => { if (event.target.matches('#betweenA,#betweenB')) this.renderBetween(); });
    this.root.addEventListener('keydown', event => { const entry=event.target.closest?.('[data-entry-id]'); if(entry && (event.key==='Enter'||event.key===' ')){ event.preventDefault(); this.inspect(entry.dataset.entryId); } if(event.key==='Escape'&&this.route==='inspect')this.toggleConstellationPicker(false); });
  }
  navigate(route, { refresh = true, scrollTop = 0 } = {}) { this.route = route; document.querySelectorAll('.panel').forEach(el => el.classList.toggle('is-active', el.id === route)); document.querySelectorAll('.nav-button,.mobile-nav-button').forEach(el => el.classList.toggle('is-active', el.dataset.route === route)); const more=document.querySelector('#mobileMore'); if(more) more.classList.toggle('is-active', route === 'search' || route === 'places'); this.closeMobileMore(); window.scrollTo({ top: scrollTop, behavior: 'instant' }); if (!refresh) return; if (route === 'drift') this.renderDrift(); if (route === 'between') this.renderBetween(); if (route === 'library') this.renderLibrary(); if (route === 'search') this.renderSearch(''); if (route === 'places') this.renderPlaces(); }
  toggleMobileMore(){ const menu=document.querySelector('#mobileMoreMenu'),button=document.querySelector('#mobileMore'); if(!menu||!button)return; const open=menu.hidden; menu.hidden=!open; button.setAttribute('aria-expanded',String(open)); }
  closeMobileMore(){ const menu=document.querySelector('#mobileMoreMenu'),button=document.querySelector('#mobileMore'); if(menu)menu.hidden=true; if(button)button.setAttribute('aria-expanded','false'); }
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
  refreshDataViews() { document.querySelector('#count').textContent = `${this.entries.length} positions`; document.querySelector('#feed').innerHTML = feedView(this.entries.slice(0,6)); const a = document.querySelector('#betweenA'); const b = document.querySelector('#betweenB'); if (a && b) { a.innerHTML = optionView(this.entries, 0); b.innerHTML = optionView(this.entries, Math.max(0, this.entries.length - 1)); this.renderBetween(); } }
  renderDrift() { if (!this.entries.length) return; const pool=this.entries.length>1?this.entries.filter(e=>e.id!==this.driftId):this.entries; const entry=pool[Math.floor(Math.random()*pool.length)]; this.driftId=entry.id; document.querySelector('#driftQuote').textContent=entry.text??'[Artifact preserved; no canonical utterance text]'; document.querySelector('#driftMeta').textContent=entry.temporal?.display||'Undated'; const inspect=document.querySelector('#driftInspect'); if(inspect) inspect.hidden=false; }
  async renderBetween() { if (!this.entries.length) return; const aid=document.querySelector('#betweenA')?.value, bid=document.querySelector('#betweenB')?.value, mount=document.querySelector('#bridge'); if(!aid||!bid||!mount)return; const data=await getBetweenData(aid,bid); mount.innerHTML=bridgeView(data.from,data.to,data.relations); }
  async renderLibrary(){ const mount=document.querySelector('#libraryMount'); if(mount) mount.innerHTML=await renderLibrary({}); }
  async renderSearch(query=''){ const mount=document.querySelector('#searchMount'); if(!mount)return; const [utterances,constellations]=query?await Promise.all([searchArchive(query),searchConstellations(query)]):[[],[]]; mount.innerHTML=this.searchMarkup({utterances,constellations},query); }
  searchMarkup({utterances=[],constellations=[]},query){ const items=utterances.map(item=>'<article class="library-item" tabindex="0" data-entry-id="'+this.escape(item.id)+'"><div class="eyebrow">'+this.escape(item.temporal?.display||'Undated')+'</div><blockquote class="entry-quote">'+this.escape(item.text??'[Artifact preserved]')+'</blockquote></article>').join(''); const places=constellations.map(item=>'<button class="search-place" type="button" data-search-constellation="'+this.escape(item.id)+'"><span class="eyebrow">Constellation</span><span class="search-place-name">'+this.escape(item.name)+'</span></button>').join(''); const found=items||places; return '<div class="eyebrow">Search</div><h2 class="big-title">Find what is in the record.</h2><form id="searchForm" class="search-form"><input id="searchInput" class="search-input" value="'+this.escape(query)+'" placeholder="Words, constellation, earlier thread, or form"><button class="button-primary">Search</button></form>'+(query?((places?'<section class="search-places"><div class="eyebrow">Places</div>'+places+'</section>':'')+(items?'<section><div class="eyebrow">Words</div><div class="library-results">'+items+'</div></section>':'')+(found?'':'<p class="note">Nothing matches those words.</p>')):'<p class="note">Search the record without changing it.</p>'); }
  async openSearchConstellation(id){ await this.renderPlaces(); this.navigate('places',{refresh:false}); this.renderConstellation(id); }
  escape(value){ return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  async renderPlaces(){ const mount=document.querySelector('#placesMount'); if(!mount)return; const [places,legacy]=await Promise.all([getConstellationPlaces(),getLegacyThreadGatherings()]); this.places=places;this.legacyPlaces=legacy;mount.innerHTML=placesView(places,legacy); if(this.placeDetail?.kind==='constellation')this.renderConstellation(this.placeDetail.id,false); if(this.placeDetail?.kind==='legacy')this.renderLegacyPlace(this.placeDetail.name,false); }
  renderConstellation(id,scroll=true){ const place=this.places?.find(x=>x.constellation.id===id),mount=document.querySelector('#placeDetail'); if(!place||!mount)return; this.placeDetail={kind:'constellation',id}; mount.innerHTML=constellationDetailView(place);if(scroll)mount.scrollIntoView({behavior:'smooth'}); }
  renderLegacyPlace(name,scroll=true){ const place=this.legacyPlaces?.find(x=>x.name===name),mount=document.querySelector('#placeDetail'); if(!place||!mount)return; this.placeDetail={kind:'legacy',name}; mount.innerHTML=legacyGatheringDetailView(place);if(scroll)mount.scrollIntoView({behavior:'smooth'}); }
  toggleConstellationPicker(open){ const picker=document.querySelector('#constellationPicker'); if(!picker)return; picker.hidden=!open; if(open)document.querySelector('#constellationFilter')?.focus(); }
  filterConstellations(query){ const clean=String(query||'').trim().toLowerCase(); let visible=0; document.querySelectorAll('#constellationChoices [data-gather-constellation]').forEach(choice=>{const match=!clean||choice.dataset.constellationName.includes(clean);choice.hidden=!match;if(match)visible+=1;}); const empty=document.querySelector('#constellationNoMatch'); if(empty)empty.hidden=!clean||visible>0; }
  setGatheringError(message=''){ const target=document.querySelector('#gatheringError'); if(target)target.textContent=message; }
  async refreshInspect(){ if(!this.inspectId)return; const mount=document.querySelector('#inspectMount'); if(mount)mount.innerHTML=inspectView(await getUtteranceInspection(this.inspectId)); }
  async gatherInto(constellationId){ if(!this.inspectId)return; this.setGatheringError(''); try{await placeUtterance(this.inspectId,constellationId);this.placesDirty=true;await this.refreshInspect();}catch(error){this.setGatheringError(error.message||'Could not gather these words.');} }
  async withdrawGathering(membershipId){ this.setGatheringError(''); try{await withdrawUtteranceMembership(membershipId);this.placesDirty=true;await this.refreshInspect();}catch(error){this.setGatheringError(error.message||'Could not withdraw this placement.');} }
  async startConstellation(name){ if(!this.inspectId)return; this.setGatheringError(''); try{await startConstellationFromUtterance(name,this.inspectId);this.placesDirty=true;await this.refreshInspect();}catch(error){this.setGatheringError(error.message||'Could not start that constellation.');} }
  setReadingError(message=''){ const target=document.querySelector('#readingError'); if(target)target.textContent=message; }
  async keepAnnotation(text){ if(!this.inspectId)return; this.setReadingError(''); try{await addAnnotation(this.inspectId,text);await this.refreshInspect();}catch(error){this.setReadingError(error.message||'Could not keep that annotation.');} }
  async keepInterpretation(text){ if(!this.inspectId)return; this.setReadingError(''); try{await addInterpretation(this.inspectId,text);await this.refreshInspect();}catch(error){this.setReadingError(error.message||'Could not keep that interpretation.');} }
  async inspect(id){ const mount=document.querySelector('#inspectMount'); if(!mount)return; if(this.route!=='inspect'){this.returnRoute=this.route;this.returnScroll=window.scrollY;} this.inspectId=id; mount.innerHTML=inspectView(await getUtteranceInspection(id)); this.navigate('inspect'); }
}

function boot() {
  const root = document.querySelector('#app');
  if (!root) return;
  const app = new AllISayApp(root);
  app.init().then(() => app.mount());
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
