/* Nutrak staging smoke tests — `npm test` (node >= 18, no deps).
 * Covers the review surface: the app's plain-language provenance path runs
 * for real (via vm sandbox), the fixture's basis strings all resolve to a
 * glossary template (trust contract: never silently fall through), and the
 * structural fixes from the staging review stay fixed. */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}
function section(name) { console.log(`\n## ${name}`); }

/* ---------- 1. JSON validity ---------- */
section('JSON validity');
const glossary = JSON.parse(read('src/glossary.json'));
const manifest = JSON.parse(read('manifest.json'));
const fixture = JSON.parse(read('demo/fixture.json'));
ok(true, 'glossary.json parses');
ok(true, 'manifest.json parses');
ok(true, 'demo/fixture.json parses');

/* ---------- 2. Fixture shape (what render* actually dereferences) ---------- */
section('fixture shape');
ok(typeof fixture.meta?.generated === 'string' && fixture.meta.generated.length > 0, 'meta.generated present');
ok(fixture.meta?.regenerate === 'python3 build/api/gen-demo-fixture.py', 'meta.regenerate documents the generator');
const snap = fixture.profile?.snapshot;
ok(typeof fixture.profile?.userId !== 'undefined', 'profile.userId present');
ok(typeof snap?.energy?.range?.lo === 'number' && typeof snap.energy.range.hi === 'number', 'snapshot.energy.range.lo/hi numbers');
ok(typeof snap?.macros?.protein?.value === 'number', 'snapshot.macros.protein.value number');
ok(typeof snap?.macros?.carbohydrate?.value === 'number', 'snapshot.macros.carbohydrate.value number');
ok(typeof snap?.macros?.fat?.lo === 'number' && typeof snap?.macros?.fat?.hi === 'number', 'snapshot.macros.fat.lo/hi numbers');
ok(Array.isArray(snap?.nutrients) && snap.nutrients.length > 0, 'snapshot.nutrients non-empty');
ok(snap.nutrients.every((n) => n.name && n.unit && typeof n.value === 'number'), 'snapshot nutrients have name/unit/value');
const adeq = fixture.adequacy?.nutrients ?? [];
ok(adeq.length > 0, 'adequacy.nutrients non-empty');
ok(adeq.every((n) => n.id && n.name && n.basis && n.basisCode && n.status), 'adequacy rows have id/name/basis/basisCode/status');
ok(Array.isArray(fixture.entries) && fixture.entries.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e)), 'entries are YYYY-MM-DD strings');
ok([...fixture.entries].sort().join() === fixture.entries.join(), 'entries sorted ascending');
ok(fixture.entryPayloads?.length === fixture.entries.length, 'entryPayloads covers every entry date');

/* ---------- 3. App logic in a sandbox (real functions, stubbed DOM) ---------- */
section('app logic (vm sandbox)');
const appSrc = read('src/app.js');
const sandbox = { document: { addEventListener() {} }, console };
vm.createContext(sandbox);
const driver = `
;globalThis.__t = {
  escapeHtml, localDate, basisTemplate, renderExplanation, tierBadge, adequacyPill,
  linkTerms, provLine,
  setGlossary(g) { GLOSSARY = g; },
};`;
vm.runInContext(appSrc + driver, sandbox);
const T = sandbox.__t;
ok(typeof T.renderExplanation === 'function', 'app.js loads in sandbox (document stub)');

