// api/market-gauge.js — Market Valuation Gauge (G1)
// Fetches each index independently in parallel — avoids PostgREST row limits
// Cache: 5 min live, 10 min stale

const CURATED_INDICES = [
  'BSE 500',
  'BSE SENSEX',
  'BSE MID CAP',
  'BSE SMALL CAP',
  'BSE IT',
  'BSE BANKEX',
  'BSE HEALTHCARE',
  'BSE AUTO',
  'BSE FMCG',
  'BSE METAL',
  'BSE REALTY',
  'BSE ENERGY',
  'BSE CONSUMER DURABLES',
  'BSE MIDCAP 150',
  'BSE LARGECAP',
];

const BROAD_MARKET_INDICES = ['BSE 500', 'BSE SENSEX'];
const DEFAULT_WEIGHTS      = { pe: 0.30, pb: 0.40, dy: 0.30 };
const ZONE_THRESHOLDS      = [
  { min: 80, max: 100, label: 'Deep Value',  color: '#16a34a' },
  { min: 60, max: 80,  label: 'Attractive',  color: '#65a30d' },
  { min: 40, max: 60,  label: 'Fair Value',  color: '#d97706' },
  { min: 20, max: 40,  label: 'Expensive',   color: '#ea580c' },
  { min: 0,  max: 20,  label: 'Stretched',   color: '#dc2626' },
];

function getZone(score) {
  return ZONE_THRESHOLDS.find(z => score >= z.min && score <= z.max) || ZONE_THRESHOLDS[ZONE_THRESHOLDS.length - 1];
}

function percentileRank(value, arr, lowerIsBetter = true) {
  if (!arr || arr.length === 0 || value == null) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) { if (v < value) count++; else break; }
  const rawPct = (count / sorted.length) * 100;
  return lowerIsBetter ? 100 - rawPct : rawPct;
}

function computeScore(point, hPE, hPB, hDY, weights = DEFAULT_WEIGHTS) {
  return Math.round(
    percentileRank(point.pe,        hPE, true)  * weights.pe +
    percentileRank(point.pb,        hPB, true)  * weights.pb +
    percentileRank(point.div_yield, hDY, false) * weights.dy
  );
}

function sampleWeekly(rows) {
  const byWeek = {};
  for (const r of rows) {
    const d = new Date(r.date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    if (!byWeek[key] || r.date > byWeek[key].date) byWeek[key] = r;
  }
  return Object.values(byWeek).sort((a, b) => a.date.localeCompare(b.date));
}

function sampleMonthly(rows) {
  const byMonth = {};
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    if (!byMonth[key] || r.date > byMonth[key].date) byMonth[key] = r;
  }
  return Object.values(byMonth).sort((a, b) => a.date.localeCompare(b.date));
}

function detectZoneEvents(series, entryZoneMin, direction = 'bottom') {
  const events = [];
  let inZone = false, entryIdx = null;
  for (let i = 0; i < series.length; i++) {
    const inNow = direction === 'bottom' ? series[i].score >= entryZoneMin : series[i].score <= (100 - entryZoneMin);
    if (!inZone && inNow) { inZone = true; entryIdx = i; }
    else if (inZone && !inNow) {
      inZone = false;
      const entry = series[entryIdx];
      const fwdReturns = {};
      for (const [label, months] of Object.entries({ '1M':1,'3M':3,'6M':6,'1Y':12,'2Y':24,'3Y':36 })) {
        const ti = entryIdx + months;
        if (ti < series.length) fwdReturns[label] = parseFloat((((series[ti].close - entry.close) / entry.close) * 100).toFixed(2));
      }
      if (Object.keys(fwdReturns).length >= 3) events.push({ date:entry.date, score:entry.score, close:entry.close, pe:entry.pe, pb:entry.pb, dy:entry.dy, returns:fwdReturns });
      entryIdx = null;
    }
  }
  return events;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : parseFloat(((s[m-1]+s[m])/2).toFixed(2));
}

function summariseEvents(events) {
  const periods = ['1M','3M','6M','1Y','2Y','3Y'];
  const medians = {};
  for (const p of periods) medians[p] = median(events.map(e => e.returns[p]).filter(v => v != null));
  return { count: events.length, median_returns: medians, events };
}

function processIndex(rows, weights = DEFAULT_WEIGHTS) {
  if (!rows || rows.length < 12) return null;
  const hPE = rows.map(r => r.pe).filter(v => v != null && v > 0);
  const hPB = rows.map(r => r.pb).filter(v => v != null && v > 0);
  const hDY = rows.map(r => r.div_yield).filter(v => v != null && v > 0);

  const mapRow = r => {
    const score = (r.pe == null || r.pb == null || r.div_yield == null) ? null : computeScore(r, hPE, hPB, hDY, weights);
    return { date:r.date, score, zone: score!=null?getZone(score).label:null, close:r.close, pe:r.pe, pb:r.pb, dy:r.div_yield };
  };

  const series         = sampleWeekly(rows).map(mapRow).filter(r => r.score != null);
  const series_monthly = sampleMonthly(rows).map(mapRow).filter(r => r.score != null);
  if (series.length === 0) return null;

  const latest    = series[series.length - 1];
  const allScores = series.map(s => s.score);
  const bottoms   = detectZoneEvents(series_monthly, 80, 'bottom');
  const peaks     = detectZoneEvents(series_monthly, 80, 'peak');

  return {
    current_score: latest.score, current_zone: getZone(latest.score),
    latest_pe: latest.pe, latest_pb: latest.pb, latest_dy: latest.dy,
    latest_close: latest.close, latest_date: latest.date,
    history_from: series[0].date, history_to: latest.date,
    data_points: series.length,
    score_min: Math.min(...allScores), score_max: Math.max(...allScores),
    score_avg: Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length),
    series, series_monthly,
    returns_from_bottoms: summariseEvents(bottoms),
    returns_from_peaks:   summariseEvents(peaks),
  };
}

