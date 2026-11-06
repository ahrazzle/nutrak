(function (root) {
  "use strict";
  const ref =
    typeof module !== "undefined" && module.exports
      ? require("./reference-data.js")
      : root.NutrakReferenceData;
  if (!ref) throw new Error("Load reference-data.js before engine.js");
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function number(value, name, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(name + " must be a finite number");
    if (value < min || value > max)
      throw new RangeError(name + " must be between " + min + " and " + max);
    return value;
  }
  function computeProfile(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new TypeError("Profile inputs are required");
    const age = number(input.ageYears, "ageYears", 19, 120);
    const weight = number(input.weightKg, "weightKg", 20, 500);
    const height = number(input.heightCm, "heightCm", 100, 250);
    const sex = input.sex,
      pal = input.pal,
      state = input.reproState;
    if (!own(ref.eer, sex))
      throw new RangeError(
        "sex must be M or F (the reference equation categories)",
      );
    if (!own(ref.eer[sex], pal))
      throw new RangeError(
        "pal must be inactive, low_active, active, or very_active",
      );
    if (![null, "preg", "lact"].includes(state))
      throw new RangeError("reproState must explicitly be null, preg, or lact");
    if (state && (sex !== "F" || age >= 51))
      throw new RangeError(
        "Pregnancy/lactation references in this engine support F ages 19–50 only",
      );
    const m = sex === "M",
      p = state === "preg",
      l = state === "lact";
    const inputs = {
      ageYears: age,
      sex,
      heightCm: height,
      weightKg: weight,
      pal,
      reproState: state,
    };
    const coefficients = ref.eer[sex][pal];
    const center =
      coefficients[0] +
      coefficients[1] * age +
      coefficients[2] * height +
      coefficients[3] * weight;
    if (center <= 0)
      throw new RangeError(
        "Inputs produce a nonpositive energy estimate; this profile is outside supported use",
      );
    const energy = state
      ? null
      : {
          center,
          range: {
            lo: center - ref.adultRmse[sex],
            hi: center + ref.adultRmse[sex],
          },
          modelRmse: ref.adultRmse[sex],
          rangeBasis: "EER ± one published model RMSE",
          unit: "kcal",
          basis: "NASEM 2023 adult EER",
          coefficients: coefficients.slice(),
          explanation:
            "Estimated daily maintenance energy. The band is EER ± one model root mean squared error (RMSE): 339 kcal/day for M, 246 for F, from NASEM 2023 Tables 5-5 and 5-6. It describes model fit in the study data, not a confidence interval, an individual prediction interval, or a prescribed intake range. Body-weight trend is the preferred indicator of energy adequacy. No weight-loss adjustment is applied.",
          sources: [ref.sources.energy, ref.sources.energyModel],
        };
    const nutrients = [];
    function add(
      id,
      name,
      unit,
      target,
      type,
      ul,
      source,
      ulScope = "total",
      note = "",
    ) {
      nutrients.push({
        id,
        name,
        unit,
        target,
        type,
        ul,
        ulScope: ul === null ? null : ulScope,
        explanation:
          (type === "AI"
            ? "Adequate Intake: below this value cannot establish inadequacy. "
            : type === "CDRR"
              ? "Chronic Disease Risk Reduction intake: reduce intake if above this value; this is not a minimum or a UL. "
              : "Recommended Dietary Allowance for planning intake in generally healthy adults; a short log cannot diagnose deficiency. ") +
          note,
        sources: [ref.sources[source], ref.sources.definitions],
      });
    }
    add(
      "protein",
      "Protein",
      "g",
      p ? null : l ? 71 : weight * 0.8,
      "RDA",
      null,
      "macros",
      "total",
      p
        ? "Pregnancy stage is not collected: the 71 g/day RDA applies only in the second half of pregnancy; first-half requirements are nonpregnant. No scalar target is selected."
        : l
          ? "Uses the published 71 g/day lactation reference, not current weight."
          : "0.8 g/kg/day multiplied by the supplied weight; not a sport or clinical prescription.",
    );
    add(
      "carbohydrate",
      "Carbohydrate",
      "g",
      p ? 175 : l ? 210 : 130,
      "RDA",
      null,
      "macros",
      "total",
      "The reference is for digestible carbohydrate; food labels may include fibre in total carbohydrate.",
    );
    add(
      "fiber",
      "Fibre",
      "g",
      p ? 28 : l ? 29 : m ? (age < 51 ? 38 : 30) : age < 51 ? 25 : 21,
      "AI",
      null,
      "macros",
    );
    add(
      "calcium",
      "Calcium",
      "mg",
      age >= 71 || (!m && age >= 51) ? 1200 : 1000,
      "RDA",
      age < 51 ? 2500 : 2000,
      "elements",
    );
    add(
      "iron",
      "Iron",
      "mg",
      p ? 27 : l ? 9 : m || age >= 51 ? 8 : 18,
      "RDA",
      45,
      "elements",
      "total",
      "Mixed-diet reference. Iron requirements are 1.8 times higher for vegetarians; the female age 51+ reference assumes post-menopause.",
    );
    add(
      "magnesium",
      "Magnesium",
      "mg",
      p
        ? age < 31
          ? 350
          : 360
        : m
          ? age < 31
            ? 400
            : 420
          : age < 31
            ? 310
            : 320,
      "RDA",
      350,
      "elements",
      "pharmacological agents only",
      "The UL excludes food and water and is never compared with total logged magnesium.",
    );
    add(
      "potassium",
      "Potassium",
      "mg",
      p ? 2900 : l ? 2800 : m ? 3400 : 2600,
      "AI",
      null,
      "elements",
    );
    add(
      "sodium",
      "Sodium",
      "mg",
      2300,
      "CDRR",
      null,
      "elements",
      "total",
      "Adult sodium AI is 1500 mg/day. 2300 mg is the CDRR threshold, not the AI.",
    );
    add(
      "zinc",
      "Zinc",
      "mg",
      p ? 11 : l ? 12 : m ? 11 : 8,
      "RDA",
      40,
      "elements",
      "total",
      "Vegetarian diets may require more because of lower bioavailability.",
    );
    add(
      "vitamin_a",
      "Vitamin A",
      "µg RAE",
      p ? 770 : l ? 1300 : m ? 900 : 700,
      "RDA",
      3000,
      "vitamins",
      "preformed vitamin A only",
      "RAE units are required. The UL is not applied to total vitamin A or food carotenoids.",
    );
    add(
      "vitamin_c",
      "Vitamin C",
      "mg",
      p ? 85 : l ? 120 : m ? 90 : 75,
      "RDA",
      2000,
      "vitamins",
      "total",
      "Smokers require an additional 35 mg/day; smoking is not captured by this profile.",
    );
    add(
      "vitamin_d",
      "Vitamin D",
      "µg",
      age >= 71 ? 20 : 15,
      "RDA",
      100,
      "vitamins",
      "total",
      "Reference assumes minimal sunlight exposure.",
    );
    add(
      "vitamin_e",
      "Vitamin E",
      "mg α-tocopherol",
      l ? 19 : 15,
      "RDA",
      1000,
      "vitamins",
      "synthetic vitamin E from supplements and fortified foods only",
    );
    add("vitamin_k", "Vitamin K", "µg", m ? 120 : 90, "AI", null, "vitamins");
    add(
      "vitamin_b6",
      "Vitamin B6",
      "mg",
      p ? 1.9 : l ? 2 : age >= 51 ? (m ? 1.7 : 1.5) : 1.3,
      "RDA",
      100,
      "vitamins",
    );
    add(
      "vitamin_b12",
      "Vitamin B12",
      "µg",
      p ? 2.6 : l ? 2.8 : 2.4,
      "RDA",
      null,
      "vitamins",
      "total",
      "Adults over 50 should obtain most B12 from fortified foods or supplements because food-bound absorption may be reduced.",
    );
    add(
      "folate",
      "Folate",
      "µg DFE",
      p ? 600 : l ? 500 : 400,
      "RDA",
      1000,
      "vitamins",
      "synthetic folic acid from supplements and fortified foods only (µg folic acid, not DFE)",
      "Dietary folate equivalents (DFE) are required for target comparisons. Total DFE cannot be compared with the folic-acid UL.",
    );
    add(
      "choline",
      "Choline",
      "mg",
      p ? 450 : l ? 550 : m ? 550 : 425,
      "AI",
      3500,
      "vitamins",
    );
    const macros = {};
    for (const [id, lo, hi, kcal] of [
      ["protein", 10, 35, 4],
      ["carbohydrate", 45, 65, 4],
      ["fat", 20, 35, 9],
    ]) {
      macros[id] = {
        unit: "g",
        percentEnergy: { lo, hi },
        range: energy
          ? { lo: (center * lo) / 100 / kcal, hi: (center * hi) / 100 / kcal }
          : null,
        basis: "Adult AMDR",
        explanation:
          "Acceptable Macronutrient Distribution Range. Endpoints across nutrients are not a single meal plan. Gram ranges use the EER center and conventional 4/4/9 kcal per gram.",
        sources: [ref.sources.macros],
      };
    }
    const warnings = [
      "References apply to generally healthy adults eating a typical mixed North American diet; medical conditions, medicines, dietary pattern and individual physiology can change requirements.",
      "RDA/AI are intake planning references, not diagnoses. A UL is not a target, and no established UL does not imply unlimited safety.",
      "M/F are the categories used by the underlying reference tables; they do not describe gender identity.",
    ];
    if (state)
      warnings.push(
        "Energy and AMDR gram ranges are unavailable for pregnancy/lactation: gestational stage, pre-pregnancy BMI or lactation stage are required and are not collected.",
      );
    return {
      inputs,
      energy,
      energyExplanation: state
        ? warnings[warnings.length - 1]
        : energy.explanation,
      macros,
      nutrients,
      warnings,
      referenceVersion: ref.version,
    };
  }
  const dayMs = 86400000;
  function date(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new TypeError("Dates must be YYYY-MM-DD");
    const stamp = Date.parse(value + "T00:00:00Z");
    if (
      !Number.isFinite(stamp) ||
      new Date(stamp).toISOString().slice(0, 10) !== value
    )
      throw new RangeError("Invalid calendar date: " + value);
    return stamp;
  }
  function analyze(entries, profile, options) {
    if (!Array.isArray(entries))
      throw new TypeError("entries must be an array");
    if (!profile || !profile.inputs)
      throw new TypeError("A computed profile is required");
    // Recompute so malformed/custom profiles cannot change reference semantics.
    const verified = computeProfile(profile.inputs);
    if (!options || ![7, 30].includes(options.windowDays))
      throw new RangeError("windowDays must be 7 or 30");
    if (!Array.isArray(options.completeDays))
      throw new TypeError("completeDays must be an explicit array");
    const end = date(options.endDate),
      start = end - (options.windowDays - 1) * dayMs;
    const days = Array.from({ length: options.windowDays }, (_, i) =>
      new Date(start + i * dayMs).toISOString().slice(0, 10),
    );
    const selected = new Map(days.map((d) => [d, []]));
    const complete = new Set();
    for (const d of options.completeDays) {
      const t = date(d);
      if (t >= start && t <= end) complete.add(d);
    }
    for (const e of entries) {
      if (
        !e ||
        typeof e !== "object" ||
        !e.nutrients ||
        typeof e.nutrients !== "object" ||
        Array.isArray(e.nutrients)
      )
        throw new TypeError("Each entry needs a date and nutrients object");
      const t = date(e.date);
      for (const [id, v] of Object.entries(e.nutrients)) {
        if (v !== null && v !== undefined)
          number(v, "nutrient " + id, 0, Number.MAX_VALUE);
      }
      if (t >= start && t <= end) selected.get(e.date).push(e);
    }
    const observed = days.filter((d) => selected.get(d).length > 0);
    // A marked empty day cannot prove zero intake; preserve it as missing evidence.
    const usableComplete = days.filter(
      (d) => complete.has(d) && selected.get(d).length > 0,
    );
    const flat = observed.flatMap((d) => selected.get(d));
    const targets = verified.nutrients.slice();
    targets.unshift({
      id: "energy_kcal",
      name: "Energy",
      unit: "kcal",
      target: verified.energy ? verified.energy.center : null,
      type: "EER",
      ul: null,
      ulScope: null,
      explanation: verified.energyExplanation,
      sources: [ref.sources.energy],
    });
    targets.push({
      id: "fat",
      name: "Fat",
      unit: "g",
      target: null,
      type: "AMDR",
      ul: null,
      ulScope: null,
      explanation: "No adult fat RDA or AI. See the adult AMDR.",
      sources: [ref.sources.macros],
    });
    const nutrients = targets.map((target) => {
      const id = target.id;
      const known = flat.filter(
        (e) =>
          own(e.nutrients, id) &&
          e.nutrients[id] !== null &&
          e.nutrients[id] !== undefined,
      );
      const knownTotal = known.length
        ? known.reduce((s, e) => s + e.nutrients[id], 0)
        : null;
      if (knownTotal !== null && !Number.isFinite(knownTotal))
        throw new RangeError("Nutrient total overflow: " + id);
      const comparable = usableComplete.filter((d) =>
        selected
          .get(d)
          .every(
            (e) =>
              own(e.nutrients, id) &&
              e.nutrients[id] !== null &&
              e.nutrients[id] !== undefined,
          ),
      );
      const total = comparable.reduce(
        (sum, d) =>
          sum + selected.get(d).reduce((s, e) => s + e.nutrients[id], 0),
        0,
      );
      if (!Number.isFinite(total))
        throw new RangeError("Nutrient total overflow: " + id);
      const mean = comparable.length ? total / comparable.length : null;
      const fullWindow = comparable.length === options.windowDays;
      const pct =
        mean !== null && target.target !== null
          ? (mean / target.target) * 100
          : null;
      if (pct !== null && !Number.isFinite(pct))
        throw new RangeError("Nutrient comparison overflow: " + id);
      let status = "insufficient_data";
      let explanation =
        "Only days explicitly marked complete and with this nutrient known in every entry can be compared. Missing amounts and missing calendar days are unknown, never zero.";
      if (fullWindow && pct !== null) {
        if (target.type === "CDRR") {
          status = mean > target.target ? "above_cdrr" : "at_or_below_cdrr";
          explanation =
            "Full-window logged daily mean relative to the sodium CDRR threshold. Below the threshold does not establish adequacy.";
        } else if (target.type === "AI") {
          status =
            mean >= target.target ? "at_or_above_ai" : "below_ai_uncertain";
          explanation =
            "Full-window logged daily mean relative to AI. Below AI cannot establish inadequacy; intake above AI is not proof of overall dietary adequacy.";
        } else if (target.type === "EER") {
          status = "energy_comparison";
          explanation =
            "Full-window logged mean compared with an estimated maintenance requirement. This is not a calorie deficit prescription.";
        } else {
          status = mean >= target.target ? "at_or_above_rda" : "below_rda";
          explanation =
            "Full-window logged daily mean relative to RDA. Below RDA is a planning signal, not evidence of deficiency; a short record does not establish usual intake.";
        }
      }
      let ulStatus =
        target.ul === null
          ? "not_established"
          : target.ulScope !== "total"
            ? "scope_not_available"
            : !fullWindow
              ? "insufficient_data"
              : mean > target.ul
                ? "above_ul"
                : "not_above_ul";
      return {
        ...target,
        knownTotal,
        observedMean:
          knownTotal === null || !observed.length
            ? null
            : knownTotal / observed.length,
        mean,
        completeMean: mean,
        comparableDays: comparable,
        observedDays: observed.length,
        completeDays: usableComplete.length,
        unknownEntries: flat.length - known.length,
        unknownDays: days.filter((d) => !comparable.includes(d)),
        targetPercent: pct,
        status,
        explanation: explanation + " " + target.explanation,
        ulStatus,
        comparisonIsFullWindow: fullWindow,
      };
    });
    return {
      windowDays: options.windowDays,
      startDate: days[0],
      endDate: options.endDate,
      observedDays: observed.length,
      completeDays: usableComplete.length,
      observedDates: observed,
      completeDates: usableComplete,
      missingDays: days.filter((d) => !selected.get(d).length),
      incompleteDays: days.filter((d) => !usableComplete.includes(d)),
      entryCount: flat.length,
      nutrients,
      warnings: [
        "Logged food composition and portion estimates have uncertainty. Complete means user-declared complete; the software cannot verify that every food was logged.",
        "Observed means divide known amounts by observed days and are partial descriptive totals, not intake adequacy measures.",
        "Target percentages for fewer than all window days describe only comparable complete days. Status remains insufficient_data until the entire window is comparable.",
        "Scoped ULs are not assessed because the log does not distinguish the relevant chemical forms and sources. No diagnoses are made.",
      ],
    };
  }
  const api = {
    computeProfile,
    analyze,
    referenceVersion: ref.version,
    sources: ref.sources,
  };
  root.NutrakEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
