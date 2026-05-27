// ============================================================
// SCALES.JS — depends on utils.js (loaded first)
// ============================================================

// ── COLUMN VISIBILITY SETS (cumulative) ──────────────────────
const COL_LEVELS = {
  Minimum:    ['col-aaroh','col-thaat','col-shuddh','col-moor'],
  Contracted: ['col-id','col-jaati','col-ang','col-samp'],
  Standard:   ['col-samm','col-imp','col-det','col-sym','col-pac','col-saach','col-aggch'],
  Expanded:   ['col-lgap','col-sgap','col-gac','col-saachn','col-chords','col-svc','col-poor','col-utt'],
  Maximum:    ['col-consec','col-saa','col-both','col-lpac','col-pacc','col-lgac','col-gacc','col-int','col-bin','col-viol']
};
const COL_LEVEL_ORDER = ['Minimum','Contracted','Standard','Expanded','Maximum'];

// ── LOOKUP MAPS ───────────────────────────────────────────────
let thaatMap      = {};
let tetrachordMap = {};

// ── STATE ─────────────────────────────────────────────────────
let allRows  = [];
let filtered = [];
let rowNodes = [];
let sortCol  = 'id';
let sortDir  = 1;

let prefs = {
  notation:       'Hindustaanee Sargam',
  columnsVisible: 'Contracted',
  filterPreset:   'Normal'
};

// ── LOCALSTORAGE ──────────────────────────────────────────────
const LS_KEY = 'raagdb_prefs';

function loadPrefs() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) Object.assign(prefs, JSON.parse(saved));
  } catch { /* ignore */ }
}

function savePrefs() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ── FETCH ─────────────────────────────────────────────────────
async function fetchAll(table, select = '*', order = 'id.asc') {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&order=${order}&offset=${from}&limit=${PAGE}`,
      { headers: SUPABASE_HEADERS }
    );
    if (!res.ok) { console.error(`Fetch ${table}:`, res.status); break; }
    const page = await res.json();
    all = all.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchSmall(table, select = '*', order = 'id.asc') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${select}&order=${order}`,
    { headers: SUPABASE_HEADERS }
  );
  if (!res.ok) { console.error(`Fetch ${table}:`, res.status); return []; }
  return res.json();
}

// ── DISPLAY HELPERS ───────────────────────────────────────────

function binaryToString(arr) {
  if (!arr || arr.length === 0) return '—';
  return arr.join('');
}

function intervalsToString(arr) {
  if (!arr || arr.length === 0) return '—';
  return arr.join(' ');
}

function thaatDisplay(thaatId) {
  const t = thaatMap[thaatId];
  if (!t) return thaatId ?? '—';
  return `${thaatId} · ${t.name}`;
}

function dashIfNeg(val) {
  if (val === null || val === undefined) return '—';
  if (val === -1) return '—';
  return val;
}

// ── BUILD ROW HTML ────────────────────────────────────────────
// All notation-dependent cells store their raw data in data-* attributes.
// updateAllPitchCells() in utils.js reads those and updates textContent
// on notation change — repaint only, no reflow.
//
// IMPORTANT: JSON data attributes must use single-quote delimiters
// so that the JSON double-quotes nest safely inside without escaping.

