import { useState, useMemo, useCallback } from "react";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #f4f1eb;
    --bg2:      #ffffff;
    --bg3:      #ede9e0;
    --bg4:      #e2ddd3;
    --ink:      #1a1612;
    --ink2:     #6b6358;
    --ink3:     #9a9088;
    --border:   rgba(26,22,18,0.1);
    --border2:  rgba(26,22,18,0.06);
    --shadow:   0 2px 16px rgba(26,22,18,0.07);
    --shadow-m: 0 6px 32px rgba(26,22,18,0.12);

    --resp:     #2d6a4f;  --resp-l: #eaf4ee;  --resp-b: rgba(45,106,79,0.2);
    --life:     #6b4c9a;  --life-l: #f2ecfa;  --life-b: rgba(107,76,154,0.2);
    --amber:    #c47a1e;  --amber-l:#fef6e4;  --amber-b:rgba(196,122,30,0.2);
    --danger:   #b84040;  --danger-l:#fdeaea;
    --blue:     #2c5f8a;  --blue-l: #e8f0f8;
    --safe:     #2d6a4f;  --safe-l: #eaf4ee;
  }

  .gs-page {
    min-height: 100vh; width: 100%; overflow-x: hidden;
    background: var(--bg); color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    background-image:
      radial-gradient(ellipse 70% 50% at 100% 0%, rgba(107,76,154,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 50% 60% at 0% 100%, rgba(45,106,79,0.05) 0%, transparent 60%);
  }

  /* HEADER */
  .gs-header {
    max-width: 1400px; margin: 0 auto;
    padding: 2.5rem 2rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 1.5rem; flex-wrap: wrap;
  }
  .gs-eyebrow {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--life); margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  .gs-eyebrow::after { content:''; width: 40px; height: 1px; background: var(--life-b); }
  .gs-title {
    font-family: 'Playfair Display'; font-size: clamp(1.9rem,4vw,3rem);
    font-weight: 700; line-height: 1.05; color: var(--ink);
  }
  .gs-title em { font-style: italic; color: var(--life); }
  .gs-subtitle { font-size: 12.5px; color: var(--ink2); margin-top: 6px; line-height: 1.6; max-width: 480px; }

  /* APPROACH TOGGLE */
  .approach-bar {
    display: flex; align-items: center; gap: 12px;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 12px; padding: 8px 14px;
    box-shadow: var(--shadow); flex-shrink: 0;
  }
  .approach-label { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); }
  .approach-toggle { display: flex; background: var(--bg3); border-radius: 8px; padding: 3px; gap: 3px; }
  .ap-btn {
    padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.18s;
  }
  .ap-btn.active { background: var(--bg2); color: var(--life); font-weight: 500; box-shadow: 0 1px 6px rgba(26,22,18,0.1); }

  /* BODY */
  .gs-body {
    max-width: 1400px; margin: 0 auto;
    display: grid; grid-template-columns: 420px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }

  /* LEFT COLUMN */
  .left-col { display: flex; flex-direction: column; gap: 1rem; }

  /* ASSUMPTIONS PANEL */
  .assumptions-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; box-shadow: var(--shadow); overflow: hidden;
  }
  .panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem; cursor: pointer;
    border-bottom: 1px solid var(--border2);
    transition: background 0.15s;
  }
  .panel-header:hover { background: var(--bg3); }
  .panel-header-left { display: flex; align-items: center; gap: 10px; }
  .panel-icon { font-size: 14px; }
  .panel-title { font-family: 'DM Mono'; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink); }
  .panel-chevron { font-size: 10px; color: var(--ink3); transition: transform 0.2s; }
  .panel-chevron.open { transform: rotate(180deg); }
  .panel-body { padding: 1.25rem; }

  /* assumption grid */
  .assum-section-label {
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--ink3); margin-bottom: 8px; margin-top: 12px;
  }
  .assum-section-label:first-child { margin-top: 0; }
  .horizon-grid {
    display: grid; grid-template-columns: 80px 1fr 1fr 1fr; gap: 6px;
    margin-bottom: 4px;
  }
  .horizon-head {
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--ink3); padding: 4px 0; text-align: center;
  }
  .horizon-head:first-child { text-align: left; }
  .horizon-label {
    font-family: 'DM Mono'; font-size: 9px; color: var(--ink2);
    display: flex; align-items: center; padding: 2px 0;
  }
  .horizon-input {
    width: 100%; padding: 6px 8px; text-align: center;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 6px; font-family: 'DM Mono'; font-size: 11px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .horizon-input:focus { border-color: var(--life); box-shadow: 0 0 0 2px var(--life-b); }
  .alloc-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .alloc-label { font-family: 'DM Mono'; font-size: 9px; color: var(--ink2); min-width: 90px; }
  .alloc-input {
    width: 70px; padding: 6px 8px; text-align: center;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 6px; font-family: 'DM Mono'; font-size: 12px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .alloc-input:focus { border-color: var(--life); }
  .alloc-bar-wrap { flex: 1; height: 6px; background: var(--bg4); border-radius: 3px; overflow: hidden; }
  .alloc-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .portfolio-returns {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px;
  }
  .port-return-card {
    background: var(--bg3); border-radius: 8px; padding: 8px 10px; text-align: center;
  }
  .port-return-label { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
  .port-return-val { font-family: 'DM Mono'; font-size: 14px; font-weight: 500; color: var(--life); }

  /* GOALS PANEL */
  .goals-panel { display: flex; flex-direction: column; gap: 0.75rem; }
  .add-goal-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px; border-radius: 12px; border: 1.5px dashed var(--border);
    background: transparent; color: var(--ink2); cursor: pointer;
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.18s;
  }
  .add-goal-btn:hover { border-color: var(--life); color: var(--life); background: var(--life-l); }
  .add-goal-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  /* GOAL CARD */
  .goal-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: var(--shadow); overflow: hidden;
    transition: box-shadow 0.2s;
  }
  .goal-card:hover { box-shadow: var(--shadow-m); }
  .goal-card-header {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; cursor: pointer;
    transition: background 0.15s;
  }
  .goal-card-header:hover { background: var(--bg3); }
  .goal-num {
    width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono'; font-size: 10px; font-weight: 500;
  }
  .goal-card-title { flex: 1; min-width: 0; }
  .goal-name-display {
    font-family: 'DM Sans'; font-size: 13px; font-weight: 500; color: var(--ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .goal-badges { display: flex; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
  .badge {
    font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 0.5px; text-transform: uppercase;
    padding: 2px 7px; border-radius: 10px;
  }
  .badge-resp { background: var(--resp-l); color: var(--resp); border: 1px solid var(--resp-b); }
  .badge-life { background: var(--life-l); color: var(--life); border: 1px solid var(--life-b); }
  .badge-single { background: var(--bg3); color: var(--ink3); }
  .badge-multi { background: var(--amber-l); color: var(--amber); border: 1px solid var(--amber-b); }
  .goal-card-actions { display: flex; align-items: center; gap: 6px; }
  .goal-delete-btn {
    width: 22px; height: 22px; border-radius: 50%; border: none;
    background: transparent; color: var(--ink3); cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 12px;
    transition: all 0.15s;
  }
  .goal-delete-btn:hover { background: var(--danger-l); color: var(--danger); }

  /* GOAL CARD BODY */
  .goal-card-body { padding: 14px; border-top: 1px solid var(--border2); }
  .gc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .gc-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .gc-field { display: flex; flex-direction: column; gap: 4px; }
  .gc-label {
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--ink3);
  }
  .gc-input {
    width: 100%; padding: 8px 10px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Sans'; font-size: 12.5px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .gc-input:focus { border-color: var(--life); box-shadow: 0 0 0 2px var(--life-b); }
  .gc-select {
    width: 100%; padding: 8px 10px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Mono'; font-size: 10px; color: var(--ink);
    outline: none; cursor: pointer; transition: border 0.15s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9088'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    padding-right: 28px;
  }
  .gc-select:focus { border-color: var(--life); }

  /* pill toggles inside goal */
  .pill-toggle { display: flex; background: var(--bg3); border-radius: 8px; padding: 3px; gap: 3px; margin-bottom: 10px; }
  .pill-btn {
    flex: 1; padding: 6px 8px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.8px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.15s; text-align: center;
  }
  .pill-btn.active-resp { background: var(--bg2); color: var(--resp); box-shadow: 0 1px 4px rgba(26,22,18,0.1); }
  .pill-btn.active-life { background: var(--bg2); color: var(--life); box-shadow: 0 1px 4px rgba(26,22,18,0.1); }
  .pill-btn.active-neutral { background: var(--bg2); color: var(--ink); box-shadow: 0 1px 4px rgba(26,22,18,0.1); }

  .gc-divider { height: 1px; background: var(--border2); margin: 10px 0; }
  .gc-section-label {
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--ink3); margin-bottom: 8px;
  }

  /* multi cashflow */
  .multi-cf-box {
    background: var(--amber-l); border: 1px solid var(--amber-b);
    border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
  }
  .multi-cf-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--amber); margin-bottom: 8px; }

  /* loan box */
  .loan-box {
    background: var(--blue-l); border: 1px solid rgba(44,95,138,0.18);
    border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
  }
  .loan-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--blue); margin-bottom: 8px; }

  /* sip structure */
  .sip-struct-box {
    background: var(--life-l); border: 1px solid var(--life-b);
    border-radius: 10px; padding: 10px 12px;
  }
  .sip-struct-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--life); margin-bottom: 8px; }

  /* RIGHT COLUMN — RESULTS */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }

  /* empty state */
  .empty-state {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 4rem 2rem; text-align: center;
    box-shadow: var(--shadow);
  }
  .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.35; }
  .empty-title { font-family: 'Playfair Display'; font-size: 1.4rem; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: var(--ink2); line-height: 1.6; }

  /* RESULTS PANELS */
  .results-approaches {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  }
  .approach-panel {
    border-radius: 16px; padding: 1.25rem;
    border: 1px solid var(--border); box-shadow: var(--shadow);
  }
  .approach-panel.goal-based { background: linear-gradient(145deg, var(--life-l), #fff); border-color: var(--life-b); }
  .approach-panel.cashflow-based { background: linear-gradient(145deg, var(--resp-l), #fff); border-color: var(--resp-b); }
  .ap-panel-header { margin-bottom: 1rem; }
  .ap-panel-title { font-family: 'Playfair Display'; font-size: 1.1rem; font-weight: 700; }
  .ap-panel-title.gb { color: var(--life); }
  .ap-panel-title.cf { color: var(--resp); }
  .ap-panel-subtitle { font-size: 11px; color: var(--ink2); margin-top: 3px; line-height: 1.5; }

  /* KPI cards */
  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1rem; }
  .kpi-card {
    background: rgba(255,255,255,0.7); border-radius: 10px; padding: 10px 12px;
    backdrop-filter: blur(4px);
  }
  .kpi-label { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
  .kpi-val { font-family: 'Playfair Display'; font-size: 1.3rem; font-weight: 700; color: var(--ink); line-height: 1; }
  .kpi-sub { font-size: 10px; color: var(--ink2); margin-top: 3px; }

  /* goal results table */
  .goal-results-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  .goal-results-table th {
    font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--ink3); padding: 6px 8px; border-bottom: 1px solid var(--border); text-align: right;
  }
  .goal-results-table th:first-child { text-align: left; }
  .goal-results-table td {
    font-family: 'DM Mono'; font-size: 10px; padding: 8px 8px;
    border-bottom: 1px solid var(--border2); text-align: right; color: var(--ink);
  }
  .goal-results-table td:first-child { text-align: left; font-family: 'DM Sans'; font-size: 11px; }
  .goal-results-table tr:last-child td { border-bottom: none; }
  .status-funded { color: var(--safe); font-weight: 500; }
  .status-partial { color: var(--amber); font-weight: 500; }
  .status-atrisk { color: var(--danger); font-weight: 500; }

  /* risk flags */
  .risk-flags { display: flex; flex-direction: column; gap: 8px; margin-bottom: 1rem; }
  .risk-flag {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 10px;
  }
  .risk-flag.safe { background: var(--safe-l); border: 1px solid var(--resp-b); }
  .risk-flag.warning { background: var(--amber-l); border: 1px solid var(--amber-b); }
  .risk-flag.danger { background: var(--danger-l); border: 1px solid rgba(184,64,64,0.2); }
  .risk-flag-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .risk-flag-text { flex: 1; }
  .risk-flag-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .risk-flag.safe .risk-flag-title { color: var(--safe); }
  .risk-flag.warning .risk-flag-title { color: var(--amber); }
  .risk-flag.danger .risk-flag-title { color: var(--danger); }
  .risk-flag-desc { font-size: 11px; color: var(--ink2); line-height: 1.4; }

  /* cost of delay */
  .delay-box {
    background: var(--bg3); border-radius: 10px; padding: 10px 12px;
    display: flex; align-items: center; gap: 10px; margin-bottom: 1rem;
  }
  .delay-icon { font-size: 16px; flex-shrink: 0; }
  .delay-text { font-size: 11.5px; color: var(--ink2); line-height: 1.5; }
  .delay-text strong { color: var(--danger); }

  /* sensitivity note */
  .sensitivity-note {
    font-family: 'DM Mono'; font-size: 9px; color: var(--ink3);
    text-align: center; padding: 8px; letter-spacing: 0.5px;
    border-top: 1px solid var(--border2); margin-top: 4px;
  }

  /* CHARTS */
  .chart-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px; }
  .chart-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink2); }
  .chart-legend { display: flex; gap: 12px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink2); }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-line { width: 16px; height: 3px; border-radius: 2px; flex-shrink: 0; }
  .chart-scroll { overflow-x: auto; }
  .svg-chart { display: block; }

  /* MOBILE */
  @media (max-width: 960px) {
    .gs-body { grid-template-columns: 1fr; padding: 1rem; }
    .results-approaches { grid-template-columns: 1fr; }
    .gs-header { padding: 1.5rem 1rem 1rem; }
  }
  @media (max-width: 600px) {
    .gs-body { padding: 0.75rem; gap: 0.75rem; }
    .kpi-grid { grid-template-columns: 1fr 1fr; }
    .gc-row { grid-template-columns: 1fr; }
    .gc-row-3 { grid-template-columns: 1fr 1fr; }
    .horizon-grid { grid-template-columns: 70px 1fr 1fr 1fr; gap: 4px; }
    .chart-panel { padding: 1rem; }
    .approach-panel { padding: 1rem; }
  }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FREQ_OPTS = ["Monthly","Quarterly","Half-Yearly","Annually","Multi-Year"];
