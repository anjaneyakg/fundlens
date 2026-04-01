// api/market-gauge.js — Market Valuation Gauge (G1)
// Queries bse_index_data from Supabase, computes percentile-based valuation scores
// Returns pre-shaped JSON for hero widget + full tool page + embeddable iframe
// Cache: Vercel Edge CDN — revalidates every hour

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

// Broad market = weighted composite of these two
const BROAD_MARKET_INDICES = ['BSE 500', 'BSE SENSEX'];

const DEFAULT_WEIGHTS = { pe: 0.30, pb: 0.40, dy: 0.30 };

const ZONE_THRESHOLDS = [
  { min: 80, max: 100, label: 'Deep Value',  color: '#16a34a' },
  { min: 60, max: 80,  label: 'Attractive',  color: '#65a30d' },
  { min: 40, max: 60,  label: 'Fair Value',  color: '#d97706' },
  { min: 20, max: 40,  label: 'Expensive',   color: '#ea580c' },
  { min: 0,  max: 20,  label: 'Stretched',   color: '#dc2626' },
];

function getZone(score) {
  return ZONE_THRESHOLDS.find(z => score >= z.min && score <= z.max)
    || ZONE_THRESHOLDS[ZONE_THRESHOLDS.length - 1];
}

// Percentile rank of value within array (0–100)
// lower_is_worse=true → high value = low score (expensive)
// lower_is_worse=false → high value = high score (cheap, e.g. div yield)
function percentileRank(value, arr, lowerIsBetter = true) {
  if (!arr || arr.length === 0 || value == null) return 50;
  const sorted = [...arr].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else break;
  }
  const rawPct = (count / sorted.length) * 100;
  // Invert if lower value = cheaper (PE, PB): high PE → low score
  return lowerIsBetter ? 100 - rawPct : rawPct;
}

// Compute composite valuation score for a single data point
// given full historical arrays for context
function computeScore(point, hPE, hPB, hDY, weights = DEFAULT_WEIGHTS) {
  const peScore = percentileRank(point.pe,       hPE, true);   // high PE = expensive
  const pbScore = percentileRank(point.pb,       hPB, true);   // high PB = expensive
  const dyScore = percentileRank(point.div_yield, hDY, false); // high DY = cheap
  return Math.round(
    peScore * weights.pe +
    pbScore * weights.pb +
    dyScore * weights.dy
  );
}

// Sample to last-trading-day of each month (reduces payload significantly)
function sampleMonthly(rows) {
  const byMonth = {};
  for (const r of rows) {
    const key = r.date.slice(0, 7); // YYYY-MM
    if (!byMonth[key] || r.date > byMonth[key].date) {
      byMonth[key] = r;
    }
  }
  return Object.values(byMonth).sort((a, b) => a.date.localeCompare(b.date));
}

// Detect bottom-entry events (score crosses into Deep Value ≥80 then exits)
// and compute forward returns from entry date
function detectZoneEvents(series, entryZoneMin, direction = 'bottom') {
  // direction: 'bottom' = Deep Value entries, 'peak' = Stretched entries
  const events = [];
  let inZone = false;
  let entryIdx = null;

  for (let i = 0; i < series.length; i++) {
    const inNow = direction === 'bottom'
      ? series[i].score >= entryZoneMin         // Deep Value
      : series[i].score <= (100 - entryZoneMin); // Stretched

    if (!inZone && inNow) {
      inZone = true;
      entryIdx = i;
    } else if (inZone && !inNow) {
      inZone = false;
      // Record the entry point
      const entry = series[entryIdx];
      const fwdReturns = {};
      const periods = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '3Y': 36 };
      for (const [label, months] of Object.entries(periods)) {
        const targetIdx = entryIdx + months;
        if (targetIdx < series.length) {
          const fwdClose = series[targetIdx].close;
          fwdReturns[label] = parseFloat(
            (((fwdClose - entry.close) / entry.close) * 100).toFixed(2)
          );
        }
      }
      if (Object.keys(fwdReturns).length >= 3) {
        events.push({
          date: entry.date,
          score: entry.score,
          close: entry.close,
          pe: entry.pe,
          pb: entry.pb,
          dy: entry.dy,
          returns: fwdReturns,
        });
      }
      entryIdx = null;
    }
  }
  return events;
}

