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
const GITHUB_PAT           = process.env.VITE_GITHUB_PAT;
const HOLDINGS_CSV_URL     = 'https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/data/processed/holdings_latest.csv';

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

async function handleRunReconciler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const startMs = Date.now();

  try {
    // ── 1. Parallel fetch: CSV + all schemes + amcs + existing map ────────────
    const [csvText, allSchemes, allAmcs, existingMap] = await Promise.all([
      fetch(HOLDINGS_CSV_URL, {
        headers: {
          Authorization: `token ${GITHUB_PAT}`,
          Accept:        'application/vnd.github.v3.raw',
        },
      }).then(r => {
        if (!r.ok) throw new Error(`GitHub CSV ${r.status}`);
        return r.text();
      }),
      sbFetch('schemes?select=amfi_code,name,amc_id&is_active=eq.true&limit=20000'),
      sbFetch('amcs?select=id,name'),
      sbFetch('scheme_code_map?select=amc_id,scheme_code_amc,mapped_by&limit=10000'),
    ]);

    // ── 2. Build lookup structures ────────────────────────────────────────────

    // amc name → id and amc id → name
    const amcIdByName   = {};
    const amcNameById   = {};
    for (const a of (allAmcs || [])) {
      amcIdByName[a.name] = a.id;
      amcNameById[a.id]   = a.name;
    }

    // already-mapped set: skip these (any mapped_by)
    const alreadyMapped = new Set();
    for (const r of (existingMap || [])) {
      alreadyMapped.add(`${r.amc_id}|||${r.scheme_code_amc}`);
    }

    // schemes grouped by amc_id: {amc_id: [{amfi_code, name}]}
    const schemesByAmc = {};
    for (const s of (allSchemes || [])) {
      if (!schemesByAmc[s.amc_id]) schemesByAmc[s.amc_id] = [];
      schemesByAmc[s.amc_id].push({ amfi_code: s.amfi_code, name: s.name });
    }

    // ── 3. Parse CSV → distinct (amc_id, scheme_code_amc) pairs ──────────────
    const lines     = csvText.trim().split('\n');
    const header    = parseCsvLine(lines[0]).map(h => h.trim());
    const amcIdx    = header.indexOf('amc_name');
    const codeIdx   = header.indexOf('scheme_code_amc');

    if (amcIdx < 0 || codeIdx < 0) {
      return res.status(500).json({ ok: false, error: 'CSV missing amc_name or scheme_code_amc column' });
    }

    const distinctCodes = new Map(); // "amc_id|||code" → {amc_id, code, amc_name}
    for (let i = 1; i < lines.length; i++) {
      const parts   = parseCsvLine(lines[i]);
      const amcName = parts[amcIdx]?.trim();
      const code    = parts[codeIdx]?.trim();
      if (!amcName || !code) continue;

      const amcId = amcIdByName[amcName];
      if (!amcId) continue;

      const key = `${amcId}|||${code}`;
      if (!distinctCodes.has(key)) distinctCodes.set(key, { amc_id: amcId, code, amc_name: amcName });
    }

    // ── 4. Match each unmapped code against its AMC's schemes ────────────────
    const proposals    = [];
    let countExact     = 0;
    let countFuzzy     = 0;
    let countNoMatch   = 0;
    const examples     = [];   // up to 10 for the summary report

    const now = new Date().toISOString();

    for (const [key, { amc_id, code, amc_name }] of distinctCodes) {
      if (alreadyMapped.has(key)) continue;

      const candidates = schemesByAmc[amc_id] || [];
      if (candidates.length === 0) { countNoMatch++; continue; }

      const match = findBestMatch(code, candidates);

      if (!match) {
        countNoMatch++;
        continue;
      }

      const mappedBy = match.score === 100 ? 'auto_exact' : 'auto_fuzzy_pending';
      if (match.score === 100) countExact++;
      else countFuzzy++;

      proposals.push({
        amc_id,
        scheme_code_amc: code,
        amfi_code:       match.amfi_code,
        mapped_by:       mappedBy,
        confidence:      match.score,
        mapped_at:       now,
      });

      if (examples.length < 10) {
        examples.push({
          amc:          amc_name,
          code,
          matched_name: extractBaseName(match.matchedName),
          score:        match.score,
          mapped_by:    mappedBy,
        });
      }
    }

    // ── 5. Insert proposals in batches (ignore conflicts = already mapped) ───
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < proposals.length; i += BATCH) {
      await sbFetch(
        'scheme_code_map?on_conflict=amc_id,scheme_code_amc',
        'POST',
        proposals.slice(i, i + BATCH)
      );
      inserted += Math.min(BATCH, proposals.length - i);
    }

    const elapsedMs = Date.now() - startMs;

    return res.status(200).json({
      ok:              true,
      inserted,
      stats: {
        total_distinct_codes: distinctCodes.size,
        already_mapped:       (existingMap || []).length,
        auto_exact:           countExact,
        auto_fuzzy_pending:   countFuzzy,
        no_match:             countNoMatch,
        schemes_in_db:        (allSchemes || []).length,
      },
      examples,
      elapsed_ms: elapsedMs,
    });

  } catch (err) {
    console.error('[cell-c?action=run-reconciler]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
