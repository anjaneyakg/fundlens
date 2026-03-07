import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ─── STYLES ──────────────────────────────────────────────────────────────────
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Fraunces:ital,wght@0,700;0,900;1,700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #f7f4ef;
    --bg2:      #ffffff;
    --bg3:      #f0ece4;
    --bg4:      #e8e2d8;
    --sage:     #3d8b6f;
    --sage-l:   #e6f4ee;
    --sage-m:   #b8ddd0;
    --rose:     #c2687a;
    --rose-l:   #fceef1;
    --indigo:   #5c6bc0;
    --indigo-l: #eef0fb;
    --gold:     #c8892a;
    --gold-l:   #fdf3e3;
    --red:      #d94f4f;
    --green:    #2e8b57;
    --text:     #2d2a24;
    --text2:    #7a7060;
    --border:   rgba(60,50,30,0.1);
    --border-s: rgba(61,139,111,0.25);
    --shadow:   0 2px 16px rgba(60,50,30,0.07);
    --shadow-m: 0 6px 28px rgba(60,50,30,0.11);
  }

  .sip-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    background-image:
      radial-gradient(ellipse 55% 45% at 95% 0%,  rgba(61,139,111,0.09) 0%, transparent 60%),
      radial-gradient(ellipse 45% 55% at 0%  95%, rgba(194,104,122,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 40% 40% at 50% 50%, rgba(200,137,42,0.04)  0%, transparent 70%);
  }

  /* HEADER */
  .sip-header {
    max-width: 1200px; margin: 0 auto;
    padding: 3rem 2rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  .sip-eyebrow {
    font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--sage); margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .sip-eyebrow::after { content:''; flex:1; max-width:80px; height:1px; background: var(--border-s); }
  .sip-title {
    font-family: 'Fraunces'; font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 900; line-height: 1.05; margin-bottom: 10px;
    color: var(--text);
  }
  .sip-title em { font-style: italic; color: var(--sage); }
  .sip-subtitle { font-size: 14px; color: var(--text2); max-width: 500px; line-height: 1.6; }

  /* LAYOUT */
  .sip-body {
    max-width: 1200px; margin: 0 auto;
    display: grid; grid-template-columns: 360px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }

  /* PANELS */
  .panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem;
    box-shadow: var(--shadow);
  }
  .panel-sticky { position: sticky; top: 72px; }
  .panel-title {
    font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--sage); margin-bottom: 1.25rem;
    padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);
  }

  /* SCHEME SEARCH */
  .search-box { position: relative; margin-bottom: 1rem; }
  .search-input {
    width: 100%; padding: 10px 14px 10px 38px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'JetBrains Mono'; font-size: 12px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .search-input:focus { border-color: var(--sage); box-shadow: 0 0 0 3px rgba(61,139,111,0.1); }
  .search-input::placeholder { color: var(--text2); }
  .search-icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: var(--text2); font-size: 14px; pointer-events: none;
  }
  .search-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: var(--bg2); border: 1px solid var(--border-s);
    border-radius: 10px; max-height: 220px; overflow-y: auto;
    z-index: 100; box-shadow: var(--shadow-m);
  }
  .search-item {
    padding: 9px 14px; cursor: pointer; font-size: 12px;
    border-bottom: 1px solid var(--border); transition: background 0.1s;
    line-height: 1.4;
  }
  .search-item:hover { background: var(--sage-l); }
  .search-item:last-child { border-bottom: none; }
  .search-item-name { color: var(--text); font-size: 11px; }
  .search-item-meta { color: var(--text2); font-size: 10px; font-family: 'JetBrains Mono'; margin-top: 2px; }
  .selected-scheme {
    background: var(--sage-l); border: 1px solid var(--border-s);
    border-radius: 8px; padding: 10px 12px; margin-bottom: 1rem;
  }
  .selected-scheme-name { font-size: 12px; color: var(--sage); font-weight: 600; line-height: 1.4; }
  .selected-scheme-meta { font-family: 'JetBrains Mono'; font-size: 10px; color: var(--text2); margin-top: 3px; }
  .clear-btn {
    background: none; border: none; color: var(--text2); cursor: pointer;
    font-size: 11px; font-family: 'JetBrains Mono'; text-decoration: underline;
    margin-top: 4px; display: block;
  }
  .clear-btn:hover { color: var(--rose); }

  /* FORM FIELDS */
  .field { margin-bottom: 1rem; }
  .field-label {
    font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 1px;
    text-transform: uppercase; color: var(--text2); margin-bottom: 6px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .field-val { color: var(--sage); font-size: 11px; font-weight: 600; }
  .field-input {
    width: 100%; padding: 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'JetBrains Mono'; font-size: 13px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .field-input:focus { border-color: var(--sage); box-shadow: 0 0 0 3px rgba(61,139,111,0.1); }

  .range-input {
    -webkit-appearance: none; width: 100%; height: 4px;
    border-radius: 2px; outline: none; cursor: pointer; margin-top: 6px;
  }
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: var(--sage); cursor: pointer;
    box-shadow: 0 2px 8px rgba(61,139,111,0.35); border: 2px solid white;
  }

  /* TOGGLE */
  .toggle-row { display: flex; gap: 6px; margin-bottom: 1rem; }
  .tog-btn {
    flex: 1; padding: 8px 0; border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg3); color: var(--text2); cursor: pointer;
    font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 1px;
    text-transform: uppercase; transition: all 0.15s;
  }
  .tog-btn.active {
    background: var(--sage-l); border-color: var(--border-s);
    color: var(--sage); font-weight: 600;
  }

  .divider { height: 1px; background: var(--border); margin: 1rem 0; }

  .calc-btn {
    width: 100%; padding: 13px; border-radius: 10px; border: none; cursor: pointer;
    background: linear-gradient(135deg, var(--sage) 0%, #5c9e7e 50%, var(--indigo) 100%);
    color: white; font-family: 'JetBrains Mono'; font-size: 12px;
    font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.2s; box-shadow: 0 4px 16px rgba(61,139,111,0.25);
    margin-top: 0.5rem;
  }
  .calc-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(61,139,111,0.35); }
  .calc-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

  /* RESULTS */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }

  /* METRIC CARDS */
  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .metric-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.25rem;
    box-shadow: var(--shadow);
    animation: fadeUp 0.4s ease both;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  .metric-card.highlight {
    border-color: var(--border-s);
    background: linear-gradient(135deg, var(--sage-l), var(--indigo-l));
  }
  .metric-eyebrow {
    font-family: 'JetBrains Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--text2); margin-bottom: 8px;
  }
  .metric-value {
    font-family: 'Fraunces'; font-size: 1.6rem; font-weight: 700;
    line-height: 1; margin-bottom: 4px;
  }
  .metric-sub { font-size: 11px; color: var(--text2); }

  /* CHART PANEL */
  .chart-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem;
    box-shadow: var(--shadow);
    animation: fadeUp 0.5s ease both;
  }
  .chart-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.25rem;
  }
  .chart-title {
    font-family: 'JetBrains Mono'; font-size: 10px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--text2);
  }
  .chart-toggle { display: flex; gap: 4px; }
  .chart-tog {
    padding: 5px 14px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--text2); cursor: pointer;
    font-family: 'JetBrains Mono'; font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; transition: all 0.15s;
  }
  .chart-tog.active {
    background: var(--sage-l); border-color: var(--border-s); color: var(--sage);
  }

  .svg-chart { width: 100%; overflow: visible; }

  /* ROLLING + TABLE PANELS */
  .rolling-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem;
    box-shadow: var(--shadow);
    animation: fadeUp 0.6s ease both;
  }

  /* YEAR TABLE */
  .year-table {
    width: 100%; border-collapse: collapse;
    font-family: 'JetBrains Mono'; font-size: 11px;
  }
  .year-table th {
    text-align: right; padding: 8px 10px;
    border-bottom: 2px solid var(--border);
    color: var(--text2); font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; font-weight: 500;
  }
  .year-table th:first-child { text-align: left; }
  .year-table td {
    text-align: right; padding: 9px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .year-table td:first-child { text-align: left; color: var(--text2); }
  .year-table tr:hover td { background: var(--bg3); }

  /* EMPTY / LOADING */
  .empty-state {
    text-align: center; padding: 4rem 2rem; color: var(--text2);
  }
  .empty-icon { font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.6; }
  .empty-title {
    font-family: 'Fraunces'; font-size: 1.2rem; color: var(--text);
    margin-bottom: 8px;
  }
  .empty-sub { font-size: 13px; line-height: 1.6; }

  .loading-bar {
    height: 3px; background: var(--bg4); border-radius: 2px;
    overflow: hidden; margin-top: 8px;
  }
  .loading-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sage-m), var(--sage), var(--indigo));
    animation: loadBar 1.5s ease-in-out infinite;
  }
  @keyframes loadBar { 0%{width:0%;margin-left:0} 50%{width:60%;margin-left:20%} 100%{width:0%;margin-left:100%} }

  @media (max-width: 900px) {
    .sip-body { grid-template-columns: 1fr; }
    .metrics-grid { grid-template-columns: 1fr 1fr; }
    .panel-sticky { position: static; }
  }
