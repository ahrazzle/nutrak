import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const E = require("../src/engine.js");
const input = {
  ageYears: 30,
  sex: "M",
  heightCm: 175,
  weightKg: 70,
  pal: "inactive",
  reproState: null,
};
const profile = E.computeProfile(input);
const n = (p, id) => p.nutrients.find((n) => n.id === id);
// Independent arithmetic for Health Canada / NASEM 2023 adult equation.
assert.ok(Math.abs(profile.energy.center - 2552.67) < 1e-8);
assert.deepEqual(profile.energy.coefficients, [753.07, -10.83, 6.5, 14.1]);
assert.match(profile.energy.explanation, /not a confidence interval/);
assert.equal(profile.energy.modelRmse, 339);
assert.ok(Math.abs(profile.energy.range.lo - (2552.67 - 339)) < 1e-8);
assert.equal(E.computeProfile({ ...input, sex: "F" }).energy.modelRmse, 246);
for (const [sex, pal, expected] of [
  ["M", "low_active", 2754.87],
  ["M", "active", 2934.62],
  ["M", "very_active", 3226.67],
  ["F", "inactive", 2195.3],
  ["F", "low_active", 2370.27],
  ["F", "active", 2508.25],
  ["F", "very_active", 2767.98],
])
  assert.ok(
    Math.abs(
      E.computeProfile({ ...input, sex, pal }).energy.center - expected,
    ) < 1e-8,
    sex + " " + pal,
  );
assert.equal(n(profile, "protein").target, 56);
assert.equal(n(profile, "magnesium").target, 400);
assert.equal(n(profile, "sodium").type, "CDRR");
assert.equal(n(profile, "sodium").target, 2300);
assert.equal(n(profile, "sodium").ul, null);
assert.equal(n(profile, "fiber").type, "AI");
assert.equal(profile.macros.fat.percentEnergy.lo, 20);
assert.equal(profile.macros.fat.percentEnergy.hi, 35);
assert.ok(
  Math.abs(profile.macros.carbohydrate.range.lo - (2552.67 * 0.45) / 4) < 1e-8,
);
const older = E.computeProfile({ ...input, sex: "F", ageYears: 71 });
assert.equal(n(older, "calcium").target, 1200);
assert.equal(n(older, "calcium").ul, 2000);
assert.equal(n(older, "vitamin_d").target, 20);
assert.equal(n(older, "iron").target, 8);
assert.equal(n(older, "fiber").target, 21);
const younger = E.computeProfile({ ...input, sex: "F", ageYears: 50 });
assert.equal(n(younger, "iron").target, 18);
assert.equal(n(younger, "calcium").target, 1000);
const pregnant = E.computeProfile({ ...input, sex: "F", reproState: "preg" });
assert.equal(pregnant.energy, null);
assert.equal(pregnant.macros.fat.range, null);
assert.equal(n(pregnant, "iron").target, 27);
assert.equal(n(pregnant, "folate").target, 600);
assert.equal(n(pregnant, "protein").target, null);
assert.match(n(pregnant, "protein").explanation, /second half/);
const lact = E.computeProfile({ ...input, sex: "F", reproState: "lact" });
assert.equal(n(lact, "vitamin_e").target, 19);
assert.equal(n(lact, "vitamin_b12").target, 2.8);
for (const [key, value] of [
  ["ageYears", 18],
  ["ageYears", "30"],
  ["weightKg", NaN],
  ["heightCm", Infinity],
  ["pal", "moderate"],
  ["sex", "X"],
  ["reproState", undefined],
  ["weightKg", 0],
])
  assert.throws(() => E.computeProfile({ ...input, [key]: value }));
