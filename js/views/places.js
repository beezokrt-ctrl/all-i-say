import { escapeHTML } from "../views.js";

const words = (u) => escapeHTML(u.text ?? "[Artifact preserved; no canonical utterance text]");
const date = (u) => escapeHTML(u.temporal?.display || "Undated");

export function placesView(places, legacy = []) {
  const cards = places
    .map(
      ({ constellation, count }) =>
        `<button class="place-card" data-constellation-id="${escapeHTML(constellation.id)}"><span><span class="place-name">${escapeHTML(constellation.name)}</span>${constellation.description ? `<span class="small place-description">${escapeHTML(constellation.description)}</span>` : ""}</span><span class="small">${count} position${count === 1 ? "" : "s"}</span></button>`,
    )
    .join("");
  const legacyBlock = legacy.length
    ? `<section class="legacy-gatherings"><div class="section-head"><div class="eyebrow">Earlier thread labels</div><div class="small">Not constellations until you say so.</div></div><div class="places-grid">${legacy.map((p) => `<button class="place-card" data-legacy-place="${escapeHTML(p.name)}"><span class="place-name">${escapeHTML(p.name)}</span><span class="small">${p.count} position${p.count === 1 ? "" : "s"}</span></button>`).join("")}</div></section>`
    : "";
  return `<div class="eyebrow">Places · Constellations</div><h2 class="big-title">Where your words have gathered.</h2><p class="hero-copy">Places gather words without owning them. The same words can appear in several places.</p><div class="places-grid">${cards || '<p class="note">No constellations yet.</p>'}</div><div id="placeDetail"></div>${legacyBlock}`;
}

export function constellationDetailView(place) {
  const c = place.constellation;
  return `<div class="place-detail"><div class="eyebrow">Constellation · ${escapeHTML(c.name)}</div>${c.aliases?.length ? `<div class="meta">${c.aliases.map((a) => `<span class="tag">${escapeHTML(a)}</span>`).join("")}</div>` : ""}${place.utterances.map((u) => `<article class="entry" tabindex="0" data-entry-id="${escapeHTML(u.id)}"><div class="eyebrow">${date(u)}</div><blockquote class="entry-quote">${words(u)}</blockquote></article>`).join("") || '<p class="note">Nothing is placed here yet.</p>'}</div>`;
}

export function legacyGatheringDetailView(place) {
  return `<div class="place-detail"><div class="eyebrow">Earlier thread label · ${escapeHTML(place.name)}</div><p class="small">This label is preserved from earlier metadata. It has not been promoted into a constellation.</p>${place.utterances.map((u) => `<article class="entry" tabindex="0" data-entry-id="${escapeHTML(u.id)}"><div class="eyebrow">${date(u)}</div><blockquote class="entry-quote">${words(u)}</blockquote></article>`).join("")}</div>`;
}
