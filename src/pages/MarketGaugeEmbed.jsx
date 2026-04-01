// src/pages/MarketGaugeEmbed.jsx
// Standalone embeddable page — rendered at /embed/market-gauge
// URL params: ?index=BSE500&theme=light
// No Nav or Footer — pure chart content for iframe embedding
// postMessage → parent window for auto-resize

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis,
  Tooltip, ReferenceArea, ResponsiveContainer,
} from 'recharts';

const ZONE_CONFIG = [
  { label: 'Deep Value', min: 80, max: 100, color: '#15803d', bg: 'rgba(21,128,61,0.12)'  },
  { label: 'Attractive', min: 60, max: 80,  color: '#65a30d', bg: 'rgba(101,163,13,0.12)' },
  { label: 'Fair Value', min: 40, max: 60,  color: '#d97706', bg: 'rgba(217,119,6,0.12)'  },
  { label: 'Expensive',  min: 20, max: 40,  color: '#ea580c', bg: 'rgba(234,88,12,0.12)'  },
  { label: 'Stretched',  min: 0,  max: 20,  color: '#dc2626', bg: 'rgba(220,38,38,0.12)'  },
];

function getZone(score) {
  return ZONE_CONFIG.find(z => score >= z.min && score <= z.max) ?? ZONE_CONFIG[4];
}

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

const EmbedTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const zone = getZone(d.score);
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '8px 12px', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a' }}>{d.date?.slice(0, 7)}</div>
      <div style={{ color: zone.color, fontWeight: 600 }}>{zone.label} · Score {d.score}</div>
      {d.pe  != null && <div style={{ color: '#64748b' }}>P/E {d.pe?.toFixed(1)}</div>}
      {d.pb  != null && <div style={{ color: '#64748b' }}>P/B {d.pb?.toFixed(1)}</div>}
    </div>
  );
};

export default function MarketGaugeEmbed() {
  const containerRef = useRef(null);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  const indexParam = params.get('index') || 'broad';
  const theme      = params.get('theme') || 'light';

  useEffect(() => {
    fetch('/api/market-gauge')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // postMessage height to parent for auto-resize
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(() => {
      const h = containerRef.current?.offsetHeight ?? 520;
      window.parent?.postMessage({ type: 'fundlens-gauge-resize', height: h }, '*');
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [data]);

  const target = useMemo(() => {
    if (!data) return null;
    if (indexParam === 'broad') return data.broad_market;
    // Try to match index name case-insensitively
    const key = Object.keys(data.by_index ?? {}).find(
      k => k.toLowerCase().replace(/\s+/g, '') === indexParam.toLowerCase().replace(/\s+/g, '')
    );
    return key ? data.by_index[key] : data.broad_market;
  }, [data, indexParam]);

  const displayName = indexParam === 'broad'
    ? 'Broad Market (BSE 500 + Sensex)'
    : (target ? indexParam.toUpperCase() : 'Broad Market');

  const score = target?.current_score ?? null;
  const zone  = score != null ? getZone(score) : null;

  const isDark = theme === 'dark';
  const bg     = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const textPrimary   = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  const wrapStyle = {
    background: bg,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    padding: '16px',
    minHeight: 480,
    borderRadius: 12,
    border: `1px solid ${border}`,
  };

  if (loading) return (
    <div ref={containerRef} style={{ ...wrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textSecondary }}>
      Loading market data…
    </div>
  );

  if (error || !data || !target) return (
    <div ref={containerRef} style={{ ...wrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
      Data unavailable. Please try again later.
    </div>
  );

  return (
    <div ref={containerRef} style={wrapStyle}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: textSecondary, letterSpacing: 1 }}>
            FUNDLENS · MARKET VALUATION GAUGE
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>{displayName}</div>
          <div style={{ fontSize: 11, color: textSecondary }}>as of {fmtDate(target.latest_date)}</div>
        </div>
        {zone && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `${zone.color}18`, border: `1.5px solid ${zone.color}`,
            borderRadius: 20, padding: '5px 14px',
            fontSize: 13, fontWeight: 700, color: zone.color,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: zone.color, display: 'inline-block' }} />
            {zone.label} · {score}
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'P/E',   value: target.latest_pe?.toFixed(1)  },
          { label: 'P/B',   value: target.latest_pb?.toFixed(1)  },
          { label: 'Div Y', value: target.latest_dy?.toFixed(2) + '%' },
          { label: 'Score', value: score, color: zone?.color },
        ].map(m => (
          <div key={m.label} style={{
            background: isDark ? '#1e293b' : '#f8fafc',
            borderRadius: 8, padding: '8px 14px', textAlign: 'center', flex: '1 0 60px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: m.color ?? textPrimary }}>{m.value ?? '—'}</div>
            <div style={{ fontSize: 10, color: textSecondary }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Zone legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {ZONE_CONFIG.map(z => (
          <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: textSecondary }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: z.color, opacity: 0.7 }} />
            {z.label}
          </div>
        ))}
      </div>

      {/* Oscillator chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={target.series} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
          {ZONE_CONFIG.map(z => (
            <ReferenceArea key={z.label} y1={z.min} y2={z.max} yAxisId="score" fill={z.bg} fillOpacity={1} />
          ))}
          <XAxis
            dataKey="date"
            tickFormatter={d => d?.slice(0, 4)}
            interval={Math.max(1, Math.floor((target.series?.length ?? 1) / 8))}
            tick={{ fontSize: 9, fill: textSecondary }}
          />
          <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 9, fill: textSecondary }} />
          <Tooltip content={<EmbedTooltip />} />
          <Line yAxisId="score" type="monotone" dataKey="score"
            stroke={zone?.color ?? '#2563eb'} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Commentary */}
      {target.commentary && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: isDark ? '#1e293b' : '#f0f9ff',
          borderRadius: 8, fontSize: 11, color: isDark ? '#94a3b8' : '#0c4a6e',
          lineHeight: 1.6, borderLeft: `3px solid ${zone?.color ?? '#2563eb'}`,
        }}>
          {target.commentary}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 10, color: textSecondary,
      }}>
        <span>Data: BSE India via FundLens · Not investment advice</span>
        <a href="https://fundlens.in/tools/market-gauge" target="_blank" rel="noopener noreferrer"
          style={{ color: zone?.color ?? '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
          Full Analysis ↗
        </a>
      </div>
    </div>
  );
}