function buildBroadMarket(byIndex) {
  const available = BROAD_MARKET_INDICES.filter(n => byIndex[n]);
  if (available.length === 0) return null;

  const alignSeries = key => {
    const dateSets = available.map(n => new Set(byIndex[n][key].map(s => s.date)));
    return [...dateSets[0]].filter(d => dateSets.every(ds => ds.has(d))).sort().map(date => {
      const points = available.map(n => byIndex[n][key].find(s => s.date === date));
      const score  = Math.round(points.reduce((a,p)=>a+p.score,0)/points.length);
      return { date, score, zone:getZone(score).label, close:points[0].close, pe:points[0].pe, pb:points[0].pb, dy:points[0].dy };
    });
  };

  const series         = alignSeries('series');
  const series_monthly = alignSeries('series_monthly');
  if (series.length === 0) return null;

  const latest    = series[series.length-1];
  const allScores = series.map(s=>s.score);
  const bottoms   = detectZoneEvents(series_monthly, 80, 'bottom');
  const peaks     = detectZoneEvents(series_monthly, 80, 'peak');

  return {
    indices_combined: available,
    current_score: latest.score, current_zone: getZone(latest.score),
    latest_date: latest.date, latest_pe: latest.pe, latest_pb: latest.pb, latest_dy: latest.dy,
    history_from: series[0].date, history_to: latest.date,
    data_points: series.length,
    score_min: Math.min(...allScores), score_max: Math.max(...allScores),
    score_avg: Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length),
    series, series_monthly,
    returns_from_bottoms: summariseEvents(bottoms),
    returns_from_peaks:   summariseEvents(peaks),
  };
}

function generateCommentary(indexName, data) {
  if (!data) return '';
  const { current_score, current_zone, latest_pe, latest_pb, latest_dy, history_from, returns_from_bottoms } = data;
  const fromYear   = history_from ? history_from.slice(0,4) : '1990';
  const medRet3Y   = returns_from_bottoms?.median_returns?.['3Y'];
  const retNote    = medRet3Y != null ? ` Median 3-year return from similar levels historically: ${medRet3Y>0?'+':''}${medRet3Y}%.` : '';
  const metrics    = [
    latest_pe  != null ? `P/E of ${latest_pe.toFixed(1)}x`          : '',
    latest_pb  != null ? `P/B of ${latest_pb.toFixed(1)}x`          : '',
    latest_dy  != null ? `Dividend Yield of ${latest_dy.toFixed(2)}%` : '',
  ].filter(Boolean).join(', ');
  const scoreDesc  = current_score>=80?'cheapest':current_score>=60?'below-average (attractive)':current_score>=40?'average':current_score>=20?'above-average (expensive)':'most expensive';
  return `${indexName} is trading at ${metrics}. Based on full history since ${fromYear}, current valuations rank at the ${current_score}th percentile — among the ${scoreDesc} seen historically. This places the market in the ${current_zone.label} zone.${retNote}`;
}

// ── Fetch one index from Supabase ─────────────────────────────────────────────
async function fetchOneIndex(name, supabaseUrl, anonKey) {
  const url = `${supabaseUrl}/rest/v1/bse_index_data` +
    `?select=date,index_name,close,pe,pb,div_yield` +
    `&index_name=eq.${encodeURIComponent(name)}` +
    `&order=date.asc` +
    `&limit=10000`;
  try {
    const r = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    });
    if (!r.ok) { console.error(`[market-gauge] fetch failed for ${name}: ${r.status}`); return []; }
    return await r.json();
  } catch (e) {
    console.error(`[market-gauge] fetch error for ${name}:`, e.message);
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const SUPABASE_URL      = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Supabase env vars not configured' });
    return;
  }

  try {
    // Fetch all 15 indices in parallel — each call is small (~8k rows max)
    const fetched = await Promise.all(
      CURATED_INDICES.map(name => fetchOneIndex(name, SUPABASE_URL, SUPABASE_ANON_KEY))
    );

    const byIndex = {};
    CURATED_INDICES.forEach((name, i) => {
      if (fetched[i]?.length) {
        const processed = processIndex(fetched[i]);
        if (processed) byIndex[name] = { ...processed, commentary: generateCommentary(name, processed) };
      }
    });

    const broadMarket = buildBroadMarket(byIndex);
    if (broadMarket) broadMarket.commentary = generateCommentary('Broad Market (BSE 500 + Sensex)', broadMarket);

    res.status(200).json({
      meta: {
        generated_at:      new Date().toISOString(),
        indices_available: Object.keys(byIndex),
        curated_list:      CURATED_INDICES,
        default_weights:   DEFAULT_WEIGHTS,
        zone_thresholds:   ZONE_THRESHOLDS,
        score_description: '0 = most expensive in history · 100 = cheapest in history',
      },
      broad_market: broadMarket,
      by_index:     byIndex,
    });

  } catch (err) {
    console.error('[market-gauge] Error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