function buildRowHTML(r) {
  const aarohPitches   = (r.aaroh ?? []).join(',');
  const impPitches     = (r.imperfect_svarsthaan ?? []).join(',');
  const detPitches     = (r.detached_svarsthaan  ?? []).join(',');
  const paChJSON       = JSON.stringify(r.saa_pa_chains   ?? []);
  const gaChJSON       = JSON.stringify(r.saa_ga_chains   ?? []);
  // saa_chords: 2D array [[pc,pc,...], ...] — use data-saachords not data-pitches
  const saaChordsJSON  = JSON.stringify(r.saa_chords      ?? []);
  const saaChNamesJSON = JSON.stringify(r.saa_chord_names ?? []);
  const aggChJSON      = JSON.stringify(r.aggregate_chord ?? []);
  const chordsJSON     = JSON.stringify(r.chords          ?? []);
  const binJSON        = JSON.stringify(r.binary_scale    ?? []);

  // Initial display using current notation system
  const aarohDisp = isEmpty(r.aaroh) ? '—' : r.aaroh.map(svarName).join(' ');
  const impDisp   = isEmpty(r.imperfect_svarsthaan) ? '—' : r.imperfect_svarsthaan.map(svarName).join(' ');
  const detDisp   = isEmpty(r.detached_svarsthaan)  ? '—' : r.detached_svarsthaan.map(svarName).join(' ');

  const paChDisp  = isEmpty(r.saa_pa_chains) ? '—'
    : r.saa_pa_chains.map(ch => ch.map(svarName).join('→')).join(' | ');

  const gaChDisp  = isEmpty(r.saa_ga_chains) ? '—'
    : r.saa_ga_chains.map(ch => ch.map(svarName).join('→')).join(' | ');

  // saa_chords: each sub-array is a voiced chord; values can exceed 12
  const saaChordsDisp = isEmpty(r.saa_chords) ? '—'
    : r.saa_chords.map(ch =>
        Array.isArray(ch) && ch.length > 0
          ? '[' + ch.map(svarName).join(',') + ']'
          : null
      ).filter(Boolean).join(' ') || '—';

  const saaChNamesDisp = isEmpty(r.saa_chord_names) ? '—'
    : r.saa_chord_names.map(m => {
        if (!Array.isArray(m) || m.length < 3) return null;
        const root = m[0] === ROOT_NONE ? '(rl)' : svarName(m[0]);
        return `${root}-${chordName(m[1])} inv${m[2]}`;
      }).filter(Boolean).join(' | ') || '—';

  const aggChDisp = renderAggregateChordArr(r.aggregate_chord);

  const chordsDisp = isEmpty(r.chords) ? '—' : (() => {
    const presentNotes = [];
    if (r.binary_scale) r.binary_scale.forEach((b,i) => { if (b === 1) presentNotes.push(i); });
    const parts = r.chords.map((chArr, idx) => {
      if (!chArr || chArr.length === 0) return null;
      const note = presentNotes[idx] !== undefined ? svarName(presentNotes[idx]) : `[${idx}]`;
      return `${note}: ${chArr.map(chordName).join(',')}`;
    }).filter(Boolean);
    return parts.length === 0 ? '—' : parts.join(' | ');
  })();

  return `
    <td class="col-id cell-id">${r.id}</td>
    <td class="col-aaroh cell-aaroh" data-pitches="${aarohPitches}" data-sep=" ">${aarohDisp}</td>
    <td class="col-jaati cell-num">${r.jaati ?? '—'}</td>
    <td class="col-consec cell-num">${r.consecutive_varjit_svar ?? '—'}</td>
    <td class="col-saa cell-num">${r.saa_present ?? '—'}</td>
    <td class="col-both cell-num">${r.both_variants ?? '—'}</td>
    <td class="col-ang ${signClass(r.ang_balance)}">${r.ang_balance ?? '—'}</td>
    <td class="col-thaat cell-thaat">${thaatDisplay(r.thaat)}</td>
    <td class="col-shuddh cell-num">${r.shuddhataa_rank ?? '—'}</td>
    <td class="col-samp cell-num">${r.samvaad_at_pa != null ? r.samvaad_at_pa.toFixed(4) : '—'}</td>
    <td class="col-samm cell-num">${r.samvaad_at_ma != null ? r.samvaad_at_ma.toFixed(4) : '—'}</td>
    <td class="col-pac cell-json" data-chains='${paChJSON}'>${paChDisp}</td>
    <td class="col-lpac cell-num">${dashIfNeg(r.largest_saa_pa_chain)}</td>
    <td class="col-pacc cell-num">${r.saa_pa_chains_count ?? '—'}</td>
    <td class="col-gac cell-json" data-chains='${gaChJSON}'>${gaChDisp}</td>
    <td class="col-lgac cell-num">${dashIfNeg(r.largest_saa_ga_chain)}</td>
    <td class="col-gacc cell-num">${r.saa_ga_chains_count ?? '—'}</td>
    <td class="col-lgap cell-num">${r.largest_gap ?? '—'}</td>
    <td class="col-sgap cell-num">${r.smallest_gap === 999 ? '—' : (r.smallest_gap ?? '—')}</td>
    <td class="col-moor cell-num">${r.moorchhanaa_family ?? '—'}</td>
    <td class="col-saach cell-json" data-saachords='${saaChordsJSON}'>${saaChordsDisp}</td>
    <td class="col-saachn cell-json" data-saachordnames='${saaChNamesJSON}'>${saaChNamesDisp}</td>
    <td class="col-aggch cell-json" data-aggch='${aggChJSON}'>${aggChDisp}</td>
    <td class="col-chords cell-json" data-chords='${chordsJSON}' data-binary='${binJSON}'>${chordsDisp}</td>
    <td class="col-imp cell-json" data-pitches="${impPitches}" data-sep=" ">${impDisp}</td>
    <td class="col-det cell-json" data-pitches="${detPitches}" data-sep=" ">${detDisp}</td>
    <td class="col-sym cell-num">${r.symmetry ?? '—'}</td>
    <td class="col-svc cell-num">${r.svarsthaan_count ?? '—'}</td>
    <td class="col-poor cell-num">${r.poorvaang_size ?? '—'}</td>
    <td class="col-utt cell-num">${r.uttaraang_size ?? '—'}</td>
    <td class="col-int cell-json">${intervalsToString(r.intervals)}</td>
    <td class="col-bin cell-binary">${binaryToString(r.binary_scale)}</td>
    <td class="col-viol ${violClass(r.violations)}">${r.violations ?? '—'}</td>
  `;
}

