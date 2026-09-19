# Nutrak — Staging

Nutrition tracker — log food by text, photo, or form; track macros, vitamins, and minerals against DRI-based standards.

This is the staging build reviewed before promotion to production.

- `src/` / `index.html` / `sw.js` — PWA app
- `manifest.json` / `icons/` — installable PWA assets

## Checks

`npm test` (node ≥ 18, no dependencies) runs `tests/smoke.mjs`:

- JSON validity + demo fixture shape (everything `render*` dereferences)
- the trust contract, executed for real: every fixture basis string resolves to a glossary template — direct `basisCode` lookup or legacy regex fallback — never a silent fall-through to raw JSON
- regression guards from the staging review: XSS escaping, local-date stamping, `renderProfile`, tab scoping, SW cache version/shell

## Demo fixture

`demo/fixture.json` is captured engine output (see `meta.regenerate`), never hand-written — it powers the GH Pages demo when no local API is reachable.

## License
MIT — see [LICENSE](LICENSE).
