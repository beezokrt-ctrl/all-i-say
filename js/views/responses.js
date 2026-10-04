import { escapeHTML } from "../views.js";

export function responseComposer() {
  return `<details class="response-composer"><summary>Respond to these words</summary>
    <p class="small">Your response becomes new words. The words above stay as they are.</p>
    <form id="responseForm"><label for="responseText" class="gathering-filter-label">Your response</label>
    <textarea id="responseText" class="response-text search-input" required></textarea>
    <label for="responseType" class="gathering-filter-label">How does this response relate?</label>
    <select id="responseType" class="picker"><option value="responds-to">Responds to</option><option value="continues">Continues</option><option value="returns-to">Returns to</option><option value="corrects">Corrects</option><option value="contradicts">Contradicts</option><option value="develops">Develops</option></select>
    <p id="responseMessage" class="small" role="status"></p><button id="saveResponse" class="button-primary">Keep response</button></form></details>`;
}

export function connectedWords(utterance, relations, relatedUtterances) {
  if (!relations.length)
    return '<p class="small">No relations recorded. You can begin by responding to these words.</p>';
  const records = new Map(relatedUtterances.map((item) => [item.id, item]));
  return relations
    .map((relation) => {
      const outgoing = relation.fromId === utterance.id;
      const other = records.get(outgoing ? relation.toId : relation.fromId);
      const available = other && other.metadata?.status !== "tombstoned";
      const direction =
        relation.directional === false
          ? "These words ↔ connected words"
          : outgoing
            ? "These words → connected words"
            : "Connected words → these words";
      return `<div class="connected-word"><div class="meta"><span class="tag">${escapeHTML(relation.type)}</span><span class="tag">${escapeHTML(relation.status)}</span><span class="tag">${escapeHTML(relation.provenance?.origin || "unknown")}</span></div><p class="small">${direction}</p>${available ? `<button class="connected-open" data-open-related="${escapeHTML(other.id)}"><span class="small">${escapeHTML(other.temporal?.display || "Undated")}</span><span class="word-choice-text">${escapeHTML(other.text ?? "[Artifact preserved]")}</span><span class="small">Open these words →</span></button>` : '<p class="small">Connected words are unavailable. The relation is preserved.</p>'}</div>`;
    })
    .join("");
}
