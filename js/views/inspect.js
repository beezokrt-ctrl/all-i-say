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

function proposalCard({suggestion,otherUtterance,currentId,canonicalRelation}){
  const pending=!suggestion.status||suggestion.status==='pending';
  const confidence=Number.isFinite(suggestion.provenance?.confidence)?Math.round(suggestion.provenance.confidence*100)+'% model confidence':'confidence not supplied';
  const model=suggestion.provenance?.model||'model unknown';
  const other=otherUtterance?.text??'[Referenced utterance unavailable]';
  const direction=suggestion.payload.directional===false
    ? 'these words ↔ referenced words'
    : suggestion.payload.fromId===currentId ? 'these words → referenced words' : 'referenced words → these words';
  const decision=suggestion.decision;
  const outcome=pending
    ? '<div class="proposal-actions"><button class="button-ghost" type="button" data-accept-suggestion="'+escapeHTML(suggestion.id)+'">Accept as relation</button><button class="proposal-reject" type="button" data-reject-suggestion="'+escapeHTML(suggestion.id)+'">Reject</button></div>'
    : '<div class="proposal-decision">'+(suggestion.status==='accepted'?'Accepted by you':'Rejected by you')+' · '+escapeHTML(readingTime(decision?.decidedAt))+'</div>'
      +(decision?.reason?'<div class="proposal-reason">Your reason: '+escapeHTML(decision.reason)+'</div>':'')
      +(suggestion.status==='accepted'
        ? canonicalRelation
          ? '<a class="proposal-trace" href="#relation-'+encodeURIComponent(canonicalRelation.id)+'">View author Relation · '+escapeHTML(canonicalRelation.status)+'</a>'
          : '<p class="small">Linked Relation unavailable.</p>'
        : '<p class="small">No Relation was created.</p>');
  return '<article id="proposal-'+encodeURIComponent(suggestion.id)+'" class="proposal-card"><div class="proposal-state">'+(pending?'Pending machine proposal':'Original machine proposal')+'</div><div class="proposal-relation">'+escapeHTML(suggestion.payload.type)+'</div><div class="proposal-direction">'+escapeHTML(direction)+'</div><blockquote class="proposal-other">'+escapeHTML(other)+'</blockquote><div class="proposal-meta">'+escapeHTML(model)+' · '+escapeHTML(confidence)+'<br>Proposed '+escapeHTML(readingTime(suggestion.provenance?.createdAt))+'</div>'
    +(suggestion.payload.note?'<div class="proposal-note">Machine note: '+escapeHTML(suggestion.payload.note)+'</div>':'')+outcome+'</article>';
}

function proposalsMarkup(pendingSuggestions=[]){
  return pendingSuggestions.length?pendingSuggestions.map(proposalCard).join(''):'<p class="small proposal-empty">No pending machine proposals.</p>';
}

function proposalHistoryMarkup(history=[]){
  return '<div class="inspect-section proposal-history"><h2>Proposal history</h2><p class="small">Original proposals and your later decisions remain here.</p>'
    +(history.length?history.map(proposalCard).join(''):'<p class="small">No proposal decisions yet.</p>')+'</div>';
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
  const { utterance, artifacts, transcriptions, relations = [], gatherings = [], available = [], annotations = [], interpretations = [], pendingSuggestions = [], proposalHistory = [] } = inspection;
  const artifactMarkup = artifacts.length ? artifacts.map(artifact => '<div class="inspect-item"><div class="eyebrow">'+escapeHTML(artifact.kind)+' · '+escapeHTML(artifact.mimeType)+'</div><div class="small">'+escapeHTML(artifact.capturedAt || 'Capture time unknown')+'</div></div>').join('') : '<p class="small">No artifact attached.</p>';
  const transcriptionMarkup = transcriptions.length ? transcriptions.map(item => '<div class="inspect-item"><div class="inspect-reading">'+escapeHTML(item.text)+'</div><div class="meta"><span class="tag">'+escapeHTML(item.provenance?.origin || 'unknown')+'</span><span class="tag">'+escapeHTML(item.attestation?.state || 'unreviewed')+'</span><span class="tag">'+escapeHTML(item.createdAt)+'</span></div></div>').join('') : '<p class="small">No transcription recorded.</p>';
  const relationMarkup = relations.length ? relations.map(r => '<div id="relation-'+encodeURIComponent(r.id)+'" class="inspect-item"><span class="tag">'+escapeHTML(r.type)+'</span><span class="small">'+escapeHTML(r.fromId)+(r.directional===false?' ↔ ':' → ')+escapeHTML(r.toId)+' · '+escapeHTML(r.status)+'</span>'
    +(r.provenance?.suggestionId&&proposalHistory.some(value=>value.suggestion.id===r.provenance.suggestionId)?'<a class="proposal-trace" href="#proposal-'+encodeURIComponent(r.provenance.suggestionId)+'">View original proposal and decision</a>':'')+'</div>').join('') : '<p class="small">No relations recorded.</p>';
  return '<section id="inspect" class="panel"><button id="inspectBack" class="button-ghost">← Back</button><div class="inspect-head"><div class="eyebrow">Utterance</div><blockquote class="inspect-quote">'+escapeHTML(utterance.text ?? '[Awaiting transcription]')+'</blockquote><div class="meta"><span class="tag">'+escapeHTML(utterance.temporal?.display || 'Undated')+'</span><span class="tag">'+escapeHTML(utterance.metadata?.status || 'unknown')+'</span><span class="tag">'+escapeHTML(utterance.source?.type || 'unknown')+'</span></div></div><div class="inspect-section gathering-section"><h2>Gathered in</h2><div id="activeGatherings">'+gatheringsMarkup(gatherings)+'</div><div class="gathering-actions"><button id="openConstellationPicker" class="button-ghost" type="button">Gather here →</button><span id="gatheringError" class="small" role="status" aria-live="polite"></span></div>'+pickerMarkup(available)+'</div><div class="inspect-section"><h2>Artifacts</h2>'+artifactMarkup+'</div><div class="inspect-section"><h2>Transcription history</h2>'+transcriptionMarkup+'</div><div class="inspect-section readings-section"><div class="readings-head"><div><h2>Beside these words</h2><p class="small">Later readings remain separate from the utterance.</p></div></div><div id="readingList">'+readingsMarkup(annotations,interpretations)+'</div>'+readingsComposerMarkup()+'</div><div class="inspect-section proposals-section"><h2>Proposals</h2><p class="small proposal-boundary">A machine proposal is not a relation unless you accept it.</p><div id="pendingProposals">'+proposalsMarkup(pendingSuggestions)+'</div><div id="proposalError" class="small" role="status" aria-live="polite"></div></div>'+proposalHistoryMarkup(proposalHistory)+'<div class="inspect-section"><h2>Relations</h2>'+relationMarkup+'</div></section>';
}
