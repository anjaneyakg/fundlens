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
//   run-reconciler      — fuzzy match codes from request body → insert proposals
//   dry-run-reconciler  — same matching, NO writes; returns full score distribution + near-miss breakdown
// Actions (GET):
//   reconciler-status   — counts of pending proposals + total mapped

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

  if (action === 'reconciler-status')  return handleStatus(req, res);
  if (action === 'run-reconciler')     return handleRunReconciler(req, res);
  if (action === 'dry-run-reconciler') return handleDryRunReconciler(req, res);

  return res.status(400).json({ ok: false, error: 'Unknown action. Valid: reconciler-status, run-reconciler, dry-run-reconciler' });
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
    .replace(/\s*[-–]\s*$/, '')        // Fix 3: strip trailing standalone dash left by pattern-4 strip
    .trim();
}

function normalizeForMatch(s) {
  return extractBaseName(s)
    .replace(/\s+-\s+/g, ' ')          // Fix 1: " - " separator → space (UTI pattern)
    .toLowerCase()
    .replace(/[.,;:!?()\[\]]+$/, '')   // strip trailing punctuation
    .replace(/\s+plan$/i, '')          // Fix 2: strip trailing sub-plan label (e.g. "Hybrid Aggressive Plan")
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
// The frontend sends distinct {amc_name, scheme_code_amc} pairs extracted from
// the already-loaded holdings CSV — this avoids a 24 MB download inside the
// serverless function, which would exceed Vercel's Hobby plan timeout.
//
// Server-side work: resolve amc_id, skip already-mapped codes, fetch schemes
// per relevant AMC in parallel, fuzzy-match each code, insert proposals.

async function handleRunReconciler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const startMs = Date.now();

  try {
    // ── 1. Read distinct codes from request body ──────────────────────────────
    const { codes } = req.body || {};
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ ok: false, error: 'Request body must include codes: [{amc_name, scheme_code_amc}]' });
    }

    // ── 2. Parallel fetch: amcs + existing map ────────────────────────────────
    const [allAmcs, existingMap] = await Promise.all([
      sbFetch('amcs?select=id,name'),
      sbFetch('scheme_code_map?select=amc_id,scheme_code_amc,mapped_by&limit=10000'),
    ]);

    const amcIdByName = {};
    for (const a of (allAmcs || [])) amcIdByName[a.name] = a.id;

    const alreadyMapped = new Set();
    for (const r of (existingMap || [])) {
      alreadyMapped.add(`${r.amc_id}|||${r.scheme_code_amc}`);
    }

    // ── 3. Resolve amc_id for each code, group unmapped codes by AMC ─────────
    const unmappedByAmc = new Map();   // amc_id → Map(code → amc_name)
    let totalDistinct   = 0;

    for (const { amc_name, scheme_code_amc: code } of codes) {
      if (!amc_name || !code) continue;
      const amcId = amcIdByName[amc_name];
      if (!amcId) continue;
      totalDistinct++;

      const key = `${amcId}|||${code}`;
      if (!alreadyMapped.has(key)) {
        if (!unmappedByAmc.has(amcId)) unmappedByAmc.set(amcId, new Map());
        unmappedByAmc.get(amcId).set(code, amc_name);
      }
    }

    // ── 4. Fetch schemes per AMC in parallel (only AMCs with unmapped codes) ──
    const amcIdsNeeded  = [...unmappedByAmc.keys()];
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
        total_distinct_codes: totalDistinct,
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

// ── POST dry-run-reconciler ───────────────────────────────────────────────────
//
// Identical setup to run-reconciler but NO inserts.
// Scores every unmapped code without the CONFIDENCE_THRESHOLD filter so we can
// see the full distribution and identify near-misses just below the threshold.
//
// Returns:
//   distribution  — counts by score bucket (95-100, 92-94, 85-91, 70-84, <70)
//   totals        — would_auto_exact, would_fuzzy_pending, would_no_match
//   near_miss_amcs — AMCs with ≥1 code in the 85-91 range, with sample triples