const SIP_TYPES = ["Fixed","Step-Up","Lumpsum+SIP"];
const GOAL_COLORS = [
  { bg:"#f0ebfa", text:"#6b4c9a", border:"rgba(107,76,154,0.3)" },
  { bg:"#eaf4ee", text:"#2d6a4f", border:"rgba(45,106,79,0.3)" },
  { bg:"#fef6e4", text:"#c47a1e", border:"rgba(196,122,30,0.3)" },
  { bg:"#e8f0f8", text:"#2c5f8a", border:"rgba(44,95,138,0.3)" },
  { bg:"#fdeaea", text:"#b84040", border:"rgba(184,64,64,0.3)" },
  { bg:"#f4f1eb", text:"#6b6358", border:"rgba(107,99,88,0.3)" },
];

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtPct = n => (n == null || isNaN(n)) ? "—" : `${n.toFixed(1)}%`;

// ─── MATH ENGINE ──────────────────────────────────────────────────────────────

// Blended portfolio return for a given horizon
function blendedReturn(assump, horizon) {
  const { growthAlloc, growthST, growthMT, growthLT, debtST, debtMT, debtLT } = assump;
  const ga = growthAlloc / 100;
  const da = 1 - ga;
  if (horizon === "ST") return ga * growthST/100 + da * debtST/100;
  if (horizon === "MT") return ga * growthMT/100 + da * debtMT/100;
  return ga * growthLT/100 + da * debtLT/100;
}

