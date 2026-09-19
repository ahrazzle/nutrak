/* ============================================================
   Nutrak PWA — app.js
   Offline-first: reads local aggregates on first paint, syncs to
   the API when reachable. All state persists in localStorage.
   Visual contract: DESIGN-TOKENS.html (shayba) — tier badge and
   adequacy pills are SINGLE SOURCE OF TRUTH components below.
   ============================================================ */
'use strict';

const API = 'http://127.0.0.1:3001';
/* ---------- demo mode (GH Pages showcase, no local API) ----------
   Halakukhan: the fetch path must short-circuit BEFORE first paint on
   GH Pages — 127.0.0.1:3001 is unreachable there. When demo/fixture.json
   exists next to the app, api() serves REAL captured engine output from it
   (fixture generated live from the API, never hand-written). */
let DEMO = false;
let DEMO_FIXTURE = null;
/* ---------- glossary + plain-language explanations (user-facing) ----------
   User directive: "why this number?" must show WORDS + at most simple math,
   never code. glossary.json (Sheikh, research lane) carries basis_templates
   keyed to the engine's machine basis strings + 26 term definitions. */
let GLOSSARY = null; // { terms: [...], basis_templates: {...} }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Local calendar date (YYYY-MM-DD). `toISOString()` is UTC — for anyone
    off UTC it flips "today" in the evening and splits one day's log in two. */
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Match a machine basis string against a template's `machine` pattern.
    {target}/{unit}/{ear} become capture groups; returns captures for
    interpolation. Halakukhan: never silently fall through to raw JSON. */
function basisTemplate(basisStr) {
  if (!GLOSSARY) return null;
  const entries = Object.entries(GLOSSARY.basis_templates || {}).filter(([k]) => k !== '_note');
  // Priority order: more-specific patterns first. `pregnancy_ai` must beat
  // `ai_based` — the generic AI regex matches pregnancy strings too, which
  // would silently drop the §12-locked "confirm with your OB/RD" referral.
  // Unknown keys rank last (indexOf → -1 would otherwise sort them FIRST).
  const priority = ['pregnancy_ai', 'ear_based', 'rda_no_ear', 'rni_based', 'pri_based', 'ai_based', 'energy'];
  const rank = (k) => { const i = priority.indexOf(k); return i === -1 ? priority.length : i; };
  entries.sort((a, b) => rank(a[0]) - rank(b[0]));
  for (const [key, tpl] of entries) {
    // `machine` is now a real regex (raw string in the JSON). Patterns are
    // anchored at the start (`re.match`) and tolerant of the engine's optional
    // suffix. Capture groups: [target], [unit?], [ear?] — see `fields` on the template.
    const m = new RegExp(tpl.machine).exec(basisStr || '');
    if (m) return { key, tpl, caps: m };
  }
  return null;
}

