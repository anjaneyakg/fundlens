// src/pages/MarketGauge.jsx — G1 Market Valuation Gauge (Full Tool Page)
// Three-panel: A) Valuation Oscillator  B) Returns from Bottoms  C) Returns from Peaks
// Weight adjuster sliders, index selector, auto-commentary, embed snippet generator

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComposedChart, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_CONFIG = [
  { label: 'Deep Value',  min: 80, max: 100, color: '#15803d', bg: 'rgba(21,128,61,0.10)'  },
  { label: 'Attractive',  min: 60, max: 80,  color: '#65a30d', bg: 'rgba(101,163,13,0.10)' },
  { label: 'Fair Value',  min: 40, max: 60,  color: '#d97706', bg: 'rgba(217,119,6,0.10)'  },
  { label: 'Expensive',   min: 20, max: 40,  color: '#ea580c', bg: 'rgba(234,88,12,0.10)'  },
  { label: 'Stretched',   min: 0,  max: 20,  color: '#dc2626', bg: 'rgba(220,38,38,0.10)'  },
];

const ZONE_COLOR = (score) => {
  const z = ZONE_CONFIG.find(z => score >= z.min && score <= z.max);
  return z ? z.color : '#6b7280';
};

const RETURN_PERIODS = ['1M', '3M', '6M', '1Y', '2Y', '3Y'];

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

const fmtScore = (s) => s != null ? s.toFixed(0) : '—';

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: '24px 16px 48px',
  },
  header: {
    maxWidth: 1200,
    margin: '0 auto 28px',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#eff6ff', border: '1px solid #bfdbfe',
    borderRadius: 20, padding: '3px 12px',
    fontSize: 12, fontWeight: 600, color: '#1d4ed8',
    marginBottom: 10,
  },
  h1: {
    fontSize: 'clamp(22px, 4vw, 32px)',
    fontWeight: 800, color: '#0f172a', margin: '0 0 8px',
  },
  subtitle: { color: '#64748b', fontSize: 15, margin: 0 },

  card: {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '18px 24px 14px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 },
  cardSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardBody: { padding: '20px 24px' },

  controlsRow: {
    maxWidth: 1200, margin: '0 auto 20px',
    display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start',
  },

  // Index Selector
  indexSelector: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    flex: '1 1 300px',
  },
  indexGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10,
  },
  indexBtn: (active) => ({
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    border: active ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
    background: active ? '#eff6ff' : '#f8fafc',
    color: active ? '#2563eb' : '#64748b',
    transition: 'all 0.15s',
  }),

  // Weight Studio
  weightCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    flex: '1 1 280px',
  },
  weightRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
  },
  weightLabel: { fontSize: 12, fontWeight: 600, color: '#374151', width: 28 },
  weightSlider: { flex: 1, accentColor: '#2563eb' },
  weightPct: { fontSize: 12, fontWeight: 700, color: '#2563eb', width: 32, textAlign: 'right' },

  // Current Valuation Summary
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: (color) => ({
    background: '#f8fafc',
    border: `1.5px solid ${color}30`,
    borderRadius: 12,
    padding: '12px 16px',
    textAlign: 'center',
  }),
  metricValue: (color) => ({
    fontSize: 22, fontWeight: 800, color,
  }),
  metricLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 500 },

  // Zone Badge
  zoneBadge: (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: `${color}18`,
    border: `1.5px solid ${color}`,
    borderRadius: 20,
    padding: '4px 14px',
    fontSize: 13, fontWeight: 700, color,
  }),
  zoneDot: (color) => ({
    width: 8, height: 8, borderRadius: '50%', background: color,
  }),

  // Commentary
  commentary: {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 14, color: '#0c4a6e',
    lineHeight: 1.6,
    marginBottom: 0,
  },

  // Panel label
  panelLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, fontWeight: 600, color: '#374151',
    marginBottom: 4,
  },
  panelTag: (color) => ({
    background: color, color: '#fff',
    borderRadius: 6, padding: '2px 8px',
    fontSize: 11, fontWeight: 700,
  }),

  // Returns summary
  returnsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8, marginTop: 12,
  },
  returnCell: (val) => ({
    background: val == null ? '#f1f5f9' : val >= 0 ? '#f0fdf4' : '#fef2f2',
    border: `1px solid ${val == null ? '#e2e8f0' : val >= 0 ? '#bbf7d0' : '#fecaca'}`,
    borderRadius: 8, padding: '8px 10px', textAlign: 'center',
  }),
  returnVal: (val) => ({
    fontSize: 15, fontWeight: 700,
    color: val == null ? '#94a3b8' : val >= 0 ? '#16a34a' : '#dc2626',
  }),
  returnPeriod: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Embed section
  embedBox: {
    background: '#0f172a',
    borderRadius: 10,
    padding: '14px 16px',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#94a3b8',
    wordBreak: 'break-all',
    lineHeight: 1.6,
    marginTop: 10,
  },
  copyBtn: {
    marginTop: 8,
    padding: '6px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  },

  loading: {
    textAlign: 'center', padding: '80px 20px',
    color: '#94a3b8', fontSize: 16,
  },
  error: {
    textAlign: 'center', padding: '60px 20px',
    color: '#dc2626', fontSize: 15,
  },

  // Legend strip
  zoneLegend: {
    display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
    marginBottom: 8,
  },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: '#64748b',
  },
  legendDot: (color) => ({
    width: 10, height: 10, borderRadius: 2, background: color,
  }),

  divider: { margin: '0 0 20px', border: 'none', borderTop: '1px solid #f1f5f9' },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ValuationTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const zone = ZONE_CONFIG.find(z => d.score >= z.min && d.score <= z.max);
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      minWidth: 170,
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{fmtDate(d.date)}</div>
      {zone && (
        <div style={{ color: zone.color, fontWeight: 600, marginBottom: 4 }}>
          ● {zone.label}
        </div>
      )}
      <div style={{ color: '#64748b' }}>Score: <b style={{ color: ZONE_COLOR(d.score) }}>{d.score}</b></div>
      {d.pe  != null && <div style={{ color: '#64748b' }}>P/E: <b>{d.pe?.toFixed(1)}</b></div>}
      {d.pb  != null && <div style={{ color: '#64748b' }}>P/B: <b>{d.pb?.toFixed(1)}</b></div>}
      {d.dy  != null && <div style={{ color: '#64748b' }}>Div Yield: <b>{d.dy?.toFixed(2)}%</b></div>}
      {d.close != null && <div style={{ color: '#64748b', marginTop: 4 }}>Index: <b>{d.close?.toLocaleString('en-IN')}</b></div>}
    </div>
  );
};

const ReturnTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.value >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
          {p.name}: {p.value > 0 ? '+' : ''}{p.value?.toFixed(1)}%
        </div>
      ))}
    </div>
  );
};

// ─── Weight Slider Component ──────────────────────────────────────────────────

function WeightSlider({ weights, onChange }) {
  const keys = ['pe', 'pb', 'dy'];
  const labels = { pe: 'PE', pb: 'PB', dy: 'DY' };

  const handleChange = (key, newVal) => {
    const remaining = 100 - newVal;
    const others = keys.filter(k => k !== key);
    const currentOthersSum = others.reduce((s, k) => s + weights[k], 0);
    const newWeights = { ...weights, [key]: newVal };
    if (currentOthersSum === 0) {
      const split = Math.floor(remaining / 2);
      newWeights[others[0]] = split;
      newWeights[others[1]] = remaining - split;
    } else {
      others.forEach(k => {
        newWeights[k] = Math.round((weights[k] / currentOthersSum) * remaining);
      });
    }
    // Fix rounding drift
    const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (total !== 100) newWeights[keys[keys.length - 1]] += 100 - total;
    onChange(newWeights);
  };

  return (
    <div>
      {keys.map(k => (
        <div key={k} style={S.weightRow}>
          <span style={S.weightLabel}>{labels[k]}</span>
          <input
            type="range" min={10} max={80} value={weights[k]}
            style={S.weightSlider}
            onChange={e => handleChange(k, Number(e.target.value))}
          />
          <span style={S.weightPct}>{weights[k]}%</span>
        </div>
      ))}
      <button
        onClick={() => onChange({ pe: 30, pb: 40, dy: 30 })}
        style={{
          marginTop: 10, padding: '4px 12px', borderRadius: 8,
          border: '1px solid #e2e8f0', background: '#f8fafc',
          fontSize: 11, cursor: 'pointer', color: '#64748b',
        }}
      >↩ Reset defaults (PE 30 / PB 40 / DY 30)</button>
    </div>
  );
}

// ─── Recompute scores client-side when weights change ─────────────────────────

