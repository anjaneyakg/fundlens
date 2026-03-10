import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

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
    display: grid; grid-template-columns: 430px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }
  .left-col { display: flex; flex-direction: column; gap: 1rem; }

  /* PANEL */
  .panel-shell {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; box-shadow: var(--shadow); overflow: visible;
  }
  .panel-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem; cursor: pointer; border-radius: 16px;
    transition: background 0.15s;
  }
  .panel-hdr:hover { background: var(--bg3); }
  .panel-hdr-left { display: flex; align-items: center; gap: 10px; }
  .panel-hdr-title { font-family: 'DM Mono'; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink); }
  .panel-hdr-sub { font-family: 'DM Mono'; font-size: 8px; color: var(--ink3); margin-top: 2px; letter-spacing: 0.5px; }
  .chevron { font-size: 10px; color: var(--ink3); transition: transform 0.2s; display: inline-block; }
  .chevron.open { transform: rotate(180deg); }
  .panel-body { padding: 1.25rem; border-top: 1px solid var(--border2); }

  /* ASSUMPTIONS */
  .assump-intro {
    font-size: 11px; color: var(--ink2); line-height: 1.55; margin-bottom: 1rem;
    padding: 8px 10px; background: var(--bg3); border-radius: 8px;
  }

  /* column header row */
  .assump-col-hdrs {
    display: grid; grid-template-columns: 90px 1fr 1fr 1fr 1fr;
    gap: 6px; margin-bottom: 4px;
  }
  .assump-col-hdr {
    font-family: 'DM Mono'; font-size: 7px; letter-spacing: 0.8px; text-transform: uppercase;
    color: var(--ink3); text-align: center; line-height: 1.3;
  }

  .horizon-row { margin-bottom: 12px; }
  .horizon-row-label {
    display: flex; align-items: center; gap: 7px;
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
    padding: 5px 9px; border-radius: 7px; margin-bottom: 6px;
  }
  .horizon-row-label.lt { background: var(--life-l); color: var(--life); }
  .horizon-row-label.mt { background: var(--amber-l); color: var(--amber); }
  .horizon-row-label.st { background: var(--resp-l); color: var(--resp); }
  .h-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

  .assump-inputs-row {
    display: grid; grid-template-columns: 90px 1fr 1fr 1fr 1fr;
    gap: 6px; align-items: center;
  }
  .port-ret-display {
    font-family: 'DM Mono'; font-weight: 500; font-size: 15px; text-align: center;
  }
  .assump-input {
    width: 100%; padding: 7px 6px; text-align: center;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 7px; font-family: 'DM Mono'; font-size: 12px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .assump-input:focus { border-color: var(--life); box-shadow: 0 0 0 2px var(--life-b); }
  .assump-input.warn { border-color: var(--amber); background: var(--amber-l); }
  .alloc-check {
    font-family: 'DM Mono'; font-size: 7.5px; text-align: right;
    margin-top: 3px; letter-spacing: 0.3px;
  }
  .alloc-check.ok  { color: var(--resp); }
  .alloc-check.err { color: var(--danger); }

  .port-returns-row {
    display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 12px;
  }
  .port-ret-card {
    background: var(--bg3); border-radius: 9px; padding: 8px 10px; text-align: center;
  }
  .port-ret-lbl { font-family: 'DM Mono'; font-size: 7px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 3px; }
  .port-ret-val { font-family: 'DM Mono'; font-size: 15px; font-weight: 500; }
  .port-ret-alloc { font-family: 'DM Mono'; font-size: 7.5px; color: var(--ink3); margin-top: 2px; }

  /* GOAL CARDS */
  .goals-section { display: flex; flex-direction: column; gap: 0.75rem; }
  .add-goal-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px; border-radius: 12px; border: 1.5px dashed var(--border);
    background: transparent; color: var(--ink2); cursor: pointer;
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.18s; width: 100%;
  }
  .add-goal-btn:hover { border-color: var(--life); color: var(--life); background: var(--life-l); }
  .add-goal-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .goal-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: var(--shadow); overflow: hidden;
  }
  .goal-card-hdr {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; cursor: pointer; transition: background 0.15s;
  }
  .goal-card-hdr:hover { background: var(--bg3); }
  .goal-num {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono'; font-size: 10px; font-weight: 500;
  }
  .goal-card-info { flex: 1; min-width: 0; }
  .goal-name-display {
    font-size: 13px; font-weight: 500; color: var(--ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .goal-badges { display: flex; gap: 5px; margin-top: 3px; flex-wrap: wrap; }
  .badge {
    font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 0.5px;
    text-transform: uppercase; padding: 2px 7px; border-radius: 10px;
  }
  .badge-resp   { background: var(--resp-l);  color: var(--resp);  border: 1px solid var(--resp-b); }
  .badge-life   { background: var(--life-l);  color: var(--life);  border: 1px solid var(--life-b); }
  .badge-neutral{ background: var(--bg3);     color: var(--ink3); }
  .badge-amber  { background: var(--amber-l); color: var(--amber); border: 1px solid var(--amber-b); }
  .goal-del-btn {
    width: 22px; height: 22px; border-radius: 50%; border: none;
    background: transparent; color: var(--ink3); cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 11px;
    transition: all 0.15s; flex-shrink: 0;
  }
  .goal-del-btn:hover { background: var(--danger-l); color: var(--danger); }

  .goal-card-body { padding: 14px; border-top: 1px solid var(--border2); }
  .gc-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .gc-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); }
  .gc-input {
    width: 100%; padding: 8px 10px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Sans'; font-size: 12.5px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .gc-input:focus { border-color: var(--life); box-shadow: 0 0 0 2px var(--life-b); }
  .gc-select {
    width: 100%; padding: 8px 28px 8px 10px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Mono'; font-size: 10px; color: var(--ink);
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9088'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    transition: border 0.15s;
  }
  .gc-select:focus { border-color: var(--life); }
  .gc-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .gc-divider { height: 1px; background: var(--border2); margin: 10px 0; }
  .gc-section { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink3); margin-bottom: 8px; }

  .pill-row { display: flex; background: var(--bg3); border-radius: 8px; padding: 3px; gap: 3px; margin-bottom: 10px; }
  .pill-btn {
    flex: 1; padding: 6px 6px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.4px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.15s; text-align: center;
  }
  .pill-btn.p-resp { background: var(--bg2); color: var(--resp); box-shadow: 0 1px 4px rgba(26,22,18,0.1); }
  .pill-btn.p-life { background: var(--bg2); color: var(--life); box-shadow: 0 1px 4px rgba(26,22,18,0.1); }
  .pill-btn.p-on   { background: var(--bg2); color: var(--ink);  box-shadow: 0 1px 4px rgba(26,22,18,0.1); }

  .sub-box { border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
  .sub-box.amber { background: var(--amber-l); border: 1px solid var(--amber-b); }
  .sub-box.blue  { background: var(--blue-l);  border: 1px solid rgba(44,95,138,0.18); }
  .sub-box.life  { background: var(--life-l);  border: 1px solid var(--life-b); }
  .sub-box-lbl { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
  .sub-box.amber .sub-box-lbl { color: var(--amber); }
  .sub-box.blue  .sub-box-lbl { color: var(--blue); }
  .sub-box.life  .sub-box-lbl { color: var(--life); }

  /* RESULTS */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }
  .empty-state {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 4rem 2rem; text-align: center; box-shadow: var(--shadow);
  }
  .empty-icon  { font-size: 3rem; margin-bottom: 1rem; opacity: 0.3; }
  .empty-title { font-family: 'Playfair Display'; font-size: 1.4rem; font-weight: 600; color: var(--ink); margin-bottom: 6px; }
  .empty-sub   { font-size: 13px; color: var(--ink2); line-height: 1.6; }

  .ap-panels { display: grid; gap: 1rem; }
  .ap-panel {
    border-radius: 16px; padding: 1.25rem;
    border: 1px solid var(--border); box-shadow: var(--shadow);
  }
  .ap-panel.gb { background: linear-gradient(145deg, var(--life-l), #fff); border-color: var(--life-b); }
  .ap-panel.cf { background: linear-gradient(145deg, var(--resp-l), #fff); border-color: var(--resp-b); }
  .ap-title    { font-family: 'Playfair Display'; font-size: 1.05rem; font-weight: 700; margin-bottom: 2px; }
  .ap-title.gb { color: var(--life); }
  .ap-title.cf { color: var(--resp); }
  .ap-desc     { font-size: 10.5px; color: var(--ink2); margin-bottom: 1rem; line-height: 1.5; }

  .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1rem; }
  .kpi-card { background: rgba(255,255,255,0.75); border-radius: 10px; padding: 10px 12px; }
  .kpi-lbl  { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
  .kpi-val  { font-family: 'Playfair Display'; font-size: 1.15rem; font-weight: 700; color: var(--ink); line-height: 1; }
  .kpi-sub  { font-size: 10px; color: var(--ink2); margin-top: 3px; }

  .res-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
  .res-table th {
    font-family: 'DM Mono'; font-size: 7px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--ink3); padding: 5px 7px; border-bottom: 1px solid var(--border); text-align: right;
  }
  .res-table th:first-child { text-align: left; }
  .res-table td {
    font-family: 'DM Mono'; font-size: 10px; padding: 7px 7px;
    border-bottom: 1px solid var(--border2); text-align: right; color: var(--ink);
  }
  .res-table td:first-child { text-align: left; font-family: 'DM Sans'; font-size: 11px; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .res-table tr:last-child td { border-bottom: none; }
  .s-funded { color: var(--safe);   font-weight: 500; }
  .s-partial { color: var(--amber); font-weight: 500; }
  .s-atrisk  { color: var(--danger);font-weight: 500; }

  .risk-flags { display: flex; flex-direction: column; gap: 7px; margin-bottom: 1rem; }
  .rflag {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 9px 11px; border-radius: 9px;
  }
  .rflag.safe   { background: var(--safe-l);   border: 1px solid var(--resp-b); }
  .rflag.warn   { background: var(--amber-l);  border: 1px solid var(--amber-b); }
  .rflag.danger { background: var(--danger-l); border: 1px solid rgba(184,64,64,0.2); }
  .rflag-icon  { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
  .rflag-title { font-family: 'DM Mono'; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .rflag.safe   .rflag-title { color: var(--safe); }
  .rflag.warn   .rflag-title { color: var(--amber); }
  .rflag.danger .rflag-title { color: var(--danger); }
  .rflag-desc { font-size: 10.5px; color: var(--ink2); line-height: 1.4; }

  .delay-strip {
    background: var(--bg3); border-radius: 9px; padding: 9px 12px;
    display: flex; align-items: center; gap: 9px; margin-bottom: 1rem;
    font-size: 11px; color: var(--ink2); line-height: 1.5;
  }
  .delay-strip strong { color: var(--danger); }

  .sense-note {
    font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink3);
    text-align: center; padding: 6px; letter-spacing: 0.5px;
    border-top: 1px solid var(--border2); margin-top: 4px;
  }

  .chart-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .chart-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px; }
  .chart-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink2); }
  .chart-legend { display: flex; gap: 12px; flex-wrap: wrap; }
  .leg-item { display: flex; align-items: center; gap: 5px; font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink2); }
  .leg-line { width: 16px; height: 3px; border-radius: 2px; }
  .leg-dot  { width: 8px;  height: 8px; border-radius: 50%; }
  .chart-scroll { overflow-x: auto; }
  .svg-chart { display: block; width: 100%; }

  .c6-nudge {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; box-shadow: var(--shadow); flex-wrap: wrap;
  }
  .c6-nudge-text { font-size: 12.5px; color: var(--ink2); line-height: 1.5; }
  .c6-nudge-text strong { color: var(--ink); }
  .c6-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: var(--life); color: white; text-decoration: none;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.18s; white-space: nowrap; flex-shrink: 0;
  }
  .c6-link:hover { opacity: 0.88; box-shadow: 0 4px 16px var(--life-b); }

  @media (max-width: 1024px) {
    .gs-body { grid-template-columns: 1fr; padding: 1rem; }
    .ap-panels { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 600px) {
    .gs-header { padding: 1.5rem 1rem 1rem; }
    .gs-body { padding: 0.75rem; gap: 0.875rem; }
    .panel-body { padding: 1rem; }
    .goal-card-body { padding: 1rem; }
    .assump-col-hdrs { grid-template-columns: 70px 1fr 1fr 1fr 1fr; }
    .assump-inputs-row { grid-template-columns: 70px 1fr 1fr 1fr 1fr; }
    .gc-row { grid-template-columns: 1fr; }
    .kpi-grid { grid-template-columns: 1fr 1fr; }
    .chart-panel { padding: 1rem; }
    .approach-bar { flex-wrap: wrap; }
  }
`;

// ─── DEFAULTS ──────────────────────────────────────────────────────────────────
// Per-horizon: both allocation AND return are independently editable
// Portfolio return = (growthAlloc/100 × growthReturn) + (debtAlloc/100 × debtReturn)
const DEFAULT_ASSUMP = {
  LT: { growthAlloc: 75, debtAlloc: 25, growthReturn: 15.0, debtReturn: 7.5 },
  MT: { growthAlloc: 55, debtAlloc: 45, growthReturn: 13.0, debtReturn: 7.0 },
  ST: { growthAlloc: 30, debtAlloc: 70, growthReturn: 10.0, debtReturn: 6.5 },
};

const GOAL_COLORS = [
  { bg:"#f0ebfa", text:"#6b4c9a", border:"rgba(107,76,154,0.3)" },
  { bg:"#eaf4ee", text:"#2d6a4f", border:"rgba(45,106,79,0.3)"  },
  { bg:"#fef6e4", text:"#c47a1e", border:"rgba(196,122,30,0.3)" },
  { bg:"#e8f0f8", text:"#2c5f8a", border:"rgba(44,95,138,0.3)"  },
  { bg:"#fdeaea", text:"#b84040", border:"rgba(184,64,64,0.3)"  },
  { bg:"#ede9e0", text:"#6b6358", border:"rgba(107,99,88,0.3)"  },
];
const FREQ_OPTS = ["Monthly","Quarterly","Half-Yearly","Annually","Multi-Year"];
const SIP_TYPES = ["Fixed","Step-Up","Lumpsum+SIP"];

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtPct = n => (n == null || isNaN(n)) ? "—" : `${n.toFixed(1)}%`;

// ─── MATH ENGINE ──────────────────────────────────────────────────────────────

// Calculated portfolio return for a horizon
// = (growthAlloc% × growthReturn%) + (debtAlloc% × debtReturn%)
function portReturn(assump, horizon) {
  const h = assump[horizon];
  return (h.growthAlloc / 100) * (h.growthReturn / 100)
       + (h.debtAlloc  / 100) * (h.debtReturn  / 100);
}

// Which horizon bucket a given years-to-goal falls into
function bucket(yrs) {
  return yrs > 7 ? "LT" : yrs >= 3 ? "MT" : "ST";
}

// Chained glide-path FV from today to goal date
// Split: first LT phase (years > 7), then MT (3-7), then ST (<3)
// Each phase uses its own portfolio return, compounded monthly
function chainedFV(pv, totalYears, assump) {
  if (totalYears <= 0) return pv;
  const ltYrs = Math.max(0, totalYears - 7);
  const mtYrs = Math.min(Math.max(0, totalYears - 3), 4);
  const stYrs = Math.min(totalYears, 3);

  let v = pv;
  if (ltYrs > 0) v *= Math.pow(1 + portReturn(assump,"LT") / 12, ltYrs * 12);
  if (mtYrs > 0) v *= Math.pow(1 + portReturn(assump,"MT") / 12, mtYrs * 12);
  if (stYrs > 0) v *= Math.pow(1 + portReturn(assump,"ST") / 12, stYrs * 12);
  return v;
}

// SIP required to accumulate `target` over `totalYears` using chained glide path
function sipRequired(target, totalYears, assump) {
  if (target <= 0 || totalYears <= 0) return 0;
  const ltYrs = Math.max(0, totalYears - 7);
  const mtYrs = Math.min(Math.max(0, totalYears - 3), 4);
  const stYrs = Math.min(totalYears, 3);

  const rLT = portReturn(assump,"LT") / 12;
  const rMT = portReturn(assump,"MT") / 12;
  const rST = portReturn(assump,"ST") / 12;

  const ltM = Math.round(ltYrs * 12);
  const mtM = Math.round(mtYrs * 12);
  const stM = Math.round(stYrs * 12);

  // FV of a ₹1/mo SIP run for n months at rate r
  const fvUnit = (r, n) => n <= 0 ? 0 : r > 0 ? (Math.pow(1+r,n)-1)/r : n;

  // Each phase's SIP contributions grow through all subsequent phases to goal date
  const unitLT = fvUnit(rLT, ltM) * Math.pow(1+rMT, mtM) * Math.pow(1+rST, stM);
  const unitMT = fvUnit(rMT, mtM) * Math.pow(1+rST, stM);
  const unitST = fvUnit(rST, stM);

  const totalUnit = unitLT + unitMT + unitST;
  return totalUnit > 0 ? target / totalUnit : target / Math.max(1, ltM+mtM+stM);
}

// Corpus from a given monthly SIP over totalYears (inverse of sipRequired)
function sipToCorpus(sip, totalYears, assump) {
  if (sip <= 0 || totalYears <= 0) return 0;
  const req = sipRequired(1, totalYears, assump);
  return req > 0 ? sip / req : 0;
}

// Year-by-year timeline for chart
function buildTimeline(sip, totalYears, existingCorpus, assump) {
  const rows = [];
  const years = Math.ceil(totalYears);
  for (let y = 0; y <= years; y++) {
    const t = Math.min(y, totalYears);
    const fromSIP  = sipToCorpus(sip, t, assump);
    const fromSaved= chainedFV(existingCorpus, t, assump);
    rows.push({ year: y, corpus: fromSIP + fromSaved, invested: sip * Math.round(t*12) + existingCorpus });
  }
  return rows;
}

// ── MULTIPLE CASH-FLOW: compute total PV of outflow stream ──────────────────
// Returns the single lump-sum equivalent (in future-value terms at goal date)
// of all outflows defined by the multiple CF configuration.
//
// Approach: enumerate each payment, inflate it from the base date,
// then compound it forward to the goal (tenure) date so every payment
// is expressed in the same "corpus needed at goal date" unit.
function multiCFTotal(goal, assump) {
  const baseFV    = parseFloat(goal.goalValue)    || 0;  // first payment base
  const tenureYrs = parseFloat(goal.tenureYears)  || 0;
  const endYr     = Math.min(parseFloat(goal.multiEndYear) || tenureYrs, tenureYrs);
  const inf       = (parseFloat(goal.inflationRate) || 0) / 100;
  const changeType= goal.multiChangeType;   // "inflation" | "defined" | "fixed"
  const changePct = (parseFloat(goal.multiChangePct) || 0) / 100;
  const changeAmt = parseFloat(goal.multiChangePct) || 0; // reused for fixed-amt

  if (baseFV <= 0 || tenureYrs <= 0 || endYr <= 0) return 0;

  // Build list of payment year points based on frequency
  const freq = goal.multiFreq;
  const payYears = [];
  let step = freq === "Monthly"     ? 1/12
           : freq === "Quarterly"   ? 0.25
           : freq === "Half-Yearly" ? 0.5
           : freq === "Annually"    ? 1
           : freq === "Multi-Year"  ? (parseFloat(goal.multiEndYear) > tenureYrs/2
                                        ? tenureYrs / 2 : tenureYrs / 3)
           : 1;
  step = Math.max(1/12, step);
  for (let y = tenureYrs; y <= endYr + 0.001; y += step) {
    payYears.push(parseFloat(y.toFixed(4)));
  }
  if (payYears.length === 0) payYears.push(tenureYrs);

  // Value at today's price for the first payment, then escalate
  const baseToday = goal.valueType === "today"
    ? baseFV
    : baseFV / Math.pow(1 + inf, tenureYrs);   // deflate future price back to today

  let total = 0;
  payYears.forEach((yr, i) => {
    // Payment amount: escalate from first payment
    let payAmt;
    if (i === 0) {
      // First payment: inflate base to payment year
      payAmt = baseToday * Math.pow(1 + inf, yr);
    } else {
      // Subsequent: apply change rule from previous payment
      const prevPay = (() => {
        const prevYr = payYears[i-1];
        const prevBase = baseToday * Math.pow(1 + inf, prevYr);
        return prevBase; // simplified — escalation applied below
      })();
      if (changeType === "inflation") {
        payAmt = baseToday * Math.pow(1 + inf, yr);
      } else if (changeType === "defined") {
        // Each subsequent payment escalates by changePct from previous
        payAmt = baseToday * Math.pow(1 + inf, payYears[0]) * Math.pow(1 + changePct, i);
      } else {
        // Fixed-amount: base + i × changeAmt (in today's value, inflated)
        payAmt = (baseToday + i * changeAmt) * Math.pow(1 + inf, yr);
      }
    }

    // Express this payment as "corpus needed NOW (at yr=0) to fund it"
    // = payAmt discounted back at portfolio return, then we sum all PVs
    // and treat the total as the effective single goal value
    const yrsToGoal = yr - tenureYrs; // 0 for first, positive for later payments
    // Payments after goal date need extra corpus; payments at goal date are face value.
    // We convert everything to: "how much corpus at the START (yr=0) do I need?"
    // = chainedFV inverse (PV) = payAmt / chainedFVFactor(yr)
    const fvFactor = chainedFV(1, yr, assump);
    if (fvFactor > 0) total += payAmt / fvFactor;
  });

  // total is now PV at yr=0 of all payments.
  // Convert to FV at goal date (tenureYrs) so it's compatible with selfFunded logic.
  return chainedFV(total, tenureYrs, assump);
}

// Per-goal result
function calcGoal(goal, assump) {
  const years   = parseFloat(goal.tenureYears) || 0;
  const rawVal  = parseFloat(goal.goalValue)   || 0;
  const inf     = (parseFloat(goal.inflationRate) || 0) / 100;
  const loan    = goal.hasLoan ? (parseFloat(goal.loanAmount) || 0) : 0;
  const existing= parseFloat(goal.existingCorpus) || 0;
  if (rawVal <= 0 || years <= 0) return null;

  // Effective future goal value — single or multiple cash flow
  let futureVal;
  if (goal.cashFlowType === "multiple") {
    futureVal = multiCFTotal(goal, assump);
    if (futureVal <= 0) {
      // Fallback: treat as single outflow if multi CF not properly configured
      futureVal = goal.valueType === "today" ? rawVal * Math.pow(1+inf, years) : rawVal;
    }
  } else {
    futureVal = goal.valueType === "today" ? rawVal * Math.pow(1+inf, years) : rawVal;
  }

  const selfFunded   = Math.max(0, futureVal - loan);
  const existingGrown= chainedFV(existing, years, assump);
  const target       = Math.max(0, selfFunded - existingGrown);

  let sipReq = 0;
  if (goal.sipType === "Fixed") {
    sipReq = sipRequired(target, years, assump);
  } else if (goal.sipType === "Step-Up") {
    const step = (parseFloat(goal.stepUpPct) || 10) / 100;
    sipReq = sipRequired(target, years, assump) / (1 + step / 2);
  } else {
    const lump      = parseFloat(goal.lumpsumAmt) || 0;
    const lumpGrown = chainedFV(lump, years, assump);
    sipReq = sipRequired(Math.max(0, target - lumpGrown), years, assump);
  }

  const userSIP = parseFloat(goal.fixedSIPAmt) || 0;
  let achievability = null;
  if (userSIP > 0) {
    const achieved = sipToCorpus(userSIP, years, assump) + existingGrown;
    achievability = Math.min(100, (achieved / selfFunded) * 100);
  }

  const sipDelayed  = sipRequired(target, Math.max(0.1, years - 1), assump);
  const costOfDelay = Math.max(0, sipDelayed - sipReq);
  const timeline    = buildTimeline(sipReq, years, existing, assump);

  // For display: breakdown of CF payments if multiple
  const cfBreakdown = goal.cashFlowType === "multiple" ? (() => {
    const endYr  = Math.min(parseFloat(goal.multiEndYear) || years, years + 10);
    const inf2   = (parseFloat(goal.inflationRate) || 0) / 100;
    const baseToday = goal.valueType === "today"
      ? rawVal
      : rawVal / Math.pow(1 + inf2, years);
    const freq = goal.multiFreq;
    let step = freq==="Monthly"?1/12:freq==="Quarterly"?.25:freq==="Half-Yearly"?.5:freq==="Multi-Year"?Math.max(1,years/3):1;
    step = Math.max(1/12, step);
    const payments = [];
    for (let y = years; y <= endYr + 0.001 && payments.length < 12; y += step) {
      const yr = parseFloat(y.toFixed(4));
      const i  = payments.length;
      let amt;
      if (goal.multiChangeType === "inflation")     amt = baseToday * Math.pow(1+inf2, yr);
      else if (goal.multiChangeType === "defined")  amt = baseToday * Math.pow(1+inf2, years) * Math.pow(1+(parseFloat(goal.multiChangePct)||0)/100, i);
      else                                           amt = (baseToday + i * (parseFloat(goal.multiChangePct)||0)) * Math.pow(1+inf2, yr);
      payments.push({ year: yr, amount: amt });
    }
    return payments;
  })() : null;

  return { futureVal, selfFunded, target, sipReq, achievability, costOfDelay, timeline, years, cfBreakdown };
}

// ── Simulate corpus month-by-month with CHAINED glide-path rates ─────────────
// Used by both the binary search and the status simulation in calcCashFlow.
// This replicates exactly the same chained compounding logic as sipRequired,
// ensuring CF-based SIP equals GB SIP when there is only one goal.
function simulateCorpus(monthlySIP, goalMonths, startCorpus, assump) {
  // We track years-to-goal for each month to pick the correct horizon bucket.
  // Total horizon = goalMonths / 12.
  const totalYrs = goalMonths / 12;
  let corpus = startCorpus;
  for (let m = 1; m <= goalMonths; m++) {
    const yrsToGoal = (goalMonths - m) / 12;
    const h = bucket(yrsToGoal);
    const r = portReturn(assump, h) / 12;
    corpus = corpus * (1 + r) + monthlySIP;
  }
  return corpus;
}

// Cash-flow based unified corpus (binary search with correct chained simulation)
function calcCashFlow(goals, assump) {
  const valid = goals
    .map((g, i) => ({ ...g, _i: i, _calc: calcGoal(g, assump) }))
    .filter(g => g._calc)
    .sort((a, b) => {
      if (a.goalType !== b.goalType) return a.goalType === "responsibility" ? -1 : 1;
      return (parseFloat(a.tenureYears)||0) - (parseFloat(b.tenureYears)||0);
    });
  if (!valid.length) return null;

  // Run a full chained simulation from month 0 to last goal,
  // growing corpus with per-month horizon-correct rate, withdrawing at each goal date.
  const maxM = Math.round(Math.max(...valid.map(g => parseFloat(g.tenureYears)||0)) * 12);

  // Build withdrawal schedule
  const withdrawals = valid.map(g => ({
    month:  Math.round((parseFloat(g.tenureYears)||0) * 12),
    amount: g._calc.selfFunded,
  }));

  const simulate = (sip) => {
    let corpus = 0;
    let ok = true;
    for (let m = 1; m <= maxM; m++) {
      // yrsToGoal of the LAST goal gives overall horizon for glide path
      // but each month we use years remaining to the NEAREST future goal
      const nextGoalM = withdrawals.find(w => w.month >= m)?.month ?? maxM;
      const yrsToNext = (nextGoalM - m) / 12;
      const h = bucket(yrsToNext);
      const r = portReturn(assump, h) / 12;
      corpus = corpus * (1 + r) + sip;
      const wd = withdrawals.find(w => w.month === m);
      if (wd) {
        corpus -= wd.amount;
        if (corpus < 0) { ok = false; corpus = 0; }
      }
    }
    return { corpus, ok };
  };

  // Binary search
  let lo = 0, hi = 2000000;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    simulate(mid).ok ? hi = mid : lo = mid;
  }
  const cfSIP = (lo + hi) / 2;

  // Per-goal status: re-simulate, capturing corpus just before each withdrawal
  const goalStatus = (() => {
    let corpus = 0;
    return valid.map(g => {
      const gM = Math.round((parseFloat(g.tenureYears)||0) * 12);
      const prevM = valid.indexOf(g) === 0 ? 0
        : Math.round((parseFloat(valid[valid.indexOf(g)-1].tenureYears)||0) * 12);
      // Grow from prevM to gM
      for (let m = prevM + 1; m <= gM; m++) {
        const nextGoalM = withdrawals.find(w => w.month >= m)?.month ?? maxM;
        const h = bucket((nextGoalM - m) / 12);
        const r = portReturn(assump, h) / 12;
        corpus = corpus * (1 + r) + cfSIP;
      }
      const ach    = Math.min(100, (corpus / g._calc.selfFunded) * 100);
      const status = ach >= 99 ? "funded" : ach >= 70 ? "partial" : "atrisk";
      corpus = Math.max(0, corpus - g._calc.selfFunded);
      return { goal: g, achievability: ach, status, withdrawal: g._calc.selfFunded };
    });
  })();

  // CF timeline for chart — month-by-month, record yearly
  const cfTimeline = (() => {
    let corpus = 0;
    const rows = [{ year: 0, corpus: 0, invested: 0 }];
    for (let m = 1; m <= maxM; m++) {
      const nextGoalM = withdrawals.find(w => w.month >= m)?.month ?? maxM;
      const h = bucket((nextGoalM - m) / 12);
      const r = portReturn(assump, h) / 12;
      corpus = corpus * (1 + r) + cfSIP;
      const wd = withdrawals.find(w => w.month === m);
      if (wd) corpus = Math.max(0, corpus - wd.amount);
      if (m % 12 === 0) rows.push({ year: m/12, corpus, invested: cfSIP*m });
    }
    return rows;
  })();

  const gbTotal = valid.reduce((s,g) => s + (g._calc?.sipReq||0), 0);
  return { cfSIP, goalStatus, cfTimeline, saving: Math.max(0, gbTotal - cfSIP) };
}

// Glide path allocation for each year (allocation shifts by horizon bucket)
function buildGlidePath(totalYears, assump) {
  const pts = [];
  for (let y = 0; y <= Math.ceil(totalYears); y++) {
    const yToGoal = totalYears - y;
    const h = bucket(yToGoal);
    pts.push({ year: y, growthPct: assump[h].growthAlloc, debtPct: assump[h].debtAlloc, horizon: h });
  }
  return pts;
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────
function CorpusChart({ timelines, goalEvents }) {
  if (!timelines?.length) return null;
  const W=580, H=190, PL=62, PR=20, PT=12, PB=32;
  const iW=W-PL-PR, iH=H-PT-PB;
  const allV  = timelines.flatMap(t=>t.map(d=>d.corpus));
  const maxV  = Math.max(...allV, 1);
  const maxYr = Math.max(...timelines.flatMap(t=>t.map(d=>d.year)), 1);
  const xS = y => PL + (y/maxYr)*iW;
  const yS = v => PT + iH - (Math.min(v,maxV)/maxV)*iH;
  const mkPath = (arr, key) => arr.map((d,i)=>`${i===0?"M":"L"}${xS(d.year)},${yS(d[key])}`).join(" ");
  const COLS = GOAL_COLORS.map(c=>c.text);
  const yTicks = [0, maxV*0.5, maxV];
  const step   = Math.max(1, Math.floor(maxYr/5));
  const xTicks = Array.from({length:Math.ceil(maxYr)+1},(_,i)=>i).filter(y=>y%step===0||y===Math.ceil(maxYr));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      {yTicks.map((v,i)=>(
        <g key={i}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="rgba(26,22,18,0.06)" strokeWidth="1"/>
          <text x={PL-5} y={yS(v)+3} fill="#9a9088" fontSize="8" textAnchor="end" fontFamily="DM Mono">{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map((y,i)=>(
        <text key={i} x={xS(y)} y={H-PB+13} fill="#9a9088" fontSize="8" textAnchor="middle" fontFamily="DM Mono">Y{y}</text>
      ))}
      {timelines[0] && (
        <path d={mkPath(timelines[0],"invested")} fill="none" stroke="#9a9088" strokeWidth="1.5" strokeDasharray="4 3"/>
      )}
      {timelines.map((t,i)=>(
        <path key={i} d={mkPath(t,"corpus")} fill="none" stroke={COLS[i%COLS.length]} strokeWidth="2.2" strokeLinecap="round"/>
      ))}
      {goalEvents?.map((e,i)=>(
        <g key={i}>
          <line x1={xS(e.year)} y1={PT} x2={xS(e.year)} y2={H-PB}
            stroke={COLS[i%COLS.length]} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"/>
          <circle cx={xS(e.year)} cy={yS(e.corpus)} r="3.5"
            fill={COLS[i%COLS.length]} stroke="white" strokeWidth="1.5"/>
        </g>
      ))}
    </svg>
  );
}

function GlideChart({ data }) {
  if (!data || data.length < 2) return null;
  const W=580, H=150, PL=42, PR=16, PT=10, PB=28;
  const iW=W-PL-PR, iH=H-PT-PB;
  const maxYr = data[data.length-1].year || 1;
  const xS = y => PL + (y/maxYr)*iW;
  const yS = v => PT + iH - (v/100)*iH;
  const gPath = data.map((d,i)=>`${i===0?"M":"L"}${xS(d.year)},${yS(d.growthPct)}`).join(" ");
  const dPath = data.map((d,i)=>`${i===0?"M":"L"}${xS(d.year)},${yS(d.debtPct)}`).join(" ");
  const areaG = `${gPath} L${xS(maxYr)},${H-PB} L${PL},${H-PB} Z`;

  // Shade bands by horizon
  const bandColor = { LT:"rgba(107,76,154,0.06)", MT:"rgba(196,122,30,0.06)", ST:"rgba(45,106,79,0.06)" };
  const bands = [];
  let cur = null, curX = PL;
  data.forEach((d,i) => {
    if (d.horizon !== cur) {
      if (cur) bands.push({ h: cur, x1: curX, x2: xS(d.year) });
      curX = xS(d.year); cur = d.horizon;
    }
    if (i === data.length-1) bands.push({ h: cur, x1: curX, x2: xS(d.year) });
  });

  const xStep = Math.max(1, Math.floor(data.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="gp-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4c9a" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#6b4c9a" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {bands.map((b,i)=>(
        <rect key={i} x={b.x1} y={PT} width={Math.max(0,b.x2-b.x1)} height={iH} fill={bandColor[b.h]||"transparent"}/>
      ))}
      {[0,25,50,75,100].map((v,i)=>(
        <g key={i}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="rgba(26,22,18,0.06)" strokeWidth="1"/>
          <text x={PL-4} y={yS(v)+3} fill="#9a9088" fontSize="7.5" textAnchor="end" fontFamily="DM Mono">{v}%</text>
        </g>
      ))}
      <path d={areaG} fill="url(#gp-g)"/>
      <path d={gPath} fill="none" stroke="#6b4c9a" strokeWidth="2.2" strokeLinecap="round"/>
      <path d={dPath} fill="none" stroke="#2d6a4f" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/>
      {data.filter((_,i)=>i%xStep===0||i===data.length-1).map((d,i)=>(
        <text key={i} x={xS(d.year)} y={H-PB+13} fill="#9a9088" fontSize="7.5" textAnchor="middle" fontFamily="DM Mono">Y{d.year}</text>
      ))}
      {bands.map((b,i)=>(
        <text key={`lbl-${i}`} x={(b.x1+b.x2)/2} y={PT+10}
          fill={b.h==="LT"?"#6b4c9a":b.h==="MT"?"#c47a1e":"#2d6a4f"}
          fontSize="7" textAnchor="middle" fontFamily="DM Mono" opacity="0.8">{b.h}</text>
      ))}
    </svg>
  );
}

// ─── GOAL FACTORY ─────────────────────────────────────────────────────────────
let _gid = 0;
const newGoal = () => ({
  id: ++_gid,
  goalName:"", goalType:"responsibility",
  cashFlowType:"single", valueType:"today",
  goalValue:"", tenureYears:"", inflationRate:"6",
  hasLoan:false, loanAmount:"",
  existingCorpus:"",
  sipType:"Fixed", stepUpPct:"10", lumpsumAmt:"", fixedSIPAmt:"",
  multiFreq:"Annually", multiChangeType:"inflation", multiChangePct:"", multiEndYear:"",
  open:true,
});

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function GoalSIP() {
  const [assump,     setAssump]     = useState(DEFAULT_ASSUMP);
  const [assumpOpen, setAssumpOpen] = useState(false);
  const [goals,      setGoals]      = useState([newGoal()]);
  const [viewMode,   setViewMode]   = useState("both");

  // Assumption update — auto-balance allocations to 100%
  const updateAssump = (horizon, key, val) => {
    const v = parseFloat(val);
    if (isNaN(v)) return;
    setAssump(a => {
      const h = { ...a[horizon], [key]: Math.max(0, v) };
      if (key === "growthAlloc") h.debtAlloc   = Math.max(0, Math.round((100 - h.growthAlloc) * 10) / 10);
      if (key === "debtAlloc")   h.growthAlloc = Math.max(0, Math.round((100 - h.debtAlloc)   * 10) / 10);
      return { ...a, [horizon]: h };
    });
  };

  const addGoal    = () => { if (goals.length < 6) setGoals(gs => [...gs, newGoal()]); };
  const removeGoal = id  => setGoals(gs => gs.filter(g => g.id !== id));
  const updateGoal = (id, key, val) => setGoals(gs => gs.map(g => g.id===id ? {...g,[key]:val} : g));
  const toggleGoal = id  => setGoals(gs => gs.map(g => g.id===id ? {...g,open:!g.open} : g));

  const goalCalcs = useMemo(()=>
    goals.map(g => ({ goal:g, calc:calcGoal(g,assump) })),
    [goals, assump]
  );

  const cfResult = useMemo(()=>{
    if (!goalCalcs.some(({calc})=>calc)) return null;
    return calcCashFlow(goals, assump);
  }, [goals, assump]);

  const hasResults  = goalCalcs.some(({calc})=>calc);
  const totalSIP_GB = goalCalcs.reduce((s,{calc})=>s+(calc?.sipReq||0), 0);
  const maxYears    = Math.max(...goals.map(g=>parseFloat(g.tenureYears)||0), 1);
  const glideData   = useMemo(()=>buildGlidePath(maxYears, assump), [maxYears, assump]);

  // Calculated portfolio returns (displayed in assumptions panel header)
  const portRets = {
    LT: (portReturn(assump,"LT")*100).toFixed(2),
    MT: (portReturn(assump,"MT")*100).toFixed(2),
    ST: (portReturn(assump,"ST")*100).toFixed(2),
  };

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
              Plan up to 6 life goals with a unified corpus or independent SIPs.
              Glide-path allocation, cash-flow sequencing, inflation-adjusted projections.
            </p>
          </div>
          <div className="approach-bar">
            <span className="approach-label">View</span>
            <div className="approach-toggle">
              {[["gb","Goal-Based"],["cf","Cash Flow"],["both","Both"]].map(([v,l])=>(
                <button key={v} className={`ap-btn ${viewMode===v?"active":""}`} onClick={()=>setViewMode(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="gs-body">

          {/* ── LEFT COLUMN ── */}
          <div className="left-col">

            {/* GOAL CARDS */}
            <div className="goals-section">
              {goals.map((goal, idx) => {
                const col  = GOAL_COLORS[idx % GOAL_COLORS.length];
                const calc = goalCalcs[idx]?.calc;
                return (
                  <div className="goal-card" key={goal.id}>
                    <div className="goal-card-hdr" onClick={()=>toggleGoal(goal.id)}>
                      <div className="goal-num" style={{background:col.bg,color:col.text,border:`1px solid ${col.border}`}}>
                        {idx+1}
                      </div>
                      <div className="goal-card-info">
                        <div className="goal-name-display">{goal.goalName||`Goal ${idx+1}`}</div>
                        <div className="goal-badges">
                          <span className={`badge ${goal.goalType==="responsibility"?"badge-resp":"badge-life"}`}>
                            {goal.goalType==="responsibility"?"⚑ Responsibility":"✦ Lifestyle"}
                          </span>
                          <span className={`badge ${goal.cashFlowType==="single"?"badge-neutral":"badge-amber"}`}>
                            {goal.cashFlowType==="single"?"Single CF":"Multi CF"}
                          </span>
                          {calc && (
                            <span className="badge" style={{background:col.bg,color:col.text,border:`1px solid ${col.border}`}}>
                              {fmt(calc.sipReq)}/mo
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                        <button className="goal-del-btn" onClick={e=>{e.stopPropagation();removeGoal(goal.id);}}>✕</button>
                        <span className={`chevron ${goal.open?"open":""}`}>▾</span>
                      </div>
                    </div>

                    {goal.open && (
                      <div className="goal-card-body">

                        {/* Name */}
                        <div className="gc-field">
                          <label className="gc-label">Goal Name</label>
                          <input className="gc-input" placeholder="e.g. Child's Higher Education"
                            value={goal.goalName} onChange={e=>updateGoal(goal.id,"goalName",e.target.value)}/>
                        </div>

                        {/* Goal type */}
                        <div className="gc-section">Goal Type</div>
                        <div className="pill-row">
                          <button className={`pill-btn ${goal.goalType==="responsibility"?"p-resp":""}`}
                            onClick={()=>updateGoal(goal.id,"goalType","responsibility")}>⚑ Responsibility</button>
                          <button className={`pill-btn ${goal.goalType==="lifestyle"?"p-life":""}`}
                            onClick={()=>updateGoal(goal.id,"goalType","lifestyle")}>✦ Lifestyle</button>
                        </div>

                        {/* Cash flow */}
                        <div className="gc-section">Cash Flow Type</div>
                        <div className="pill-row">
                          <button className={`pill-btn ${goal.cashFlowType==="single"?"p-on":""}`}
                            onClick={()=>updateGoal(goal.id,"cashFlowType","single")}>Single Outflow</button>
                          <button className={`pill-btn ${goal.cashFlowType==="multiple"?"p-on":""}`}
                            onClick={()=>updateGoal(goal.id,"cashFlowType","multiple")}>Multiple Outflows</button>
                        </div>

                        {goal.cashFlowType==="multiple" && (
                          <div className="sub-box amber">
                            <div className="sub-box-lbl">Multiple CF Config</div>
                            <div className="gc-row" style={{marginBottom:"8px"}}>
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
                                  <option value="defined">Defined Rate %</option>
                                  <option value="fixed">Fixed Amount</option>
                                </select>
                              </div>
                            </div>
                            <div className="gc-row">
                              {goal.multiChangeType!=="inflation" && (
                                <div className="gc-field">
                                  <label className="gc-label">{goal.multiChangeType==="defined"?"Rate %":"Amt (₹)"}</label>
                                  <input type="number" className="gc-input" value={goal.multiChangePct}
                                    onChange={e=>updateGoal(goal.id,"multiChangePct",e.target.value)} placeholder="5"/>
                                </div>
                              )}
                              <div className="gc-field">
                                <label className="gc-label">End Year</label>
                                <input type="number" className="gc-input" value={goal.multiEndYear}
                                  onChange={e=>updateGoal(goal.id,"multiEndYear",e.target.value)} placeholder="20"/>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Goal value */}
                        <div className="gc-section">Goal Value</div>
                        <div className="pill-row">
                          <button className={`pill-btn ${goal.valueType==="today"?"p-on":""}`}
                            onClick={()=>updateGoal(goal.id,"valueType","today")}>Today's Price</button>
                          <button className={`pill-btn ${goal.valueType==="future"?"p-on":""}`}
                            onClick={()=>updateGoal(goal.id,"valueType","future")}>Future Price</button>
                        </div>
                        <div className="gc-row" style={{marginBottom:"10px"}}>
                          <div className="gc-field">
                            <label className="gc-label">Amount (₹)</label>
                            <input type="number" className="gc-input" value={goal.goalValue}
                              placeholder="e.g. 2500000"
                              onChange={e=>updateGoal(goal.id,"goalValue",e.target.value)}/>
                          </div>
                          <div className="gc-field">
                            <label className="gc-label">Tenure (Years)</label>
                            <input type="number" className="gc-input" value={goal.tenureYears}
                              min="1" max="40" placeholder="e.g. 12"
                              onChange={e=>{
                                const v = parseFloat(e.target.value);
                                updateGoal(goal.id,"tenureYears", isNaN(v)||v<=0 ? "" : v);
                              }}/>
                          </div>
                        </div>
                        <div className="gc-row" style={{marginBottom:"10px"}}>
                          <div className="gc-field">
                            <label className="gc-label">Inflation Rate (%)</label>
                            <input type="number" className="gc-input" value={goal.inflationRate}
                              min="0" max="20" step="0.5"
                              onChange={e=>updateGoal(goal.id,"inflationRate",e.target.value)}/>
                          </div>
                          <div className="gc-field">
                            <label className="gc-label">Existing Corpus (₹)</label>
                            <input type="number" className="gc-input" value={goal.existingCorpus}
                              placeholder="0"
                              onChange={e=>updateGoal(goal.id,"existingCorpus",e.target.value)}/>
                          </div>
                        </div>

                        {/* Loan */}
                        <div className="gc-divider"/>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                          <span className="gc-section" style={{margin:0}}>Loan Provision</span>
                          <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontFamily:"DM Mono",fontSize:"9px",color:"var(--ink2)"}}>
                            <input type="checkbox" checked={goal.hasLoan}
                              onChange={e=>updateGoal(goal.id,"hasLoan",e.target.checked)}/>
                            Partially loan-funded
                          </label>
                        </div>
                        {goal.hasLoan && (
                          <div className="sub-box blue" style={{marginBottom:"10px"}}>
                            <div className="sub-box-lbl">Loan Amount (₹)</div>
                            <input type="number" className="gc-input" value={goal.loanAmount}
                              placeholder="Loan portion — SIP funds the rest"
                              onChange={e=>updateGoal(goal.id,"loanAmount",e.target.value)}/>
                          </div>
                        )}

                        {/* SIP Structure */}
                        <div className="gc-divider"/>
                        <div className="gc-section">SIP Structure</div>
                        <div className="pill-row">
                          {SIP_TYPES.map(t=>(
                            <button key={t} className={`pill-btn ${goal.sipType===t?"p-on":""}`}
                              onClick={()=>updateGoal(goal.id,"sipType",t)}>{t}</button>
                          ))}
                        </div>
                        <div className="sub-box life">
                          <div className="sub-box-lbl">{goal.sipType} Config</div>
                          {goal.sipType==="Fixed" && (
                            <div className="gc-field">
                              <label className="gc-label">Planned SIP (₹) — optional, for achievability %</label>
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
                                <label className="gc-label">Planned SIP (₹) — optional</label>
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
                                <label className="gc-label">Planned SIP (₹) — optional</label>
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

            {/* ── ASSUMPTIONS — collapsed at bottom ── */}
            <div className="panel-shell">
              <div className="panel-hdr" onClick={()=>setAssumpOpen(o=>!o)}>
                <div className="panel-hdr-left">
                  <span style={{fontSize:"13px"}}>⚙</span>
                  <div>
                    <div className="panel-hdr-title">Asset Class Assumptions</div>
                    <div className="panel-hdr-sub">
                      Portfolio returns · LT {portRets.LT}% · MT {portRets.MT}% · ST {portRets.ST}%
                    </div>
                  </div>
                </div>
                <span className={`chevron ${assumpOpen?"open":""}`}>▾</span>
              </div>

              {assumpOpen && (
                <div className="panel-body">
                  <div className="assump-intro">
                    Set allocation (Growth / Protection) and return assumptions independently for each horizon.
                    Allocations per row must sum to 100%. Portfolio return = weighted average of both asset classes.
                  </div>

                  {/* Column header row */}
                  <div className="assump-col-hdrs">
                    <div className="assump-col-hdr" style={{textAlign:"left"}}>Portfolio<br/>Return</div>
                    <div className="assump-col-hdr">Growth<br/>Alloc %</div>
                    <div className="assump-col-hdr">Debt<br/>Alloc %</div>
                    <div className="assump-col-hdr">Growth<br/>Return %</div>
                    <div className="assump-col-hdr">Debt<br/>Return %</div>
                  </div>

                  {[
                    {key:"LT", cls:"lt", label:"Long Term · > 7 yrs"},
                    {key:"MT", cls:"mt", label:"Medium Term · 3–7 yrs"},
                    {key:"ST", cls:"st", label:"Short Term · < 3 yrs"},
                  ].map(({key,cls,label})=>{
                    const h = assump[key];
                    const sumOk = Math.abs(h.growthAlloc + h.debtAlloc - 100) < 1;
                    const retColor = cls==="lt"?"var(--life)":cls==="mt"?"var(--amber)":"var(--resp)";
                    return (
                      <div className="horizon-row" key={key}>
                        <div className={`horizon-row-label ${cls}`}>
                          <span className="h-dot"/>{label}
                        </div>
                        <div className="assump-inputs-row">
                          {/* Calculated portfolio return */}
                          <div className="port-ret-display" style={{color:retColor}}>
                            {portRets[key]}%
                          </div>
                          {/* 4 editable inputs */}
                          {[
                            {k:"growthAlloc", warn:!sumOk},
                            {k:"debtAlloc",   warn:!sumOk},
                            {k:"growthReturn",warn:false},
                            {k:"debtReturn",  warn:false},
                          ].map(({k,warn})=>(
                            <input key={k} type="number"
                              className={`assump-input ${warn?"warn":""}`}
                              value={h[k]} min="0"
                              max={k.includes("Alloc")?"100":"30"} step="0.5"
                              onChange={e=>updateAssump(key,k,e.target.value)}/>
                          ))}
                        </div>
                        <div className={`alloc-check ${sumOk?"ok":"err"}`}>
                          {sumOk
                            ? `✓ ${h.growthAlloc}% Growth + ${h.debtAlloc}% Debt = 100%`
                            : `⚠ ${h.growthAlloc + h.debtAlloc}% — must equal 100%`
                          }
                        </div>
                      </div>
                    );
                  })}

                  {/* Summary strip */}
                  <div style={{fontFamily:"DM Mono",fontSize:"8px",letterSpacing:"2px",textTransform:"uppercase",color:"var(--ink3)",margin:"12px 0 8px"}}>
                    Blended Portfolio Returns
                  </div>
                  <div className="port-returns-row">
                    {[
                      {k:"LT",l:"Long Term",  c:"var(--life)"},
                      {k:"MT",l:"Medium Term",c:"var(--amber)"},
                      {k:"ST",l:"Short Term", c:"var(--resp)"},
                    ].map(({k,l,c})=>(
                      <div className="port-ret-card" key={k}>
                        <div className="port-ret-lbl">{l}</div>
                        <div className="port-ret-val" style={{color:c}}>{portRets[k]}%</div>
                        <div className="port-ret-alloc">{assump[k].growthAlloc}G · {assump[k].debtAlloc}D</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                {/* APPROACH PANELS */}
                <div className="ap-panels" style={{
                  gridTemplateColumns: viewMode==="both" ? "1fr 1fr" : "1fr"
                }}>

                  {/* GOAL-BASED */}
                  {(viewMode==="gb"||viewMode==="both") && (
                    <div className="ap-panel gb">
                      <div className="ap-title gb">Goal-Based Planning</div>
                      <div className="ap-desc">Each goal funded independently. Conservative — higher combined SIP.</div>
                      <div className="kpi-grid">
                        <div className="kpi-card">
                          <div className="kpi-lbl">Total Monthly SIP</div>
                          <div className="kpi-val" style={{color:"var(--life)",fontSize:"1.1rem"}}>{fmt(totalSIP_GB)}</div>
                          <div className="kpi-sub">{goalCalcs.filter(g=>g.calc).length} active goals</div>
                        </div>
                        <div className="kpi-card">
                          <div className="kpi-lbl">Total Future Value</div>
                          <div className="kpi-val" style={{fontSize:"1.1rem"}}>{fmt(goalCalcs.reduce((s,{calc})=>s+(calc?.futureVal||0),0))}</div>
                          <div className="kpi-sub">inflation-adjusted</div>
                        </div>
                      </div>
                      <div style={{overflowX:"auto"}}>
                        <table className="res-table">
                          <thead>
                            <tr><th>Goal</th><th>Future Val</th><th>Req. SIP</th><th>Achievability</th></tr>
                          </thead>
                          <tbody>
                            {goalCalcs.map(({goal,calc},i)=>calc?(
                              <tr key={goal.id}>
                                <td title={goal.goalName||`Goal ${i+1}`}>{goal.goalName||`Goal ${i+1}`}</td>
                                <td>{fmt(calc.futureVal)}</td>
                                <td style={{color:GOAL_COLORS[i%6].text,fontWeight:500}}>{fmt(calc.sipReq)}</td>
                                <td>{calc.achievability!=null?(
                                  <span className={calc.achievability>=99?"s-funded":calc.achievability>=70?"s-partial":"s-atrisk"}>
                                    {fmtPct(calc.achievability)}
                                  </span>
                                ):"—"}</td>
                              </tr>
                            ):null)}
                          </tbody>
                        </table>
                      </div>
                      {/* Multi-CF breakdown: show payment schedule for any multi-CF goal */}
                      {goalCalcs.some(({goal,calc})=>goal.cashFlowType==="multiple"&&calc?.cfBreakdown?.length) && (
                        <div style={{marginBottom:"1rem"}}>
                          {goalCalcs.filter(({goal,calc})=>goal.cashFlowType==="multiple"&&calc?.cfBreakdown?.length).map(({goal,calc},i)=>(
                            <div key={goal.id} style={{marginBottom:"8px"}}>
                              <div style={{fontFamily:"DM Mono",fontSize:"7.5px",letterSpacing:"1.5px",textTransform:"uppercase",color:"var(--amber)",marginBottom:"5px"}}>
                                ◈ {goal.goalName||`Goal ${i+1}`} — Payment Schedule ({goal.multiFreq})
                              </div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>
                                {calc.cfBreakdown.map((p,pi)=>(
                                  <div key={pi} style={{
                                    background:"var(--amber-l)",border:"1px solid var(--amber-b)",
                                    borderRadius:"7px",padding:"4px 8px",
                                    fontFamily:"DM Mono",fontSize:"9px",color:"var(--amber)",
                                    display:"flex",flexDirection:"column",alignItems:"center",gap:"1px"
                                  }}>
                                    <span style={{fontSize:"7px",opacity:0.7}}>Yr {p.year.toFixed(1)}</span>
                                    <span style={{fontWeight:500}}>{fmt(p.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{fontFamily:"DM Mono",fontSize:"7.5px",color:"var(--ink3)",marginTop:"4px"}}>
                                Total corpus required: {fmt(calc.futureVal)} · SIP: {fmt(calc.sipReq)}/mo
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="risk-flags">
                        {goalCalcs.some(({calc})=>calc?.achievability!=null&&calc.achievability<70) ? (
                          <div className="rflag danger"><span className="rflag-icon">⚠</span><div>
                            <div className="rflag-title">Shortfall Risk</div>
                            <div className="rflag-desc">One or more goals significantly underfunded at current SIP.</div>
                          </div></div>
                        ) : goalCalcs.some(({calc})=>calc?.achievability!=null&&calc.achievability<99) ? (
                          <div className="rflag warn"><span className="rflag-icon">◉</span><div>
                            <div className="rflag-title">Partial Funding</div>
                            <div className="rflag-desc">Some goals partially funded. Consider increasing SIP or tenure.</div>
                          </div></div>
                        ) : (
                          <div className="rflag safe"><span className="rflag-icon">✓</span><div>
                            <div className="rflag-title">On Track</div>
                            <div className="rflag-desc">All goals appear fully funded at the required SIP rate.</div>
                          </div></div>
                        )}
                      </div>
                      {goalCalcs.some(({calc})=>calc?.costOfDelay>0) && (
                        <div className="delay-strip">
                          <span>⏱</span>
                          <span>Delaying 1 year increases total SIP by <strong>
                            {fmt(goalCalcs.reduce((s,{calc})=>s+(calc?.costOfDelay||0),0))}/mo
                          </strong>.</span>
                        </div>
                      )}
                      <div className="sense-note">Results assume consistent returns. Actual market returns will vary.</div>
                    </div>
                  )}

                  {/* CASH FLOW */}
                  {(viewMode==="cf"||viewMode==="both") && (
                    <div className="ap-panel cf">
                      <div className="ap-title cf">Cash Flow-Based Planning</div>
                      <div className="ap-desc">Single corpus services all goals in sequence. Lower SIP, smarter compounding.</div>
                      {cfResult ? (
                        <>
                          <div className="kpi-grid">
                            <div className="kpi-card">
                              <div className="kpi-lbl">Combined SIP</div>
                              <div className="kpi-val" style={{color:"var(--resp)",fontSize:"1.1rem"}}>{fmt(cfResult.cfSIP)}</div>
                              <div className="kpi-sub">unified corpus</div>
                            </div>
                            <div className="kpi-card">
                              <div className="kpi-lbl">Saving vs Goal-Based</div>
                              <div className="kpi-val" style={{color:"var(--safe)",fontSize:"1.1rem"}}>{fmt(cfResult.saving)}</div>
                              <div className="kpi-sub">per month</div>
                            </div>
                          </div>
                          <div style={{overflowX:"auto"}}>
                            <table className="res-table">
                              <thead>
                                <tr><th>Goal</th><th>Required</th><th>Achievability</th><th>Status</th></tr>
                              </thead>
                              <tbody>
                                {cfResult.goalStatus.map(({goal,achievability,status,withdrawal},i)=>(
                                  <tr key={goal.id}>
                                    <td title={goal.goalName||`Goal ${i+1}`}>{goal.goalName||`Goal ${i+1}`}</td>
                                    <td>{fmt(withdrawal)}</td>
                                    <td>{fmtPct(achievability)}</td>
                                    <td><span className={status==="funded"?"s-funded":status==="partial"?"s-partial":"s-atrisk"}>
                                      {status==="funded"?"✓ Funded":status==="partial"?"◑ Partial":"✗ At Risk"}
                                    </span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="risk-flags">
                            {cfResult.goalStatus.some(g=>g.status==="atrisk") ? (
                              <div className="rflag danger"><span className="rflag-icon">⚠</span><div>
                                <div className="rflag-title">Corpus Depletion Risk</div>
                                <div className="rflag-desc">Corpus may run out before all goals are funded. Increase SIP or defer Lifestyle goals.</div>
                              </div></div>
                            ) : cfResult.goalStatus.some(g=>g.status==="partial") ? (
                              <div className="rflag warn"><span className="rflag-icon">◉</span><div>
                                <div className="rflag-title">Partial Shortfall</div>
                                <div className="rflag-desc">Some goals partially funded. Responsibility goals are prioritised first.</div>
                              </div></div>
                            ) : (
                              <div className="rflag safe"><span className="rflag-icon">✓</span><div>
                                <div className="rflag-title">All Goals Funded</div>
                                <div className="rflag-desc">Unified corpus successfully services all goals in sequence.</div>
                              </div></div>
                            )}
                          </div>
                          <div className="sense-note">Results assume consistent returns. Actual market returns will vary.</div>
                        </>
                      ) : (
                        <div style={{padding:"2rem",textAlign:"center",color:"var(--ink3)",fontSize:"12px"}}>
                          Complete goal details to see cash flow analysis.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CHART 1 — Corpus Journey */}
                <div className="chart-panel">
                  <div className="chart-hdr">
                    <span className="chart-title">◈ Corpus Growth Journey</span>
                    <div className="chart-legend">
                      <div className="leg-item"><div className="leg-line" style={{background:"#9a9088",opacity:0.7}}/> Invested</div>
                      {goalCalcs.filter(({calc})=>calc).map(({goal},i)=>(
                        <div className="leg-item" key={goal.id}>
                          <div className="leg-dot" style={{background:GOAL_COLORS[i%6].text}}/>
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
                        corpus: calc.timeline[calc.timeline.length-1]?.corpus || 0,
                        name: goal.goalName||`Goal ${i+1}`,
                      }))}
                    />
                  </div>
                </div>

                {/* CHART 2 — Glide Path */}
                <div className="chart-panel">
                  <div className="chart-hdr">
                    <span className="chart-title">◈ Asset Allocation Glide Path</span>
                    <div className="chart-legend">
                      <div className="leg-item"><div className="leg-dot" style={{background:"var(--life)"}}/> Growth</div>
                      <div className="leg-item"><div className="leg-line" style={{background:"var(--resp)"}}/> Protection</div>
                      <div className="leg-item"><div style={{width:10,height:10,background:"var(--life-l)",border:"1px solid var(--life-b)",borderRadius:2}}/> LT</div>
                      <div className="leg-item"><div style={{width:10,height:10,background:"var(--amber-l)",border:"1px solid var(--amber-b)",borderRadius:2}}/> MT</div>
                      <div className="leg-item"><div style={{width:10,height:10,background:"var(--resp-l)",border:"1px solid var(--resp-b)",borderRadius:2}}/> ST</div>
                    </div>
                  </div>
                  <div className="chart-scroll">
                    <GlideChart data={glideData}/>
                  </div>
                </div>

                {/* C6 nudge */}
                <div className="c6-nudge">
                  <div className="c6-nudge-text">
                    <strong>Planning a single goal?</strong> Use our focused single-goal calculator for a quicker, simpler view — no setup required.
                  </div>
                  <Link to="/goal-calculator" className="c6-link">Try C6 Single Goal →</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
