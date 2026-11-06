# Progress against the working-product baseline

This is a capability record, not a claim that a percentage of the ideal product is complete.

| Capability | Previous public build | This change | Evidence |
| --- | --- | --- | --- |
| Personal reference calculation | Required a missing nutrition API; hosted fallback reused captured fixture | Local adult DRI reference selection and 2023 EER calculation from entered inputs | All eight sex/activity equations checked against independent expected values |
| Scientific interpretation | Captured 7/30-day reports | Reports computed from the actual journal with per-nutrient day coverage, unknowns, RDA/AI/CDRR distinctions and scoped UL handling | Engine cases and complete-window browser checks |
| Food composition | Primarily calorie-only manual input | All supported nutrient fields, 30 sourced foods including 11 exact USDA records | Source snapshots and exhaustive mapping/portion checks |
| Text entry | Preview response | Gram-based catalog matching, unresolved segments preserved, reviewed multi-food drafts | Browser batch confirmation and duplicate prevention |
| Barcode entry | Preview response | Explicit Open Food Facts lookup, label/portion review and canonical unit normalization | Mocked API and browser tests, cancellation regression |
| Photo entry | Simulated fixed meal | Optional personal OpenAI key, local image preparation, structured recognition draft, editable confirmation | Mocked success/refusal/error/timeout tests and browser consent/key-storage checks |
| Persistence | Local entries, limited error visibility | Edit/delete/undo, validated backups, legacy migration, raw recovery, stale-tab write rejection, recoverable in-memory edits on storage failure | Store regressions and browser restore/conflict/quota tests |
| Offline/mobile experience | Cached presentation shell | Cached calculation engine and catalog; responsive journal/profile/analysis screens | Offline browser reload/analysis and four-screen phone overflow checks |

## Verification

- `npm test`: seven suites covering engine, food records/adapters, photo adapter, storage, runtime smoke, installability and service-worker behavior.
- `npm run test:browser`: eighteen acceptance groups, including empty startup, local profile calculation, pre-profile logging, escaping, batch review, editing, undo, persistence, optional capture confirmation, backup validation, mobile layout, offline reload, legacy migration, cross-tab conflict preservation and storage recovery.
- Tests use synthetic food journals and mocked provider responses. No private journal or API credential is included in this repository.
- The app has no runtime package dependencies. Playwright is a development-only dependency.

## Remaining distance to the broader vision

- Live OpenAI recognition has not been exercised with a billed key, and recognition accuracy has not been evaluated on a held-out meal-image dataset. The implemented path produces reviewed estimates, not measured composition.
- The offline catalog is intentionally small. It is not comprehensive coverage of cuisines, recipes, brands or supplements. Unknown components remain unknown.
- The deterministic text parser handles explicit gram amounts and catalog names. It is not a general-language meal parser.
- Reference support covers adults 19+. Pregnancy/lactation energy and pregnancy protein are withheld when the required stage data is unavailable. Pediatric targets, condition-specific planning and clinician workflows are outside this release.
- A registered dietitian has not independently reviewed the full implementation. Source verification and software tests are not clinical validation.
- Data is specific to the browser origin/device. Cross-device synchronization and an authenticated multiuser credential backend are not implemented.
- Private preview publication is separate from merging and promoting this change to the existing public GitHub Pages app.

## Capability continuity

**Stable capability ID:** `nutrak.nutrition-evidence`. This is the canonical capability record; its identity follows the behavior across future file moves or redesigns.

**Human purpose:** Help a person understand their recorded nutrition and make informed choices without mistaking incomplete logs, population references or recognition estimates for measurements of individual nutritional status. The current priority is scientifically transparent analysis and guidance. Optional personal-key image recognition serves that purpose by preparing a reviewable draft.

**Responsibilities that must survive changes:** Preserve unknown values and source provenance; distinguish RDA, AI, CDRR and chemical-form-specific upper limits; keep personal input separate from historical sample data; require review before estimated foods enter the journal; protect existing records during migration, failed writes and concurrent-tab use; keep local journaling usable without network services.

**Implementation and peer contracts:**

- [Reference engine](../src/engine.js) and [source registry](../src/reference-data.js) own supported reference selection, canonical units and interpretation. [SCIENCE.md](SCIENCE.md) defines the interface and its limits.
- [Food capture](../src/foods.js) supplies consumed-portion values with traceable sources; [photo capture](../src/photo.js) supplies uncommitted nullable macro estimates. Neither commits journal entries. [FOOD-SOURCES.md](FOOD-SOURCES.md) records the source and provider obligations.
- [Application](../src/app.js) owns explicit upload and review actions, visible evidence/unknowns, and presentation. [Storage](../src/store.js) owns validation, provenance retention, recoverability and stale-write rejection. A failed durable write remains visibly unsaved even when the application retains a recoverable in-memory copy.
- [Offline worker](../sw.js) owns only the scoped application shell. Provider traffic, keys, journal content and other applications' caches are outside its responsibility.

**Observed mismatch and adaptation:** The previous hosted application used captured engine results while personal computation required an unavailable service. The implemented adaptation moves verified references and analysis into the offline app, adds sourced capture adapters, and makes coverage part of every interpretation. Evidence that would falsify the improvement includes unchanged targets after supported profile changes, fixture values entering personal reports, an unknown becoming zero, source loss after save/export, unconfirmed photo logging, or an older tab replacing newer records.

**Affected-peer responses:** Independent nutrition-engine and food-capture subagents using `gpt-6.1-sol` reviewed commit `74c75a8bfeadd5a98a5b2f433fa7389d91f1fea1` on 2026-11-06. Their observations led to fixes for canonical-unit alignment, scoped limits, missing-data rendering, provenance retention, malformed legacy recovery, excessive/conflicting energy, stale-tab writes and late barcode responses. Both accepted the resulting contracts with no remaining blockers in their reviewed scopes. These are independent software reviews, not dietitian review or permission for public promotion.

**Composed evidence:** The eighteen browser acceptance groups exercise the engine, adapters, UI, storage and worker together, including failure paths. The capture reviewer independently reran all eighteen at the same commit; the engine reviewer independently reran the scientific/storage/capture suites and the original recovery failures. A live Open Food Facts request succeeded. Private preview publication was verified separately, and its sixteen runtime files were byte-compared with the reviewed checkout. The public integration and hosted checks are tracked in [PR #8](https://github.com/ahrazzle/nutrak/pull/8); local checks alone do not establish that the existing public app serves this revision.

**Retained lessons:** Unknown amounts require a first-class representation across capture, storage and analysis. Provenance is part of a food entry, not temporary result-panel text. Recovery is only effective if the original survives a failed backup. Async provider results require cancellation and identity checks before changing a review surface. Whole-journal persistence must reject stale snapshots. These lessons are encoded in the engine, store and browser regression suites rather than relying on this record alone.

**Next action:** Exercise the optional photo path with an explicitly supplied personal key, then evaluate it on a consented, held-out set of weighed meals before making accuracy claims. Expand food coverage through traceable source records and add any new nutrient forms end to end. Obtain qualified nutrition review before adding clinical guidance, new life stages or stronger adequacy conclusions. Promote the reviewed public build only through the repository's normal integration process.
