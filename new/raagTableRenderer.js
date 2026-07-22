/**
 * Renders (or re-renders) a table showing every property on a Raag instance.
 *
 * Column 1 — property name (raw key, e.g. "aaroh_jaati")
 * Column 2 — human-readable value.
 *             - Editable properties (see EDITABLE_PROPERTIES below) get a
 *               real <input> the user can type into. On change, the typed
 *               text is parsed back into the property's real type and
 *               written onto currentRaag, then the whole table re-renders.
 *             - Everything else gets a read-only <input> (selectable/
 *               copyable, just can't be typed into) showing the calculated
 *               human-readable value.
 * Column 3 — the raw stored value (numbers/strings as-is, arrays as
 *             "[0, 2, 4, 7, 9, 12]"), always inside a non-editable <output>.
 *
 * Assumes these already exist elsewhere in your code:
 *   - notationMap / reverseNotationMap
 *   - string2intArray(str)  -> int[]   (human sargam string -> raw array)
 *   - intArray2string(arr)  -> string  (raw array -> human sargam string)
 *
 * @param {object}      currentRaag  Your Raag class instance.
 * @param {HTMLElement} containerEl  Empty element to build the table into.
 * @param {function}    [onEdit]     Optional callback(key, newValue), fired
 *                                   right after an editable field is saved
 *                                   onto currentRaag — this is where you'd
 *                                   call your recalculation method (e.g.
 *                                   currentRaag.set(...)) BEFORE the table
 *                                   redraws, so the calculated columns
 *                                   update too. Without this, editing aaroh
 *                                   will only update aaroh — nothing derived
 *                                   from it will recompute.
 */
function renderRaagTable(currentRaag, containerEl, onEdit = null) {

  // ── which properties the user is actually allowed to type into ──────────
  // Adjust this list to match your class. Everything else on currentRaag
  // is treated as calculated / read-only.
  const EDITABLE_PROPERTIES = new Set([
    'name',
    'aaroh',
    'avaroh'
    // add more manually-entered columns here as needed, e.g.:
    // 'carnatic_name', 'alternate_names', 'notes', 'vadi', 'samvaadi'
  ]);

  // ── properties whose value is an array of svar ints, so they need
  // notation conversion rather than being shown/parsed as plain text ──────
  const SVAR_ARRAY_PROPERTIES = new Set([
    'aaroh', 'avaroh', 'varjit_svar', 'varjit_svar_aaroh', 'varjit_svar_avaroh',
    'svarset', 'imperfect_svarsthaan', 'detached_svarsthaan'
  ]);

  // ── helpers ──────────────────────────────────────────────────────────

  function isChainArray(value) {
    // 2D arrays like saa_pa_chains / saa_ga_chains
    return Array.isArray(value) && value.every(v => Array.isArray(v));
  }

  function toHumanReadable(key, value) {
    if (value === null || value === undefined) return '';

    if (isChainArray(value)) {
      return value.map(chain => intArray2string(chain)).join('  |  ');
    }
    if (SVAR_ARRAY_PROPERTIES.has(key) && Array.isArray(value)) {
      return intArray2string(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number' && !Number.isInteger(value)) {
      return value.toFixed(3);
    }
    return String(value);
  }

  function fromHumanReadable(key, text) {
    if (SVAR_ARRAY_PROPERTIES.has(key)) {
      return string2intArray(text);
    }
    return text; // plain text/number fields — used exactly as typed
  }

  function toRawString(value) {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) {
      return '[' + value.map(toRawString).join(', ') + ']';
    }
    return String(value);
  }

  // ── build the table ─────────────────────────────────────────────────

  containerEl.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'raag-props-table';

  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Property</th><th>Value</th><th>Raw Data</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (const key of Object.keys(currentRaag)) {
    const value = currentRaag[key];
    const editable = EDITABLE_PROPERTIES.has(key);

    const row = document.createElement('tr');
    row.className = editable ? 'row-editable' : 'row-calculated';

    // Column 1 — property name
    const nameCell = document.createElement('td');
    nameCell.className = 'prop-name';
    nameCell.textContent = key;
    row.appendChild(nameCell);

    // Column 2 — human-readable, editable or read-only
    const displayCell = document.createElement('td');
    const displayInput = document.createElement('input');
    displayInput.type = 'text';
    displayInput.value = toHumanReadable(key, value);
    displayInput.setAttribute('aria-label', key);

    if (editable) {
      displayInput.addEventListener('change', () => {
        currentRaag[key] = fromHumanReadable(key, displayInput.value);
        if (typeof onEdit === 'function') onEdit(key, currentRaag[key]);
        renderRaagTable(currentRaag, containerEl, onEdit); // redraw with fresh calculated values
      });
    } else {
      displayInput.readOnly = true;
      displayInput.classList.add('calculated');
    }

    displayCell.appendChild(displayInput);
    row.appendChild(displayCell);

    // Column 3 — raw stored value, never editable
    const rawCell = document.createElement('td');
    const rawOutput = document.createElement('output');
    rawOutput.textContent = toRawString(value);
    rawCell.appendChild(rawOutput);
    row.appendChild(rawCell);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  containerEl.appendChild(table);
}

/* ── example wiring ──────────────────────────────────────────────────
renderRaagTable(currentRaag, document.getElementById('raag-table-container'), (key, newValue) => {
  if (key === 'aaroh' || key === 'avaroh') {
    currentRaag.set(currentRaag.aaroh, currentRaag.avaroh); // your recompute call
  }
});
*/