T.setGlossary(glossary);
ok(T.escapeHtml('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;', 'escapeHtml neutralizes markup');
ok(/^\d{4}-\d{2}-\d{2}$/.test(T.localDate()), 'localDate returns YYYY-MM-DD');
ok(T.localDate(new Date(2026, 0, 5)) === '2026-01-05', 'localDate uses local components (Jan 5, not UTC-shifted)');

const bPreg = T.basisTemplate('7-day rolling mean vs AI 2500 IU (pregnancy)');
ok(bPreg?.key === 'pregnancy_ai', 'pregnancy basis resolves to pregnancy_ai (priority over ai_based)', `got ${bPreg?.key}`);
ok(T.basisTemplate('NASEM 2023 EER, low-active')?.key === 'energy', 'energy basis resolves');
ok(T.basisTemplate('7-day rolling mean vs RDA 1000 mg (EAR 800)')?.key === 'ear_based', 'ear basis resolves');
ok(T.basisTemplate('7-day rolling mean vs RDA 130 g — no EAR/AR available')?.key === 'rda_no_ear', 'rda_no_ear resolves');
ok(T.basisTemplate('something the engine never emits') === null, 'unknown basis returns null (honest fallback, not silent)');

const explEnergy = T.renderExplanation({ basisCode: 'energy', basis: 'NASEM 2023 EER, low-active' });
ok(explEnergy.includes('Estimated Energy Requirement') && !explEnergy.includes('{'), 'energy explanation interpolates, no raw placeholders');
const explEar = T.renderExplanation({ basisCode: 'ear_based', target: 1000, unit: 'mg', ear: 800 });
ok(explEar.includes('1000') && explEar.includes('800') && explEar.includes('Nutrient Adequacy Ratio'), 'ear_based explanation carries target/ear numbers');
const explUnknown = T.renderExplanation({ basis: 'mystery basis 123' });
ok(explUnknown.includes("don't have a plain-language explanation") && explUnknown.includes('mystery basis 123'), 'unknown basis → honest note, technical basis still shown');
ok(!/<script/i.test(explEar), 'explanations contain no scriptable markup');

ok(T.tierBadge('photo').includes('estimate — edit to confirm'), 'photo tier badge carries the confirm contract');
ok(T.adequacyPill('under').includes('pill--under'), 'adequacy pill maps status → class');
ok(T.provLine({ basis: '<b>x</b>' }, true).includes('&lt;b&gt;'), 'provLine escapes server provenance');

/* ---------- 4. Trust contract over the whole fixture ---------- */
section('trust contract: every fixture basis resolves');
const tmplKeys = Object.keys(glossary.basis_templates).filter((k) => k !== '_note');
ok(tmplKeys.every((t) => { try { new RegExp(glossary.basis_templates[t].machine); return true; } catch { return false; } }), 'all basis_templates machine patterns compile');
let unresolved = [];
for (const n of adeq) {
  const direct = glossary.basis_templates[n.basisCode];
  const legacy = T.basisTemplate(n.basis);
  if (!direct && !legacy) unresolved.push(`${n.id}: ${n.basis}`);
}
ok(unresolved.length === 0, 'every adequacy basis has a template (direct or legacy)', unresolved.slice(0, 3).join(' | '));
ok(T.basisTemplate(snap.energy.basis)?.key === 'energy' || glossary.basis_templates[snap.energy.basisCode], 'profile energy basis resolves');

/* ---------- 5. Staging-review regression guards (static) ---------- */
section('review regression guards');
ok(/function renderProfile\(\)/.test(appSrc), 'renderProfile is defined (route() calls it)');
ok(!/toISOString\(\)\.slice\(0, 10\)/.test(appSrc), 'no UTC toISOString date stamping left');
ok(/escapeHtml\(en\.food\)/.test(appSrc), 'food names escaped in today log (stored XSS guard)');
ok(/#screen-log \.tab\[data-tab\]/.test(appSrc), 'log tab wiring scoped (adequacy tabs untouched)');
ok(/removeEntry\(id\)/.test(appSrc), 'store.removeEntry exists');
ok(/function validateProfileInputs\(\)/.test(appSrc), 'profile input validation exists');
ok(/kcal <= 0/.test(appSrc), 'kcal must be positive');
ok(/function localDate\(/.test(appSrc), 'localDate helper exists');
ok((appSrc.match(/querySelectorAll\('#screen-log \.tab\[data-tab\]'\)/g) || []).length >= 2, 'switchTab class toggling scoped to #screen-log');
ok(/if \(prof && editingProfile\) return/.test(appSrc), 'renderProfile never yanks an in-progress edit');

const css = read('src/styles.css');
const defined = new Set([...css.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
const usedWithFallback = new Set();
for (const m of css.matchAll(/var\(--([\w-]+)(,\s*[^)]*)?\)/g)) {
  if (m[2]) usedWithFallback.add(m[1]);
}
const undefinedVars = [...css.matchAll(/var\(--([\w-]+)\)/g)]
  .map((m) => m[1])
  .filter((v) => !defined.has(v) && !usedWithFallback.has(v));
ok(undefinedVars.length === 0, 'every CSS var() without fallback is defined in :root', [...new Set(undefinedVars)].join(', '));

const sw = read('sw.js');
ok(!/nutrak-v6/.test(sw), 'service worker cache version bumped');
ok(/icons\/icon-192\.png/.test(sw) && /icons\/icon-512\.png/.test(sw), 'icons precached in SW shell');
ok(/demo\/fixture\.json/.test(sw), 'demo fixture precached in SW shell');
ok(/e\.request\.method === 'GET'/.test(sw), 'SW only caches GET requests');

const html = read('index.html');
ok(/data-sex="M"[^>]*class="chip selected"|class="chip selected"[^>]*data-sex="M"/.test(html), 'Male chip marked selected (matches wizardState default)');
for (const id of ['fErr', 'phErr', 'pErr2']) {
  ok(new RegExp(`id="${id}"[^>]*role="alert"|role="alert"[^>]*id="${id}"`).test(html), `error container #${id} has role=alert`);
}
ok(/name="description"/.test(html), 'meta description present');
try {
  execSync('node --check src/app.js && node --check sw.js', { cwd: ROOT, stdio: 'pipe' });
  ok(true, 'node --check passes on app.js and sw.js');
} catch { ok(false, 'node --check passes on app.js and sw.js'); }

/* ---------- summary ---------- */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
