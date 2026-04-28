// ============================================================
// CALC.JS
// Real-time calculation engine fetching from Supabase
// ============================================================

const SUPABASE_URL = 'https://cxjfqwnmabyabhjhadjy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amZxd25tYWJ5YWJoamhhZGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Njc2NDUsImV4cCI6MjA3MTU0MzY0NX0.qbI-CU_wgAioBihGx54RXpr4cBryhzIjc4C8iT5YAX0';
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

let allScales = [];
let scaleMap = new Map();
let calcTimer = null; // Used to debounce heavy math operations

const SVAR_NAMES = ['S', 'r', 'R', 'g', 'G', 'M', 'm', 'P', 'd', 'D', 'n', 'N'];
function formatAaroh(arr) { return arr ? arr.map(v => SVAR_NAMES[v % 12]).join(' ') : '-'; }
function formatAvaroh(arr) { return arr ? arr.slice().reverse().map(v => SVAR_NAMES[v % 12]).join(' ') : '-'; }

const els = {
  controls: document.getElementById('controls'), dimension: document.getElementById('dimension'), panel2d: document.getElementById('panel2d'),
  count1d: document.getElementById('count1d'), count2d: document.getElementById('count2d'), tally2d: document.getElementById('tally2d'),
  jaatiMin: document.getElementById('jaatiMin'), jaatiMax: document.getElementById('jaatiMax'), maxConsecutive: document.getElementById('maxConsecutive'),
  saaRadios: document.querySelectorAll('input[name="saaPresent"]'), maxBothVariants: document.getElementById('maxBothVariants'),
  angMin: document.getElementById('angMin'), angMax: document.getElementById('angMax'), minSamvaadPa: document.getElementById('minSamvaadPa'),
  minSamvaadMa: document.getElementById('minSamvaadMa'), maxGap: document.getElementById('maxGap'), minSharedOverall: document.getElementById('minSharedOverall'),
  minSharedPoorvaang: document.getElementById('minSharedPoorvaang'), minSharedUttaraang: document.getElementById('minSharedUttaraang'),
  maxJaatiDiff: document.getElementById('maxJaatiDiff'), maxVariantDiff: document.getElementById('maxVariantDiff'),
  displayCount: document.getElementById('displayCount'), displayMode: document.getElementById('displayMode'),
  
  //new filters manually added
  maxDroppedSvar: document.getElementById('maxDroppedSvar'), 
  maxHigherVariant: document.getElementById('maxHigherVariant'),
  
  // Table Targets
  wrapper1D: document.getElementById('wrapper1D'), head1D: document.getElementById('head1D'), body1D: document.getElementById('body1D'), badge1D: document.getElementById('badge1D'),
  wrapper2D: document.getElementById('wrapper2D'), head2D: document.getElementById('head2D'), body2D: document.getElementById('body2D'), badge2D: document.getElementById('badge2D')
};

// Map inputs strictly to their label IDs to prevent overwriting <select> tags
const labelMap = {
  jaatiMin: 'valJaatiMin', jaatiMax: 'valJaatiMax', maxConsecutive: 'valConsecutive', maxBothVariants: 'valVariants',
  angMin: 'valAngMin', angMax: 'valAngMax', minSamvaadPa: 'valPa', minSamvaadMa: 'valMa', maxGap: 'valGap',
  minSharedOverall: 'valSharedOverall', minSharedPoorvaang: 'valSharedPoor', minSharedUttaraang: 'valSharedUtt',
  maxJaatiDiff: 'valJaatiDiff', maxVariantDiff: 'valVariantDiff', maxDroppedSvar: 'valDroppedSvar', 
  maxHigherVariant: 'valHigherVariant'
};

