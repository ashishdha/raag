// ============================================================
// UTILS.JS — Shared notation, svar and chord display utilities
// Loaded before page-specific JS on every page.
// ============================================================

const SUPABASE_URL      = 'https://cxjfqwnmabyabhjhadjy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amZxd25tYWJ5YWJoamhhZGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Njc2NDUsImV4cCI6MjA3MTU0MzY0NX0.qbI-CU_wgAioBihGx54RXpr4cBryhzIjc4C8iT5YAX0';

const SUPABASE_HEADERS = {
  apikey:        SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
};

const ROOT_NONE = -111;

// ── CHORD NAMES ───────────────────────────────────────────────
const CHORD_NAMES = [
  'Maj','m','aug','dim','sus4','sus2',
  '7','Maj7','m7','mMaj7','7sus4','m7b5','dim7','aug7',
  'augMaj7','Maj6','m6',
  'Maj7sus4','7sus2','Maj7sus2',
  '9','11','13','Maj9','Maj11','Maj13',
  'm9','m11','m13','mMaj9','mMaj11','mMaj13',
  '9sus4','Maj9sus4','power',
  'add6','addb9','add9','addb10','add11','add#11',
  'addb13','add13','add14',
  'no5','b5','#5'
];

function chordName(id) {
  if (id === null || id === undefined) return '?';
  if (id === ROOT_NONE) return '(rootless)';
  return CHORD_NAMES[id] ?? `[${id}]`;
}

// ── NOTATION LOOKUP TABLES ────────────────────────────────────
// pitchTable[notationKey][pc 0-12]  = base display string
// octaveTable[notationKey][octaveId] = marker string
//   octaveId: -2 = double lower, -1 = lower, 0 = middle (empty), 1 = upper, 2 = double upper
//   Marker placement: positive octave → append after base; negative → prepend before base
const pitchTable  = {};
const octaveTable = {};

// Notation system name → pitchclasses column name
const NOTATION_KEYS = {
  'Hindustaanee Sargam':    'sargam',
  'Integers (0-11)':         'id',
  'Scale Degrees (Jazz)':    'scale_degrees',
  'Western Notation (in C)': 'western_letter_note',
  'Carnatic Sargam':         'carnatic_sargam'
};

// pitchclasses column → octaves column
const OCTAVE_COL = {
  sargam:             'hindustaanee_symbol',
  id:                 null,               // integer mode uses raw value, no markers
  scale_degrees:      'scale_degrees',
  western_letter_note:'western_symbol',
  carnatic_sargam:    'carnatic_symbol'
};

let currentNotationKey = 'sargam';

