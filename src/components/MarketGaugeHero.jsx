// src/components/MarketGaugeHero.jsx
// Compact homepage hero widget — current zone badge, 5-year oscillator, key metrics, CTA
// Drop into HomePage.jsx wherever the hero section lives

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Mini tooltip for hero chart
const HeroTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const zone = getZone(d.score);
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '8px 12px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a' }}>{d.date?.slice(0, 7)}</div>
      <div style={{ color: zone.color, fontWeight: 600 }}>
        {zone.label} · {d.score}
      </div>
    </div>
  );
};

// Animated score meter (arc gauge)
function ScoreMeter({ score, zone }) {
  if (score == null || !zone) return null;
  // Score 0–100 → angle sweep 0–180°
  const pct = score / 100;
  const angle = -180 + pct * 180; // -180 (left) to 0 (right)
  const r = 60;
  const cx = 80, cy = 80;
  // Arc path for filled portion
  function polarToXY(deg, radius) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  const startPt = polarToXY(180, r);
  const endPt   = polarToXY(180 - pct * 180, r);
  const large   = pct > 0.5 ? 1 : 0;
  const needlePt = polarToXY(180 - pct * 180, r - 8);

  return (
    <svg width={160} height={90} viewBox="0 0 160 90" style={{ display: 'block', margin: '0 auto' }}>
      {/* Background arc */}
      <path
        d={`M ${80 - r} 80 A ${r} ${r} 0 0 1 ${80 + r} 80`}
        fill="none" stroke="#f1f5f9" strokeWidth={12} strokeLinecap="round"
      />
      {/* Coloured zone segments (5 equal segments) */}
      {ZONE_CONFIG.slice().reverse().map((z, i) => {
        const segStart = (i / 5) * 180;
        const segEnd   = ((i + 1) / 5) * 180;
        const s = polarToXY(180 - segStart, r);
        const e = polarToXY(180 - segEnd, r);
        return (
          <path key={z.label}
            d={`M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`}
            fill="none" stroke={z.color} strokeWidth={10}
            strokeLinecap="butt" opacity={0.25}
          />
        );
      })}
      {/* Filled score arc */}
      {pct > 0 && (
        <path
          d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${large} 1 ${endPt.x} ${endPt.y}`}
          fill="none" stroke={zone.color} strokeWidth={10} strokeLinecap="round"
        />
      )}
      {/* Needle */}
      <circle cx={needlePt.x} cy={needlePt.y} r={5} fill={zone.color} />
      <circle cx={cx} cy={cy} r={4} fill="#fff" stroke={zone.color} strokeWidth={2} />
      {/* Score text */}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight={800} fill={zone.color}>{score}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={9} fill="#94a3b8">/ 100</text>
    </svg>
  );
}

export default function MarketGaugeHero() {
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    fetch('/api/market-gauge')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Use broad_market by default; show last 5 years of series
  const broad = data?.broad_market;
  const series5Y = useMemo(() => {
    if (!broad?.series) return [];
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 5);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return broad.series.filter(p => p.date >= cutStr);
  }, [broad]);

  const score = broad?.current_score ?? null;
  const zone  = score != null ? getZone(score) : null;

  // Container style
  const container = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  };

  const header = {
    background: zone ? `linear-gradient(135deg, ${zone.color}12, ${zone.color}05)` : '#f8fafc',
    borderBottom: `2px solid ${zone?.color ?? '#e2e8f0'}22`,
    padding: '16px 20px 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 12,
  };

  if (loading) return (
    <div style={{ ...container, padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
      Loading market valuation…
    </div>
  );

  if (error || !data) return (
    <div style={{ ...container, padding: '30px 20px', textAlign: 'center', color: '#dc2626', fontSize: 13 }}>
      Could not load market data.
    </div>
  );

  return (
    <div style={container}>
      {/* Header row */}
      <div style={header}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 2 }}>
            MARKET VALUATION GAUGE
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Broad Market · BSE 500 + Sensex · as of {fmtDate(broad?.latest_date)}
          </div>
        </div>
        {zone && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `${zone.color}18`,
            border: `1.5px solid ${zone.color}`,
            borderRadius: 20, padding: '5px 14px',
            fontSize: 13, fontWeight: 700, color: zone.color,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: zone.color, display: 'inline-block' }} />
            {zone.label}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Left: gauge meter + metrics */}
        <div style={{ flex: '0 0 160px', textAlign: 'center' }}>
          <ScoreMeter score={score} zone={zone} />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'P/E', value: broad?.returns_from_bottoms?.events?.[0]?.pe ?? broad?.series?.[broad.series.length-1]?.pe },
              { label: 'P/B', value: broad?.series?.[broad.series.length-1]?.pb },
              { label: 'DY',  value: broad?.series?.[broad.series.length-1]?.dy },
            ].map(m => (
              <div key={m.label} style={{
                background: '#f8fafc', borderRadius: 8, padding: '5px 10px',
                textAlign: 'center', minWidth: 44,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                  {m.value != null ? m.value.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 5-year oscillator chart */}
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
            Valuation Score — Last 5 Years
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={series5Y} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
              {ZONE_CONFIG.map(z => (
                <ReferenceArea key={z.label} y1={z.min} y2={z.max} fill={z.bg} fillOpacity={1} yAxisId="score" />
              ))}
              <XAxis dataKey="date" hide />
              <YAxis yAxisId="score" domain={[0, 100]} hide />
              <Tooltip content={<HeroTooltip />} />
              <Line
                yAxisId="score" type="monotone" dataKey="score"
                stroke={zone?.color ?? '#2563eb'} strokeWidth={2.5}
                dot={false} name="Score"
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* One-line commentary */}
          {broad?.commentary && (
            <div style={{
              fontSize: 11, color: '#64748b', lineHeight: 1.5,
              marginTop: 8, padding: '8px 10px',
              background: '#f8fafc', borderRadius: 8,
              borderLeft: `3px solid ${zone?.color ?? '#e2e8f0'}`,
            }}>
              {broad.commentary.slice(0, 180)}{broad.commentary.length > 180 ? '…' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{
        borderTop: '1px solid #f1f5f9',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fafafa',
      }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {broad?.returns_from_bottoms?.count
            ? `${broad.returns_from_bottoms.count} Deep Value entry events analysed since ${broad?.history_from?.slice(0,4)}`
            : `Historical data since ${broad?.history_from?.slice(0,4) ?? '1990'}`}
        </div>
        <button
          onClick={() => navigate('/tools/market-gauge')}
          style={{
            padding: '7px 16px', borderRadius: 20,
            background: zone?.color ?? '#2563eb', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', letterSpacing: 0.3,
          }}
        >
          Full Analysis →
        </button>
      </div>
    </div>
  );
}