// ── BUILD ALL ROWS ONCE ───────────────────────────────────────
function buildAllRows() {
  const frag = document.createDocumentFragment();
  rowNodes = allRows.map(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = buildRowHTML(r);
    tr.style.contentVisibility    = 'auto';
    tr.style.containIntrinsicSize = '0 28px';
    frag.appendChild(tr);
    return tr;
  });
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  tbody.appendChild(frag);
}

// ── COLUMN VISIBILITY ─────────────────────────────────────────
function applyColumnVisibility(levelName) {
  const visibleSet = new Set();
  for (const level of COL_LEVEL_ORDER) {
    for (const cls of COL_LEVELS[level]) visibleSet.add(cls);
    if (level === levelName) break;
  }
  document.querySelectorAll('th, td').forEach(el => {
    const cls = Array.from(el.classList).find(c => c.startsWith('col-'));
    if (!cls) return;
    el.style.display = visibleSet.has(cls) ? '' : 'none';
  });
  prefs.columnsVisible = levelName;
  savePrefs();
  updateMenuHighlight('columns', levelName);
}

// ── FILTER HELPERS ────────────────────────────────────────────
function numericFilter(rowVal, op, valStr) {
  if (valStr === '' || valStr === null || valStr === undefined) return true;
  const v = parseFloat(valStr);
  if (isNaN(v)) return true;
  if (op === 'exactly') return rowVal === v;
  if (op === 'lte')     return rowVal <= v;
  if (op === 'gte')     return rowVal >= v;
  return true;
}

const SVAR_LETTER_MAP = {
  'S':0,'r':1,'R':2,'g':3,'G':4,'M':5,"m'":6,'m':6,
  'P':7,'d':8,'D':9,'n':10,'N':11
};

function parseSearchTokens(raw) {
  if (!raw || raw.trim() === '') return [];
  return raw.trim().split(/[\s,]+/).filter(Boolean).map(t => {
    const n = parseInt(t);
    if (!isNaN(n)) return ((n % 12) + 12) % 12;
    return SVAR_LETTER_MAP[t] ?? null;
  }).filter(v => v !== null);
}

function getVal(id) { return document.getElementById(id)?.value ?? ''; }

