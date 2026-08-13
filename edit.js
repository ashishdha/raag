// ============================================================================
// edit.js — Naadaalay DB · Raag Data Entry page
// ============================================================================
// Depends on (loaded before this file, see edit.html):
//   - supabase-js CDN
//   - database.js   (window.databaseClient, loadMusicData, loadRaagMetadata,
//                     getCachedTableData, populateSelectMenu, setNotationSystem,
//                     intArray2string, string2intArray, cleanNotationString,
//                     flagInvalidNotation, errorAlert)
//   - metadata.js   (window.DatabaseMetadata)
//
// WHAT THIS FILE DOES NOT HARDCODE:
//   The list of editable "human" columns on raags, their labels, their
//   descriptions, and whether each one is a foreign key select or a plain
//   text box are all derived at runtime from DatabaseMetadata + the column
//   comment format:
//       order|source|display|visibility|description
//   Add, remove, reorder, or retag a column's COMMENT ON COLUMN in Supabase
//   and this page's form changes automatically — no HTML/JS edits needed.
//
// THE ONE INTENTIONAL EXCEPTION:
//   aaroh/avaroh are locked (read-only) once they already hold a value,
//   per your explicit instruction — that's the one column-name check in
//   this file that isn't derived from metadata (see LOCKED_IF_SET below).
// ============================================================================

