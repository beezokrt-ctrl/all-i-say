import { escapeHTML } from './views.js';

const meta = entry => (entry.metadata?.threads || entry.threads || ['Unplaced']).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('');

export function shellView(entries) {
  return `<div class="shell">
    <nav class="rail" aria-label="Primary">
      <button class="nav-button is-active" data-route="home">Record</button>
      <button class="nav-button" data-route="write">Say</button>
      <button class="nav-button" data-route="drift">Drift</button>
      <button class="nav-button" data-route="between">Between</button>
    </nav>
    <main class="main">
      <header class="top"><div class="brand">All I Say</div><div id="count" class="count">${entries.length} positions</div></header>
      ${homeView(entries)}${writeView()}${driftView()}${betweenView(entries)}
    </main>
  </div>`;
}

export function homeView(entries) {
  return `<section id="home" class="panel is-active">
    <div class="hero"><h1 class="hero-title">All<br>I Say</h1><p class="hero-copy">An immutable archive of utterances.</p></div>
    <div class="section-head"><div class="eyebrow">The record</div><div class="eyebrow">Newest first</div></div>
    <div id="feed" class="record">${feedView(entries)}</div>
  </section>`;
}

export function feedView(entries) {
  if (!entries.length) return `<p class="note">Nothing yet. Say something.</p>`;
  return [...entries].reverse().map((entry, index) => `<article class="entry" data-entry-id="${escapeHTML(entry.id)}">
    <div class="eyebrow">${escapeHTML(entry.displayDate || entry.date || 'Undated')}</div>
    <blockquote class="entry-quote">${escapeHTML(entry.text)}</blockquote>
    <div class="meta">${meta(entry)}<span class="tag">Position ${entries.length - index}</span></div>
  </article>`).join('');
}

export function writeView() {
  return `<section id="write" class="panel"><div class="compose-wrap">
    <div class="eyebrow">Say</div>
    <h2 class="big-title">What are you thinking?</h2>
    <textarea id="entryText" class="compose-text" placeholder="No title required." aria-label="Your words"></textarea>
    <div class="compose-foot"><span class="small">The words you keep.</span><button id="saveEntry" class="button-primary">Keep</button></div>
  </div></section>`;
}

export function driftView() {
  return `<section id="drift" class="panel"><div class="drift-card">
    <div><div class="eyebrow">Drift · one thing you said</div><div id="driftQuote" class="drift-quote"></div></div>
    <div class="drift-actions"><div id="driftMeta" class="small"></div><button id="newDrift" class="button-ghost">Another</button></div>
  </div></section>`;
}

export function betweenView(entries) {
  return `<section id="between" class="panel"><div class="eyebrow">Between</div><h2 class="big-title">Put two positions<br>in sight.</h2>
    <div class="between-grid"><select id="betweenA" class="picker"></select><select id="betweenB" class="picker"></select></div>
    <div id="bridge" class="bridge"></div>
  </section>`;
}

export function optionView(entries, selected = 0) {
  return entries.map((e, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${escapeHTML(e.text.slice(0, 88))}</option>`).join('');
}

export function bridgeView(a, b) {
  const position = e => `<div class="position"><div class="eyebrow">${escapeHTML(e.displayDate || e.date || 'Undated')} · ${escapeHTML((e.metadata?.threads || e.threads || ['Unplaced']).join(' · '))}</div><blockquote class="position-quote">${escapeHTML(e.text)}</blockquote></div>`;
  return `${position(a)}<div class="between-line"><span>Between</span></div>${position(b)}`;
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