async function handleDryRunReconciler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const startMs = Date.now();

  try {
    const { codes } = req.body || {};
    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ ok: false, error: 'Request body must include codes: [{amc_name, scheme_code_amc}]' });
    }

    const [allAmcs, existingMap] = await Promise.all([
      sbFetch('amcs?select=id,name'),
      sbFetch('scheme_code_map?select=amc_id,scheme_code_amc,mapped_by&limit=10000'),
    ]);

    const amcIdByName = {};
    const amcNameById = {};
    for (const a of (allAmcs || [])) { amcIdByName[a.name] = a.id; amcNameById[a.id] = a.name; }

    const alreadyMapped = new Set();
    for (const r of (existingMap || [])) alreadyMapped.add(`${r.amc_id}|||${r.scheme_code_amc}`);

    const unmappedByAmc   = new Map();
    let totalDistinct     = 0;
    let alreadyMappedCount = 0;

    for (const { amc_name, scheme_code_amc: code } of codes) {
      if (!amc_name || !code) continue;
      const amcId = amcIdByName[amc_name];
      if (!amcId) continue;
      totalDistinct++;
      const key = `${amcId}|||${code}`;
      if (alreadyMapped.has(key)) { alreadyMappedCount++; continue; }
      if (!unmappedByAmc.has(amcId)) unmappedByAmc.set(amcId, new Map());
      unmappedByAmc.get(amcId).set(code, amc_name);
    }

    const amcIdsNeeded  = [...unmappedByAmc.keys()];
    const schemeResults = await Promise.all(
      amcIdsNeeded.map(amcId =>
        sbFetch(`schemes?select=amfi_code,name&amc_id=eq.${amcId}&is_active=eq.true&limit=5000`)
      )
    );
    const schemesByAmc = {};
    amcIdsNeeded.forEach((amcId, i) => { schemesByAmc[amcId] = schemeResults[i] || []; });

    // ── Score every code (no threshold filter) ────────────────────────────────
    const dist   = { s95_100: 0, s92_94: 0, s85_91: 0, s70_84: 0, below_70: 0, no_candidates: 0 };
    let wExact   = 0, wFuzzy = 0, wNoMatch = 0;

    // per-AMC tracking — only populated for AMCs with near-miss codes
    const amcData = {};  // amcName → { above92, near85_91, below85, samples }

    for (const [amcId, codesMap] of unmappedByAmc) {
      const candidates = schemesByAmc[amcId] || [];
      const amcName    = amcNameById[amcId] || String(amcId);

      for (const [code] of codesMap) {
        if (candidates.length === 0) { dist.no_candidates++; wNoMatch++; continue; }

        // Find the single best-scoring candidate — no threshold gate
        let bestScore = -1;
        let bestName  = null;
        for (const c of candidates) {
          const s = fuzzyScore(code, c.name);
          if (s > bestScore) { bestScore = s; bestName = c.name; if (s === 100) break; }
        }

        // Distribution bucket
        if      (bestScore >= 95) dist.s95_100++;
        else if (bestScore >= 92) dist.s92_94++;
        else if (bestScore >= 85) dist.s85_91++;
        else if (bestScore >= 70) dist.s70_84++;
        else                      dist.below_70++;

        // Would-be outcome under CONFIDENCE_THRESHOLD=92
        if      (bestScore === 100)                    wExact++;
        else if (bestScore >= CONFIDENCE_THRESHOLD)    wFuzzy++;
        else                                           wNoMatch++;

        // Track near-misses (85-91) with samples
        if (bestScore >= 85 && bestScore < 92) {
          if (!amcData[amcName]) amcData[amcName] = { above92: 0, near85_91: 0, below85: 0, samples: [] };
          amcData[amcName].near85_91++;
          if (amcData[amcName].samples.length < 5) {
            amcData[amcName].samples.push({ code, best_match: extractBaseName(bestName), score: bestScore });
          }
        } else if (bestScore >= 92) {
          if (!amcData[amcName]) amcData[amcName] = { above92: 0, near85_91: 0, below85: 0, samples: [] };
          amcData[amcName].above92++;
        } else {
          if (!amcData[amcName]) amcData[amcName] = { above92: 0, near85_91: 0, below85: 0, samples: [] };
          amcData[amcName].below85++;
        }
      }
    }

    // Only report AMCs that have at least 1 near-miss; sort by near-miss count desc
    const nearMissAmcs = Object.entries(amcData)
      .filter(([, v]) => v.near85_91 > 0)
      .sort((a, b) => b[1].near85_91 - a[1].near85_91)
      .map(([amc, v]) => ({
        amc,
        codes_92_plus: v.above92,
        codes_85_91:   v.near85_91,
        codes_below_85: v.below85,
        samples_85_91: v.samples,
      }));

    return res.status(200).json({
      ok: true,
      distribution: {
        score_95_100:  dist.s95_100,
        score_92_94:   dist.s92_94,
        score_85_91:   dist.s85_91,
        score_70_84:   dist.s70_84,
        below_70:      dist.below_70,
        no_candidates: dist.no_candidates,
      },
      totals: {
        distinct_codes:        totalDistinct,
        already_mapped:        alreadyMappedCount,
        to_process:            totalDistinct - alreadyMappedCount,
        would_auto_exact:      wExact,
        would_fuzzy_pending:   wFuzzy,
        would_no_match:        wNoMatch,
      },
      near_miss_amcs: nearMissAmcs,
      elapsed_ms: Date.now() - startMs,
    });

  } catch (err) {
    console.error('[cell-c?action=dry-run-reconciler]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
