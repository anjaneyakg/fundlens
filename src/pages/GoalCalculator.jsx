import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #f0f4f1;
    --bg2:      #ffffff;
    --bg3:      #e8ede9;
    --bg4:      #dce4dd;
    --ink:      #141c15;
    --ink2:     #556358;
    --ink3:     #8fa492;
    --border:   rgba(20,28,21,0.1);
    --border2:  rgba(20,28,21,0.06);
    --shadow:   0 2px 16px rgba(20,28,21,0.07);
    --shadow-m: 0 8px 36px rgba(20,28,21,0.13);

    --pine:     #2d5a3d;
    --pine-l:   #e8f2ec;
    --pine-b:   rgba(45,90,61,0.2);
    --moss:     #4a7c5f;
    --gold:     #b8860b;
    --gold-l:   #fdf6e3;
    --gold-b:   rgba(184,134,11,0.2);
    --clay:     #8b4513;
    --clay-l:   #fdf0e8;
    --danger:   #b84040;
    --danger-l: #fdeaea;
    --safe:     #2d5a3d;
  }

  .gc6-page {
    min-height: 100vh; width: 100%; overflow-x: hidden;
    background: var(--bg); color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    background-image:
      radial-gradient(ellipse 80% 40% at 100% 0%, rgba(45,90,61,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 40% 60% at 0% 100%, rgba(184,134,11,0.05) 0%, transparent 55%);
  }

  /* HEADER */
  .gc6-header {
    max-width: 1100px; margin: 0 auto;
    padding: 2.5rem 2rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .gc6-eyebrow {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--moss); margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  .gc6-eyebrow::after { content:''; width: 36px; height: 1px; background: var(--pine-b); }
  .gc6-title {
    font-family: 'Fraunces'; font-size: clamp(2rem, 4.5vw, 3.2rem);
    font-weight: 700; line-height: 1.05; color: var(--ink);
  }
  .gc6-title em { font-style: italic; color: var(--pine); }
  .gc6-subtitle { font-size: 12.5px; color: var(--ink2); margin-top: 6px; line-height: 1.6; max-width: 460px; }

  /* HORIZON PILL — auto-suggested rate indicator */
  .horizon-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 12px; border-radius: 20px; margin-top: 10px;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.3s;
  }
  .horizon-pill.lt { background: var(--pine-l); color: var(--pine); border: 1px solid var(--pine-b); }
  .horizon-pill.mt { background: var(--gold-l); color: var(--gold); border: 1px solid var(--gold-b); }
  .horizon-pill.st { background: var(--clay-l); color: var(--clay); border: 1px solid rgba(139,69,19,0.2); }
  .horizon-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  /* BODY */
  .gc6-body {
    max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: 360px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }

  /* INPUT PANEL */
  .input-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 20px; padding: 1.5rem;
    box-shadow: var(--shadow);
    position: sticky; top: 72px;
  }

  .section-label {
    font-family: 'DM Mono'; font-size: 8.5px; letter-spacing: 2.5px;
    text-transform: uppercase; color: var(--pine);
    margin-bottom: 1rem; padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border2);
    display: flex; align-items: center; gap: 8px;
  }

  /* goal type toggle */
  .type-toggle { display: flex; background: var(--bg3); border-radius: 10px; padding: 3px; gap: 3px; margin-bottom: 1.25rem; }
  .type-btn {
    flex: 1; padding: 8px 6px; border-radius: 8px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.18s; text-align: center; line-height: 1.3;
  }
  .type-btn.active-resp { background: var(--bg2); color: var(--pine); box-shadow: var(--shadow); }
  .type-btn.active-life { background: var(--bg2); color: var(--gold); box-shadow: var(--shadow); }

  /* fields */
  .field { margin-bottom: 1.1rem; }
  .field-label {
    font-family: 'DM Mono'; font-size: 8.5px; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--ink2); margin-bottom: 5px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .field-val { color: var(--pine); font-size: 10px; }
  .field-input {
    width: 100%; padding: 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 9px; color: var(--ink);
    font-family: 'DM Mono'; font-size: 13px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .field-input:focus { border-color: var(--pine); box-shadow: 0 0 0 3px var(--pine-b); }
  .field-select {
    width: 100%; padding: 9px 30px 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 9px; color: var(--ink);
    font-family: 'DM Mono'; font-size: 11px;
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238fa492'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    transition: border 0.15s;
  }
  .field-select:focus { border-color: var(--pine); }
  .range-input {
    -webkit-appearance: none; width: 100%; height: 4px;
    border-radius: 2px; outline: none; cursor: pointer; margin-top: 6px;
  }
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: var(--pine); cursor: pointer;
    box-shadow: 0 2px 8px var(--pine-b); border: 2px solid white;
  }

  .divider { height: 1px; background: var(--border2); margin: 1.1rem 0; }

  /* pill toggle for value type / sip type */
  .pill-row { display: flex; background: var(--bg3); border-radius: 8px; padding: 3px; gap: 3px; margin-bottom: 1rem; }
  .pill-btn {
    flex: 1; padding: 6px 8px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.5px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.15s; text-align: center;
  }
  .pill-btn.active { background: var(--bg2); color: var(--pine); box-shadow: 0 1px 4px rgba(20,28,21,0.1); }

  /* rate override note */
  .rate-note {
    font-family: 'DM Mono'; font-size: 8px; color: var(--ink3);
    margin-top: 4px; letter-spacing: 0.5px;
  }

  /* ── RESULTS ── */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }

  /* hero card */
  .hero-card {
    border-radius: 20px; padding: 2rem;
    background: linear-gradient(145deg, var(--pine), var(--moss));
    box-shadow: 0 8px 36px rgba(45,90,61,0.25);
    color: white; position: relative; overflow: hidden;
  }
  .hero-card::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse 60% 80% at 100% 0%, rgba(255,255,255,0.08), transparent);
  }
  .hero-eyebrow {
    font-family: 'DM Mono'; font-size: 8.5px; letter-spacing: 2.5px;
    text-transform: uppercase; opacity: 0.7; margin-bottom: 6px;
  }
  .hero-sip {
    font-family: 'Fraunces'; font-size: clamp(2.8rem,6vw,4rem);
    font-weight: 700; line-height: 1; margin-bottom: 4px;
  }
  .hero-sub { font-size: 12px; opacity: 0.75; margin-bottom: 1.5rem; }
  .hero-metrics { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
  .hero-metric {
    background: rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 12px;
    backdrop-filter: blur(4px);
  }
  .hero-metric-label { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.65; margin-bottom: 4px; }
  .hero-metric-val { font-family: 'Fraunces'; font-size: 1.15rem; font-weight: 600; }

  /* KPI strip */
  .kpi-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
  .kpi-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1rem 1.1rem;
    box-shadow: var(--shadow);
  }
  .kpi-label { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 6px; }
  .kpi-val { font-family: 'Fraunces'; font-size: 1.2rem; font-weight: 700; color: var(--ink); line-height: 1; }
  .kpi-sub { font-size: 10px; color: var(--ink2); margin-top: 4px; }

  /* achievability bar */
  .achieve-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.25rem 1.5rem;
    box-shadow: var(--shadow);
  }
  .achieve-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .achieve-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink2); }
  .achieve-pct { font-family: 'Fraunces'; font-size: 1.5rem; font-weight: 700; }
  .achieve-bar-bg { height: 8px; background: var(--bg3); border-radius: 4px; overflow: hidden; }
  .achieve-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
  .achieve-note { font-size: 11px; color: var(--ink2); margin-top: 8px; line-height: 1.5; }

  /* risk + delay row */
  .flags-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .flag-card {
    border-radius: 14px; padding: 1rem 1.25rem;
    display: flex; align-items: flex-start; gap: 10px;
  }
  .flag-card.safe { background: var(--pine-l); border: 1px solid var(--pine-b); }
  .flag-card.warn { background: var(--gold-l); border: 1px solid var(--gold-b); }
  .flag-card.danger { background: var(--danger-l); border: 1px solid rgba(184,64,64,0.2); }
  .flag-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .flag-title { font-family: 'DM Mono'; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
  .flag-card.safe .flag-title { color: var(--safe); }
  .flag-card.warn .flag-title { color: var(--gold); }
  .flag-card.danger .flag-title { color: var(--danger); }
  .flag-desc { font-size: 11px; color: var(--ink2); line-height: 1.45; }

  /* chart panel */
  .chart-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem;
    box-shadow: var(--shadow);
  }
  .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px; }
  .chart-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink2); }
  .chart-legend { display: flex; gap: 14px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink2); }
  .legend-line { width: 16px; height: 3px; border-radius: 2px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .svg-chart { display: block; width: 100%; }
  .chart-scroll { overflow-x: auto; }

  /* year table */
  .table-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem;
    box-shadow: var(--shadow);
  }
  .table-scroll { overflow-x: auto; }
  .gc6-table { width: 100%; min-width: 480px; border-collapse: collapse; font-family: 'DM Mono'; font-size: 11px; }
  .gc6-table th {
    text-align: right; padding: 8px 10px;
    border-bottom: 2px solid var(--border);
    color: var(--ink2); font-size: 8px; letter-spacing: 1.2px;
    text-transform: uppercase; font-weight: 500;
  }
  .gc6-table th:first-child { text-align: left; }
  .gc6-table td {
    text-align: right; padding: 9px 10px;
    border-bottom: 1px solid var(--border2); color: var(--ink); font-size: 11px;
  }
  .gc6-table td:first-child { text-align: left; color: var(--ink2); }
  .gc6-table tr:last-child td { font-weight: 600; border-bottom: none; }
  .gc6-table tr:hover td { background: var(--bg3); }
  .td-pine { color: var(--pine) !important; font-weight: 500; }
  .td-gold { color: var(--gold) !important; }

  /* empty state */
  .empty-state {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 20px; padding: 4rem 2rem; text-align: center;
    box-shadow: var(--shadow);
  }
  .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.3; }
  .empty-title { font-family: 'Fraunces'; font-size: 1.4rem; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--ink2); line-height: 1.6; }

  /* sensitivity */
  .sensitivity-note {
    font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink3);
    text-align: center; padding: 6px; letter-spacing: 0.5px;
  }

  /* C5 nudge */
  .c5-nudge {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; box-shadow: var(--shadow); flex-wrap: wrap;
  }
  .c5-nudge-text { font-size: 12.5px; color: var(--ink2); line-height: 1.5; }
  .c5-nudge-text strong { color: var(--ink); }
  .c5-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: var(--pine); color: white; text-decoration: none;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.18s; white-space: nowrap; flex-shrink: 0;
  }
  .c5-link:hover { background: var(--moss); box-shadow: 0 4px 16px var(--pine-b); }

  /* MOBILE */
  @media (max-width: 900px) {
    .gc6-body { grid-template-columns: 1fr; padding: 1rem; }
    .input-panel { position: static; }
    .kpi-strip { grid-template-columns: 1fr 1fr; }
    .flags-row { grid-template-columns: 1fr; }
    .hero-metrics { grid-template-columns: 1fr 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .gc6-header { padding: 1.5rem 1rem 1rem; }
    .gc6-body { padding: 0.75rem; gap: 0.875rem; }
    .input-panel { padding: 1.1rem; }
    .hero-card { padding: 1.25rem; }
    .hero-metrics { grid-template-columns: 1fr 1fr; }
    .kpi-strip { grid-template-columns: 1fr 1fr; }
    .chart-panel, .table-panel { padding: 1rem; }
  }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const HORIZON_RATES = { LT: 10, MT: 8, ST: 6 };

const getHorizon = yrs =>
  yrs > 7 ? "LT" : yrs >= 3 ? "MT" : "ST";

const HORIZON_META = {
  LT: { label: "Long Term · >7 yrs", suggested: HORIZON_RATES.LT, cls: "lt" },
  MT: { label: "Medium Term · 3–7 yrs", suggested: HORIZON_RATES.MT, cls: "mt" },
  ST: { label: "Short Term · <3 yrs", suggested: HORIZON_RATES.ST, cls: "st" },
};

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtPct = n => (n == null || isNaN(n)) ? "—" : `${n.toFixed(1)}%`;

// ─── MATH ─────────────────────────────────────────────────────────────────────
function calcGoal({ goalValue, tenureYears, returnRate, inflationRate,
                    valueType, existingCorpus, sipType, stepUpPct,
                    lumpsumAmt, fixedSIPAmt }) {
  const years    = Math.max(0.1, parseFloat(tenureYears) || 0);
  const rawVal   = parseFloat(goalValue) || 0;
  const r        = (parseFloat(returnRate) || 0) / 100;
  const inf      = (parseFloat(inflationRate) || 0) / 100;
  const existing = parseFloat(existingCorpus) || 0;
  const months   = Math.round(years * 12);
  const rm       = r / 12;

  if (rawVal <= 0 || years <= 0) return null;

  // Future goal value
  const futureVal = valueType === "today"
    ? rawVal * Math.pow(1 + inf, years)
    : rawVal;

  // Existing corpus grown to goal date
  const existingGrown = existing * Math.pow(1 + r, years);

  // Target corpus = gap
  const targetCorpus = Math.max(0, futureVal - existingGrown);

  // SIP required
  let sipReq = 0;
  if (sipType === "Fixed") {
    sipReq = rm > 0
      ? targetCorpus * rm / (Math.pow(1 + rm, months) - 1)
      : targetCorpus / months;
  } else if (sipType === "Step-Up") {
    const step = (parseFloat(stepUpPct) || 10) / 100;
    const baseSip = rm > 0
      ? targetCorpus * rm / (Math.pow(1 + rm, months) - 1)
      : targetCorpus / months;
    sipReq = baseSip / (1 + step / 2);
  } else if (sipType === "Lumpsum+SIP") {
    const lump = parseFloat(lumpsumAmt) || 0;
    const lumpGrown = lump * Math.pow(1 + r, years);
    const remaining = Math.max(0, targetCorpus - lumpGrown);
    sipReq = rm > 0
      ? remaining * rm / (Math.pow(1 + rm, months) - 1)
      : remaining / months;
  }

  // Achievability if user SIP is known
  const userSIP = parseFloat(fixedSIPAmt) || 0;
  let achievability = null;
  if (userSIP > 0) {
    const achieved = rm > 0
      ? userSIP * (Math.pow(1+rm, months)-1) / rm + existingGrown
      : userSIP * months + existingGrown;
    achievability = Math.min(100, (achieved / futureVal) * 100);
  }

  // Cost of delay — 1 year later
  const months1 = Math.max(1, months - 12);
  const existingGrown1 = existing * Math.pow(1+r, years-1);
  const target1 = Math.max(0, futureVal - existingGrown1);
  const sipReq1 = rm > 0
    ? target1 * rm / (Math.pow(1+rm, months1)-1)
    : target1 / months1;
  const costOfDelay = Math.max(0, sipReq1 - sipReq);

  // Wealth created
  const totalInvested = sipReq * months;
  const wealthCreated = targetCorpus - totalInvested;

  // Year-wise table
  const yearlyRows = [];
  for (let y = 1; y <= Math.ceil(years); y++) {
    const t = Math.min(y, years);
    const m = Math.round(t * 12);
    const corpus = rm > 0
      ? sipReq * (Math.pow(1+rm,m)-1) / rm + existing * Math.pow(1+r,t)
      : sipReq * m + existing * Math.pow(1+r,t);
    const invested = sipReq * m + existing;
    const realCorpus = corpus / Math.pow(1+inf, t);
    yearlyRows.push({ year: y, corpus, invested, realCorpus, cumInterest: corpus - invested });
  }

  return {
    futureVal, existingGrown, targetCorpus,
    sipReq, achievability, costOfDelay,
    totalInvested, wealthCreated, yearlyRows, months, years,
  };
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function GrowthChart({ rows, showReal, goalValue }) {
  if (!rows || rows.length < 2) return null;
  const W = 580, H = 200, PL = 62, PR = 20, PT = 14, PB = 34;
  const iW = W-PL-PR, iH = H-PT-PB;

  const allV = [...rows.map(r=>r.corpus), ...rows.map(r=>r.invested)];
  if (showReal) allV.push(...rows.map(r=>r.realCorpus));
  const maxV = Math.max(...allV, goalValue||0, 1);
  const xS = i => PL + (i/(rows.length-1||1)) * iW;
  const yS = v => PT + iH - (Math.min(v,maxV)/maxV) * iH;
  const path = key => rows.map((d,i)=>`${i===0?"M":"L"}${xS(i)},${yS(d[key])}`).join(" ");

  const yTicks = [0, maxV*0.5, maxV].map(v=>({ v, y: yS(v), label: fmt(v) }));
  const xTicks = rows.filter((_,i)=>i===0||(i+1)%3===0||i===rows.length-1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="gc6-g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2d5a3d" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#2d5a3d" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {yTicks.map((t,i)=>(
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W-PR} y2={t.y} stroke="rgba(20,28,21,0.06)" strokeWidth="1"/>
          <text x={PL-5} y={t.y+3} fill="#8fa492" fontSize="8" textAnchor="end" fontFamily="DM Mono">{t.label}</text>
        </g>
      ))}
      {xTicks.map((d,i)=>(
        <text key={i} x={xS(rows.indexOf(d))} y={H-PB+13} fill="#8fa492" fontSize="8"
          textAnchor="middle" fontFamily="DM Mono">Y{d.year}</text>
      ))}

      {/* Goal line */}
      {goalValue > 0 && (
        <line x1={PL} y1={yS(goalValue)} x2={W-PR} y2={yS(goalValue)}
          stroke="#b8860b" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7"/>
      )}

      {/* Invested area */}
      <path d={`${path("invested")} L${xS(rows.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
        fill="rgba(143,164,146,0.12)"/>
      <path d={path("invested")} fill="none" stroke="#8fa492" strokeWidth="1.5" strokeDasharray="4 3"/>

      {/* Corpus area */}
      <path d={`${path("corpus")} L${xS(rows.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
        fill="url(#gc6-g1)"/>
      <path d={path("corpus")} fill="none" stroke="#2d5a3d" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"/>

      {/* Real corpus */}
      {showReal && (
        <path d={path("realCorpus")} fill="none" stroke="#b8860b" strokeWidth="1.5"
          strokeLinecap="round" strokeDasharray="5 3"/>
      )}

      {/* Goal event dot */}
      <circle cx={xS(rows.length-1)} cy={yS(rows[rows.length-1].corpus)} r="4"
        fill="#2d5a3d" stroke="white" strokeWidth="2"/>
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function GoalCalculator() {
  const [goalName,      setGoalName]      = useState("");
  const [goalType,      setGoalType]      = useState("responsibility");
  const [valueType,     setValueType]     = useState("today");
  const [goalValue,     setGoalValue]     = useState("");
  const [tenureYears,   setTenureYears]   = useState("");
  const [inflationRate, setInflationRate] = useState(6);
  const [returnRate,    setReturnRate]    = useState("");
  const [returnOverridden, setReturnOverridden] = useState(false);
  const [existingCorpus,setExistingCorpus]= useState("");
  const [sipType,       setSipType]       = useState("Fixed");
  const [stepUpPct,     setStepUpPct]     = useState(10);
  const [lumpsumAmt,    setLumpsumAmt]    = useState("");
  const [fixedSIPAmt,   setFixedSIPAmt]   = useState("");
  const [showReal,      setShowReal]      = useState(false);

  // Auto-suggest return rate based on tenure
  const tenure = parseFloat(tenureYears) || 0;
  const horizon = getHorizon(tenure);
  const horizonMeta = HORIZON_META[horizon];
  const suggestedRate = horizonMeta.suggested;

  // When tenure changes, auto-fill rate unless user overrode it
  const handleTenureChange = val => {
    const v = parseFloat(val);
    if (!isNaN(v) && v >= 0) {
      setTenureYears(v);
      if (!returnOverridden) {
        const h = getHorizon(v);
        setReturnRate(HORIZON_RATES[h]);
      }
    } else if (val === "") {
      setTenureYears("");
    }
  };

  const handleReturnChange = val => {
    setReturnRate(val);
    setReturnOverridden(true);
  };

  const resetReturn = () => {
    setReturnRate(suggestedRate);
    setReturnOverridden(false);
  };

  const calc = useMemo(() => calcGoal({
    goalValue, tenureYears, returnRate: returnRate || suggestedRate,
    inflationRate, valueType, existingCorpus,
    sipType, stepUpPct, lumpsumAmt, fixedSIPAmt,
  }), [goalValue, tenureYears, returnRate, suggestedRate, inflationRate,
       valueType, existingCorpus, sipType, stepUpPct, lumpsumAmt, fixedSIPAmt]);

  const hasResult = !!calc;

  // Risk assessment
  const riskLevel = !calc ? null
    : calc.achievability != null
      ? calc.achievability >= 95 ? "safe" : calc.achievability >= 70 ? "warn" : "danger"
      : calc.sipReq > 0 ? "safe" : "warn";

  return (
    <>
      <style>{style}</style>
      <div className="gc6-page">

        {/* HEADER */}
        <div className="gc6-header">
          <div className="gc6-eyebrow">◆ FundLens · C6</div>
          <h1 className="gc6-title">Goal <em>Calculator</em></h1>
          <p className="gc6-subtitle">
            One goal. One clear number. Enter your target and get your required SIP in seconds.
          </p>
        </div>

        <div className="gc6-body">

          {/* ── LEFT: INPUTS ── */}
          <div className="input-panel">

            {/* Goal type */}
            <div className="section-label">◆ Goal Type</div>
            <div className="type-toggle">
              <button
                className={`type-btn ${goalType==="responsibility"?"active-resp":""}`}
                onClick={()=>setGoalType("responsibility")}>
                ⚑ Responsibility<br/>
                <span style={{fontSize:"8px",opacity:0.7}}>non-negotiable</span>
              </button>
              <button
                className={`type-btn ${goalType==="lifestyle"?"active-life":""}`}
                onClick={()=>setGoalType("lifestyle")}>
                ✦ Lifestyle<br/>
                <span style={{fontSize:"8px",opacity:0.7}}>flexible</span>
              </button>
            </div>

            {/* Goal name */}
            <div className="field">
              <div className="field-label">Goal Name</div>
              <input className="field-input" placeholder="e.g. Child's Education"
                value={goalName} onChange={e=>setGoalName(e.target.value)}/>
            </div>

            <div className="divider"/>
            <div className="section-label">◆ Goal Value</div>

            {/* Value type toggle */}
            <div className="pill-row">
              {["today","future"].map(t=>(
                <button key={t} className={`pill-btn ${valueType===t?"active":""}`}
                  onClick={()=>setValueType(t)}>
                  {t==="today"?"Today's Price":"Future Price"}
                </button>
              ))}
            </div>

            <div className="field">
              <div className="field-label">
                <span>Amount (₹)</span>
              </div>
              <input type="number" className="field-input"
                placeholder={valueType==="today"?"e.g. 2500000 at today's cost":"e.g. 5000000 at future cost"}
                value={goalValue} onChange={e=>setGoalValue(e.target.value)}/>
            </div>

            <div className="field">
              <div className="field-label">
                <span>Tenure</span>
                <span className="field-val">{tenure > 0 ? `${tenure} yrs` : ""}</span>
              </div>
              <input type="number" className="field-input" min="1" max="40"
                placeholder="Years to goal"
                value={tenureYears} onChange={e=>handleTenureChange(e.target.value)}/>
              {tenure > 0 && (
                <div className={`horizon-pill ${horizonMeta.cls}`}>
                  <span className="horizon-dot"/>
                  {horizonMeta.label}
                </div>
              )}
            </div>

            {valueType==="today" && (
              <div className="field">
                <div className="field-label">
                  <span>Inflation Rate</span>
                  <span className="field-val">{inflationRate}% p.a.</span>
                </div>
                <input type="range" className="range-input" min="0" max="12" step="0.5"
                  value={inflationRate}
                  style={{background:`linear-gradient(to right,var(--pine) ${inflationRate/12*100}%,var(--bg4) 0%)`}}
                  onChange={e=>setInflationRate(+e.target.value)}/>
              </div>
            )}

            <div className="divider"/>
            <div className="section-label">◆ Return & Corpus</div>

            <div className="field">
              <div className="field-label">
                <span>Expected Return</span>
                <span className="field-val">{returnRate || suggestedRate}% p.a.</span>
              </div>
              <input type="number" className="field-input" min="1" max="30" step="0.5"
                value={returnRate || suggestedRate}
                onChange={e=>handleReturnChange(e.target.value)}/>
              <div className="rate-note">
                {returnOverridden
                  ? <span>Custom rate · <button onClick={resetReturn}
                      style={{background:"none",border:"none",color:"var(--pine)",cursor:"pointer",fontFamily:"DM Mono",fontSize:"8px",textDecoration:"underline"}}>
                      Reset to suggested ({suggestedRate}%)
                    </button></span>
                  : `Auto-suggested for ${horizon === "LT" ? "long" : horizon === "MT" ? "medium" : "short"}-term horizon`
                }
              </div>
            </div>

            <div className="field">
              <div className="field-label">Existing Corpus (₹)</div>
              <input type="number" className="field-input" placeholder="Already saved toward this goal"
                value={existingCorpus} onChange={e=>setExistingCorpus(e.target.value)}/>
            </div>

            <div className="divider"/>
            <div className="section-label">◆ SIP Structure</div>

            <div className="pill-row">
              {["Fixed","Step-Up","Lumpsum+SIP"].map(t=>(
                <button key={t} className={`pill-btn ${sipType===t?"active":""}`}
                  onClick={()=>setSipType(t)}>{t}</button>
              ))}
            </div>

            {sipType==="Step-Up" && (
              <div className="field">
                <div className="field-label">
                  <span>Annual Step-Up</span>
                  <span className="field-val">{stepUpPct}%</span>
                </div>
                <input type="range" className="range-input" min="1" max="30" step="1"
                  value={stepUpPct}
                  style={{background:`linear-gradient(to right,var(--pine) ${(stepUpPct-1)/29*100}%,var(--bg4) 0%)`}}
                  onChange={e=>setStepUpPct(+e.target.value)}/>
              </div>
            )}
            {sipType==="Lumpsum+SIP" && (
              <div className="field">
                <div className="field-label">Lumpsum Today (₹)</div>
                <input type="number" className="field-input" placeholder="e.g. 500000"
                  value={lumpsumAmt} onChange={e=>setLumpsumAmt(e.target.value)}/>
              </div>
            )}

            <div className="field">
              <div className="field-label">My Current/Planned SIP (₹) <span style={{opacity:0.6}}>optional</span></div>
              <input type="number" className="field-input" placeholder="To check achievability %"
                value={fixedSIPAmt} onChange={e=>setFixedSIPAmt(e.target.value)}/>
            </div>

            {/* Show real returns toggle */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"4px"}}>
              <span style={{fontFamily:"DM Mono",fontSize:"8.5px",letterSpacing:"1px",textTransform:"uppercase",color:"var(--ink2)"}}>
                Show Inflation-Adjusted Returns
              </span>
              <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}}>
                <input type="checkbox" checked={showReal} onChange={e=>setShowReal(e.target.checked)}/>
              </label>
            </div>

          </div>

          {/* ── RIGHT: RESULTS ── */}
          <div className="results-col">
            {!hasResult ? (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <div className="empty-title">Enter your goal to begin</div>
                <p className="empty-sub">Fill in a goal amount and tenure — your required SIP will appear instantly.</p>
              </div>
            ) : (
              <>
                {/* HERO */}
                <div className="hero-card">
                  <div className="hero-eyebrow">
                    {goalName || (goalType === "responsibility" ? "Responsibility Goal" : "Lifestyle Goal")} · Required Monthly SIP
                  </div>
                  <div className="hero-sip">{fmt(calc.sipReq)}</div>
                  <div className="hero-sub">
                    per month · {sipType} SIP · {tenure}yr horizon
                  </div>
                  <div className="hero-metrics">
                    <div className="hero-metric">
                      <div className="hero-metric-label">Future Goal Value</div>
                      <div className="hero-metric-val">{fmt(calc.futureVal)}</div>
                    </div>
                    <div className="hero-metric">
                      <div className="hero-metric-label">Total Invested</div>
                      <div className="hero-metric-val">{fmt(calc.totalInvested)}</div>
                    </div>
                    <div className="hero-metric">
                      <div className="hero-metric-label">Wealth Created</div>
                      <div className="hero-metric-val">{fmt(Math.max(0,calc.wealthCreated))}</div>
                    </div>
                  </div>
                </div>

                {/* KPI STRIP */}
                <div className="kpi-strip">
                  <div className="kpi-card">
                    <div className="kpi-label">Inflation-Adj. Goal</div>
                    <div className="kpi-val" style={{fontSize:"1rem"}}>{fmt(calc.futureVal)}</div>
                    <div className="kpi-sub">{valueType==="today"?`at ${inflationRate}% inflation`:"as entered"}</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Existing Corpus</div>
                    <div className="kpi-val" style={{fontSize:"1rem"}}>{fmt(calc.existingGrown)}</div>
                    <div className="kpi-sub">grown to goal date</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Target Gap</div>
                    <div className="kpi-val" style={{fontSize:"1rem",color:"var(--pine)"}}>{fmt(calc.targetCorpus)}</div>
                    <div className="kpi-sub">to be built via SIP</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Cost of Delay</div>
                    <div className="kpi-val" style={{fontSize:"1rem",color:"var(--danger)"}}>{fmt(calc.costOfDelay)}</div>
                    <div className="kpi-sub">extra SIP if 1yr late</div>
                  </div>
                </div>

                {/* ACHIEVABILITY */}
                {calc.achievability != null && (
                  <div className="achieve-card">
                    <div className="achieve-header">
                      <span className="achieve-title">◈ Goal Achievability</span>
                      <span className="achieve-pct" style={{
                        color: calc.achievability>=95?"var(--pine)":calc.achievability>=70?"var(--gold)":"var(--danger)"
                      }}>{fmtPct(calc.achievability)}</span>
                    </div>
                    <div className="achieve-bar-bg">
                      <div className="achieve-bar-fill" style={{
                        width:`${calc.achievability}%`,
                        background: calc.achievability>=95?"var(--pine)":calc.achievability>=70?"var(--gold)":"var(--danger)"
                      }}/>
                    </div>
                    <div className="achieve-note">
                      {calc.achievability >= 99
                        ? `Your planned SIP of ${fmt(parseFloat(fixedSIPAmt))} fully funds this goal.`
                        : calc.achievability >= 70
                        ? `Your planned SIP covers ${fmtPct(calc.achievability)} of the goal. Consider increasing by ${fmt(calc.sipReq - parseFloat(fixedSIPAmt))}/mo.`
                        : `Significant shortfall — your SIP covers only ${fmtPct(calc.achievability)} of the goal. Required: ${fmt(calc.sipReq)}/mo.`
                      }
                    </div>
                  </div>
                )}

                {/* RISK + DELAY FLAGS */}
                <div className="flags-row">
                  <div className={`flag-card ${riskLevel || "safe"}`}>
                    <span className="flag-icon">
                      {riskLevel==="safe"?"✓":riskLevel==="warn"?"◉":"⚠"}
                    </span>
                    <div>
                      <div className="flag-title">
                        {riskLevel==="safe"?"Goal Funded":riskLevel==="warn"?"Partial Risk":"Shortfall Risk"}
                      </div>
                      <div className="flag-desc">
                        {riskLevel==="safe"
                          ? "At the required SIP rate, this goal is fully achievable."
                          : riskLevel==="warn"
                          ? "Goal may be partially funded. Review SIP amount or extend tenure."
                          : "Current SIP is significantly below required. Increase SIP or revise goal."
                        }
                      </div>
                    </div>
                  </div>
                  <div className={`flag-card ${calc.costOfDelay > calc.sipReq * 0.1 ? "warn" : "safe"}`}>
                    <span className="flag-icon">⏱</span>
                    <div>
                      <div className="flag-title">Cost of Delay</div>
                      <div className="flag-desc">
                        Starting 1 year later increases your required SIP by <strong>{fmt(calc.costOfDelay)}/mo</strong>.
                        {goalType==="responsibility" ? " This is a non-negotiable goal — start now." : " Consider starting sooner."}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CHART */}
                <div className="chart-panel">
                  <div className="chart-header">
                    <span className="chart-title">◈ Corpus Growth Journey</span>
                    <div className="chart-legend">
                      <div className="legend-item">
                        <div className="legend-line" style={{background:"#8fa492"}}/>Invested
                      </div>
                      <div className="legend-item">
                        <div className="legend-line" style={{background:"var(--pine)"}}/>Corpus
                      </div>
                      {showReal && <div className="legend-item">
                        <div className="legend-line" style={{background:"var(--gold)"}}/>Real Value
                      </div>}
                      <div className="legend-item">
                        <div className="legend-line" style={{background:"var(--gold)",opacity:0.7}}/>Goal
                      </div>
                    </div>
                  </div>
                  <div className="chart-scroll">
                    <GrowthChart
                      rows={calc.yearlyRows}
                      showReal={showReal}
                      goalValue={calc.futureVal}
                    />
                  </div>
                </div>

                {/* YEAR TABLE */}
                <div className="table-panel">
                  <div className="chart-header">
                    <span className="chart-title">◈ Year-wise Projection</span>
                  </div>
                  <div className="table-scroll">
                    <table className="gc6-table">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Invested</th>
                          <th>Corpus</th>
                          <th>Returns</th>
                          {showReal && <th>Real Value</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {calc.yearlyRows.map((r,i)=>(
                          <tr key={i}>
                            <td>Year {r.year}</td>
                            <td>{fmt(r.invested)}</td>
                            <td className="td-pine">{fmt(r.corpus)}</td>
                            <td className="td-gold">{fmt(r.cumInterest)}</td>
                            {showReal && <td>{fmt(r.realCorpus)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="sensitivity-note">
                  Results assume consistent returns. Actual market returns will vary.
                </div>

                {/* C5 NUDGE */}
                <div className="c5-nudge">
                  <div className="c5-nudge-text">
                    <strong>Planning for multiple goals?</strong> Retirement, education, and a home — all at once.
                    Our multi-goal planner optimises a single corpus across all your life goals.
                  </div>
                  <Link to="/goal-sip" className="c5-link">
                    Try C5 Multi-Goal →
                  </Link>
                </div>

              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