// ── FETCH NOTATION DATA ───────────────────────────────────────
// Fetches pitchclasses (rows 0-12) and octaves (rows -2..2) in parallel.
async function fetchNotationData() {
  const [pcRows, octaveRows] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/pitchclasses?select=id,sargam,scale_degrees,western_letter_note,carnatic_sargam&order=id.asc`,
      { headers: SUPABASE_HEADERS }
    ).then(r => r.json()),
    fetch(
      `${SUPABASE_URL}/rest/v1/octaves?select=id,hindustaanee_symbol,western_symbol,carnatic_symbol,scale_degrees&order=id.asc`,
      { headers: SUPABASE_HEADERS }
    ).then(r => r.json())
  ]);

  // Build pitchTable for each notation system (rows 0-12)
  for (const colName of Object.values(NOTATION_KEYS)) {
    pitchTable[colName] = {};
    for (const row of pcRows) {
      if (row.id < 0 || row.id > 12) continue;
      pitchTable[colName][row.id] = String(row[colName] ?? row.id);
    }
  }

  // Build octaveTable (rows -2, -1, 0, 1, 2)
  for (const colName of Object.values(NOTATION_KEYS)) {
    const symCol = OCTAVE_COL[colName];
    octaveTable[colName] = {};
    for (const row of octaveRows) {
      octaveTable[colName][row.id] = symCol ? String(row[symCol] ?? '') : '';
    }
  }
}

// ── SET NOTATION SYSTEM ───────────────────────────────────────
function setNotation(systemName) {
  currentNotationKey = NOTATION_KEYS[systemName] ?? 'sargam';
}

// ── CORE SVAR NAME FUNCTION ───────────────────────────────────
// Converts any integer svar value to a display string.
//
// Integer mode: shows the raw integer (e.g. 14 stays "14") so voiced
// chord intervals like [0,4,7,11,14] remain unambiguous.
//
// All other modes:
//   0-12  → direct lookup in pitchTable (covers S through N and S')
//   13-23 → pc lookup + octave 1 marker appended (e.g. 13=r')
//   24-35 → pc lookup + octave 2 marker appended (e.g. 24=S'')
//   -1..-12 → octave -1 marker prepended + pc lookup (e.g. -1=N,)
//   -13..-24 → octave -2 marker prepended + pc lookup
//
// Octave marker placement: positive octave → after; negative → before.

function svarName(n) {
  if (n === null || n === undefined) return '?';

  const key = currentNotationKey;

  // Integer mode: raw value, no symbol conversion
  if (key === 'id') {
    return String(n);
  }

  const table  = pitchTable[key];
  const oTable = octaveTable[key];

  if (!table) return String(n);

  // Direct lookup for 0-12 (pitchclasses table rows cover these exactly)
  if (n >= 0 && n <= 12 && table[n] !== undefined) {
    return table[n];
  }

  // For values outside 0-12: derive pitch class and octave
  // Math.floor handles negative values correctly:
  //   floor(-1/12) = -1, floor(-12/12) = -1, floor(-13/12) = -2
  //   floor(13/12) = 1,  floor(23/12)  = 1,  floor(24/12)  = 2
  const pc     = ((n % 12) + 12) % 12;
  const octave = Math.floor(n / 12);

  // Get base symbol — for pc=0 at octave>1, use the octave-0 S symbol
  const base = table[pc] ?? String(pc);

  if (octave === 0) return base;

  // Clamp octave id to -2..2 for table lookup (beyond that, repeat symbol)
  const clampedOct = Math.max(-2, Math.min(2, octave));
  const marker     = oTable?.[clampedOct] ?? (octave > 0 ? "'".repeat(Math.abs(clampedOct)) : "'".repeat(Math.abs(clampedOct)));

  return octave > 0 ? base + marker : marker + base;
}

// ── EMPTY CHECK ───────────────────────────────────────────────
function isEmpty(val) {
  if (val === null || val === undefined) return true;
  if (!Array.isArray(val)) return false;
  if (val.length === 0) return true;
  return val.every(v => Array.isArray(v) && v.length === 0);
}

// ── SIGN CLASS ────────────────────────────────────────────────
function signClass(n) {
  if (n > 0) return 'cell-pos';
  if (n < 0) return 'cell-neg';
  return 'cell-zero';
}

// ── VIOLATIONS CLASS ──────────────────────────────────────────
function violClass(v) {
  if (v === 0) return 'cell-viol-0';
  if (v <= 3)  return 'cell-viol-1';
  if (v <= 6)  return 'cell-viol-4';
  return 'cell-viol-7';
}

// ── AGGREGATE CHORD RENDERER ──────────────────────────────────
function renderAggregateChordArr(arr) {
  if (!arr || arr.length === 0) return '—';
  let base = '', upper = '', add = '', qual = '';
  for (const comp of arr) {
    if (!comp || comp.length === 0) continue;
    const type = comp[0];
    if (type === 0 || type === 1) {
      const rootInt = comp[1];
      const root    = rootInt === ROOT_NONE ? '(rl)'
                    : rootInt === 0         ? svarName(0)
                    :                         svarName(rootInt);
      const name = root + '-' + chordName(comp[2]);
      if (type === 1) upper = name; else base = name;
    } else if (type === 2) {
      add  = comp.slice(1).map(chordName).join(' ');
    } else if (type === 3) {
      qual = comp.slice(1).map(chordName).join('');
    }
  }
  let result = upper ? `${upper} / ${base}` : base;
  result += qual;
  if (add) result += ' ' + add;
  return result || '—';
}

// ── NOTATION UPDATE ───────────────────────────────────────────
// Repaints all notation-dependent cells after a notation system change.
// Only updates textContent (repaint), never modifies layout (no reflow).
// Fast even for 4096 rows — tested under 100ms on modern browsers.

function updateAllPitchCells() {

  // ── Flat pitch arrays: aaroh, imperfect, detached svarsthaan
  // data-pitches="0,2,4,5,7,9,11,12"  data-sep=" "
  document.querySelectorAll('[data-pitches]').forEach(el => {
    const raw = el.getAttribute('data-pitches');
    if (!raw || raw === '') { el.textContent = '—'; return; }
    const sep  = el.getAttribute('data-sep') ?? ' ';
    const nums = raw.split(',').map(Number).filter(n => !isNaN(n));
    el.textContent = nums.length === 0 ? '—' : nums.map(svarName).join(sep);
  });

  // ── Saa chords: voiced pitch arrays, values can exceed 12
  // data-saachords='[[0,4,7],[0,5,7,11,14],...]'
  // Each sub-array is one chord voicing — values are semitone offsets above Sa
  document.querySelectorAll('[data-saachords]').forEach(el => {
    const raw = el.getAttribute('data-saachords');
    if (!raw) { el.textContent = '—'; return; }
    try {
      const arr = JSON.parse(raw);
      if (isEmpty(arr)) { el.textContent = '—'; return; }
      el.textContent = arr.map(ch =>
        Array.isArray(ch) && ch.length > 0
          ? '[' + ch.map(svarName).join(',') + ']'
          : null
      ).filter(Boolean).join(' ') || '—';
    } catch { el.textContent = '—'; }
  });

  // ── Saa chord names: [[rootInt, chordId, inversionIndex], ...]
  // rootInt is a pitch class 0-11 (which note is the chord root)
  document.querySelectorAll('[data-saachordnames]').forEach(el => {
    const raw = el.getAttribute('data-saachordnames');
    if (!raw) { el.textContent = '—'; return; }
    try {
      const arr = JSON.parse(raw);
      if (isEmpty(arr)) { el.textContent = '—'; return; }
      el.textContent = arr.map(m => {
        if (!Array.isArray(m) || m.length < 3) return null;
        const root = m[0] === ROOT_NONE ? '(rl)' : svarName(m[0]);
        return `${root}-${chordName(m[1])} inv${m[2]}`;
      }).filter(Boolean).join(' | ') || '—';
    } catch { el.textContent = '—'; }
  });

  // ── Aggregate chord: [[componentType, ...], ...]
  document.querySelectorAll('[data-aggch]').forEach(el => {
    const raw = el.getAttribute('data-aggch');
    if (!raw) { el.textContent = '—'; return; }
    try {
      el.textContent = renderAggregateChordArr(JSON.parse(raw));
    } catch { el.textContent = '—'; }
  });

  // ── Chords per root note: [[chordId,...], ...]  + binary scale for note names
  // data-chords='[[...],...]'  data-binary='[1,0,1,...]'
  document.querySelectorAll('[data-chords]').forEach(el => {
    const chordsRaw = el.getAttribute('data-chords');
    const binRaw    = el.getAttribute('data-binary');
    if (!chordsRaw) { el.textContent = '—'; return; }
    try {
      const arr    = JSON.parse(chordsRaw);
      const binary = binRaw ? JSON.parse(binRaw) : null;
      if (isEmpty(arr)) { el.textContent = '—'; return; }
      const presentNotes = [];
      if (binary) binary.forEach((b,i) => { if (b === 1) presentNotes.push(i); });
      const parts = arr.map((chArr, idx) => {
        if (!chArr || chArr.length === 0) return null;
        const note = presentNotes[idx] !== undefined ? svarName(presentNotes[idx]) : `[${idx}]`;
        return `${note}: ${chArr.map(chordName).join(',')}`;
      }).filter(Boolean);
      el.textContent = parts.length === 0 ? '—' : parts.join(' | ');
    } catch { el.textContent = '—'; }
  });

  // ── Chain cells: [[noteInt, ...], ...]  — pitch classes 0-11
  document.querySelectorAll('[data-chains]').forEach(el => {
    const raw = el.getAttribute('data-chains');
    if (!raw) { el.textContent = '—'; return; }
    try {
      const arr = JSON.parse(raw);
      if (isEmpty(arr)) { el.textContent = '—'; return; }
      el.textContent = arr.map(ch =>
        Array.isArray(ch) ? ch.map(svarName).join('→') : null
      ).filter(Boolean).join(' | ') || '—';
    } catch { el.textContent = '—'; }
  });
}
