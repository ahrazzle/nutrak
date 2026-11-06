/* Nutrak PWA-surface checks — `node tests/pwa-surface.mjs` (node >= 18, no deps).
 * SPARKY-2: installability surface + offline-shell robustness.
 * Reads the repo's real manifest/icons/head/SW — nothing is hardcoded from a
 * copy, so this fails the moment the shipped surface drifts from the spec. */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p));
const text = (p) => read(p).toString("utf8");

let pass = 0,
  fail = 0;
const failures = [];
function ok(cond, name, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`);
  }
}
function section(name) {
  console.log(`\n## ${name}`);
}

/* ---------- 1. Manifest: the repo's own file, parsed fresh ---------- */
section("manifest");
let manifest = null;
try {
  manifest = JSON.parse(text("manifest.json"));
  ok(true, "manifest.json parses as JSON");
} catch (e) {
  ok(false, "manifest.json parses as JSON", String(e.message || e));
}
if (manifest) {
  ok(manifest.name === "Nutrak — Nutrition Tracker", "manifest.name correct");
  ok(manifest.short_name === "Nutrak", "manifest.short_name correct");
  ok(manifest.start_url === "./", "manifest.start_url correct");
  ok(manifest.display === "standalone", "manifest.display correct");
  ok(manifest.theme_color === "#1a1d21", "manifest.theme_color unchanged");
  ok(
    manifest.background_color === "#ffffff",
    "manifest.background_color unchanged",
  );
  ok(manifest.id === "./", "manifest.id present");
  ok(manifest.scope === "./", "manifest.scope present");
  ok(manifest.lang === "en", "manifest.lang present");
  ok(manifest.dir === "ltr", "manifest.dir present");
  const icons = manifest.icons || [];
  ok(icons.length >= 2, "manifest has both icon entries");
  ok(
    icons.every((i) => i.purpose === "any"),
    'every manifest icon has purpose "any"',
  );
}

/* ---------- 2. Icons: magic bytes + real dimensions ---------- */
section("icons (magic bytes + dimensions)");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function pngSize(p) {
  const b = read(p);
  if (!b.subarray(0, 8).equals(PNG_MAGIC)) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
for (const [p, w, h] of [
  ["icons/favicon-32.png", 32, 32],
  ["icons/apple-touch-icon.png", 180, 180],
]) {
  const s = existsSync(path.join(ROOT, p)) ? pngSize(p) : null;
  ok(s !== null, `${p} exists with PNG magic bytes`);
  ok(
    s && s.w === w && s.h === h,
    `${p} is ${w}x${h}`,
    s ? `${s.w}x${s.h}` : "unreadable",
  );
}
// ICO: header + directory entries; require a 16x16 entry.
{
  const p = "icons/favicon.ico";
  let sizes = [];
  if (existsSync(path.join(ROOT, p))) {
    const b = read(p);
    const count = b.readUInt16LE(4);
    for (let i = 0; i < count; i++) {
      const off = 6 + i * 16;
      sizes.push(`${b[off] || 256}x${b[off + 1] || 256}`);
    }
  }
  ok(sizes.length > 0, "favicon.ico exists with a valid ICO directory");
  ok(
    sizes.includes("16x16"),
    "favicon.ico contains a 16x16 entry",
    sizes.join(","),
  );
}
// The source icons are untouched (derivation, not redesign).
ok(
  existsSync(path.join(ROOT, "icons/icon-192.png")),
  "icons/icon-192.png still present",
);
ok(
  existsSync(path.join(ROOT, "icons/icon-512.png")),
  "icons/icon-512.png still present",
);

/* ---------- 3. Head declarations in index.html ---------- */
section("index.html head declarations");
const html = text("index.html");
const hasTag = (name, expected) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].some(([tag]) => {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    return Object.entries(expected).every(
      ([key, value]) => attrs[key] === value,
    );
  });
ok(
  hasTag("link", { rel: "icon", href: "./icons/favicon.ico" }),
  "favicon.ico link present",
);
ok(
  hasTag("link", {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "./icons/favicon-32.png",
  }),
  "PNG favicon link present",
);
ok(
  hasTag("link", {
    rel: "apple-touch-icon",
    href: "./icons/apple-touch-icon.png",
  }),
  "apple-touch-icon link present",
);
ok(
  hasTag("meta", { name: "apple-mobile-web-app-capable", content: "yes" }),
  "apple-mobile-web-app-capable meta present",
);
ok(
  hasTag("meta", {
    name: "apple-mobile-web-app-status-bar-style",
    content: "default",
  }),
  "apple-mobile-web-app-status-bar-style meta present",
);
ok(
  hasTag("meta", { name: "apple-mobile-web-app-title", content: "Nutrak" }),
  "apple-mobile-web-app-title meta present",
);

/* The service-worker behavior is exercised in service-worker.mjs. */
section("runtime shell");
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(
  (m) => m[1],
);
for (const source of scripts)
  ok(existsSync(path.join(ROOT, source)), `runtime script exists: ${source}`);
for (const name of [
  "engine",
  "reference-data",
  "foods",
  "photo",
  "store",
  "app",
]) {
  ok(scripts.includes(`./src/${name}.js`), `${name} included in runtime`);
}
ok(
  scripts.indexOf("./src/reference-data.js") <
    scripts.indexOf("./src/engine.js"),
  "references load before engine",
);
ok(scripts.at(-1) === "./src/app.js", "app boots after modules");

/* ---------- summary ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