// ── APPLY FILTERS ─────────────────────────────────────────────
function applyFilters() {
  const svarPCs   = parseSearchTokens(getVal('svarSearch'));
  const varjitPCs = parseSearchTokens(getVal('varjitSearch'));
  const vVal      = getVal('violationsVal');
  const consecOp  = getVal('consecOp');
  const consecVal = getVal('consecVal');
  const bOp       = getVal('bothVariantsOp');
  const bVal      = getVal('bothVariantsVal');
  const jOp       = getVal('jaatiOp');
  const jVal      = getVal('jaatiVal');
  const vikOp     = getVal('vikritOp');
  const vikVal    = getVal('vikritVal');
  const angMin    = getVal('angMin');
  const angMax    = getVal('angMax');
  const sampOp    = getVal('sampOp');
  const sampVal   = getVal('sampVal');
  const sammOp    = getVal('sammOp');
  const sammVal   = getVal('sammVal');
  const symOp     = getVal('symOp');
  const symVal    = getVal('symVal');
  const lpacOp    = getVal('lpacOp');
  const lpacVal   = getVal('lpacVal');
  const paccOp    = getVal('paccOp');
  const paccVal   = getVal('paccVal');
  const lgacOp    = getVal('lgacOp');
  const lgacVal   = getVal('lgacVal');
  const gaccOp    = getVal('gaccOp');
  const gaccVal   = getVal('gaccVal');
  const lgapOp    = getVal('lgapOp');
  const lgapVal   = getVal('lgapVal');
  const sgapOp    = getVal('sgapOp');
  const sgapVal   = getVal('sgapVal');
  const impOp     = getVal('impOp');
  const impVal    = getVal('impVal');
  const detOp     = getVal('detOp');
  const detVal    = getVal('detVal');
  const svcOp     = getVal('svcOp');
  const svcVal    = getVal('svcVal');
  const poorOp    = getVal('poorOp');
  const poorVal   = getVal('poorVal');
  const uttOp     = getVal('uttOp');
  const uttVal    = getVal('uttVal');

  const thaatChecks    = document.querySelectorAll('.thaat-check:checked');
  const allThaatChecks = document.querySelectorAll('.thaat-check');
  const selectedThaats = thaatChecks.length === allThaatChecks.length
    ? null
    : new Set(Array.from(thaatChecks).map(cb => parseInt(cb.value)));

  filtered = allRows.filter(row => {
    const aarohPCs = (row.aaroh ?? []).map(n => ((n % 12) + 12) % 12);

    if (svarPCs.length > 0   && !svarPCs.every(pc   => aarohPCs.includes(pc)))  return false;
    if (varjitPCs.length > 0 && !varjitPCs.every(pc => !aarohPCs.includes(pc))) return false;

    if (vVal !== 'any' && vVal !== '' && row.violations !== parseInt(vVal)) return false;

    // Consecutive varjit svar: op+val pair (lte is most musically useful default)
    if (!numericFilter(row.consecutive_varjit_svar, consecOp, consecVal)) return false;

    if (!numericFilter(row.both_variants, bOp, bVal)) return false;
    if (!numericFilter(row.jaati, jOp, jVal))          return false;

    if (vikVal !== '') {
      const vikrit = thaatMap[row.thaat]?.vikrit_svar ?? null;
      if (vikrit === null || !numericFilter(vikrit, vikOp, vikVal)) return false;
    }

    if (selectedThaats !== null && !selectedThaats.has(row.thaat)) return false;

    if (angMin !== '' && row.ang_balance < parseInt(angMin)) return false;
    if (angMax !== '' && row.ang_balance > parseInt(angMax)) return false;

    if (!numericFilter(row.samvaad_at_pa, sampOp, sampVal)) return false;
    if (!numericFilter(row.samvaad_at_ma, sammOp, sammVal)) return false;
    if (!numericFilter(row.symmetry,      symOp,  symVal))  return false;

    const lpacEff = row.largest_saa_pa_chain === -1 ? 0 : (row.largest_saa_pa_chain ?? 0);
    if (!numericFilter(lpacEff, lpacOp, lpacVal)) return false;
    if (!numericFilter(row.saa_pa_chains_count, paccOp, paccVal)) return false;

    const lgacEff = row.largest_saa_ga_chain === -1 ? 0 : (row.largest_saa_ga_chain ?? 0);
    if (!numericFilter(lgacEff, lgacOp, lgacVal)) return false;
    if (!numericFilter(row.saa_ga_chains_count, gaccOp, gaccVal)) return false;

    if (!numericFilter(row.largest_gap, lgapOp, lgapVal)) return false;
    const sgapEff = row.smallest_gap === 999 ? 0 : (row.smallest_gap ?? 0);
    if (!numericFilter(sgapEff, sgapOp, sgapVal)) return false;

    if (!numericFilter((row.imperfect_svarsthaan ?? []).length, impOp, impVal)) return false;
    if (!numericFilter((row.detached_svarsthaan  ?? []).length, detOp, detVal)) return false;
    if (!numericFilter(row.svarsthaan_count, svcOp, svcVal))   return false;
    if (!numericFilter(row.poorvaang_size,   poorOp, poorVal)) return false;
    if (!numericFilter(row.uttaraang_size,   uttOp,  uttVal))  return false;

    return true;
  });

  sortRows();
  requestAnimationFrame(() => {
    applySortOrder();
    applyVisibility();
    document.getElementById('rowCount').textContent = filtered.length.toLocaleString();
  });
}

