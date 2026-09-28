import { escapeHTML } from '../views.js';

function placementTime(value){
  const timestamp=Date.parse(value);
  if(!Number.isFinite(timestamp))return 'placed at an unknown time';
  const formatter=new Intl.DateTimeFormat('en',{
    year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',
    hour12:false,timeZone:'UTC',timeZoneName:'short'
  });
  return 'placed '+formatter.format(timestamp);
}

function readingTime(value){
  const timestamp=Date.parse(value);
  if(!Number.isFinite(timestamp))return 'time unknown';
  return new Intl.DateTimeFormat('en',{
    year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',
    hour12:false,timeZone:'UTC',timeZoneName:'short'
  }).format(timestamp);
}

function provenanceLabel(provenance={}){
  if(provenance.origin==='author')return 'your later note';
  if(provenance.origin==='ai')return provenance.model ? 'machine proposal · '+provenance.model : 'machine proposal';
  return provenance.origin || 'source unknown';
}

function readingsMarkup(annotations=[],interpretations=[]){
  const records=[
    ...annotations.map(value=>({kind:'Annotation',text:value.text,value})),
    ...interpretations.map(value=>({kind:'Interpretation',text:value.reading,value}))
  ].sort((a,b)=>String(a.value.createdAt).localeCompare(String(b.value.createdAt)));
  if(!records.length)return '<p class="small reading-empty">Nothing has been placed beside these words yet.</p>';
  return records.map(({kind,text,value})=>
    '<article class="reading-card"><div class="reading-kind">'+escapeHTML(kind)+'</div><div class="reading-text">'+escapeHTML(text)+'</div><div class="reading-meta"><span>'+escapeHTML(provenanceLabel(value.provenance))+'</span><time datetime="'+escapeHTML(value.createdAt)+'">'+escapeHTML(readingTime(value.createdAt))+'</time></div></article>'
  ).join('');
}

function readingsComposerMarkup(){
  return '<details class="reading-compose"><summary>Place something beside these words</summary><div class="reading-compose-note">This does not alter the utterance above.</div><form id="annotationForm" class="reading-form"><label for="annotationText">Annotation <span>context, circumstance, or a note</span></label><textarea id="annotationText" class="reading-input" required></textarea><button class="button-ghost" type="submit">Keep annotation</button></form><form id="interpretationForm" class="reading-form"><label for="interpretationText">Interpretation <span>a reading of what these words mean from where you stand now</span></label><textarea id="interpretationText" class="reading-input" required></textarea><button class="button-ghost" type="submit">Keep interpretation</button></form><div id="readingError" class="small" role="status" aria-live="polite"></div></details>';
}

function proposalsMarkup(pendingSuggestions=[]){
  if(!pendingSuggestions.length)return '<p class="small proposal-empty">No pending machine proposals.</p>';
  return pendingSuggestions.map(({suggestion,otherUtterance,currentId})=>{
    const confidence=typeof suggestion.provenance?.confidence==='number'?Math.round(suggestion.provenance.confidence*100)+'% confidence':'confidence not supplied';
    const model=suggestion.provenance?.model||'model unknown';
    const other=otherUtterance?.text??'[Referenced utterance unavailable]';
    const direction=suggestion.payload.directional===false
      ? 'these words ↔ referenced words'
      : suggestion.payload.fromId===currentId ? 'these words → referenced words' : 'referenced words → these words';
    return '<article class="proposal-card"><div class="proposal-state">Pending machine proposal</div><div class="proposal-relation">'+escapeHTML(suggestion.payload.type)+'</div><div class="proposal-direction">'+escapeHTML(direction)+'</div><blockquote class="proposal-other">'+escapeHTML(other)+'</blockquote><div class="proposal-meta">'+escapeHTML(model)+' · '+escapeHTML(confidence)+'</div><div class="proposal-actions"><button class="button-ghost" type="button" data-accept-suggestion="'+escapeHTML(suggestion.id)+'">Accept as relation</button><button class="proposal-reject" type="button" data-reject-suggestion="'+escapeHTML(suggestion.id)+'">Reject</button></div></article>';
  }).join('');
}

function gatheringsMarkup(gatherings=[]){
  if(!gatherings.length)return '<p class="small gathering-empty">Not yet gathered anywhere.</p>';
  return gatherings.map(({membership,constellation})=>
    '<div class="gathering-row"><div><div class="gathering-name">'+escapeHTML(constellation.name)+'</div><time class="small" datetime="'+escapeHTML(membership.createdAt)+'">'+escapeHTML(placementTime(membership.createdAt))+'</time></div><button class="gathering-withdraw" type="button" data-withdraw-membership="'+escapeHTML(membership.id)+'">Withdraw</button></div>'
  ).join('');
}

