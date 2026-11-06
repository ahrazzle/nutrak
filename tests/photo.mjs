import assert from "node:assert/strict";
import photo from "../src/photo.js";
const draft = {
  items: [
    {
      food: "Banana",
      grams: 120,
      energy_kcal: 100,
      protein: 1,
      carbohydrate: 25,
      fat: null,
    },
  ],
  assumptions: ["Portion estimated"],
  warnings: [],
};
const options = {
  apiKey: "test-not-a-real-key",
  imageDataUrl: "data:image/jpeg;base64,/9j/",
};
const response = (data) => async (url, opts) => {
  assert.equal(url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(opts.body);
  assert.equal(body.store, false);
  assert.equal(body.model, "gpt-4.1-mini");
  assert.equal(body.text.format.strict, true);
  return { ok: true, json: async () => data };
};
const result = await photo.analyze({
  ...options,
  fetch: response({
    output: [
      { content: [{ type: "output_text", text: JSON.stringify(draft) }] },
    ],
  }),
});
assert.equal(result.items[0].nutrients.fat, null);
assert.equal(result.items[0].nutrients.iron, undefined);
assert.equal(result.requiresReview, true);
assert.throws(
  () =>
    photo.validateResult({
      ...draft,
      items: [{ ...draft.items[0], protein: -1 }],
    }),
  /invalid amounts/,
);
assert.throws(
  () =>
    photo.validateResult({
      ...draft,
      items: [{ ...draft.items[0], grams: undefined }],
    }),
  /invalid amounts/,
);
await assert.rejects(
  photo.analyze({
    ...options,
    fetch: response({ output: [{ content: [{ type: "refusal" }] }] }),
  }),
  /declined/,
);
await assert.rejects(
  photo.analyze({
    ...options,
    fetch: response({
      output: [{ content: [{ type: "output_text", text: "broken" }] }],
    }),
  }),
  /malformed/,
);
await assert.rejects(
  photo.analyze({
    ...options,
    fetch: async () => ({ ok: false, status: 429 }),
  }),
  /spending limit/,
);
await assert.rejects(
  photo.analyze({
    ...options,
    timeoutMs: 1,
    fetch: (_, o) =>
      new Promise((_, reject) =>
        o.signal.addEventListener("abort", () => reject(Error("abort"))),
      ),
  }),
  /timed out/,
);
await assert.rejects(
  photo.analyze({ ...options, imageDataUrl: "https://example.com/image.jpg" }),
  /valid JPEG/,
);
assert.throws(
  () => photo.validateImage("data:image/svg+xml;base64,AAAA"),
  /valid JPEG/,
);
console.log(
  "photo: structured drafts, unknowns, refusal, malformed, rate limit and abort checks passed",
);

assert.throws(
  () =>
    photo.validateResult({ ...draft, items: [{ ...draft.items[0], iron: 4 }] }),
  /unsupported/,
);
