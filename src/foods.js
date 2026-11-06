(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NutrakFoods = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const URL =
    "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/raw-fruits-poster-text-version-accessible-version";
  // name, edible serving grams, kcal, fat g, sodium mg, potassium mg, carbohydrate g, fiber g, protein g.
  const rows = [
    ["Apple", 242, 130, 0, 0, 260, 34, 5, 1],
    ["Avocado (California)", 30, 50, 4.5, 0, 140, 3, 1, 1],
    ["Banana", 126, 110, 0, 0, 450, 30, 3, 1],
    ["Cantaloupe", 134, 50, 0, 20, 240, 12, 1, 1],
    ["Grapefruit", 154, 60, 0, 0, 160, 15, 2, 1],
    ["Grapes", 126, 90, 0, 15, 240, 23, 1, 0],
    ["Honeydew melon", 134, 50, 0, 30, 210, 12, 1, 1],
    ["Kiwifruit", 148, 90, 1, 0, 450, 20, 4, 1],
    ["Lemon", 58, 15, 0, 0, 75, 5, 2, 0],
    ["Lime", 67, 20, 0, 0, 75, 7, 2, 0],
    ["Nectarine", 140, 60, 0.5, 0, 250, 15, 2, 1],
    ["Orange", 154, 80, 0, 0, 250, 19, 3, 1],
    ["Peach", 147, 60, 0.5, 0, 230, 15, 2, 1],
    ["Pear", 166, 100, 0, 0, 190, 26, 6, 1],
    ["Pineapple", 112, 50, 0, 10, 120, 13, 1, 1],
    ["Plums", 151, 70, 0, 0, 230, 19, 2, 1],
    ["Strawberries", 147, 50, 0, 0, 170, 11, 2, 1],
    ["Sweet cherries", 140, 100, 0, 0, 350, 26, 1, 1],
    ["Tangerine", 109, 50, 0, 0, 160, 13, 2, 1],
    ["Watermelon", 280, 80, 0, 0, 270, 21, 1, 1],
  ];
  const keys = [
    "energy_kcal",
    "fat",
    "sodium",
    "potassium",
    "carbohydrate",
    "fiber",
    "protein",
  ];
  const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, " ");
  const catalog = rows.map((r) => {
    const name = r[0] + " · raw";
    const aliases = [norm(r[0]), norm(r[0]).replace(/s$/, ""), norm(name)];
    if (r[0] === "Avocado (California)") aliases.push("avocado");
    if (r[0] === "Kiwifruit") aliases.push("kiwi");
    return Object.freeze({
      id: norm(r[0]).replace(/[^a-z]+/g, "-"),
      name,
      aliases: Object.freeze(aliases),
      per100g: Object.freeze(
        Object.fromEntries(keys.map((k, i) => [k, (r[i + 2] * 100) / r[1]])),
      ),
      source: Object.freeze({
        type: "reference",
        name: "FDA raw fruit poster (rounded label values)",
        url: URL,
        referenceGrams: r[1],
        note: "Raw edible portion. Per-100g values derived from rounded FDA serving values; zero can mean label rounding, not analytical absence. Unlisted nutrients are unknown.",
      }),
    });
  });
  const usdaFoods = [
    {
      id: "usda-169705",
      name: "Oats · dry",
      aliases: ["oats", "oat", "dry oats", "oats · dry"],
      per100g: {
        energy_kcal: 389.0,
        protein: 16.89,
        carbohydrate: 66.27,
        fat: 6.9,
        fiber: 10.6,
        calcium: 54.0,
        iron: 4.72,
        magnesium: 177.0,
        potassium: 429.0,
        sodium: 2.0,
        zinc: 3.97,
        vitamin_a: 0.0,
        vitamin_c: 0.0,
        vitamin_d: 0.0,
        vitamin_b6: 0.119,
        vitamin_b12: 0.0,
        folate: 56.0,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/169705/nutrients",
        fdcId: 169705,
        description:
          "Oats (Includes foods for USDA's Food Distribution Program)",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-168878",
      name: "Rice · white enriched, cooked",
      aliases: [
        "rice",
        "white rice",
        "cooked rice",
        "rice · white enriched, cooked",
      ],
      per100g: {
        energy_kcal: 130.0,
        protein: 2.69,
        carbohydrate: 28.17,
        fat: 0.28,
        fiber: 0.4,
        calcium: 10.0,
        iron: 1.2,
        magnesium: 12.0,
        potassium: 35.0,
        sodium: 1.0,
        zinc: 0.49,
        vitamin_a: 0.0,
        vitamin_c: 0.0,
        vitamin_d: 0.0,
        vitamin_e: 0.04,
        vitamin_k: 0.0,
        vitamin_b6: 0.093,
        vitamin_b12: 0.0,
        folate: 97.0,
        choline: 2.1,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/168878/nutrients",
        fdcId: 168878,
        description: "Rice, white, long-grain, regular, enriched, cooked",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-171477",
      name: "Chicken breast · roasted, meat only",
      aliases: [
        "chicken",
        "chicken breast",
        "roasted chicken",
        "chicken breast · roasted, meat only",
      ],
      per100g: {
        energy_kcal: 165.0,
        protein: 31.02,
        carbohydrate: 0.0,
        fat: 3.57,
        fiber: 0.0,
        calcium: 15.0,
        iron: 1.04,
        magnesium: 29.0,
        potassium: 256.0,
        sodium: 74.0,
        zinc: 1.0,
        vitamin_a: 6.0,
        vitamin_c: 0.0,
        vitamin_d: 0.1,
        vitamin_e: 0.27,
        vitamin_k: 0.3,
        vitamin_b6: 0.6,
        vitamin_b12: 0.34,
        folate: 4.0,
        choline: 85.3,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/171477/nutrients",
        fdcId: 171477,
        description:
          "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-173424",
      name: "Egg · hard-boiled",
      aliases: [
        "egg",
        "eggs",
        "boiled egg",
        "hard-boiled egg",
        "egg · hard-boiled",
      ],
      per100g: {
        energy_kcal: 155.0,
        protein: 12.58,
        carbohydrate: 1.12,
        fat: 10.61,
        fiber: 0.0,
        calcium: 50.0,
        iron: 1.19,
        magnesium: 10.0,
        potassium: 126.0,
        sodium: 124.0,
        zinc: 1.05,
        vitamin_a: 149.0,
        vitamin_c: 0.0,
        vitamin_d: 2.2,
        vitamin_e: 1.03,
        vitamin_k: 0.3,
        vitamin_b6: 0.121,
        vitamin_b12: 1.11,
        folate: 44.0,
        choline: 293.8,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/173424/nutrients",
        fdcId: 173424,
        description: "Egg, whole, cooked, hard-boiled",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-171265",
      name: "Milk · whole, added vitamin D",
      aliases: ["milk", "whole milk", "milk · whole, added vitamin d"],
      per100g: {
        energy_kcal: 61.0,
        protein: 3.15,
        carbohydrate: 4.8,
        fat: 3.25,
        fiber: 0.0,
        calcium: 113.0,
        iron: 0.03,
        magnesium: 10.0,
        potassium: 132.0,
        sodium: 43.0,
        zinc: 0.37,
        vitamin_a: 46.0,
        vitamin_c: 0.0,
        vitamin_d: 1.3,
        vitamin_e: 0.07,
        vitamin_k: 0.3,
        vitamin_b6: 0.036,
        vitamin_b12: 0.45,
        folate: 5.0,
        choline: 14.3,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/171265/nutrients",
        fdcId: 171265,
        description: "Milk, whole, 3.25% milkfat, with added vitamin D",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-172421",
      name: "Lentils · boiled, without salt",
      aliases: [
        "lentils",
        "lentil",
        "cooked lentils",
        "lentils · boiled, without salt",
      ],
      per100g: {
        energy_kcal: 116.0,
        protein: 9.02,
        carbohydrate: 20.13,
        fat: 0.38,
        fiber: 7.9,
        calcium: 19.0,
        iron: 3.33,
        magnesium: 36.0,
        potassium: 369.0,
        sodium: 2.0,
        zinc: 1.27,
        vitamin_a: 0.0,
        vitamin_c: 1.5,
        vitamin_d: 0.0,
        vitamin_e: 0.11,
        vitamin_k: 1.7,
        vitamin_b6: 0.178,
        vitamin_b12: 0.0,
        folate: 181.0,
        choline: 32.7,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/172421/nutrients",
        fdcId: 172421,
        description: "Lentils, mature seeds, cooked, boiled, without salt",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-168462",
      name: "Spinach · raw",
      aliases: ["spinach", "raw spinach", "spinach · raw"],
      per100g: {
        energy_kcal: 23.0,
        protein: 2.86,
        carbohydrate: 3.63,
        fat: 0.39,
        fiber: 2.2,
        calcium: 99.0,
        iron: 2.71,
        magnesium: 79.0,
        potassium: 558.0,
        sodium: 79.0,
        zinc: 0.53,
        vitamin_a: 469.0,
        vitamin_c: 28.1,
        vitamin_d: 0.0,
        vitamin_e: 2.03,
        vitamin_k: 482.9,
        vitamin_b6: 0.195,
        vitamin_b12: 0.0,
        folate: 194.0,
        choline: 19.3,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/168462/nutrients",
        fdcId: 168462,
        description: "Spinach, raw",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-171413",
      name: "Olive oil",
      aliases: ["olive oil", "olive oil"],
      per100g: {
        energy_kcal: 884.0,
        protein: 0.0,
        carbohydrate: 0.0,
        fat: 100.0,
        fiber: 0.0,
        calcium: 1.0,
        iron: 0.56,
        magnesium: 0.0,
        potassium: 1.0,
        sodium: 2.0,
        zinc: 0.0,
        vitamin_a: 0.0,
        vitamin_c: 0.0,
        vitamin_d: 0.0,
        vitamin_e: 14.35,
        vitamin_k: 60.2,
        vitamin_b6: 0.0,
        vitamin_b12: 0.0,
        folate: 0.0,
        choline: 0.3,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/171413/nutrients",
        fdcId: 171413,
        description: "Oil, olive, salad or cooking",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-175168",
      name: "Salmon · Atlantic farmed, cooked dry heat",
      aliases: [
        "salmon",
        "cooked salmon",
        "salmon · atlantic farmed, cooked dry heat",
      ],
      per100g: {
        energy_kcal: 206.0,
        protein: 22.1,
        carbohydrate: 0.0,
        fat: 12.35,
        fiber: 0.0,
        calcium: 15.0,
        iron: 0.34,
        magnesium: 30.0,
        potassium: 384.0,
        sodium: 61.0,
        zinc: 0.43,
        vitamin_a: 69.0,
        vitamin_c: 3.7,
        vitamin_d: 13.1,
        vitamin_e: 1.14,
        vitamin_k: 0.1,
        vitamin_b6: 0.647,
        vitamin_b12: 2.8,
        folate: 34.0,
        choline: 90.5,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/175168/nutrients",
        fdcId: 175168,
        description: "Fish, salmon, Atlantic, farmed, cooked, dry heat",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-170567",
      name: "Almonds",
      aliases: ["almonds", "almond", "almonds"],
      per100g: {
        energy_kcal: 579.0,
        protein: 21.15,
        carbohydrate: 21.55,
        fat: 49.93,
        fiber: 12.5,
        calcium: 269.0,
        iron: 3.71,
        magnesium: 270.0,
        potassium: 733.0,
        sodium: 1.0,
        zinc: 3.12,
        vitamin_a: 0.0,
        vitamin_c: 0.0,
        vitamin_d: 0.0,
        vitamin_e: 25.63,
        vitamin_k: 0.0,
        vitamin_b6: 0.137,
        vitamin_b12: 0.0,
        folate: 44.0,
        choline: 52.1,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/170567/nutrients",
        fdcId: 170567,
        description: "Nuts, almonds",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
    {
      id: "usda-173944",
      name: "Banana · raw",
      aliases: ["banana", "bananas", "raw banana", "banana · raw"],
      per100g: {
        energy_kcal: 89.0,
        protein: 1.09,
        carbohydrate: 22.84,
        fat: 0.33,
        fiber: 2.6,
        calcium: 5.0,
        iron: 0.26,
        magnesium: 27.0,
        potassium: 358.0,
        sodium: 1.0,
        zinc: 0.15,
        vitamin_a: 3.0,
        vitamin_c: 8.7,
        vitamin_d: 0.0,
        vitamin_e: 0.1,
        vitamin_k: 0.5,
        vitamin_b6: 0.367,
        vitamin_b12: 0.0,
        folate: 20.0,
        choline: 9.8,
      },
      source: {
        type: "reference",
        name: "USDA FoodData Central · SR Legacy",
        url: "https://fdc.nal.usda.gov/food-details/173944/nutrients",
        fdcId: 173944,
        description: "Bananas, raw",
        retrievedAt: "2026-11-06",
        note: "Generic reference composition per 100g edible portion. Match preparation and weigh your portion; unlisted nutrients remain unknown.",
        license: "CC0 1.0",
      },
    },
  ];
  // Prefer USDA banana over rounded FDA label reference; retain the other FDA fruits.
  catalog.splice(
    catalog.findIndex((f) => f.aliases.includes("banana")),
    1,
  );
  for (const f of usdaFoods)
    catalog.push(
      Object.freeze({
        ...f,
        aliases: Object.freeze(f.aliases),
        per100g: Object.freeze(f.per100g),
        source: Object.freeze(f.source),
      }),
    );
  function search(q) {
    q = norm(q);
    return catalog.filter((f) => !q || f.aliases.some((a) => a.includes(q)));
  }
  function scale(food, grams) {
    if (typeof food === "string") food = catalog.find((f) => f.id === food);
    if (!food || !food.per100g) throw Error("Choose a food first.");
    if (
      typeof grams !== "number" ||
      !Number.isFinite(grams) ||
      grams <= 0 ||
      grams > 10000
    )
      throw Error("Enter edible grams greater than 0 and at most 10,000.");
    const nutrients = {};
    for (const [k, v] of Object.entries(food.per100g)) {
      if (v === null) nutrients[k] = null;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0)
        nutrients[k] = (v * grams) / 100;
    }
    return {
      name: food.name,
      foodId: food.id,
      grams,
      nutrients,
      source: { ...food.source },
      requiresReview: true,
    };
  }
  function parseText(text) {
    const items = [],
      unresolved = [];
    for (const raw of String(text).split(/[,;\n]+/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(\d+(?:\.\d+)?)\s*(?:g|grams?)\s+(.+)$/i);
      if (!m) {
        unresolved.push({
          text: line,
          reason: "Use an explicit edible weight, for example 150g banana.",
        });
        continue;
      }
      const match = catalog.filter((f) => f.aliases.includes(norm(m[2])));
      if (match.length !== 1) {
        unresolved.push({
          text: line,
          reason:
            "No exact catalog match. Choose a reference food or enter verified label values.",
        });
        continue;
      }
      try {
        items.push({ ...scale(match[0], Number(m[1])), originalText: line });
      } catch (e) {
        unresolved.push({ text: line, reason: e.message });
      }
    }
    return { items, unresolved, requiresReview: true };
  }
  async function lookupBarcode(code, options = {}) {
    if (!/^\d{8,14}$/.test(String(code)))
      throw Error("Enter an 8–14 digit barcode.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) throw Error("Lookup cancelled.");
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      abort,
      Math.min(Math.max(options.timeoutMs || 12000, 1), 30000),
    );
    try {
      const response = await (options.fetch || globalThis.fetch)(
        `https://world.openfoodfacts.org/api/v2/product/${code}?fields=code,product_name,nutriments,nutrition_data_per,product_quantity_unit,quantity,serving_size`,
        {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "Nutrak/0.2 (https://github.com/ahrazzle/nutrak)",
          },
        },
      );
      if (!response.ok)
        throw Error(`Food lookup failed (HTTP ${response.status}).`);
      const data = await response.json();
      if (data.status !== 1 || !data.product)
        throw Error("Barcode not found. Enter the package label manually.");
      const p = data.product;
      const basis = String(p.nutrition_data_per || "");
      const volume =
        String(p.product_quantity_unit || "") +
        " " +
        String(p.quantity || "") +
        " " +
        String(p.serving_size || "");
      if (
        /ml|millilit|litre|liter|fl[ ._-]*oz/i.test(volume) ||
        /100\s*ml/i.test(basis)
      )
        throw Error(
          "Volume-based package: enter verified mass-based values or use a known density. Millilitres are not grams.",
        );
      const n = p.nutriments || {},
        per100g = {};
      const map = {
        energy_kcal: ["energy-kcal", 1],
        protein: ["proteins", 1],
        carbohydrate: ["carbohydrates", 1],
        fat: ["fat", 1],
        fiber: ["fiber", 1],
        sodium: ["sodium", 1000],
        potassium: ["potassium", 1000],
        calcium: ["calcium", 1000],
        iron: ["iron", 1000],
        magnesium: ["magnesium", 1000],
        zinc: ["zinc", 1000],
      };
      for (const [k, [off, factor]] of Object.entries(map)) {
        const value = n[off + "_100g"];
        if (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value * factor <=
            (k === "energy_kcal" ? 1000 : factor === 1000 ? 100000 : 100)
        )
          per100g[k] = value * factor;
      }
      if (!Object.keys(per100g).length)
        throw Error("This product has no usable per-100g nutrition data.");
      return {
        id: "off-" + code,
        name: String(data.product.product_name || "Packaged food").slice(
          0,
          200,
        ),
        aliases: [],
        per100g,
        source: {
          type: "label",
          name: "Open Food Facts · community supplied label",
          url: `https://world.openfoodfacts.org/product/${code}`,
          note: "Verify against your package. Values are per 100g; sodium and mineral grams converted to mg. Missing nutrients remain unknown.",
          license: "ODbL 1.0",
          retrievedAt: new Date().toISOString(),
        },
      };
    } catch (e) {
      if (controller.signal.aborted)
        throw Error(
          "Food lookup cancelled or timed out. Try again explicitly.",
        );
      throw e;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  return {
    catalog: Object.freeze(catalog),
    search,
    scale,
    parseText,
    lookupBarcode,
  };
});
