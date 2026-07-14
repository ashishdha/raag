(function(){

  const SUPABASE_URL = 'https://cxjfqwnmabyabhjhadjy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amZxd25tYWJ5YWJoamhhZGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Njc2NDUsImV4cCI6MjA3MTU0MzY0NX0.qbI-CU_wgAioBihGx54RXpr4cBryhzIjc4C8iT5YAX0';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ── static label tables ─────────────────────────────────────────
  const DIMENSION_LABELS   = { 1: 'Identical', 2: 'Different', 3: 'Vakra', 4: 'JoD', 5: 'Raagish' };
  const DIRECTION_LABELS   = { '-1': 'Aaroh', '0': 'Same in both', '1': 'Avaroh' };
  const SAA_ABSENCE_LABELS = { 0: 'Present in both', 1: 'Absent only in aaroh', 2: 'Absent only in avaroh', 3: 'Absent in both' };
  const GENERIC_SVAR_NAMES = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];
  const GENERIC_GROUP_OF_SPECIFIC = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]; // pitch-class 0-11 -> generic group 0-6

  const NOTATION_SYSTEMS = [
    { key: 'sargam',   column: 'sargam' },
    { key: 'integers', column: null },
    { key: 'jazz',     column: 'scale_degrees' },
    { key: 'western',  column: 'western_letter_note' },
    { key: 'carnatic', column: 'carnatic_sargam' }
  ];

  const TIER_RANK   = { minimum: 0, contracted: 1, standard: 2, expanded: 3, maximum: 4 };
  const TIER_LABELS = { minimum: 'Minimum', contracted: 'Contracted', standard: 'Standard', expanded: 'Expanded', maximum: 'Maximum' };

  // ── column registry: single source of truth for header, cells, sort, filter ──
  // preset = tier at which the column FIRST appears (cumulative upward).
  // filterable:false -> either has dedicated UI elsewhere, or isn't sensible to filter.
  const COLUMN_DEFS = [
    { key: 'scientific_id',              label: 'Scientific ID',          preset: 'contracted', type: 'scientific',   filterable: false },
    { key: 'id',                         label: 'Row ID',                 preset: 'maximum',    type: 'int',          filterable: false },
    { key: 'name',                       label: 'Name',                   preset: 'minimum',    type: 'text',         filterable: false },
    { key: 'aaroh',                      label: 'Aaroh',                  preset: 'minimum',    type: 'svar_specific', filterable: false },
    { key: 'avaroh',                     label: 'Avaroh',                 preset: 'minimum',    type: 'svar_specific', filterable: false },

    { key: 'thaat_id',                   label: 'Thaat',                  preset: 'contracted', type: 'fk', lookup: 'thaat', filterable: true },
    { key: 'aaroh_jaati',                label: 'Aaroh Jaati',            preset: 'contracted', type: 'int',          filterable: false },
    { key: 'avaroh_jaati',               label: 'Avaroh Jaati',           preset: 'contracted', type: 'int',          filterable: false },
    { key: 'shuddhataa_rank',            label: 'Shuddhataa Rank',        preset: 'contracted', type: 'float',        filterable: true },
    { key: 'samvaad_at_pa',              label: 'Samvaad at Pa',          preset: 'contracted', type: 'float',        filterable: true },

    { key: 'samvaad_at_ma',              label: 'Samvaad at Ma',          preset: 'standard',   type: 'float',        filterable: true },
    { key: 'symmetry_score',             label: 'Symmetry Score',         preset: 'standard',   type: 'int',          filterable: true },
    { key: 'dimension',                  label: 'Dimension',              preset: 'standard',   type: 'enum',         filterable: false, enumLabels: DIMENSION_LABELS },
    { key: 'ang_balance',                label: 'Ang Balance',            preset: 'standard',   type: 'int',          filterable: true },
    { key: 'saa_pa_chains',              label: 'Saa-Pa Chains',          preset: 'standard',   type: 'jsonb',        filterable: false },

    { key: 'saa_ga_chains',              label: 'Saa-Ga Chains',          preset: 'expanded',   type: 'jsonb',        filterable: false },
    { key: 'imperfect_svarsthaan',       label: 'Imperfect Svarsthaan',   preset: 'expanded',   type: 'svar_specific', filterable: true },
    { key: 'detached_svarsthaan',        label: 'Detached Svarsthaan',    preset: 'expanded',   type: 'svar_specific', filterable: true },
    { key: 'svarset',                    label: 'Svarset',                preset: 'expanded',   type: 'svar_specific', filterable: true },
    { key: 'moorchhanaa_family_id',      label: 'Moorchhanaa Family',     preset: 'expanded',   type: 'int',          filterable: true },
    { key: 'varjit_svar',                label: 'Varjit Svar',            preset: 'expanded',   type: 'svar_generic', filterable: true },
    { key: 'largest_jump',               label: 'Largest Jump',           preset: 'expanded',   type: 'int',          filterable: true },
    { key: 'largest_jump_direction',     label: 'Largest Jump Dir.',      preset: 'expanded',   type: 'enum',         filterable: true, enumLabels: DIRECTION_LABELS },
    { key: 'smallest_jump',              label: 'Smallest Jump',          preset: 'expanded',   type: 'int',          filterable: true },
    { key: 'smallest_jump_direction',    label: 'Smallest Jump Dir.',     preset: 'expanded',   type: 'enum',         filterable: true, enumLabels: DIRECTION_LABELS },

    { key: 'saa_absence',                label: 'Saa Absence',            preset: 'maximum',    type: 'enum',         filterable: true, enumLabels: SAA_ABSENCE_LABELS },
    { key: 'consecutive_varjit_svar',    label: 'Consec. Varjit Svar',    preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'both_variants',              label: 'Both Variants',          preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'aaroh_only_svar_count',      label: 'Aaroh-only Svar',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'avaroh_only_svar_count',     label: 'Avaroh-only Svar',       preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'jaati_difference',           label: 'Jaati Difference',       preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'lower_to_higher_variants',   label: 'Lower→Higher Var.',      preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'lower_to_both_variants',     label: 'Lower→Both Var.',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'both_to_higher_variants',    label: 'Both→Higher Var.',       preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'both_to_lower_variants',     label: 'Both→Lower Var.',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'higher_to_both_variants',    label: 'Higher→Both Var.',       preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'higher_to_lower_variants',   label: 'Higher→Lower Var.',      preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'common_svarsthaan',          label: 'Common Svarsthaan',      preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'common_svarsthaan_poorvaang',label: 'Common Svsth. Poorv.',   preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'common_svarsthaan_uttaraang',label: 'Common Svsth. Uttar.',   preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'common_svar',                label: 'Common Svar',            preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'common_svar_poorvaang',      label: 'Common Svar Poorv.',     preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'common_svar_uttaraang',      label: 'Common Svar Uttar.',     preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'largest_saa_pa_chain_size',  label: 'Largest Saa-Pa Chain',   preset: 'maximum',    type: 'int',          filterable: true, dashIfMinusOne: true },
    { key: 'saa_pa_chains_count',        label: 'Saa-Pa Chains Count',    preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'largest_saa_ga_chain_size',  label: 'Largest Saa-Ga Chain',   preset: 'maximum',    type: 'int',          filterable: true, dashIfMinusOne: true },
    { key: 'saa_ga_chains_count',        label: 'Saa-Ga Chains Count',    preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'family_root',                label: 'Family Root',            preset: 'maximum',    type: 'bool',         filterable: true },
    { key: 'imperfect_count',            label: 'Imperfect Count',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'detached_count',             label: 'Detached Count',         preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'varjit_svar_count',          label: 'Varjit Svar Count',      preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'svarsthaan_count',           label: 'Svarsthaan Count',       preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'poorvaang_count',            label: 'Poorvaang Count',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'uttaraang_count',            label: 'Uttaraang Count',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'aaroh_size',                 label: 'Aaroh Size',             preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'avaroh_size',                label: 'Avaroh Size',            preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'varjit_svar_aaroh',          label: 'Varjit Svar (Aaroh)',    preset: 'maximum',    type: 'svar_specific', filterable: true },
    { key: 'varjit_svar_avaroh',         label: 'Varjit Svar (Avaroh)',   preset: 'maximum',    type: 'svar_specific', filterable: true },
    { key: 'ang_balance_aaroh',          label: 'Ang Balance (Aaroh)',    preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'ang_balance_avaroh',         label: 'Ang Balance (Avaroh)',   preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'poorvaang_count_aaroh',      label: 'Poorvaang Ct. (Aaroh)',  preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'uttaraang_count_aaroh',      label: 'Uttaraang Ct. (Aaroh)',  preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'poorvaang_count_avaroh',     label: 'Poorvaang Ct. (Avaroh)', preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'uttaraang_count_avaroh',     label: 'Uttaraang Ct. (Avaroh)', preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'aaroh_id',                   label: 'Aaroh ID',               preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'avaroh_id',                  label: 'Avaroh ID',              preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'raag_id',                    label: 'Raag Instance #',        preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'svarset_id',                 label: 'Svarset ID',             preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'aaroh_number',               label: 'Aaroh #',                preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'avaroh_number',              label: 'Avaroh #',               preset: 'maximum',    type: 'int',          filterable: true },
    { key: 'ang_id',                     label: 'Ang',                    preset: 'maximum',    type: 'fk', lookup: 'ang', filterable: true },
    { key: 'samay_id',                   label: 'Samay',                  preset: 'maximum',    type: 'fk', lookup: 'samay', filterable: true },
    { key: 'taanpuraa_tuning',           label: 'Taanpuraa Tuning',       preset: 'maximum',    type: 'svar_specific', filterable: true },
    { key: 'creator_id',                 label: 'Creator',                preset: 'maximum',    type: 'fk', lookup: 'creator', filterable: true },
    { key: 'popularity_id',              label: 'Popularity',             preset: 'maximum',    type: 'fk', lookup: 'popularity', filterable: true },
    { key: 'carnatic_name',              label: 'Carnatic Name',          preset: 'maximum',    type: 'text',         filterable: true },
    { key: 'alternate_names',            label: 'Alternate Names',        preset: 'maximum',    type: 'text',         filterable: true },
    { key: 'notes',                      label: 'Notes',                  preset: 'maximum',    type: 'text',         filterable: true, truncate: true },
    { key: 'created_at',                 label: 'Created At',             preset: 'maximum',    type: 'date',         filterable: false }
  ];

  const COLUMN_BY_KEY = new Map(COLUMN_DEFS.map(c => [c.key, c]));
  const SELECT_COLUMNS = COLUMN_DEFS.map(c => c.key).join(',');

  // ── DOM refs ─────────────────────────────────────────────────
  const counterEl        = document.getElementById('counter');
  const tableHeadRow      = document.getElementById('table-head-row');
  const tableBody         = document.getElementById('table-body');
  const showingCountEl    = document.getElementById('showing-count');

  const menuBtn    = document.getElementById('menu-btn');
  const menuPanel  = document.getElementById('menu-panel');
  const menuDone   = document.getElementById('menu-done');
  const notationSelectEl = document.getElementById('notation-select');
  const columnsSelectEl  = document.getElementById('columns-select');
  const presetSelectEl   = document.getElementById('preset-select');

  const statusFilterEl    = document.getElementById('status-filter');
  const dimensionFilterEl = document.getElementById('dimension-filter');
  const aarohJaatiCompareEl  = document.getElementById('aaroh-jaati-compare');
  const aarohJaatiValueEl    = document.getElementById('aaroh-jaati-value');
  const avarohJaatiCompareEl = document.getElementById('avaroh-jaati-compare');
  const avarohJaatiValueEl   = document.getElementById('avaroh-jaati-value');
  const searchInputEl     = document.getElementById('search-input');

  const presentAarohInput  = document.getElementById('present-aaroh-input');
  const presentAvarohInput = document.getElementById('present-avaroh-input');
  const varjitAarohInput   = document.getElementById('varjit-aaroh-input');
  const varjitAvarohInput  = document.getElementById('varjit-avaroh-input');
  const presentAarohChipsEl  = document.getElementById('present-aaroh-chips');
  const presentAvarohChipsEl = document.getElementById('present-avaroh-chips');
  const varjitAarohChipsEl   = document.getElementById('varjit-aaroh-chips');
  const varjitAvarohChipsEl  = document.getElementById('varjit-avaroh-chips');
  const presentBothBtn = document.getElementById('present-both-toggle');
  const varjitBothBtn  = document.getElementById('varjit-both-toggle');

  const customBlockEl   = document.getElementById('custom-block');
  const addFilterBtn    = document.getElementById('add-filter-btn');
  const activeFiltersEl = document.getElementById('active-filters');
  const noFiltersNoteEl = document.getElementById('no-filters-note');

  const filterHintEl = document.getElementById('filter-hint');
  const applyBtn = document.getElementById('apply-btn');
  const resetBtn = document.getElementById('reset-btn');

  // ── state ────────────────────────────────────────────────────
  const lookupMaps = { thaat: new Map(), ang: new Map(), samay: new Map(), creator: new Map(), popularity: new Map() };
  let pcMaps = {};
  let pcReverse = new Map();
  let currentNotation = 'sargam';
  let rows = [];
  let presentBothOn = true;
  let varjitBothOn  = true;
  let activeFilters = [];
  let filterIdCounter = 0;
  let sortState = { key: null, dir: 'asc' };
  let emptyRow = null;

  // a single dynamically-populated stylesheet drives column-tier visibility —
  // far cheaper than touching every <td> in a many-thousand-row table.
  const tierStyleEl = document.createElement('style');
  document.head.appendChild(tierStyleEl);

  // ── generic helpers ──────────────────────────────────────────

  function pitchClass(v){ return ((v % 12) + 12) % 12; }

  function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function buildMasks(arr){
    let specific = 0, generic = 0;
    if (arr){
      for (const v of arr){
        const pc = pitchClass(v);
        specific |= (1 << pc);
        generic  |= (1 << GENERIC_GROUP_OF_SPECIFIC[pc]);
      }
    }
    return { specific, generic };
  }

  function buildGenericArrayMask(arr){
    let generic = 0;
    if (arr){ for (const v of arr){ generic |= (1 << v); } }
    return generic;
  }

  function parseInput(value){
    let specific = 0, generic = 0;
    const chips = [];
    for (const ch of value){
      const id = pcReverse.get(ch);
      if (id === undefined) continue;
      specific |= (1 << id);
      generic  |= (1 << GENERIC_GROUP_OF_SPECIFIC[id]);
      chips.push({ ch, komal: ch === ch.toLowerCase() });
    }
    return { specific, generic, chips };
  }

  function renderChips(container, chips){
    container.innerHTML = '';
    chips.forEach(c => {
      const span = document.createElement('span');
      span.className = 'chip ' + (c.komal ? 'komal' : 'shuddha');
      span.textContent = c.ch;
      container.appendChild(span);
    });
  }

  function getMode(radioName){
    const checked = document.querySelector('input[name="' + radioName + '"]:checked');
    return checked ? checked.value : 'specific';
  }
  function getInexMode(radioName){
    const checked = document.querySelector('input[name="' + radioName + '"]:checked');
    return checked ? checked.value : 'inclusive';
  }

  function jaatiMatches(compareEl, valueEl, actualValue){
    const val = valueEl.value;
    if (val === 'any') return true;
    if (actualValue === null || actualValue === undefined) return false;
    const target = parseInt(val, 10);
    if (compareEl.value === 'min') return actualValue >= target;
    if (compareEl.value === 'max') return actualValue <= target;
    return actualValue === target;
  }

  function svarToDisplay(rawValue){
    if (currentNotation === 'integers') return String(rawValue);
    const map = pcMaps[currentNotation];
    return (map && map.get(rawValue)) ?? '?';
  }
  function arrayToDisplayString(arr){
    if (!arr || !arr.length) return '—';
    return arr.map(v => svarToDisplay(v)).join(' ');
  }
  function genericArrayToDisplayString(arr){
    if (!arr || !arr.length) return '—';
    return arr.map(v => GENERIC_SVAR_NAMES[v] ?? '?').join(', ');
  }

  async function fetchAll(table, columns, order){
    const pageSize = 1000;
    let all = [];
    let from = 0;
    while (true){
      const { data, error } = await supabase
        .from(table).select(columns)
        .order(order, { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      all = all.concat(data);
      if (!data.length || data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  // ── lookup tables: notation + thaat (via tetrachords) + angs/samays/creators/popularity ──

  function buildNotationMaps(pitchclasses){
    NOTATION_SYSTEMS.forEach(sys => {
      if (!sys.column) return;
      pcMaps[sys.key] = new Map(pitchclasses.map(pc => [pc.id, pc[sys.column]]));
    });
    pitchclasses.forEach(pc => {
      if (pc.id <= 11 && pc.sargam && pc.sargam.length === 1) pcReverse.set(pc.sargam, pc.id);
    });
  }

  async function loadLookups(){
    const [pitchclasses, tetrachords, thaatsRaw, angs, samays, creators, popularity] = await Promise.all([
      fetchAll('pitchclasses', 'id,sargam,scale_degrees,western_letter_note,carnatic_sargam', 'id'),
      fetchAll('tetrachords', 'id,name', 'id').catch(() => []),
      fetchAll('thaats', 'id,poorvaang_tetrachord_id,uttaraang_tetrachord_id', 'id').catch(() => []),
      fetchAll('angs', 'id,name', 'id').catch(() => []),
      fetchAll('samays', 'id,name', 'id').catch(() => []),
      fetchAll('creators', 'id,name', 'id').catch(() => []),
      fetchAll('popularity', 'id,name', 'id').catch(() => [])
    ]);

    const tetraMap = new Map(tetrachords.map(t => [t.id, t.name]));
    thaatsRaw.forEach(t => {
      const pName = tetraMap.get(t.poorvaang_tetrachord_id);
      const uName = tetraMap.get(t.uttaraang_tetrachord_id);
      const label = (pName && uName) ? (capitalize(pName) + ' – ' + capitalize(uName)) : ('Thaat ' + t.id);
      lookupMaps.thaat.set(t.id, label);
    });
    angs.forEach(a => lookupMaps.ang.set(a.id, a.name));
    samays.forEach(s => lookupMaps.samay.set(s.id, s.name));
    creators.forEach(c => lookupMaps.creator.set(c.id, c.name));
    popularity.forEach(p => lookupMaps.popularity.set(p.id, p.name));

    buildNotationMaps(pitchclasses);
  }

  // ── header rendering + column-tier visibility (stylesheet-driven) ──

  function renderHeader(){
    tableHeadRow.innerHTML = '';
    COLUMN_DEFS.forEach(def => {
      const th = document.createElement('th');
      th.dataset.key = def.key;
      th.dataset.tier = def.preset;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'th-label';
      labelSpan.appendChild(document.createTextNode(def.label));
      const arrow = document.createElement('span');
      arrow.className = 'th-arrow';
      labelSpan.appendChild(arrow);

      th.appendChild(labelSpan);
      th.addEventListener('click', () => sortByColumn(def.key));
      tableHeadRow.appendChild(th);
    });
  }

  function applyColumnPreset(){
    const selectedRank = TIER_RANK[columnsSelectEl.value];
    const hiddenIdx = [];
    COLUMN_DEFS.forEach((def, i) => {
      if (TIER_RANK[def.preset] > selectedRank) hiddenIdx.push(i + 1); // nth-child is 1-based
    });
    tierStyleEl.textContent = hiddenIdx.length
      ? hiddenIdx.map(i => `#raag-table th:nth-child(${i}),#raag-table td:nth-child(${i})`).join(',') + '{display:none}'
      : '';
  }

  // ── cell formatting ──────────────────────────────────────────

  function formatCell(def, raag){
    const raw = raag[def.key];
    if (def.type === 'fk'){
      if (raw === null || raw === undefined) return '—';
      return lookupMaps[def.lookup].get(raw) ?? (def.lookup + ' ' + raw);
    }
    if (raw === null || raw === undefined) return '—';
    switch (def.type){
      case 'int':   return (def.dashIfMinusOne && raw === -1) ? '—' : String(raw);
      case 'float': return Number(raw).toFixed(3);
      case 'bool':  return raw ? 'TRUE' : 'FALSE';
      case 'enum':  return def.enumLabels[raw] ?? String(raw);
      case 'text':  return raw || '—';
      case 'date':  return new Date(raw).toLocaleDateString();
      case 'svar_specific': return arrayToDisplayString(raw);
      case 'svar_generic':  return genericArrayToDisplayString(raw);
      case 'jsonb': try { return JSON.stringify(raw); } catch(e){ return '—'; }
      default: return String(raw);
    }
  }

  // signature element: scientific_id rendered as a segmented "barcode" —
  // aaroh(4) · avaroh(4) · dimension(1) · instance(1)
  function renderScientificBadge(td, raw){
    if (!raw){ td.textContent = '—'; return; }
    const wrap = document.createElement('div');
    wrap.className = 'sci-badge';
    [[raw.slice(0,4),'sci-aaroh'],[raw.slice(4,8),'sci-avaroh'],[raw.slice(8,9),'sci-dim'],[raw.slice(9,10),'sci-inst']]
      .forEach(([val, cls]) => {
        const seg = document.createElement('span');
        seg.className = 'sci-seg ' + cls;
        seg.textContent = val;
        wrap.appendChild(seg);
      });
    td.appendChild(wrap);
  }

  // ── row rendering ────────────────────────────────────────────

  function renderRows(data){
    const frag = document.createDocumentFragment();
    rows = [];

    data.forEach(raag => {
      const tr = document.createElement('tr');
      const cellRefs = {};

      COLUMN_DEFS.forEach(def => {
        const td = document.createElement('td');

        if (def.type === 'scientific'){
          renderScientificBadge(td, raag[def.key]);
        } else {
          if (def.type === 'bool') td.classList.add(raag[def.key] ? 'col-bool-true' : 'col-bool-false');
          if (def.truncate){ td.classList.add('col-truncate'); if (raag[def.key]) td.title = raag[def.key]; }
          if (def.type === 'svar_specific' || def.type === 'svar_generic') td.classList.add('col-mono-array');
          if (def.key === 'name' && !(raag.name && raag.name.trim())) td.classList.add('col-unnamed');
          td.textContent = formatCell(def, raag);
        }

        tr.appendChild(td);
        if (def.type === 'svar_specific' || def.type === 'svar_generic') cellRefs[def.key] = td;
      });

      const aarohMasks  = buildMasks(raag.aaroh);
      const avarohMasks = buildMasks(raag.avaroh);

      rows.push({
        raw: raag,
        el: tr,
        cellRefs,
        hasName: !!(raag.name && raag.name.trim()),
        aarohSpecific:  aarohMasks.specific,
        aarohGeneric:   aarohMasks.generic,
        avarohSpecific: avarohMasks.specific,
        avarohGeneric:  avarohMasks.generic,
        _maskCache: {}
      });

      frag.appendChild(tr);
    });

    tableBody.innerHTML = '';
    tableBody.appendChild(frag);
  }

  function getArrayMask(rowState, key, isGenericColumn){
    if (rowState._maskCache[key]) return rowState._maskCache[key];
    const arr = rowState.raw[key];
    const result = isGenericColumn ? { generic: buildGenericArrayMask(arr) } : buildMasks(arr);
    rowState._maskCache[key] = result;
    return result;
  }

  function applyNotation(){
    for (const r of rows){
      for (const key in r.cellRefs){
        const def = COLUMN_BY_KEY.get(key);
        const raw = r.raw[key];
        r.cellRefs[key].textContent = def.type === 'svar_generic' ? genericArrayToDisplayString(raw) : arrayToDisplayString(raw);
      }
    }
  }

  // ── sorting ──────────────────────────────────────────────────

  function getSortKey(def, raag){
    const raw = raag[def.key];
    if (raw === null || raw === undefined) return null;
    if (def.type === 'fk') return lookupMaps[def.lookup].get(raw) ?? String(raw);
    return raw;
  }

  function compareRows(def, ra, rb, dir){
    const a = getSortKey(def, ra.raw);
    const b = getSortKey(def, rb.raw);
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;   // nulls always sort last, regardless of direction
    if (bNull) return -1;

    const effType = def.type === 'fk' ? 'text' : def.type;
    let result = 0;
    switch (effType){
      case 'int': case 'float': case 'enum':
        result = a - b; break;
      case 'bool':
        result = (a === b) ? 0 : (a ? -1 : 1); break;
      case 'date':
        result = new Date(a) - new Date(b); break;
      case 'svar_specific': case 'svar_generic': {
        result = a.length !== b.length ? a.length - b.length : a.join(',').localeCompare(b.join(','));
        break;
      }
      case 'jsonb': {
        result = (a || []).length - (b || []).length;
        break;
      }
      default:
        result = String(a).localeCompare(String(b));
    }
    return dir === 'asc' ? result : -result;
  }

  function sortByColumn(key){
    const def = COLUMN_BY_KEY.get(key);
    if (!def) return;
    if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    else { sortState.key = key; sortState.dir = 'asc'; }

    rows.sort((ra, rb) => compareRows(def, ra, rb, sortState.dir));

    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(r.el));
    tableBody.appendChild(frag);
    if (emptyRow && emptyRow.parentNode) tableBody.appendChild(emptyRow);

    tableHeadRow.querySelectorAll('th').forEach(th => {
      if (th.dataset.key === sortState.key) th.dataset.sort = sortState.dir;
      else th.removeAttribute('data-sort');
    });
  }

  // ── custom "Add Filter" builder ──────────────────────────────

  function operatorOptionsFor(type){
    switch (type){
      case 'int': case 'float':
        return [['min','Min (≥)'],['max','Max (≤)'],['exactly','Exactly (=)'],['less','Less than (<)'],['more','More than (>)']];
      case 'text':
        return [['contains','Contains'],['starts','Starts with'],['exactly','Exactly']];
      case 'svar_specific': case 'svar_generic':
        return [['contains','Contains'],['excludes','Excludes']];
      case 'date':
        return [['on','On'],['before','Before'],['after','After']];
      default:
        return null; // bool, enum, fk — forced equality via dropdown
    }
  }

  function buildValueInput(container, def, filterObj){
    container.innerHTML = '';

    if (def.type === 'bool'){
      const sel = document.createElement('select');
      [['any','Any'],['yes','Yes'],['no','No']].forEach(([v,l]) => {
        const opt = document.createElement('option'); opt.value = v; opt.textContent = l; sel.appendChild(opt);
      });
      sel.value = filterObj.value ?? 'any';
      sel.addEventListener('change', () => { filterObj.value = sel.value; });
      filterObj.value = sel.value;
      container.appendChild(sel);
      return;
    }

    if (def.type === 'enum'){
      const sel = document.createElement('select');
      const anyOpt = document.createElement('option'); anyOpt.value=''; anyOpt.textContent='Any'; sel.appendChild(anyOpt);
      Object.keys(def.enumLabels).forEach(k => {
        const opt = document.createElement('option'); opt.value = k; opt.textContent = def.enumLabels[k]; sel.appendChild(opt);
      });
      sel.value = filterObj.value ?? '';
      sel.addEventListener('change', () => { filterObj.value = sel.value; });
      filterObj.value = sel.value;
      container.appendChild(sel);
      return;
    }

    if (def.type === 'fk'){
      const sel = document.createElement('select');
      const anyOpt = document.createElement('option'); anyOpt.value=''; anyOpt.textContent='Any'; sel.appendChild(anyOpt);
      [...lookupMaps[def.lookup].entries()].sort((a,b) => a[0]-b[0]).forEach(([id,name]) => {
        const opt = document.createElement('option'); opt.value = id; opt.textContent = name; sel.appendChild(opt);
      });
      sel.value = filterObj.value ?? '';
      sel.addEventListener('change', () => { filterObj.value = sel.value; });
      filterObj.value = sel.value;
      container.appendChild(sel);
      return;
    }

    if (def.type === 'date'){
      const input = document.createElement('input');
      input.type = 'date';
      input.value = filterObj.value ?? '';
      input.addEventListener('input', () => { filterObj.value = input.value; });
      container.appendChild(input);
      return;
    }

    if (def.type === 'svar_specific' || def.type === 'svar_generic'){
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g. G r';
      input.autocomplete = 'off'; input.spellcheck = false;
      input.value = filterObj.value ?? '';
      input.addEventListener('input', () => { filterObj.value = input.value; });
      container.appendChild(input);
      return;
    }

    if (def.type === 'text'){
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'search text';
      input.value = filterObj.value ?? '';
      input.addEventListener('input', () => { filterObj.value = input.value; });
      container.appendChild(input);
      return;
    }

    const input = document.createElement('input');
    input.type = 'number';
    if (def.type === 'float') input.step = 'any';
    input.value = filterObj.value ?? '';
    input.addEventListener('input', () => { filterObj.value = input.value; });
    container.appendChild(input);
  }

  function createFilterRow(initialKey){
    const filterObj = { id: ++filterIdCounter, key: initialKey, type: null, operator: null, value: null };

    const row = document.createElement('div');
    row.className = 'filter-instance';

    const colSelect = document.createElement('select');
    colSelect.className = 'filter-col-select';
    const filterableCols = COLUMN_DEFS.filter(c => c.filterable);
    ['minimum','contracted','standard','expanded','maximum'].forEach(tier => {
      const colsInTier = filterableCols.filter(c => c.preset === tier);
      if (!colsInTier.length) return;
      const group = document.createElement('optgroup');
      group.label = TIER_LABELS[tier];
      colsInTier.forEach(c => {
        const opt = document.createElement('option'); opt.value = c.key; opt.textContent = c.label; group.appendChild(opt);
      });
      colSelect.appendChild(group);
    });
    colSelect.value = initialKey;

    const operatorWrap = document.createElement('span');
    const valueWrap = document.createElement('span');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'filter-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove this filter';
    removeBtn.addEventListener('click', () => {
      activeFilters = activeFilters.filter(f => f.id !== filterObj.id);
      row.remove();
      updateNoFiltersNote();
    });

    function rebuildForColumn(key){
      const def = COLUMN_BY_KEY.get(key);
      filterObj.key = key;
      filterObj.type = def.type;

      operatorWrap.innerHTML = '';
      const ops = operatorOptionsFor(def.type);
      if (ops){
        const opSelect = document.createElement('select');
        ops.forEach(([v,l]) => { const opt = document.createElement('option'); opt.value=v; opt.textContent=l; opSelect.appendChild(opt); });
        opSelect.value = ops[0][0];
        filterObj.operator = ops[0][0];
        opSelect.addEventListener('change', () => { filterObj.operator = opSelect.value; });
        operatorWrap.appendChild(opSelect);
      } else {
        filterObj.operator = 'exactly';
      }
      buildValueInput(valueWrap, def, filterObj);
    }

    colSelect.addEventListener('change', () => rebuildForColumn(colSelect.value));

    row.append(colSelect, operatorWrap, valueWrap, removeBtn);
    rebuildForColumn(initialKey);

    activeFilters.push(filterObj);
    activeFiltersEl.appendChild(row);
    updateNoFiltersNote();
  }

  function updateNoFiltersNote(){
    noFiltersNoteEl.style.display = activeFilters.length ? 'none' : '';
  }

  function evaluateDynamicFilter(filter, rowState){
    switch (filter.type){
      case 'int': case 'float': {
        const raw = rowState.raw[filter.key];
        if (filter.value === null || filter.value === undefined || filter.value === '') return true;
        if (raw === null || raw === undefined) return false;
        const target = parseFloat(filter.value);
        if (isNaN(target)) return true;
        switch (filter.operator){
          case 'min': return raw >= target;
          case 'max': return raw <= target;
          case 'less': return raw < target;
          case 'more': return raw > target;
          default: return raw === target;
        }
      }
      case 'bool': {
        const raw = rowState.raw[filter.key];
        if (!filter.value || filter.value === 'any') return true;
        return !!raw === (filter.value === 'yes');
      }
      case 'enum': case 'fk': {
        const raw = rowState.raw[filter.key];
        if (!filter.value) return true;
        return String(raw) === String(filter.value);
      }
      case 'text': {
        const raw = rowState.raw[filter.key];
        if (!filter.value) return true;
        const v = (raw || '').toLowerCase();
        const q = filter.value.toLowerCase();
        if (filter.operator === 'starts') return v.startsWith(q);
        if (filter.operator === 'exactly') return v === q;
        return v.includes(q);
      }
      case 'date': {
        const raw = rowState.raw[filter.key];
        if (!filter.value || !raw) return true;
        const rd = new Date(raw).toISOString().slice(0,10);
        if (filter.operator === 'before') return rd < filter.value;
        if (filter.operator === 'after')  return rd > filter.value;
        return rd === filter.value;
      }
      case 'svar_specific': case 'svar_generic': {
        if (!filter.value) return true;
        const isGeneric = filter.type === 'svar_generic';
        const { specific, generic } = parseInput(filter.value);
        const targetMask = isGeneric ? generic : specific;
        if (targetMask === 0) return true;
        const rowMask = getArrayMask(rowState, filter.key, isGeneric);
        const rMask = isGeneric ? rowMask.generic : rowMask.specific;
        return filter.operator === 'excludes' ? (rMask & targetMask) === 0 : (rMask & targetMask) === targetMask;
      }
      default:
        return true;
    }
  }

  // ── main filter pass (deferred — runs on Apply / Reset / quick preset) ──

  function ensureEmptyRow(){
    if (!emptyRow){
      emptyRow = document.createElement('tr');
      emptyRow.className = 'empty-row';
      const td = document.createElement('td');
      td.colSpan = COLUMN_DEFS.length;
      td.textContent = 'No raags match these filters.';
      emptyRow.appendChild(td);
    }
    return emptyRow;
  }

  function runFilters(){
    const statusFilter = statusFilterEl.value;
    const dimFilter     = dimensionFilterEl.value;
    const query          = searchInputEl.value.trim().toLowerCase();

    const presentMode  = getMode('present-mode');
    const varjitMode   = getMode('varjit-mode');
    const presentMatch = getInexMode('present-inex');
    const varjitMatch  = getInexMode('varjit-inex');

    const presentAaroh  = parseInput(presentAarohInput.value);
    const presentAvaroh = parseInput(presentAvarohInput.value);
    const varjitAaroh   = parseInput(varjitAarohInput.value);
    const varjitAvaroh  = parseInput(varjitAvarohInput.value);

    const presentAarohMask  = presentMode === 'generic' ? presentAaroh.generic  : presentAaroh.specific;
    const presentAvarohMask = presentMode === 'generic' ? presentAvaroh.generic : presentAvaroh.specific;
    const varjitAarohMask   = varjitMode  === 'generic' ? varjitAaroh.generic   : varjitAaroh.specific;
    const varjitAvarohMask  = varjitMode  === 'generic' ? varjitAvaroh.generic  : varjitAvaroh.specific;
    const varjitFullMask    = varjitMode  === 'generic' ? 0x7F : 0xFFF;

    let visible = 0;

    for (const r of rows){
      const okStatus =
        statusFilter === 'all' ||
        (statusFilter === 'named'   && r.hasName) ||
        (statusFilter === 'unnamed' && !r.hasName);

      const okDimension = dimFilter === 'any' || String(r.raw.dimension) === dimFilter;
      const okSearch = !query || String(r.raw.id).includes(query) || (r.raw.name || '').toLowerCase().includes(query);
      const okAarohJaati  = jaatiMatches(aarohJaatiCompareEl,  aarohJaatiValueEl,  r.raw.aaroh_jaati);
      const okAvarohJaati = jaatiMatches(avarohJaatiCompareEl, avarohJaatiValueEl, r.raw.avaroh_jaati);

      const rowPresentAaroh  = presentMode === 'generic' ? r.aarohGeneric  : r.aarohSpecific;
      const rowPresentAvaroh = presentMode === 'generic' ? r.avarohGeneric : r.avarohSpecific;
      const rowVarjitAaroh   = varjitMode  === 'generic' ? r.aarohGeneric  : r.aarohSpecific;
      const rowVarjitAvaroh  = varjitMode  === 'generic' ? r.avarohGeneric : r.avarohSpecific;

      const okPresentAaroh  = presentMatch === 'exclusive' ? rowPresentAaroh  === presentAarohMask  : (rowPresentAaroh  & presentAarohMask)  === presentAarohMask;
      const okPresentAvaroh = presentMatch === 'exclusive' ? rowPresentAvaroh === presentAvarohMask : (rowPresentAvaroh & presentAvarohMask) === presentAvarohMask;
      const okVarjitAaroh   = varjitMatch  === 'exclusive' ? ((varjitFullMask & ~rowVarjitAaroh)  === varjitAarohMask)  : (rowVarjitAaroh  & varjitAarohMask)  === 0;
      const okVarjitAvaroh  = varjitMatch  === 'exclusive' ? ((varjitFullMask & ~rowVarjitAvaroh) === varjitAvarohMask) : (rowVarjitAvaroh & varjitAvarohMask) === 0;

      let okDynamic = true;
      for (const f of activeFilters){ if (!evaluateDynamicFilter(f, r)){ okDynamic = false; break; } }

      const show = okStatus && okDimension && okSearch && okAarohJaati && okAvarohJaati &&
                   okPresentAaroh && okPresentAvaroh && okVarjitAaroh && okVarjitAvaroh && okDynamic;

      r.el.hidden = !show;
      if (show) visible++;
    }

    if (visible === 0 && rows.length > 0) tableBody.appendChild(ensureEmptyRow());
    else if (emptyRow && emptyRow.parentNode) emptyRow.parentNode.removeChild(emptyRow);

    showingCountEl.textContent = 'showing ' + visible.toLocaleString() + ' of ' + rows.length.toLocaleString() + ' raags';
  }

  // ── filter presets (menu) ────────────────────────────────────

  function applyPreset(value){
    if (value === 'custom'){
      customBlockEl.hidden = false;
      filterHintEl.textContent = 'Build custom filters, then Apply.';
      return;
    }
    customBlockEl.hidden = true;
    activeFilters = [];
    activeFiltersEl.innerHTML = '';
    updateNoFiltersNote();

    statusFilterEl.value = 'all';
    dimensionFilterEl.value = 'any';
    if (value === 'named')       statusFilterEl.value = 'named';
    else if (value === 'unnamed') statusFilterEl.value = 'unnamed';
    else if (value === 'dim1')    dimensionFilterEl.value = '1';
    else if (value === 'dim2')    dimensionFilterEl.value = '2';

    filterHintEl.textContent = 'Preset applied.';
    runFilters();
  }

  // ── present/varjit svar box wiring (inclusive/exclusive, specific/generic, Both) ──

  function wireSvarInputChips(input, chipsEl){
    input.addEventListener('input', () => {
      const { chips } = parseInput(input.value);
      renderChips(chipsEl, chips);
    });
  }

  function wireSvarPair(inputA, chipsA, inputB, chipsB, isBothOnFn){
    function handle(sourceInput, sourceChips, targetInput, targetChips){
      return () => {
        const { chips: ownChips } = parseInput(sourceInput.value);
        renderChips(sourceChips, ownChips);
        if (isBothOnFn() && targetInput.value !== sourceInput.value){
          targetInput.value = sourceInput.value;
          const { chips: mirroredChips } = parseInput(targetInput.value);
          renderChips(targetChips, mirroredChips);
        }
      };
    }
    inputA.addEventListener('input', handle(inputA, chipsA, inputB, chipsB));
    inputB.addEventListener('input', handle(inputB, chipsB, inputA, chipsA));
  }

  function toggleBoth(btn, currentlyOn, inputA, chipsA, inputB, chipsB){
    const nowOn = !currentlyOn;
    btn.setAttribute('aria-pressed', nowOn ? 'true' : 'false');
    if (nowOn){
      const source = inputA.value ? inputA : inputB;
      const target  = source === inputA ? inputB : inputA;
      const targetChips = source === inputA ? chipsB : chipsA;
      if (target.value !== source.value){
        target.value = source.value;
        const { chips } = parseInput(target.value);
        renderChips(targetChips, chips);
      }
    }
    return nowOn;
  }

  wireSvarPair(presentAarohInput, presentAarohChipsEl, presentAvarohInput, presentAvarohChipsEl, () => presentBothOn);
  wireSvarPair(varjitAarohInput,  varjitAarohChipsEl,  varjitAvarohInput,  varjitAvarohChipsEl,  () => varjitBothOn);

  presentBothBtn.addEventListener('click', () => {
    presentBothOn = toggleBoth(presentBothBtn, presentBothOn, presentAarohInput, presentAarohChipsEl, presentAvarohInput, presentAvarohChipsEl);
  });
  varjitBothBtn.addEventListener('click', () => {
    varjitBothOn = toggleBoth(varjitBothBtn, varjitBothOn, varjitAarohInput, varjitAarohChipsEl, varjitAvarohInput, varjitAvarohChipsEl);
  });

  // ── menu open / close ────────────────────────────────────────

  function closeMenu(){
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => {
    const willOpen = menuPanel.hidden;
    menuPanel.hidden = !willOpen;
    menuBtn.setAttribute('aria-expanded', String(willOpen));
  });
  menuDone.addEventListener('click', closeMenu);
  document.addEventListener('click', (e) => {
    if (!menuPanel.hidden && !menuPanel.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  });

  notationSelectEl.addEventListener('change', () => {
    currentNotation = notationSelectEl.value;
    applyNotation();
  });
  columnsSelectEl.addEventListener('change', applyColumnPreset);
  presetSelectEl.addEventListener('change', () => applyPreset(presetSelectEl.value));

  // ── add filter / apply / reset ───────────────────────────────

  addFilterBtn.addEventListener('click', () => {
    const firstFilterable = COLUMN_DEFS.find(c => c.filterable);
    if (firstFilterable) createFilterRow(firstFilterable.key);
  });

  applyBtn.addEventListener('click', () => {
    runFilters();
    filterHintEl.textContent = 'Filters applied.';
  });

  resetBtn.addEventListener('click', () => {
    statusFilterEl.value = 'all';
    dimensionFilterEl.value = 'any';
    searchInputEl.value = '';
    aarohJaatiCompareEl.value = 'exactly';  aarohJaatiValueEl.value = 'any';
    avarohJaatiCompareEl.value = 'exactly'; avarohJaatiValueEl.value = 'any';

    [presentAarohInput, presentAvarohInput, varjitAarohInput, varjitAvarohInput].forEach(el => el.value = '');
    [presentAarohChipsEl, presentAvarohChipsEl, varjitAarohChipsEl, varjitAvarohChipsEl].forEach(el => renderChips(el, []));
    document.getElementById('present-mode-specific').checked = true;
    document.getElementById('present-inex-exclusive').checked = true;
    document.getElementById('varjit-mode-generic').checked = true;
    document.getElementById('varjit-inex-inclusive').checked = true;

    presentBothOn = true; varjitBothOn = true;
    presentBothBtn.setAttribute('aria-pressed', 'true');
    varjitBothBtn.setAttribute('aria-pressed', 'true');

    activeFilters = [];
    activeFiltersEl.innerHTML = '';
    updateNoFiltersNote();
    customBlockEl.hidden = true;
    presetSelectEl.value = 'all';

    filterHintEl.textContent = 'Filters reset.';
    runFilters();
  });

  // ── init ─────────────────────────────────────────────────────

  async function init(){
	  //Check and set the tab name immediately when the page initializes (from Gemini)
	  if ( window.location.pathname.endsWith('index.html') || 
		   window.location.pathname.endsWith('/raag/advanced/') ||
		   window.location.pathname.endsWith('/advanced/') 
		 ) {
		  window.name = "main_tab";
	  }
	  
    renderHeader();
    applyColumnPreset();

    try{
      await loadLookups();
      const raags = await fetchAll('raags', SELECT_COLUMNS, 'id');

      renderRows(raags);
      applyNotation();
      counterEl.textContent = raags.length.toLocaleString();
      updateNoFiltersNote();
      runFilters();
    } catch(err){
      tableBody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'status-cell error';
      td.textContent = 'Could not load raags — ' + (err.message || err);
      tr.appendChild(td);
      tableBody.appendChild(tr);
      counterEl.textContent = '—';
    }
  }

  init();

})();
