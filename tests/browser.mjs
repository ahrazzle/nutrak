import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startServer } from "../scripts/serve.mjs";
const { server, url } = await startServer({ port: 0 });
const browser = await chromium.launch({ headless: true });
const output = new URL("../test-results/", import.meta.url);
await mkdir(output, { recursive: true });
let passed = 0;
const check = (label) => {
  passed++;
  console.log("PASS browser: " + label);
};
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const getState = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("nutrak.v2") || '{"entries":[]}'),
  );
const nav = async (name) => {
  await page.locator(`[data-nav="${name}"]`).click();
  await page.locator(`#screen-${name}`).waitFor({ state: "visible" });
};
const confirm = async () => {
  await page.locator('#entryForm button[type="submit"]').click();
  await page.locator("#infoDialog").waitFor({ state: "hidden" });
};
const fillProfile = async () => {
  await nav("profile");
  await page.locator('[name="ageYears"]').fill("30");
  await page.locator('[name="sex"]').selectOption("M");
  await page.locator('[name="heightCm"]').fill("175");
  await page.locator('[name="weightKg"]').fill("70");
  await page.locator('[name="pal"]').selectOption("inactive");
  await page
    .locator('#profileForm button[type="submit"], #profileForm button')
    .last()
    .click();
};
try {
  const external = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(url)) external.push(r.url());
  });
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Your day, in perspective." })
    .waitFor();
  assert.equal(external.length, 0);
  check("fresh startup uses only local resources");
  await nav("log");
  await page.locator("#manualButton").click();
  await page
    .locator('[name="food"]')
    .fill("Lunch <img src=x onerror=alert(1)>");
  await page.locator('[name="energy_kcal"]').fill("300");
  await page.locator('[name="protein"]').fill("20");
  await confirm();
  assert.equal((await getState()).entries.length, 1);
  assert.match(await page.locator("#screen-today").innerText(), /Lunch <img/);
  assert.equal(await page.locator(".entry img").count(), 0);
  assert.equal((await getState()).entries[0].nutrients.fiber, undefined);
  check(
    "manual log before profile persists, escapes food text, preserves unknown nutrients",
  );
  await fillProfile();
  assert.equal((await getState()).profile.ageYears, 30);
  await nav("today");
  await page.locator("#energyWhy").click();
  assert.match(await page.locator("#dialogBody").innerText(), /RMSE|model/);
  assert.match(
    await page.locator("#dialogBody").innerText(),
    /not.*confidence/i,
  );
  await page.locator("#closeDialog").click();
  assert.equal(external.length, 0);
  check(
    "profile calculates locally and explains the sourced energy uncertainty",
  );
  await nav("log");
  await page.locator("#textFood").fill("100g oats, 150g banana, mystery stew");
  await page.locator("#parseButton").click();
  assert.match(await page.locator("#textResult").innerText(), /mystery stew/);
  assert.equal(await page.locator("#textResult [data-match]").count(), 2);
  await page.locator("#textResult [data-match]").nth(0).click();
  await confirm();
  assert.equal((await getState()).entries.length, 2);
  assert.equal(
    await page.locator("#textResult [data-match]").nth(0).isDisabled(),
    true,
  );
  await page.locator("#textResult [data-match]").nth(1).click();
  await confirm();
  let saved = await getState();
  assert.equal(saved.entries.length, 3);
  assert.ok(saved.entries[1].source.url.includes("usda"));
  assert.equal(saved.entries[1].grams, 100);
  assert.ok(saved.entries[1].nutrients.iron > 0);
  check(
    "multi-food text review retains remaining drafts and USDA source/portion metadata",
  );
  await nav("today");
  await page.locator("[data-edit]").first().click();
  await page.locator('[name="energy_kcal"]').fill("350");
  await confirm();
  assert.equal((await getState()).entries[0].kcal, 350);
  await page.locator("[data-delete]").first().click();
  assert.equal((await getState()).entries.length, 2);
  await page.locator("#undoButton").click();
  assert.equal((await getState()).entries.length, 3);
  await page.reload();
  await page.locator(".entry").first().waitFor();
  assert.equal(await page.locator(".entry").count(), 3);
  check("edit, delete, undo and reload preserve journal state");
  await page.locator("#completeDay").check();
  await nav("adequacy");
  assert.match(
    await page.locator("#screen-adequacy").innerText(),
    /1 comparable days?/,
  );
  assert.match(
    await page.locator("#screen-adequacy").innerText(),
    /More data needed|Insufficient data|Limited data/i,
  );
  await page.locator('[data-nutrient="energy_kcal"]').click();
  assert.match(
    await page.locator("#dialogBody").innerText(),
    /Missing|complete/,
  );
  await page.locator("#closeDialog").click();
  check("incomplete windows stay qualified and Energy provenance opens");
  await nav("log");
  let photoCalls = 0;
  let sentBody;
  await page.route("https://api.openai.com/v1/responses", async (route) => {
    photoCalls++;
    sentBody = route.request().postDataJSON();
    assert.match(route.request().headers().authorization, /sk-test-only/);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  items: [
                    {
                      food: "Test meal estimate",
                      grams: 200,
                      energy_kcal: 400,
                      protein: 20,
                      carbohydrate: 50,
                      fat: 12,
                    },
                  ],
                  assumptions: ["Oil is unknown."],
                  warnings: [],
                }),
              },
            ],
          },
        ],
      }),
    });
  });
  await page.locator("#photoKey").fill("sk-test-only-never-real");
  await page
    .locator("#photoFile")
    .setInputFiles(new URL("../icons/icon-192.png", import.meta.url).pathname);
  await page.locator("#analyzePhoto").waitFor();
  await page.waitForFunction(
    () => !document.querySelector("#analyzePhoto").disabled,
  );
  assert.equal(photoCalls, 0);
  await page.locator("#analyzePhoto").click();
  await page.locator("#photoResults [data-match]").waitFor();
  assert.equal(photoCalls, 1);
  assert.equal(sentBody.store, false);
  assert.equal((await getState()).entries.length, 3);
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify(localStorage).includes("sk-test-only"),
    ),
    false,
  );
  await page.locator("#photoResults [data-match]").click();
  await confirm();
  saved = await getState();
  assert.equal(saved.entries.length, 4);
  assert.equal(saved.entries.at(-1).tier, "photo");
  assert.equal(saved.entries.at(-1).nutrients.iron, undefined);
  assert.match(saved.entries.at(-1).assumptions[0], /Oil/);
  check(
    "photo requires explicit upload and reviewed confirmation; key/image absent from storage",
  );
  await page.route("https://world.openfoodfacts.org/api/v2/product/**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: 1,
        product: {
          product_name: "Test packaged oats",
          quantity: "500 g",
          nutrition_data_per: "100g",
          nutriments: {
            "energy-kcal_100g": 370,
            proteins_100g: 12,
            carbohydrates_100g: 60,
            fat_100g: 8,
            sodium_100g: 0.2,
          },
        },
      }),
    }),
  );
  await page.locator("#barcode").fill("3017620422003");
  await page.locator("#barcodeButton").click();
  await page.locator("#portionGrams").waitFor();
  await page.locator("#portionGrams").fill("50");
  await page.locator("#portionForm button").click();
  await confirm();
  saved = await getState();
  assert.equal(saved.entries.at(-1).kcal, 185);
  assert.equal(saved.entries.at(-1).nutrients.sodium, 100);
  check("barcode lookup reviews weighed portion and normalizes sodium units");
  await nav("profile");
  const dl = page.waitForEvent("download");
  await page.locator("#exportButton").click();
  const download = await dl;
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(backup.entries.length, 5);
  assert.ok(!JSON.stringify(backup).includes("sk-test-only"));
  assert.ok(!JSON.stringify(backup).includes("data:image"));
  await page.locator("#importFile").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...backup, completeDays: ["2026-02-30"] }),
    ),
  });
  await page.waitForFunction(() =>
    document.querySelector("#importStatus").textContent.includes("not applied"),
  );
  assert.equal((await getState()).entries.length, 5);
  check("backup excludes secrets; invalid restore leaves existing data intact");
  await nav("today");
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: new URL("desktop.png", output).pathname,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of ["today", "log", "adequacy", "profile"]) {
    await nav(screen);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      screen + " has no horizontal viewport overflow",
    );
  }
  await nav("today");
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: new URL("mobile.png", output).pathname,
    fullPage: true,
  });
  check("all four screens fit a phone viewport");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.locator(".entry").first().waitFor();
  assert.equal(await page.locator(".entry").count(), 5);
  await nav("adequacy");
  assert.match(
    await page.locator("#screen-adequacy").innerText(),
    /Nutrient reference comparison/,
  );
  await context.setOffline(false);
  check(
    "installed service worker supports offline reload and nutrient analysis",
  );
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(url);
  await blockedPage.locator("#storageNotice").waitFor({ state: "visible" });
  assert.match(
    await blockedPage.locator("#storageNotice").innerText(),
    /Stored data|storage|blocked/i,
  );
  await blocked.close();
  check("blocked storage shows an actionable warning without blanking app");
  const legacy = await browser.newContext();
  await legacy.addInitScript(() =>
    localStorage.setItem(
      "nutrak.entries",
      JSON.stringify([
        {
          id: "legacy1",
          date: "2026-11-01",
          food: "Legacy meal",
          kcal: 250,
          tier: "form",
        },
      ]),
    ),
  );
  const lp = await legacy.newPage();
  await lp.goto(url);
  await lp.locator("#journalDate").fill("2026-11-01");
  await lp.locator("#journalDate").dispatchEvent("change");
  await lp.getByRole("heading", { name: "Legacy meal" }).waitFor();
  assert.match(await lp.locator("#screen-today").innerText(), /Legacy meal/);
  await legacy.close();
  check("legacy calorie-only entries migrate without fabricated nutrients");
  // Separate tabs share a journal but must never overwrite newer records silently.
  const other = await context.newPage();
  await other.goto(url + "/#/profile");
  await other.locator("#profileForm").waitFor();
  await nav("log");
  await page.locator("#manualButton").click();
  await page.locator('[name="food"]').fill("Newer tab entry");
  await page.locator('[name="energy_kcal"]').fill("50");
  await confirm();
  await other.locator('[name="weightKg"]').fill("72");
  await other.locator("#profileForm button").click();
  await other.locator("#storageNotice").waitFor({ state: "visible" });
  assert.match(
    await other.locator("#storageNotice").innerText(),
    /Another tab|another tab/,
  );
  assert.equal((await getState()).entries.length, 6);
  assert.equal((await getState()).profile.weightKg, 70);
  await other.close();
  check("stale browser tab cannot overwrite a newer journal");

  // A late barcode response must not replace an unrelated manual draft.
  await nav("log");
  await page.unroute("https://world.openfoodfacts.org/api/v2/product/**");
  let releaseLookup;
  const lookupGate = new Promise((resolve) => {
    releaseLookup = resolve;
  });
  let lookupStarted;
  const lookupSeen = new Promise((resolve) => {
    lookupStarted = resolve;
  });
  await page.route(
    "https://world.openfoodfacts.org/api/v2/product/**",
    async (route) => {
      lookupStarted();
      await lookupGate;
      try {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            status: 1,
            product: {
              product_name: "Late product",
              quantity: "500 g",
              nutrition_data_per: "100g",
              nutriments: { "energy-kcal_100g": 100 },
            },
          }),
        });
      } catch {}
    },
  );
  await page.locator("#barcode").fill("3017620422003");
  await page.locator("#barcodeButton").click();
  await lookupSeen;
  await page.locator("#manualButton").click();
  await page.locator('[name="food"]').fill("Unsaved review retained");
  releaseLookup();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(
    await page.locator('[name="food"]').inputValue(),
    "Unsaved review retained",
  );
  await page.locator("#closeDialog").click();
  check("cancelled barcode response cannot replace an open review draft");

  // Import a complete synthetic window to test reference and scoped-UL presentation.
  await nav("profile");
  const seven = await page.evaluate(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    return {
      version: 2,
      profile: {
        ageYears: 30,
        sex: "M",
        heightCm: 175,
        weightKg: 70,
        pal: "inactive",
        reproState: null,
      },
      completeDays: dates,
      entries: dates.map((date, i) => ({
        id: "window" + i,
        date,
        food: "Synthetic complete record",
        tier: "form",
        nutrients: {
          energy_kcal: 2000,
          protein: 70,
          carbohydrate: 250,
          fat: 70,
          potassium: 1000,
          vitamin_c: 3000,
          magnesium: 5000,
        },
      })),
    };
  });
  await page
    .locator("#importFile")
    .setInputFiles({
      name: "complete-window.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(seven)),
    });
  await page.locator("#confirmImport").waitFor();
  assert.equal((await getState()).entries.length, 6);
  await page.locator("#confirmImport").click();
  await nav("adequacy");
  assert.match(
    await page
      .locator("tr")
      .filter({ has: page.locator('[data-nutrient="vitamin_c"]') })
      .innerText(),
    /Above upper level/,
  );
  assert.match(
    await page
      .locator("tr")
      .filter({ has: page.locator('[data-nutrient="magnesium"]') })
      .innerText(),
    /scope not assessable/,
  );
  assert.match(
    await page
      .locator("tr")
      .filter({ has: page.locator('[data-nutrient="potassium"]') })
      .innerText(),
    /Below AI · uncertain/,
  );
  assert.match(
    await page
      .locator("tr")
      .filter({ has: page.locator('[data-nutrient="iron"]') })
      .innerText(),
    /Insufficient comparable/,
  );
  check(
    "validated restore requires confirmation; complete-window AI and scoped UL rules render correctly",
  );

  const quota = await browser.newContext();
  await quota.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota", "QuotaExceededError");
    };
  });
  const qp = await quota.newPage();
  await qp.goto(url + "/#/log");
  await qp.locator("#manualButton").click();
  await qp.locator('[name="food"]').fill("Recoverable unsaved meal");
  await qp.locator('[name="energy_kcal"]').fill("250");
  await qp.locator("#entryForm button").click();
  await qp.getByRole("heading", { name: "Recoverable unsaved meal" }).waitFor();
  await qp.locator('[data-nav="profile"]').click();
  await qp.locator('[data-nav="today"]').click();
  assert.match(await qp.locator("#storageNotice").innerText(), /memory only/);
  await qp.locator('[data-nav="profile"]').click();
  const qdl = qp.waitForEvent("download");
  await qp.locator("#exportButton").click();
  const qfile = await qdl;
  assert.equal(
    JSON.parse(await readFile(await qfile.path(), "utf8")).entries[0].food,
    "Recoverable unsaved meal",
  );
  await quota.close();
  check(
    "quota failures retain edits in memory, keep warning visible and export recoverable data",
  );

  assert.deepEqual(errors, []);
  check("no uncaught browser errors across tested journeys");
  console.log(`PASS ${passed} browser acceptance groups`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
