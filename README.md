# All I Say — modular build

This build separates **content, behavior, and visual design** so any one can change without rewriting the others.

## Structure

- `index.html` — only the document shell and asset imports.
- `css/tokens.css` — palette, fonts, spacing, radii, sizes. Change the visual system here first.
- `css/base.css` — global layout/accessibility primitives.
- `css/components.css` — component-level styling.
- `data/seed.js` — initial words only. No UI logic.
- `js/config.js` — navigation and interface copy.
- `js/store.js` — persistence and entry creation.
- `js/views.js` — pure rendering functions.
- `js/app.js` — event wiring and state orchestration.

## Entry schema

Each entry is deliberately extensible:

```js
{
  id: "stable-id",
  text: "Exact words",
  date: "Sep 2026",
  threads: ["Darśana", "causality"],
  kind: "question",
  createdAt: "ISO timestamp" // new entries
}
```

Future fields can be added without changing the basic archive: `context`, `sourceConversation`, `relations`, `revisions`, `media`, `place`, `parentId`, etc.

## Design rule

Exact words are data. Their visual presentation is a view. Do not bake philosophy, labels, or interpretation into the storage layer.

## Local use

Because this uses JavaScript modules, serve the folder with any static server rather than opening `index.html` as `file://`.

Example:
`python3 -m http.server 8080`

Then open `http://localhost:8080`.

It is ready for static hosting such as Netlify.