/** Auto-link glossary terms inside an explanation → clickable expansion. */
function linkTerms(text) {
  if (!GLOSSARY) return escapeHtml(text);
  let out = escapeHtml(text);
  const sorted = [...GLOSSARY.terms].sort((a, b) => b.term.length - a.term.length);
  for (const t of sorted) {
    const re = new RegExp(`\\b(${t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'g');
    out = out.replace(re, `<span class="gloss-term" data-term="${t.term}" role="button" tabindex="0">$1</span>`);
  }
  return out;
}

/** Render the "why this number?" panel body from the stored provenance.
    Primary path (azaraki structural kill): key off the engine's stable
    `basisCode` enum — direct glossary.basis_templates lookup, no string
    parsing. Legacy fallback: regex matcher for rows captured without a code
    (old fixtures). Never raw JSON — unmatched → visible honest note. */
function renderExplanation(p) {
  let tpl = null;
  if (p.basisCode && GLOSSARY?.basis_templates?.[p.basisCode]) {
    tpl = { tpl: GLOSSARY.basis_templates[p.basisCode], caps: [] };
  } else {
    tpl = basisTemplate(p.basis); // legacy fallback
  }
  if (!tpl) {
    return `<p class="prov-words">We don't have a plain-language explanation for this figure yet. The technical basis is: “${escapeHtml(p.basis || 'unknown')}” — it will be explained soon.</p>`;
  }
  // Interpolate from the stored fields (basisCode path) or capture groups
  // (legacy regex path, template's declared field order).
  const fields = tpl.tpl.fields || [];
  const cap = (i) => (tpl.caps && tpl.caps[i] != null ? String(tpl.caps[i]) : '');
  let words = tpl.tpl.body || tpl.tpl.words || '';
  const interp = {
    target: p.target ?? (fields.includes('target') ? cap(1) : ''),
    unit:   p.unit   ?? (fields.includes('unit')   ? cap(2) : ''),
    ear:    p.ear    ?? (fields.includes('ear')    ? cap(3) : ''),
    activity: cap(1)
  };
  for (const k of Object.keys(interp)) {
    words = words.replace(new RegExp(`\\{${k}\\}`, 'g'), interp[k]);
  }
  let html = `<p class="prov-words">${linkTerms(words)}</p>`;
  // Footnote fallback: every glossary term referenced anywhere in the figure
  // gets a clickable chip (user rule: clickable where possible, else footnote).
  const referenced = new Set();
  for (const t of GLOSSARY?.terms || []) {
    if (new RegExp(`\\b${t.term}\\b`).test(`${p.basis || ''} ${words}`)) referenced.add(t.term);
  }
  if (referenced.size) {
    html += `<div class="gloss-foot">Terms: ${[...referenced].map((term) => `<span class="gloss-term" data-term="${term}" role="button" tabindex="0">${term}</span>`).join(' ')}</div>`;
  }
  return html;
}
const LS = {
  profile: 'nutrak.profile',     // { userId, version, snapshot }
  entries: 'nutrak.entries',     // [{ id, date, food, kcal, tier, method }]
  aggregates: 'nutrak.aggregates' // { 7: report, 30: report }
};

/* ---------- single source of truth: tier badge ---------- */
const TIER_LABEL = {
  weighed: 'Weighed',
  form: 'Form',
  barcode: 'Barcode',
  text: 'Text',
  photo: 'Photo'
};
const TIER_SOLID = ['weighed', 'form', 'barcode'];
const TIER_SOFT = ['text', 'photo'];

/** Render a confidence tier badge. photo is ALWAYS dashed amber + confirm text. */
function tierBadge(tier) {
  const label = TIER_LABEL[tier] || tier;
  const cls = `tier tier--${tier}`;
  if (tier === 'photo') {
    return `<span class="${cls}"><span class="dot"></span><b>Photo · estimate — edit to confirm</b></span>`;
  }
  return `<span class="${cls}"><span class="dot"></span>${label}</span>`;
}

/* ---------- single source of truth: adequacy pill ---------- */
const PILL_MAP = {
  'sustained-good': 'pill--good',
  approaching: 'pill--approaching',
  under: 'pill--under',
  'no-data': 'pill--nodata'
};
const PILL_TEXT = {
  'sustained-good': 'good',
  approaching: 'approaching',
  under: 'under',
  'no-data': 'no-data'
};
function adequacyPill(status) {
  const cls = PILL_MAP[status] || 'pill--nodata';
  const txt = PILL_TEXT[status] || status;
  return `<span class="pill ${cls}">${txt}</span>`;
}

/* ---------- provenance (trust contract) ---------- */
function provLine(provenance, auto) {
  if (!provenance) return '';
  const kind = auto === false ? 'prov--flag' : 'prov--auto';
  // Escape: basis/uncertainty come from the server/fixture — never raw HTML.
  const basis = escapeHtml(provenance.basis || provenance.equation || 'computed');
  const uncertainty = escapeHtml(provenance.uncertainty || '');
  return `<div class="prov ${kind}">▲ ${auto === false ? 'flag' : 'auto'} · ${basis}${uncertainty ? ' · ' + uncertainty : ''} <button data-prov='${encodeURIComponent(JSON.stringify(provenance))}'>why this number?</button></div>`;
}

/* ---------- local store (offline-first) ---------- */
const store = {
  get(k, fallback = null) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
  getProfile() { return this.get(LS.profile); },
  setProfile(p) { this.set(LS.profile, p); },
  getEntries() { return this.get(LS.entries, []); },
  addEntry(e) {
    const l = this.getEntries();
    l.push({ ...e, serverId: null });
    this.set(LS.entries, l);
  },
  removeEntry(id) {
    // Local-only delete (fat-finger fix). Entries already flushed to the
    // server keep their server-side row — the API has no delete endpoint in
    // this build, so this is documented, not silent.
    this.set(LS.entries, this.getEntries().filter((x) => String(x.id) !== String(id)));
  },
  markSynced(id, serverId) {
    const l = this.getEntries();
    const i = l.findIndex((x) => x.id === id);
    if (i >= 0) { l[i].serverId = serverId; this.set(LS.entries, l); }
  },
  pendingEntries() { return this.getEntries().filter((e) => !e.serverId); },
  getAggregates() { return this.get(LS.aggregates, {}); },
  setAggregates(a) { this.set(LS.aggregates, a); }
};

/* ---------- API client (network-first, offline fallback) ---------- */
async function api(path, opts = {}) {
  // Demo mode: serve the captured fixture — NO fetch, NO 127.0.0.1.
  if (DEMO && DEMO_FIXTURE) {
    await new Promise((r) => setTimeout(r, 120)); // simulate a quiet round-trip
    if (path.startsWith('/api/adequacy')) {
      const w = /window=(\d+)/.exec(path);
      const win = w && w[1] === '30' ? 30 : 7;
      return { ...DEMO_FIXTURE.adequacy, windowDays: win };
    }
    if (path.startsWith('/api/profile') && opts.method === 'POST') {
      return { ...DEMO_FIXTURE.profile };
    }
    throw new Error(`demo fixture has no ${path}`);
  }
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

let online = false;
/** Flush locally-logged entries to the API (offline queue → server). */
async function flushEntries() {
  const prof = store.getProfile();
  const pending = store.pendingEntries();
  if (!prof?.userId || !pending.length) return;
  for (const e of pending) {
    try {
      // Map the UI log entry to the API entry shape (confidence_tier contract).
      const r = await api('/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          date: e.date, userId: prof.userId, foodLabel: e.food, quantity: 1,
          confidenceTier: e.tier, method: e.method || 'form',
          nutrients: e.nutrients || { energy_kcal: e.kcal },
        }),
      });
      store.markSynced(e.id, r.id);
    } catch { /* offline — stay queued */ }
  }
}
async function sync() {
  const prof = store.getProfile();
  if (DEMO) { setSync('demo'); renderToday(); renderAdequacy(); renderProfile(); return; }
  setSync('offline');
  if (!prof) return;
  try {
    await flushEntries();
    const a7 = await api(`/api/adequacy?userId=${prof.userId}&window=7`);
    const a30 = await api(`/api/adequacy?userId=${prof.userId}&window=30`);
    store.setAggregates({ 7: a7, 30: a30 });
    online = true;
    setSync('synced');
  } catch {
    online = false;
    setSync('offline');
  }
  renderToday(); renderAdequacy(); renderProfile();
}
function setSync(txt) {
  const el = document.getElementById('syncState');
  if (el) el.textContent = txt;
}