// Glide-path chained FV: corpus grows backward-bucketed from goal date
// Returns monthly compounding factor for each year segment
function chainedFV(presentValue, yearsTotal, assump) {
  if (yearsTotal <= 0) return presentValue;
  // Split years into LT, MT, ST segments (backward from goal)
  // e.g. 12yr goal: LT=5yr (>7yr bucket), MT=4yr (3-7yr), ST=3yr (<3yr)
  const stYrs = Math.min(yearsTotal, 3);
  const remaining1 = yearsTotal - stYrs;
  const mtYrs = Math.min(remaining1, 4); // 3-7yr bucket = 4 years wide
  const ltYrs = Math.max(0, yearsTotal - stYrs - mtYrs);

  const rST = blendedReturn(assump, "ST");
  const rMT = blendedReturn(assump, "MT");
  const rLT = blendedReturn(assump, "LT");

  // Forward accumulation: LT phase first, then MT, then ST
  let corpus = presentValue;
  if (ltYrs > 0) corpus = corpus * Math.pow(1 + rLT/12, ltYrs*12);
  if (mtYrs > 0) corpus = corpus * Math.pow(1 + rMT/12, mtYrs*12);
  if (stYrs > 0) corpus = corpus * Math.pow(1 + rST/12, stYrs*12);
  return corpus;
}

// SIP required to accumulate targetCorpus over yearsTotal with chained returns
function sipRequired(targetCorpus, yearsTotal, assump) {
  if (yearsTotal <= 0) return targetCorpus;
  const stYrs = Math.min(yearsTotal, 3);
  const remaining1 = yearsTotal - stYrs;
  const mtYrs = Math.min(remaining1, 4);
  const ltYrs = Math.max(0, yearsTotal - stYrs - mtYrs);

  const rST = blendedReturn(assump, "ST") / 12;
  const rMT = blendedReturn(assump, "MT") / 12;
  const rLT = blendedReturn(assump, "LT") / 12;

  // Work backward: what SIP accumulates in each phase to hit target
  // Phase approach: LT SIP grows, then MT SIP adds, then ST SIP closes gap
  // Simplified: use effective blended rate for total period
  const totalMonths = Math.round(yearsTotal * 12);
  if (totalMonths <= 0) return targetCorpus;

  // Weighted average monthly rate
  const ltM = ltYrs * 12; const mtM = mtYrs * 12; const stM = stYrs * 12;
  const rEff = (ltM * rLT + mtM * rMT + stM * rST) / totalMonths;

  if (rEff <= 0) return targetCorpus / totalMonths;
  return targetCorpus * rEff / (Math.pow(1 + rEff, totalMonths) - 1);
}

// Future goal value from today's price
function futureGoalValue(todayValue, inflation, years) {
  return todayValue * Math.pow(1 + inflation/100, years);
}

// Corpus achievable from a given SIP
function sipToCorpus(monthlySIP, yearsTotal, assump) {
  if (yearsTotal <= 0 || monthlySIP <= 0) return 0;
  const stYrs = Math.min(yearsTotal, 3);
  const remaining1 = yearsTotal - stYrs;
  const mtYrs = Math.min(remaining1, 4);
  const ltYrs = Math.max(0, yearsTotal - stYrs - mtYrs);

  const rLT = blendedReturn(assump, "LT") / 12;
  const rMT = blendedReturn(assump, "MT") / 12;
  const rST = blendedReturn(assump, "ST") / 12;

  const ltM = Math.round(ltYrs * 12);
  const mtM = Math.round(mtYrs * 12);
  const stM = Math.round(stYrs * 12);

  const fvSIP = (r, n) => r > 0 ? monthlySIP * (Math.pow(1+r,n)-1)/r : monthlySIP*n;

  // LT phase SIP corpus, then grows through MT and ST phases
  let corpusLT = ltM > 0 ? fvSIP(rLT, ltM) : 0;
  corpusLT = corpusLT * Math.pow(1+rMT, mtM) * Math.pow(1+rST, stM);

  // MT phase SIP corpus (starts when LT ends), grows through ST
  let corpusMT = mtM > 0 ? fvSIP(rMT, mtM) : 0;
  corpusMT = corpusMT * Math.pow(1+rST, stM);

  // ST phase SIP corpus
  const corpusST = stM > 0 ? fvSIP(rST, stM) : 0;

  return corpusLT + corpusMT + corpusST;
}

// Per-goal calculation
function calcGoal(goal, assump) {
  const years = parseFloat(goal.tenureYears) || 0;
  if (years <= 0) return null;

  const rawValue = parseFloat(goal.goalValue) || 0;
  const inflation = parseFloat(goal.inflationRate) || 0;
  const loanAmt   = goal.hasLoan ? (parseFloat(goal.loanAmount) || 0) : 0;
  const existingCorpus = parseFloat(goal.existingCorpus) || 0;

  // Future goal value
  const futureValue = goal.valueType === "today"
    ? futureGoalValue(rawValue, inflation, years)
    : rawValue;

  // Self-funded portion
  const selfFunded = Math.max(0, futureValue - loanAmt);

  // Gap after existing corpus (compounded)
  const existingGrown = chainedFV(existingCorpus, years, assump);
  const targetCorpus = Math.max(0, selfFunded - existingGrown);

  // SIP required
  let sipReq = 0;
  if (goal.sipType === "Fixed") {
    sipReq = sipRequired(targetCorpus, years, assump);
  } else if (goal.sipType === "Step-Up") {
    // Step-up: approximate — base SIP * adjustment factor
    const stepPct = parseFloat(goal.stepUpPct) || 10;
    const baseSip = sipRequired(targetCorpus, years, assump);
    const factor = 1 / (1 + stepPct/200); // rough reduction for step-up
    sipReq = baseSip * factor;
  } else if (goal.sipType === "Lumpsum+SIP") {
    const lumpsum = parseFloat(goal.lumpsumAmt) || 0;
    const lumpsumGrown = chainedFV(lumpsum, years, assump);
    const remaining = Math.max(0, targetCorpus - lumpsumGrown);
    sipReq = sipRequired(remaining, years, assump);
  }

  // Achievability if user has a fixed SIP in mind
  const userSIP = parseFloat(goal.fixedSIPAmt) || 0;
  let achievability = null;
  if (userSIP > 0) {
    const achieved = sipToCorpus(userSIP, years, assump) + existingGrown;
    achievability = Math.min(100, (achieved / selfFunded) * 100);
  }

  // Cost of delay (1 year later)
  const sipReqDelayed = sipRequired(targetCorpus, Math.max(0.1, years - 1), assump);
  const costOfDelay = Math.max(0, sipReqDelayed - sipReq);

  // Corpus timeline for chart
  const timeline = [];
  for (let y = 0; y <= Math.ceil(years); y++) {
    const t = Math.min(y, years);
    const invested = sipReq * 12 * t;
    const corpus = sipToCorpus(sipReq, t, assump) + chainedFV(existingCorpus, t, assump);
    timeline.push({ year: y, invested, corpus, goalDate: y === Math.ceil(years) });
  }

  return { futureValue, selfFunded, targetCorpus, sipReq, achievability, costOfDelay, timeline, years };
}