`;

// ─── MATH ────────────────────────────────────────────────────────────────────
const fmt = n => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtPct = n => n === null || isNaN(n) ? "—" : `${n.toFixed(2)}%`;

// XIRR via Newton-Raphson
function xirr(cashflows, dates) {
  if (cashflows.length < 2) return null;
  const t0 = dates[0].getTime();
  const years = dates.map(d => (d.getTime() - t0) / (365.25 * 24 * 3600 * 1000));

  const npv = r => cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, years[i]), 0);
  const dnpv = r => cashflows.reduce((s, cf, i) =>
    i === 0 ? s : s - years[i] * cf / Math.pow(1 + r, years[i] + 1), 0);

  let r = 0.1;
  for (let i = 0; i < 200; i++) {
    const f  = npv(r);
    const df = dnpv(r);
    if (Math.abs(df) < 1e-12) break;
    const r2 = r - f / df;
    if (Math.abs(r2 - r) < 1e-8) return r2 * 100;
    r = r2;
    if (r < -0.999) r = -0.5;
    if (r > 100) r = 10;
  }
  return r * 100;
}

// Get NAV closest to a given date (searches ±5 days)
function getNavOnDate(navMap, targetDate) {
  const key = d => d.toISOString().slice(0, 10);
  for (let offset = 0; offset <= 5; offset++) {
    for (const sign of [0, 1, -1]) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() + (sign === 0 ? 0 : sign * offset));
      const v = navMap[key(d)];
      if (v !== undefined) return { nav: v, date: d };
    }
  }
  return null;
}

function computeSIP({ navMap, navDates, startDate, years, monthlyAmount, stepUpPct }) {
  const cashflows = [];
  const cfDates   = [];
  const monthlyData = [];

  let sip     = monthlyAmount;
  let totalInvested = 0;
  let totalUnits = 0;
  const numMonths = years * 12;

  for (let m = 0; m < numMonths; m++) {
    // Increase SIP every 12 months for step-up
    if (stepUpPct > 0 && m > 0 && m % 12 === 0) {
      sip = sip * (1 + stepUpPct / 100);
    }

    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    d.setDate(1);

    const navResult = getNavOnDate(navMap, d);
    if (!navResult) continue;

    const units   = sip / navResult.nav;
    totalUnits   += units;
    totalInvested += sip;

    cashflows.push(-sip);
    cfDates.push(navResult.date);

    // Portfolio value at this point
    const currentVal = totalUnits * navResult.nav;
    monthlyData.push({
      date:     navResult.date,
      invested: Math.round(totalInvested),
      value:    Math.round(currentVal),
      month:    m + 1,
      sip:      Math.round(sip),
    });
  }

  if (totalUnits === 0 || monthlyData.length === 0) return null;

  // Final value at last available NAV
  const lastNavDate = new Date(Math.max(...navDates.map(d => d.getTime())));
  const lastNavResult = getNavOnDate(navMap, lastNavDate);
  const finalValue = lastNavResult ? totalUnits * lastNavResult.nav : 0;

  cashflows.push(finalValue);
  cfDates.push(lastNavResult?.date || lastNavDate);

  const xirrVal    = xirr(cashflows, cfDates);
  const absGainPct = totalInvested > 0 ? ((finalValue - totalInvested) / totalInvested) * 100 : 0;

  // Year-wise summary
  const yearlyData = [];
  for (let y = 1; y <= years; y++) {
    const endIdx = monthlyData.findLastIndex(r => r.month <= y * 12);
    if (endIdx < 0) continue;
    const row = monthlyData[endIdx];
    yearlyData.push({
      year: y,
      invested: row.invested,
      value:    row.value,
      gain:     row.value - row.invested,
      gainPct:  ((row.value - row.invested) / row.invested) * 100,
    });
  }

  // Best/worst rolling 12-month XIRR — correct approach:
  // For each 12-month window, track only units bought in that window
  // Terminal value = those units × NAV at end of window
  let bestRolling = null, worstRolling = null;
  if (monthlyData.length >= 13) {
    let best = -Infinity, worst = Infinity;
    for (let end = 12; end < monthlyData.length; end++) {
      const window = monthlyData.slice(end - 12, end + 1);
      // Units accumulated only within this 12-month window
      let windowUnits = 0;
      const cfs = [], dts = [];
      for (let i = 0; i < window.length - 1; i++) {
        const nav = getNavOnDate(navMap, window[i].date);
        if (!nav) continue;
        const units = window[i].sip / nav.nav;
        windowUnits += units;
        cfs.push(-window[i].sip);
        dts.push(window[i].date);
      }
      // Terminal cashflow = window units × NAV at end of window
      const endNav = getNavOnDate(navMap, window[window.length - 1].date);
      if (!endNav || windowUnits <= 0) continue;
      const terminalValue = windowUnits * endNav.nav;
      cfs.push(terminalValue);
      dts.push(endNav.date);
      const r = xirr(cfs, dts);
      if (r !== null && isFinite(r) && r > -100 && r < 500) {
        best  = Math.max(best, r);
        worst = Math.min(worst, r);
      }
    }
    bestRolling  = best  === -Infinity ? null : best;
    worstRolling = worst ===  Infinity ? null : worst;
  }

  return {
    totalInvested,
    finalValue,
    absGain:    finalValue - totalInvested,
    absGainPct,
    xirr:       xirrVal,
    monthlyData,
    yearlyData,
    bestRolling:  bestRolling,
    worstRolling: worstRolling,
    numInstallments: monthlyData.length,
  };
}

// ─── CHART COMPONENTS ────────────────────────────────────────────────────────
function LineChart({ data }) {
  if (!data || data.length < 2) return null;
  const W = 680, H = 220, PL = 60, PR = 20, PT = 16, PB = 40;
  const iW = W - PL - PR, iH = H - PT - PB;

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => Math.min(d.value, d.invested)));

  const xScale = i => PL + (i / (data.length - 1)) * iW;
  const yScale = v => PT + iH - ((v - minVal) / (maxVal - minVal + 1)) * iH;

  const valuePath  = data.map((d, i) => `${i===0?"M":"L"}${xScale(i)},${yScale(d.value)}`).join(" ");
  const investPath = data.map((d, i) => `${i===0?"M":"L"}${xScale(i)},${yScale(d.invested)}`).join(" ");

  // Year markers
  const yearMarkers = [];
  data.forEach((d, i) => {
    if (i === 0 || new Date(d.date).getMonth() === 0) {
      yearMarkers.push({ x: xScale(i), year: new Date(d.date).getFullYear() });
    }
  });

  // Y axis labels
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal].map(v => ({
    v, y: yScale(v), label: fmt(v)
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d8b6f" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#3d8b6f" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W-PR} y2={t.y}
            stroke="rgba(60,50,30,0.07)" strokeWidth="1"/>
          <text x={PL-6} y={t.y+4} fill="#9a8e7e" fontSize="9"
            textAnchor="end" fontFamily="JetBrains Mono">{t.label}</text>
        </g>
      ))}

      {/* Year markers */}
      {yearMarkers.slice(0, 12).map((m, i) => (
        <g key={i}>
          <line x1={m.x} y1={PT} x2={m.x} y2={H-PB}
            stroke="rgba(60,50,30,0.05)" strokeWidth="1"/>
          <text x={m.x} y={H-PB+14} fill="#9a8e7e" fontSize="9"
            textAnchor="middle" fontFamily="JetBrains Mono">{m.year}</text>
        </g>
      ))}

      {/* Area fill */}
      <path d={`${valuePath} L${xScale(data.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
        fill="url(#valueGrad)"/>

      {/* Invested line */}
      <path d={investPath} fill="none" stroke="#5c6bc0"
        strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>

      {/* Value line */}
      <path d={valuePath} fill="none" stroke="#3d8b6f" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"/>

      {/* Legend */}
      <g transform={`translate(${PL + 10}, ${PT + 8})`}>
        <line x1="0" y1="0" x2="16" y2="0" stroke="#3d8b6f" strokeWidth="2.5"/>
        <text x="20" y="4" fill="#7a7060" fontSize="9" fontFamily="JetBrains Mono">Portfolio Value</text>
        <line x1="96" y1="0" x2="112" y2="0" stroke="#5c6bc0" strokeWidth="1.5" strokeDasharray="4 3"/>
        <text x="116" y="4" fill="#7a7060" fontSize="9" fontFamily="JetBrains Mono">Amount Invested</text>
      </g>
    </svg>
  );
}

