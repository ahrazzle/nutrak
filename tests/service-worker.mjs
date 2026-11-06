import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
const code = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const handlers = {},
  cachesByName = new Map(),
  deleted = [];
const scope = "https://example.test/nutrak/";
let skipped = false,
  claimed = false,
  networkCalls = 0;
const caches = {
  async open(name) {
    if (!cachesByName.has(name)) cachesByName.set(name, new Map());
    const data = cachesByName.get(name);
    return {
      async addAll(urls) {
        for (const u of urls) {
          assert.ok(
            existsSync(
              new URL(
                u === "./" ? "../index.html" : "../" + u,
                import.meta.url,
              ),
            ),
            `precache file exists: ${u}`,
          );
          data.set(new URL(u, scope).href, `cached:${u}`);
        }
      },
      async add(u) {
        if (u.includes("favicon")) throw new Error("optional missing");
        data.set(new URL(u, scope).href, `cached:${u}`);
      },
      async match(u) {
        return data.get(typeof u === "string" ? u : u.url);
      },
    };
  },
  async keys() {
    return [...cachesByName.keys()];
  },
  async delete(key) {
    deleted.push(key);
    return cachesByName.delete(key);
  },
};
const self = {
  registration: { scope },
  clients: {
    async claim() {
      claimed = true;
    },
  },
  async skipWaiting() {
    skipped = true;
  },
  addEventListener(n, fn) {
    handlers[n] = fn;
  },
};
vm.runInNewContext(code, {
  self,
  caches,
  URL,
  fetch: async () => {
    networkCalls++;
    throw new Error("offline");
  },
});
async function lifecycle(name) {
  let pending;
  handlers[name]({
    waitUntil(p) {
      pending = p;
    },
  });
  await pending;
}
await lifecycle("install");
assert.equal(skipped, true, "activation only after core install");
cachesByName.set("nutrak-v9", new Map());
cachesByName.set("other-app-v1", new Map());
await lifecycle("activate");
assert.equal(claimed, true);
assert.deepEqual(deleted, ["nutrak-v9"], "unrelated apps keep caches");
function request(url, { method = "GET", mode = "cors", auth = false } = {}) {
  let result;
  handlers.fetch({
    request: {
      url,
      method,
      mode,
      headers: { has: (key) => auth && key === "authorization" },
    },
    respondWith(p) {
      result = p;
    },
  });
  return result;
}
assert.equal(
  await request(scope + "uncached?demo", { mode: "navigate" }),
  "cached:./index.html",
  "offline deep navigation returns versioned shell",
);
assert.equal(await request(scope + "src/engine.js"), "cached:./src/engine.js");
assert.equal(
  request("https://api.openai.com/v1/responses", { method: "POST" }),
  undefined,
);
assert.equal(
  request("https://world.openfoodfacts.org/api/v2/product/123"),
  undefined,
);
assert.equal(request(scope + "src/engine.js", { auth: true }), undefined);
assert.equal(
  request(scope + "private-backup.json"),
  undefined,
  "arbitrary private same-origin content not cached",
);
assert.equal(
  request("https://example.test/other/"),
  undefined,
  "other apps not intercepted",
);
assert.equal(request(scope, { method: "POST" }), undefined);
assert.equal(networkCalls, 0, "offline cached assets perform no fetches");
console.log(
  "PASS service worker: core files, optional failure, scoped cache cleanup, offline navigation, private/API bypass",
);