// ── VISIBILITY & SORT ORDER ───────────────────────────────────
function applyVisibility() {
  const visibleIds = new Set(filtered.map(r => r.id));
  for (const tr of rowNodes) {
    const id = parseInt(tr.children[0].textContent);
    tr.hidden = !visibleIds.has(id);
  }
}

function applySortOrder() {
  const tbody    = document.getElementById('tableBody');
  const nodeById = {};
  for (const tr of rowNodes) {
    nodeById[parseInt(tr.children[0].textContent)] = tr;
  }
  const frag        = document.createDocumentFragment();
  const filteredIds = new Set(filtered.map(r => r.id));
  for (const r of filtered)  frag.appendChild(nodeById[r.id]);
  for (const tr of rowNodes) {
    const id = parseInt(tr.children[0].textContent);
    if (!filteredIds.has(id)) frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  document.querySelectorAll('th').forEach(th => {
    th.classList.remove('sort-asc','sort-desc');
    if (th.dataset.sort === col) th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
  });
  sortRows();
  requestAnimationFrame(applySortOrder);
}

function sortRows() {
  filtered.sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (av === null || av === undefined) av = -Infinity;
    if (bv === null || bv === undefined) bv = -Infinity;
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });
}

// ── FILTER PRESETS ────────────────────────────────────────────
// Each preset sets DOM elements directly so the UI always reflects
// what is currently being applied — both on preset selection and on load.

function clearAllFilters() {
  // Text search inputs
  document.getElementById('svarSearch').value    = '';
  document.getElementById('varjitSearch').value  = '';

  // Single-value dropdowns
  document.getElementById('violationsVal').value = 'any';

  // Consecutive varjit — op defaults to 'lte' (most musically useful)
  document.getElementById('consecOp').value      = 'lte';
  document.getElementById('consecVal').value     = '';

  // Numeric op+val pairs — op defaults to 'exactly', val cleared
  ['bothVariantsOp','jaatiOp','vikritOp',
   'sampOp','sammOp','symOp',
   'lpacOp','paccOp','lgacOp','gaccOp',
   'lgapOp','sgapOp','impOp','detOp',
   'svcOp','poorOp','uttOp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 'exactly';
  });

  ['bothVariantsVal','jaatiVal','vikritVal',
   'sampVal','sammVal','symVal',
   'lpacVal','paccVal','lgacVal','gaccVal',
   'lgapVal','sgapVal','impVal','detVal',
   'svcVal','poorVal','uttVal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Ang balance range
  document.getElementById('angMin').value = '';
  document.getElementById('angMax').value = '';

  // Thaat multi-select — check all
  document.querySelectorAll('.thaat-check').forEach(cb => cb.checked = true);
  const allCb = document.getElementById('thaatAll');
  if (allCb) allCb.checked = true;
}