function pickerMarkup(available=[]){
  const choices=available.length
    ? available.map(constellation=>'<button class="gathering-choice" type="button" data-gather-constellation="'+escapeHTML(constellation.id)+'" data-constellation-name="'+escapeHTML(constellation.name.toLowerCase())+'"><span>'+escapeHTML(constellation.name)+'</span></button>').join('')
    : '<p class="small" id="constellationPickerEmpty">No other constellations yet.</p>';
  return '<div id="constellationPicker" class="gathering-picker" hidden aria-label="Choose a constellation"><div class="gathering-picker-head"><div><div class="eyebrow">Gather here</div><div class="small">A placement does not make these words belong only here.</div></div><button id="closeConstellationPicker" class="button-ghost" type="button">Close</button></div><label class="gathering-filter-label" for="constellationFilter">Find a constellation</label><input id="constellationFilter" class="search-input" autocomplete="off" placeholder="Name"><div id="constellationChoices" class="gathering-choices">'+choices+'</div><div id="constellationNoMatch" class="small" hidden>No constellation matches those words yet.</div><form id="newConstellationForm" class="new-constellation-form"><label class="gathering-filter-label" for="newConstellationName">Start a new constellation from this</label><div class="new-constellation-row"><input id="newConstellationName" class="search-input" autocomplete="off" placeholder="Constellation name" required><button class="button-primary" type="submit">Start</button></div></form></div>';
}

export function inspectView(inspection) {
  if (!inspection) return '<section id="inspect" class="panel"><p class="note">This utterance could not be found.</p><button id="inspectBack" class="button-ghost">← Back</button></section>';
  const { utterance, artifacts, transcriptions, relations = [], gatherings = [], available = [], annotations = [], interpretations = [], pendingSuggestions = [] } = inspection;
  const artifactMarkup = artifacts.length ? artifacts.map(artifact => '<div class="inspect-item"><div class="eyebrow">'+escapeHTML(artifact.kind)+' · '+escapeHTML(artifact.mimeType)+'</div><div class="small">'+escapeHTML(artifact.capturedAt || 'Capture time unknown')+'</div></div>').join('') : '<p class="small">No artifact attached.</p>';
  const transcriptionMarkup = transcriptions.length ? transcriptions.map(item => '<div class="inspect-item"><div class="inspect-reading">'+escapeHTML(item.text)+'</div><div class="meta"><span class="tag">'+escapeHTML(item.provenance?.origin || 'unknown')+'</span><span class="tag">'+escapeHTML(item.attestation?.state || 'unreviewed')+'</span><span class="tag">'+escapeHTML(item.createdAt)+'</span></div></div>').join('') : '<p class="small">No transcription recorded.</p>';
  const relationMarkup = relations.length ? relations.map(r => '<div class="inspect-item"><span class="tag">'+escapeHTML(r.type)+'</span><span class="small">'+escapeHTML(r.fromId)+' → '+escapeHTML(r.toId)+'</span></div>').join('') : '<p class="small">No relations recorded.</p>';
  return '<section id="inspect" class="panel"><button id="inspectBack" class="button-ghost">← Back</button><div class="inspect-head"><div class="eyebrow">Utterance</div><blockquote class="inspect-quote">'+escapeHTML(utterance.text ?? '[Awaiting transcription]')+'</blockquote><div class="meta"><span class="tag">'+escapeHTML(utterance.temporal?.display || 'Undated')+'</span><span class="tag">'+escapeHTML(utterance.metadata?.status || 'unknown')+'</span><span class="tag">'+escapeHTML(utterance.source?.type || 'unknown')+'</span></div></div><div class="inspect-section gathering-section"><h2>Gathered in</h2><div id="activeGatherings">'+gatheringsMarkup(gatherings)+'</div><div class="gathering-actions"><button id="openConstellationPicker" class="button-ghost" type="button">Gather here →</button><span id="gatheringError" class="small" role="status" aria-live="polite"></span></div>'+pickerMarkup(available)+'</div><div class="inspect-section"><h2>Artifacts</h2>'+artifactMarkup+'</div><div class="inspect-section"><h2>Transcription history</h2>'+transcriptionMarkup+'</div><div class="inspect-section readings-section"><div class="readings-head"><div><h2>Beside these words</h2><p class="small">Later readings remain separate from the utterance.</p></div></div><div id="readingList">'+readingsMarkup(annotations,interpretations)+'</div>'+readingsComposerMarkup()+'</div><div class="inspect-section proposals-section"><h2>Proposals</h2><p class="small proposal-boundary">A machine proposal is not a relation unless you accept it.</p><div id="pendingProposals">'+proposalsMarkup(pendingSuggestions)+'</div><div id="proposalError" class="small" role="status" aria-live="polite"></div></div><div class="inspect-section"><h2>Relations</h2>'+relationMarkup+'</div></section>';
}