// Cash-flow based: unified corpus services all goals
function calcCashFlow(goals, assump) {
  const validGoals = goals
    .map((g, i) => ({ ...g, idx: i, calc: calcGoal(g, assump) }))
    .filter(g => g.calc)
    .sort((a, b) => {
      // Responsibility first, then by tenure
      if (a.goalType !== b.goalType) return a.goalType === "responsibility" ? -1 : 1;
      return (parseFloat(a.tenureYears)||0) - (parseFloat(b.tenureYears)||0);
    });

  if (!validGoals.length) return null;

  const maxYears = Math.max(...validGoals.map(g => parseFloat(g.tenureYears)||0));
  const totalMonths = Math.ceil(maxYears * 12);

  // Find combined SIP via binary search
  let lo = 0, hi = 500000;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    // Simulate corpus with this SIP
    let corpus = 0;
    let allFunded = true;
    let prevMonth = 0;

    for (const g of validGoals) {
      const gMonths = Math.round((parseFloat(g.tenureYears)||0) * 12);
      const segMonths = gMonths - prevMonth;
      if (segMonths > 0) {
        const segYears = segMonths / 12;
        const rEff = blendedReturn(assump, segYears <= 3 ? "ST" : segYears <= 7 ? "MT" : "LT") / 12;
        // Grow existing corpus
        corpus = corpus * Math.pow(1 + rEff, segMonths);
        // Add SIP contributions
        corpus += rEff > 0
          ? mid * (Math.pow(1+rEff, segMonths) - 1) / rEff
          : mid * segMonths;
      }
      // Withdraw for goal
      const withdrawal = g.calc.selfFunded;
      corpus -= withdrawal;
      if (corpus < 0) { allFunded = false; corpus = 0; }
      prevMonth = gMonths;
    }
    if (allFunded) hi = mid; else lo = mid;
  }

  const cfSIP = (lo + hi) / 2;

  // Simulate to get per-goal status
  let corpus = 0;
  const goalStatus = [];
  let prevMonth = 0;

  for (const g of validGoals) {
    const gMonths = Math.round((parseFloat(g.tenureYears)||0) * 12);
    const segMonths = gMonths - prevMonth;
    if (segMonths > 0) {
      const segYears = segMonths / 12;
      const rEff = blendedReturn(assump, segYears <= 3 ? "ST" : segYears <= 7 ? "MT" : "LT") / 12;
      corpus = corpus * Math.pow(1 + rEff, segMonths);
      corpus += rEff > 0
        ? cfSIP * (Math.pow(1+rEff, segMonths) - 1) / rEff
        : cfSIP * segMonths;
    }
    const withdrawal = g.calc.selfFunded;
    const achievability = Math.min(100, (corpus / withdrawal) * 100);
    const status = achievability >= 99 ? "funded" : achievability >= 70 ? "partial" : "atrisk";
    goalStatus.push({ goal: g, achievability, status, withdrawal, availableCorpus: corpus });
    corpus = Math.max(0, corpus - withdrawal);
    prevMonth = gMonths;
  }

  // Corpus timeline
  const cfTimeline = [];
  let runningCorpus = 0;
  let goalEvents = validGoals.map(g => ({
    month: Math.round((parseFloat(g.tenureYears)||0)*12),
    amount: g.calc.selfFunded, name: g.goalName||"Goal"
  }));

  for (let m = 0; m <= totalMonths; m++) {
    const yr = m / 12;
    const rEff = blendedReturn(assump, yr <= 3 ? "ST" : yr <= 7 ? "MT" : "LT") / 12;
    runningCorpus = runningCorpus * (1 + rEff) + cfSIP;
    const event = goalEvents.find(e => e.month === m);
    if (event) runningCorpus = Math.max(0, runningCorpus - event.amount);
    if (m % 12 === 0) {
      cfTimeline.push({ year: m/12, corpus: runningCorpus, invested: cfSIP * m, event: event||null });
    }
  }

  const totalSIP_GB = validGoals.reduce((s, g) => s + (g.calc?.sipReq||0), 0);
  const saving = totalSIP_GB - cfSIP;

  return { cfSIP, goalStatus, cfTimeline, totalSIP_GB, saving };
}

// Glide path allocation over years
function glidePathData(totalYears, assump) {
  const pts = [];
  for (let y = 0; y <= Math.ceil(totalYears); y++) {
    const yearsToGoal = totalYears - y;
    const horizon = yearsToGoal <= 3 ? "ST" : yearsToGoal <= 7 ? "MT" : "LT";
    // In LT phase: full growth alloc; MT: reduce by 10%; ST: reduce by 20%
    const adjustment = horizon === "LT" ? 0 : horizon === "MT" ? -10 : -20;
    const growthPct = Math.max(0, Math.min(100, assump.growthAlloc + adjustment));
    pts.push({ year: y, growthPct, debtPct: 100 - growthPct });
  }
  return pts;
}

// ─── CHART COMPONENTS ─────────────────────────────────────────────────────────
function CorpusChart({ timelines, goalEvents, width = 560, height = 180 }) {
  if (!timelines || timelines.length === 0) return null;
  const PL = 62, PR = 16, PT = 12, PB = 32;
  const iW = width - PL - PR, iH = height - PT - PB;

  const allCorpus = timelines.flatMap(t => t.map(d => d.corpus));
  const allInvested = timelines.flatMap(t => t.map(d => d.invested));
  const maxV = Math.max(...allCorpus, ...allInvested, 1);
  const maxYr = Math.max(...timelines.flatMap(t => t.map(d => d.year)), 1);

  const xS = y => PL + (y / maxYr) * iW;
  const yS = v => PT + iH - (v / maxV) * iH;
  const path = (arr, key) => arr.map((d,i) => `${i===0?"M":"L"}${xS(d.year)},${yS(d[key])}`).join(" ");

  const yTicks = [0, maxV*0.5, maxV].map(v => ({ v, y: yS(v), label: fmt(v) }));
  const xTicks = Array.from({length: Math.ceil(maxYr)+1}, (_,i) => i).filter(y => y % 3 === 0 || y === Math.ceil(maxYr));

  const COLORS = ["#6b4c9a","#2d6a4f","#c47a1e","#2c5f8a","#b84040","#6b6358"];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart" style={{width:"100%"}}>
      {yTicks.map((t,i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={width-PR} y2={t.y} stroke="rgba(26,22,18,0.06)" strokeWidth="1"/>
          <text x={PL-5} y={t.y+3} fill="#9a9088" fontSize="8" textAnchor="end" fontFamily="DM Mono">{t.label}</text>
        </g>
      ))}
      {xTicks.map((y,i) => (
        <text key={i} x={xS(y)} y={height-PB+12} fill="#9a9088" fontSize="8" textAnchor="middle" fontFamily="DM Mono">Y{y}</text>
      ))}

      {/* Invested baseline — first timeline only */}
      {timelines[0] && (
        <path d={path(timelines[0], "invested")} fill="none" stroke="#9a9088" strokeWidth="1.5" strokeDasharray="4 3"/>
      )}

      {/* Corpus lines per goal */}
      {timelines.map((t, i) => (
        <path key={i} d={path(t, "corpus")} fill="none" stroke={COLORS[i%COLORS.length]} strokeWidth="2" strokeLinecap="round"/>
      ))}

      {/* Goal event markers */}
      {goalEvents && goalEvents.map((e, i) => (
        <g key={i}>
          <line x1={xS(e.year)} y1={PT} x2={xS(e.year)} y2={height-PB} stroke={COLORS[i%COLORS.length]} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>
          <circle cx={xS(e.year)} cy={yS(e.corpus||0)} r="3" fill={COLORS[i%COLORS.length]}/>
        </g>
      ))}
    </svg>
  );
}

