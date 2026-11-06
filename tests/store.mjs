import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
const c = vm.createContext({ crypto: webcrypto, structuredClone, console });
for (const f of ["reference-data.js", "engine.js", "store.js"])
  vm.runInContext(
    readFileSync(new URL("../src/" + f, import.meta.url), "utf8"),
    c,
  );
const memory = new Map(),
  storage = {
    getItem: (k) => memory.get(k) || null,
    setItem: (k, v) => memory.set(k, v),
  };
const store = c.NutrakStore.create(storage),
  initial = store.get();
const food = {
  id: "a",
  date: "2026-11-06",
  food: "Oats",
  tier: "weighed",
  grams: 100,
  nutrients: { energy_kcal: 389, protein: 16.9 },
  source: {
    name: "USDA",
    url: "https://fdc.nal.usda.gov/",
    note: "Exact reference",
  },
};
store.save({ ...initial, entries: [food] });
assert.equal(
  store.get().entries[0].nutrients.calcium,
  undefined,
  "unknown remains unknown",
);
assert.equal(store.get().entries[0].source.name, "USDA");
assert.equal(store.get().entries[0].grams, 100);
assert.throws(
  () =>
    store.import(
      JSON.stringify({
        ...initial,
        entries: [{ ...food, date: "2026-02-30" }],
      }),
    ),
  /valid date/,
);
assert.throws(() =>
  store.import(
    JSON.stringify({
      ...initial,
      entries: [food],
      profile: {
        ageYears: 30,
        sex: "F",
        heightCm: 170,
        weightKg: 60,
        pal: "bogus",
      },
    }),
  ),
);
assert.equal(store.get().entries.length, 1, "bad imports are atomic");
assert.throws(
  () => store.import(JSON.stringify({ ...initial, entries: [food, food] })),
  /Duplicate/,
);
const before = store.export();
storage.setItem = () => {
  throw Error("quota");
};
assert.throws(() => store.save({ ...initial, entries: [] }), /not saved/);
assert.equal(
  store.export(),
  before,
  "quota failure does not mutate saved state",
);
const legacy = new Map([
  ["nutrak.entries", JSON.stringify([{ ...food, macros: { protein: 12 } }])],
]);
assert.equal(
  c.NutrakStore.create({
    getItem: (k) => legacy.get(k) || null,
    setItem: (k, v) => legacy.set(k, v),
  }).get().entries.length,
  1,
  "legacy sparse macros migrate",
);
console.log(
  "PASS atomic import, strict dates, profile validation, provenance, unknown values, quota failures, legacy migration",
);
assert.throws(() => c.NutrakStore.entry({ ...food, kcal: 1e308 }), /energy/i);
assert.throws(
  () =>
    c.NutrakStore.entry({
      ...food,
      kcal: 100,
      nutrients: { energy_kcal: 200 },
    }),
  /Conflicting/,
);
const brokenRaw = JSON.stringify({
  ...initial,
  entries: [{ ...food, date: "2026-02-30" }],
});
let surviving = brokenRaw;
const recovery = c.NutrakStore.create({
  getItem: (k) => (k === "nutrak.v2" ? surviving : null),
  setItem: (k, v) => {
    if (k.startsWith("nutrak.recovery.")) throw Error("quota");
    surviving = v;
  },
});
assert.equal(recovery.recovery(), brokenRaw);
assert.throws(() => recovery.save(initial), /preserve/);
assert.equal(
  surviving,
  brokenRaw,
  "unreadable data remains intact if recovery write fails",
);
const richLegacy = {
  ...food,
  kcal: 389,
  nutrients: { energy_kcal: 389, carbohydrate: 25, fat: 8 },
  macros: { protein: 12 },
};
const migrated = c.NutrakStore.create({
  getItem: (k) =>
    k === "nutrak.entries" ? JSON.stringify([richLegacy]) : null,
  setItem() {},
}).get().entries[0];
assert.equal(migrated.nutrients.carbohydrate, 25);
assert.equal(migrated.nutrients.fat, 8);
assert.equal(migrated.nutrients.protein, 12);
console.log(
  "PASS original-data recovery lock, energy bounds/conflicts, canonical legacy nutrient retention",
);
const multi = new Map(),
  multiStorage = {
    getItem: (k) => multi.get(k) || null,
    setItem: (k, v) => multi.set(k, v),
  };
const tabA = c.NutrakStore.create(multiStorage),
  tabB = c.NutrakStore.create(multiStorage);
tabA.save({ ...initial, entries: [food] });
assert.throws(() => tabB.save(initial), /Another tab/);
assert.equal(JSON.parse(multi.get("nutrak.v2")).entries.length, 1);
const corruptLegacy = "[{invalid json";
const legacyRecovery = c.NutrakStore.create({
  getItem: (k) => (k === "nutrak.entries" ? corruptLegacy : null),
  setItem() {
    throw Error("quota");
  },
});
assert.equal(legacyRecovery.recovery(), corruptLegacy);
assert.throws(() => legacyRecovery.save(initial), /preserve/);
console.log("PASS stale-tab write guard and corrupt legacy recovery");