const FILTER_PRESETS = {
  Anarchy: () => {			// 4096 (ALL)
    clearAllFilters();
  },
  Outliers: () => {			// 1872 (No Violations)
    clearAllFilters();
    document.getElementById('violationsVal').value = '0';
  },  
  Normal: () => {			// 414 (No BothVariants) !Display name is now 'Plausible'!
    clearAllFilters();
    document.getElementById('violationsVal').value   = '0';
    document.getElementById('bothVariantsOp').value  = 'lte';
    document.getElementById('bothVariantsVal').value = '0';
  },
  Easy: () => {				// 304 (Jaati atleast 5) !Display name is now 'Normal'!
    clearAllFilters();
    document.getElementById('violationsVal').value   = '0';
    document.getElementById('jaatiOp').value         = 'gte';
    document.getElementById('jaatiVal').value        = '5';
    document.getElementById('bothVariantsOp').value  = 'lte';
    document.getElementById('bothVariantsVal').value = '0';
  },
  Restrictive: () => {		// 112 (Consecutive Varjit max 1, Ang Balance 0) !Display name is now 'Easy'!
    clearAllFilters();
    document.getElementById('violationsVal').value   = '0';
    document.getElementById('jaatiOp').value         = 'gte';
    document.getElementById('jaatiVal').value        = '5';
    document.getElementById('bothVariantsOp').value  = 'lte';
    document.getElementById('bothVariantsVal').value = '0';
    document.getElementById('consecOp').value        = 'lte';
    document.getElementById('consecVal').value       = '1';
    document.getElementById('angMin').value          = '0';
    document.getElementById('angMax').value          = '0';
  }
};

function applyPreset(name) {
  if (!FILTER_PRESETS[name]) return;
  FILTER_PRESETS[name]();   // sets DOM elements
  applyFilters();            // runs filter with those DOM values
  prefs.filterPreset = name;
  savePrefs();
  updateMenuHighlight('preset', name);
}

// ── RESET ─────────────────────────────────────────────────────
function resetFilters() {
  clearAllFilters();
  filtered = [...allRows];
  sortRows();
  requestAnimationFrame(() => {
    applySortOrder();
    applyVisibility();
    document.getElementById('rowCount').textContent = filtered.length.toLocaleString();
  });
}

// ── ENTER KEY ─────────────────────────────────────────────────
function bindEnterKey(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') applyFilters(); });
  });
}

// ── FILTERS SHOW / HIDE ───────────────────────────────────────
function toggleFilters() {
  const panel  = document.getElementById('filtersPanel');
  const btn    = document.getElementById('toggleFiltersBtn');
  const hidden = panel.style.display === 'none';
  panel.style.display = hidden ? '' : 'none';
  btn.textContent     = hidden ? 'Hide Filters' : 'Show Filters';
}

// ── THAAT DROPDOWN ────────────────────────────────────────────
function buildThaatFilter() {
  const wrap = document.getElementById('thaatMultiWrap');
  wrap.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'thaat-dd-header';
  const allCb = document.createElement('input');
  allCb.type = 'checkbox'; allCb.id = 'thaatAll'; allCb.checked = true;
  allCb.addEventListener('change', () => {
    document.querySelectorAll('.thaat-check').forEach(cb => cb.checked = allCb.checked);
  });
  const allLbl = document.createElement('label');
  allLbl.htmlFor = 'thaatAll'; allLbl.textContent = 'All';
  header.appendChild(allCb); header.appendChild(allLbl);
  wrap.appendChild(header);

  const ids = Object.keys(thaatMap).map(Number).sort((a,b) => a-b);
  for (const id of ids) {
    const row = document.createElement('div');
    row.className = 'thaat-dd-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'thaat-check'; cb.value = id; cb.checked = true;
    cb.addEventListener('change', () => {
      const all     = document.querySelectorAll('.thaat-check');
      const checked = document.querySelectorAll('.thaat-check:checked');
      document.getElementById('thaatAll').checked = (all.length === checked.length);
    });
    const lbl = document.createElement('label');
    lbl.textContent = `${id} · ${thaatMap[id].name}`;
    row.appendChild(cb); row.appendChild(lbl);
    wrap.appendChild(row);
  }

  const trigger = document.getElementById('thaatTrigger');
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    wrap.classList.toggle('open');
  });
  document.addEventListener('click', () => wrap.classList.remove('open'));
  wrap.addEventListener('click', e => e.stopPropagation());
}

