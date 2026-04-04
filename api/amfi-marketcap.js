// api/amfi-marketcap.js
// AMFI Market Cap File — Admin Upload API
//
// Architecture change v2:
//   xlsx parsing is done CLIENT-SIDE (SheetJS via CDN in the JSX).
//   This API receives only clean, pre-parsed JSON rows — no base64, no exceljs.
//   GitHub backup is also done client-side using VITE_GITHUB_PAT.
//   This keeps the serverless function fast and well within Vercel's 10s timeout.
//
// POST /api/amfi-marketcap
//   Body: { rows, effective_from, effective_to, filename }
//   → Deactivates current active period, batch-upserts new rows
//   → Returns: { success, inserted, period, distribution }
//
// GET /api/amfi-marketcap
//   → Returns active period summary + upload history
//
// Security: SUPABASE_SERVICE_KEY server-side only — never in VITE_ vars
// CORS: restricted to fundlens-six.vercel.app

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CORS_ORIGIN          = 'https://fundlens-six.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Supabase fetch helper ─────────────────────────────────────────────────────
async function sbFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        method === 'POST'  ? 'resolution=merge-duplicates'
                     : method === 'PATCH' ? 'return=minimal'
                     : 'count=none',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (![200, 201, 204].includes(res.status)) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text || !text.trim()) return null;
  return JSON.parse(text);
}

// ── Batch upsert — 500 rows per call to stay under PostgREST limits ──────────
async function batchUpsert(rows) {
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await sbFetch(
      'scrip_master?on_conflict=isin,effective_from',
      'POST',
      rows.slice(i, i + BATCH)
    );
    inserted += Math.min(BATCH, rows.length - i);
    // Small delay between batches to avoid overwhelming PostgREST
    if (i + BATCH < rows.length) await new Promise(r => setTimeout(r, 100));
  }
  return inserted;
}

// ── Category distribution helper ──────────────────────────────────────────────
function getDistribution(rows) {
  const dist = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
  rows.forEach(r => {
    if (dist[r.sebi_cap_category] !== undefined) dist[r.sebi_cap_category]++;
  });
  return dist;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(corsHeaders).end();
  }
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  // ── GET — active period + upload history ──────────────────────────────────
  if (req.method === 'GET') {
    try {
      const all = await sbFetch(
        'scrip_master?select=effective_from,effective_to,uploaded_at,is_active,sebi_cap_category&order=effective_from.desc&limit=20000'
      );

      const seen    = new Set();
      const periods = [];

      for (const row of (all ?? [])) {
        if (seen.has(row.effective_from)) continue;
        seen.add(row.effective_from);

        const periodRows = (all ?? []).filter(r => r.effective_from === row.effective_from);
        const dist = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
        periodRows.forEach(r => {
          if (dist[r.sebi_cap_category] !== undefined) dist[r.sebi_cap_category]++;
        });

        periods.push({
          effective_from: row.effective_from,
          effective_to:   row.effective_to,
          uploaded_at:    row.uploaded_at,
          is_active:      row.is_active,
          distribution:   dist,
          total:          periodRows.length,
        });
      }

      return res.status(200).json({
        active_period: periods.find(p => p.is_active) ?? null,
        history:       periods,
      });

    } catch (err) {
      console.error('GET /api/amfi-marketcap:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST — receive pre-parsed rows, upsert to Supabase ───────────────────
  if (req.method === 'POST') {
    try {
      const { rows, effective_from, effective_to } = req.body;

      if (!rows?.length) {
        return res.status(400).json({ error: 'No rows received. Ensure file was parsed correctly.' });
      }
      if (!effective_from) {
        return res.status(400).json({ error: 'effective_from date is required.' });
      }

      const now = new Date().toISOString();

      // Step 1 — deactivate current active period
      await sbFetch('scrip_master?is_active=eq.true', 'PATCH', {
        is_active:    false,
        effective_to: effective_from,
      });

      // Step 2 — prepare upsert rows
      const upsertRows = rows.map(r => ({
        isin:              r.isin,
        company_name:      r.company_name,
        bse_symbol:        r.bse_symbol     ?? null,
        nse_symbol:        r.nse_symbol     ?? null,
        msei_symbol:       r.msei_symbol    ?? null,
        bse_avg_mcap_cr:   r.bse_avg_mcap   ?? null,
        nse_avg_mcap_cr:   r.nse_avg_mcap   ?? null,
        msei_avg_mcap_cr:  r.msei_avg_mcap  ?? null,
        avg_mcap_all_cr:   r.avg_mcap_all   ?? null,
        sebi_cap_category: r.market_cap_sebi,
        effective_from,
        effective_to:      effective_to ?? null,
        is_active:         true,
        uploaded_at:       now,
      }));

      // Step 3 — batch upsert
      const inserted = await batchUpsert(upsertRows);

      return res.status(200).json({
        success:      true,
        inserted,
        period:       { effective_from, effective_to: effective_to ?? null },
        distribution: getDistribution(upsertRows),
      });

    } catch (err) {
      console.error('POST /api/amfi-marketcap:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
