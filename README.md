# Nutrak

A private nutrition journal built around a simple rule: show what the record supports, and make the gaps visible.

Nutrak runs as a static, installable web app. Profiles, the food journal, reference calculations and reports work on the device without a nutrition backend. Personal data stays in browser storage unless the user exports it or explicitly uses a connected capture option.

## What works

- Adult reference profiles from published Health Canada / NASEM dietary reference values and the 2023 estimated energy requirement equations.
- Daily food journal, editable portions and nutrient amounts, dated history, deletion with undo, and explicit complete-day marking.
- Offline food references with sources, gram-based text parsing with unresolved items preserved, and optional Open Food Facts barcode lookup.
- Optional OpenAI photo recognition using a personal API key. Images produce editable estimates that must be confirmed before saving. The key lives only in the page session and is excluded from backups.
- Seven- and thirty-day analysis with per-nutrient coverage. Missing nutrient values and unrecorded days remain unknown. RDA, AI, CDRR and scoped upper limits retain their distinct meanings.
- JSON backup and restore with validation. Existing calorie-only logs are preserved; their missing nutrients stay unknown.

## Run locally

Node 22 is used for development and CI. The application has no runtime dependencies or build step.

```sh
npm ci
npm start
```

Open the printed localhost URL. Any static host can serve the repository's `index.html`, `src/`, `icons/`, `manifest.json` and `sw.js` over HTTPS. GitHub Pages subdirectory hosting is supported. The service worker caches the application shell for offline use after the first successful load. Barcode lookups and photo recognition require a connection.

```sh
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite starts its own temporary HTTP server and uses synthetic data. OpenAI and barcode responses are mocked; it makes no billed requests. Unit suites exercise the actual reference engine, capture adapters, storage and service worker behavior.

The [capability and progress record](docs/PROGRESS.md) preserves the project purpose, contracts, verified progress and next work.

## Scientific scope

See [the reference model](docs/SCIENCE.md) for equations, units, sources, supported profiles and interpretation rules. This build supports adults 19 and older. Pregnancy/lactation nutrient references are available for supported adult groups; energy calculations are withheld because required stage information is not collected. The app does not diagnose deficiency, prescribe supplements, or automatically set weight-loss targets.

All displayed comparisons describe the recorded intake. Marking a day complete is a user declaration, not independent evidence that every food was recorded. A short food log does not establish usual intake or an individual's nutritional status. Missing data is never silently interpreted as zero intake.

See [food and photo sources](docs/FOOD-SOURCES.md) for composition provenance, unit conversions, label rounding, API behavior and known limitations.

## Optional photo recognition

In the photo tab, choose an image, enter a personal OpenAI API key, and explicitly request analysis. The app sends the image and key directly to OpenAI's HTTPS API. Requests can incur charges. The app does not save the image or key in local storage or exports, and sets `store:false`; provider retention rules still apply. A browser-held personal key can be accessed by that browser runtime or privileged extensions. A shared service should use an authenticated backend for its own credentials.

Recognition estimates visible foods, portions, energy and macros. It does not infer micronutrient values from pixels. Review identities and quantities, correct the draft, and confirm before adding it to the journal. The rest of Nutrak works without an API key.

## Upgrade and data

The old public build used a fixed captured profile and adequacy fixture when its separate API was unavailable. This build calculates from current local inputs. Legacy food entries are migrated; old captured profile/adequacy numbers are not treated as personal results. `demo/fixture.json` remains as a historical artifact and is not used for personal calculations.

Browser data is local to an origin and device. A staging preview, localhost and GitHub Pages each have separate storage. Export before changing origins or clearing browser data. Backups contain nutrition and profile information; keep them private.

## License

Application code: [MIT](LICENSE). Food reference and community-product sources retain their attribution and applicable licensing described in [FOOD-SOURCES.md](docs/FOOD-SOURCES.md).
