/* Local, transactional persistence. No credentials or images are stored here. */
(function (root) {
  "use strict";
  const KEY = "nutrak.v2";
  const empty = () => ({
    version: 2,
    profile: null,
    entries: [],
    completeDays: [],
  });
  const date = (v) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
  function source(v) {
    if (!v || typeof v !== "object") return undefined;
    const out = {};
    if (v.adjusted === true) out.adjusted = true;
    for (const k of [
      "type",
      "name",
      "title",
      "note",
      "description",
      "license",
      "model",
      "fdcId",
      "referenceGrams",
      "origin",
      "retrievedAt",
    ])
      if (typeof v[k] === "string" || Number.isFinite(v[k]))
        out[k] = typeof v[k] === "string" ? v[k].slice(0, 3000) : v[k];
    if (typeof v.url === "string" && /^https?:\/\//i.test(v.url))
      out.url = v.url.slice(0, 2000);
    return out;
  }
  function entry(e) {
    if (
      !e ||
      typeof e.food !== "string" ||
      !e.food.trim() ||
      e.food.length > 500 ||
      !date(e.date)
    )
      throw Error("Each entry needs a food name and valid date.");
    const n = {};
    for (const [k, v] of Object.entries(e.nutrients || {})) {
      if (v === undefined) continue;
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > 1e8))
        throw Error("Nutrient values must be finite, non-negative numbers.");
      if (v !== null) n[k] = v;
    }
    const kcal = e.kcal ?? n.energy_kcal;
    if (
      kcal !== undefined &&
      (!Number.isFinite(kcal) || kcal < 0 || kcal > 1e8)
    )
      throw Error("Invalid energy value.");
    if (
      kcal !== undefined &&
      Number.isFinite(n.energy_kcal) &&
      kcal !== n.energy_kcal
    )
      throw Error("Conflicting energy values.");
    if (kcal !== undefined) n.energy_kcal = kcal;
    return {
      id: String(e.id || crypto.randomUUID()),
      date: e.date,
      food: e.food.trim(),
      kcal: kcal ?? null,
      tier: ["weighed", "form", "barcode", "text", "photo"].includes(e.tier)
        ? e.tier
        : "form",
      method: String(e.method || "manual").slice(0, 100),
      nutrients: n,
      ...(e.source ? { source: source(e.source) } : {}),
      ...(Number.isFinite(e.grams) ? { grams: e.grams } : {}),
      ...(Array.isArray(e.assumptions)
        ? {
            assumptions: e.assumptions
              .filter((x) => typeof x === "string")
              .slice(0, 30),
          }
        : {}),
    };
  }
  function validate(v) {
    if (
      !v ||
      v.version !== 2 ||
      !Array.isArray(v.entries) ||
      !Array.isArray(v.completeDays) ||
      v.entries.length > 100000
    )
      throw Error("Choose a Nutrak version 2 JSON backup.");
    let profile = v.profile;
    if (profile !== null) {
      if (
        !profile ||
        !Number.isFinite(profile.ageYears) ||
        !["M", "F"].includes(profile.sex)
      )
        throw Error("Invalid profile in backup.");
      if (root.NutrakEngine) root.NutrakEngine.computeProfile(profile);
      profile = {
        ageYears: profile.ageYears,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        pal: profile.pal,
        reproState: profile.reproState || null,
      };
    }
    if (v.completeDays.some((d) => !date(d)))
      throw Error("Invalid complete-day date.");
    const entries = v.entries.map(entry);
    if (new Set(entries.map((e) => e.id)).size !== entries.length)
      throw Error("Duplicate entry IDs in backup.");
    return {
      version: 2,
      profile,
      entries,
      completeDays: [...new Set(v.completeDays)],
    };
  }
  function create(storage) {
    let state = empty(),
      error = null,
      recoveryRaw = null,
      recoveryBlocked = false,
      loadedRaw = null,
      loadedSourceRaw = null,
      loadedSourceKey = KEY;
    try {
      loadedRaw = storage.getItem(KEY);
      loadedSourceRaw = loadedRaw;
      if (loadedRaw) state = validate(JSON.parse(loadedRaw));
      else {
        loadedSourceKey = "nutrak.entries";
        loadedSourceRaw = storage.getItem(loadedSourceKey);
        const old = JSON.parse(loadedSourceRaw || "[]");
        state.entries = old.map((e) =>
          entry({
            ...e,
            nutrients: {
              ...Object.fromEntries(
                Object.entries(
                  e.macros
                    ? {
                        protein: e.macros.protein,
                        carbohydrate: e.macros.carbs,
                        fat: e.macros.fat,
                      }
                    : {},
                ).filter(([, v]) => Number.isFinite(v)),
              ),
              ...(e.nutrients || {}),
            },
          }),
        );
      }
    } catch (e) {
      error = "Stored data could not be read: " + e.message;
      if (loadedSourceRaw) {
        recoveryRaw = loadedSourceRaw;
        recoveryBlocked = true;
        try {
          storage.setItem("nutrak.recovery." + Date.now(), loadedSourceRaw);
          recoveryBlocked = false;
        } catch {}
      }
    }
    return {
      get: () => structuredClone(state),
      error: () => error,
      recovery: () => recoveryRaw,
      save(next) {
        if (recoveryBlocked) {
          error =
            "Original unreadable data could not be backed up. Persistent writes are blocked to preserve it. Export the recovery copy.";
          throw Error(error);
        }
        const clean = validate(next),
          serialized = JSON.stringify(clean);
        try {
          if (
            storage.getItem(KEY) !== loadedRaw ||
            (loadedSourceKey !== KEY &&
              storage.getItem(loadedSourceKey) !== loadedSourceRaw)
          ) {
            error =
              "Another tab changed your saved journal. Your changes have not replaced it. Export this tab’s changes, then reload to read the latest saved journal.";
            throw Error(error);
          }
          storage.setItem(KEY, serialized);
        } catch (e) {
          error =
            error ||
            "Changes were not saved. Browser storage is unavailable or full. Export your data before closing this page.";
          throw Error(error);
        }
        loadedRaw = serialized;
        loadedSourceKey = KEY;
        loadedSourceRaw = serialized;
        state = clean;
        error = null;
        return this.get();
      },
      import(text) {
        return this.save(validate(JSON.parse(text)));
      },
      export() {
        return JSON.stringify(state, null, 2);
      },
    };
  }
  root.NutrakStore = { create, validate, entry };
})(typeof window !== "undefined" ? window : globalThis);
