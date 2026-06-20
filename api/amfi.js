// api/amfi.js
// Consolidated AMFI endpoint — 4 actions:
//   ?action=marketcap      — market cap upload (was api/amfi-marketcap.js)
//   ?action=schemes        — AMFI scheme master proxy (was api/amfi-schemes.js)
//   ?action=schemes-list   — scheme names grouped by AMC (was api/amfi-schemes-list.js)
//   ?action=scheme-code-map — scheme code mapping r/w (was api/scheme-code-map.js)

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CORS_ORIGIN          = 'https://fundlens-six.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  const { action } = req.query;

  if (action === 'marketcap')              return handleMarketcap(req, res);
  if (action === 'schemes')                return handleSchemes(req, res);
  if (action === 'schemes-list')           return handleSchemesList(req, res);
  if (action === 'scheme-code-map')        return handleSchemeCodeMap(req, res);
  if (action === 'amc-scheme-id-methods')  return handleAmcSchemeIdMethods(req, res);
  if (action === 'parser-outliers')        return handleParserOutliersGet(req, res);
  if (action === 'parser-outliers-resolve') return handleParserOutliersResolve(req, res);

  return res.status(400).json({ error: 'Unknown action. Valid: marketcap, schemes, schemes-list, scheme-code-map, amc-scheme-id-methods, parser-outliers, parser-outliers-resolve' });
}

// ─────────────────────────────────────────────────────────────────────────────
// action=marketcap — AMFI market cap upload (was api/amfi-marketcap.js)
// GET  → active period summary + upload history
// POST → deactivate current active period, batch-upsert new rows
// ─────────────────────────────────────────────────────────────────────────────

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
    if (i + BATCH < rows.length) await new Promise(r => setTimeout(r, 100));
  }
  return inserted;
}

function getDistribution(rows) {
  const dist = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
  rows.forEach(r => {
    if (dist[r.sebi_cap_category] !== undefined) dist[r.sebi_cap_category]++;
  });
  return dist;
}

