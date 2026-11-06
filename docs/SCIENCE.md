# Nutrak's reference model and limits

Nutrak compares a food log with published adult Dietary Reference Intakes (DRIs). It does not diagnose nutrient deficiency, estimate a person's probability of inadequacy, prescribe supplements, or prescribe weight loss. All calculations run offline with no runtime dependencies. Reference facts and equations were checked against the primary Health Canada tables on 2026-11-06. These Canadian/US DRI references apply to generally healthy people and are distinct from food-label Daily Values.

## Sources

- [Health Canada: DRI definitions](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html).
- [Health Canada: energy equations](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html).
- [NASEM, Dietary Reference Intakes for Energy (2023), chapter 5, Table 5-16](https://www.nationalacademies.org/read/26818/chapter/7).
- [Health Canada: vitamin values and footnotes](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-vitamins.html).
- [Health Canada: mineral values and footnotes](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-elements.html).
- [Health Canada: macronutrients and AMDR](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html).

## Supported profiles

`computeProfile(inputs)` accepts numeric `ageYears`, `heightCm`, and `weightKg`; `sex: 'M' | 'F'`; `pal: 'inactive' | 'low_active' | 'active' | 'very_active'`; and an explicit `reproState: null | 'preg' | 'lact'`. It throws for missing, nonnumeric, nonfinite or unsupported inputs. No silent defaults are applied. Adults 19 and older are supported. The app's operational input bounds (age 19–120, height 100–250 cm, weight 20–500 kg) guard input errors; they are not evidence that equations are validated at every extreme. Fractional age is accepted; reference transitions occur at age 31, 51 and 71.

M/F identify the categories in the reference equations, not gender identity. Pregnancy and lactation nutrient tables are supported only for F profiles ages 19–50. The engine returns `energy: null` and AMDR gram `range: null` for these states because the inputs do not supply gestational stage, pre-pregnancy BMI or lactation stage. It gives the published 71 g/day protein reference for lactation. Pregnancy protein has a null target because the 71 g/day RDA applies only to the second half of pregnancy; first-half requirements match the nonpregnant reference, and stage is not collected. Individual planning needs appropriate professional support.

## Energy and macronutrients

Energy uses the NASEM 2023 adult EER equations published by Health Canada, with separate coefficients for each sex and activity category. For example, a 30-year-old M profile, 175 cm and 70 kg, inactive, gives `753.07 − 10.83×30 + 6.50×175 + 14.10×70 = 2552.67 kcal/day`. The activity categories correspond to adult PAL intervals: inactive 1.00–<1.53; low active 1.53–<1.68; active 1.68–<1.85; very active 1.85–<2.50. Self-selecting a category introduces uncertainty. Body-weight trend is the preferred indicator of energy adequacy.

The displayed energy band is EER ± one published model root mean squared error (RMSE): 339 kcal/day for M and 246 kcal/day for F. NASEM 2023 chapter 5, Tables 5-5 and 5-6, reports these model-fit statistics for the adult general TEE equations. The band describes model error in the study data. It is **not a statistical confidence interval**, an individual prediction interval, or a therapeutic calorie range; no probability coverage is claimed. No deficit or surplus is added.

Adult AMDRs are protein 10–35%, carbohydrate 45–65%, and fat 20–35% of energy. Gram endpoints use the EER center and conventional 4/4/9 kcal per gram. They are not a jointly optimized meal plan. Protein RDA is separately shown at 0.8 g/kg/day for non-reproductive adults. Carbohydrate RDA is for digestible carbohydrate; a total-carbohydrate food-label field may include fibre and should be interpreted accordingly. Fibre uses the published age/sex AI, not a newly calculated energy-scaled target.

## Nutrient units and interpretation

Each returned nutrient contains its target, reference type, unit, UL where established, UL scope, explanation and source links. Canonical entry keys are:

| IDs | Required units |
| --- | --- |
| `energy_kcal` | kcal |
| `protein`, `carbohydrate`, `fat`, `fiber` | g |
| `calcium`, `iron`, `magnesium`, `potassium`, `sodium`, `zinc`, `vitamin_c`, `vitamin_b6`, `choline` | mg |
| `vitamin_a` | µg retinol activity equivalents (RAE) |
| `vitamin_d`, `vitamin_k`, `vitamin_b12` | µg |
| `vitamin_e` | mg alpha-tocopherol |
| `folate` | µg dietary folate equivalents (DFE) |

Amounts must already represent the portion consumed. The engine applies no serving multiplier or unit conversion. Do not treat total folate in µg as DFE unless its source establishes that equivalence. Unknown forms or unsupported units should remain unknown.

An **RDA** is an intake planning reference intended to meet the needs of nearly all healthy people in its group. A short record below it does not diagnose deficiency. An **AI** is used where evidence is insufficient for an EAR/RDA; below an AI cannot establish inadequacy. Above an AI does not establish overall diet quality. Sodium is displayed against its **CDRR** of 2300 mg/day, a threshold above which reducing intake is expected to lower chronic disease risk. This is not a minimum or a UL; the adult sodium AI is 1500 mg/day. Fat has an AMDR and no scalar RDA/AI target.

The references assume a typical mixed North American diet. The engine does not adjust for smoking (vitamin C requirement increases 35 mg/day), vegetarian iron bioavailability (iron requirement 1.8 times higher), lower zinc bioavailability in some vegetarian diets, menopause differing from the table's age assumption, or disease and medicine effects. The UI should retain these explanations. Adults over 50 have a source-specific B12 recommendation. These are disclosed limitations, not hidden personalization.

## Upper intake levels

A UL is a chronic intake risk reference, not a target or a toxicity diagnosis. No established UL does not imply unlimited safety. The engine assesses a total-intake UL only when every calendar day in the selected window is complete and every entry on those days contains that nutrient. It reports `above_ul` or `not_above_ul`; neither is a clinical conclusion.

It deliberately returns `scope_not_available` for these ULs because the current log lacks chemical-form/source fields:

- Magnesium: pharmacological agents only, excluding food and water.
- Folate: synthetic folic acid in supplements and fortified food, measured in µg folic acid, not total µg DFE.
- Vitamin A: preformed vitamin A, excluding food carotenoids.
- Vitamin E: synthetic vitamin E from supplements and fortified foods.

Total logged magnesium, folate DFE, vitamin A RAE and vitamin E are never compared with those scoped limits.

## Log analysis and missingness

`analyze(entries, profile, {windowDays: 7 | 30, endDate: 'YYYY-MM-DD', completeDays: [...]})` uses an inclusive UTC calendar window ending on the supplied date. Every entry requires `{date, nutrients: {id: amount}}`. Dates are strictly validated; impossible dates are rejected. Nutrient amounts must be finite nonnegative numbers. An omitted, null or undefined nutrient is unknown. Explicit numeric zero is known zero. Invalid numeric values are rejected, including in entries outside the window. Valid outside-window entries do not contribute.

The report exposes observed dates, complete dates, missing calendar days, incomplete days and entry count. A user must explicitly mark a day complete. A marked day with no entries is still missing evidence, not a zero-intake day.

For each nutrient:

- `knownTotal` sums known amounts within the window, or is null when none are known.
- `observedMean` divides that partial sum by the number of days with any entries. It is descriptive only; unknown nutrient amounts remain excluded from the sum. It is never used to judge intake.
- `comparableDays` includes only user-declared complete days with at least one entry and a known amount for this nutrient in **every** entry on that day.
- `mean` and `completeMean` are identical: sum on comparable days divided by their count, or null if none qualify.
- `unknownEntries` counts entries missing this nutrient; `unknownDays` lists all calendar days not comparable for it.
- `targetPercent` compares the comparable-day mean with a scalar target. If the window is incomplete, it describes only those comparable days, and the UI must show that denominator. It is null when no comparable day or scalar target exists.
- `status` stays `insufficient_data` unless the **entire calendar window** is comparable for the nutrient. Full-window statuses describe the logged mean relative to a reference (`below_rda`, `at_or_above_rda`, `below_ai_uncertain`, `at_or_above_ai`, `above_cdrr`, `at_or_below_cdrr`, `energy_comparison`). They are not diagnoses or estimates of usual intake.

A complete log is user-declared, not independently verified. Food composition, source units, portion estimates, selective logging and day-to-day variation all affect interpretation. Seven or thirty recorded days do not eliminate these uncertainties.

## Verification

Run `node tests/engine.mjs`. Tests independently check the 2023 EER arithmetic, adult age transitions and reproductive references, AMDR conversions, strict numeric and calendar validation, leap-year windows, exclusion of outside dates, absent nutrients versus explicit zeros, per-nutrient day completeness, insufficient-data behavior, and safe handling of scoped ULs. The same files are exercised as classic browser scripts and CommonJS modules.