function GlideChart({ data, width = 560, height = 140 }) {
  if (!data || data.length < 2) return null;
  const PL = 40, PR = 16, PT = 10, PB = 28;
  const iW = width - PL - PR, iH = height - PT - PB;
  const maxYr = data[data.length-1].year || 1;
  const xS = y => PL + (y/maxYr)*iW;
  const yS = v => PT + iH - (v/100)*iH;

  const growthPath = data.map((d,i)=>`${i===0?"M":"L"}${xS(d.year)},${yS(d.growthPct)}`).join(" ");
  const areaPath = `${growthPath} L${xS(maxYr)},${height-PB} L${PL},${height-PB} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart" style={{width:"100%"}}>
      <defs>
        <linearGradient id="gp-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4c9a" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#6b4c9a" stopOpacity="0.04"/>
        </linearGradient>
      </defs>
      {[0,25,50,75,100].map((v,i)=>(
        <g key={i}>
          <line x1={PL} y1={yS(v)} x2={width-PR} y2={yS(v)} stroke="rgba(26,22,18,0.06)" strokeWidth="1"/>
          <text x={PL-4} y={yS(v)+3} fill="#9a9088" fontSize="7.5" textAnchor="end" fontFamily="DM Mono">{v}%</text>
        </g>
      ))}
      <path d={areaPath} fill="url(#gp-grad)"/>
      <path d={growthPath} fill="none" stroke="#6b4c9a" strokeWidth="2" strokeLinecap="round"/>
      {/* Debt area */}
      <path d={data.map((d,i)=>`${i===0?"M":"L"}${xS(d.year)},${yS(d.debtPct)}`).join(" ")}
        fill="none" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3"/>
      {data.filter((_,i)=>i%3===0||i===data.length-1).map((d,i)=>(
        <text key={i} x={xS(d.year)} y={height-PB+12} fill="#9a9088" fontSize="7.5" textAnchor="middle" fontFamily="DM Mono">Y{d.year}</text>
      ))}
    </svg>
  );
}

// ─── DEFAULT GOAL ─────────────────────────────────────────────────────────────
let goalCounter = 0;
const defaultGoal = () => ({
  id: ++goalCounter,
  goalName: "",
  goalType: "responsibility",
  cashFlowType: "single",
  valueType: "today",
  goalValue: "",
  inflationRate: "6",
  tenureYears: "",
  hasLoan: false,
  loanAmount: "",
  existingCorpus: "",
  sipType: "Fixed",
  stepUpPct: "10",
  lumpsumAmt: "",
  fixedSIPAmt: "",
  multiFreq: "Annually",
  multiChangeType: "inflation",
  multiChangePct: "",
  multiEndYear: "",
  open: true,
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GoalSIP() {
  // Assumptions
  const [assump, setAssump] = useState({
    growthAlloc: 70,
    growthST: 10, growthMT: 13, growthLT: 15,
    debtST: 6,   debtMT: 7,   debtLT: 7.5,
  });
  const [assumpOpen, setAssumpOpen] = useState(true);

  // Goals
  const [goals, setGoals] = useState([defaultGoal()]);

  // Mobile tab
  const [mobileTab, setMobileTab] = useState("gb");

  const updateAssump = (key, val) => {
    const v = parseFloat(val);
    if (isNaN(v)) return;
    if (key === "growthAlloc") {
      setAssump(a => ({ ...a, growthAlloc: Math.min(100, Math.max(0, v)) }));
    } else {
      setAssump(a => ({ ...a, [key]: v }));
    }
  };

  const addGoal = () => {
    if (goals.length >= 6) return;
    setGoals(gs => [...gs, defaultGoal()]);
  };

  const removeGoal = id => setGoals(gs => gs.filter(g => g.id !== id));

  const updateGoal = (id, key, val) => {
    setGoals(gs => gs.map(g => g.id === id ? { ...g, [key]: val } : g));
  };

  const toggleGoal = id => {
    setGoals(gs => gs.map(g => g.id === id ? { ...g, open: !g.open } : g));
  };

  // Calculations
  const goalCalcs = useMemo(() =>
    goals.map(g => ({ goal: g, calc: calcGoal(g, assump) })),
    [goals, assump]
  );

  const cfResult = useMemo(() => {
    if (goals.every(g => !parseFloat(g.tenureYears))) return null;
    return calcCashFlow(goals, assump);
  }, [goals, assump]);

  const portfolioReturns = useMemo(() => ({
    ST: (blendedReturn(assump, "ST") * 100).toFixed(2),
    MT: (blendedReturn(assump, "MT") * 100).toFixed(2),
    LT: (blendedReturn(assump, "LT") * 100).toFixed(2),
  }), [assump]);

  const totalSIP_GB = goalCalcs.reduce((s, {calc}) => s + (calc?.sipReq||0), 0);
  const hasResults = goalCalcs.some(({calc}) => calc);

  const maxYears = Math.max(...goals.map(g => parseFloat(g.tenureYears)||0), 1);
  const glideData = useMemo(() => glidePathData(maxYears, assump), [maxYears, assump]);

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{style}</style>
      <div className="gs-page">

        {/* HEADER */}
        <div className="gs-header">
          <div>
            <div className="gs-eyebrow">◆ FundLens · C5</div>
            <h1 className="gs-title">Goal-Based <em>SIP</em> Planner</h1>
            <p className="gs-subtitle">
              Plan multiple life goals with a unified corpus or independent SIPs.
              Glide-path returns, cash-flow sequencing, and inflation-adjusted projections.
            </p>
          </div>
          <div className="approach-bar">
            <span className="approach-label">View</span>
            <div className="approach-toggle">
              <button className={`ap-btn ${mobileTab==="gb"?"active":""}`} onClick={()=>setMobileTab("gb")}>Goal-Based</button>
              <button className={`ap-btn ${mobileTab==="cf"?"active":""}`} onClick={()=>setMobileTab("cf")}>Cash Flow</button>
              <button className={`ap-btn ${mobileTab==="both"?"active":""}`} onClick={()=>setMobileTab("both")}>Both</button>
            </div>
          </div>
        </div>

        <div className="gs-body">
          {/* ── LEFT ── */}
          <div className="left-col">

            {/* ASSUMPTIONS */}
            <div className="assumptions-panel">
              <div className="panel-header" onClick={()=>setAssumpOpen(o=>!o)}>
                <div className="panel-header-left">
                  <span className="panel-icon">⚙</span>
                  <span className="panel-title">Asset Class Assumptions</span>
                </div>
                <span className={`panel-chevron ${assumpOpen?"open":""}`}>▾</span>
              </div>
              {assumpOpen && (
                <div className="panel-body">
                  {/* Allocation */}
                  <div className="assum-section-label">Portfolio Allocation</div>
                  <div className="alloc-row">
                    <span className="alloc-label" style={{color:"var(--life)"}}>▲ Growth</span>
                    <input type="number" className="alloc-input"
                      value={assump.growthAlloc} min="0" max="100"
                      onChange={e=>updateAssump("growthAlloc", e.target.value)}/>
                    <span style={{fontFamily:"DM Mono",fontSize:"10px",color:"var(--ink3)"}}>%</span>
                    <div className="alloc-bar-wrap">
                      <div className="alloc-bar-fill" style={{width:`${assump.growthAlloc}%`,background:"var(--life)"}}/>
                    </div>
                  </div>
                  <div className="alloc-row">
                    <span className="alloc-label" style={{color:"var(--resp)"}}>▼ Protection</span>
                    <input type="number" className="alloc-input"
                      value={100-assump.growthAlloc} min="0" max="100"
                      onChange={e=>updateAssump("growthAlloc", 100-(parseFloat(e.target.value)||0))}/>
                    <span style={{fontFamily:"DM Mono",fontSize:"10px",color:"var(--ink3)"}}>%</span>
                    <div className="alloc-bar-wrap">
                      <div className="alloc-bar-fill" style={{width:`${100-assump.growthAlloc}%`,background:"var(--resp)"}}/>
                    </div>
                  </div>

                  {/* Returns grid */}
                  <div className="assum-section-label" style={{marginTop:"14px"}}>Return Assumptions (%)</div>
                  <div className="horizon-grid">
                    <div className="horizon-head"/>
                    <div className="horizon-head">ST &lt;3yr</div>
                    <div className="horizon-head">MT 3-7yr</div>
                    <div className="horizon-head">LT &gt;7yr</div>
                  </div>
                  {[
                    {label:"Growth", keys:["growthST","growthMT","growthLT"], color:"var(--life)"},
                    {label:"Protection", keys:["debtST","debtMT","debtLT"], color:"var(--resp)"},
                  ].map(row => (
                    <div className="horizon-grid" key={row.label} style={{marginBottom:"6px"}}>
                      <div className="horizon-label" style={{color:row.color}}>{row.label}</div>
                      {row.keys.map(k => (
                        <input key={k} type="number" className="horizon-input"
                          value={assump[k]} min="0" max="30" step="0.5"
                          onChange={e=>updateAssump(k, e.target.value)}/>
                      ))}
                    </div>
                  ))}

                  {/* Calculated blended */}
                  <div className="assum-section-label" style={{marginTop:"14px"}}>Blended Portfolio Return</div>
                  <div className="portfolio-returns">
                    {[["ST","Short Term"],["MT","Medium Term"],["LT","Long Term"]].map(([k,l]) => (
                      <div className="port-return-card" key={k}>
                        <div className="port-return-label">{l}</div>
                        <div className="port-return-val">{portfolioReturns[k]}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* GOAL CARDS */}
            <div className="goals-panel">
              {goals.map((goal, idx) => {
                const color = GOAL_COLORS[idx % GOAL_COLORS.length];
                const calc = goalCalcs[idx]?.calc;
                return (
                  <div className="goal-card" key={goal.id}>
                    <div className="goal-card-header" onClick={()=>toggleGoal(goal.id)}>
                      <div className="goal-num" style={{background:color.bg, color:color.text, border:`1px solid ${color.border}`}}>
                        {idx+1}
                      </div>
                      <div className="goal-card-title">
                        <div className="goal-name-display">{goal.goalName||`Goal ${idx+1}`}</div>
                        <div className="goal-badges">
                          <span className={`badge ${goal.goalType==="responsibility"?"badge-resp":"badge-life"}`}>
                            {goal.goalType==="responsibility"?"Responsibility":"Lifestyle"}
                          </span>
                          <span className={`badge ${goal.cashFlowType==="single"?"badge-single":"badge-multi"}`}>
                            {goal.cashFlowType==="single"?"Single CF":"Multi CF"}
                          </span>
                          {calc && <span className="badge" style={{background:color.bg,color:color.text,border:`1px solid ${color.border}`}}>
                            {fmt(calc.sipReq)}/mo
                          </span>}
                        </div>
                      </div>
                      <div className="goal-card-actions">
                        <button className="goal-delete-btn" onClick={e=>{e.stopPropagation();removeGoal(goal.id);}}>✕</button>
                        <span style={{fontSize:"10px",color:"var(--ink3)",transform:goal.open?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>▾</span>
                      </div>
                    </div>

                    {goal.open && (
                      <div className="goal-card-body">
                        {/* Goal name */}
                        <div className="gc-field" style={{marginBottom:"10px"}}>
                          <label className="gc-label">Goal Name</label>
                          <input className="gc-input" placeholder="e.g. Child's Education"
                            value={goal.goalName} onChange={e=>updateGoal(goal.id,"goalName",e.target.value)}/>
                        </div>

                        {/* Goal type */}
                        <div className="gc-section-label">Goal Type</div>
                        <div className="pill-toggle">
                          {["responsibility","lifestyle"].map(t=>(
                            <button key={t}
                              className={`pill-btn ${goal.goalType===t?(t==="responsibility"?"active-resp":"active-life"):""}`}
                              onClick={()=>updateGoal(goal.id,"goalType",t)}>
                              {t==="responsibility"?"⚑ Responsibility":"✦ Lifestyle"}
                            </button>
                          ))}
                        </div>

                        {/* Cash flow type */}
                        <div className="gc-section-label">Cash Flow Type</div>
                        <div className="pill-toggle">
                          {["single","multiple"].map(t=>(
                            <button key={t}
                              className={`pill-btn ${goal.cashFlowType===t?"active-neutral":""}`}
                              onClick={()=>updateGoal(goal.id,"cashFlowType",t)}>
                              {t==="single"?"Single Outflow":"Multiple Outflows"}
                            </button>
                          ))}
                        </div>

                        {/* Multi CF config */}
                        {goal.cashFlowType==="multiple" && (
                          <div className="multi-cf-box">
                            <div className="multi-cf-label">Multiple Cash Flow Config</div>
                            <div className="gc-row">
                              <div className="gc-field">
                                <label className="gc-label">Frequency</label>
                                <select className="gc-select" value={goal.multiFreq}
                                  onChange={e=>updateGoal(goal.id,"multiFreq",e.target.value)}>
                                  {FREQ_OPTS.map(f=><option key={f}>{f}</option>)}
                                </select>
                              </div>
                              <div className="gc-field">
                                <label className="gc-label">Change Type</label>
                                <select className="gc-select" value={goal.multiChangeType}
                                  onChange={e=>updateGoal(goal.id,"multiChangeType",e.target.value)}>
                                  <option value="inflation">Inflation-Linked</option>
                                  <option value="defined">Defined Rate</option>
                                  <option value="fixed">Fixed Amount</option>
                                </select>
                              </div>
                            </div>
                            <div className="gc-row">
                              {goal.multiChangeType!=="inflation" && (
                                <div className="gc-field">
                                  <label className="gc-label">{goal.multiChangeType==="defined"?"Change %":"Change Amt (₹)"}</label>
                                  <input type="number" className="gc-input" value={goal.multiChangePct}
                                    onChange={e=>updateGoal(goal.id,"multiChangePct",e.target.value)}
                                    placeholder={goal.multiChangeType==="defined"?"5":"5000"}/>
                                </div>
                              )}
                              <div className="gc-field">
                                <label className="gc-label">End Year</label>
                                <input type="number" className="gc-input" value={goal.multiEndYear}
                                  onChange={e=>updateGoal(goal.id,"multiEndYear",e.target.value)}
                                  placeholder="20"/>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Goal value */}
                        <div className="gc-section-label">Goal Value</div>
                        <div className="pill-toggle">
                          {["today","future"].map(t=>(
                            <button key={t}
                              className={`pill-btn ${goal.valueType===t?"active-neutral":""}`}
                              onClick={()=>updateGoal(goal.id,"valueType",t)}>
                              {t==="today"?"Today's Price":"Future Price"}
                            </button>
                          ))}
                        </div>
                        <div className="gc-row">
                          <div className="gc-field">
                            <label className="gc-label">Amount (₹)</label>
                            <input type="number" className="gc-input"
                              value={goal.goalValue} placeholder="e.g. 2500000"
                              onChange={e=>updateGoal(goal.id,"goalValue",e.target.value)}/>
                          </div>
                          <div className="gc-field">
                            <label className="gc-label">Tenure (Years)</label>
                            <input type="number" className="gc-input"
                              value={goal.tenureYears} placeholder="e.g. 10"
                              min="1" max="40"
                              onChange={e=>{const v=+e.target.value;if(!isNaN(v))updateGoal(goal.id,"tenureYears",v);}}/>
                          </div>
                        </div>
                        <div className="gc-row">
                          <div className="gc-field">
                            <label className="gc-label">Inflation Rate (%)</label>
                            <input type="number" className="gc-input"
                              value={goal.inflationRate} min="0" max="20" step="0.5"
                              onChange={e=>updateGoal(goal.id,"inflationRate",e.target.value)}/>
                          </div>
                          <div className="gc-field">
                            <label className="gc-label">Existing Corpus (₹)</label>
                            <input type="number" className="gc-input"
                              value={goal.existingCorpus} placeholder="0"
                              onChange={e=>updateGoal(goal.id,"existingCorpus",e.target.value)}/>
                          </div>
                        </div>

                        {/* Loan */}
                        <div className="gc-divider"/>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                          <span className="gc-section-label" style={{margin:0}}>Loan Provision</span>
                          <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer"}}>
                            <input type="checkbox" checked={goal.hasLoan}
                              onChange={e=>updateGoal(goal.id,"hasLoan",e.target.checked)}/>
                            <span style={{fontFamily:"DM Mono",fontSize:"9px",color:"var(--ink2)"}}>Partially loan-funded</span>
                          </label>
                        </div>
                        {goal.hasLoan && (
                          <div className="loan-box">
                            <div className="loan-label">Loan Amount</div>
                            <input type="number" className="gc-input" value={goal.loanAmount}
                              placeholder="Loan amount (₹)"
                              onChange={e=>updateGoal(goal.id,"loanAmount",e.target.value)}/>
                          </div>
                        )}

                        {/* SIP Structure */}
                        <div className="gc-divider"/>
                        <div className="gc-section-label">SIP Structure</div>
                        <div className="pill-toggle">
                          {SIP_TYPES.map(t=>(
                            <button key={t}
                              className={`pill-btn ${goal.sipType===t?"active-neutral":""}`}
                              onClick={()=>updateGoal(goal.id,"sipType",t)}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="sip-struct-box">
                          <div className="sip-struct-label">{goal.sipType} Config</div>
                          {goal.sipType==="Fixed" && (
                            <div className="gc-field">
                              <label className="gc-label">Known Monthly SIP (₹) — optional, for achievability %</label>
                              <input type="number" className="gc-input" value={goal.fixedSIPAmt}
                                placeholder="Leave blank to calculate required SIP"
                                onChange={e=>updateGoal(goal.id,"fixedSIPAmt",e.target.value)}/>
                            </div>
                          )}
                          {goal.sipType==="Step-Up" && (
                            <div className="gc-row">
                              <div className="gc-field">
                                <label className="gc-label">Annual Step-Up %</label>
                                <input type="number" className="gc-input" value={goal.stepUpPct}
                                  min="0" max="50" placeholder="10"
                                  onChange={e=>updateGoal(goal.id,"stepUpPct",e.target.value)}/>
                              </div>
                              <div className="gc-field">
                                <label className="gc-label">Known SIP (₹) — optional</label>
                                <input type="number" className="gc-input" value={goal.fixedSIPAmt}
                                  placeholder="For achievability %"
                                  onChange={e=>updateGoal(goal.id,"fixedSIPAmt",e.target.value)}/>
                              </div>
                            </div>
                          )}
                          {goal.sipType==="Lumpsum+SIP" && (
                            <div className="gc-row">
                              <div className="gc-field">
                                <label className="gc-label">Lumpsum Today (₹)</label>
                                <input type="number" className="gc-input" value={goal.lumpsumAmt}
                                  placeholder="e.g. 500000"
                                  onChange={e=>updateGoal(goal.id,"lumpsumAmt",e.target.value)}/>
                              </div>
                              <div className="gc-field">
                                <label className="gc-label">Known SIP (₹) — optional</label>
                                <input type="number" className="gc-input" value={goal.fixedSIPAmt}
                                  placeholder="For achievability %"
                                  onChange={e=>updateGoal(goal.id,"fixedSIPAmt",e.target.value)}/>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button className="add-goal-btn" onClick={addGoal} disabled={goals.length>=6}>
                + Add Goal {goals.length>=6?"(max 6)":""}
              </button>
            </div>
          </div>

          {/* ── RIGHT: RESULTS ── */}
          <div className="results-col">
            {!hasResults ? (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <div className="empty-title">Configure your goals</div>
                <p className="empty-sub">Add at least one goal with a value and tenure to see your SIP plan.</p>
              </div>
            ) : (
              <>
                {/* APPROACH RESULTS */}
                <div className="results-approaches" style={{
                  gridTemplateColumns: mobileTab==="both" ? "1fr 1fr" : "1fr"
                }}>

                  {/* GOAL-BASED PANEL */}
                  {(mobileTab==="gb"||mobileTab==="both") && (
                    <div className="approach-panel goal-based">
                      <div className="ap-panel-header">
                        <div className="ap-panel-title gb">Goal-Based Planning</div>
                        <div className="ap-panel-subtitle">Each goal funded independently. Conservative, higher SIP.</div>
                      </div>

                      <div className="kpi-grid">
                        <div className="kpi-card">
                          <div className="kpi-label">Total Monthly SIP</div>
                          <div className="kpi-val" style={{color:"var(--life)",fontSize:"1.15rem"}}>{fmt(totalSIP_GB)}</div>
                          <div className="kpi-sub">across {goalCalcs.filter(g=>g.calc).length} goals</div>
                        </div>
                        <div className="kpi-card">
                          <div className="kpi-label">Total Goal Value</div>
                          <div className="kpi-val" style={{fontSize:"1.15rem"}}>{fmt(goalCalcs.reduce((s,{calc})=>s+(calc?.futureValue||0),0))}</div>
                          <div className="kpi-sub">inflation-adjusted</div>
                        </div>
                      </div>

                      <div style={{overflowX:"auto"}}>
                        <table className="goal-results-table">
                          <thead>
                            <tr>
                              <th>Goal</th>
                              <th>Future Value</th>
                              <th>Req. SIP</th>
                              <th>Achievability</th>
                            </tr>
                          </thead>
                          <tbody>
                            {goalCalcs.map(({goal,calc},i) => calc ? (
                              <tr key={goal.id}>
                                <td>{goal.goalName||`Goal ${i+1}`}</td>
                                <td>{fmt(calc.futureValue)}</td>
                                <td style={{color:GOAL_COLORS[i%GOAL_COLORS.length].text,fontWeight:500}}>{fmt(calc.sipReq)}</td>
                                <td>{calc.achievability!=null ? (
                                  <span className={calc.achievability>=99?"status-funded":calc.achievability>=70?"status-partial":"status-atrisk"}>
                                    {fmtPct(calc.achievability)}
                                  </span>
                                ) : "—"}</td>
                              </tr>
                            ) : null)}
                          </tbody>
                        </table>
                      </div>

                      {/* Risk flags GB */}
                      <div className="risk-flags">
                        {goalCalcs.some(({calc})=>calc&&calc.achievability!=null&&calc.achievability<70) ? (
                          <div className="risk-flag danger">
                            <span className="risk-flag-icon">⚠</span>
                            <div className="risk-flag-text">
                              <div className="risk-flag-title">Shortfall Risk</div>
                              <div className="risk-flag-desc">One or more goals may not be fully funded at the current SIP rate.</div>
                            </div>
                          </div>
                        ) : goalCalcs.some(({calc})=>calc&&calc.achievability!=null&&calc.achievability<99) ? (
                          <div className="risk-flag warning">
                            <span className="risk-flag-icon">◉</span>
                            <div className="risk-flag-text">
                              <div className="risk-flag-title">Partial Funding</div>
                              <div className="risk-flag-desc">Some goals are partially funded. Consider increasing SIP or extending tenure.</div>
                            </div>
                          </div>
                        ) : (
                          <div className="risk-flag safe">
                            <span className="risk-flag-icon">✓</span>
                            <div className="risk-flag-text">
                              <div className="risk-flag-title">On Track</div>
                              <div className="risk-flag-desc">All goals appear fully funded at the required SIP rate.</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cost of delay */}
                      {goalCalcs.some(({calc})=>calc&&calc.costOfDelay>0) && (
                        <div className="delay-box">
                          <span className="delay-icon">⏱</span>
                          <div className="delay-text">
                            Delaying by 1 year increases total SIP by <strong>{fmt(goalCalcs.reduce((s,{calc})=>s+(calc?.costOfDelay||0),0))}/mo</strong>.
                          </div>
                        </div>
                      )}

                      <div className="sensitivity-note">Results assume consistent returns. Actual market returns will vary.</div>
                    </div>
                  )}

                  {/* CASH FLOW PANEL */}
                  {(mobileTab==="cf"||mobileTab==="both") && (
                    <div className="approach-panel cashflow-based">
                      <div className="ap-panel-header">
                        <div className="ap-panel-title cf">Cash Flow-Based Planning</div>
                        <div className="ap-panel-subtitle">Single corpus funds all goals sequentially. Lower SIP, smarter compounding.</div>
                      </div>

                      {cfResult ? (
                        <>
                          <div className="kpi-grid">
                            <div className="kpi-card">
                              <div className="kpi-label">Combined SIP</div>
                              <div className="kpi-val" style={{color:"var(--resp)",fontSize:"1.15rem"}}>{fmt(cfResult.cfSIP)}</div>
                              <div className="kpi-sub">unified corpus</div>
                            </div>
                            <div className="kpi-card">
                              <div className="kpi-label">SIP Saving vs GB</div>
                              <div className="kpi-val" style={{color:"var(--safe)",fontSize:"1.15rem"}}>{fmt(cfResult.saving)}</div>
                              <div className="kpi-sub">per month</div>
                            </div>
                          </div>

                          <div style={{overflowX:"auto"}}>
                            <table className="goal-results-table">
                              <thead>
                                <tr>
                                  <th>Goal</th>
                                  <th>Required</th>
                                  <th>Achievability</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cfResult.goalStatus.map(({goal,achievability,status,withdrawal},i)=>(
                                  <tr key={goal.id}>
                                    <td>{goal.goalName||`Goal ${i+1}`}</td>
                                    <td>{fmt(withdrawal)}</td>
                                    <td>{fmtPct(achievability)}</td>
                                    <td>
                                      <span className={status==="funded"?"status-funded":status==="partial"?"status-partial":"status-atrisk"}>
                                        {status==="funded"?"✓ Funded":status==="partial"?"◑ Partial":"✗ At Risk"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Risk flags CF */}
                          <div className="risk-flags">
                            {cfResult.goalStatus.some(g=>g.status==="atrisk") ? (
                              <div className="risk-flag danger">
                                <span className="risk-flag-icon">⚠</span>
                                <div className="risk-flag-text">
                                  <div className="risk-flag-title">Corpus Depletion Risk</div>
                                  <div className="risk-flag-desc">Corpus may run out before all goals are funded. Increase SIP or defer Lifestyle goals.</div>
                                </div>
                              </div>
                            ) : cfResult.goalStatus.some(g=>g.status==="partial") ? (
                              <div className="risk-flag warning">
                                <span className="risk-flag-icon">◉</span>
                                <div className="risk-flag-text">
                                  <div className="risk-flag-title">Partial Shortfall</div>
                                  <div className="risk-flag-desc">Some goals partially funded. Responsibility goals are prioritised.</div>
                                </div>
                              </div>
                            ) : (
                              <div className="risk-flag safe">
                                <span className="risk-flag-icon">✓</span>
                                <div className="risk-flag-text">
                                  <div className="risk-flag-title">All Goals Funded</div>
                                  <div className="risk-flag-desc">Corpus successfully services all goals in sequence.</div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="sensitivity-note">Results assume consistent returns. Actual market returns will vary.</div>
                        </>
                      ) : (
                        <div style={{padding:"2rem",textAlign:"center",color:"var(--ink3)",fontSize:"12px"}}>
                          Add goals with values and tenures to see cash flow analysis.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CHART 1 — Corpus Journey */}
                <div className="chart-panel">
                  <div className="chart-header">
                    <span className="chart-title">◈ Corpus Journey</span>
                    <div className="chart-legend">
                      <div className="legend-item"><div className="legend-line" style={{background:"#9a9088",opacity:0.6}}/> Invested</div>
                      {goalCalcs.filter(({calc})=>calc).map(({goal},i)=>(
                        <div className="legend-item" key={goal.id}>
                          <div className="legend-dot" style={{background:GOAL_COLORS[i%GOAL_COLORS.length].text}}/>
                          {goal.goalName||`Goal ${i+1}`}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="chart-scroll">
                    <CorpusChart
                      timelines={goalCalcs.filter(({calc})=>calc).map(({calc})=>calc.timeline)}
                      goalEvents={goalCalcs.filter(({calc})=>calc).map(({goal,calc},i)=>({
                        year: calc.years,
                        corpus: calc.timeline[calc.timeline.length-1]?.corpus||0,
                        name: goal.goalName||`Goal ${i+1}`
                      }))}
                    />
                  </div>
                </div>

                {/* CHART 2 — Glide Path */}
                <div className="chart-panel">
                  <div className="chart-header">
                    <span className="chart-title">◈ Asset Allocation Glide Path</span>
                    <div className="chart-legend">
                      <div className="legend-item"><div className="legend-dot" style={{background:"var(--life)"}}/> Growth</div>
                      <div className="legend-item"><div className="legend-line" style={{background:"var(--resp)"}} />&nbsp;Protection</div>
                    </div>
                  </div>
                  <div className="chart-scroll">
                    <GlideChart data={glideData}/>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