const POORVAANG_MASK = 126; 
const UTTARAANG_MASK = 3968; 
const VARIANT_PAIR_MASKS = [6, 24, 96, 768, 3072]; 
const GENERIC_MASKS = [1, 6, 24, 96, 128, 768, 3072]; // Sa, Re, Ga, Ma, Pa, Dha, Ni
const LOWER_BITS = [2, 8, 32, 256, 1024]; // r, g, m, d, n
const HIGHER_BITS = [4, 16, 64, 512, 2048]; // R, G, M, D, N

function countBits(n) { let count = 0; while (n) { count += n & 1; n >>= 1; } return count; }

async function fetchAllScales() {
  const selectCols = 'id,jaati,consecutive_varjit_svar,saa_present,both_variants,ang_balance,samvaad_at_pa,samvaad_at_ma,largest_gap,aaroh,thaat,shuddhataa_rank';
  const PAGE = 1000;
  let all = [], from = 0;
  try {
    while (true) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scales?select=${selectCols}&order=id.asc&offset=${from}&limit=${PAGE}`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const page = await res.json();
      all = all.concat(page);
      if (page.length < PAGE) break;
      from += PAGE;
    }
    all.forEach(s => scaleMap.set(s.id, s));
    return all;
  } catch (error) { els.count1d.innerHTML = `<span style="color:red; font-size:1rem;">DB Error</span>`; return []; }
}

function isValid1D(s, filters) {
  if (s.jaati < filters.jMin || s.jaati > filters.jMax) return false;
  if (s.consecutive_varjit_svar > filters.consecMax) return false;
  if (filters.saaState !== "any" && s.saa_present !== parseInt(filters.saaState)) return false;
  if (s.both_variants > filters.bothVarMax) return false;
  if (s.ang_balance < filters.aMin || s.ang_balance > filters.aMax) return false;
  if ((s.samvaad_at_pa || 0) < filters.pMin) return false;
  if ((s.samvaad_at_ma || 0) < filters.mMin) return false;
  if (s.largest_gap > filters.gapMax) return false;
  return true;
}

function check2DConstraints(aaroh, avaroh, filters) {
  if (Math.abs(aaroh.jaati - avaroh.jaati) > filters.maxJDiff) return { valid: false };
  const intersection = aaroh.id & avaroh.id;
  const commonTotal = countBits(intersection);
  if (commonTotal < filters.minShOv) return { valid: false };
  if (countBits(intersection & POORVAANG_MASK) < filters.minShPo) return { valid: false };
  if (countBits(intersection & UTTARAANG_MASK) < filters.minShUt) return { valid: false };

  let variantDiffs = 0;
  for (let m = 0; m < VARIANT_PAIR_MASKS.length; m++) {
    const mask = VARIANT_PAIR_MASKS[m];
    const aBits = aaroh.id & mask;
    const vBits = avaroh.id & mask;
    if (aBits > 0 && vBits > 0 && (aBits & vBits) === 0) variantDiffs++;
  }
  
  if (variantDiffs > filters.maxVarDiff) return { valid: false };

  // Check Dropped Svar
  let droppedSvar = 0;
  for (let m = 0; m < GENERIC_MASKS.length; m++) {
    if ((aaroh.id & GENERIC_MASKS[m]) > 0 && (avaroh.id & GENERIC_MASKS[m]) === 0) droppedSvar++;
  }
  if (droppedSvar > filters.maxDroppedSvar) return { valid: false };

  // Check Higher Variant in Avaroh
  let higherVariants = 0;
  for (let m = 0; m < VARIANT_PAIR_MASKS.length; m++) {
    // If Aaroh has exactly and ONLY the lower variant...
    if ((aaroh.id & VARIANT_PAIR_MASKS[m]) === LOWER_BITS[m]) {
      // ...and Avaroh possesses the higher variant
      if ((avaroh.id & HIGHER_BITS[m]) > 0) higherVariants++;
    }
  }
  if (higherVariants > filters.maxHigherVariant) return { valid: false };

  return { valid: true, commonTotal, variantDiffs, droppedSvar, higherVariants };  
}

// ── ENGINE (Debounced to prevent browser lockup) ─────────────
function scheduleCalculation() {
  // Show UI feedback instantly while math waits in queue
  els.count1d.innerHTML = '<span style="color:#9ca3af;">...</span>';
  if (els.dimension.value === '2') els.count2d.innerHTML = '<span style="color:#9ca3af;">...</span>';
  
  clearTimeout(calcTimer);
  calcTimer = setTimeout(executeCalculation, 25); // Yields thread to browser to draw updates
}

function executeCalculation() {
  if (!allScales.length) return;

  const is2D = els.dimension.value === '2';
  const reqCount = parseInt(els.displayCount.value) || 10;
  const dispMode = els.displayMode.value;

  let saaState = "any"; els.saaRadios.forEach(r => { if (r.checked) saaState = r.value; });
  const f = {
    jMin: parseInt(els.jaatiMin.value), jMax: parseInt(els.jaatiMax.value), consecMax: parseInt(els.maxConsecutive.value),
    bothVarMax: parseInt(els.maxBothVariants.value), aMin: parseInt(els.angMin.value), aMax: parseInt(els.angMax.value),
    pMin: parseFloat(els.minSamvaadPa.value), mMin: parseFloat(els.minSamvaadMa.value), gapMax: parseInt(els.maxGap.value),
    saaState: saaState, minShOv: parseInt(els.minSharedOverall.value), minShPo: parseInt(els.minSharedPoorvaang.value),
    minShUt: parseInt(els.minSharedUttaraang.value), maxJDiff: parseInt(els.maxJaatiDiff.value), maxVarDiff: parseInt(els.maxVariantDiff.value), maxDroppedSvar: parseInt(els.maxDroppedSvar.value), maxHigherVariant: parseInt(els.maxHigherVariant.value)
  };

  // 1D Filter
  const viable1D = [];
  for (let i = 0; i < allScales.length; i++) {
    if (isValid1D(allScales[i], f)) viable1D.push(allScales[i]);
  }
  els.count1d.innerText = viable1D.length.toLocaleString();

  // Populate 1D Table
  let displayData1D = [];
  if (dispMode === 'first') displayData1D = viable1D.slice(0, reqCount);
  else if (dispMode === 'last') displayData1D = viable1D.slice(-reqCount);
  else if (dispMode === 'random') {
    const seen = new Set();
    let attempts = 0;
    while (displayData1D.length < reqCount && attempts < 100000 && displayData1D.length < viable1D.length) {
      attempts++;
      const rId = Math.floor(Math.random() * 4096);
      if (seen.has(rId)) continue;
      const scale = scaleMap.get(rId);
      if (scale && isValid1D(scale, f)) { displayData1D.push(scale); seen.add(rId); }
    }
  }
  renderTable1D(displayData1D);

  // 2D Logic
  if (!is2D) {
    els.wrapper2D.style.display = 'none';
  } else {
    els.wrapper2D.style.display = 'block';
    let valid2DCount = 0;
    let displayData2D = [];
    const len = viable1D.length;

    if (dispMode === 'random') {
      for (let i = 0; i < len; i++) {
        for (let j = 0; j < len; j++) {
          if (i === j) continue;
          if (check2DConstraints(viable1D[i], viable1D[j], f).valid) valid2DCount++;
        }
      }
      const seen = new Set();
      let attempts = 0;
      while (displayData2D.length < reqCount && attempts < 200000 && displayData2D.length < valid2DCount) {
        attempts++;
        const idA = Math.floor(Math.random() * 4096);
        const idV = Math.floor(Math.random() * 4096);
        if (idA === idV) continue;
        const key = idA + '-' + idV;
        if (seen.has(key)) continue;
        const aaroh = scaleMap.get(idA);
        const avaroh = scaleMap.get(idV);
        if (aaroh && avaroh && isValid1D(aaroh, f) && isValid1D(avaroh, f)) {
          const check = check2DConstraints(aaroh, avaroh, f);
          if (check.valid) { displayData2D.push({ aaroh, avaroh, ...check }); seen.add(key); }
        }
      }
    } else {
      // First or Last mode
      for (let i = 0; i < len; i++) {
        for (let j = 0; j < len; j++) {
          if (i === j) continue;
          const check = check2DConstraints(viable1D[i], viable1D[j], f);
          if (check.valid) {
            valid2DCount++;
            if (dispMode === 'first' && displayData2D.length < reqCount) {
              displayData2D.push({ aaroh: viable1D[i], avaroh: viable1D[j], ...check });
            } else if (dispMode === 'last') {
              displayData2D.push({ aaroh: viable1D[i], avaroh: viable1D[j], ...check });
              if (displayData2D.length > reqCount) displayData2D.shift();
            }
          }
        }
      }
    }

    els.count2d.innerText = valid2DCount.toLocaleString();
    renderTable2D(displayData2D);
  }
}

// ── RENDERS ─────────────────────────────────────────────────
function renderTable1D(data) {
  els.badge1D.innerText = `Showing ${data.length}`;
  els.head1D.innerHTML = `<tr><th>ID</th><th>Aaroh</th><th>Jaati</th><th>Thaat</th><th>Shuddh Rank</th><th>Samvaad @ Pa</th></tr>`;
  els.body1D.innerHTML = data.map(r => `
    <tr><td>${r.id}</td><td class="svar-text">${formatAaroh(r.aaroh)}</td><td>${r.jaati ?? '-'}</td><td>${r.thaat ?? '-'}</td><td>${r.shuddhataa_rank ?? '-'}</td><td>${r.samvaad_at_pa ?? '-'}</td></tr>
  `).join('');
}

function renderTable2D(data) {
  els.badge2D.innerText = `Showing ${data.length}`;
  els.head2D.innerHTML = `<tr><th>ID Pair</th><th>Aaroh</th><th>Avaroh</th><th>Jaati</th><th>Shared</th><th>Variant Switch</th><th>Dropped</th><th>High Av.</th><th>Thaat</th></tr>`;
  els.body2D.innerHTML = data.map(r => `
    <tr>
      <td>${r.aaroh.id} / ${r.avaroh.id}</td>
      <td class="svar-text" style="color:#047857;">${formatAaroh(r.aaroh.aaroh)}</td>
      <td class="svar-text" style="color:#b91c1c;">${formatAvaroh(r.avaroh.aaroh)}</td>
      <td>${r.aaroh.jaati} / ${r.avaroh.jaati}</td>
      <td><b>${r.commonTotal}</b></td>
      <td><b>${r.variantDiffs}</b></td>
      <td><b>${r.droppedSvar}</b></td>
      <td><b>${r.higherVariants}</b></td>
      <td>${r.aaroh.thaat ?? '-'} / ${r.avaroh.thaat ?? '-'}</td>
    </tr>
  `).join('');
}

// ── LISTENERS ───────────────────────────────────────────────
function attachListeners() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', (e) => {
      // Safely update labels
      if (labelMap[e.target.id]) {
        const labelEl = document.getElementById(labelMap[e.target.id]);
        if (labelEl) labelEl.innerText = e.target.value;
      }
      
      // Toggle 2D UI
      if (e.target.id === 'dimension') {
        const is2D = e.target.value === '2';
        els.panel2d.style.display = is2D ? 'block' : 'none';
        els.tally2d.style.display = is2D ? 'block' : 'none';
      }
      
      scheduleCalculation(); // Debounced trigger
    });
  });
}

(async function init() {
  allScales = await fetchAllScales();
  if (allScales.length > 0) {
    els.controls.style.opacity = '1';
    els.controls.style.pointerEvents = 'auto';
    attachListeners();
    scheduleCalculation();
  }
})();