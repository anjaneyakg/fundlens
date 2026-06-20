// api/cell-c.js
// Cell C — Scheme Code Reconciler (frontend-triggered)
//
// Architecture: pure JS Vercel serverless function (no Python subprocess).
// Vercel serverless = Node.js only; Python runtime and subprocess are unavailable.
// All existing API routes in this codebase are pure JS; this matches the pattern.
// The matching algorithm (normalised Levenshtein ratio + token-sort) is implemented
// here in ~60 lines of JS and handles 16K schemes in well under 1 second.
//
// Actions (POST):
//   run-reconciler    — fetch CSV + schemes → fuzzy match → insert auto_fuzzy_pending proposals
// Actions (GET):
//   reconciler-status — counts of pending proposals + total unmapped codes

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CONFIDENCE_THRESHOLD = 92;   // scores below this produce no proposal

const corsHeaders = {
  'Access-Control-Allow-Origin':  'https://fundlens-six.vercel.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Cache-Control', 'no-store');

  const { action } = req.query;

  if (action === 'reconciler-status') return handleStatus(req, res);
  if (action === 'run-reconciler')    return handleRunReconciler(req, res);

  return res.status(400).json({ ok: false, error: 'Unknown action. Valid: reconciler-status, run-reconciler' });
}

// ── Supabase helper ───────────────────────────────────────────────────────────

async function sbFetch(path, method = 'GET', body = null, preferOverride = null) {
  const prefer = preferOverride
    ?? (method === 'POST'  ? 'resolution=ignore-duplicates'
      : method === 'PATCH' ? 'return=minimal'
      : 'count=none');

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (![200, 201, 204].includes(resp.status)) {
    const txt = await resp.text();
    throw new Error(`Supabase ${method} ${path} → ${resp.status}: ${txt}`);
  }
  if (resp.status === 204) return null;
  const txt = await resp.text();
  if (!txt || !txt.trim()) return null;
  return JSON.parse(txt);
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

function extractBaseName(fullName) {
  return (fullName || '')
    .replace(/\s*[-–]\s*(Regular|Direct)\s+Plan.*/i, '')
    .replace(/[-–](Regular|Direct)\s+Plan.*/i, '')
    .replace(/\s+(Regular|Direct)\s+Plan.*/i, '')
    .replace(/\s+(REGULAR|DIRECT)\s+(GROWTH|IDCW|INCOME|DIVIDEND|PAYOUT|REINVESTMENT).*/i, '')
    .trim();
}

function normalizeForMatch(s) {
  return extractBaseName(s)
    .toLowerCase()
    .replace(/[.,;:!?()\[\]]+$/, '')   // strip trailing punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSort(s) {
  return s.split(/\s+/).sort().join(' ');
}

function levenshteinSimilarity(a, b) {
  const m = a.length, n = b.length;
  if (m === 0 && n === 0) return 100;
  if (m === 0 || n === 0) return 0;

  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    for (let k = 0; k <= n; k++) prev[k] = curr[k];
  }
  const dist = prev[n];
  return Math.round((m + n - 2 * dist) / (m + n) * 100);
}