function BarChart({ data }) {
  if (!data || data.length < 1) return null;
  const W = 680, H = 220, PL = 60, PR = 20, PT = 16, PB = 40;
  const iW = W - PL - PR, iH = H - PT - PB;

  const maxVal = Math.max(...data.map(d => d.value));
  const barW = Math.max(4, iW / data.length - 2);
  const xScale = i => PL + (i / data.length) * iW + barW * 0.1;
  const yScale = v => PT + iH - (v / maxVal) * iH;
  const barH   = v => (v / maxVal) * iH;

  const yTicks = [0, maxVal * 0.5, maxVal].map(v => ({
    v, y: yScale(v), label: fmt(v)
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W-PR} y2={t.y}
            stroke="rgba(60,50,30,0.07)" strokeWidth="1"/>
          <text x={PL-6} y={t.y+4} fill="#9a8e7e" fontSize="9"
            textAnchor="end" fontFamily="JetBrains Mono">{t.label}</text>
        </g>
      ))}

      {data.map((d, i) => {
        const x  = xScale(i);
        const bw = barW * 0.8;
        return (
          <g key={i}>
            {/* Invested bar */}
            <rect x={x} y={yScale(d.invested)} width={bw * 0.45}
              height={barH(d.invested)}
              fill="#5c6bc0" opacity="0.45" rx="2"/>
            {/* Value bar */}
            <rect x={x + bw * 0.5} y={yScale(d.value)} width={bw * 0.45}
              height={barH(d.value)}
              fill={d.value >= d.invested ? "#3d8b6f" : "#c2687a"} opacity="0.75" rx="2"/>
            <text x={x + bw * 0.45} y={H - PB + 14}
              fill="#9a8e7e" fontSize="9" textAnchor="middle"
              fontFamily="JetBrains Mono">Y{d.year}</text>
          </g>
        );
      })}

      <g transform={`translate(${PL + 10}, ${PT + 8})`}>
        <rect x="0" y="-5" width="12" height="8" fill="#5c6bc0" opacity="0.45" rx="1"/>
        <text x="16" y="4" fill="#7a7060" fontSize="9" fontFamily="JetBrains Mono">Invested</text>
        <rect x="78" y="-5" width="12" height="8" fill="#3d8b6f" opacity="0.75" rx="1"/>
        <text x="94" y="4" fill="#7a7060" fontSize="9" fontFamily="JetBrains Mono">Value</text>
      </g>
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const DATA_URL = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";

