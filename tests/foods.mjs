import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import foods from "../src/foods.js";
assert.equal(foods.catalog.length, 30);
const banana = foods.search("banana")[0];
assert.equal(foods.scale(banana, 100).nutrients.energy_kcal, 89);
assert.equal(foods.scale(banana, 100).nutrients.iron, 0.26);
assert.throws(() => foods.scale(banana, NaN));
const draft = foods.parseText("100g banana, unknown dinner; 20g apple");
assert.equal(draft.items.length, 2);
assert.equal(draft.unresolved.length, 1);
assert.equal(draft.requiresReview, true);
const product = await foods.lookupBarcode("12345678", {
  fetch: async (url, opts) => {
    assert.match(url, /^https:\/\/world.openfoodfacts.org/);
    assert.equal(opts.method, "GET");
    return {
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: "Test",
          nutriments: {
            "energy-kcal_100g": 120,
            sodium_100g: 0.2,
            proteins_100g: -1,
            fat_100g: "7",
          },
        },
      }),
    };
  },
});
assert.equal(product.per100g.sodium, 200);
assert.equal(product.per100g.protein, undefined);
assert.equal(product.per100g.fat, undefined);
await assert.rejects(
  foods.lookupBarcode("12345678", {
    fetch: async () => ({ ok: true, json: async () => ({ status: 0 }) }),
  }),
  /not found/,
);
await assert.rejects(
  foods.lookupBarcode("12345678", {
    timeoutMs: 1,
    fetch: (_, o) =>
      new Promise((_, reject) =>
        o.signal.addEventListener("abort", () => reject(Error("abort"))),
      ),
  }),
  /timed out/,
);
console.log(
  "foods: catalog provenance, scaling, parser and mocked barcode checks passed",
);

const snapshot = JSON.parse(
  await readFile(
    new URL("../docs/usda-source-snapshot.json", import.meta.url),
    "utf8",
  ),
);
for (const record of snapshot.records) {
  const food = foods.catalog.find((f) => f.source.fdcId === record.fdcId);
  assert.ok(food);
  for (const n of record.nutrientsPer100g) {
    assert.equal(food.per100g[n.canonicalId], n.amount);
    assert.ok(
      Math.abs(foods.scale(food, 200).nutrients[n.canonicalId] - n.amount * 2) <
        1e-8,
    );
    if (n.canonicalId === "vitamin_a") {
      assert.equal(n.id, 1106);
      assert.equal(n.name, "Vitamin A, RAE");
      assert.equal(n.unit, "µg");
    }
    if (n.canonicalId === "folate") {
      assert.equal(n.id, 1190);
      assert.equal(n.name, "Folate, DFE");
      assert.equal(n.unit, "µg");
    }
    if (n.canonicalId === "vitamin_e") {
      assert.equal(n.id, 1109);
      assert.match(n.name, /alpha-tocopherol/);
    }
  }
}
assert.equal(foods.parseText("100g oats, 150g banana").items.length, 2);
assert.equal(foods.search("oats")[0].per100g.energy_kcal, 389);
console.log(
  "foods: all USDA snapshot values, portion scaling and canonical special units verified",
);

const expectedUnits = {
  energy_kcal: "kcal",
  protein: "g",
  carbohydrate: "g",
  fat: "g",
  fiber: "g",
  calcium: "mg",
  iron: "mg",
  magnesium: "mg",
  potassium: "mg",
  sodium: "mg",
  zinc: "mg",
  vitamin_a: "µg",
  vitamin_c: "mg",
  vitamin_d: "µg",
  vitamin_e: "mg",
  vitamin_k: "µg",
  vitamin_b6: "mg",
  vitamin_b12: "µg",
  folate: "µg",
  choline: "mg",
};
for (const r of snapshot.records)
  for (const n of r.nutrientsPer100g)
    assert.equal(n.unit, expectedUnits[n.canonicalId]);
await assert.rejects(
  foods.lookupBarcode("12345678", {
    fetch: async () => ({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: "Milk",
          nutrition_data_per: "100g",
          quantity: "1 Litre",
          nutriments: { "energy-kcal_100g": 62 },
        },
      }),
    }),
  }),
  /Volume-based/,
);