function fuzzyScore(code, candidateName) {
  const a = normalizeForMatch(code);
  const b = normalizeForMatch(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 100;

  const direct = levenshteinSimilarity(a, b);
  const ts     = levenshteinSimilarity(tokenSort(a), tokenSort(b));
  return Math.max(direct, ts);
}

// Given a list of {amfi_code, name} candidates, find the best match for scheme_code_amc.
// Returns {amfi_code, score, matchedName} or null if below threshold.
function findBestMatch(code, candidates) {
  let best = null;
  for (const c of candidates) {
    const score = fuzzyScore(code, c.name);
    if (score >= CONFIDENCE_THRESHOLD && (!best || score > best.score)) {
      best = { amfi_code: c.amfi_code, score, matchedName: c.name };
      if (score === 100) break;   // perfect match — no need to check further
    }
  }
  return best;
}

// ── CSV parser (RFC 4180 state machine) ──────────────────────────────────────

function parseCsvLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ── GET reconciler-status ─────────────────────────────────────────────────────

async function handleStatus(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const [pending, total] = await Promise.all([
      sbFetch('scheme_code_map?select=id&mapped_by=eq.auto_fuzzy_pending'),
      sbFetch('scheme_code_map?select=id'),
    ]);
    return res.status(200).json({
      ok:                true,
      pending_proposals: (pending || []).length,
      total_mapped:      (total   || []).length,
    });
  } catch (err) {
    console.error('[cell-c?action=reconciler-status]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ── POST run-reconciler ───────────────────────────────────────────────────────
//
// Optimisations vs naive approach:
//   1. CSV fetched through /api/holdings-csv (Vercel edge cache, 5-min TTL) — avoids
//      re-downloading 24 MB from GitHub raw on every invocation.
//   2. Schemes fetched per-AMC in parallel (only for AMCs that have unmapped codes),
//      avoiding a single 16 K-row query that may hit PostgREST's db-max-rows cap.
//   3. findBestMatch() exits early when score=100 — critical for scheme_name_from_cell
//      AMCs where the code IS the base name and will match exactly on the first hit.

async function handleRunReconciler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const startMs = Date.now();

  try {
    // ── 1. Parallel fetch: CSV (via Vercel-cached proxy) + amcs + existing map ─
    const csvProxyUrl = `https://${req.headers.host}/api/holdings-csv`;
    const [csvText, allAmcs, existingMap] = await Promise.all([
      fetch(csvProxyUrl).then(r => {
        if (!r.ok) throw new Error(`holdings-csv proxy returned ${r.status}`);
        return r.text();
      }),
      sbFetch('amcs?select=id,name'),
      sbFetch('scheme_code_map?select=amc_id,scheme_code_amc,mapped_by&limit=10000'),
    ]);

    // ── 2. Build lookup structures ────────────────────────────────────────────

    const amcIdByName = {};
    for (const a of (allAmcs || [])) amcIdByName[a.name] = a.id;

    const alreadyMapped = new Set();
    for (const r of (existingMap || [])) {
      alreadyMapped.add(`${r.amc_id}|||${r.scheme_code_amc}`);
    }

    // ── 3. Parse CSV → collect unmapped codes grouped by amc_id ──────────────
    const lines    = csvText.trim().split('\n');
    const header   = parseCsvLine(lines[0]).map(h => h.trim());
    const amcIdx   = header.indexOf('amc_name');
    const codeIdx  = header.indexOf('scheme_code_amc');

    if (amcIdx < 0 || codeIdx < 0) {
      return res.status(500).json({ ok: false, error: 'CSV missing amc_name or scheme_code_amc column' });
    }

    const distinctCodes  = new Map();  // "amc_id|||code" → {amc_id, code, amc_name}
    const unmappedByAmc  = new Map();  // amc_id          → Map(code → amc_name)

    for (let i = 1; i < lines.length; i++) {
      const parts   = parseCsvLine(lines[i]);
      const amcName = parts[amcIdx]?.trim();
      const code    = parts[codeIdx]?.trim();
      if (!amcName || !code) continue;

      const amcId = amcIdByName[amcName];
      if (!amcId) continue;

      const key = `${amcId}|||${code}`;
      if (!distinctCodes.has(key)) {
        distinctCodes.set(key, { amc_id: amcId, code, amc_name: amcName });
      }
      if (!alreadyMapped.has(key)) {
        if (!unmappedByAmc.has(amcId)) unmappedByAmc.set(amcId, new Map());
        unmappedByAmc.get(amcId).set(code, amcName);
      }
    }

    // ── 4. Fetch schemes per AMC in parallel (only AMCs with unmapped codes) ──
    const amcIdsNeeded = [...unmappedByAmc.keys()];
    const schemeResults = await Promise.all(
      amcIdsNeeded.map(amcId =>
        sbFetch(`schemes?select=amfi_code,name&amc_id=eq.${amcId}&is_active=eq.true&limit=5000`)
      )
    );
    const schemesByAmc = {};
    amcIdsNeeded.forEach((amcId, i) => { schemesByAmc[amcId] = schemeResults[i] || []; });

    // ── 5. Match each unmapped code against its AMC's schemes ────────────────
    const proposals  = [];
    let countExact   = 0;
    let countFuzzy   = 0;
    let countNoMatch = 0;
    const examples   = [];
    const now        = new Date().toISOString();

    for (const [amcId, codesMap] of unmappedByAmc) {
      const candidates = schemesByAmc[amcId] || [];
      for (const [code, amc_name] of codesMap) {
        if (candidates.length === 0) { countNoMatch++; continue; }

        const match = findBestMatch(code, candidates);

        if (!match) { countNoMatch++; continue; }

        const mappedBy = match.score === 100 ? 'auto_exact' : 'auto_fuzzy_pending';
        if (match.score === 100) countExact++;
        else countFuzzy++;

        proposals.push({
          amc_id:          amcId,
          scheme_code_amc: code,
          amfi_code:       match.amfi_code,
          mapped_by:       mappedBy,
          confidence:      match.score,
          mapped_at:       now,
        });

        if (examples.length < 10) {
          examples.push({ amc: amc_name, code, matched_name: extractBaseName(match.matchedName), score: match.score, mapped_by: mappedBy });
        }
      }
    }

    // ── 6. Insert proposals in batches (ignore conflicts = already mapped) ───
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < proposals.length; i += BATCH) {
      await sbFetch('scheme_code_map?on_conflict=amc_id,scheme_code_amc', 'POST', proposals.slice(i, i + BATCH));
      inserted += Math.min(BATCH, proposals.length - i);
    }

    return res.status(200).json({
      ok: true,
      inserted,
      stats: {
        total_distinct_codes: distinctCodes.size,
        already_mapped:       alreadyMapped.size,
        auto_exact:           countExact,
        auto_fuzzy_pending:   countFuzzy,
        no_match:             countNoMatch,
        amcs_processed:       amcIdsNeeded.length,
      },
      examples,
      elapsed_ms: Date.now() - startMs,
    });

  } catch (err) {
    console.error('[cell-c?action=run-reconciler]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
