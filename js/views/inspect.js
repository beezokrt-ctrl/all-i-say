import { escapeHTML } from '../views.js';

function placementTime(value){
  const timestamp=Date.parse(value);
  if(!Number.isFinite(timestamp))return 'placed at an unknown time';
  const days=Math.round((timestamp-Date.now())/86400000);
  const formatter=new Intl.RelativeTimeFormat('en',{numeric:'auto'});
  if(Math.abs(days)<1)return 'placed '+formatter.format(0,'day');
  if(Math.abs(days)<30)return 'placed '+formatter.format(days,'day');
  const months=Math.round(days/30);
  if(Math.abs(months)<12)return 'placed '+formatter.format(months,'month');
  return 'placed '+formatter.format(Math.round(days/365),'year');
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
  const { utterance, artifacts, transcriptions, relations = [], gatherings = [], available = [] } = inspection;
  const artifactMarkup = artifacts.length ? artifacts.map(artifact => '<div class="inspect-item"><div class="eyebrow">'+escapeHTML(artifact.kind)+' · '+escapeHTML(artifact.mimeType)+'</div><div class="small">'+escapeHTML(artifact.capturedAt || 'Capture time unknown')+'</div></div>').join('') : '<p class="small">No artifact attached.</p>';
  const transcriptionMarkup = transcriptions.length ? transcriptions.map(item => '<div class="inspect-item"><div class="inspect-reading">'+escapeHTML(item.text)+'</div><div class="meta"><span class="tag">'+escapeHTML(item.provenance?.origin || 'unknown')+'</span><span class="tag">'+escapeHTML(item.attestation?.state || 'unreviewed')+'</span><span class="tag">'+escapeHTML(item.createdAt)+'</span></div></div>').join('') : '<p class="small">No transcription recorded.</p>';
  const relationMarkup = relations.length ? relations.map(r => '<div class="inspect-item"><span class="tag">'+escapeHTML(r.type)+'</span><span class="small">'+escapeHTML(r.fromId)+' → '+escapeHTML(r.toId)+'</span></div>').join('') : '<p class="small">No relations recorded.</p>';
  return '<section id="inspect" class="panel"><button id="inspectBack" class="button-ghost">← Back</button><div class="inspect-head"><div class="eyebrow">Utterance</div><blockquote class="inspect-quote">'+escapeHTML(utterance.text ?? '[Awaiting transcription]')+'</blockquote><div class="meta"><span class="tag">'+escapeHTML(utterance.temporal?.display || 'Undated')+'</span><span class="tag">'+escapeHTML(utterance.metadata?.status || 'unknown')+'</span><span class="tag">'+escapeHTML(utterance.source?.type || 'unknown')+'</span></div></div><div class="inspect-section gathering-section"><h2>Gathered in</h2><div id="activeGatherings">'+gatheringsMarkup(gatherings)+'</div><div class="gathering-actions"><button id="openConstellationPicker" class="button-ghost" type="button">Gather here →</button><span id="gatheringError" class="small" role="status" aria-live="polite"></span></div>'+pickerMarkup(available)+'</div><div class="inspect-section"><h2>Artifacts</h2>'+artifactMarkup+'</div><div class="inspect-section"><h2>Transcription history</h2>'+transcriptionMarkup+'</div><div class="inspect-section"><h2>Annotations and interpretations</h2><p class="small">No annotations or interpretations are stored for this utterance yet.</p></div><div class="inspect-section"><h2>Relations</h2>'+relationMarkup+'</div></section>';
}
