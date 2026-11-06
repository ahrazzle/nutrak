"use strict";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const browserStorage = (() => {
  try {
    return localStorage;
  } catch {
    return {
      getItem() {
        throw Error("Browser storage is blocked.");
      },
      setItem() {
        throw Error("Browser storage is blocked.");
      },
    };
  }
})();
const store = NutrakStore.create(browserStorage);
let state = store.get(),
  selectedDate = localDate(),
  windowDays = 7,
  photoData = null,
  photoKey = "",
  draft = null,
  undo = null,
  pendingBatch = null,
  photoController = null,
  photoGeneration = 0,
  unsavedWarning = "",
  externalChangeWarning = "",
  barcodeController = null,
  barcodeGeneration = 0;
const names = {
  energy_kcal: ["Energy", "kcal"],
  protein: ["Protein", "g"],
  carbohydrate: ["Carbohydrate", "g"],
  fat: ["Fat", "g"],
  fiber: ["Fiber", "g"],
  calcium: ["Calcium", "mg"],
  iron: ["Iron", "mg"],
  magnesium: ["Magnesium", "mg"],
  potassium: ["Potassium", "mg"],
  sodium: ["Sodium", "mg"],
  zinc: ["Zinc", "mg"],
  vitamin_a: ["Vitamin A", "µg RAE"],
  vitamin_c: ["Vitamin C", "mg"],
  vitamin_d: ["Vitamin D", "µg"],
  vitamin_e: ["Vitamin E", "mg α-tocopherol"],
  vitamin_k: ["Vitamin K", "µg"],
  vitamin_b6: ["Vitamin B6", "mg"],
  vitamin_b12: ["Vitamin B12", "µg"],
  folate: ["Folate", "µg DFE"],
  choline: ["Choline", "mg"],
};
const statusText = {
  insufficient_data: "Insufficient comparable data",
  below_ai_uncertain: "Below AI · uncertain",
  at_or_above_ai: "At or above AI",
  below_rda: "Below RDA · planning signal",
  at_or_above_rda: "At or above RDA",
  energy_comparison: "Energy estimate comparison",
  above_cdrr: "Above CDRR",
  at_or_below_cdrr: "At or below CDRR",
};
const fmt = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : "—";
const profile = () =>
  state.profile ? NutrakEngine.computeProfile(state.profile) : null;