// ── PREFS MENU ────────────────────────────────────────────────
function buildPrefsMenu() {
  document.querySelectorAll('.pref-notation').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.value;
      setNotation(name);
      prefs.notation = name;
      savePrefs();
      updateMenuHighlight('notation', name);
      requestAnimationFrame(updateAllPitchCells);
    });
  });
  document.querySelectorAll('.pref-columns').forEach(el => {
    el.addEventListener('click', () => applyColumnVisibility(el.dataset.value));
  });
  document.querySelectorAll('.pref-preset').forEach(el => {
    el.addEventListener('click', () => applyPreset(el.dataset.value));
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.prefs-menu-wrap')) {
      document.getElementById('prefsDropdown').classList.remove('open');
    }
  });
}

function togglePrefsMenu(e) {
  e.stopPropagation();
  document.getElementById('prefsDropdown').classList.toggle('open');
}

function updateMenuHighlight(type, value) {
  const classMap = { notation:'pref-notation', columns:'pref-columns', preset:'pref-preset' };
  document.querySelectorAll(`.${classMap[type]}`).forEach(el => {
    el.classList.toggle('active', el.dataset.value === value);
  });
}

// ── FLOAT DROPDOWNS ──────────────────────────────────────────
function populateFloatDropdown(selectId, values) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">—</option>';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v % 1 === 0 ? String(v) : v.toFixed(4);
    sel.appendChild(opt);
  });
}

function buildFloatDropdowns() {
  const paValues  = [0, ...Array.from({length:7}, (_,i) => parseFloat(((i+1)*100/7).toFixed(6)))];
  const maValues  = [0, ...Array.from({length:8}, (_,i) => (i+1)*12.5)];
  const symValues = [0,20,40,60,80,100];
  populateFloatDropdown('sampVal', paValues);
  populateFloatDropdown('sammVal', maValues);
  populateFloatDropdown('symVal',  symValues);
}

// ── SHOW INITIAL SORT ARROW ───────────────────────────────────
function initSortArrow() {
  const idTh = document.querySelector('th[data-sort="id"]');
  if (idTh) idTh.classList.add('sort-asc');
}

// ── INIT ─────────────────────────────────────────────────────
(async () => {
  loadPrefs();
  setNotation(prefs.notation);

  // Fetch reference tables and notation data in parallel
  const [tetrachords, thaats] = await Promise.all([
    fetchSmall('tetrachords', 'id,name'),
    fetchSmall('thaats', 'id,vikrit_svar,poorvaang_tetrachord_id,uttaraang_tetrachord_id'),
    fetchNotationData()   // third promise, result discarded — side effects only
  ]);

  for (const t of tetrachords) tetrachordMap[t.id] = t.name;

  for (const t of thaats) {
    const pName = tetrachordMap[t.poorvaang_tetrachord_id] ?? `T${t.poorvaang_tetrachord_id}`;
    const uName = tetrachordMap[t.uttaraang_tetrachord_id] ?? `T${t.uttaraang_tetrachord_id}`;
    thaatMap[t.id] = { name: `${pName}–${uName}`, vikrit_svar: t.vikrit_svar };
  }

  buildThaatFilter();
  buildPrefsMenu();
  buildFloatDropdowns();
  initSortArrow();

  // Highlight saved prefs in menu
  updateMenuHighlight('notation', prefs.notation);
  updateMenuHighlight('columns',  prefs.columnsVisible);
  updateMenuHighlight('preset',   prefs.filterPreset);

  // Apply saved preset to DOM elements BEFORE fetching scales data
  // so all filter inputs show the correct state on pageload
  if (FILTER_PRESETS[prefs.filterPreset]) {
    FILTER_PRESETS[prefs.filterPreset]();
  }

  bindEnterKey(['svarSearch','varjitSearch','consecVal','bothVariantsVal','jaatiVal',
                'vikritVal','lpacVal','paccVal','lgacVal','gaccVal',
                'lgapVal','sgapVal','impVal','detVal','svcVal','poorVal','uttVal']);

  // Fetch all scales
  allRows  = await fetchAll('scales');
  filtered = [...allRows];
  sortRows();

  // Build all DOM rows once using current notation
  buildAllRows();

  // Apply column visibility from saved prefs
  applyColumnVisibility(prefs.columnsVisible);

  // Run filters (DOM already reflects preset state from above)
  applyFilters();
})();