async function handleMarketcap(req, res) {
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
      console.error('GET /api/amfi?action=marketcap:', err);
      return res.status(500).json({ error: err.message });
    }
  }

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

      await sbFetch('scrip_master?is_active=eq.true', 'PATCH', {
        is_active:    false,
        effective_to: effective_from,
      });

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

      const inserted = await batchUpsert(upsertRows);

      return res.status(200).json({
        success:      true,
        inserted,
        period:       { effective_from, effective_to: effective_to ?? null },
        distribution: getDistribution(upsertRows),
      });

    } catch (err) {
      console.error('POST /api/amfi?action=marketcap:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// action=schemes — AMFI scheme master proxy (was api/amfi-schemes.js)
// GET → { ok, amcs: { AMC: count }, totalAmcs, totalSchemes, fetchedAt }
// ─────────────────────────────────────────────────────────────────────────────

const AMFI_SCHEME_MASTER_URL = 'https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0';

// SUPERSEDED by amc_aliases table — kept for reference, do not use.
// Remove after amc_aliases has been running correctly for at least 2 weeks.
// const AMC_ALIASES_SCHEMES = {
//   'Aditya Birla Sun Life AMC Limited':      'Aditya Birla Sun Life Mutual Fund',
//   'Aditya Birla Sun Life':                  'Aditya Birla Sun Life Mutual Fund',
//   'HDFC Asset Management Company Limited':  'HDFC Mutual Fund',
//   'HDFC Mutual Fund':                       'HDFC Mutual Fund',
//   'SBI Funds Management Limited':           'SBI Mutual Fund',
//   'SBI Funds Management':                   'SBI Mutual Fund',
//   'UTI Asset Management Company Limited':   'UTI Mutual Fund',
//   'UTI Asset Management':                   'UTI Mutual Fund',
//   'DSP Investment Managers Private Limited':'DSP Mutual Fund',
//   'DSP Investment Managers':               'DSP Mutual Fund',
//   'JM Financial Asset Management Limited': 'JM Financial Mutual Fund',
//   'JM Financial Asset Management':         'JM Financial Mutual Fund',
//   'Motilal Oswal Asset Management Company Limited': 'Motilal Oswal Mutual Fund',
//   'Motilal Oswal Asset Management':        'Motilal Oswal Mutual Fund',
//   'Franklin Templeton Asset Management (India) Private Limited': 'Franklin Templeton Mutual Fund',
//   'Franklin Templeton Asset Management':   'Franklin Templeton Mutual Fund',
//   'Templeton India':                       'Franklin Templeton Mutual Fund',
//   'PGIM India Asset Management Private Limited': 'PGIM India Mutual Fund',
//   'PGIM India Asset Management':           'PGIM India Mutual Fund',
//   'HSBC Asset Management (India) Private Limited': 'HSBC Mutual Fund',
//   'HSBC Asset Management':                 'HSBC Mutual Fund',
//   'LIC Mutual Fund Asset Management Limited': 'LIC Mutual Fund',
//   'LIC Mutual Fund Asset Management':      'LIC Mutual Fund',
//   '360 ONE Asset Management Limited':      '360 ONE Mutual Fund',
//   '360 ONE Asset Management':              '360 ONE Mutual Fund',
//   'Angel One Asset Management Limited':    'Angel One Mutual Fund',
//   'Angel One Asset Management':            'Angel One Mutual Fund',
//   'ICICI Prudential Asset Management Company Limited': 'ICICI Prudential Mutual Fund',
//   'ICICI Prudential Asset Management':     'ICICI Prudential Mutual Fund',
//   'Nippon Life India Asset Management Limited': 'Nippon India Mutual Fund',
//   'Nippon India':                          'Nippon India Mutual Fund',
//   'Kotak Mahindra Asset Management Company Limited': 'Kotak Mahindra Mutual Fund',
//   'Kotak Mahindra Asset Management':       'Kotak Mahindra Mutual Fund',
//   'Trust Asset Management Private Limited': 'Trust Mutual Fund',
//   'Trust Asset Management':                'Trust Mutual Fund',
//   'Shriram Asset Management Co. Limited':  'Shriram Mutual Fund',
//   'Shriram Asset Management':              'Shriram Mutual Fund',
//   'Taurus Asset Management Company Limited': 'Taurus Mutual Fund',
//   'Taurus Asset Management':               'Taurus Mutual Fund',
//   'Canara Robeco Asset Management Company Limited': 'Canara Robeco Mutual Fund',
//   'Canara Robeco Asset Management':        'Canara Robeco Mutual Fund',
//   'Bandhan AMC Limited':                   'Bandhan Mutual Fund',
//   'Mirae Asset Investment Managers (India) Private Limited': 'Mirae Asset Mutual Fund',
//   'WhiteOak Capital Asset Management Limited': 'WhiteOak Capital Mutual Fund',
//   'Edelweiss Asset Management Limited':    'Edelweiss Mutual Fund',
//   'Helios Capital Asset Management (India) Private Limited': 'Helios Mutual Fund',
//   'Groww Asset Management Limited':        'Groww Mutual Fund',
//   'Navi AMC Limited':                      'Navi Mutual Fund',
//   'NJ Asset Management Private Limited':   'NJ Mutual Fund',
//   'PPFAS Asset Management Pvt. Ltd.':      'PPFAS Mutual Fund',
//   'Quantum Asset Management Company Private Limited': 'Quantum Mutual Fund',
//   'quant Money Managers Limited':          'quant Mutual Fund',
//   'Samco Asset Management Private Limited': 'Samco Mutual Fund',
//   'Sundaram Asset Management Company Limited': 'Sundaram Mutual Fund',
//   'Tata Asset Management Private Limited': 'Tata Mutual Fund',
//   'Union Asset Management Company Private Limited': 'Union Mutual Fund',
//   'Unifi Asset Management Private Limited': 'Unifi Mutual Fund',
//   'Baroda BNP Paribas Asset Management India Private Limited': 'Baroda BNP Paribas Mutual Fund',
//   'Invesco Asset Management (India) Private Limited': 'Invesco Mutual Fund',
//   'Mahindra Manulife Investment Management Private Limited': 'Mahindra Manulife Mutual Fund',
//   'ITI Asset Management Limited':          'ITI Mutual Fund',
//   'Bajaj Finserv Asset Management Limited': 'Bajaj Finserv Mutual Fund',
//   'Bank of India Investment Managers Private Limited': 'Bank of India Mutual Fund',
//   'Axis Asset Management Company Limited': 'Axis Mutual Fund',
//   'Capitalmind Asset Management Private Limited': 'Capitalmind Mutual Fund',
//   'Abakkus Asset Manager LLP':             'Abakkus Mutual Fund',
//   'Old Bridge Asset Management Private Limited': 'Old Bridge Mutual Fund',
//   'Jio BlackRock Investment Managers Private Limited': 'Jio BlackRock Mutual Fund',
//   'Choice International Limited':          'Choice Mutual Fund',
//   'The Wealth Company Asset Management Private Limited': 'The Wealth Company Mutual Fund',
// };

// ── AMC alias map — loaded from amc_aliases table (source='amfi') ─────────────
// Cached at module level for the duration of a warm serverless invocation.
// TTL matches the 1hr Cache-Control header on the endpoints that use it.

let _amcAliasMap = null;
let _amcAliasMapLoadedAt = 0;
const AMC_ALIAS_MAP_TTL = 3_600_000; // 1 hour in ms

async function loadAmcAliasMap() {
  const now = Date.now();
  if (_amcAliasMap && (now - _amcAliasMapLoadedAt) < AMC_ALIAS_MAP_TTL) {
    return _amcAliasMap;
  }
  try {
    const rows = await sbFetch('amc_aliases?select=alias,canonical_name&source=eq.amfi');
    const map = {};
    for (const row of rows) {
      map[row.alias] = row.canonical_name;
    }
    _amcAliasMap = map;
    _amcAliasMapLoadedAt = now;
    return map;
  } catch (err) {
    console.error('[loadAmcAliasMap] Failed to load from Supabase:', err.message);
    return {};
  }
}

// Normalise common legal suffix abbreviations so AMFI spelling drift
// (Pvt. Ltd → Pvt Ltd → Private Limited) doesn't cause match failures.
// Applied to BOTH sides of alias comparisons in the two functions below.
function normaliseLegalSuffix(name) {
  return name
    .replace(/\bPvt\.\s*Ltd\.?\b/gi,  'Private Limited')
    .replace(/\bPvt\s+Ltd\.?\b/gi,    'Private Limited')
    .replace(/\bPvt\.?\b/gi,          'Private')
    .replace(/\bCo\.\s*Ltd\.?\b/gi,   'Company Limited')
    .replace(/\bCo\.\b/gi,            'Company')           // safe: requires period
    .replace(/\bLtd\.?\b/gi,          'Limited')
    .replace(/\bMgmt\.?\b/gi,         'Management')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseAmcSchemes(raw, aliasMap = {}) {
  if (!raw) return 'Unknown';
  const s     = raw.trim();
  const sNorm = normaliseLegalSuffix(s);
  // 1. Exact match
  if (aliasMap[s]) return aliasMap[s];
  // 2. Normalised exact match (handles Pvt./Private, Co./Company, Ltd./Limited drift)
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (normaliseLegalSuffix(alias) === sNorm) return canonical;
  }
  // 3. Normalised startsWith
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (sNorm.startsWith(normaliseLegalSuffix(alias))) return canonical;
  }
  // 4. Regex fallback — last resort, always produces a result
  return s
    .replace(/ (Asset Management|AMC|Investment Managers?|Mutual Fund).*$/i, ' Mutual Fund')
    .trim();
}

function isDirectGrowth(navName) {
  const n = (navName || '').toLowerCase();
  const idcwTerms = ['idcw', 'dividend payout', 'dividend reinvestment', 'payout', 'reinvestment', 'bonus'];
  const isDirect  = n.includes('direct');
  const isGrowth  = !idcwTerms.some(t => n.includes(t));
  return isDirect && isGrowth;
}

function isOpenEnded(parts) {
  const structure = (parts[3] || '').trim().toLowerCase();
  return !structure.startsWith('close');
}

function basePortfolioName(parts) {
  return (parts[2] || '').trim();
}

function parseAMFIMaster(text, { debug = false, aliasMap = {} } = {}) {
  const amcCounts    = {};
  const seenNames    = {};
  let currentAmcFull = '';
  const debugSample  = [];
  let schemeLinesSeen = 0;

  for (const rawLine of text.split('\n')) {
    const line  = rawLine.trim();
    if (!line) continue;

    const parts = line.split(',').map(p => p.trim());

    if (parts.length >= 2 && !parts[1].match(/^\d+$/)) {
      currentAmcFull = parts[0];
      continue;
    }

    if (parts.length >= 6 && parts[1].match(/^\d+$/)) {
      if (debug && schemeLinesSeen < 3) {
        debugSample.push({
          raw: rawLine.trim(),
          parsed: {
            '0_amc':              parts[0],
            '1_scheme_code':      parts[1],
            '2_base_scheme_name': parts[2],
            '3_structure':         parts[3],
            '4_category':          parts[4],
            '5_nav_name':          parts[5],
          }
        });
      }
      schemeLinesSeen++;

      const navName = parts[5] || parts[4] || '';
      if (!isDirectGrowth(navName)) continue;
      if (!isOpenEnded(parts)) continue;

      const amcRaw  = parts[0] || currentAmcFull;
      const amc     = normaliseAmcSchemes(amcRaw, aliasMap);
      const baseName = basePortfolioName(parts);

      if (!seenNames[amc]) seenNames[amc] = new Set();
      if (seenNames[amc].has(baseName)) continue;
      seenNames[amc].add(baseName);

      amcCounts[amc] = (amcCounts[amc] || 0) + 1;
    }
  }

  return { amcCounts, debugSample };
}

async function handleSchemes(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const [response, aliasMap] = await Promise.all([
      fetch(AMFI_SCHEME_MASTER_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FundLens/1.0)' },
      }),
      loadAmcAliasMap(),
    ]);

    if (!response.ok) throw new Error(`AMFI responded with ${response.status}`);

    const text                        = await response.text();
    const debug                       = req.query?.debug === '1';
    const { amcCounts, debugSample }  = parseAMFIMaster(text, { debug, aliasMap });

    return res.status(200).json({
      ok:           true,
      amcs:         amcCounts,
      totalAmcs:    Object.keys(amcCounts).length,
      totalSchemes: Object.values(amcCounts).reduce((s, n) => s + n, 0),
      fetchedAt:    new Date().toISOString(),
      ...(debug && { debugSample }),
    });

  } catch (err) {
    console.error('[amfi?action=schemes]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=schemes-list — scheme names grouped by AMC (was api/amfi-schemes-list.js)
// GET → { ok, byAmc: { "ICICI Prudential Mutual Fund": ["scheme1", ...] } }
// ─────────────────────────────────────────────────────────────────────────────

// SUPERSEDED by amc_aliases table — kept for reference, do not use.
// Remove after amc_aliases has been running correctly for at least 2 weeks.
// const AMC_ALIASES_LIST = {
//   'Aditya Birla Sun Life AMC Limited':      'Aditya Birla Sun Life Mutual Fund',
//   'HDFC Asset Management Company Limited':  'HDFC Mutual Fund',
//   'SBI Funds Management Limited':           'SBI Mutual Fund',
//   'UTI Asset Management Company Limited':   'UTI Mutual Fund',
//   'DSP Investment Managers Private Limited':'DSP Mutual Fund',
//   'JM Financial Asset Management Limited':  'JM Financial Mutual Fund',
//   'Motilal Oswal Asset Management Company Limited': 'Motilal Oswal Mutual Fund',
//   'Franklin Templeton Asset Management (India) Private Limited': 'Franklin Templeton Mutual Fund',
//   'PGIM India Asset Management Private Limited': 'PGIM India Mutual Fund',
//   'HSBC Asset Management (India) Private Limited': 'HSBC Mutual Fund',
//   'LIC Mutual Fund Asset Management Limited': 'LIC Mutual Fund',
//   '360 ONE Asset Management Limited':       '360 ONE Mutual Fund',
//   'Angel One Asset Management Limited':     'Angel One Mutual Fund',
//   'ICICI Prudential Asset Management Company Limited': 'ICICI Prudential Mutual Fund',
//   'Nippon Life India Asset Management Limited': 'Nippon India Mutual Fund',
//   'Kotak Mahindra Asset Management Company Limited': 'Kotak Mahindra Mutual Fund',
//   'Trust Asset Management Private Limited': 'Trust Mutual Fund',
//   'Shriram Asset Management Co. Limited':   'Shriram Mutual Fund',
//   'Taurus Asset Management Company Limited':'Taurus Mutual Fund',
//   'Canara Robeco Asset Management Company Limited': 'Canara Robeco Mutual Fund',
//   'Bandhan AMC Limited':                    'Bandhan Mutual Fund',
//   'Mirae Asset Investment Managers (India) Private Limited': 'Mirae Asset Mutual Fund',
//   'WhiteOak Capital Asset Management Limited': 'WhiteOak Capital Mutual Fund',
//   'Edelweiss Asset Management Limited':     'Edelweiss Mutual Fund',
//   'Helios Capital Asset Management (India) Private Limited': 'Helios Mutual Fund',
//   'Groww Asset Management Limited':         'Groww Mutual Fund',
//   'Navi AMC Limited':                       'Navi Mutual Fund',
//   'NJ Asset Management Private Limited':    'NJ Mutual Fund',
//   'PPFAS Asset Management Pvt. Ltd.':       'PPFAS Mutual Fund',
//   'Quantum Asset Management Company Private Limited': 'Quantum Mutual Fund',
//   'quant Money Managers Limited':           'quant Mutual Fund',
//   'Samco Asset Management Private Limited': 'Samco Mutual Fund',
//   'Sundaram Asset Management Company Limited': 'Sundaram Mutual Fund',
//   'Tata Asset Management Private Limited':  'Tata Mutual Fund',
//   'Union Asset Management Company Private Limited': 'Union Mutual Fund',
//   'Unifi Asset Management Private Limited': 'Unifi Mutual Fund',
//   'Baroda BNP Paribas Asset Management India Private Limited': 'Baroda BNP Paribas Mutual Fund',
//   'Invesco Asset Management (India) Private Limited': 'Invesco India Mutual Fund',
//   'Mahindra Manulife Investment Management Private Limited': 'Mahindra Manulife Mutual Fund',
//   'ITI Asset Management Limited':           'ITI Mutual Fund',
//   'Bajaj Finserv Asset Management Limited': 'Bajaj Finserv Mutual Fund',
//   'Bank of India Investment Managers Private Limited': 'Bank of India Mutual Fund',
//   'Axis Asset Management Company Limited':  'Axis Mutual Fund',
//   'Capitalmind Asset Management Private Limited': 'Capitalmind Mutual Fund',
//   'Abakkus Asset Manager LLP':              'Abakkus Mutual Fund',
//   'Old Bridge Asset Management Private Limited': 'Old Bridge Mutual Fund',
//   'Jio BlackRock Investment Managers Private Limited': 'Jio BlackRock Mutual Fund',
//   'The Wealth Company Asset Management Private Limited': 'The Wealth Company Mutual Fund',
// };

function normaliseAmcList(raw, aliasMap = {}) {
  if (!raw) return null;
  const s     = raw.trim();
  const sNorm = normaliseLegalSuffix(s);
  // 1. Exact match
  if (aliasMap[s]) return aliasMap[s];
  // 2. Normalised exact match
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (normaliseLegalSuffix(alias) === sNorm) return canonical;
  }
  // 3. Normalised startsWith
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (sNorm.startsWith(normaliseLegalSuffix(alias))) return canonical;
  }
  // 4. Regex fallback — matches normaliseAmcSchemes robustness; returns null only
  //    if the name has no recognisable suffix (truly unresolvable → caller logs it)
  const fallback = s
    .replace(/ (Asset Management|AMC|Investment Managers?|Mutual Fund).*$/i, ' Mutual Fund')
    .trim();
  return fallback !== s ? fallback : null;
}