// Median of an array
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : parseFloat(((s[m - 1] + s[m]) / 2).toFixed(2));
}

// Build median forward return summary across all events
function summariseEvents(events) {
  const periods = ['1M', '3M', '6M', '1Y', '2Y', '3Y'];
  const medians = {};
  for (const p of periods) {
    const vals = events.map(e => e.returns[p]).filter(v => v != null);
    medians[p] = median(vals);
  }
  return { count: events.length, median_returns: medians, events };
}

// Process one index: full series → monthly sample → scored series → events
function processIndex(rows, weights = DEFAULT_WEIGHTS) {
  if (!rows || rows.length < 12) return null;

  // Build historical arrays for percentile context (all available data)
  const hPE = rows.map(r => r.pe).filter(v => v != null && v > 0);
  const hPB = rows.map(r => r.pb).filter(v => v != null && v > 0);
  const hDY = rows.map(r => r.div_yield).filter(v => v != null && v > 0);

  const monthly = sampleMonthly(rows);

  const series = monthly.map(r => {
    const score = (r.pe == null || r.pb == null || r.div_yield == null)
      ? null
      : computeScore(r, hPE, hPB, hDY, weights);
    return {
      date:  r.date,
      score,
      zone:  score != null ? getZone(score).label : null,
      close: r.close,
      pe:    r.pe,
      pb:    r.pb,
      dy:    r.div_yield,
    };
  }).filter(r => r.score != null);

  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const bottoms = detectZoneEvents(series, 80, 'bottom');
  const peaks   = detectZoneEvents(series, 80, 'peak');

  // History stats
  const allScores = series.map(s => s.score);
  const minDate = series[0].date;
  const maxDate = latest.date;

  return {
    current_score:        latest.score,
    current_zone:         getZone(latest.score),
    latest_pe:            latest.pe,
    latest_pb:            latest.pb,
    latest_dy:            latest.dy,
    latest_close:         latest.close,
    latest_date:          latest.date,
    history_from:         minDate,
    history_to:           maxDate,
    data_points:          series.length,
    score_min:            Math.min(...allScores),
    score_max:            Math.max(...allScores),
    score_avg:            Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length),
    series,                              // full monthly series for charting
    returns_from_bottoms: summariseEvents(bottoms),
    returns_from_peaks:   summariseEvents(peaks),
  };
}

// Build broad market composite (simple average of BSE500 + SENSEX scores)
function buildBroadMarket(byIndex) {
  const available = BROAD_MARKET_INDICES.filter(n => byIndex[n]);
  if (available.length === 0) return null;

  // Align series by date
  const dateSets = available.map(n => new Set(byIndex[n].series.map(s => s.date)));
  const commonDates = [...dateSets[0]].filter(d => dateSets.every(ds => ds.has(d))).sort();

  const series = commonDates.map(date => {
    const points = available.map(n => byIndex[n].series.find(s => s.date === date));
    const score  = Math.round(points.reduce((a, p) => a + p.score, 0) / points.length);
    const close  = points[0].close; // use BSE500 close as reference
    return {
      date,
      score,
      zone:  getZone(score).label,
      close,
      pe:    points[0].pe,
      pb:    points[0].pb,
      dy:    points[0].dy,
      // include both index closes for dual-line chart
      closes: Object.fromEntries(available.map((n, i) => [n, points[i].close])),
    };
  });

  if (series.length === 0) return null;

  const latest = series[series.length - 1];
  const allScores = series.map(s => s.score);
  const bottoms = detectZoneEvents(series, 80, 'bottom');
  const peaks   = detectZoneEvents(series, 80, 'peak');

  return {
    indices_combined:     available,
    current_score:        latest.score,
    current_zone:         getZone(latest.score),
    latest_date:          latest.date,
    history_from:         series[0].date,
    history_to:           latest.date,
    data_points:          series.length,
    score_min:            Math.min(...allScores),
    score_max:            Math.max(...allScores),
    score_avg:            Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length),
    series,
    returns_from_bottoms: summariseEvents(bottoms),
    returns_from_peaks:   summariseEvents(peaks),
  };
}

