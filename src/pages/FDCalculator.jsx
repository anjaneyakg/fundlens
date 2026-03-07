import { useState, useMemo } from "react";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #f9f4ee;
    --bg2:       #ffffff;
    --bg3:       #f2ebe1;
    --bg4:       #e8ddd0;
    --terra:     #a0522d;
    --terra-l:   #fdf0e8;
    --terra-b:   rgba(160,82,45,0.18);
    --clay:      #c47a3a;
    --clay-l:    #fef6ec;
    --rose:      #9e4d5f;
    --rose-l:    #fdf0f3;
    --rose-b:    rgba(158,77,95,0.18);
    --sage:      #4a7c5f;
    --sage-l:    #eef5f1;
    --blue:      #3d5a8a;
    --blue-l:    #edf1f9;
    --red:       #b84040;
    --text:      #2c2118;
    --text2:     #7a6a58;
    --border:    rgba(60,40,20,0.1);
    --shadow:    0 2px 16px rgba(60,40,20,0.07);
    --shadow-m:  0 6px 32px rgba(60,40,20,0.12);
  }

  .fd-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    background-image:
      radial-gradient(ellipse 60% 45% at 100% 0%,   rgba(160,82,45,0.08)  0%, transparent 60%),
      radial-gradient(ellipse 45% 55% at 0%   100%,  rgba(158,77,95,0.06)  0%, transparent 60%),
      radial-gradient(ellipse 35% 35% at 55%  50%,   rgba(196,122,58,0.04) 0%, transparent 70%);
  }

  /* ── HEADER ── */
  .fd-header {
    max-width: 1280px; margin: 0 auto;
    padding: 3rem 2rem 1.75rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 2rem; flex-wrap: wrap;
  }
  .fd-eyebrow {
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--terra); margin-bottom: 10px;
    display: flex; align-items: center; gap: 10px;
  }
  .fd-eyebrow::after { content:''; width: 48px; height: 1px; background: var(--terra-b); }
  .fd-title {
    font-family: 'Cormorant Garamond'; font-size: clamp(2.2rem, 5vw, 3.4rem);
    font-weight: 700; line-height: 1.0; color: var(--text);
  }
  .fd-title em { font-style: italic; color: var(--terra); }
  .fd-subtitle { font-size: 13px; color: var(--text2); margin-top: 8px; line-height: 1.65; max-width: 420px; }

  /* ── BODY LAYOUT ── */
  .fd-body {
    max-width: 1280px; margin: 0 auto;
    display: grid; grid-template-columns: 340px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }

  /* ── LEFT PANEL ── */
  .input-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem;
    box-shadow: var(--shadow);
    position: sticky; top: 72px;
  }
  .panel-section-label {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2.5px;
    text-transform: uppercase; color: var(--terra);
    margin-bottom: 1rem; padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--border);
  }

  /* investor type pill toggle */
  .investor-toggle {
    display: flex; background: var(--bg3); border-radius: 10px;
    padding: 3px; margin-bottom: 1.25rem; gap: 3px;
  }
  .inv-btn {
    flex: 1; padding: 7px 0; border-radius: 8px; border: none;
    background: transparent; color: var(--text2); cursor: pointer;
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px;
    text-transform: uppercase; transition: all 0.18s;
  }
  .inv-btn.active {
    background: var(--bg2); color: var(--terra); font-weight: 500;
    box-shadow: 0 1px 6px rgba(60,40,20,0.1);
  }

  /* fields */
  .field { margin-bottom: 1.1rem; }
  .field-label {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--text2); margin-bottom: 5px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .field-val { color: var(--terra); font-size: 10px; font-weight: 500; }
  .field-input {
    width: 100%; padding: 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'DM Mono'; font-size: 13px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .field-input:focus { border-color: var(--terra); box-shadow: 0 0 0 3px rgba(160,82,45,0.1); }
  .range-wrap { position: relative; margin-top: 5px; }
  .range-input {
    -webkit-appearance: none; width: 100%; height: 4px;
    border-radius: 2px; outline: none; cursor: pointer;
  }
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: var(--terra); cursor: pointer;
    box-shadow: 0 2px 8px rgba(160,82,45,0.35); border: 2px solid white;
  }

  /* compounding / payout toggles */
  .small-toggle { display: flex; gap: 5px; margin-bottom: 1rem; flex-wrap: wrap; }
  .sm-btn {
    padding: 5px 11px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--text2); cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.8px;
    text-transform: uppercase; transition: all 0.15s; white-space: nowrap;
  }
  .sm-btn.active {
    background: var(--terra-l); border-color: var(--terra-b); color: var(--terra); font-weight: 500;
  }
  .sm-btn.rose.active {
    background: var(--rose-l); border-color: var(--rose-b); color: var(--rose);
  }

  /* tenure comparison row */
  .tenure-compare {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    margin-bottom: 1rem;
  }
  .tenure-input-wrap { position: relative; }
  .tenure-dot {
    position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
    width: 8px; height: 8px; border-radius: 50%;
  }
  .tenure-dot.t1 { background: var(--terra); }
  .tenure-dot.t2 { background: var(--rose); }
  .tenure-field-input {
    width: 100%; padding: 9px 12px 9px 26px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'DM Mono'; font-size: 12px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .tenure-field-input.t1:focus { border-color: var(--terra); box-shadow: 0 0 0 3px rgba(160,82,45,0.1); }
  .tenure-field-input.t2:focus { border-color: var(--rose); box-shadow: 0 0 0 3px rgba(158,77,95,0.1); }
  .tenure-unit {
    font-family: 'DM Mono'; font-size: 9px; color: var(--text2);
    text-align: center; margin-top: 3px; letter-spacing: 1px; text-transform: uppercase;
  }

  .divider { height: 1px; background: var(--border); margin: 1.1rem 0; }

  /* inflation toggle */
  .infl-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1rem;
  }
  .infl-label { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text2); }
  .toggle-switch {
    position: relative; width: 36px; height: 20px;
  }
  .toggle-switch input { opacity: 0; width: 0; height: 0; }
  .toggle-track {
    position: absolute; inset: 0; border-radius: 20px;
    background: var(--bg4); cursor: pointer; transition: background 0.2s;
  }
  .toggle-track::after {
    content: ''; position: absolute; left: 3px; top: 3px;
    width: 14px; height: 14px; border-radius: 50%;
    background: white; transition: transform 0.2s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  }
  input:checked + .toggle-track { background: var(--terra); }
  input:checked + .toggle-track::after { transform: translateX(16px); }

  /* ── RIGHT: RESULTS ── */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }

  /* comparison strip — two tenor cards side by side */
  .compare-strip {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  }
  .tenor-card {
    border-radius: 16px; padding: 1.5rem; position: relative; overflow: hidden;
    animation: fadeUp 0.4s ease both; box-shadow: var(--shadow);
  }
  .tenor-card.t1 {
    background: linear-gradient(140deg, var(--terra-l) 0%, #fff8f3 100%);
    border: 1px solid var(--terra-b);
  }
  .tenor-card.t2 {
    background: linear-gradient(140deg, var(--rose-l) 0%, #fff8fa 100%);
    border: 1px solid var(--rose-b);
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  .tenor-badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; margin-bottom: 1rem;
    padding: 4px 10px; border-radius: 20px;
  }
  .tenor-badge.t1 { background: var(--terra-l); color: var(--terra); border: 1px solid var(--terra-b); }
  .tenor-badge.t2 { background: var(--rose-l);  color: var(--rose);  border: 1px solid var(--rose-b); }
  .tenor-dot-sm { width: 6px; height: 6px; border-radius: 50%; }
  .tenor-dot-sm.t1 { background: var(--terra); }
  .tenor-dot-sm.t2 { background: var(--rose); }
  .tenor-maturity-label {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--text2); margin-bottom: 5px;
  }
  .tenor-maturity-value {
    font-family: 'Cormorant Garamond'; font-size: 2.4rem;
    font-weight: 700; line-height: 1; margin-bottom: 6px;
  }
  .tenor-maturity-value.t1 { color: var(--terra); }
  .tenor-maturity-value.t2 { color: var(--rose); }
  .tenor-sub { font-size: 12px; color: var(--text2); margin-bottom: 12px; }
  .tenor-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .t-metric {
    background: rgba(255,255,255,0.65); border-radius: 8px; padding: 9px 10px;
    backdrop-filter: blur(4px);
  }
  .t-metric-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text2); margin-bottom: 3px; }
  .t-metric-value { font-size: 13px; font-weight: 600; color: var(--text); }

  /* inflation card — spans full */
  .inflation-card {
    border-radius: 16px; padding: 1.25rem 1.5rem;
    background: var(--sage-l); border: 1px solid rgba(74,124,95,0.18);
    box-shadow: var(--shadow);
    animation: fadeUp 0.45s ease 0.05s both;
  }
  .infl-card-header {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--sage); margin-bottom: 1rem;
    display: flex; align-items: center; gap: 8px;
  }
  .infl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
  .infl-metric { background: rgba(255,255,255,0.6); border-radius: 8px; padding: 10px 12px; }
  .infl-metric-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text2); margin-bottom: 4px; }
  .infl-metric-value { font-size: 14px; font-weight: 600; }
  .infl-note { font-size: 11px; color: var(--text2); margin-top: 10px; line-height: 1.5; font-style: italic; }

  /* chart panel */
  .chart-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem;
    box-shadow: var(--shadow);
    animation: fadeUp 0.5s ease 0.08s both;
  }
  .chart-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;
  }
  .chart-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--text2); }
  .chart-legend { display: flex; gap: 14px; align-items: center; }
  .legend-pill {
    display: flex; align-items: center; gap: 5px;
    font-family: 'DM Mono'; font-size: 9px; color: var(--text2);
  }
  .legend-line { width: 18px; height: 3px; border-radius: 2px; }
  .svg-chart { width: 100%; overflow: visible; }

  /* year table */
  .table-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem;
    box-shadow: var(--shadow);
    animation: fadeUp 0.55s ease 0.1s both;
  }
  .table-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
  }
  .table-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--text2); }
  .fd-table { width: 100%; border-collapse: collapse; font-family: 'DM Mono'; font-size: 11px; }
  .fd-table th {
    text-align: right; padding: 8px 10px;
    border-bottom: 2px solid var(--border);
    color: var(--text2); font-size: 8.5px; letter-spacing: 1.2px;
    text-transform: uppercase; font-weight: 500;
  }
  .fd-table th:first-child { text-align: left; }
  .fd-table td {
    text-align: right; padding: 9px 10px;
    border-bottom: 1px solid var(--border); color: var(--text);
    font-size: 11px;
  }
  .fd-table td:first-child { text-align: left; color: var(--text2); }
  .fd-table tr:last-child td { font-weight: 600; border-bottom: none; }
  .fd-table tr:hover td { background: var(--bg3); }
  .td-t1 { color: var(--terra) !important; font-weight: 500; }
  .td-t2 { color: var(--rose) !important; font-weight: 500; }
  .td-green { color: var(--sage) !important; }
  .td-dim { color: var(--text2) !important; }

  /* empty state */
  .empty-state {
    text-align: center; padding: 4rem 2rem; color: var(--text2);
    background: var(--bg2); border-radius: 16px; border: 1px solid var(--border);
  }
  .empty-icon { font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5; }
  .empty-title { font-family: 'Cormorant Garamond'; font-size: 1.3rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; line-height: 1.6; }

  @media (max-width: 960px) {
    .fd-body { grid-template-columns: 1fr; }
    .input-panel { position: static; }
    .compare-strip { grid-template-columns: 1fr; }
    .infl-grid { grid-template-columns: 1fr 1fr; }
  }