async function handleSchemesList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const [upstream, aliasMap] = await Promise.all([
      fetch(AMFI_SCHEME_MASTER_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FundLens/1.0)' }
      }),
      loadAmcAliasMap(),
    ]);
    if (!upstream.ok) throw new Error(`AMFI returned ${upstream.status}`);

    const text   = await upstream.text();
    const lines  = text.trim().split('\n');

    const header  = lines[0].split(',').map(h => h.trim());
    const amcIdx  = header.findIndex(h => h === 'AMC');
    const nameIdx = header.findIndex(h => h === 'Scheme Name');

    const byAmc     = {};
    const unresolved = new Set();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 4) continue;

      const amcRaw = parts[amcIdx]?.trim();
      const name   = parts[nameIdx]?.trim();
      if (!amcRaw || !name || name.length < 5) continue;

      const amc = normaliseAmcList(amcRaw, aliasMap);
      if (!amc) {
        unresolved.add(amcRaw);
        continue;
      }

      if (!byAmc[amc]) byAmc[amc] = new Set();
      byAmc[amc].add(name);
    }

    const result = {};
    for (const [amc, names] of Object.entries(byAmc)) {
      result[amc] = [...names].sort();
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({
      ok:                 true,
      byAmc:              result,
      unresolvedAmcNames: [...unresolved].sort(),
    });

  } catch (err) {
    console.error('[amfi?action=schemes-list]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=scheme-code-map — scheme code mapping r/w (Supabase-backed)
// GET  → { mapping: {amc_name: {code: base_scheme_name}},
//           meta:    {amc_name: {code: {mapped_by, confidence}}} }
// POST → upsert {mapping: {amc_name: {code: base_scheme_name}}} with mapped_by='manual'
//
// Note: schemes table stores full nav names; we strip plan/option suffix for
// GET display so the base name matches the autocomplete in SchemeMapping.jsx.
// On POST, base name is prefix-matched against schemes, preferring Direct+Growth.
// Manual edits (POST) always write mapped_by='manual' per FR-C-16 — automated
// runs (auto_exact, auto_fuzzy) must never overwrite a manual entry.
// ─────────────────────────────────────────────────────────────────────────────

function extractBaseName(fullName) {
  // Strip plan/option suffix from AMFI full nav name to get a displayable base name.
  // Handles mixed separators and casing found in the schemes table.
  return fullName
    .replace(/\s*[-–]\s*(Regular|Direct)\s+Plan.*/i, '')
    .replace(/[-–](Regular|Direct)\s+Plan.*/i, '')
    .replace(/\s+(Regular|Direct)\s+Plan.*/i, '')
    .replace(/\s+(REGULAR|DIRECT)\s+(GROWTH|IDCW|INCOME|DIVIDEND|PAYOUT|REINVESTMENT).*/i, '')
    .trim();
}

function resolveAmfiCode(baseName, amcSchemes) {
  // Match base name against full nav names (case-insensitive prefix/substring).
  // amcSchemes = [{amfi_code, name}, ...]
  const lo = baseName.toLowerCase().trim();
  let candidates = amcSchemes.filter(s => s.name.toLowerCase().startsWith(lo));
  if (!candidates.length) candidates = amcSchemes.filter(s => s.name.toLowerCase().includes(lo));
  if (!candidates.length) return null;

  // Prefer Direct + Growth; fall back to Direct; then minimum amfi_code.
  const dg = candidates.filter(s => {
    const n = s.name.toLowerCase();
    return n.includes('direct') && (n.includes('growth') || (!n.includes('idcw') && !n.includes('dividend') && !n.includes('income distribution')));
  });
  if (dg.length) return dg.reduce((a, b) => a.amfi_code < b.amfi_code ? a : b).amfi_code;

  const d = candidates.filter(s => s.name.toLowerCase().includes('direct'));
  if (d.length) return d.reduce((a, b) => a.amfi_code < b.amfi_code ? a : b).amfi_code;

  return candidates.reduce((a, b) => a.amfi_code < b.amfi_code ? a : b).amfi_code;
}

async function handleSchemeCodeMap(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      // Fetch all mapped rows; PostgREST resolves amc_id FK -> amcs.name
      const rows = await sbFetch(
        'scheme_code_map?select=amc_id,scheme_code_amc,amfi_code,mapped_by,confidence,amcs!inner(name)'
      );

      if (!rows || rows.length === 0) {
        return res.status(200).json({ mapping: {}, meta: {} });
      }

      // Fetch scheme full names for all amfi_codes in one round trip
      const amfiCodes = [...new Set(rows.map(r => r.amfi_code))];
      const schemeRows = await sbFetch(
        `schemes?select=amfi_code,name&amfi_code=in.(${amfiCodes.join(',')})`
      );
      const nameByCode = {};
      for (const s of (schemeRows || [])) nameByCode[s.amfi_code] = s.name;

      // Build mapping (base name) + meta (mapped_by, confidence)
      const mapping = {};
      const meta    = {};
      for (const row of rows) {
        const amcName  = row.amcs?.name;
        const fullName = nameByCode[row.amfi_code];
        if (!amcName || !fullName) continue;

        if (!mapping[amcName]) { mapping[amcName] = {}; meta[amcName] = {}; }
        mapping[amcName][row.scheme_code_amc] = extractBaseName(fullName);
        meta[amcName][row.scheme_code_amc]    = {
          mapped_by:  row.mapped_by,
          confidence: row.confidence ?? null,
        };
      }

      return res.status(200).json({ mapping, meta });

    } catch (err) {
      console.error('[amfi?action=scheme-code-map] GET error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  // Receives {mapping: {amc_name: {scheme_code_amc: base_scheme_name}}}
  // Resolves base names to amfi_codes, upserts with mapped_by='manual'.
  // Deletes cleared manual entries (codes absent from this save for a given AMC).
  if (req.method === 'POST') {
    try {
      const { mapping } = req.body;
      if (!mapping || typeof mapping !== 'object') {
        return res.status(400).json({ ok: false, error: 'mapping object required in body' });
      }

      // Load amcs for name -> id lookup (small table, one round trip)
      const amcRows = await sbFetch('amcs?select=id,name');
      const amcById = {};
      for (const a of (amcRows || [])) amcById[a.name] = a.id;

      let totalMapped = 0;
      let amcCount    = 0;

      for (const [amcName, codes] of Object.entries(mapping)) {
        const amcId = amcById[amcName];
        if (!amcId) {
          console.warn(`[scheme-code-map] AMC not found: ${amcName}`);
          continue;
        }

        // Fetch all schemes for this AMC to resolve base name -> amfi_code
        const amcSchemes = await sbFetch(`schemes?select=amfi_code,name&amc_id=eq.${amcId}`);

        const now        = new Date().toISOString();
        const upsertRows = [];
        const codeKeys   = Object.keys(codes);

        for (const [code, baseName] of Object.entries(codes)) {
          if (!baseName) continue;
          const amfiCode = resolveAmfiCode(baseName, amcSchemes || []);
          if (!amfiCode) {
            console.warn(`[scheme-code-map] No scheme match for "${baseName}" (AMC: ${amcName})`);
            continue;
          }
          upsertRows.push({
            amc_id:          amcId,
            scheme_code_amc: code,
            amfi_code:       amfiCode,
            mapped_by:       'manual',   // FR-C-16: manual edits always win
            confidence:      null,
            mapped_at:       now,
          });
        }

        if (upsertRows.length > 0) {
          await sbFetch('scheme_code_map?on_conflict=amc_id,scheme_code_amc', 'POST', upsertRows);
          totalMapped += upsertRows.length;
          amcCount++;
        }

        // Remove cleared manual entries: fetch current DB rows for this AMC,
        // delete any whose scheme_code_amc is not in the current save.
        // Scoped to mapped_by='manual' — never touch auto_exact/auto_fuzzy rows via UI save.
        const existing = await sbFetch(
          `scheme_code_map?select=id,scheme_code_amc&amc_id=eq.${amcId}&mapped_by=eq.manual`
        );
        const toDelete = (existing || []).filter(r => !codeKeys.includes(r.scheme_code_amc));
        if (toDelete.length > 0) {
          const ids = toDelete.map(r => r.id).join(',');
          await sbFetch(`scheme_code_map?id=in.(${ids})`, 'DELETE');
        }
      }

      return res.status(200).json({
        ok:         true,
        totalMapped,
        amcCount,
        message:    `Saved ${totalMapped} mappings across ${amcCount} AMCs`,
      });

    } catch (err) {
      console.error('[amfi?action=scheme-code-map] POST error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// action=amc-scheme-id-methods — per-AMC parsing method classification (r/w)
// GET  → { ok, rules: [{id, amc_id, amc_name, method, updated_at}] }
// POST → { amc_id, method } → updates one AMC's method, sets updated_at=now()
// ─────────────────────────────────────────────────────────────────────────────
async function handleAmcSchemeIdMethods(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const rows = await sbFetch(
        'amc_scheme_id_method?select=id,amc_id,method,updated_at,amcs!inner(name)'
      );
      const result = (rows || [])
        .map(r => ({
          id:         r.id,
          amc_id:     r.amc_id,
          amc_name:   r.amcs?.name || r.amc_id,
          method:     r.method,
          updated_at: r.updated_at || null,
        }))
        .sort((a, b) => a.amc_name.localeCompare(b.amc_name));
      return res.status(200).json({ ok: true, rules: result });
    } catch (err) {
      console.error('[amfi?action=amc-scheme-id-methods] GET error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { amc_id, method } = req.body;
      if (!amc_id || !method) {
        return res.status(400).json({ ok: false, error: 'amc_id and method required' });
      }
      const valid = ['sheet_name_is_code', 'scheme_name_from_cell'];
      if (!valid.includes(method)) {
        return res.status(400).json({ ok: false, error: `method must be one of: ${valid.join(', ')}` });
      }
      await sbFetch(`amc_scheme_id_method?amc_id=eq.${amc_id}`, 'PATCH', {
        method,
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[amfi?action=amc-scheme-id-methods] POST error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// action=parser-outliers — fetch pending parser_outliers rows
// GET ?month=YYYY-MM → { ok, outliers: [...] }  (month filter optional)
// If month omitted, returns ALL pending rows.
// ─────────────────────────────────────────────────────────────────────────────
async function handleParserOutliersGet(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { month } = req.query;
    let filter = 'parser_outliers?status=eq.pending&order=amc_name.asc,sheet_name.asc';

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mo] = month.split('-').map(Number);
      const start = `${month}-01`;
      const end   = mo === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mo + 1).padStart(2, '0')}-01`;
      filter = `parser_outliers?status=eq.pending&run_date=gte.${start}&run_date=lt.${end}&order=amc_name.asc,sheet_name.asc`;
    }

    const rows = await sbFetch(filter);
    return res.status(200).json({ ok: true, outliers: rows || [] });
  } catch (err) {
    console.error('[amfi?action=parser-outliers] GET error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=parser-outliers-resolve — mark one parser_outliers row as resolved
// POST { id, status, resolved_by? } → PATCH row, set resolved_at=now()
//   status must be: 'ignored' | 'index_sheet' | 'mapped'
// ─────────────────────────────────────────────────────────────────────────────
async function handleParserOutliersResolve(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { id, status, resolved_by } = req.body;
    const validStatuses = ['ignored', 'index_sheet', 'mapped'];
    if (!id || !status || !validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: `id and status (${validStatuses.join('|')}) required` });
    }
    await sbFetch(`parser_outliers?id=eq.${id}`, 'PATCH', {
      status,
      resolved_at: new Date().toISOString(),
      resolved_by: resolved_by || 'admin',
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[amfi?action=parser-outliers-resolve] POST error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