function recomputeSeriesWithWeights(originalSeries, rawRows, weights) {
  // If no raw rows, fall back to original (weights unchanged)
  if (!rawRows || rawRows.length === 0) return originalSeries;
  // originalSeries already has pe/pb/dy — recompute percentile ranks
  const hPE = rawRows.map(r => r.pe).filter(v => v > 0);
  const hPB = rawRows.map(r => r.pb).filter(v => v > 0);
  const hDY = rawRows.map(r => r.dy).filter(v => v > 0);

  function pct(value, arr, invert) {
    if (!arr.length || value == null) return 50;
    const sorted = [...arr].sort((a, b) => a - b);
    let count = 0;
    for (const v of sorted) { if (v < value) count++; else break; }
    const raw = (count / sorted.length) * 100;
    return invert ? 100 - raw : raw;
  }

  return originalSeries.map(p => {
    const score = Math.round(
      pct(p.pe, hPE, true)  * (weights.pe / 100) +
      pct(p.pb, hPB, true)  * (weights.pb / 100) +
      pct(p.dy, hDY, false) * (weights.dy / 100)
    );
    const zone = ZONE_CONFIG.find(z => score >= z.min && score <= z.max);
    return { ...p, score, zone: zone?.label ?? 'Unknown' };
  });
}

// ─── Panel A: Valuation Oscillator ───────────────────────────────────────────