/* ---------- router ---------- */
const SCREENS = ['today', 'log', 'adequacy', 'profile'];
function route() {
  const h = location.hash || '#/today';
  const name = (h.match(/#\/(\w+)/) || [])[1] || 'today';
  SCREENS.forEach((s) => {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.toggle('active', s === name);
  });
  document.querySelectorAll('.bottomnav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
  if (name === 'today') renderToday();
  if (name === 'adequacy') renderAdequacy();
  if (name === 'profile') renderProfile();
}

/* ============================================================
   SCREEN A: PROFILE WIZARD
   ============================================================ */
let wizardState = { sex: 'M', repro: '' };
const WIZARD_STEPS = 3;
let wstep = 0;
// True while the user is actively editing profile fields — renderProfile()
// must not yank them back to the saved card (e.g. init sync resolving
// mid-edit).
let editingProfile = false;

function showWStep(i) {
  wstep = i;
  document.querySelectorAll('.wizard-step').forEach((el, idx) => el.classList.toggle('active', idx === i));
  document.querySelectorAll('.step-indicator .seg').forEach((el, idx) => {
    el.classList.toggle('done', idx < i);
    el.classList.toggle('current', idx === i);
  });
}

function buildProfileRequest() {
  const prof = store.getProfile();
  return {
    // P0-1: client holds userId — re-save upserts the same lineage, never orphans.
    ...(prof?.userId ? { userId: prof.userId } : {}),
    sex: wizardState.sex,
    ageYears: +document.getElementById('pAge').value,
    heightCm: +document.getElementById('pHeight').value,
    weightKg: +document.getElementById('pWeight').value,
    pal: document.getElementById('pPal').value,
    goal: document.getElementById('pGoal').value,
    standards: document.getElementById('pStandards').value,
    ...(wizardState.repro ? { reproState: wizardState.repro } : {}),
    ...(document.getElementById('pBf').value ? { bodyFatFraction: +document.getElementById('pBf').value / 100 } : {})
  };
}

function renderResult() {
  const prof = store.getProfile();
  const el = document.getElementById('pResult');
  if (!prof) { el.innerHTML = '<div class="empty">No computed profile yet.</div>'; return; }
  const s = prof.snapshot;
  const e = s.energy;
  el.innerHTML = `
    <div class="rangeband">
      <div class="target" style="left:0;right:0"></div>
    </div>
    <div style="display:flex;justify-content:space-between" class="num">
      <span style="color:var(--ink-faint)">target band</span>
      <span><b style="font-size:var(--txt-xl)">${e.range.lo.toLocaleString()}–${e.range.hi.toLocaleString()}</b> kcal/day</span>
    </div>
    ${provLine({ ...e.provenance, basis: e.basis, basisCode: e.basisCode }, e.auto)}
    <div class="macrobars">
      <div class="macrorow"><span class="name">Protein</span><div class="track"><div class="bar" style="width:60%;background:linear-gradient(90deg,#2e8b57,#5eb894)"></div></div><span class="vals num"><b>${s.macros.protein.value} g</b></span></div>
      <div class="macrorow"><span class="name">Carbs</span><div class="track"><div class="bar" style="width:45%;background:linear-gradient(90deg,#b8860b,#d4a853)"></div></div><span class="vals num"><b>${s.macros.carbohydrate.value} g</b></span></div>
      <div class="macrorow"><span class="name">Fat</span><div class="track"><div class="bar" style="width:52%;background:linear-gradient(90deg,#4a5568,#7a8794)"></div></div><span class="vals num"><b>${s.macros.fat.lo}–${s.macros.fat.hi}% energy</b></span></div>
    </div>
    <table class="nut-table">
      <tr><th>Nutrient</th><th class="num">Target</th><th class="num">UL</th></tr>
      ${s.nutrients.slice(0, 8).map((n) => `
        <tr>
          <td>${escapeHtml(n.name)}</td>
          <td class="num">${n.value.toLocaleString()} ${escapeHtml(n.unit)} <span style="color:var(--ink-faint)">(${escapeHtml(n.type)})</span></td>
          <td class="num" style="color:var(--ink-faint)">${n.ul ? n.ul.toLocaleString() + ' ' + escapeHtml(n.unit) : '—'}</td>
        </tr>`).join('')}
    </table>
  `;
}

/* ============================================================
   SCREEN A (revisit): PROFILE — was called by route() but never defined,
   throwing a ReferenceError on every #/profile navigation. The wizard
   markup is static; this keeps it in sync with saved state.
   ============================================================ */
function syncChips(containerId, attr, value) {
  document.querySelectorAll(`#${containerId} .chip`).forEach((c) => {
    c.classList.toggle('selected', String(c.dataset[attr] ?? '') === String(value ?? ''));
  });
}

/** Prefill the wizard from the saved inputs so edits start from current
    values instead of hard-coded defaults. No-op for demo profiles (the
    fixture carries no inputs). */
function prefillWizard(prof) {
  const i = prof?.inputs;
  if (!i) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null && v !== '') el.value = v; };
  set('pAge', i.ageYears); set('pHeight', i.heightCm); set('pWeight', i.weightKg);
  set('pPal', i.pal); set('pGoal', i.goal); set('pStandards', i.standards);
  if (i.bodyFatFraction != null) set('pBf', Math.round(i.bodyFatFraction * 100));
  if (i.sex) { wizardState.sex = i.sex; syncChips('pSexChips', 'sex', i.sex); }
  wizardState.repro = i.reproState || '';
  syncChips('pReproChips', 'repro', wizardState.repro);
}

function showSavedProfile() {
  const prof = store.getProfile();
  if (!prof) return;
  editingProfile = false;
  document.getElementById('profileWizard').style.display = 'none';
  const saved = document.getElementById('profileSaved');
  saved.style.display = 'block';
  saved.innerHTML = `
    <div class="card">
      <div class="card-title">Profile saved · v${escapeHtml(prof.version)}</div>
      <p>Your targets are computed from age/sex/life-stage + EER2023. Energy shown as a range (±SEPV).</p>
      <div class="banner banner--warn">Editing any field later bumps the version and recomputes — review before continuing.</div>
      <a class="btn btn--primary" href="#/today" style="text-decoration:none;display:inline-block">Go to Today →</a>
      <button class="btn btn--ghost" id="pEdit2">Edit fields</button>
    </div>`;
  document.getElementById('pEdit2').addEventListener('click', () => {
    editingProfile = true;
    prefillWizard(prof);
    document.getElementById('profileWizard').style.display = 'block';
    saved.style.display = 'none';
    showWStep(0);
  });
}

function renderProfile() {
  const prof = store.getProfile();
  if (prof && editingProfile) return; // don't yank an in-progress edit
  if (prof) { showSavedProfile(); return; }
  document.getElementById('profileWizard').style.display = 'block';
  document.getElementById('profileSaved').style.display = 'none';
}

function numField(id) {
  const v = +document.getElementById(id).value;
  return Number.isFinite(v) ? v : NaN;
}
/** Field-level validation before the compute call — a cleared number input
    reads as NaN/0 and would otherwise be sent to the API as age 0. */
function validateProfileInputs() {
  const problems = [];
  const age = numField('pAge'), h = numField('pHeight'), w = numField('pWeight');
  const bfRaw = document.getElementById('pBf').value.trim();
  if (!Number.isFinite(age) || age < 1 || age > 120) problems.push('Age must be between 1 and 120.');
  if (!Number.isFinite(h) || h < 80 || h > 250) problems.push('Height must be between 80 and 250 cm.');
  if (!Number.isFinite(w) || w < 20 || w > 400) problems.push('Weight must be between 20 and 400 kg.');
  if (bfRaw !== '') {
    const bf = +bfRaw;
    if (!Number.isFinite(bf) || bf < 3 || bf > 60) problems.push('Body fat must be between 3 and 60%.');
  }
  return problems;
}

/* ============================================================
   SCREEN B: TODAY
   ============================================================ */
function kcalToday() {
  const today = localDate();
  return store.getEntries().filter((e) => e.date === today).reduce((s, e) => s + e.kcal, 0);
}

function renderToday() {
  const prof = store.getProfile();
  const energyEl = document.getElementById('todayEnergy');
  const macroEl = document.getElementById('todayMacros');
  const tickEl = document.getElementById('todayTicker');
  const logEl = document.getElementById('todayLog');

  if (!prof) {
    energyEl.innerHTML = '<div class="empty"><div class="big">◉</div><p>Set up your profile to see targets.</p><a class="btn btn--primary" href="#/profile" style="text-decoration:none;display:inline-block;margin-top:var(--sp-3)">Create profile</a></div>';
    macroEl.innerHTML = ''; tickEl.innerHTML = ''; logEl.innerHTML = '';
    return;
  }

  const s = prof.snapshot;
  const e = s.energy;
  const kcal = kcalToday();
  // Range band: position the fill against a nominal 0..hi+slack scale.
  const scaleMax = e.range.hi * 1.15;
  const pct = Math.min((kcal / scaleMax) * 100, 100);
  const tLo = (e.range.lo / scaleMax) * 100;
  const tW = ((e.range.hi - e.range.lo) / scaleMax) * 100;

  energyEl.innerHTML = `
    <div class="card-title">Energy today</div>
    <div class="rangeband">
      <div class="target" style="left:${tLo}%;width:${tW}%"></div>
      <div class="fill" style="left:0;width:${Math.max(pct, 1)}%"></div>
    </div>
    <div style="display:flex;justify-content:space-between" class="num">
      <span><b style="font-size:var(--txt-2xl)">${kcal.toLocaleString()}</b> kcal</span>
      <span style="color:var(--ink-faint);align-self:flex-end">band ${e.range.lo.toLocaleString()}–${e.range.hi.toLocaleString()}</span>
    </div>
    ${provLine({ ...e.provenance, basis: e.basis, basisCode: e.basisCode }, e.auto)}`;

  // Macros — g + %energy from logged entries (derived: kcal split estimate).
  const entries = store.getEntries();
  const todayEntries = entries.filter((en) => en.date === localDate());
  const pG = todayEntries.reduce((s2, en) => s2 + (en.macros?.protein || 0), 0);
  const cG = todayEntries.reduce((s2, en) => s2 + (en.macros?.carbs || 0), 0);
  const fG = todayEntries.reduce((s2, en) => s2 + (en.macros?.fat || 0), 0);
  const pT = s.macros.protein.value, cT = s.macros.carbohydrate.value;
  const pP = pT ? Math.min((pG / pT) * 100, 100) : 0;
  const cP = cT ? Math.min((cG / cT) * 100, 100) : 0;
  macroEl.innerHTML = `
    <div class="card-title">Macros · g + %energy</div>
    <div class="macrobars">
      <div class="macrorow"><span class="name">Protein</span><div class="track"><div class="bar" style="width:${pP}%;background:linear-gradient(90deg,#2e8b57,#5eb894)"></div></div><span class="vals num"><b>${pG} g</b> · ${pT} g target</span></div>
      <div class="macrorow"><span class="name">Carbs</span><div class="track"><div class="bar" style="width:${cP}%;background:linear-gradient(90deg,#b8860b,#d4a853)"></div></div><span class="vals num"><b>${cG} g</b> · ${cT} g target</span></div>
      <div class="macrorow"><span class="name">Fat</span><div class="track"><div class="bar" style="width:50%;background:linear-gradient(90deg,#4a5568,#7a8794)"></div></div><span class="vals num"><b>${fG} g</b> · ${s.macros.fat.lo}–${s.macros.fat.hi}%</span></div>
    </div>
    <div class="prov prov--auto">▲ auto · logged entries vs profile targets · estimates</div>`;

  // Adequacy ticker — reads LOCAL aggregates, offline from first paint.
  const agg = store.getAggregates()[7];
  tickEl.innerHTML = agg && agg.nutrients.length
    ? agg.nutrients
        .filter((n) => ['calcium', 'iron', 'vitamin_c', 'protein', 'folate'].includes(n.id))
        .slice(0, 5)
        .map((n) => {
          const prov = encodeURIComponent(JSON.stringify({ basis: n.basis, target: n.target, unit: n.unit, ear: n.ear, basisCode: n.basisCode }));
          return `
          <div class="adeq-row">
            <div class="left">
              <div>
                <div class="name">${escapeHtml(n.name)}</div>
                <div class="sub num">${n.pctTarget}% of ${escapeHtml(n.targetType)} ${n.target} ${escapeHtml(n.unit)}${n.ear ? ' · EAR ' + escapeHtml(n.ear) : ''} <button class="whybtn" data-prov='${prov}'>why this number?</button></div>
              </div>
            </div>
            ${adequacyPill(n.status)}
          </div>`;
        }).join('')
    : '<div class="empty">Log a few days to start your adequacy bands.</div>';

  // Today's log entries.
  // Demo mode: the fixture is date-stamped (e.g. 2026-08-23..29) — the
  // reviewer's "today" won't match, so cue that explicitly instead of a bare
  // "0 kcal" with no explanation (shayba polish item).
  const demoRange = DEMO && DEMO_FIXTURE?.entries?.length
    ? `${DEMO_FIXTURE.entries[0]} → ${DEMO_FIXTURE.entries[DEMO_FIXTURE.entries.length - 1]}`
    : null;
  logEl.innerHTML = todayEntries.length
    ? todayEntries.map((en) => `
        <div class="entry">
          <div>
            <div class="food">${escapeHtml(en.food)}</div>
            <div class="detail">${escapeHtml(en.method || 'manual')} · 1 serving · ${tierBadge(en.tier)}</div>
          </div>
          <span class="kcal num">${en.kcal.toLocaleString()} kcal</span>
          <button class="entry-del" data-del="${en.id}" aria-label="Delete entry" title="Delete entry">✕</button>
        </div>`).join('')
    : demoRange
      ? `<div class="empty">Demo data covers <b>${demoRange}</b> — today's date isn't in that window, so 0 kcal here is expected. <a href="#/log">Log against it →</a></div>`
      : '<div class="empty">No entries yet today. <a href="#/log">Add one →</a></div>';
}

/* ============================================================
   SCREEN C: LOG — form functional, others stubbed behind tiers
   ============================================================ */
let logTier = 'weighed';

function switchTab(name) {
  // Scoped to the log screen — the adequacy window tabs manage their own
  // .active state via the [data-win] handler.
  document.querySelectorAll('#screen-log .tab[data-tab]').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('#screen-log .tabpane').forEach((p) => {
    p.style.display = p.dataset.pane === name ? 'block' : 'none';
  });
}

/* ============================================================
   SCREEN D: ADEQUACY
   ============================================================ */
let adeqWin = 7;
function renderAdequacy() {
  const prof = store.getProfile();
  const el = document.getElementById('adeqList');
  if (!prof) {
    el.innerHTML = '<div class="empty"><div class="big">▤</div><p>Create a profile to see adequacy targets.</p></div>';
    return;
  }
  const agg = store.getAggregates()[adeqWin];
  if (!agg || !agg.nutrients.length) {
    el.innerHTML = '<div class="empty">No logged days yet — adequacy needs sustained data.</div>';
    return;
  }
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
      <span class="num" style="color:var(--ink-faint)">${agg.loggingDays} logging days · MAR ${agg.mar ?? '—'}</span>
      <span class="num" style="color:var(--ink-faint)">${agg.windowDays}-day rolling</span>
    </div>
    <div class="adeq-grid">
    ${agg.nutrients.map((n) => {
      const prov = encodeURIComponent(JSON.stringify({ basis: n.basis, target: n.target, unit: n.unit, ear: n.ear, basisCode: n.basisCode }));
      return `
      <div class="adeq-row">
        <div class="left">
          <div>
            <div class="name">${escapeHtml(n.name)}</div>
            <div class="sub num">${n.pctTarget}% of ${escapeHtml(n.targetType)} ${n.target} ${escapeHtml(n.unit)}${n.ear ? ' · EAR ' + escapeHtml(n.ear) : ''} <button class="whybtn" data-prov='${prov}'>why this number?</button></div>
          </div>
        </div>
        ${adequacyPill(n.status)}
      </div>`;
    }).join('')}
    </div>`;
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Register service worker.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Router.
  window.addEventListener('hashchange', route);
  route();

  // Profile wizard wiring.
  document.getElementById('pSexChips').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip'); if (!b) return;
    wizardState.sex = b.dataset.sex;
    document.querySelectorAll('#pSexChips .chip').forEach((c) => c.classList.toggle('selected', c === b));
  });
  document.getElementById('pReproChips').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip'); if (!b) return;
    wizardState.repro = b.dataset.repro || '';
    document.querySelectorAll('#pReproChips .chip').forEach((c) => c.classList.toggle('selected', c === b));
  });
  document.getElementById('pNext1').addEventListener('click', () => showWStep(1));
  document.getElementById('pBack0').addEventListener('click', () => showWStep(0));
  document.getElementById('pNext2').addEventListener('click', async () => {
    const problems = validateProfileInputs();
    const errEl = document.getElementById('pErr2');
    if (problems.length) {
      errEl.hidden = false;
      errEl.textContent = problems.join(' ');
      return;
    }
    errEl.hidden = true;
    const body = buildProfileRequest();
    try {
      // Compute via API — response carries the REAL userId + version + changed.
      const data = await api('/api/profile', { method: 'POST', body: JSON.stringify(body) });
      // Persist the inputs too — edits prefill from current values, and
      // re-save upserts the same userId lineage (P0-1), never orphans.
      store.setProfile({ userId: data.userId, version: data.version, changed: data.changed, snapshot: data.snapshot, inputs: body });
      showWStep(2);
      renderResult();
      renderToday();
    } catch {
      setSync('offline');
      document.getElementById('pResult').innerHTML = '<div class="empty">API offline — profile needs the server for first compute.</div>';
    }
  });
  document.getElementById('pSave').addEventListener('click', () => {
    showSavedProfile();
    sync();
  });
  document.getElementById('pEdit').addEventListener('click', () => {
    editingProfile = true;
    prefillWizard(store.getProfile());
    showWStep(0);
  });

  // Log wiring.
  // Log tabs only — scoped to #screen-log. The adequacy window tabs
  // ([data-win]) have their own handler; a global '.tab' listener here
  // fired switchTab(undefined) on 7d/30d clicks and hid every log pane.
  document.querySelectorAll('#screen-log .tab[data-tab]').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  document.getElementById('fTierChips').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip'); if (!b) return;
    logTier = b.dataset.tier;
    document.querySelectorAll('#fTierChips .chip').forEach((c) => c.classList.toggle('selected', c === b));
  });
  /** Inline form error: shows msg in elId, returns false when invalid. */
  function fieldError(elId, msg) {
    const el = document.getElementById(elId);
    el.hidden = !msg;
    el.textContent = msg || '';
    return !msg;
  }
  document.getElementById('fAdd').addEventListener('click', () => {
    const food = document.getElementById('fFood').value.trim();
    const kcal = +document.getElementById('fKcal').value;
    const msg = !food ? 'Name the food first.'
      : (!Number.isFinite(kcal) || kcal <= 0) ? 'Energy must be a positive number.'
      : '';
    if (!fieldError('fErr', msg)) return;
    store.addEntry({ id: Date.now(), date: localDate(), food, kcal, tier: logTier, method: 'form' });
    document.getElementById('fFood').value = '';
    document.getElementById('fKcal').value = '';
    renderToday();
    location.hash = '#/today';
  });

  // Delete a mis-logged entry (delegated — rows re-render on every change).
  document.getElementById('todayLog').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-del]');
    if (!b) return;
    store.removeEntry(b.dataset.del);
    renderToday();
  });

  // Photo tab — the non-negotiable contract.
  document.getElementById('pSimulate').addEventListener('click', () => {
    document.getElementById('photoDrop').style.display = 'none';
    document.getElementById('photoEstimate').style.display = 'block';
  });
  document.getElementById('phConfirm').addEventListener('click', () => {
    const food = document.getElementById('phFood').value.trim();
    const kcal = +document.getElementById('phKcal').value;
    const msg = !food ? 'Name the food first.'
      : (!Number.isFinite(kcal) || kcal <= 0) ? 'Energy must be a positive number.'
      : '';
    if (!fieldError('phErr', msg)) return;
    store.addEntry({ id: Date.now(), date: localDate(), food, kcal, tier: 'photo', method: 'photo' });
    document.getElementById('photoEstimate').style.display = 'none';
    document.getElementById('photoDrop').style.display = 'block';
    renderToday();
    location.hash = '#/today';
  });
  document.getElementById('phDiscard').addEventListener('click', () => {
    document.getElementById('photoEstimate').style.display = 'none';
    document.getElementById('photoDrop').style.display = 'block';
  });

  // Adequacy window toggle.
  document.querySelectorAll('[data-win]').forEach((t) => t.addEventListener('click', () => {
    adeqWin = +t.dataset.win;
    document.querySelectorAll('[data-win]').forEach((x) => x.classList.toggle('active', x === t));
    renderAdequacy();
  }));

  // Provenance popover — user directive: words + simple math, never code.
  // The raw provenance object is NOT rendered; basis_templates (glossary.json)
  // explain the machine basis string in plain language.
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-prov]');
    if (b) {
      const p = JSON.parse(decodeURIComponent(b.dataset.prov));
      document.getElementById('provTitle').textContent = 'Why this number?';
      document.getElementById('provBody').innerHTML = renderExplanation(p);
      document.getElementById('provPop').classList.add('open');
      return;
    }
    // Glossary term click → expandable definition panel (azaraki: not hover).
    const term = ev.target.closest('[data-term]');
    if (term) {
      const def = document.getElementById('glossDef');
      const t = (GLOSSARY?.terms || []).find((x) => x.term === term.dataset.term);
      if (!t) return;
      if (def.dataset.term === t.term && def.classList.contains('open')) {
        def.classList.remove('open');
        return;
      }
      def.dataset.term = t.term;
      def.classList.add('open');
      def.innerHTML = `<div class="gloss-def-head"><b>${escapeHtml(t.term)}</b>${t.short ? ` — ${escapeHtml(t.short)}` : ''}</div>${t.long ? `<div class="gloss-def-long">${escapeHtml(t.long)}</div>` : ''}${t.simple_math ? `<div class="gloss-def-math">${escapeHtml(t.simple_math)}</div>` : ''}`;
    }
  });
  document.getElementById('provClose').addEventListener('click', () => {
    document.getElementById('provPop').classList.remove('open');
  });

  // First render: offline-first from local aggregates.
  renderToday();
  renderAdequacy();
  // Glossary for plain-language explanations (user directive: words, not code).
  try {
    const gr = await fetch('src/glossary.json', { cache: 'no-store' });
    if (gr.ok) GLOSSARY = await gr.json();
  } catch { /* glossary unavailable — explanations fall back to honest note */ }
  // Demo mode bootstrap (GH Pages): load the captured fixture BEFORE any
  // sync so first paint uses real engine output, not a dead fetch.
  // Guard: only on non-local hosts (GH Pages) — localhost:3001 keeps the
  // live-API dev experience. `?demo` forces it anywhere.
  const demoHost = !['127.0.0.1', 'localhost'].includes(location.hostname);
  if (demoHost || location.search.includes('demo')) {
    try {
      const r = await fetch('demo/fixture.json', { cache: 'no-store' });
      if (r.ok) {
        DEMO_FIXTURE = await r.json();
        DEMO = true;
        const fp = DEMO_FIXTURE.profile;
        store.setProfile({ userId: fp.userId, version: fp.version, snapshot: fp.snapshot });
        store.setAggregates({ 7: DEMO_FIXTURE.adequacy, 30: DEMO_FIXTURE.adequacy });
        const st = document.getElementById('syncState');
        if (st) st.textContent = 'demo';
        // Honest review surface (azaraki): generation time + source visible.
        const meta = DEMO_FIXTURE.meta || {};
        const foot = document.getElementById('appFooter');
        const footText = document.getElementById('footnoteText');
        if (foot && footText) {
          footText.textContent = `Demo data · generated ${meta.generated || 'unknown'} · ${meta.source || 'captured from engine'} · standards: ${meta.standards || 'NASEM'}`;
          foot.hidden = false;
        }
      }
    } catch { /* not demo — normal offline-first boot */ }
  }
  sync();
});
