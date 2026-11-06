/* Health Canada adult DRI tables. Verified 2026-11-06; see docs/SCIENCE.md. */
(function (root) {
  "use strict";
  const base =
    "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/";
  const source = (title, slug) => ({
    title: "Health Canada: " + title,
    url: base + slug,
  });
  const sources = {
    energy: source(
      "Equations to estimate energy requirement (2023 DRI)",
      "tables/equations-estimate-energy-requirement.html",
    ),
    vitamins: source(
      "Reference values for vitamins",
      "tables/reference-values-vitamins.html",
    ),
    elements: source(
      "Reference values for elements",
      "tables/reference-values-elements.html",
    ),
    macros: source(
      "Reference values for macronutrients",
      "tables/reference-values-macronutrients.html",
    ),
    definitions: source("DRI definitions and interpretation", "tables.html"),
  };
  // Coefficients: intercept, age (years), height (cm), weight (kg).
  const eer = {
    M: {
      inactive: [753.07, -10.83, 6.5, 14.1],
      low_active: [581.47, -10.83, 8.3, 14.94],
      active: [1004.82, -10.83, 6.52, 15.91],
      very_active: [-517.88, -10.83, 15.61, 19.11],
    },
    F: {
      inactive: [584.9, -7.01, 5.72, 11.71],
      low_active: [575.77, -7.01, 6.6, 12.14],
      active: [710.25, -7.01, 6.54, 12.34],
      very_active: [511.83, -7.01, 9.07, 12.56],
    },
  };
  sources.energyModel = {
    title: "NASEM 2023: adult TEE model fit, Tables 5-5 and 5-6",
    url: "https://www.nationalacademies.org/read/26818/chapter/7",
  };
  const data = {
    version: "2026-11-06",
    sources,
    eer,
    adultRmse: { M: 339, F: 246 },
  };
  root.NutrakReferenceData = data;
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(globalThis);