function PanelOscillator({ series, indexName }) {
  if (!series?.length) return <div style={S.loading}>No data available</div>;

  const tickInterval = Math.max(1, Math.floor(series.length / 10));

  return (
    <div>
      <div style={S.zoneLegend}>
        {ZONE_CONFIG.map(z => (
          <div key={z.label} style={S.legendItem}>
            <div style={S.legendDot(z.color)} />
            {z.label} ({z.min}–{z.max})
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

          {/* Coloured zone bands */}
          {ZONE_CONFIG.map(z => (
            <ReferenceArea
              key={z.label} y1={z.min} y2={z.max}
              yAxisId="score" fill={z.bg} fillOpacity={1}
            />
          ))}

          <XAxis
            dataKey="date"
            tickFormatter={d => d?.slice(0, 7)}
            interval={tickInterval}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="score" domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            label={{ value: 'Valuation Score', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="close" orientation="right"
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
          />
          <Tooltip content={<ValuationTooltip />} />

          {/* Index close — right axis, thin grey */}
          <Line
            yAxisId="close" type="monotone" dataKey="close"
            stroke="#cbd5e1" strokeWidth={1} dot={false}
            name={indexName}
          />

          {/* Valuation score — left axis, coloured */}
          <Line
            yAxisId="score" type="monotone" dataKey="score"
            stroke="#2563eb" strokeWidth={2} dot={false}
            name="Valuation Score"
            strokeLinecap="round"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Panel B/C: Returns from Zone Events ─────────────────────────────────────

function PanelReturns({ data, type }) {
  // data = { count, median_returns, events }
  if (!data || data.count === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
        {type === 'bottom'
          ? 'No Deep Value entry events detected in available history.'
          : 'No Stretched valuation peak events detected in available history.'}
      </div>
    );
  }

  // Build bar chart data — median return per period
  const barData = RETURN_PERIODS.map(p => ({
    period: p,
    median: data.median_returns?.[p] ?? null,
  })).filter(d => d.median != null);

  // Event table — last 8 events
  const recentEvents = [...(data.events || [])].reverse().slice(0, 8);

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Bar chart of median returns */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
            Median Forward Returns ({data.count} events)
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip content={<ReturnTooltip />} />
              <Bar dataKey="median" radius={[4, 4, 0, 0]} name="Median Return">
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.median >= 0 ? '#16a34a' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Event list */}
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
            Historical Events (most recent first)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['Date', 'Score', 'PE', 'PB', '1Y Ret', '3Y Ret'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '5px 8px', color: '#374151' }}>{ev.date?.slice(0, 7)}</td>
                    <td style={{ padding: '5px 8px', color: ZONE_COLOR(ev.score), fontWeight: 700 }}>{ev.score}</td>
                    <td style={{ padding: '5px 8px', color: '#374151' }}>{ev.pe?.toFixed(1)}</td>
                    <td style={{ padding: '5px 8px', color: '#374151' }}>{ev.pb?.toFixed(1)}</td>
                    <td style={{ padding: '5px 8px', color: ev.returns?.['1Y'] >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {ev.returns?.['1Y'] != null ? `${ev.returns['1Y'] > 0 ? '+' : ''}${ev.returns['1Y']}%` : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', color: ev.returns?.['3Y'] >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {ev.returns?.['3Y'] != null ? `${ev.returns['3Y'] > 0 ? '+' : ''}${ev.returns['3Y']}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Median return summary strip */}
      <div style={S.returnsGrid}>
        {RETURN_PERIODS.map(p => {
          const val = data.median_returns?.[p];
          return (
            <div key={p} style={S.returnCell(val)}>
              <div style={S.returnVal(val)}>
                {val != null ? `${val > 0 ? '+' : ''}${val}%` : '—'}
              </div>
              <div style={S.returnPeriod}>{p} median</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Embed Generator ──────────────────────────────────────────────────────────

function EmbedGenerator({ selectedIndex }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;
  const param = selectedIndex === '__broad__' ? 'broad' : encodeURIComponent(selectedIndex);
  const src = `${baseUrl}/embed/market-gauge?index=${param}&theme=light`;
  const code = `<iframe\n  src="${src}"\n  width="100%" height="520"\n  frameborder="0"\n  style="border-radius:12px;"\n  title="FundLens Market Valuation Gauge"\n></iframe>`;

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
        Embed this gauge on any website — paste the code below into your HTML:
      </div>
      <div style={S.embedBox}>{code}</div>
      <button style={S.copyBtn} onClick={copy}>
        {copied ? '✓ Copied!' : '⧉ Copy Embed Code'}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketGauge() {
  const [apiData,  setApiData]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState('__broad__'); // '__broad__' or index name
  const [weights,  setWeights]  = useState({ pe: 30, pb: 40, dy: 30 });
  const [showEmbed, setShowEmbed] = useState(false);

  useEffect(() => {
    fetch('/api/market-gauge')
      .then(r => r.json())
      .then(data => { setApiData(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  // Get raw index data for weight recomputation
  const currentRaw = useMemo(() => {
    if (!apiData) return null;
    if (selected === '__broad__') return apiData.broad_market;
    return apiData.by_index?.[selected] ?? null;
  }, [apiData, selected]);

  // Recompute series when weights change
  const recomputedSeries = useMemo(() => {
    if (!currentRaw?.series) return [];
    return recomputeSeriesWithWeights(currentRaw.series, currentRaw.series, weights);
  }, [currentRaw, weights]);

  // Recompute current score with new weights
  const currentScore = useMemo(() => {
    if (!recomputedSeries.length) return null;
    return recomputedSeries[recomputedSeries.length - 1]?.score ?? null;
  }, [recomputedSeries]);

  const currentZone = useMemo(() => {
    if (currentScore == null) return null;
    return ZONE_CONFIG.find(z => currentScore >= z.min && currentScore <= z.max) ?? null;
  }, [currentScore]);

  const availableIndices = apiData?.meta?.indices_available ?? [];

  if (loading) return (
    <div style={S.page}>
      <div style={S.loading}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Loading market data…
      </div>
    </div>
  );

  if (error || !apiData) return (
    <div style={S.page}>
      <div style={S.error}>
        Failed to load market data. {error}<br />
        <small>Please try refreshing the page.</small>
      </div>
    </div>
  );

  const displayName = selected === '__broad__'
    ? 'Broad Market (BSE 500 + Sensex)'
    : selected;

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.badge}>📊 G1 · Market Intelligence</div>
        <h1 style={S.h1}>Market Valuation Gauge</h1>
        <p style={S.subtitle}>
          Percentile-based valuation scoring across full BSE index history (1990–present).
          Score 100 = historically cheapest · Score 0 = historically most expensive.
        </p>
      </div>

      {/* ── Controls Row ── */}
      <div style={S.controlsRow}>
        {/* Index selector */}
        <div style={S.indexSelector}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Select Index</div>
          <div style={S.indexGrid}>
            <button
              style={S.indexBtn(selected === '__broad__')}
              onClick={() => setSelected('__broad__')}
            >🌏 Broad Market</button>
            {availableIndices.map(name => (
              <button
                key={name}
                style={S.indexBtn(selected === name)}
                onClick={() => setSelected(name)}
              >{name}</button>
            ))}
          </div>
        </div>

        {/* Weight adjuster */}
        <div style={S.weightCard}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Valuation Weights</div>
          <WeightSlider weights={weights} onChange={setWeights} />
        </div>
      </div>

      {/* ── Current Valuation Summary ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.cardTitle}>{displayName}</div>
              <div style={S.cardSubtitle}>
                As of {fmtDate(currentRaw?.latest_date)} · Data since {currentRaw?.history_from?.slice(0, 4) ?? '1990'}
              </div>
            </div>
            {currentZone && (
              <div style={S.zoneBadge(currentZone.color)}>
                <div style={S.zoneDot(currentZone.color)} />
                {currentZone.label}
                <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 4 }}>
                  Score {currentScore}
                </span>
              </div>
            )}
          </div>
          <div style={S.cardBody}>
            <div style={S.summaryGrid}>
              <div style={S.metricCard('#2563eb')}>
                <div style={S.metricValue('#2563eb')}>{currentScore ?? '—'}</div>
                <div style={S.metricLabel}>Valuation Score</div>
              </div>
              <div style={S.metricCard('#0891b2')}>
                <div style={S.metricValue('#0891b2')}>{currentRaw?.latest_pe?.toFixed(1) ?? '—'}x</div>
                <div style={S.metricLabel}>Price / Earnings</div>
              </div>
              <div style={S.metricCard('#7c3aed')}>
                <div style={S.metricValue('#7c3aed')}>{currentRaw?.latest_pb?.toFixed(1) ?? '—'}x</div>
                <div style={S.metricLabel}>Price / Book</div>
              </div>
              <div style={S.metricCard('#0d9488')}>
                <div style={S.metricValue('#0d9488')}>{currentRaw?.latest_dy?.toFixed(2) ?? '—'}%</div>
                <div style={S.metricLabel}>Dividend Yield</div>
              </div>
              <div style={S.metricCard('#64748b')}>
                <div style={S.metricValue('#64748b')}>{currentRaw?.score_avg ?? '—'}</div>
                <div style={S.metricLabel}>Avg Score (All-Time)</div>
              </div>
              <div style={S.metricCard('#64748b')}>
                <div style={S.metricValue('#64748b')}>{currentRaw?.data_points ?? '—'}</div>
                <div style={S.metricLabel}>Monthly Data Points</div>
              </div>
            </div>

            {/* Commentary */}
            {currentRaw?.commentary && (
              <div style={S.commentary}>{currentRaw.commentary}</div>
            )}
          </div>
        </div>

        {/* ── Panel A: Valuation Oscillator ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.panelLabel}>
                <span style={S.panelTag('#2563eb')}>A</span>
                Valuation Regime Oscillator
              </div>
              <div style={S.cardSubtitle}>
                Composite valuation score over time · Coloured bands = valuation zones
              </div>
            </div>
          </div>
          <div style={S.cardBody}>
            <PanelOscillator series={recomputedSeries} indexName={displayName} />
          </div>
        </div>

        {/* ── Panel B: Returns from Bottoms ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.panelLabel}>
                <span style={S.panelTag('#16a34a')}>B</span>
                Returns from Deep Value Entries
              </div>
              <div style={S.cardSubtitle}>
                Every time score entered Deep Value zone (≥80) — forward returns at 1M to 3Y
              </div>
            </div>
          </div>
          <div style={S.cardBody}>
            <PanelReturns data={currentRaw?.returns_from_bottoms} type="bottom" />
          </div>
        </div>

        {/* ── Panel C: Returns from Peaks ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.panelLabel}>
                <span style={S.panelTag('#dc2626')}>C</span>
                Returns from Stretched Peaks
              </div>
              <div style={S.cardSubtitle}>
                Every time score entered Stretched zone (≤20) — forward returns at 1M to 3Y
              </div>
            </div>
          </div>
          <div style={S.cardBody}>
            <PanelReturns data={currentRaw?.returns_from_peaks} type="peak" />
          </div>
        </div>

        {/* ── Embed Generator ── */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div>
              <div style={S.panelLabel}>
                <span style={S.panelTag('#64748b')}>⊞</span>
                Embed on Your Website
              </div>
              <div style={S.cardSubtitle}>
                Share this gauge as an iframe widget — works on any website or blog
              </div>
            </div>
            <button
              onClick={() => setShowEmbed(v => !v)}
              style={{
                padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid #e2e8f0', background: '#f8fafc',
                fontSize: 12, fontWeight: 600, color: '#374151',
              }}
            >{showEmbed ? '▲ Hide' : '▼ Show Embed Code'}</button>
          </div>
          {showEmbed && (
            <div style={S.cardBody}>
              <EmbedGenerator selectedIndex={selected} />
            </div>
          )}
        </div>

        {/* ── Methodology Note ── */}
        <div style={{
          background: '#fafafa', border: '1px solid #e2e8f0',
          borderRadius: 12, padding: '16px 20px',
          fontSize: 12, color: '#94a3b8', lineHeight: 1.7,
        }}>
          <b style={{ color: '#64748b' }}>Methodology:</b> Valuation score is a weighted percentile rank across full available BSE index history.
          P/E and P/B are inverted (high = expensive = low score). Dividend Yield is directional (high yield = cheap = high score).
          Score 100 = cheapest ever observed; Score 0 = most expensive. Weights are adjustable above. Data source: BSE India via FundLens pipeline.
          Not investment advice.
        </div>
      </div>
    </div>
  );
}
