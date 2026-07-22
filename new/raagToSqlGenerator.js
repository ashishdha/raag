/**
 * Builds a single `INSERT INTO raags (...) VALUES (...);` statement from a
 * Raag instance, ready to paste straight into the Supabase SQL Editor.
 *
 * The column list is derived generically from Object.keys(currentRaag) —
 * it automatically includes every property your class has, in declaration
 * order, with no hand-kept column list to fall out of sync.
 *
 * @param {object} currentRaag  Your Raag class instance.
 * @param {string} [tableName]  Defaults to 'raags'.
 * @returns {string} A complete, ready-to-run SQL statement.
 */
function generateRaagInsertSQL(currentRaag, tableName) {
  tableName = tableName || 'raags';

  // Columns that exist only for the database itself to fill in — never
  // written by this tool. Add to this list if your class ever grows a
  // property mirroring one of these.
  const EXCLUDE_COLUMNS = new Set([
    'id', 'scientific_id', 'search_vector', 'created_at'
  ]);

  // Columns stored as JSONB 2D arrays per raag_table_create_final.sql —
  // always written as a JSON literal, even when empty ('[]'), never as a
  // Postgres array literal ('{}').
  const JSON_COLUMNS = new Set(['saa_pa_chains', 'saa_ga_chains']);

  // Sentinel numbers your ChucK Raag class uses for "not yet computed"
  // (see reset() in Raag_class: -999 / -999.9 for almost everything, and
  // 999 specifically for smallest_jump). These get translated to real SQL
  // NULL, matching your project's "NULL = not yet entered" convention —
  // otherwise an uncalculated raag would insert literal -999s.
  const SENTINEL_NUMBERS = new Set([-999, -999.9, 999]);

  function sqlString(str) {
    return "'" + String(str).replace(/'/g, "''") + "'"; // escape embedded quotes
  }

  function pgArrayLiteral(arr) {
    return "'{" + arr.join(',') + "}'";
  }

  function toSqlValue(key, value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number' && SENTINEL_NUMBERS.has(value)) return 'NULL';

    if (JSON_COLUMNS.has(key)) {
      return sqlString(JSON.stringify(value || []));
    }
    if (Array.isArray(value)) {
      return pgArrayLiteral(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : 'NULL';
    }
    return sqlString(value); // strings, and anything else — quoted
  }

  const columns = [];
  const values = [];

  for (const key of Object.keys(currentRaag)) {
    if (EXCLUDE_COLUMNS.has(key)) continue;
    columns.push(key);
    values.push(toSqlValue(key, currentRaag[key]));
  }

  return 'INSERT INTO ' + tableName + ' (\n  ' + columns.join(',\n  ') +
         '\n) VALUES (\n  ' + values.join(',\n  ') + '\n);';
}

/* ── known limitation ─────────────────────────────────────────────────
   Empty arrays (e.g. an aaroh that hasn't been calculated yet) are written
   as '{}', not NULL — unlike the numeric sentinel case above, there's no
   reliable way to tell "genuinely empty" apart from "not computed yet"
   just by looking at an array's length. Make sure currentRaag has actually
   been calculated before generating SQL from it.
*/
