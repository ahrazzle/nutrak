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