`;

// ─── MATH ─────────────────────────────────────────────────────────────────────

const fmt = n => {
  if (!n && n !== 0) return "—";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtPct = n => `${n.toFixed(2)}%`;
const fmtPctS = n => `${n.toFixed(1)}%`;

function calcFD({ principal, rateRaw, tenureYears, interestType, compoundFreq, payoutType, seniorCitizen, inflation }) {
  const rate = rateRaw + (seniorCitizen ? 0.5 : 0);
  const r = rate / 100;
  const n = compoundFreq; // per year
  const T = tenureYears;

  let maturity, totalInterest, periodicPayout, eay, yearlyRows = [];

  if (interestType === "simple") {
    // Simple Interest
    totalInterest = principal * r * T;
    maturity      = principal + totalInterest;
    eay           = r; // simple rate = effective for 1yr
    periodicPayout = payoutType === "periodic" ? (principal * r / n) : null;

    // Year-wise
    for (let y = 1; y <= Math.ceil(T); y++) {
      const yFrac = Math.min(y, T);
      const cumInt = principal * r * yFrac;
      yearlyRows.push({
        year: y <= T ? `Year ${y}` : `Year ${T.toFixed(1)}`,
        invested: principal,
        cumInterest: cumInt,
        corpus: principal + cumInt,
      });
    }
  } else {
    // Compound Interest
    eay = Math.pow(1 + r / n, n) - 1;

    if (payoutType === "cumulative") {
      maturity      = principal * Math.pow(1 + r / n, n * T);
      totalInterest = maturity - principal;
      periodicPayout = null;

      for (let y = 1; y <= Math.ceil(T); y++) {
        const yFrac = Math.min(y, T);
        const corpus = principal * Math.pow(1 + r / n, n * yFrac);
        yearlyRows.push({
          year: `Year ${y}`,
          invested: principal,
          cumInterest: corpus - principal,
          corpus,
        });
      }
    } else if (payoutType === "periodic") {
      // Periodic: interest paid out each period, principal constant
      periodicPayout = principal * (Math.pow(1 + r/n, 1) - 1);
      totalInterest  = periodicPayout * n * T;
      maturity       = principal; // get back only principal at end
      eay            = periodicPayout * n / principal;

      for (let y = 1; y <= Math.ceil(T); y++) {
        const yFrac = Math.min(y, T);
        const cumInt = periodicPayout * n * yFrac;
        yearlyRows.push({
          year: `Year ${y}`,
          invested: principal,
          cumInterest: cumInt,
          corpus: principal + cumInt, // total received
        });
      }
    } else if (payoutType === "discounted") {
      // Discounted: effective principal = face / (1+r*T) for simple, approximate here
      const effectivePrincipal = principal / (1 + r * T);
      totalInterest = principal - effectivePrincipal;
      maturity      = principal; // get back face value
      eay           = totalInterest / effectivePrincipal / T;
      periodicPayout = totalInterest; // received upfront

      for (let y = 1; y <= Math.ceil(T); y++) {
        const yFrac = Math.min(y, T);
        yearlyRows.push({
          year: `Year ${y}`,
          invested: effectivePrincipal,
          cumInterest: totalInterest,
          corpus: effectivePrincipal + totalInterest,
        });
      }
    }
  }

  // Real value (inflation-adjusted maturity)
  let realMaturity = null, realYield = null;
  if (inflation > 0) {
    realMaturity = maturity / Math.pow(1 + inflation/100, T);
    realYield    = (Math.pow(realMaturity/principal, 1/T) - 1) * 100;
  }

  return { maturity, totalInterest, periodicPayout, eay, yearlyRows, rate, realMaturity, realYield };
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function GrowthChart({ data1, data2, label1, label2 }) {
  if (!data1 || data1.length === 0) return null;
  const W = 640, H = 200, PL = 58, PR = 16, PT = 14, PB = 36;
  const iW = W - PL - PR, iH = H - PT - PB;

  const allCorpus = [...data1.map(d=>d.corpus), ...(data2||[]).map(d=>d.corpus)];
  const maxV = Math.max(...allCorpus);
  const minV = Math.min(data1[0].invested, (data2||[{invested:data1[0].invested}])[0].invested) * 0.95;

  const xS = i => PL + (i/(data1.length-1||1))*iW;
  const yS = v => PT + iH - ((v-minV)/(maxV-minV+1))*iH;

  const path = (arr, key) => arr.map((d,i)=>`${i===0?"M":"L"}${xS(i)},${yS(d[key])}`).join(" ");
  const invPath = path(data1, "invested");
  const corpus1 = path(data1, "corpus");
  const corpus2 = data2 ? path(data2, "corpus") : null;

  const yTicks = [minV, (minV+maxV)/2, maxV].map(v => ({ v, y: yS(v), label: fmt(v) }));
  const xTicks = data1.filter((_,i) => i === 0 || (i+1) % 3 === 0 || i === data1.length-1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a0522d" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#a0522d" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9e4d5f" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#9e4d5f" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {yTicks.map((t,i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W-PR} y2={t.y} stroke="rgba(60,40,20,0.07)" strokeWidth="1"/>
          <text x={PL-6} y={t.y+4} fill="#9a8070" fontSize="8.5" textAnchor="end" fontFamily="DM Mono">{t.label}</text>
        </g>
      ))}
      {xTicks.map((d,i) => (
        <text key={i} x={xS(data1.indexOf(d))} y={H-PB+14} fill="#9a8070" fontSize="8.5"
          textAnchor="middle" fontFamily="DM Mono">Y{data1.indexOf(d)+1}</text>
      ))}

      {/* Principal base */}
      <path d={`${invPath} L${xS(data1.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
        fill="rgba(74,124,95,0.07)"/>
      <path d={invPath} fill="none" stroke="#4a7c5f" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.5"/>

      {/* Corpus fills */}
      <path d={`${corpus1} L${xS(data1.length-1)},${PT+iH} L${PL},${PT+iH} Z`} fill="url(#g1)"/>
      {corpus2 && (
        <path d={`${corpus2} L${xS(data2.length-1)},${PT+iH} L${PL},${PT+iH} Z`} fill="url(#g2)"/>
      )}

      {/* Lines */}
      <path d={corpus1} fill="none" stroke="#a0522d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {corpus2 && (
        <path d={corpus2} fill="none" stroke="#9e4d5f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  );
}

// ─── PRESETS ──────────────────────────────────────────────────────────────────
const COMP_OPTIONS  = ["Monthly","Quarterly","Half-Yearly","Annually"];
const COMP_N        = { "Monthly":12, "Quarterly":4, "Half-Yearly":2, "Annually":1 };
const PAYOUT_OPTS   = ["Cumulative","Periodic","Discounted"];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function FDCalculator() {
  // Inputs
  const [principal,    setPrincipal]    = useState(100000);
  const [rate,         setRate]         = useState(7.0);
  const [seniorCitizen,setSeniorCitizen]= useState(false);
  const [interestType, setInterestType] = useState("compound");  // simple | compound
  const [compFreq,     setCompFreq]     = useState("Quarterly");
  const [payoutType,   setPayoutType]   = useState("Cumulative"); // Cumulative | Periodic | Discounted
  // Dual tenure
  const [tenure1Yr,    setTenure1Yr]    = useState(3);
  const [tenure1Mo,    setTenure1Mo]    = useState(0);
  const [tenure2Yr,    setTenure2Yr]    = useState(5);
  const [tenure2Mo,    setTenure2Mo]    = useState(0);
  // Inflation
  const [showInflation,setShowInflation]= useState(true);
  const [inflation,    setInflation]    = useState(5.5);

  const t1Years = tenure1Yr + tenure1Mo/12;
  const t2Years = tenure2Yr + tenure2Mo/12;

  const fd1 = useMemo(() => calcFD({
    principal, rateRaw: rate, tenureYears: t1Years,
    interestType, compoundFreq: COMP_N[compFreq],
    payoutType: payoutType.toLowerCase(), seniorCitizen,
    inflation: showInflation ? inflation : 0,
  }), [principal, rate, t1Years, interestType, compFreq, payoutType, seniorCitizen, inflation, showInflation]);

  const fd2 = useMemo(() => calcFD({
    principal, rateRaw: rate, tenureYears: t2Years,
    interestType, compoundFreq: COMP_N[compFreq],
    payoutType: payoutType.toLowerCase(), seniorCitizen,
    inflation: showInflation ? inflation : 0,
  }), [principal, rate, t2Years, interestType, compFreq, payoutType, seniorCitizen, inflation, showInflation]);

  const tenureLabel = (y, m) => {
    const parts = [];
    if (y > 0) parts.push(`${y}Y`);
    if (m > 0) parts.push(`${m}M`);
    return parts.join(" ") || "0Y";
  };

  return (
    <>
      <style>{style}</style>
      <div className="fd-page">
        {/* HEADER */}
        <div className="fd-header">
          <div>
            <div className="fd-eyebrow">◆ FundLens Calculator</div>
            <h1 className="fd-title">Fixed <em>Deposit</em> Analyser</h1>
            <p className="fd-subtitle">
              Compare two tenures side by side — real returns after inflation, compounding math,
              and year-wise accrual in one view.
            </p>
          </div>
        </div>

        <div className="fd-body">
          {/* ── LEFT: INPUTS ── */}
          <div className="input-panel">
            <div className="panel-section-label">◆ Investor Type</div>
            <div className="investor-toggle">
              <button className={`inv-btn ${!seniorCitizen?"active":""}`}
                onClick={()=>setSeniorCitizen(false)}>Regular</button>
              <button className={`inv-btn ${seniorCitizen?"active":""}`}
                onClick={()=>setSeniorCitizen(true)}>Senior Citizen</button>
            </div>

            <div className="panel-section-label">◆ Deposit Details</div>

            {/* Principal */}
            <div className="field">
              <div className="field-label">
                <span>Principal</span>
                <span className="field-val">{fmt(principal)}</span>
              </div>
              <input type="range" className="range-input"
                min="10000" max="5000000" step="10000" value={principal}
                style={{background:`linear-gradient(to right,var(--terra) ${(principal-10000)/(5000000-10000)*100}%,var(--bg4) 0%)`}}
                onChange={e=>setPrincipal(+e.target.value)}/>
              <input type="number" className="field-input" style={{marginTop:"7px"}}
                value={principal} min="10000"
                onChange={e=>setPrincipal(Math.max(10000,+e.target.value))}/>
            </div>

            {/* Rate */}
            <div className="field">
              <div className="field-label">
                <span>Interest Rate</span>
                <span className="field-val">{rate}% p.a.{seniorCitizen ? ` → ${(rate+0.5).toFixed(2)}%` : ""}</span>
              </div>
              <input type="range" className="range-input"
                min="3" max="10" step="0.1" value={rate}
                style={{background:`linear-gradient(to right,var(--terra) ${(rate-3)/(10-3)*100}%,var(--bg4) 0%)`}}
                onChange={e=>setRate(+e.target.value)}/>
              <input type="number" className="field-input" style={{marginTop:"7px"}}
                value={rate} min="1" max="15" step="0.1"
                onChange={e=>setRate(Math.min(15,Math.max(1,+e.target.value)))}/>
            </div>

            <div className="divider"/>
            <div className="panel-section-label">◆ Compare Two Tenures</div>

            <div className="tenure-compare">
              {/* Tenure 1 */}
              <div>
                <div className="field-label" style={{marginBottom:"6px"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"5px"}}>
                    <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"var(--terra)",display:"inline-block"}}/>
                    Tenure A
                  </span>
                </div>
                <div className="tenure-input-wrap" style={{marginBottom:"5px"}}>
                  <span className="tenure-dot t1"/>
                  <input type="number" className="tenure-field-input t1"
                    value={tenure1Yr} min="0" max="10"
                    onChange={e=>setTenure1Yr(Math.min(10,Math.max(0,+e.target.value)))}/>
                </div>
                <div className="tenure-unit">Years</div>
                <div className="tenure-input-wrap" style={{marginTop:"6px"}}>
                  <span className="tenure-dot t1"/>
                  <input type="number" className="tenure-field-input t1"
                    value={tenure1Mo} min="0" max="11"
                    onChange={e=>setTenure1Mo(Math.min(11,Math.max(0,+e.target.value)))}/>
                </div>
                <div className="tenure-unit">Months</div>
              </div>
              {/* Tenure 2 */}
              <div>
                <div className="field-label" style={{marginBottom:"6px"}}>
                  <span style={{display:"flex",alignItems:"center",gap:"5px"}}>
                    <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"var(--rose)",display:"inline-block"}}/>
                    Tenure B
                  </span>
                </div>
                <div className="tenure-input-wrap" style={{marginBottom:"5px"}}>
                  <span className="tenure-dot t2"/>
                  <input type="number" className="tenure-field-input t2"
                    value={tenure2Yr} min="0" max="10"
                    onChange={e=>setTenure2Yr(Math.min(10,Math.max(0,+e.target.value)))}/>
                </div>
                <div className="tenure-unit">Years</div>
                <div className="tenure-input-wrap" style={{marginTop:"6px"}}>
                  <span className="tenure-dot t2"/>
                  <input type="number" className="tenure-field-input t2"
                    value={tenure2Mo} min="0" max="11"
                    onChange={e=>setTenure2Mo(Math.min(11,Math.max(0,+e.target.value)))}/>
                </div>
                <div className="tenure-unit">Months</div>
              </div>
            </div>

            <div className="divider"/>
            <div className="panel-section-label">◆ Interest Structure</div>

            {/* Interest type */}
            <div className="field">
              <div className="field-label">Interest Type</div>
              <div className="small-toggle">
                {["compound","simple"].map(t => (
                  <button key={t} className={`sm-btn ${interestType===t?"active":""}`}
                    onClick={()=>setInterestType(t)}>
                    {t === "compound" ? "Compound" : "Simple"}
                  </button>
                ))}
              </div>
            </div>

            {/* Compounding freq — only for compound */}
            {interestType === "compound" && (
              <div className="field">
                <div className="field-label">Compounding</div>
                <div className="small-toggle">
                  {COMP_OPTIONS.map(o => (
                    <button key={o} className={`sm-btn ${compFreq===o?"active":""}`}
                      onClick={()=>setCompFreq(o)}>{o}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Payout type */}
            <div className="field">
              <div className="field-label">Payout</div>
              <div className="small-toggle">
                {PAYOUT_OPTS.map(o => (
                  <button key={o} className={`sm-btn rose ${payoutType===o?"active":""}`}
                    onClick={()=>setPayoutType(o)}>{o}</button>
                ))}
              </div>
            </div>

            <div className="divider"/>

            {/* Inflation toggle */}
            <div className="infl-row">
              <span className="infl-label">Show Real Returns</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={showInflation} onChange={e=>setShowInflation(e.target.checked)}/>
                <span className="toggle-track"/>
              </label>
            </div>
            {showInflation && (
              <div className="field">
                <div className="field-label">
                  <span>Inflation Rate</span>
                  <span className="field-val">{inflation}% p.a.</span>
                </div>
                <input type="range" className="range-input"
                  min="2" max="10" step="0.5" value={inflation}
                  style={{background:`linear-gradient(to right,var(--terra) ${(inflation-2)/(10-2)*100}%,var(--bg4) 0%)`}}
                  onChange={e=>setInflation(+e.target.value)}/>
              </div>
            )}
          </div>

          {/* ── RIGHT: RESULTS ── */}
          <div className="results-col">

            {/* COMPARE STRIP */}
            <div className="compare-strip">
              {[{fd:fd1, t:"t1", label:`Tenure A — ${tenureLabel(tenure1Yr, tenure1Mo)}`},
                {fd:fd2, t:"t2", label:`Tenure B — ${tenureLabel(tenure2Yr, tenure2Mo)}`}]
              .map(({fd, t, label}) => (
                <div key={t} className={`tenor-card ${t}`}>
                  <div className={`tenor-badge ${t}`}>
                    <span className={`tenor-dot-sm ${t}`}/>
                    {label}
                  </div>
                  <div className="tenor-maturity-label">Maturity Value</div>
                  <div className={`tenor-maturity-value ${t}`}>{fmt(fd.maturity)}</div>
                  <div className="tenor-sub">
                    Interest earned: <strong>{fmt(fd.totalInterest)}</strong>
                    {payoutType==="Periodic" && fd.periodicPayout &&
                      <> · {COMP_N[compFreq]}×/yr: <strong>{fmt(fd.periodicPayout)}</strong></>}
                    {payoutType==="Discounted" && fd.periodicPayout &&
                      <> · Upfront: <strong>{fmt(fd.periodicPayout)}</strong></>}
                  </div>
                  <div className="tenor-metrics">
                    <div className="t-metric">
                      <div className="t-metric-label">Eff. Rate (EAY)</div>
                      <div className="t-metric-value">{fmtPct(fd.eay*100)}</div>
                    </div>
                    <div className="t-metric">
                      <div className="t-metric-label">Actual Rate</div>
                      <div className="t-metric-value">{fmtPct(fd.rate)}</div>
                    </div>
                    <div className="t-metric">
                      <div className="t-metric-label">Gain %</div>
                      <div className="t-metric-value">
                        {fmtPct((fd.totalInterest/principal)*100)}
                      </div>
                    </div>
                    <div className="t-metric">
                      <div className="t-metric-label">Wealth ×</div>
                      <div className="t-metric-value">{(fd.maturity/principal).toFixed(2)}×</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* INFLATION PANEL */}
            {showInflation && (
              <div className="inflation-card">
                <div className="infl-card-header">
                  🌿 Real Returns After {inflation}% Inflation
                </div>
                <div className="infl-grid">
                  {[{fd:fd1,t:"t1",label:`A — ${tenureLabel(tenure1Yr,tenure1Mo)}`},
                    {fd:fd2,t:"t2",label:`B — ${tenureLabel(tenure2Yr,tenure2Mo)}`}]
                  .flatMap(({fd,t,label}) => [
                    <div className="infl-metric" key={`${t}-real`}>
                      <div className="infl-metric-label">Real Maturity ({label})</div>
                      <div className="infl-metric-value" style={{color: t==="t1"?"var(--terra)":"var(--rose)"}}>
                        {fd.realMaturity ? fmt(fd.realMaturity) : "—"}
                      </div>
                    </div>,
                    <div className="infl-metric" key={`${t}-ryield`}>
                      <div className="infl-metric-label">Real Yield ({label})</div>
                      <div className="infl-metric-value" style={{
                        color: fd.realYield > 0 ? "var(--sage)" : "var(--red)"
                      }}>
                        {fd.realYield != null ? fmtPct(fd.realYield) : "—"}
                      </div>
                    </div>
                  ])}
                </div>
                <div className="infl-note">
                  Real yield = annualised return after removing inflation's purchasing-power erosion.
                  A positive real yield means you're genuinely growing wealth.
                </div>
              </div>
            )}

            {/* CHART */}
            <div className="chart-panel">
              <div className="chart-header">
                <span className="chart-title">◈ Corpus Growth Over Time</span>
                <div className="chart-legend">
                  <div className="legend-pill">
                    <div className="legend-line" style={{background:"#4a7c5f",opacity:0.5}}/>
                    Principal
                  </div>
                  <div className="legend-pill">
                    <div className="legend-line" style={{background:"#a0522d"}}/>
                    Tenure A
                  </div>
                  <div className="legend-pill">
                    <div className="legend-line" style={{background:"#9e4d5f"}}/>
                    Tenure B
                  </div>
                </div>
              </div>
              <GrowthChart
                data1={fd1.yearlyRows}
                data2={fd2.yearlyRows}
                label1={`Tenure A`}
                label2={`Tenure B`}
              />
            </div>

            {/* YEAR TABLE */}
            <div className="table-panel">
              <div className="table-header">
                <span className="table-title">◈ Year-wise Accrual</span>
              </div>
              <table className="fd-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Principal</th>
                    <th className="td-t1">A — Corpus</th>
                    <th className="td-t1">A — Int.</th>
                    <th className="td-t2">B — Corpus</th>
                    <th className="td-t2">B — Int.</th>
                    {showInflation && <th className="td-green">A — Real</th>}
                    {showInflation && <th className="td-green">B — Real</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const maxRows = Math.max(fd1.yearlyRows.length, fd2.yearlyRows.length);
                    return Array.from({length: maxRows}, (_,i) => {
                      const r1 = fd1.yearlyRows[i];
                      const r2 = fd2.yearlyRows[i];
                      const yr = r1?.year || r2?.year || `Year ${i+1}`;
                      const realM1 = r1 ? r1.corpus / Math.pow(1+inflation/100, i+1) : null;
                      const realM2 = r2 ? r2.corpus / Math.pow(1+inflation/100, i+1) : null;
                      return (
                        <tr key={i}>
                          <td>{yr}</td>
                          <td>{fmt(principal)}</td>
                          <td className="td-t1">{r1 ? fmt(r1.corpus) : "—"}</td>
                          <td>{r1 ? fmt(r1.cumInterest) : "—"}</td>
                          <td className="td-t2">{r2 ? fmt(r2.corpus) : "—"}</td>
                          <td>{r2 ? fmt(r2.cumInterest) : "—"}</td>
                          {showInflation && <td className="td-green">{realM1 ? fmt(realM1) : "—"}</td>}
                          {showInflation && <td className="td-green">{realM2 ? fmt(realM2) : "—"}</td>}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

          </div>{/* end results-col */}
        </div>{/* end fd-body */}
      </div>
    </>
  );
}