export default function SIPCalculator() {
  // Scheme search
  const [allSchemes,    setAllSchemes]    = useState([]);
  const [dataLoaded,    setDataLoaded]    = useState(false);
  const [dataLoading,   setDataLoading]   = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedScheme,setSelectedScheme]= useState(null);
  const [showDropdown,  setShowDropdown]  = useState(false);

  // NAV history for selected scheme
  const [navMap,    setNavMap]    = useState(null);
  const [navDates,  setNavDates]  = useState([]);
  const [navLoading,setNavLoading]= useState(false);
  const [navError,  setNavError]  = useState(null);

  // Inputs
  const [monthlyAmount, setMonthlyAmount] = useState(10000);
  const [years,         setYears]         = useState(10);
  const [startYear,     setStartYear]     = useState(2015);
  const [startMonth,    setStartMonth]    = useState(1);
  const [sipType,       setSipType]       = useState("fixed"); // fixed | stepup
  const [stepUpPct,     setStepUpPct]     = useState(10);

  // Results
  const [result,    setResult]    = useState(null);
  const [chartMode, setChartMode] = useState("line");
  const [computing, setComputing] = useState(false);

  const dropdownRef = useRef(null);

  // Load scheme list from Gist
  const loadSchemes = useCallback(async () => {
    if (dataLoaded || dataLoading) return;
    setDataLoading(true);
    try {
      const res  = await fetch(DATA_URL);
      const json = await res.json();
      setAllSchemes(json.schemes || []);
      setDataLoaded(true);
    } catch(e) {
      console.error("Failed to load schemes", e);
    } finally {
      setDataLoading(false);
    }
  }, [dataLoaded, dataLoading]);

  // Search filter
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]); setShowDropdown(false); return;
    }
    if (!dataLoaded) { loadSchemes(); return; }
    const q = searchQuery.toLowerCase();
    const hits = allSchemes
      .filter(s => s.name.toLowerCase().includes(q) || s.amc.toLowerCase().includes(q))
      .slice(0, 30);
    setSearchResults(hits);
    setShowDropdown(hits.length > 0);
  }, [searchQuery, allSchemes, dataLoaded, loadSchemes]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load NAV history when scheme selected
  const loadNavHistory = useCallback(async (schemeId) => {
    setNavLoading(true); setNavError(null); setNavMap(null); setResult(null);
    try {
      const res  = await fetch(`https://api.mfapi.in/mf/${schemeId}`);
      const json = await res.json();
      const data = json.data || [];
      const map  = {};
      const dts  = [];
      data.forEach(r => {
        const d = new Date(r.date.split("-").reverse().join("-"));
        const k = d.toISOString().slice(0, 10);
        map[k]  = parseFloat(r.nav);
        dts.push(d);
      });
      dts.sort((a, b) => a - b);
      setNavMap(map);
      setNavDates(dts);
      // Set default start year to scheme's inception + 1
      if (dts.length > 0) {
        const inceptionYear = dts[0].getFullYear();
        setStartYear(Math.min(inceptionYear + 1, new Date().getFullYear() - 1));
      }
    } catch(e) {
      setNavError("Could not fetch NAV history from MFAPI.");
    } finally {
      setNavLoading(false);
    }
  }, []);

  const selectScheme = (scheme) => {
    setSelectedScheme(scheme);
    setSearchQuery("");
    setShowDropdown(false);
    setResult(null);
    loadNavHistory(scheme.id);
  };

  // Min year for start date
  const minYear = navDates.length > 0 ? navDates[0].getFullYear() + 1 : 2000;
  const maxYear = new Date().getFullYear() - years;

  // Compute
  const handleCompute = useCallback(() => {
    if (!navMap || !selectedScheme) return;
    setComputing(true);
    setTimeout(() => {
      const startDate = new Date(startYear, startMonth - 1, 1);
      const res = computeSIP({
        navMap, navDates, startDate,
        years, monthlyAmount,
        stepUpPct: sipType === "stepup" ? stepUpPct : 0,
      });
      setResult(res);
      setComputing(false);
    }, 50);
  }, [navMap, navDates, selectedScheme, startYear, startMonth, years, monthlyAmount, sipType, stepUpPct]);

  const canCompute = navMap && !navLoading && selectedScheme;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="sip-page">
      <style>{style}</style>

      <div className="sip-header">
        <div className="sip-eyebrow">◈ FundLens Calculator</div>
        <div className="sip-title">Historical SIP<br/><em>Performance</em></div>
        <div className="sip-subtitle">
          Pick any scheme, any start date. See what your SIP actually
          delivered — with real NAV history and true XIRR, not assumptions.
        </div>
      </div>

      <div className="sip-body">

        {/* ── INPUT PANEL ── */}
        <div className="panel panel-sticky">
          <div className="panel-title">◈ Configure SIP</div>

          {/* Scheme search */}
          <div style={{marginBottom:"1rem"}}>
            <div className="field-label" style={{marginBottom:"6px"}}>Select Scheme</div>

            {selectedScheme ? (
              <div className="selected-scheme">
                <div className="selected-scheme-name">{selectedScheme.name}</div>
                <div className="selected-scheme-meta">
                  {selectedScheme.amc} · {selectedScheme.plan} · {selectedScheme.category}
                </div>
                <button className="clear-btn" onClick={() => {
                  setSelectedScheme(null); setNavMap(null);
                  setResult(null); setNavError(null);
                }}>✕ Change scheme</button>
              </div>
            ) : (
              <div className="search-box" ref={dropdownRef}>
                <span className="search-icon">⌕</span>
                <input
                  className="search-input"
                  placeholder="Search scheme or AMC..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => { if (!dataLoaded) loadSchemes(); }}
                />
                {dataLoading && (
                  <div className="loading-bar"><div className="loading-fill"/></div>
                )}
                {showDropdown && (
                  <div className="search-dropdown">
                    {searchResults.map(s => (
                      <div key={s.id} className="search-item"
                        onMouseDown={() => selectScheme(s)}>
                        <div className="search-item-name">{s.name}</div>
                        <div className="search-item-meta">
                          {s.amc} · {s.plan} · {s.category}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {navLoading && (
              <div style={{fontSize:"11px",color:"var(--sage)",fontFamily:"JetBrains Mono",marginTop:"6px"}}>
                Loading NAV history...
                <div className="loading-bar"><div className="loading-fill"/></div>
              </div>
            )}
            {navError && (
              <div style={{fontSize:"11px",color:"var(--red)",marginTop:"6px"}}>{navError}</div>
            )}
            {navMap && (
              <div style={{fontSize:"10px",color:"var(--sage)",fontFamily:"JetBrains Mono",marginTop:"4px"}}>
                ✓ {Object.keys(navMap).length.toLocaleString()} NAV data points loaded
              </div>
            )}
          </div>

          <div className="divider"/>

          {/* SIP Type */}
          <div className="field-label">SIP Type</div>
          <div className="toggle-row">
            <button className={`tog-btn ${sipType==="fixed"?"active":""}`}
              onClick={()=>setSipType("fixed")}>Fixed</button>
            <button className={`tog-btn ${sipType==="stepup"?"active":""}`}
              onClick={()=>setSipType("stepup")}>Step-up</button>
          </div>

          {/* Monthly amount */}
          <div className="field">
            <div className="field-label">
              <span>Monthly SIP</span>
              <span className="field-val">₹{monthlyAmount.toLocaleString("en-IN")}</span>
            </div>
            <input type="range" className="range-input"
              min="500" max="100000" step="500" value={monthlyAmount}
              style={{background:`linear-gradient(to right,var(--sage) ${(monthlyAmount-500)/(100000-500)*100}%,var(--border) 0%)`}}
              onChange={e=>setMonthlyAmount(+e.target.value)}/>
            <input type="number" className="field-input" style={{marginTop:"6px"}}
              value={monthlyAmount} min="500"
              onChange={e=>setMonthlyAmount(Math.max(500,+e.target.value))}/>
          </div>

          {/* Step-up % */}
          {sipType === "stepup" && (
            <div className="field">
              <div className="field-label">
                <span>Annual Step-up</span>
                <span className="field-val">{stepUpPct}% / year</span>
              </div>
              <input type="range" className="range-input"
                min="5" max="25" step="1" value={stepUpPct}
                style={{background:`linear-gradient(to right,var(--sage) ${(stepUpPct-5)/(25-5)*100}%,var(--border) 0%)`}}
                onChange={e=>setStepUpPct(+e.target.value)}/>
            </div>
          )}

          {/* Start date */}
          <div className="field">
            <div className="field-label">SIP Start</div>
            <div style={{display:"flex",gap:"8px"}}>
              <select className="field-input" value={startMonth}
                onChange={e=>setStartMonth(+e.target.value)}
                style={{flex:"0 0 90px"}}>
                {MONTHS.map((m,i)=>(
                  <option key={i} value={i+1}>{m}</option>
                ))}
              </select>
              <input type="number" className="field-input"
                value={startYear} min={minYear} max={maxYear}
                onChange={e=>setStartYear(+e.target.value)}/>
            </div>
          </div>

          {/* Duration */}
          <div className="field">
            <div className="field-label">
              <span>Duration</span>
              <span className="field-val">{years} years</span>
            </div>
            <input type="range" className="range-input"
              min="1" max="30" step="1" value={years}
              style={{background:`linear-gradient(to right,var(--sage) ${(years-1)/(30-1)*100}%,var(--border) 0%)`}}
              onChange={e=>setYears(+e.target.value)}/>
          </div>

          <button className="calc-btn" onClick={handleCompute}
            disabled={!canCompute || computing}>
            {computing ? "Computing..." : "Calculate Returns →"}
          </button>
        </div>

        {/* ── RESULTS ── */}
        <div className="results-col">
          {!result && !computing && (
            <div className="panel">
              <div className="empty-state">
                <div className="empty-icon">📈</div>
                <div className="empty-title">Select a scheme to begin</div>
                <div className="empty-sub">
                  Search for any mutual fund scheme above, configure your SIP parameters,
                  then hit Calculate to see real historical performance.
                </div>
              </div>
            </div>
          )}

          {computing && (
            <div className="panel">
              <div className="empty-state">
                <div className="empty-icon">⚙️</div>
                <div className="empty-title">Computing XIRR...</div>
                <div className="empty-sub">Running Newton-Raphson on {years * 12} cashflows</div>
                <div className="loading-bar" style={{maxWidth:"200px",margin:"16px auto 0"}}>
                  <div className="loading-fill"/>
                </div>
              </div>
            </div>
          )}

          {result && !computing && (
            <>
              {/* Key Metrics */}
              <div className="metrics-grid">
                <div className="metric-card highlight">
                  <div className="metric-eyebrow">XIRR</div>
                  <div className="metric-value" style={{
                    color: result.xirr > 12 ? "var(--sage)" :
                           result.xirr > 6  ? "var(--gold)" : "var(--red)"
                  }}>
                    {fmtPct(result.xirr)}
                  </div>
                  <div className="metric-sub">Annualised actual return</div>
                </div>
                <div className="metric-card">
                  <div className="metric-eyebrow">Current Value</div>
                  <div className="metric-value" style={{color:"var(--sage)"}}>
                    {fmt(result.finalValue)}
                  </div>
                  <div className="metric-sub">
                    Gain: {fmt(result.absGain)} ({fmtPct(result.absGainPct)})
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-eyebrow">Total Invested</div>
                  <div className="metric-value" style={{color:"var(--indigo)"}}>
                    {fmt(result.totalInvested)}
                  </div>
                  <div className="metric-sub">{result.numInstallments} instalments</div>
                </div>
                <div className="metric-card">
                  <div className="metric-eyebrow">Best 1Y Rolling Return</div>
                  <div className="metric-value" style={{color:"var(--green)"}}>
                    {fmtPct(result.bestRolling)}
                  </div>
                  <div className="metric-sub">Peak 12-month XIRR window</div>
                </div>
                <div className="metric-card">
                  <div className="metric-eyebrow">Worst 1Y Rolling Return</div>
                  <div className="metric-value" style={{
                    color: result.worstRolling < 0 ? "var(--red)" : "var(--gold)"
                  }}>
                    {fmtPct(result.worstRolling)}
                  </div>
                  <div className="metric-sub">Trough 12-month XIRR window</div>
                </div>
                <div className="metric-card">
                  <div className="metric-eyebrow">Wealth Multiple</div>
                  <div className="metric-value" style={{color:"var(--gold)"}}>
                    {result.totalInvested > 0
                      ? `${(result.finalValue / result.totalInvested).toFixed(2)}x`
                      : "—"}
                  </div>
                  <div className="metric-sub">Corpus ÷ invested</div>
                </div>
              </div>

              {/* Chart */}
              <div className="chart-panel">
                <div className="chart-header">
                  <div className="chart-title">◈ Wealth Index</div>
                  <div className="chart-toggle">
                    <button className={`chart-tog ${chartMode==="line"?"active":""}`}
                      onClick={()=>setChartMode("line")}>Line</button>
                    <button className={`chart-tog ${chartMode==="bar"?"active":""}`}
                      onClick={()=>setChartMode("bar")}>Bar</button>
                  </div>
                </div>
                {chartMode === "line"
                  ? <LineChart data={result.monthlyData}/>
                  : <BarChart  data={result.yearlyData}/>
                }
              </div>

              {/* Year-wise Table */}
              <div className="rolling-panel">
                <div className="panel-title">◈ Year-wise Breakdown</div>
                <table className="year-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Invested</th>
                      <th>Value</th>
                      <th>Gain ₹</th>
                      <th>Gain %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.yearlyData.map(row => (
                      <tr key={row.year}>
                        <td>Year {row.year}</td>
                        <td>{fmt(row.invested)}</td>
                        <td style={{color: row.value >= row.invested ? "var(--sage)" : "var(--red)"}}>
                          {fmt(row.value)}
                        </td>
                        <td style={{color: row.gain >= 0 ? "var(--green)" : "var(--red)"}}>
                          {row.gain >= 0 ? "+" : ""}{fmt(row.gain)}
                        </td>
                        <td style={{color: row.gainPct >= 0 ? "var(--green)" : "var(--red)"}}>
                          {row.gainPct >= 0 ? "+" : ""}{fmtPct(row.gainPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