// Generate auto-commentary string
function generateCommentary(indexName, data) {
  if (!data) return '';
  const { current_score, current_zone, latest_pe, latest_pb, latest_dy, history_from, returns_from_bottoms } = data;
  const fromYear = history_from ? history_from.slice(0, 4) : '1990';
  const medReturn3Y = returns_from_bottoms?.median_returns?.['3Y'];
  const returnNote = medReturn3Y != null
    ? ` Median 3-year return from similar valuation levels historically: ${medReturn3Y > 0 ? '+' : ''}${medReturn3Y}%.`
    : '';
  const peStr  = latest_pe  != null ? `P/E of ${latest_pe.toFixed(1)}x` : '';
  const pbStr  = latest_pb  != null ? `P/B of ${latest_pb.toFixed(1)}x` : '';
  const dyStr  = latest_dy  != null ? `Dividend Yield of ${latest_dy.toFixed(2)}%` : '';
  const metrics = [peStr, pbStr, dyStr].filter(Boolean).join(', ');
  const scoreDesc = current_score >= 80 ? 'cheapest' : current_score >= 60 ? 'below-average' : current_score >= 40 ? 'average' : current_score >= 20 ? 'above-average' : 'highest';

  return `${indexName} is trading at ${metrics}. Based on full history since ${fromYear}, current valuations are at the ${current_score}th percentile — among the ${scoreDesc} seen historically. This places the market in the ${current_zone.label} zone.${returnNote}`;
}

export default async function handler(req, res) {
  // CORS — allow embed iframes from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Edge cache: serve from CDN for 1 hour, allow stale for 4 hours
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=14400');

  const SUPABASE_URL     = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Supabase env vars not configured' });
    return;
  }

  try {
    // Fetch all curated indices in one query (public read RLS — anon key sufficient)
    const indicesParam = CURATED_INDICES.map(n => `"${n}"`).join(',');
    const url = `${SUPABASE_URL}/rest/v1/bse_index_data` +
      `?select=date,index_name,close,pe,pb,div_yield` +
      `&index_name=in.(${encodeURIComponent(CURATED_INDICES.join(','))})` +
      `&order=date.asc` +
      `&limit=500000`;

    const response = await fetch(url, {
      headers: {
        apikey:        SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: 'Supabase query failed', detail: errText });
      return;
    }

    const rows = await response.json();

    // Group by index_name
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.index_name]) grouped[row.index_name] = [];
      grouped[row.index_name].push(row);
    }

    // Process each curated index
    const byIndex = {};
    for (const name of CURATED_INDICES) {
      if (grouped[name]) {
        const processed = processIndex(grouped[name]);
        if (processed) {
          byIndex[name] = {
            ...processed,
            commentary: generateCommentary(name, processed),
          };
        }
      }
    }

    // Build broad market composite
    const broadMarket = buildBroadMarket(byIndex);
    if (broadMarket) {
      broadMarket.commentary = generateCommentary('Broad Market (BSE 500 + Sensex)', broadMarket);
    }

    // Metadata
    const generatedAt = new Date().toISOString();
    const indicesAvailable = Object.keys(byIndex);

    res.status(200).json({
      meta: {
        generated_at:       generatedAt,
        indices_available:  indicesAvailable,
        curated_list:       CURATED_INDICES,
        default_weights:    DEFAULT_WEIGHTS,
        zone_thresholds:    ZONE_THRESHOLDS,
        score_description:  '0 = most expensive in history, 100 = cheapest in history',
      },
      broad_market: broadMarket,
      by_index:     byIndex,
    });

  } catch (err) {
    console.error('[market-gauge] Error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
