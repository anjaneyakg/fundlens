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

  if (action === 'marketcap')       return handleMarketcap(req, res);
  if (action === 'schemes')         return handleSchemes(req, res);
  if (action === 'schemes-list')    return handleSchemesList(req, res);
  if (action === 'scheme-code-map') return handleSchemeCodeMap(req, res);

  return res.status(400).json({ error: 'Unknown action. Valid: marketcap, schemes, schemes-list, scheme-code-map' });
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

function normaliseAmcSchemes(raw, aliasMap = {}) {
  if (!raw) return 'Unknown';
  const s = raw.trim();
  if (aliasMap[s]) return aliasMap[s];
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (s.startsWith(alias)) return canonical;
  }
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
  const s = raw.trim();
  if (aliasMap[s]) return aliasMap[s];
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    if (s.startsWith(alias)) return canonical;
  }
  return null;
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

    const byAmc = {};

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < 4) continue;

      const amcRaw = parts[amcIdx]?.trim();
      const name   = parts[nameIdx]?.trim();
      if (!amcRaw || !name || name.length < 5) continue;

      const amc = normaliseAmcList(amcRaw, aliasMap);
      if (!amc) continue;

      if (!byAmc[amc]) byAmc[amc] = new Set();
      byAmc[amc].add(name);
    }

    const result = {};
    for (const [amc, names] of Object.entries(byAmc)) {
      result[amc] = [...names].sort();
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, byAmc: result });

  } catch (err) {
    console.error('[amfi?action=schemes-list]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=scheme-code-map — scheme code mapping r/w (was api/scheme-code-map.js)
// GET  → fetch data/processed/scheme_code_map.json from FundInsight repo
// POST → save updated mapping back to GitHub
// ─────────────────────────────────────────────────────────────────────────────

const SCM_REPO      = 'anjaneyakg/FundInsight';
const SCM_FILE_PATH = 'data/processed/scheme_code_map.json';
const SCM_BRANCH    = 'main';
const SCM_API_BASE  = `https://api.github.com/repos/${SCM_REPO}/contents/${SCM_FILE_PATH}`;

async function handleSchemeCodeMap(req, res) {
  const token = process.env.VITE_GITHUB_PAT;
  if (!token) return res.status(500).json({ ok: false, error: 'GitHub token not configured' });

  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept:        'application/vnd.github.v3+json',
    'User-Agent':  'FundLens/1.0',
  };

  if (req.method === 'GET') {
    try {
      const r = await fetch(SCM_API_BASE, { headers: ghHeaders });

      if (r.status === 404) return res.status(200).json({});
      if (!r.ok) throw new Error(`GitHub GET returned ${r.status}`);

      const meta = await r.json();

      let content;
      if (meta.encoding === 'base64') {
        content = Buffer.from(meta.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      } else {
        const blobR = await fetch(
          `https://api.github.com/repos/${SCM_REPO}/git/blobs/${meta.sha}`,
          { headers: ghHeaders }
        );
        const blob = await blobR.json();
        content = Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      }

      const mapping = JSON.parse(content);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(mapping);

    } catch (err) {
      console.error('[amfi?action=scheme-code-map] GET error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { mapping } = req.body;
      if (!mapping || typeof mapping !== 'object') {
        return res.status(400).json({ ok: false, error: 'mapping object required in body' });
      }

      const sorted = {};
      for (const amc of Object.keys(mapping).sort()) {
        sorted[amc] = {};
        for (const code of Object.keys(mapping[amc]).sort()) {
          sorted[amc][code] = mapping[amc][code];
        }
      }

      const contentStr    = JSON.stringify(sorted, null, 2);
      const contentBase64 = Buffer.from(contentStr).toString('base64');

      let sha;
      const existing = await fetch(SCM_API_BASE, { headers: ghHeaders });
      if (existing.ok) {
        const meta = await existing.json();
        sha = meta.sha;
      } else if (existing.status !== 404) {
        throw new Error(`GitHub SHA fetch returned ${existing.status}`);
      }

      const totalMapped = Object.values(sorted).reduce(
        (sum, codes) => sum + Object.keys(codes).length, 0
      );
      const amcCount = Object.keys(sorted).length;

      const body = {
        message: `scheme mapping: ${totalMapped} codes across ${amcCount} AMCs`,
        content: contentBase64,
        branch:  SCM_BRANCH,
        ...(sha ? { sha } : {}),
      };

      const putRes = await fetch(SCM_API_BASE, {
        method:  'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!putRes.ok) {
        const errData = await putRes.json();
        throw new Error(errData.message || `GitHub PUT returned ${putRes.status}`);
      }

      return res.status(200).json({
        ok:           true,
        totalMapped,
        amcCount,
        message:      `Saved ${totalMapped} mappings across ${amcCount} AMCs`,
      });

    } catch (err) {
      console.error('[amfi?action=scheme-code-map] POST error:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