(function () {

  // ── configuration ─────────────────────────────────────────────────────

  const ALLOWED_ROLES = ['admin', 'editor', 'contributor'];
  const LOCKED_IF_SET = new Set(['aaroh', 'avaroh']);
  const RAAGS_TABLE = 'raags';

  // ── DOM refs ─────────────────────────────────────────────────────────

  const authBarEl        = document.getElementById('auth-bar');
  const accessDeniedEl    = document.getElementById('access-denied');
  const mainContentEl     = document.getElementById('main-content');
  const raagContextEl     = document.getElementById('raag-context');
  const editTableBodyEl   = document.getElementById('edit-table-body');
  const saveStatusEl      = document.getElementById('save-status');
  const notationSelectEl  = document.getElementById('notation-select');
  const footerInfoEl      = document.getElementById('footer-info');

  // Filter bar (ported from index.html/advanced.js — same element ids, so the
  // filtering logic below is a near-direct port of runFilters() from advanced.js)
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
  const statusFilterEl    = document.getElementById('status-filter');
  const dimensionFilterEl = document.getElementById('dimension-filter');
  const aarohJaatiCompareEl  = document.getElementById('aaroh-jaati-compare');
  const aarohJaatiValueEl    = document.getElementById('aaroh-jaati-value');
  const avarohJaatiCompareEl = document.getElementById('avaroh-jaati-compare');
  const avarohJaatiValueEl   = document.getElementById('avaroh-jaati-value');
  const searchInputEl     = document.getElementById('search-input');
  const filterHintEl      = document.getElementById('filter-hint');
  const resetBtnEl        = document.getElementById('reset-btn');
  const applyBtnEl        = document.getElementById('apply-btn');

  // Matches panel (new — not part of index.html; something has to actually
  // pick which single raag loads into the editor below)
  const matchesCountEl = document.getElementById('matches-count');
  const matchesListEl  = document.getElementById('matches-list');
  const prevBtnEl       = document.getElementById('prev-btn');
  const nextBtnEl       = document.getElementById('next-btn');
  const nextUnnamedBtnEl = document.getElementById('next-unnamed-btn');

  // ── page state ───────────────────────────────────────────────────────

  let editableColumns = [];      // [{ col, tag }, ...] sorted by tag.order
  let currentRaagId = null;
  let currentRaagRow = null;
  const fieldState = new Map();  // columnName -> { col, tag, input, statusEl, widgetType, lastSavedValue, parsedValue, isValid, lastAlertedValue }
  const lockedDisplays = [];     // [{ el, rawValue }] — re-painted when notation system changes

  let allRaagsIndex = [];        // [{ id, name, hasName, dimension, aaroh_jaati, avaroh_jaati, aarohSpecific, aarohGeneric, avarohSpecific, avarohGeneric }]
  let matchedIds = [];           // ids currently matching the filter bar — Prev/Next/Next-Unnamed all operate on this
  let presentBothOn = true;
  let varjitBothOn  = true;
  let pcReverse = new Map();     // single-char sargam letter -> pitch class id 0-11, for parsing svar filter input

  const GENERIC_GROUP_OF_SPECIFIC = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]; // pitch-class 0-11 -> generic group 0-6

  // ============================================================================
  // COLUMN-COMMENT TAG PARSING
  //   Format: order|source|display|visibility|description
  //   e.g. "2|human|englishText|1|#human #normalText Phonetic Roman spelling..."
  // ============================================================================

  function parseColumnTag(comment) {
    if (!comment) return null;
    const parts = comment.split('|');
    if (parts.length < 5) return null;   // legacy/untagged comment — not editable here

    const order = parseInt(parts[0], 10);
    const source = parts[1].trim();
    const display = parts[2].trim();
    const visibility = parseInt(parts[3], 10);
    const description = parts.slice(4).join('|').trim(); // rejoin in case description itself has '|'

    if (Number.isNaN(order) || Number.isNaN(visibility)) return null;
    if (!['human', 'calculated', 'generated'].includes(source)) return null;

    return { order, source, display, visibility, description };
  }

  // Strips leading "#tag" tokens some of your older comments still carry, for display only.
  function cleanDescription(desc) {
    return desc.replace(/^(#\S+\s+)+/, '').trim();
  }

  // ============================================================================
  // FILTER BAR — ported from index.html / advanced.js (minus the custom-block
  // "Add filter" builder). Same element ids, so this is close to a direct port
  // of parseInput/buildMasks/jaatiMatches/runFilters, adapted to produce a
  // list of matching raag IDs instead of toggling table row visibility.
  // ============================================================================

  function pitchClass(v) { return ((v % 12) + 12) % 12; }

  function buildMasks(arr) {
    let specific = 0, generic = 0;
    if (arr) {
      for (const v of arr) {
        const pc = pitchClass(v);
        specific |= (1 << pc);
        generic  |= (1 << GENERIC_GROUP_OF_SPECIFIC[pc]);
      }
    }
    return { specific, generic };
  }

  // pcReverse is built from window.pitchclasses (already cached by loadMusicData())
  // instead of a separate fetch — same source of truth as everywhere else.
  function buildPcReverse() {
    pcReverse.clear();
    for (const [id, row] of window.pitchclasses) {
      if (id <= 11 && row.sargam && row.sargam.length === 1) {
        pcReverse.set(row.sargam, id);
      }
    }
  }

  function parseInput(value) {
    let specific = 0, generic = 0;
    const chips = [];
    for (const ch of value) {
      const id = pcReverse.get(ch);
      if (id === undefined) continue;
      specific |= (1 << id);
      generic  |= (1 << GENERIC_GROUP_OF_SPECIFIC[id]);
      chips.push({ ch, komal: ch === ch.toLowerCase() });
    }
    return { specific, generic, chips };
  }

  function renderChips(container, chips) {
    container.innerHTML = '';
    chips.forEach(c => {
      const span = document.createElement('span');
      span.className = 'chip ' + (c.komal ? 'komal' : 'shuddha');
      span.textContent = c.ch;
      container.appendChild(span);
    });
  }

  function getMode(radioName) {
    const checked = document.querySelector('input[name="' + radioName + '"]:checked');
    return checked ? checked.value : 'specific';
  }
  function getInexMode(radioName) {
    const checked = document.querySelector('input[name="' + radioName + '"]:checked');
    return checked ? checked.value : 'inclusive';
  }

  function jaatiMatches(compareEl, valueEl, actualValue) {
    const val = valueEl.value;
    if (val === 'any') return true;
    if (actualValue === null || actualValue === undefined) return false;
    const target = parseInt(val, 10);
    if (compareEl.value === 'min') return actualValue >= target;
    if (compareEl.value === 'max') return actualValue <= target;
    return actualValue === target;
  }

  function wireSvarPair(inputA, chipsA, inputB, chipsB, isBothOnFn) {
    function handle(sourceInput, sourceChips, targetInput, targetChips) {
      return () => {
        const { chips: ownChips } = parseInput(sourceInput.value);
        renderChips(sourceChips, ownChips);
        if (isBothOnFn() && targetInput.value !== sourceInput.value) {
          targetInput.value = sourceInput.value;
          const { chips: mirroredChips } = parseInput(targetInput.value);
          renderChips(targetChips, mirroredChips);
        }
      };
    }
    inputA.addEventListener('input', handle(inputA, chipsA, inputB, chipsB));
    inputB.addEventListener('input', handle(inputB, chipsB, inputA, chipsA));
  }

  function toggleBoth(btn, currentlyOn, inputA, chipsA, inputB, chipsB) {
    const nowOn = !currentlyOn;
    btn.setAttribute('aria-pressed', nowOn ? 'true' : 'false');
    if (nowOn) {
      const source = inputA.value ? inputA : inputB;
      const target  = source === inputA ? inputB : inputA;
      const targetChips = source === inputA ? chipsB : chipsA;
      if (target.value !== source.value) {
        target.value = source.value;
        const { chips } = parseInput(target.value);
        renderChips(targetChips, chips);
      }
    }
    return nowOn;
  }

  // Fetch once (id, name, dimension, jaati, aaroh, avaroh only — enough to
  // filter by) and build the same bitmasks advanced.js uses, matching your
  // fetch-once/filter-client-side pattern used everywhere else in the project.
  async function fetchAllRaagsIndex() {
    const pageSize = 1000;
    let all = [];
    let from = 0;
    while (true) {
      const { data, error } = await databaseClient
        .from(RAAGS_TABLE)
        .select('id, name, aaroh, avaroh, dimension, aaroh_jaati, avaroh_jaati')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      all = all.concat(data);
      if (!data.length || data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  function buildRaagsIndex(rawRows) {
    allRaagsIndex = rawRows.map(raag => {
      const aarohMasks  = buildMasks(raag.aaroh);
      const avarohMasks = buildMasks(raag.avaroh);
      return {
        id: raag.id,
        name: raag.name,
        hasName: !!(raag.name && raag.name.trim()),
        dimension: raag.dimension,
        aaroh_jaati: raag.aaroh_jaati,
        avaroh_jaati: raag.avaroh_jaati,
        aarohSpecific:  aarohMasks.specific,
        aarohGeneric:   aarohMasks.generic,
        avarohSpecific: avarohMasks.specific,
        avarohGeneric:  avarohMasks.generic
      };
    });
  }

  // Same predicate logic as advanced.js's runFilters(), returning a sorted
  // array of matching entries instead of toggling DOM row visibility.
  function computeMatches() {
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

    const matches = [];

    for (const r of allRaagsIndex) {
      const okStatus =
        statusFilter === 'all' ||
        (statusFilter === 'named'   && r.hasName) ||
        (statusFilter === 'unnamed' && !r.hasName);

      const okDimension = dimFilter === 'any' || String(r.dimension) === dimFilter;
      const okSearch = !query || String(r.id).includes(query) || (r.name || '').toLowerCase().includes(query);
      const okAarohJaati  = jaatiMatches(aarohJaatiCompareEl,  aarohJaatiValueEl,  r.aaroh_jaati);
      const okAvarohJaati = jaatiMatches(avarohJaatiCompareEl, avarohJaatiValueEl, r.avaroh_jaati);

      const rowPresentAaroh  = presentMode === 'generic' ? r.aarohGeneric  : r.aarohSpecific;
      const rowPresentAvaroh = presentMode === 'generic' ? r.avarohGeneric : r.avarohSpecific;
      const rowVarjitAaroh   = varjitMode  === 'generic' ? r.aarohGeneric  : r.aarohSpecific;
      const rowVarjitAvaroh  = varjitMode  === 'generic' ? r.avarohGeneric : r.avarohSpecific;

      const okPresentAaroh  = presentMatch === 'exclusive' ? rowPresentAaroh  === presentAarohMask  : (rowPresentAaroh  & presentAarohMask)  === presentAarohMask;
      const okPresentAvaroh = presentMatch === 'exclusive' ? rowPresentAvaroh === presentAvarohMask : (rowPresentAvaroh & presentAvarohMask) === presentAvarohMask;
      const okVarjitAaroh   = varjitMatch  === 'exclusive' ? ((varjitFullMask & ~rowVarjitAaroh)  === varjitAarohMask)  : (rowVarjitAaroh  & varjitAarohMask)  === 0;
      const okVarjitAvaroh  = varjitMatch  === 'exclusive' ? ((varjitFullMask & ~rowVarjitAvaroh) === varjitAvarohMask) : (rowVarjitAvaroh & varjitAvarohMask) === 0;

      if (okStatus && okDimension && okSearch && okAarohJaati && okAvarohJaati &&
          okPresentAaroh && okPresentAvaroh && okVarjitAaroh && okVarjitAvaroh) {
        matches.push(r);
      }
    }

    return matches;
  }

  function renderMatches(matches) {
    matchedIds = matches.map(m => m.id);
    matchesCountEl.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es');

    matchesListEl.innerHTML = '';
    for (const m of matches) {
      const item = document.createElement('div');
      item.className = 'match-item' + (m.id === currentRaagId ? ' current' : '');
      item.dataset.id = String(m.id);
      item.innerHTML =
        '<span class="match-id">#' + m.id + '</span> ' +
        (m.hasName ? '<span class="match-name">' + m.name + '</span>' : '<span class="match-name unnamed">Unnamed</span>');
      item.addEventListener('click', () => loadRaag(m.id));
      matchesListEl.appendChild(item);
    }

    // Single-result searches (e.g. typing an exact ID) jump straight in —
    // saves a click for the most common "find this one raag" case.
    if (matches.length === 1 && matches[0].id !== currentRaagId) {
      loadRaag(matches[0].id);
    }
  }

  // Moves the .current highlight in the already-rendered matches list without
  // rebuilding it — called every time loadRaag() succeeds.
  function highlightCurrentMatch() {
    for (const item of matchesListEl.children) {
      item.classList.toggle('current', item.dataset.id === String(currentRaagId));
    }
  }

  function applyFilters() {
    renderMatches(computeMatches());
    filterHintEl.textContent = 'Filters applied.';
  }

  function resetFilters() {
    [presentAarohInput, presentAvarohInput, varjitAarohInput, varjitAvarohInput].forEach(el => el.value = '');
    [presentAarohChipsEl, presentAvarohChipsEl, varjitAarohChipsEl, varjitAvarohChipsEl].forEach(el => renderChips(el, []));
    document.getElementById('present-mode-specific').checked = true;
    document.getElementById('present-inex-exclusive').checked = true;
    document.getElementById('varjit-mode-generic').checked = true;
    document.getElementById('varjit-inex-inclusive').checked = true;

    presentBothOn = true; varjitBothOn = true;
    presentBothBtn.setAttribute('aria-pressed', 'true');
    varjitBothBtn.setAttribute('aria-pressed', 'true');

    statusFilterEl.value = 'all';
    dimensionFilterEl.value = 'any';
    searchInputEl.value = '';
    aarohJaatiCompareEl.value = 'exactly';  aarohJaatiValueEl.value = 'any';
    avarohJaatiCompareEl.value = 'exactly'; avarohJaatiValueEl.value = 'any';

    filterHintEl.textContent = 'Filters reset.';
    renderMatches(computeMatches());
  }

  function wireFilterBar() {
    wireSvarPair(presentAarohInput, presentAarohChipsEl, presentAvarohInput, presentAvarohChipsEl, () => presentBothOn);
    wireSvarPair(varjitAarohInput,  varjitAarohChipsEl,  varjitAvarohInput,  varjitAvarohChipsEl,  () => varjitBothOn);

    presentBothBtn.addEventListener('click', () => {
      presentBothOn = toggleBoth(presentBothBtn, presentBothOn, presentAarohInput, presentAarohChipsEl, presentAvarohInput, presentAvarohChipsEl);
    });
    varjitBothBtn.addEventListener('click', () => {
      varjitBothOn = toggleBoth(varjitBothBtn, varjitBothOn, varjitAarohInput, varjitAarohChipsEl, varjitAvarohInput, varjitAvarohChipsEl);
    });

    searchInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyFilters(); });
    applyBtnEl.addEventListener('click', applyFilters);
    resetBtnEl.addEventListener('click', resetFilters);
  }

  // ============================================================================
  // LIGHTWEIGHT RAAGS SCHEMA LOADER
  // ============================================================================
  // Query a public view (raags_column_metadata) that exposes pg_attribute and
  // pg_description data for the raags table.
  // 
  // Requires (run once in SQL Editor):
  //   CREATE OR REPLACE VIEW public.raags_column_metadata AS
  //   SELECT 
  //     a.attname as column_name,
  //     a.attnum as ordinal_position,
  //     d.description as column_comment
  //   FROM pg_catalog.pg_class c
  //   JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  //   JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
  //   LEFT JOIN pg_catalog.pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
  //   WHERE n.nspname = 'public' 
  //     AND c.relname = 'raags'
  //     AND a.attnum > 0 
  //     AND NOT a.attisdropped
  //   ORDER BY a.attnum;
  //
  //   GRANT SELECT ON public.raags_column_metadata TO anon, authenticated;

  async function loadRaagsSchema() {
    // Fetch column metadata (names + comments)
    const { data: colData, error: colError } = await databaseClient
      .from('raags_column_metadata')
      .select('column_name, ordinal_position, column_comment')
      .order('ordinal_position');

    if (colError) {
      throw new Error('Could not load raags columns: ' + colError.message);
    }

    if (!colData || colData.length === 0) {
      throw new Error('raags_column_metadata view returned no columns');
    }

    // Fetch FK info for each column
    const { data: fkData, error: fkError } = await databaseClient
      .from('raags_column_fks')
      .select('column_name, is_fk, referenced_table');

    if (fkError) {
      throw new Error('Could not load raags FK info: ' + fkError.message);
    }

    // Build a map of FK info keyed by column_name
    const fkMap = new Map();
    if (fkData) {
      for (const row of fkData) {
        fkMap.set(row.column_name, { is_fk: row.is_fk, referenced_table: row.referenced_table });
      }
    }

    // Merge FK info into the column metadata
    window.raagsTableMeta = {
      columns: colData.map(row => {
        const fk = fkMap.get(row.column_name) || { is_fk: false, referenced_table: null };
        return {
          column_name: row.column_name,
          ordinal_position: row.ordinal_position,
          column_comment: row.column_comment || null,
          is_fk: fk.is_fk,
          referenced_table: fk.referenced_table
        };
      }),
      columnsByName: new Map()
    };

    for (const col of window.raagsTableMeta.columns) {
      window.raagsTableMeta.columnsByName.set(col.column_name, col);
    }

    console.log('Loaded raags schema from raags_column_metadata and raags_column_fks views.');
  }

  // ── ADJUST HERE if your role storage differs ───────────────────────────
  // This assumes a `profiles` table: id uuid (references auth.users), role text.
  // If you instead store role in the JWT (auth.users.raw_app_meta_data), replace
  // the body of this function with:
  //   const { data: { session } } = await databaseClient.auth.getSession();
  //   return session?.user?.app_metadata?.role ?? null;
  async function getUserRole(userId) {
    const { data, error } = await databaseClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('getUserRole: could not read profiles table —', error.message);
      return null;
    }
    return data?.role ?? null;
  }

  async function checkAccessAndInit() {
    const { data: { session } } = await databaseClient.auth.getSession();

    if (!session) {
      showLoginForm();
      return;
    }

    const role = await getUserRole(session.user.id);

    if (!ALLOWED_ROLES.includes(role)) {
      showAccessDenied(session, role);
      return;
    }

    await showEditorForUser(session, role);
  }

  function showLoginForm(errorMessage) {
    mainContentEl.hidden = true;
    accessDeniedEl.hidden = true;

    authBarEl.innerHTML = '';
    const form = document.createElement('form');
    form.className = 'login-form';
    form.innerHTML = `
      <input type="email" id="login-email" class="name-input" placeholder="email" autocomplete="username" required>
      <input type="password" id="login-password" class="name-input" placeholder="password" autocomplete="current-password" required>
      <button type="submit" class="both-toggle present">Sign in</button>
      <span class="login-error" id="login-error"></span>
    `;
    authBarEl.appendChild(form);

    if (errorMessage) {
      form.querySelector('#login-error').textContent = errorMessage;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.querySelector('#login-email').value.trim();
      const password = form.querySelector('#login-password').value;
      const { error } = await databaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        showLoginForm(error.message);
        return;
      }
      await checkAccessAndInit();
    });
  }

  function showAccessDenied(session, role) {
    mainContentEl.hidden = true;
    accessDeniedEl.hidden = false;
    accessDeniedEl.innerHTML = `
      <p>Signed in as <strong>${session.user.email}</strong> (role: ${role || 'none'}).
      This account doesn't have edit access to Naadaalay DB.</p>
    `;

    authBarEl.innerHTML = `<span class="signed-in-as">${session.user.email}</span> <button id="signout-btn" type="button" class="reset">Sign out</button>`;
    document.getElementById('signout-btn').addEventListener('click', signOut);
  }

  async function signOut() {
    await databaseClient.auth.signOut();
    location.reload();
  }

  // ============================================================================
  // MAIN EDITOR SETUP (only reached for allowed roles)
  // ============================================================================

  async function showEditorForUser(session, role) {
    accessDeniedEl.hidden = true;
    mainContentEl.hidden = false;

    authBarEl.innerHTML = `<span class="signed-in-as">${session.user.email} <em>(${role})</em></span> <button id="signout-btn" type="button" class="reset">Sign out</button>`;
    document.getElementById('signout-btn').addEventListener('click', signOut);

    // database.js helpers — caches thaats/pitchclasses/etc (loadMusicData) and
    // angs/samays/creators/popularity/taanpuraas (loadRaagMetadata) into window Maps,
    // and builds the notation lookup tables used by intArray2string/string2intArray.
    await loadMusicData();
    await loadDisplayData();

    // Schema metadata — fetch just the raags table schema from information_schema
    // (no custom views needed — this is lightweight and direct)
    await loadRaagsSchema();

    buildEditableColumnList();
    buildPcReverse();
    buildRaagsIndex(await fetchAllRaagsIndex());

    wireFilterBar();
    wireNavigation();
    wireNotationSelector();
    wireSaveButton();

    footerInfoEl.textContent = editableColumns.length + ' human-editable field(s) detected on raags';

    // Default view: no filters applied yet = everything matches (mirrors
    // advanced.js's initial "All raags" state). Apply narrows it from here.
    renderMatches(computeMatches());

    const params = new URLSearchParams(location.search);
    const requestedId = parseInt(params.get('raag'), 10);
    const startId = Number.isInteger(requestedId) ? requestedId : (matchedIds[0] ?? 1);
    await loadRaag(startId);
  }

  // Reads window.raagsTableMeta.columns (fetched by loadRaagsSchema), parses
  // every column's comment, and keeps only source=human columns, sorted by
  // the order tag.
  function buildEditableColumnList() {
    if (!window.raagsTableMeta || !window.raagsTableMeta.columns) {
      throw new Error('raagsTableMeta not loaded — did loadRaagsSchema() succeed?');
    }

    editableColumns = window.raagsTableMeta.columns
      .map(col => ({ col, tag: parseColumnTag(col.column_comment) }))
      .filter(entry => entry.tag && entry.tag.source === 'human')
      .sort((a, b) => a.tag.order - b.tag.order);

    if (editableColumns.length === 0) {
      console.warn(
        'No columns on raags are tagged "human" in the order|source|display|visibility|description ' +
        'format. Add comments to the raags table columns in your Supabase SQL Editor, e.g.: ' +
        'COMMENT ON COLUMN public.raags.name IS \'2|human|englishText|1|Phonetic Roman spelling\''
      );
    }
  }

  // ============================================================================
  // RAAG LOADING + READ-ONLY CONTEXT
  // ============================================================================

  async function loadRaag(id) {
    const { data, error } = await databaseClient.from(RAAGS_TABLE).select('*').eq('id', id).single();
    if (error || !data) {
      alert('Raag #' + id + ' not found' + (error ? (': ' + error.message) : '.'));
      return;
    }
    currentRaagId = id;
    currentRaagRow = data;
    highlightCurrentMatch();
    renderContext();
    renderEditTable();
  }

  function renderContext() {
    // getCachedTableData() is defensive by design (returns an "ERROR! ..." string
    // rather than throwing), so we fall back to the raw id if thaats/name isn't available.
    const thaatLookup = getCachedTableData('thaats', currentRaagRow.thaat_id, 'name');
    const thaatLabel = (typeof thaatLookup === 'string' && !thaatLookup.startsWith('ERROR'))
      ? thaatLookup
      : ('Thaat #' + (currentRaagRow.thaat_id ?? '—'));

    raagContextEl.innerHTML = `
      <span><strong>Raag #${currentRaagRow.id}</strong></span>
      <span>Aaroh: ${currentRaagRow.aaroh ? intArray2string(currentRaagRow.aaroh) : '—'}</span>
      <span>Avaroh: ${currentRaagRow.avaroh ? intArray2string(currentRaagRow.avaroh) : '—'}</span>
      <span>Dimension: ${currentRaagRow.dimension ?? '—'}</span>
      <span>Thaat: ${thaatLabel}</span>
      <span>Scientific ID: ${currentRaagRow.scientific_id ?? '—'}</span>
    `;
  }

  // ============================================================================
  // DYNAMIC EDIT TABLE
  // ============================================================================

  function renderEditTable() {
    editTableBodyEl.innerHTML = '';
    fieldState.clear();
    lockedDisplays.length = 0;

    if (editableColumns.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" class="status">No human-source columns found — see console.</td>';
      editTableBodyEl.appendChild(tr);
      return;
    }

    for (const { col, tag } of editableColumns) {
      const tr = document.createElement('tr');

      const tdLabel = document.createElement('td');
      tdLabel.className = 'prop-label';
      tdLabel.innerHTML = `<strong>${col.column_name}</strong><div class="prop-desc">${cleanDescription(tag.description)}</div>`;

      const tdValue = document.createElement('td');
      const tdStatus = document.createElement('td');
      tdStatus.className = 'status-cell';

      const rawValue = currentRaagRow[col.column_name];
      const isLocked = LOCKED_IF_SET.has(col.column_name) && rawValue !== null && rawValue !== undefined;

      if (isLocked) {
        const span = document.createElement('span');
        span.className = 'locked-value';
        span.textContent = Array.isArray(rawValue) ? intArray2string(rawValue) : String(rawValue);
        tdValue.appendChild(span);
        setStatus(tdStatus, 'locked', 'Locked (set by generator)');
        lockedDisplays.push({ el: span, rawValue });

        tr.append(tdLabel, tdValue, tdStatus);
        editTableBodyEl.appendChild(tr);
        continue; // not part of fieldState — nothing to save here
      }

      let widget;
      let widgetType;

	  // Check if this column is a foreign key (metadata from the view)
      const colMeta = window.raagsTableMeta.columnsByName.get(col.column_name);
      const hasFk = colMeta && colMeta.is_fk;

      if (hasFk) {
        widget = buildForeignKeySelect(col, rawValue);
        widgetType = 'fk';
      } else if (tag.display === 'notation1D' || tag.display === 'notationArray') {
        widget = buildNotationInput(rawValue);
        widgetType = 'notation';
      } else if (tag.display === 'number') {
        widget = buildTextLikeInput(rawValue);
        widgetType = 'number';
      } else {
        // englishText, hindustaaneeText, special, or anything else not yet special-cased
        widget = buildTextLikeInput(rawValue);
        widgetType = 'text';
      }

      widget.dataset.column = col.column_name;
      tdValue.appendChild(widget);
      tr.append(tdLabel, tdValue, tdStatus);
      editTableBodyEl.appendChild(tr);

      fieldState.set(col.column_name, {
        col, tag, input: widget, statusEl: tdStatus, widgetType,
        lastSavedValue: rawValue ?? null,
        parsedValue: undefined,
        isValid: true,
        lastAlertedValue: null
      });

      widget.addEventListener('blur', () => validateField(col.column_name));
      widget.addEventListener('change', () => validateField(col.column_name)); // selects: 'change' is the reliable event

      validateField(col.column_name); // paint initial status
    }
  }

  // ── widget builders ─────────────────────────────────────────────────────

  function buildTextLikeInput(rawValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = (rawValue === null || rawValue === undefined) ? '' : String(rawValue);
    return input;
  }

  function buildNotationInput(rawValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.placeholder = 'e.g. S R G M P D N';
    input.value = Array.isArray(rawValue) ? intArray2string(rawValue) : '';
    return input;
  }

  // Uses populateSelectMenu() from database.js against the cached Map matching the
  // FK's referenced table. 
  function buildForeignKeySelect(col, rawValue) {
    const select = document.createElement('select');
    select.className = 'name-input';

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— None —';
    select.appendChild(noneOpt);

    // Get FK info from the column metadata (populated by loadRaagsSchema)
    const colMeta = window.raagsTableMeta.columnsByName.get(col.column_name);
    if (!colMeta || !colMeta.is_fk || !colMeta.referenced_table) {
      console.warn('buildForeignKeySelect: column ' + col.column_name + ' has no FK info');
      select.value = rawValue || '';
      return select;
    }

    const referencedTable = colMeta.referenced_table;
    const sourceMap = window[referencedTable];

    if (sourceMap instanceof Map) {
      populateSelectMenu(select, sourceMap, 'name');
    } else {
      console.warn(
        'buildForeignKeySelect: no cached Map at window.' + referencedTable +
        ' — make sure it\'s loaded in loadMusicData() or loadDisplayData()'
      );
    }

    select.value = (rawValue === null || rawValue === undefined) ? '' : String(rawValue);
    return select;
  }
  
  
  // ============================================================================
  // VALIDATION (onBlur / onChange) — sets Status column only, does not save
  // ============================================================================

  function setStatus(statusEl, stateClass, text) {
    statusEl.className = 'status-cell status-' + stateClass;
    statusEl.textContent = text;
  }

  function validateField(columnName) {
    const state = fieldState.get(columnName);
    if (!state) return;

    const { input, statusEl, widgetType } = state;
    const raw = input.value;

    if (widgetType === 'fk') {
      if (raw === '') {
        state.parsedValue = null; state.isValid = true;
        setStatus(statusEl, 'empty', 'Empty');
        return;
      }
      state.parsedValue = parseInt(raw, 10); state.isValid = true;
      setStatus(statusEl, 'valid', 'Valid');
      return;
    }

    if (widgetType === 'notation') {
      const trimmed = raw.trim();
      if (trimmed === '') {
        state.parsedValue = null; state.isValid = true;
        setStatus(statusEl, 'empty', 'Empty');
        return;
      }
      const cleaned = cleanNotationString(trimmed);
      const invalidTokens = flagInvalidNotation(cleaned);
      if (invalidTokens.length > 0) {
        state.isValid = false;
        setStatus(statusEl, 'invalid', 'Invalid: ' + invalidTokens.join(', '));
        if (state.lastAlertedValue !== trimmed) {
          errorAlert(input, invalidTokens.join(', ')); // this is the one place errorAlert()'s wording (about notation) is accurate
          state.lastAlertedValue = trimmed;
        }
        return;
      }
      state.parsedValue = string2intArray(cleaned); state.isValid = true;
      setStatus(statusEl, 'valid', 'Valid');
      return;
    }

    if (widgetType === 'number') {
      const trimmed = raw.trim();
      if (trimmed === '') {
        state.parsedValue = null; state.isValid = true;
        setStatus(statusEl, 'empty', 'Empty');
        return;
      }
      const n = Number(trimmed);
      if (Number.isNaN(n)) {
        state.isValid = false;
        setStatus(statusEl, 'invalid', 'Not a number');
        return;
      }
      state.parsedValue = n; state.isValid = true;
      setStatus(statusEl, 'valid', 'Valid');
      return;
    }

    // plain text (englishText / hindustaaneeText / special / fallback)
    const trimmed = raw.trim();
    if (trimmed === '') {
      state.parsedValue = null; state.isValid = true;
      setStatus(statusEl, 'empty', 'Empty');
      return;
    }
    state.parsedValue = trimmed; state.isValid = true;
    setStatus(statusEl, 'valid', 'Valid');
  }

  // ============================================================================
  // SAVE
  // ============================================================================

  function wireSaveButton() {
    document.getElementById('save-btn').addEventListener('click', saveChanges);
  }

  function valuesDiffer(a, b) {
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  }

  async function saveChanges() {
    const payload = {};
    const blockers = [];

    for (const [columnName, state] of fieldState) {
      validateField(columnName); // re-validate in case a field was never blurred

      if (!state.isValid) {
        blockers.push(columnName);
        continue;
      }
      if (valuesDiffer(state.parsedValue, state.lastSavedValue)) {
        payload[columnName] = state.parsedValue;
      }
    }

    if (blockers.length > 0) {
      saveStatusEl.textContent = 'Fix invalid field(s) before saving: ' + blockers.join(', ');
      saveStatusEl.className = 'save-status status-invalid';
      return;
    }

    if (Object.keys(payload).length === 0) {
      saveStatusEl.textContent = 'Nothing to save.';
      saveStatusEl.className = 'save-status status-empty';
      return;
    }

    saveStatusEl.textContent = 'Saving…';
    saveStatusEl.className = 'save-status status-saving';

    const { error } = await databaseClient.from(RAAGS_TABLE).update(payload).eq('id', currentRaagId);

    if (error) {
      saveStatusEl.textContent = 'Save failed: ' + error.message;
      saveStatusEl.className = 'save-status status-error';
      return;
    }

    for (const columnName of Object.keys(payload)) {
      fieldState.get(columnName).lastSavedValue = payload[columnName];
      currentRaagRow[columnName] = payload[columnName];
    }
    saveStatusEl.textContent = 'Saved ' + Object.keys(payload).length + ' field(s) ✓ — ' + new Date().toLocaleTimeString();
    saveStatusEl.className = 'save-status status-saved';
  }

  // ============================================================================
  // NAVIGATION + NOTATION SWITCHING
  // ============================================================================

  // Prev/Next/Next-Unnamed all operate on matchedIds — the last-applied filter
  // result (or "everything" if no filter has been applied/it's been Reset).
  // This means filtering the svar/status/dimension/jaati fields and hitting
  // Apply also narrows what Prev/Next/Next-Unnamed step through.
  function wireNavigation() {
    prevBtnEl.addEventListener('click', () => {
      const i = matchedIds.indexOf(currentRaagId);
      if (i > 0) loadRaag(matchedIds[i - 1]);
    });

    nextBtnEl.addEventListener('click', () => {
      const i = matchedIds.indexOf(currentRaagId);
      if (i !== -1 && i < matchedIds.length - 1) loadRaag(matchedIds[i + 1]);
    });

    nextUnnamedBtnEl.addEventListener('click', () => {
      // Local search over allRaagsIndex — no network round-trip, and this is
      // what makes it actually reliable (the old version's live query wasn't
      // firing correctly). Only considers raags within the current match set.
      const matchSet = new Set(matchedIds);
      const indexed = allRaagsIndex.filter(r => matchSet.has(r.id));

      const afterCurrent = indexed.find(r => r.id > currentRaagId && !r.hasName);
      const found = afterCurrent || indexed.find(r => !r.hasName); // wrap around

      if (!found) {
        alert('No unnamed raags found in the current match set — all done!');
        return;
      }
      loadRaag(found.id);
    });
  }

  // Re-paints only the notation-flavoured widgets in place (using each field's
  // current parsed value, not the original DB value) so switching notation
  // systems never discards unsaved edits in other fields.
  function wireNotationSelector() {
    notationSelectEl.addEventListener('change', (e) => {
      setNotationSystem(parseInt(e.target.value, 10));
      renderContext();

      for (const { el, rawValue } of lockedDisplays) {
        el.textContent = Array.isArray(rawValue) ? intArray2string(rawValue) : String(rawValue);
      }
      for (const [, state] of fieldState) {
        if (state.widgetType !== 'notation') continue;
        const arr = state.parsedValue !== undefined ? state.parsedValue : currentRaagRow[state.col.name];
        state.input.value = Array.isArray(arr) ? intArray2string(arr) : '';
      }
    });
  }

  // ── boot ─────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    checkAccessAndInit().catch(err => {
      console.error(err);
      alert('Setup error: ' + err.message);
    });
  });

})();