const entries = () => state.entries.filter((e) => e.date === selectedDate);
function total(id, list = entries()) {
  const known = list.filter((e) => Number.isFinite(e.nutrients[id]));
  return {
    value: known.reduce((s, e) => s + e.nutrients[id], 0),
    unknown: list.length - known.length,
    known: known.length,
  };
}
function save(next, message) {
  try {
    state = store.save(next);
    unsavedWarning = "";
    notice();
    if (message) toast(message);
    render();
    return true;
  } catch (e) {
    try {
      state = NutrakStore.validate(next);
      unsavedWarning =
        e.message +
        " Your changes remain in this tab’s memory only. Export a backup now to keep them.";
      render();
      notice();
      toast("Kept in this tab only. Export a backup to retain these changes.");
      return true;
    } catch {
      notice(e.message);
      return false;
    }
  }
}
function notice(
  text = unsavedWarning || externalChangeWarning || store.error(),
) {
  $("#storageNotice").hidden = !text;
  $("#storageNotice").textContent = text || "";
}
function toast(text, action = false) {
  const el = $("#toast");
  el.innerHTML =
    esc(text) + (action ? ' <button id="undoButton">Undo</button>' : "");
  el.hidden = false;
  if (action)
    $("#undoButton").onclick = () => {
      if (undo && save(undo, "Entry restored.")) undo = null;
    };
  setTimeout(() => {
    el.hidden = true;
  }, 8000);
}
function dialog(title, html) {
  cancelBarcode();
  $("#dialogTitle").textContent = title;
  $("#dialogBody").innerHTML = html;
  $("#infoDialog").showModal();
}
function sourceLinks(sources) {
  return (sources || [])
    .filter((s) => /^https?:\/\//i.test(s.url || ""))
    .map(
      (s) =>
        `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.name || "Reference")} ↗</a>`,
    )
    .join("");
}
function explain(item) {
  dialog(
    item.name || "Your energy estimate",
    `<p>${esc(item.explanation || item.basis || "A population reference, not a measurement of your personal requirement.")}</p>${item.ul ? `<p>Upper level: ${fmt(item.ul)} ${esc(item.unit)}. ${esc(item.ulScope || "")}</p>` : ""}<div class="source-links">${sourceLinks(item.sources)}</div>`,
  );
}
function heading(kicker, title, sub, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p class="subtitle">${sub}</p></div>${action}</div>`;
}
function dateControl() {
  return `<label class="date-control"><span>Journal date</span><input type="date" id="journalDate" value="${selectedDate}"></label>`;
}
function energyHistory() {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 6 + i);
    const date = localDate(d),
      list = state.entries.filter((e) => e.date === date),
      t = total("energy_kcal", list);
    return { date, ...t };
  });
  const max = Math.max(1, ...days.map((d) => d.value));
  return days
    .map(
      (d) =>
        `<div class="history-day" title="${d.date}: ${d.known ? fmt(d.value) + " kcal known" + (d.unknown ? " · partial nutrient data" : "") : "no known energy"}"><span class="history-bar ${d.known ? "" : "missing"}" style="height:${d.known ? Math.max(3, (d.value / max) * 78) : 2}px"></span><small>${d.known ? fmt(d.value) : "—"}</small><b>${d.date.slice(8)}</b></div>`,
    )
    .join("");
}
function renderToday() {
  const p = profile(),
    list = entries(),
    energy = total("energy_kcal");
  $("#screen-today").innerHTML =
    heading(
      "A LITTLE CLARITY, EVERY DAY",
      selectedDate === localDate()
        ? "Your day, in perspective."
        : "Your journal, in perspective.",
      "Build a picture of what nourishes you. One honest entry at a time.",
      dateControl(),
    ) +
    `<div class="dashboard"><article class="card energy-card"><div class="card-head"><h2>Energy intake</h2><span class="badge">${list.length ? "LOGGED TODAY" : "YOUR STARTING POINT"}</span></div><div class="energy-number">${energy.known ? fmt(energy.value) : list.length ? "—" : "0"} <span>kcal</span></div><p class="muted">${energy.unknown ? `${energy.unknown} entries have unknown energy. ` : ""}${p?.energy ? `Estimate ± model error <b>${fmt(p.energy.range.lo)}–${fmt(p.energy.range.hi)} kcal</b>` : "Create a profile to calculate an estimated daily range."}</p><div class="energy-track"><div style="width:${p?.energy ? Math.min(100, (energy.value / (p.energy.range.hi * 1.15)) * 100) : 0}%"></div>${p?.energy ? `<span style="left:${(p.energy.range.lo / (p.energy.range.hi * 1.15)) * 100}%;width:${((p.energy.range.hi - p.energy.range.lo) / (p.energy.range.hi * 1.15)) * 100}%"></span>` : ""}</div><div class="track-label"><span>0 kcal</span><span>${p?.energy ? "Estimate ± model error ▧" : "Your journal starts here"}</span></div>${p?.energy ? '<button class="text-button" id="energyWhy">How is this estimated? ↗</button>' : '<a class="text-button" href="#/profile">Set up your profile →</a>'}</article><article class="card macro-card"><div class="card-head"><h2>The macronutrients</h2><span class="muted">Known amounts</span></div>${[
      "protein",
      "carbohydrate",
      "fat",
    ]
      .map((id, i) => {
        const t = total(id);
        const max = p?.energy?.center / (id === "fat" ? 9 : 4) || 100;
        return `<div class="macro"><div><span class="macro-dot color-${i}"></span>${names[id][0]}<b>${t.known ? fmt(t.value) : "—"} <small>g</small></b></div><div class="bar"><span class="color-${i}" style="width:${Math.min(100, (t.value / max) * 100)}%"></span></div><small>${t.unknown ? `${t.unknown} entries missing this value` : t.known ? "From your logged food" : "Add food to see your intake"}</small></div>`;
      })
      .join(
        "",
      )}<p class="fine">Bar length represents the share of your estimated energy, not a prescribed macro target.</p></article><article class="card journal-card"><div class="card-head"><div><p class="eyebrow">THE DAILY RECORD</p><h2>Food journal <span class="count">${list.length}</span></h2></div><a class="button primary" href="#/log">＋ Add food</a></div>${list.length ? `<div class="entry-list">${list.map((e) => `<div class="entry"><span class="food-mark">${e.tier === "photo" ? "◈" : "◌"}</span><div class="entry-copy"><h3>${esc(e.food)}</h3><p><span class="tier ${["photo", "text"].includes(e.tier) ? "estimate" : ""}">${esc(e.tier === "form" ? "Manual" : e.tier)}${["photo", "text"].includes(e.tier) ? " · estimate" : ""}</span> <span>${esc(e.method)}</span></p></div><b>${fmt(e.kcal)} <small>kcal</small></b><button class="icon-button" data-edit="${esc(e.id)}" aria-label="Edit ${esc(e.food)}">✎</button><button class="icon-button" data-delete="${esc(e.id)}" aria-label="Delete ${esc(e.food)}">×</button></div>`).join("")}</div>` : `<div class="empty-state"><span class="empty-icon">◒</span><h3>A fresh page for your day.</h3><p>Log a food you know, weigh something from the catalog,<br>or review an estimate before adding it.</p><a href="#/log" class="button secondary">Log your first food →</a></div>`}<div class="complete-row"><label><input type="checkbox" id="completeDay" ${state.completeDays.includes(selectedDate) ? "checked" : ""}> I have finished logging this day</label><span>Complete days make comparisons more meaningful.</span></div></article><article class="insight-card"><span class="eyebrow">A BETTER PICTURE, OVER TIME</span><h2>Patterns need more than a day.</h2><p>See what your records support, what is missing, and how reference values are used.</p><a href="#/adequacy" class="text-button">Explore your patterns →</a><div class="mini-chart" aria-label="Logged energy over the last seven days">${energyHistory()}</div><p class="fine">Last 7 days · known energy only. A dash means no known amount.</p></article></div>`;
  $("#journalDate").onchange = (e) => {
    if (e.target.value) {
      selectedDate = e.target.value;
      render();
    }
  };
  $("#completeDay").onchange = (e) =>
    save(
      {
        ...state,
        completeDays: e.target.checked
          ? [...new Set([...state.completeDays, selectedDate])]
          : state.completeDays.filter((d) => d !== selectedDate),
      },
      "Day status saved.",
    );
  if ($("#energyWhy")) $("#energyWhy").onclick = () => explain(p.energy);
}
function nutrientFields(n = {}) {
  return `<div class="form-grid">${Object.entries(names)
    .map(
      ([id, [name, unit]]) =>
        `<label>${name} <span class="muted">${unit}</span><input type="number" name="${id}" min="0" max="100000000" step="any" value="${Number.isFinite(n[id]) ? n[id] : ""}" placeholder="Unknown"></label>`,
    )
    .join("")}</div>`;
}
function reviewDraft(item, tier = "form", id = null, batchIndex = null) {
  draft = { tier, id };
  dialog(
    id ? "Edit food entry" : "Review before adding",
    `<p class="muted">Check the portion and every estimate. Leave unavailable nutrients blank; unknown is never treated as zero.</p>${item.source ? `<p class="fine">Source: ${esc(item.source.title || item.source.name || "Food source")} ${item.source.url ? sourceLinks([{ ...item.source, title: item.source.title || item.source.name || "Source" }]) : ""} ${esc(item.source.note || "")}</p>` : ""}<form id="entryForm"><label>Food name<input name="food" value="${esc(item.name || item.food || "")}" required maxlength="500"></label><label>Date<input name="date" type="date" required value="${esc(item.date || selectedDate)}"></label>${Number.isFinite(item.grams) ? `<label>Whole portion · grams<input id="editGrams" type="number" min="0.1" max="10000" step="any" value="${item.grams}"></label><p class="fine">Changing weight rescales every known nutrient below. Values describe the whole portion.</p>` : ""}<details ${tier === "form" ? "open" : ""}><summary>Nutrition for this whole entry · edit values</summary>${nutrientFields(item.nutrients || {})}</details><div class="notice">${tier === "photo" ? "Photo estimates can miss ingredients, quantities and preparation. These values have not been measured." : tier === "text" ? "Text matching finds catalog foods, but does not verify the food or portion." : "Values apply to the whole entry, not per 100 g."}</div><p class="form-error" id="entryError" role="alert"></p><button class="button primary" type="submit">${id ? "Save changes" : "Confirm & add to journal"}</button></form>`,
  );
  if ($("#editGrams")) {
    let previous = item.grams;
    $("#editGrams").onchange = (e) => {
      const grams = +e.target.value;
      if (grams > 0 && Number.isFinite(grams)) {
        for (const k of Object.keys(names)) {
          const input = $("#entryForm").elements[k];
          if (input.value !== "")
            input.value = +((Number(input.value) * grams) / previous).toFixed(
              4,
            );
        }
        previous = grams;
      }
    };
  }
  $("#entryForm").onsubmit = (e) => {
    e.preventDefault();
    try {
      const f = new FormData(e.target),
        n = {};
      Object.keys(names).forEach((k) => {
        if (f.get(k) !== "") n[k] = Number(f.get(k));
      });
      const en = NutrakStore.entry({
        id: id || crypto.randomUUID(),
        date: f.get("date"),
        food: f.get("food"),
        nutrients: n,
        kcal: n.energy_kcal,
        tier,
        source: item.source
          ? {
              ...item.source,
              ...(f.get("food") !== (item.name || item.food || "") ||
              Object.keys(names).some(
                (k) => (n[k] ?? null) !== (item.nutrients?.[k] ?? null),
              )
                ? {
                    adjusted: true,
                    note:
                      (item.source.note || "") +
                      " User edited the food or nutrient composition; original source is a starting reference.",
                  }
                : {}),
            }
          : undefined,
        grams: $("#editGrams") ? +$("#editGrams").value : item.grams,
        assumptions: item.assumptions,
        method:
          tier === "weighed"
            ? `${fmt($("#editGrams") ? +$("#editGrams").value : item.grams)} g · catalog`
            : tier === "photo"
              ? "Photo estimate reviewed"
              : tier === "text"
                ? "Text match reviewed"
                : tier === "barcode"
                  ? "Product label · reviewed"
                  : "Manual entry",
      });
      const next = {
        ...state,
        entries: id
          ? state.entries.map((x) => (x.id === id ? en : x))
          : [...state.entries, en],
      };
      if (save(next, "Food saved to your journal.")) {
        $("#infoDialog").close();
        if (batchIndex !== null && pendingBatch) {
          pendingBatch.saved.add(batchIndex);
          renderBatch();
          toast("Food added. Review the remaining drafts.");
        } else location.hash = "#/today";
      }
    } catch (err) {
      $("#entryError").textContent = err.message;
    }
  };
}
function renderLog() {
  $("#screen-log").innerHTML =
    heading(
      "YOUR FOOD, YOUR RECORD",
      "Make every entry count.",
      "Choose how to log. You always review the values before they become part of your journal.",
    ) +
    `<div class="capture-grid"><article class="card"><p class="eyebrow">01 / KNOW WHAT YOU ATE</p><h2>Food catalog</h2><p class="muted">A small, sourced offline catalog. Weigh your portion for a clearer estimate.</p><label>Find a food<input type="search" id="foodSearch" placeholder="Try apple, banana, orange…"></label><div id="foodResults" class="food-results"></div></article><div class="capture-stack"><article class="card"><p class="eyebrow">02 / FROM A LABEL OR RECIPE</p><h2>Enter nutrition yourself</h2><p class="muted">Add calories, macros and any micronutrients you know. Keep the rest unknown.</p><button class="button secondary" id="manualButton">＋ Add a manual entry</button></article><article class="card"><p class="eyebrow">03 / A QUICK DESCRIPTION</p><h2>Describe your food</h2><label class="sr-only" for="textFood">Food description</label><textarea id="textFood" placeholder="150 g apple, 100 g banana"></textarea><p class="fine">Matches known catalog foods and explicit gram amounts locally. No AI request.</p><button class="button secondary" id="parseButton">Find matches →</button><div id="textResult" aria-live="polite"></div></article></div><article class="card photo-card"><div><p class="eyebrow">04 / START WITH A PHOTO</p><h2>A picture is a starting point.</h2><p class="muted">Use your own OpenAI API key to suggest foods and portions. Review every estimate. Image recognition is optional and uses a paid external service.</p><label>OpenAI API key <input id="photoKey" type="password" autocomplete="off" placeholder="Kept in memory for this tab only" value="${esc(photoKey)}"></label><label>Meal photo<input id="photoFile" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="fine">Only when you press Analyze, this image is sent directly to OpenAI. Nutrak stores neither the image nor your key. Avoid identifying details. <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noopener">OpenAI data policy ↗</a></p><button class="button primary" id="analyzePhoto" disabled>Analyze photo with OpenAI ↗</button><button class="text-button" id="clearPhoto">Clear image & key</button><p id="photoStatus" role="status"></p></div><div id="photoPreview" class="photo-preview">◈<span>Your photo preview stays here<br>until you choose to send it.</span></div><div id="photoResults"></div></article><article class="card barcode-card"><p class="eyebrow">05 / PACKAGED FOOD</p><h2>Look up a barcode</h2><p class="muted">Optional lookup sends the barcode to Open Food Facts. Product labels can be incomplete; check the package.</p><div class="inline-form"><label class="grow">Barcode<input id="barcode" inputmode="numeric" placeholder="Enter product barcode"></label><button class="button secondary" id="barcodeButton">Look up ↗</button></div><p id="barcodeStatus" role="status"></p></article></div>`;
  const results = () => {
    $("#foodResults").innerHTML =
      NutrakFoods.search($("#foodSearch").value)
        .slice(0, 8)
        .map(
          (f) =>
            `<button class="food-option" data-food="${esc(f.id)}"><span>${esc(f.name)}<small>Offline catalog · per weighed portion</small></span><span>＋</span></button>`,
        )
        .join("") ||
      '<p class="muted">No catalog match. Use manual entry for this food.</p>';
  };
  results();
  $("#foodSearch").oninput = results;
  $("#manualButton").onclick = () => reviewDraft({});
  $("#parseButton").onclick = () => {
    const r = NutrakFoods.parseText($("#textFood").value);
    showMatches(r.items, "#textResult", "text");
    if (r.unresolved.length)
      $("#textResult").insertAdjacentHTML(
        "beforeend",
        `<p class="notice">${r.unresolved.map((x) => esc(x.text) + ": " + esc(x.reason)).join("<br>")}</p>`,
      );
  };
  $("#barcodeButton").onclick = async () => {
    cancelBarcode();
    barcodeController = new AbortController();
    const generation = barcodeGeneration,
      signal = barcodeController.signal;
    const button = $("#barcodeButton");
    button.disabled = true;
    try {
      $("#barcodeStatus").textContent = "Looking up the product…";
      const f = await NutrakFoods.lookupBarcode($("#barcode").value, {
        signal,
      });
      if (
        generation !== barcodeGeneration ||
        !location.hash.startsWith("#/log")
      )
        return;
      $("#barcodeStatus").textContent =
        "Product found. Review the package and choose a portion.";
      portion(f, "barcode");
    } catch (err) {
      if (generation === barcodeGeneration && !signal.aborted)
        $("#barcodeStatus").textContent = err.message;
    } finally {
      if (generation === barcodeGeneration) {
        barcodeController = null;
        button.disabled = false;
      }
    }
  };
  $("#barcode").oninput = () => cancelBarcode();
  $("#photoKey").oninput = (e) => {
    photoKey = e.target.value;
    photoReady();
  };
  $("#photoFile").onchange = async (e) => {
    cancelPhoto();
    photoData = null;
    $("#photoPreview").innerHTML =
      "◈<span>Preparing your image locally…</span>";
    $("#photoResults").innerHTML = "";
    photoReady();
    const file = e.target.files[0];
    if (!file) {
      $("#photoPreview").innerHTML = "◈<span>No image selected.</span>";
      return;
    }
    const generation = photoGeneration;
    try {
      const data = await preparePhoto(file);
      if (generation !== photoGeneration) return;
      photoData = data;
      $("#photoPreview").innerHTML =
        `<img src="${photoData}" alt="Your selected meal, awaiting analysis">`;
      $("#photoStatus").textContent =
        "Resized locally to at most 1600 px; metadata removed. Ready to send when you choose.";
    } catch (err) {
      if (generation === photoGeneration) {
        $("#photoStatus").textContent =
          "Image could not be prepared. " + err.message;
        $("#photoPreview").innerHTML = "◈<span>Select another image.</span>";
      }
    }
    photoReady();
  };
  $("#clearPhoto").onclick = () => {
    cancelPhoto();
    photoData = null;
    photoKey = "";
    pendingBatch = null;
    renderLog();
  };
  $("#analyzePhoto").onclick = async () => {
    if (photoController) return;
    photoController = new AbortController();
    const generation = photoGeneration,
      signal = photoController.signal;
    photoReady();
    $("#photoStatus").textContent =
      "Sending this image to OpenAI and preparing estimates…";
    try {
      const r = await NutrakPhoto.analyze({
        apiKey: photoKey,
        imageDataUrl: photoData,
        signal,
      });
      if (generation !== photoGeneration) return;
      $("#photoStatus").textContent =
        [...(r.warnings || []), ...(r.assumptions || [])].join(" ") ||
        "Estimates ready. Review every food before adding.";
      showMatches(
        r.items.map((it) => ({ ...it, assumptions: r.assumptions || [] })),
        "#photoResults",
        "photo",
      );
    } catch (err) {
      if (generation === photoGeneration)
        $("#photoStatus").textContent = err.message;
    } finally {
      if (generation === photoGeneration) {
        photoController = null;
        photoReady();
      }
    }
  };
  if (photoData) {
    $("#photoPreview").innerHTML =
      `<img src="${photoData}" alt="Your selected meal, awaiting analysis">`;
    photoReady();
  }
}
function photoReady() {
  $("#analyzePhoto").disabled =
    Boolean(photoController) || !(photoKey.trim() && photoData);
}
function showMatches(items, selector, tier) {
  pendingBatch = { items, selector, tier, saved: new Set() };
  renderBatch();
}
function renderBatch() {
  if (!pendingBatch) return;
  const { items, selector, tier, saved } = pendingBatch,
    host = $(selector);
  if (!host) return;
  host.innerHTML = items.length
    ? `<p class="fine">${saved.size} of ${items.length} drafts added. Review each remaining food separately.</p>` +
      items
        .map(
          (it, i) =>
            `<button class="food-option" data-match="${i}" ${saved.has(i) ? "disabled" : ""}><span>${esc(it.name)}<small>${fmt(it.grams)} g · ${fmt(it.nutrients?.energy_kcal)} kcal · ${saved.has(i) ? "Added to journal" : "review required"}</small></span>${saved.has(i) ? "✓ Added" : "Review →"}</button>`,
        )
        .join("")
    : '<p class="muted">No matches yet. Use an exact catalog food and gram amount, or enter it manually.</p>';
  host.querySelectorAll("[data-match]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.match;
        if (!saved.has(i)) reviewDraft(items[i], tier, null, i);
      }),
  );
}
function cancelBarcode() {
  barcodeGeneration++;
  barcodeController?.abort();
  barcodeController = null;
  const button = $("#barcodeButton");
  if (button) button.disabled = false;
}
function cancelPhoto() {
  photoGeneration++;
  photoController?.abort();
  photoController = null;
}
async function preparePhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw Error("Choose a JPEG, PNG or WebP under 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    NutrakPhoto.validateImage(data);
    return data;
  } finally {
    bitmap.close();
  }
}
function portion(food, tier = "weighed") {
  dialog(
    "Choose your portion",
    `<h3>${esc(food.name)}</h3><p class="muted">Nutrition is scaled from the catalog's per-100 g values. Food composition varies.</p><form id="portionForm"><label>Weight in grams<input id="portionGrams" type="number" min="0.1" max="10000" step="any" required value="100"></label><button class="button primary">Review nutrition →</button></form>`,
  );
  $("#portionForm").onsubmit = (e) => {
    e.preventDefault();
    const item = NutrakFoods.scale(food, +$("#portionGrams").value);
    $("#infoDialog").close();
    reviewDraft(item, tier);
  };
}
function renderAdequacy() {
  const p = profile();
  $("#screen-adequacy").innerHTML =
    heading(
      "FOLLOW THE EVIDENCE",
      "Small entries. A bigger picture.",
      "Nutrient references describe populations. Your records show intake estimates, with limits.",
    ) +
    `<div class="period-control"><div><button data-window="7" class="${windowDays === 7 ? "selected" : ""}">7 days</button><button data-window="30" class="${windowDays === 30 ? "selected" : ""}">30 days</button></div><span>Ending ${esc(selectedDate)}</span></div>`;
  if (!p) {
    $("#screen-adequacy").innerHTML +=
      '<article class="card empty-state"><h2>A reference needs a little context.</h2><p>Create an adult profile to compare your journal with supported dietary reference values.</p><a href="#/profile" class="button primary">Create your profile →</a></article>';
    return;
  }
  const a = NutrakEngine.analyze(state.entries, p, {
    windowDays,
    endDate: selectedDate,
    completeDays: state.completeDays,
  });
  $("#screen-adequacy").innerHTML +=
    `<div class="coverage-grid"><article class="card"><span class="eyebrow">LOGGING COVERAGE</span><strong>${a.observedDays} <small>/ ${windowDays} days</small></strong><p>with at least one food entry</p></article><article class="card"><span class="eyebrow">MARKED COMPLETE</span><strong>${typeof a.completeDays === "number" ? a.completeDays : a.completeDays?.length || 0} <small>days</small></strong><p>you marked as fully logged</p></article><article class="card coverage-note"><h3>Completeness changes the meaning.</h3><p>Observed means include partial logs. Comparable means use only complete days with known values for every entry. Blank nutrients stay unknown.</p></article></div><article class="card"><div class="card-head"><h2>Nutrient reference comparison</h2><span class="badge">${windowDays}-DAY WINDOW</span></div><p class="muted">Below an RDA does not establish inadequacy. Below an AI cannot establish deficiency. Short food records cannot diagnose nutritional status.</p><div class="table-wrap"><table><thead><tr><th>Nutrient</th><th>Observed mean</th><th>Comparable mean</th><th>Reference / day</th><th>Evidence</th></tr></thead><tbody>${a.nutrients.map((n) => `<tr><th><button class="text-button" data-nutrient="${esc(n.id)}">${esc(n.name)} ↗</button><small>${esc(n.unit)}</small></th><td>${fmt(n.observedMean)}<small>Includes partial records</small></td><td>${fmt(n.completeMean ?? n.mean)}<small>${Array.isArray(n.comparableDays) ? n.comparableDays.length : (n.comparableDays ?? 0)} comparable days</small></td><td>${fmt(n.target)} <small>${esc(n.type || n.targetType || "Reference")}</small></td><td><span class="pill">${esc(statusText[n.status] || String(n.status || "Limited data").replaceAll("_", " "))}</span><small>${n.unknownEntries || 0} entries missing value</small><small>${esc({ above_ul: "Above upper level", not_above_ul: "Not above upper level", scope_not_available: "Upper level scope not assessable", not_established: "No upper level established", insufficient_data: "Upper level: insufficient data" }[n.ulStatus] || "")}</small></td></tr>`).join("")}</tbody></table></div></article><div class="notice">${(a.warnings || []).map((w) => esc(typeof w === "string" ? w : w.message)).join(" ") || "A food journal describes estimated intake. It does not measure absorption, individual requirements or clinical status."}</div>`;
}
function renderProfile() {
  const i = state.profile || {};
  $("#screen-profile").innerHTML =
    heading(
      "PERSONAL CONTEXT",
      "A reference, made relevant.",
      "A few details help select adult reference values. Your information stays in this browser.",
    ) +
    `<div class="profile-layout"><article class="card"><h2>Your reference profile</h2><p class="muted">Supported standards: NASEM dietary reference intakes, as published by Health Canada. Adults 19 and older.</p><form id="profileForm"><div class="form-grid"><label>Age in years<input name="ageYears" type="number" min="19" max="100" required value="${i.ageYears || ""}"></label><label>Sex used in reference tables<select name="sex"><option value="F" ${i.sex === "F" ? "selected" : ""}>Female</option><option value="M" ${i.sex === "M" ? "selected" : ""}>Male</option></select></label><label>Height · cm<input name="heightCm" type="number" min="100" max="250" step="any" required value="${i.heightCm || ""}"></label><label>Weight · kg<input name="weightKg" type="number" min="30" max="350" step="any" required value="${i.weightKg || ""}"></label><label>Physical activity<select name="pal">${[
      ["inactive", "Inactive"],
      ["low_active", "Low active"],
      ["active", "Active"],
      ["very_active", "Very active"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${i.pal === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Reproductive state<select name="reproState"><option value="">Neither / not applicable</option><option value="preg" ${i.reproState === "preg" ? "selected" : ""}>Pregnant</option><option value="lact" ${i.reproState === "lact" ? "selected" : ""}>Lactating</option></select></label></div><p class="fine">Activity categories describe habitual daily movement, from mostly seated routines through substantial daily exercise or physical work. Choosing a category does not measure your energy expenditure.</p><p class="fine">Energy equations use age, sex, body size and activity. Pregnancy and lactation need additional clinical context; energy estimates may be withheld. This is not a weight-loss prescription.</p><p id="profileError" class="form-error" role="alert"></p><button class="button primary">Save & calculate locally →</button></form></article><div><article class="card privacy-card"><span class="eyebrow">YOURS TO KEEP</span><h2>Private by design.</h2><p>Food entries and profile data are saved in this browser. No account, background sync or analytics. Other people using this browser profile may be able to access them.</p><p>Browser data can be cleared. Export a backup to keep a copy.</p><button id="exportButton" class="button secondary">↓ Export JSON backup</button>${store.recovery() ? '<button id="recoveryExport" class="button secondary">↓ Export original recovery data</button>' : ""}<label class="import-label">Import a backup<input id="importFile" type="file" accept="application/json,.json"></label><p class="fine">Import replaces your current journal after validation. Export your current data first. Keys and photo bytes are never included.</p><p id="importStatus" role="status"></p></article><article class="profile-summary">${profile() ? `<span class="eyebrow">CURRENT REFERENCE</span><h2>${profile().energy ? fmt(profile().energy.center) + " kcal" : "Energy not calculated"}</h2><p>Estimated daily energy need, not a measured requirement.</p>${(profile().warnings || []).map((w) => `<p>${esc(typeof w === "string" ? w : w.message)}</p>`).join("")}<button class="text-button" id="profileScience">See calculations & limits ↗</button>` : '<span class="eyebrow">NO PROFILE YET</span><h2>Your journal works without a profile.</h2><p>Add food now. Create a profile whenever you want reference comparisons.</p>'}</article></div></div>`;
  $("#profileForm").onsubmit = (e) => {
    e.preventDefault();
    try {
      const f = new FormData(e.target),
        inputs = {
          ageYears: +f.get("ageYears"),
          sex: f.get("sex"),
          heightCm: +f.get("heightCm"),
          weightKg: +f.get("weightKg"),
          pal: f.get("pal"),
          reproState: f.get("reproState") || null,
        };
      const result = NutrakEngine.computeProfile(inputs);
      if (!result)
        throw Error(
          "These inputs are not supported. Check your adult profile.",
        );
      save(
        { ...state, profile: inputs },
        "Profile calculated and saved locally.",
      );
    } catch (err) {
      $("#profileError").textContent = err.message;
    }
  };
  $("#exportButton").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `nutrak-backup-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if ($("#recoveryExport"))
    $("#recoveryExport").onclick = () => {
      const blob = new Blob([store.recovery()], { type: "application/json" }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "nutrak-recovery-original.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  $("#importFile").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024)
        throw Error("Backup exceeds the 20 MB import limit.");
      const clean = NutrakStore.validate(JSON.parse(await file.text()));
      if (clean.profile) NutrakEngine.computeProfile(clean.profile);
      dialog(
        "Replace your local journal?",
        `<p>This validated backup contains ${clean.entries.length} food entries. Import replaces your current ${state.entries.length} entries and profile. Export your current journal first if you need to retain it.</p><button class="button primary" id="confirmImport">Replace with validated backup</button>`,
      );
      $("#confirmImport").onclick = () => {
        if (save(clean, "Backup imported.")) $("#infoDialog").close();
      };
    } catch (err) {
      $("#importStatus").textContent = "Import not applied. " + err.message;
    }
  };
  if ($("#profileScience")) $("#profileScience").onclick = () => sources();
}
function sources() {
  const p = profile();
  dialog(
    "The science, and its limits",
    `<p>Nutrak compares estimated food intake with adult Dietary Reference Intakes (DRIs). References are not personalized prescriptions or clinical findings.</p><h3>Read each reference correctly</h3><p><b>RDA:</b> a daily intake intended to cover nearly all healthy people in a life-stage group. A short record below it does not diagnose inadequate intake.</p><p><b>AI:</b> used when evidence is insufficient for an RDA. Intake below an AI cannot establish inadequacy.</p><p><b>UL:</b> an upper level, not a goal. Some upper levels apply only to supplements or fortified foods, which this journal may not distinguish.</p><p><b>CDRR:</b> an intake level above which reducing intake is expected to reduce chronic disease risk. It is not a minimum target.</p><h3>Energy is an estimate</h3><p>${esc(p?.energy?.explanation || "Adult energy equations use age, sex, height, weight and activity. Actual needs vary. The displayed band communicates uncertainty; it is not a guaranteed physiological range.")}</p><h3>Primary references</h3><div class="source-links">${sourceLinks(p?.energy?.sources)}<a href="https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables.html" target="_blank" rel="noopener">Health Canada: Dietary Reference Intake tables ↗</a><a href="https://nap.nationalacademies.org/catalog/26818/dietary-reference-intakes-for-energy" target="_blank" rel="noopener">NASEM: Dietary Reference Intakes for Energy (2023) ↗</a></div><h3>Your data stays under your control</h3><p>Basic journaling, profile calculations, catalog matching and comparisons run locally. Barcode lookup contacts Open Food Facts only on request. Photo analysis sends your selected image directly to OpenAI only when you press Analyze. The API key remains in this tab's memory. Export contains only journal and profile data.</p>`,
  );
}
function render() {
  renderToday();
  renderAdequacy();
  renderProfile();
  notice();
}
function route() {
  const name =
    (location.hash.match(/^#\/(today|log|adequacy|profile)/) || [])[1] ||
    "today";
  if (name !== "log") {
    cancelBarcode();
    cancelPhoto();
    photoData = null;
    pendingBatch = null;
  }
  document
    .querySelectorAll(".screen")
    .forEach((s) => (s.hidden = s.id !== "screen-" + name));
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === name);
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (name === "log") renderLog();
  else if (name === "today") renderToday();
  else if (name === "adequacy") renderAdequacy();
  else renderProfile();
}
document.addEventListener("click", (e) => {
  const del = e.target.closest("[data-delete]");
  if (del) {
    undo = structuredClone(state);
    if (
      save({
        ...state,
        entries: state.entries.filter((x) => x.id !== del.dataset.delete),
      })
    )
      toast("Entry deleted.", true);
  }
  const edit = e.target.closest("[data-edit]");
  if (edit) {
    const en = state.entries.find((x) => x.id === edit.dataset.edit);
    reviewDraft(en, en.tier, en.id);
  }
  const food = e.target.closest("[data-food]");
  if (food)
    portion(NutrakFoods.catalog.find((f) => f.id === food.dataset.food));
  const win = e.target.closest("[data-window]");
  if (win) {
    windowDays = +win.dataset.window;
    renderAdequacy();
  }
  const n = e.target.closest("[data-nutrient]");
  if (n) {
    const p = profile();
    const item =
      p &&
      NutrakEngine.analyze(state.entries, p, {
        windowDays,
        endDate: selectedDate,
        completeDays: state.completeDays,
      }).nutrients.find((x) => x.id === n.dataset.nutrient);
    if (item) explain(item);
  }
});
$("#closeDialog").onclick = () => $("#infoDialog").close();
$("#sourcesButton").onclick = sources;
$("#footerSources").onclick = sources;
$("#privacyButton").onclick = () =>
  dialog(
    "On your device, by your choice",
    "<p>Your profile and food journal live in this browser’s local storage. There is no account or background upload. Export a backup to retain your records.</p><p>Optional barcode lookup sends a barcode to Open Food Facts. Optional photo analysis sends your chosen image directly to OpenAI after an explicit Analyze action. Your API key and photo are never written into local storage or backups.</p>",
  );
window.addEventListener("storage", (e) => {
  if (e.key === "nutrak.v2" || e.key === "nutrak.entries") {
    externalChangeWarning =
      "Another tab updated the saved journal. This tab has kept its current records. Export any changes here, then reload to read the latest saved journal.";
    notice();
  }
});
window.addEventListener("hashchange", route);
render();
route();
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
