import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
for (const file of readdirSync(new URL("../src/", import.meta.url)).filter(
  (f) => f.endsWith(".js"),
)) {
  const result = spawnSync(process.execPath, ["--check", `src/${file}`], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${file}: ${result.stderr}`);
}
const fixture = JSON.parse(read("demo/fixture.json"));
assert.ok(
  fixture.meta.generated,
  "legacy fixture kept for historical provenance",
);
const html = read("index.html");
assert.match(html, /<html lang="en">/);
assert.match(html, /name="viewport"/);
assert.match(html, /name="description"/);
assert.doesNotMatch(
  html,
  /<script[^>]+src="https?:/,
  "no third-party scripts can access personal nutrition or BYOK data",
);
assert.doesNotMatch(
  read("src/app.js"),
  /http:\/\/127\.0\.0\.1:3001/,
  "no dependency on absent legacy nutrition API",
);
console.log(
  "PASS syntax, preserved historical fixture, accessible document metadata and local runtime boundaries",
);
