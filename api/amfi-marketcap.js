// api/amfi-marketcap.js
// AMFI Market Cap File — Admin Upload API
//
// POST /api/amfi-marketcap
//   Body (parse_only=true):  { parse_only:true, filename, fileBase64 }
//     → Returns preview: { total, distribution, sample, warnings } — no DB write
//   Body (parse_only=false): { parse_only:false, filename, fileBase64, effective_from, effective_to }
//     → Deactivates current active period, upserts new rows, backs up to GitHub
//
// GET /api/amfi-marketcap
//   Returns active period summary + full upload history with distributions
//
// Parsing: exceljs reads .xlsx from base64 buffer
//   Col layout (1-based in exceljs):
//     1=Rank(formula), 2=Company Name, 3=ISIN, 4=BSE Symbol,
//     5=BSE Avg MCap, 6=NSE Symbol, 7=NSE Avg MCap,
//     8=MSEI Symbol, 9=MSEI Avg MCap, 10=Avg All Exchanges, 11=SEBI Category
//   Rows 1-2 are headers — skipped. Data from row 3 onwards.
//
// Security: service_role key — server-side only, never in VITE_ vars
// CORS: restricted to fundlens-six.vercel.app only

import ExcelJS from 'exceljs';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GITHUB_PAT           = process.env.VITE_GITHUB_PAT;
const GITHUB_REPO          = 'anjaneyakg/FundInsight';
const CORS_ORIGIN          = 'https://fundlens-six.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Parse xlsx from base64 → clean row objects ────────────────────────────────
async function parseAmfiXlsx(base64) {
  const buffer   = Buffer.from(base64, 'base64');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const ws = workbook.worksheets[0];
  if (!ws) throw new Error('No worksheet found in uploaded file.');

  const rows = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum <= 2) return; // skip title row (1) and column header row (2)

    const isin         = row.getCell(3).value?.toString()?.trim();
    const company_name = row.getCell(2).value?.toString()?.trim();
    const market_cap   = row.getCell(11).value?.toString()?.trim();

    // Must have ISIN, company name, and SEBI category
    if (!isin || !company_name || !market_cap) return;
    // Validate ISIN format — 12 chars, starts with IN
    if (!/^IN[A-Z0-9]{10}$/.test(isin)) return;
    // Must be a known SEBI category
    if (!['Large Cap','Mid Cap','Small Cap'].includes(market_cap)) return;

    const bse_symbol  = row.getCell(4).value?.toString()?.trim()  || null;
    const nse_symbol  = row.getCell(6).value?.toString()?.trim()  || null;
    const msei_symbol = row.getCell(8).value?.toString()?.trim()  || null;

    const bse_avg  = parseFloat(row.getCell(5).value)  || null;
    const nse_avg  = parseFloat(row.getCell(7).value)  || null;
    const msei_avg = parseFloat(row.getCell(9).value)  || null;

    // Column 10 = AVERAGE formula — exceljs resolves formula results as { formula, result }
    const avgRaw     = row.getCell(10).value;
    let avg_mcap_all = null;
    if (avgRaw != null) {
      avg_mcap_all = typeof avgRaw === 'object' && avgRaw?.result != null
        ? parseFloat(avgRaw.result)
        : parseFloat(avgRaw);
    }
    // Fallback: compute average from available exchange values
    if (avg_mcap_all == null || isNaN(avg_mcap_all)) {
      const vals = [bse_avg, nse_avg, msei_avg].filter(v => v != null && v > 0);
      avg_mcap_all = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }

    rows.push({
      isin,
      company_name,
      bse_symbol,
      nse_symbol,
      msei_symbol,
      bse_avg_mcap:    bse_avg,
      nse_avg_mcap:    nse_avg,
      msei_avg_mcap:   msei_avg,
      avg_mcap_all:    avg_mcap_all,
      market_cap_sebi: market_cap,
    });
  });

  return rows;
}

// ── Category distribution ─────────────────────────────────────────────────────
function getDistribution(rows) {
  const dist = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
  rows.forEach(r => { if (dist[r.market_cap_sebi] !== undefined) dist[r.market_cap_sebi]++; });
  return dist;
}

// ── Supabase fetch helper ─────────────────────────────────────────────────────
async function sbFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        method === 'POST' ? 'resolution=merge-duplicates' : 'count=none',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (![200, 201, 204].includes(res.status)) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Batch upsert — 500 rows per call ─────────────────────────────────────────
async function batchUpsert(rows) {
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await sbFetch('scrip_master?on_conflict=isin,effective_from', 'POST', rows.slice(i, i + BATCH));
    inserted += Math.min(BATCH, rows.length - i);
    if (i + BATCH < rows.length) await new Promise(r => setTimeout(r, 150));
  }
  return inserted;
}