assert.throws(() => E.computeProfile({ ...input, reproState: "preg" }));
assert.throws(() =>
  E.computeProfile({ ...input, sex: "F", ageYears: 51, reproState: "preg" }),
);
const opts = { windowDays: 7, endDate: "2026-03-02", completeDays: [] };
let report = E.analyze([], profile, opts);
assert.equal(report.startDate, "2026-02-24");
assert.equal(report.missingDays.length, 7);
assert.equal(n(report, "iron").knownTotal, null);
assert.equal(n(report, "iron").mean, null);
assert.equal(n(report, "iron").targetPercent, null);
const dates = [
  "2026-02-24",
  "2026-02-25",
  "2026-02-26",
  "2026-02-27",
  "2026-02-28",
  "2026-03-01",
  "2026-03-02",
];
const entries = dates.map((date) => ({
  date,
  nutrients: {
    iron: 8,
    fiber: 10,
    sodium: 2400,
    magnesium: 500,
    folate: 2000,
    vitamin_a: 4000,
    vitamin_e: 2000,
    calcium: 2600,
  },
}));
report = E.analyze(entries, profile, { ...opts, completeDays: dates });
assert.equal(report.missingDays.length, 0);
assert.equal(n(report, "iron").knownTotal, 56);
assert.equal(n(report, "iron").mean, 8);
assert.equal(n(report, "iron").status, "at_or_above_rda");
assert.equal(n(report, "fiber").status, "below_ai_uncertain");
assert.equal(n(report, "sodium").status, "above_cdrr");
assert.equal(n(report, "calcium").ulStatus, "above_ul");
for (const id of ["magnesium", "folate", "vitamin_a", "vitamin_e"])
  assert.equal(n(report, id).ulStatus, "scope_not_available");
assert.equal(n(report, "vitamin_c").status, "insufficient_data");
assert.equal(n(report, "vitamin_c").unknownEntries, 7);
assert.equal(n(report, "vitamin_c").mean, null);
// Unknown nutrient in one entry excludes that whole day for that nutrient only.
report = E.analyze(
  [...entries, { date: dates[0], nutrients: { iron: null, fiber: 0 } }],
  profile,
  { ...opts, completeDays: dates },
);
assert.equal(n(report, "iron").comparableDays.length, 6);
assert.equal(n(report, "iron").knownTotal, 56);
assert.equal(n(report, "iron").unknownEntries, 1);
assert.equal(n(report, "iron").status, "insufficient_data");
assert.equal(n(report, "fiber").comparableDays.length, 7);
// Sparse logs never become a low-intake or deficiency claim.
report = E.analyze([entries[0]], profile, { ...opts, completeDays: dates });
assert.equal(report.completeDays, 1);
assert.equal(report.missingDays.length, 6);
assert.equal(n(report, "iron").status, "insufficient_data");
assert.equal(n(report, "iron").mean, 8);
assert.equal(n(report, "iron").targetPercent, 100);
assert.equal(n(report, "protein").knownTotal, null);
assert.equal(
  n(
    E.analyze([{ date: dates[0], nutrients: { iron: 0 } }], profile, opts),
    "iron",
  ).knownTotal,
  0,
);
// Calendar arithmetic is UTC, handles leap days and excludes future/outside entries.
assert.equal(
  E.analyze([], profile, {
    windowDays: 30,
    endDate: "2024-03-01",
    completeDays: [],
  }).startDate,
  "2024-02-01",
);
assert.equal(
  E.analyze([{ date: "2026-03-03", nutrients: { iron: 999 } }], profile, opts)
    .entryCount,
  0,
);
for (const d of ["2026-02-29", "2026-02-30", "2026-2-01", "garbage"])
  assert.throws(() => E.analyze([], profile, { ...opts, endDate: d }));
assert.throws(() => E.analyze([], profile, { ...opts, windowDays: 1 }));
assert.throws(() =>
  E.analyze([], profile, { ...opts, completeDays: undefined }),
);
for (const value of [-1, "8", NaN, Infinity])
  assert.throws(() =>
    E.analyze([{ date: dates[0], nutrients: { iron: value } }], profile, opts),
  );
assert.throws(() =>
  E.analyze(
    [
      { date: dates[0], nutrients: { iron: Number.MAX_VALUE } },
      { date: dates[0], nutrients: { iron: Number.MAX_VALUE } },
    ],
    profile,
    opts,
  ),
);
assert.throws(
  () =>
    E.analyze(
      [{ date: dates[0], nutrients: { vitamin_b12: Number.MAX_VALUE } }],
      profile,
      { ...opts, completeDays: [dates[0]] },
    ),
  /comparison overflow/,
);
// No runtime dependencies; classic scripts expose the same API in a fresh browser-like realm.
const context = vm.createContext({});
for (const file of ["reference-data.js", "engine.js"])
  vm.runInContext(
    fs.readFileSync(new URL("../src/" + file, import.meta.url), "utf8"),
    context,
  );
assert.equal(
  context.NutrakEngine.computeProfile(input).energy.center,
  profile.energy.center,
);
assert.ok(
  profile.nutrients.every((n) =>
    n.sources.every((s) => s.url.startsWith("https://www.canada.ca/")),
  ),
);
console.log(
  "Nutrition engine: authoritative equation cases, life stages, units, unknowns, UL scope, calendar windows, and validation passed.",
);