// ── GitHub backup ─────────────────────────────────────────────────────────────
async function saveToGitHub(filename, base64Content) {
  const path   = `data/amfi-marketcap/${filename}`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;

  let sha;
  try {
    const check = await fetch(apiUrl, {
      headers: { 'Authorization':`Bearer ${GITHUB_PAT}`, 'Accept':'application/vnd.github.v3+json' },
    });
    if (check.ok) sha = (await check.json()).sha;
  } catch (_) {}

  const res = await fetch(apiUrl, {
    method:  'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      message: `Add AMFI market cap file: ${filename}`,
      content: base64Content,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`GitHub backup failed: ${res.status}`);
  return path;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).set(corsHeaders).end();
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  // ── GET — active period + history ─────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const all = await sbFetch(
        'scrip_master?select=effective_from,effective_to,uploaded_at,is_active,sebi_cap_category&order=effective_from.desc&limit=20000'
      );

      const seen = new Set();
      const periods = [];

      for (const row of (all ?? [])) {
        if (seen.has(row.effective_from)) continue;
        seen.add(row.effective_from);
        const periodRows = (all ?? []).filter(r => r.effective_from === row.effective_from);
        const dist = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
        periodRows.forEach(r => { if (dist[r.sebi_cap_category] !== undefined) dist[r.sebi_cap_category]++; });
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

  // ── POST — parse_only preview OR full upload ──────────────────────────────
  if (req.method === 'POST') {
    try {
      const { parse_only, filename, fileBase64, effective_from, effective_to } = req.body;

      if (!fileBase64 || !filename) {
        return res.status(400).json({ error: 'Missing fileBase64 or filename.' });
      }

      const rows = await parseAmfiXlsx(fileBase64);
      if (!rows.length) {
        return res.status(400).json({
          error: 'No valid rows parsed. Ensure this is the AMFI Average Market Capitalisation .xlsx file.',
        });
      }

      const distribution = getDistribution(rows);
      const warnings = [];
      if (distribution['Large Cap'] !== 100)
        warnings.push(`Expected 100 Large Cap companies, found ${distribution['Large Cap']}.`);
      if (distribution['Mid Cap'] !== 150)
        warnings.push(`Expected 150 Mid Cap companies, found ${distribution['Mid Cap']}.`);

      // parse_only → preview only, no DB write
      if (parse_only) {
        return res.status(200).json({
          preview: { total: rows.length, distribution, sample: rows.slice(0, 5), warnings },
        });
      }

      // Full upload requires effective_from
      if (!effective_from) {
        return res.status(400).json({ error: 'effective_from date is required.' });
      }

      const now = new Date().toISOString();

      // 1. Deactivate current active period — set effective_to = start of new period
      await sbFetch('scrip_master?is_active=eq.true', 'PATCH', {
        is_active:    false,
        effective_to: effective_from,
      });

      // 2. Prepare rows for upsert
      const upsertRows = rows.map(r => ({
        isin:              r.isin,
        company_name:      r.company_name,
        bse_symbol:        r.bse_symbol    ?? null,
        nse_symbol:        r.nse_symbol    ?? null,
        msei_symbol:       r.msei_symbol   ?? null,
        bse_avg_mcap_cr:   r.bse_avg_mcap  ?? null,
        nse_avg_mcap_cr:   r.nse_avg_mcap  ?? null,
        msei_avg_mcap_cr:  r.msei_avg_mcap ?? null,
        avg_mcap_all_cr:   r.avg_mcap_all  ?? null,
        sebi_cap_category: r.market_cap_sebi,
        effective_from,
        effective_to:      effective_to ?? null,
        is_active:         true,
        uploaded_at:       now,
      }));

      // 3. Batch upsert to Supabase
      const inserted = await batchUpsert(upsertRows);

      // 4. GitHub backup (non-fatal — log error but don't abort)
      let github_path = null;
      try {
        github_path = await saveToGitHub(filename, fileBase64);
      } catch (ghErr) {
        console.error('GitHub backup non-fatal:', ghErr.message);
      }

      return res.status(200).json({
        success:     true,
        inserted,
        period:      { effective_from, effective_to: effective_to ?? null },
        distribution,
        warnings,
        github_path,
      });

    } catch (err) {
      console.error('POST /api/amfi-marketcap:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
