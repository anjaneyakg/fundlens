import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

// ─── DATA SOURCE ─────────────────────────────────────────────────────────────
// Main slim Gist — schemes list (~3MB), loaded on every page load
const DATA_URL      = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
const CATINDEX_URL  = "https://gist.githubusercontent.com/anjaneyakg/377985ac0904a27a0a328c0834faffda/raw/fundlens_category_index.json";
const NAVHIST_BASE  = "https://gist.githubusercontent.com/anjaneyakg/6f82d116b7067a8d13aa620e99aa783f/raw";
const RATIOS_URL    = "https://gist.githubusercontent.com/anjaneyakg/90d783d7de0ba4a67b53138dd922a552/raw/fundlens_ratios.json";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1000 ? `₹${(n/1000).toFixed(1)}K Cr` : `₹${n} Cr`;
const returnColor = (v) => v > 0 ? "#059669" : v < 0 ? "#e11d48" : "#6b72a0";
const riskColor = (r) => ({ "Low":"#059669","Moderate":"#d97706","High":"#ea580c","Very High":"#e11d48" }[r] || "#6b72a0");

const categorySlug = (category, plan) => {
  const slug = (category||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
  return `nav_${slug}_${(plan||"").toLowerCase()}.json`;
};

// Compute 1Y rolling returns from raw NAV history [{date,nav}]
const computeRolling1Y = (hist) => {
  if (!hist || hist.length < 50) return [];
  const result = [];
  for (let i = 0; i < hist.length; i++) {
    const current = hist[i];
    const targetDate = new Date(current.date);
    targetDate.setFullYear(targetDate.getFullYear() - 1);
    const targetStr = targetDate.toISOString().slice(0, 10);
    let lo = 0, hi = i - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (hist[mid].date >= targetStr) { found = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    if (found === -1) continue;
    const prior = hist[found];
    if (prior.nav > 0 && prior.date !== current.date) {
      result.push({ date: current.date, return: parseFloat(((current.nav / prior.nav - 1) * 100).toFixed(2)) });
    }
  }
  return result;
};

// Compute calendar year returns from NAV history array [{date,nav}]
// Returns { 2024: 12.4, 2023: -3.1, ... }
const calcYearReturns = (hist) => {
  if (!hist || hist.length < 2) return {};
  const byYear = {};
  for (const e of hist) {
    const y = e.date.slice(0,4);
    if (!byYear[y]) byYear[y] = { first: e, last: e };
    byYear[y].last = e;
    if (e.date < byYear[y].first.date) byYear[y].first = e;
  }
  const result = {};
  for (const [year, {first, last}] of Object.entries(byYear)) {
    if (first.nav > 0 && first.date !== last.date) {
      result[year] = parseFloat(((last.nav / first.nav - 1) * 100).toFixed(2));
    }
  }
  return result;
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #eef2ff;
    --surface: rgba(255,255,255,0.75);
    --surface2: rgba(255,255,255,0.55);
    --border: rgba(99,91,255,0.12);
    --border-glow: rgba(99,91,255,0.35);
    --violet: #635bff;
    --indigo: #4f46e5;
    --pink: #f43f8e;
    --orange: #ff6b35;
    --emerald: #059669;
    --red: #e11d48;
    --text: #0f0c2e;
    --muted: #6b72a0;
    --card-hover: rgba(255,255,255,0.92);
  }

  html, body, #root { height: 100%; color: var(--text); font-family: 'Syne', sans-serif; }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99,91,255,0.25); border-radius: 2px; }

  .app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 70% 60% at 0% 0%, rgba(99,91,255,0.22) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 100% 0%, rgba(244,63,142,0.18) 0%, transparent 50%),
      radial-gradient(ellipse 50% 60% at 50% 100%, rgba(255,107,53,0.14) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 80% 50%, rgba(79,70,229,0.10) 0%, transparent 50%),
      linear-gradient(160deg, #eef2ff 0%, #fdf2f8 40%, #fff7ed 100%);
  }

  /* NAV */
  .nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,0.72); /* kept for reference */
  }

  /* HERO */
  .hero {
    padding: 3rem 2rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  .hero-eyebrow {
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 3px;
    color: var(--violet); text-transform: uppercase; margin-bottom: 12px;
  }
  .hero-title {
    font-family: 'Bebas Neue'; font-size: clamp(3rem, 6vw, 5rem);
    line-height: 0.95; letter-spacing: 2px;
    background: linear-gradient(135deg, var(--indigo) 0%, var(--violet) 40%, var(--pink) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 1.5rem;
  }
  .hero-stats { display: flex; gap: 2rem; flex-wrap: wrap; }
  .hero-stat { display: flex; flex-direction: column; gap: 2px; }
  .hero-stat-val { font-family: 'Bebas Neue'; font-size: 1.6rem; color: var(--orange); letter-spacing: 1px; }
  .hero-stat-label { font-family: 'DM Mono'; font-size: 10px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }

  /* FILTERS BAR */
  .filters-bar {
    padding: 1.25rem 2rem;
    display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;
    border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.6);
    position: sticky; top: 60px; z-index: 90;
    backdrop-filter: blur(16px);
    box-shadow: 0 2px 12px rgba(99,91,255,0.05);
  }
  .search-wrap { position: relative; flex: 1; min-width: 220px; max-width: 380px; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 14px; }
  .search-input {
    width: 100%; padding: 9px 12px 9px 36px;
    background: rgba(255,255,255,0.9); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'DM Mono'; font-size: 13px;
    outline: none; transition: border 0.2s, box-shadow 0.2s;
    box-shadow: 0 1px 4px rgba(99,91,255,0.06);
  }
  .search-input:focus { border-color: var(--violet); box-shadow: 0 0 0 3px rgba(99,91,255,0.12); }
  .search-input::placeholder { color: var(--muted); }

  .filter-select {
    padding: 9px 12px;
    background: rgba(255,255,255,0.9); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'DM Mono'; font-size: 12px;
    outline: none; cursor: pointer; transition: border 0.2s;
    box-shadow: 0 1px 4px rgba(99,91,255,0.06);
  }
  .filter-select:focus { border-color: var(--violet); }

  .toggle-group { display: flex; background: rgba(255,255,255,0.9); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(99,91,255,0.06); }
  .toggle-btn {
    padding: 9px 16px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 12px; letter-spacing: 0.5px;
    background: transparent; color: var(--muted); transition: all 0.15s;
  }
  .toggle-btn.active { background: linear-gradient(135deg, var(--violet), var(--pink)); color: #fff; font-weight: 500; }

  .aum-filter { display: flex; align-items: center; gap: 8px; font-family: 'DM Mono'; font-size: 11px; color: var(--muted); }
  .aum-filter input[type=range] {
    -webkit-appearance: none; width: 100px; height: 3px;
    background: linear-gradient(to right, var(--violet) 0%, rgba(99,91,255,0.15) 0%);
    border-radius: 2px; outline: none;
  }
  .aum-filter input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 14px; height: 14px;
    background: var(--violet); border-radius: 50%; cursor: pointer;
    box-shadow: 0 2px 6px rgba(99,91,255,0.4);
  }

  .results-count { margin-left: auto; font-family: 'DM Mono'; font-size: 11px; color: var(--muted); white-space: nowrap; }
  .results-count span { color: var(--violet); font-weight: 600; }

  /* MAIN LAYOUT */
  .main { display: grid; grid-template-columns: 1fr 360px; gap: 0; min-height: calc(100vh - 64px); }

  /* SCHEME LIST */
  .scheme-list { padding: 1.5rem 2rem; border-right: 1px solid var(--border); }

  .sort-bar {
    display: grid;
    grid-template-columns: 2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr;
    gap: 0; margin-bottom: 1rem;
    font-family: 'DM Mono'; font-size: 10px; color: var(--muted);
    letter-spacing: 1px; text-transform: uppercase; padding: 0 12px;
  }
  .sort-btn { background: none; border: none; color: var(--muted); font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; text-align: right; padding: 0; }
  .sort-btn:hover { color: var(--violet); }
  .sort-btn.active { color: var(--orange); }

  .scheme-card {
    display: grid;
    grid-template-columns: 2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr;
    gap: 0; align-items: center;
    padding: 14px 12px; margin-bottom: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px; cursor: pointer;
    transition: all 0.15s;
    animation: slideIn 0.3s ease both;
    backdrop-filter: blur(8px);
    box-shadow: 0 1px 4px rgba(99,91,255,0.04);
  }
  @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  .scheme-card:hover { background: var(--card-hover); border-color: rgba(99,91,255,0.25); transform: translateX(2px); box-shadow: 0 4px 16px rgba(99,91,255,0.10); }
  .scheme-card.selected { border-color: var(--violet); background: rgba(99,91,255,0.06); box-shadow: 0 0 0 2px rgba(99,91,255,0.15), 0 4px 16px rgba(99,91,255,0.10); }

  .scheme-name-col { display: flex; flex-direction: column; gap: 4px; padding-right: 12px; }
  .scheme-name { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.3; }
  .scheme-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .tag {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.5px;
    padding: 2px 6px; border-radius: 3px; font-weight: 500; white-space: nowrap;
  }
  .tag-cat { background: rgba(255,107,53,0.1); color: var(--orange); border: 1px solid rgba(255,107,53,0.2); }
  .tag-plan-d { background: rgba(99,91,255,0.1); color: var(--violet); border: 1px solid rgba(99,91,255,0.2); }
  .tag-plan-r { background: rgba(107,114,160,0.08); color: var(--muted); border: 1px solid var(--border); }

  .ret-cell { text-align: right; font-family: 'DM Mono'; font-size: 12px; font-weight: 500; }
  .aum-cell { text-align: right; font-family: 'DM Mono'; font-size: 11px; color: var(--muted); }
  .risk-badge { text-align: right; font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.5px; }
  .stars { color: var(--orange); font-size: 10px; text-align: right; }

  /* PANEL */
  .detail-panel {
    padding: 1.5rem;
    position: sticky; top: 135px; height: calc(100vh - 135px);
    overflow-y: auto;
    background: rgba(255,255,255,0.5);
    backdrop-filter: blur(12px);
  }
  .panel-empty {
    height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px; color: var(--muted);
  }
  .panel-empty-icon { font-size: 3rem; opacity: 0.15; }
  .panel-empty-text { font-family: 'DM Mono'; font-size: 12px; letter-spacing: 1px; text-align: center; line-height: 1.8; }

  .panel-header { margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
  .panel-amc { font-family: 'DM Mono'; font-size: 10px; color: var(--violet); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
  .panel-name { font-family: 'Bebas Neue'; font-size: 1.6rem; letter-spacing: 1px; line-height: 1.1; color: var(--text); margin-bottom: 10px; }
  .panel-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .panel-nav-row { display: flex; justify-content: space-between; align-items: flex-end; }
  .panel-nav-label { font-family: 'DM Mono'; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .panel-nav-val { font-family: 'Bebas Neue'; font-size: 2rem; color: var(--orange); letter-spacing: 1px; }

  .returns-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1.5rem; }
  .ret-tile {
    background: rgba(255,255,255,0.8); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 4px;
    box-shadow: 0 1px 4px rgba(99,91,255,0.05);
  }
  .ret-tile-period { font-family: 'DM Mono'; font-size: 10px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }
  .ret-tile-val { font-family: 'Bebas Neue'; font-size: 1.4rem; letter-spacing: 1px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 1.5rem; }
  .info-tile {
    background: rgba(255,255,255,0.8); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px;
    box-shadow: 0 1px 4px rgba(99,91,255,0.05);
  }
  .info-label { font-family: 'DM Mono'; font-size: 10px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
  .info-val { font-family: 'Syne'; font-size: 14px; font-weight: 600; }

  .panel-section-title {
    font-family: 'DM Mono'; font-size: 10px; color: var(--muted);
    letter-spacing: 2px; text-transform: uppercase;
    margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border);
  }

  /* PEER TABLE */
  .peer-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  .peer-table th {
    font-family: 'DM Mono'; font-size: 9px; color: var(--muted);
    letter-spacing: 1px; text-transform: uppercase;
    text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--border);
  }
  .peer-table th:first-child { text-align: left; }
  .peer-table td { padding: 8px 8px; border-bottom: 1px solid rgba(99,91,255,0.05); font-family: 'DM Mono'; font-size: 11px; text-align: right; }
  .peer-table td:first-child { text-align: left; max-width: 120px; }
  .peer-table tr.highlight td { background: rgba(99,91,255,0.05); }
  .peer-rank { font-family: 'Bebas Neue'; font-size: 14px; color: var(--orange); }
  .peer-name { color: var(--text); font-size: 10px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* BAR CHART */
  .bar-chart { margin-bottom: 1.5rem; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-label { font-family: 'DM Mono'; font-size: 10px; color: var(--muted); width: 24px; text-align: right; }
  .bar-track { flex: 1; height: 6px; background: rgba(99,91,255,0.08); border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.16,1,0.3,1); }
  .bar-val { font-family: 'DM Mono'; font-size: 10px; width: 40px; text-align: right; }

  /* LEADERBOARD */
  .leaderboard { padding: 0 2rem 2rem; border-top: 1px solid var(--border); }
  .lb-title { font-family: 'Bebas Neue'; font-size: 1.4rem; letter-spacing: 2px; color: var(--text); padding: 1.5rem 0 1rem; }
  .lb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .lb-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px;
    transition: all 0.15s; backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(99,91,255,0.06);
  }
  .lb-card:hover { border-color: rgba(255,107,53,0.3); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,91,255,0.12); }
  .lb-cat { font-family: 'DM Mono'; font-size: 10px; color: var(--violet); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
  .lb-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .lb-row:last-child { border-bottom: none; }
  .lb-row-name { font-size: 11px; color: var(--text); flex: 1; padding-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lb-row-ret { font-family: 'DM Mono'; font-size: 12px; font-weight: 500; }
  .lb-row-rank { font-family: 'Bebas Neue'; font-size: 13px; color: var(--muted); width: 20px; margin-right: 8px; }

  .no-results { padding: 3rem; text-align: center; color: var(--muted); font-family: 'DM Mono'; font-size: 13px; }

  /* PEER SECTION HEADER */
  .peer-section-header {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border);
  }
  .peer-section-header .panel-section-title { margin-bottom: 0; padding-bottom: 0; border-bottom: none; flex: 1; }

  /* PEER PANEL — new tabbed design */
  .peer-panel { margin-top: 1.5rem; }
  .peer-tabs {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border); margin-bottom: 0;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .peer-tabs::-webkit-scrollbar { display: none; }
  .peer-tab-group { display: flex; }
  .peer-tab {
    padding: 8px 11px; border: none; background: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 0.8px;
    color: var(--muted); border-bottom: 2px solid transparent;
    transition: all 0.15s; white-space: nowrap;
  }
  .peer-tab.active { color: var(--violet); border-bottom-color: var(--violet); }
  .peer-toggle {
    display: flex; flex-shrink: 0; margin-left: 8px;
    background: rgba(255,255,255,0.9); border: 1px solid var(--border);
    border-radius: 5px; overflow: hidden;
  }
  .peer-toggle-btn {
    padding: 4px 9px; border: none; background: transparent; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; color: var(--muted);
    transition: all 0.15s;
  }
  .peer-toggle-btn.active { background: var(--violet); color: #fff; }
  .peer-pills {
    display: flex; gap: 5px; padding: 7px 0 6px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .peer-pills::-webkit-scrollbar { display: none; }
  .peer-pill {
    padding: 3px 9px; border-radius: 10px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; white-space: nowrap;
    background: rgba(99,91,255,0.06); color: var(--muted);
    border: 1px solid rgba(99,91,255,0.15); transition: all 0.15s;
  }
  .peer-pill.active { background: linear-gradient(135deg,var(--violet),var(--indigo)); color: #fff; border-color: transparent; }

  /* peer table */
  .peer-tbl { width: 100%; border-collapse: collapse; font-family: 'DM Mono'; }
  .peer-tbl th {
    font-size: 9px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase;
    padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--border);
    cursor: pointer; white-space: nowrap;
  }
  .peer-tbl th:first-child { text-align: left; width: 20px; }
  .peer-tbl th:nth-child(2) { text-align: left; }
  .peer-tbl th.sort-active { color: var(--violet); }
  .peer-tbl td { padding: 7px 8px; border-bottom: 1px solid rgba(99,91,255,0.05); font-size: 11px; text-align: right; }
  .peer-tbl td:first-child { text-align: left; }
  .peer-tbl td:nth-child(2) { text-align: left; max-width: 130px; }
  .peer-tbl tr.peer-selected td { background: rgba(99,91,255,0.05); }
  .peer-tbl tr:last-child td { border-bottom: none; }
  .peer-rank-badge { font-family: 'Bebas Neue'; font-size: 14px; color: var(--orange); }
  .peer-scheme-name { font-size: 11px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
  .peer-scheme-amc  { font-size: 9px; color: var(--muted); margin-top: 1px; }

  /* MOBILE FILTER BAR — Option 1 */
  .mobile-filter-bar { display: none; }
  .filter-chips { display: none; }

  @media (max-width: 768px) {
    /* Hide desktop filter toggles */
    .filters-bar .toggle-group,
    .filters-bar .filter-select,
    .filters-bar .aum-filter { display: none !important; }

    /* Show mobile bar */
    .mobile-filter-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 0.75rem 1rem;
      background: rgba(255,255,255,0.6);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 60px; z-index: 90;
      backdrop-filter: blur(16px);
    }
    .mobile-filter-btn {
      padding: 8px 14px; border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.9);
      font-family: 'DM Mono'; font-size: 11px;
      color: var(--text); cursor: pointer; white-space: nowrap;
      transition: all 0.15s;
    }
    .mobile-filter-btn.has-active {
      border-color: var(--violet); color: var(--violet);
      background: rgba(99,91,255,0.06);
    }
    .filter-chips {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 0.5rem 1rem;
      background: rgba(255,255,255,0.5);
      border-bottom: 1px solid var(--border);
    }
    .filter-chip {
      font-family: 'DM Mono'; font-size: 10px; letter-spacing: 0.3px;
      padding: 3px 8px; border-radius: 10px;
      background: rgba(99,91,255,0.08); color: var(--violet);
      border: 1px solid rgba(99,91,255,0.18);
      display: flex; align-items: center; gap: 4px; cursor: pointer;
    }
    .filter-chip-x { opacity: 0.6; font-size: 10px; }

    /* Filter sheet panel */
    .filter-sheet {
      position: fixed; inset: 0; z-index: 400;
      background: rgba(15,12,46,0.4); backdrop-filter: blur(4px);
    }
    .filter-sheet-panel {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: #fff; border-radius: 16px 16px 0 0;
      padding: 1.25rem 1.25rem 2rem;
      max-height: 80vh; overflow-y: auto;
    }
    .filter-sheet-handle {
      width: 36px; height: 3px; background: rgba(99,91,255,0.2);
      border-radius: 2px; margin: 0 auto 1.25rem;
    }
    .filter-sheet-title {
      font-family: 'DM Mono'; font-size: 11px; letter-spacing: 2px;
      text-transform: uppercase; color: var(--muted); margin-bottom: 1rem;
    }
    .filter-sheet-group { margin-bottom: 1.25rem; }
    .filter-sheet-label {
      font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px;
      text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
    }
    .filter-sheet-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-sheet-btn {
      padding: 7px 14px; border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,0.9);
      font-family: 'DM Mono'; font-size: 11px;
      color: var(--muted); cursor: pointer; transition: all 0.15s;
    }
    .filter-sheet-btn.active {
      background: linear-gradient(135deg, var(--violet), var(--pink));
      color: #fff; border-color: transparent;
    }
    .filter-sheet-select {
      width: 100%; padding: 9px 12px;
      background: rgba(255,255,255,0.9); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text);
      font-family: 'DM Mono'; font-size: 12px; outline: none;
    }

    /* Main layout stacks on mobile */
    .main { grid-template-columns: 1fr; }
    .detail-panel { position: static; height: auto; border-top: 1px solid var(--border); }

    /* Scheme card columns collapse */
    .sort-bar, .scheme-card { grid-template-columns: 1fr auto auto; }
    .col-hide { display: none; }

    /* MOBILE CARD — Option A */
    .scheme-card { display: block; padding: 12px; }
    .mobile-card-top {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 8px;
    }
    .mobile-card-name-block { flex: 1; padding-right: 10px; }
    .mobile-card-name {
      font-size: 13px; font-weight: 600; color: var(--text);
      line-height: 1.3; margin-bottom: 5px;
    }
    .mobile-card-metric {
      text-align: right; flex-shrink: 0; min-width: 64px;
    }
    .mobile-card-metric-label {
      font-family: 'DM Mono'; font-size: 9px; color: var(--violet);
      letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;
    }
    .mobile-card-metric-val {
      font-family: 'Bebas Neue'; font-size: 1.5rem; letter-spacing: 1px; line-height: 1;
    }
    .mobile-card-secondary {
      display: flex; gap: 0;
      border-top: 1px solid var(--border); padding-top: 8px; margin-top: 2px;
    }
    .mobile-card-sec-item {
      flex: 1; text-align: center;
      border-right: 1px solid var(--border);
    }
    .mobile-card-sec-item:last-child { border-right: none; }
    .mobile-card-sec-label {
      font-family: 'DM Mono'; font-size: 9px; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;
    }
    .mobile-card-sec-val {
      font-family: 'DM Mono'; font-size: 11px; font-weight: 500;
    }

    /* MOBILE SORT BAR — 4 cols, scrollable */
    .sort-bar {
      display: flex; gap: 0; overflow-x: auto;
      padding: 8px 12px; margin-bottom: 8px;
      background: rgba(255,255,255,0.7);
      position: sticky; top: 60px; z-index: 80;
      border-bottom: 1px solid var(--border);
      -webkit-overflow-scrolling: touch;
    }
    .sort-bar::-webkit-scrollbar { display: none; }
    .sort-btn {
      padding: 6px 14px; border-radius: 20px; white-space: nowrap;
      border: 1px solid var(--border); margin-right: 6px;
      background: rgba(255,255,255,0.9);
    }
    .sort-btn.active {
      background: linear-gradient(135deg, var(--violet), var(--pink));
      color: #fff; border-color: transparent;
    }

    /* Search full width */
    .filters-bar .search-wrap { max-width: 100%; flex: 1; }
    .filters-bar .results-count { display: none; }
  }

  /* PEER FULLSCREEN OVERLAY */
  .peer-overlay {
    position: fixed; inset: 0; z-index: 500;
    background: rgba(15,12,46,0.55); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem; animation: overlayIn 0.18s ease;
  }
  @keyframes overlayIn { from{opacity:0} to{opacity:1} }
  .peer-overlay-panel {
    background: rgba(255,255,255,0.98);
    border: 1px solid rgba(99,91,255,0.18);
    border-radius: 16px; width: 100%; max-width: 900px;
    max-height: 90vh; overflow-y: auto;
    padding: 1.5rem; position: relative;
    box-shadow: 0 24px 80px rgba(99,91,255,0.2);
  }
  .peer-overlay-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1rem; padding-bottom: 10px;
    border-bottom: 1px solid rgba(99,91,255,0.12);
  }
  .peer-overlay-title {
    font-family: 'DM Mono'; font-size: 10px; color: var(--violet);
    letter-spacing: 2px; text-transform: uppercase;
  }
  .peer-overlay-close {
    width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid rgba(99,91,255,0.2);
    background: rgba(255,255,255,0.9); cursor: pointer;
    font-size: 14px; color: var(--muted);
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .peer-overlay-close:hover { background: var(--violet); color: #fff; border-color: transparent; }
  .peer-fs-btn {
    background: none; border: 1px solid var(--border); border-radius: 5px;
    cursor: pointer; font-size: 12px; color: var(--muted);
    padding: 3px 7px; transition: all 0.15s; line-height: 1; margin-left: 4px;
  }
  .peer-fs-btn:hover { color: var(--violet); border-color: var(--violet); background: rgba(99,91,255,0.06); }

  @media (max-width: 1024px) {
    .main { grid-template-columns: 1fr; }
    .detail-panel { position: static; height: auto; border-top: 1px solid var(--border); }
  }
  @media (max-width: 768px) {
    .sort-bar, .scheme-card { grid-template-columns: 1fr auto auto auto; }
    .col-hide { display: none; }
  }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const ReturnCell = ({ value }) => (
  <div className="ret-cell" style={{ color: value != null ? returnColor(value) : "#6b72a0" }}>
    {value != null ? `${value > 0 ? "+" : ""}${value}%` : "—"}
  </div>
);

const Stars = ({ n }) => (
  <div className="stars">{"★".repeat(n)}{"☆".repeat(5 - n)}</div>
);

const DetailPanel = ({ scheme, peers }) => {
  if (!scheme) return (
    <div className="panel-empty">
      <div className="panel-empty-icon">◈</div>
      <div className="panel-empty-text">SELECT A SCHEME<br />TO VIEW DETAILS<br />&amp; PEER COMPARISON</div>
    </div>
  );

  const periods = ["1W","1M","3M","6M","1Y","3Y","5Y"];
  const maxRet = Math.max(...peers.map(p => p.returns["1Y"]));

  return (
    <div>
      <div className="panel-header">
        <div className="panel-amc">{scheme.amc}</div>
        <div className="panel-name">{scheme.category} Fund</div>
        <div className="panel-tags">
          <span className="tag tag-cat">{scheme.category}</span>
          <span className={`tag ${scheme.plan === "Direct" ? "tag-plan-d" : "tag-plan-r"}`}>{scheme.plan}</span>
          <span className="tag" style={{background:"rgba(244,63,142,0.1)",color:"var(--pink)",border:"1px solid rgba(244,63,142,0.2)"}}>{scheme.type}</span>
        </div>
        <div className="panel-nav-row">
          <div>
            <div className="panel-nav-label">NAV</div>
            <div className="panel-nav-val">₹{scheme.nav}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="panel-nav-label">Rating</div>
            <Stars n={scheme.rating} />
          </div>
        </div>
      </div>

      <div className="panel-section-title">Returns (%)</div>
      <div className="returns-grid">
        {periods.map(p => (
          <div className="ret-tile" key={p}>
            <div className="ret-tile-period">{p}</div>
            <div className="ret-tile-val" style={{color: returnColor(scheme.returns[p])}}>
              {scheme.returns[p] > 0 ? "+" : ""}{scheme.returns[p]}%
            </div>
          </div>
        ))}
      </div>

      <div className="panel-section-title">Fund Details</div>
      <div className="info-grid">
        <div className="info-tile">
          <div className="info-label">AUM</div>
          <div className="info-val" style={{color:scheme.aum>10000?"var(--cyan)":"var(--text)"}}>{fmt(scheme.aum)}</div>
        </div>
        <div className="info-tile">
          <div className="info-label">Expense Ratio</div>
          <div className="info-val" style={{color:scheme.expenseRatio<0.5?"var(--cyan)":scheme.expenseRatio>1.5?"var(--magenta)":"var(--text)"}}>{scheme.expenseRatio}%</div>
        </div>
        <div className="info-tile">
          <div className="info-label">Risk Grade</div>
          <div className="info-val" style={{color:riskColor(scheme.riskGrade)}}>{scheme.riskGrade}</div>
        </div>
        <div className="info-tile">
          <div className="info-label">Plan Type</div>
          <div className="info-val">{scheme.plan}</div>
        </div>
      </div>

      <div className="panel-section-title">1Y Return — Peer Benchmark</div>
      <div className="bar-chart">
        {peers.slice(0,6).map(p => (
          <div className="bar-row" key={p.id}>
            <div className="bar-label" style={{color: p.id === scheme.id ? "var(--violet)" : undefined, fontSize: p.id === scheme.id ? "9px" : undefined}}>
              {p.amc.split(" ")[0].slice(0,4).toUpperCase()}
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{
                width: `${Math.max(2,(p.returns["1Y"]/maxRet)*100)}%`,
                background: p.id === scheme.id
                  ? "linear-gradient(90deg, var(--violet), var(--pink))"
                  : "rgba(99,91,255,0.12)",
                border: p.id === scheme.id ? "none" : "none"
              }} />
            </div>
            <div className="bar-val" style={{color: p.id === scheme.id ? "var(--violet)" : returnColor(p.returns["1Y"])}}>
              {p.returns["1Y"] > 0 ? "+" : ""}{p.returns["1Y"]}%
            </div>
          </div>
        ))}
      </div>

      <div className="panel-section-title">Category Ranking — 1Y</div>
      <table className="peer-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Fund</th>
            <th>1Y</th>
            <th>3Y</th>
            <th>AUM</th>
          </tr>
        </thead>
        <tbody>
          {[...peers].sort((a,b) => b.returns["1Y"] - a.returns["1Y"]).slice(0,8).map((p, i) => (
            <tr key={p.id} className={p.id === scheme.id ? "highlight" : ""}>
              <td><span className="peer-rank">{i+1}</span></td>
              <td><div className="peer-name" title={p.name}>{p.amc}</div></td>
              <td style={{color: returnColor(p.returns["1Y"])}}>{p.returns["1Y"] > 0 ? "+" : ""}{p.returns["1Y"]}%</td>
              <td style={{color: returnColor(p.returns["3Y"])}}>{p.returns["3Y"] > 0 ? "+" : ""}{p.returns["3Y"]}%</td>
              <td style={{color:"var(--muted)"}}>{fmt(p.aum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── LOADING SCREEN ──────────────────────────────────────────────────────────
const LoadingScreen = ({ progress, message }) => (
  <div style={{
    minHeight:"100vh", display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center", gap:"24px",
    background:"linear-gradient(160deg,#eef2ff 0%,#fdf2f8 40%,#fff7ed 100%)"
  }}>
    <div style={{fontFamily:"'Bebas Neue'",fontSize:"2.5rem",letterSpacing:"3px",
      background:"linear-gradient(135deg,#4f46e5,#635bff,#f43f8e)",
      WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
      FUNDLENS
    </div>
    <div style={{width:"280px",height:"3px",background:"rgba(99,91,255,0.12)",borderRadius:"2px",overflow:"hidden"}}>
      <div style={{
        height:"100%",borderRadius:"2px",
        background:"linear-gradient(90deg,#635bff,#f43f8e)",
        width:`${progress}%`,
        transition:"width 0.4s ease"
      }}/>
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:"11px",color:"#6b72a0",letterSpacing:"1px",textAlign:"center"}}>
      {message}
    </div>
  </div>
);

const ErrorScreen = ({ error, onRetry }) => (
  <div style={{
    minHeight:"100vh", display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center", gap:"16px",
    background:"linear-gradient(160deg,#eef2ff 0%,#fdf2f8 40%,#fff7ed 100%)"
  }}>
    <div style={{fontSize:"2rem"}}>⚠️</div>
    <div style={{fontFamily:"'Bebas Neue'",fontSize:"1.4rem",letterSpacing:"2px",color:"#0f0c2e"}}>
      DATA LOAD FAILED
    </div>
    <div style={{fontFamily:"'DM Mono'",fontSize:"11px",color:"#6b72a0",letterSpacing:"0.5px",maxWidth:"400px",textAlign:"center",lineHeight:"1.8"}}>
      {error}
    </div>
    <button onClick={onRetry} style={{
      padding:"10px 24px",borderRadius:"8px",border:"none",cursor:"pointer",
      background:"linear-gradient(135deg,#635bff,#f43f8e)",color:"#fff",
      fontFamily:"'DM Mono'",fontSize:"12px",letterSpacing:"1px"
    }}>RETRY</button>
    <div style={{fontFamily:"'DM Mono'",fontSize:"10px",color:"#6b72a0",marginTop:"8px",textAlign:"center",lineHeight:"1.8"}}>
      If DATA_URL is not set, paste your Gist raw URL<br/>into the DATA_URL constant at the top of this file.
    </div>
  </div>
);

// ─── ROLLING RETURNS CHART ───────────────────────────────────────────────────
const RollingChart = ({ data }) => {
  if (!data || data.length === 0) return (
    <div style={{fontFamily:"'DM Mono'",fontSize:"11px",color:"var(--muted)",padding:"12px 0"}}>
      Insufficient history for rolling returns
    </div>
  );
  const vals   = data.map(d => d.return);
  const min    = Math.min(...vals);
  const max    = Math.max(...vals);
  const range  = max - min || 1;
  const W = 300, H = 80;
  const pts    = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.return - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const zeroY  = H - ((0 - min) / range) * (H - 8) - 4;

  return (
    <div style={{marginBottom:"1.5rem"}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"80px",overflow:"visible"}}>
        {/* Zero line */}
        {min < 0 && max > 0 && (
          <line x1="0" y1={zeroY} x2={W} y2={zeroY}
            stroke="rgba(99,91,255,0.2)" strokeWidth="1" strokeDasharray="3,3"/>
        )}
        {/* Area fill */}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#635bff" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#635bff" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <polyline
          points={`0,${H} ${pts} ${W},${H}`}
          fill="url(#chartGrad)" stroke="none"
        />
        {/* Line */}
        <polyline points={pts} fill="none"
          stroke="url(#lineGrad)" strokeWidth="1.5" strokeLinejoin="round"/>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#635bff"/>
            <stop offset="100%" stopColor="#f43f8e"/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",
        fontFamily:"'DM Mono'",fontSize:"9px",color:"var(--muted)",marginTop:"4px"}}>
        <span>{data[0]?.date}</span>
        <span style={{color:"var(--violet)",fontSize:"10px"}}>1Y Rolling Returns</span>
        <span>{data[data.length-1]?.date}</span>
      </div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  // ── Data state
  const [allSchemes,   setAllSchemes]   = useState([]);
  const [amcList,      setAmcList]      = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [leaderboard,  setLeaderboard]  = useState({});
  const [rollingMap,   setRollingMap]   = useState({});
  const [meta,         setMeta]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [loadMsg,      setLoadMsg]      = useState("Connecting to data source...");
  const [loadPct,      setLoadPct]      = useState(10);
  const [error,        setError]        = useState(null);

  // ── UI state
  const [search,        setSearch]       = useState("");
  const [amcFilter,     setAmcFilter]    = useState("All");
  const [catFilter,     setCatFilter]    = useState("Large Cap");
  const [typeFilter,    setTypeFilter]   = useState("All");
  const [planFilter,    setPlanFilter]   = useState(() => localStorage.getItem('fundlens_plan_universe') || 'Direct');
  const [optionFilter,  setOptionFilter] = useState("Growth");
  const [natureFilter,  setNatureFilter] = useState("Open Ended");
  const [sortKey,       setSortKey]      = useState("1Y");
  const [sortDir,       setSortDir]      = useState(-1);
  const [selected,      setSelected]     = useState(null);
  const [peerExpanded,   setPeerExpanded]   = useState(false);
  const [peerFullscreen, setPeerFullscreen] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  // Peer panel state
  const [peerMetric,     setPeerMetric]     = useState("returns");
  const [peerReturnMode, setPeerReturnMode] = useState("p2p");
  const [peerPeriod,     setPeerPeriod]     = useState("1Y");
  const [peerYear,       setPeerYear]       = useState("");
  const [peerSortBy,     setPeerSortBy]     = useState("metric");
  const [peerNavHist,    setPeerNavHist]    = useState(null);
  const [peerNavLoading, setPeerNavLoading] = useState(false);
  const [peerYearReturns,setPeerYearReturns]= useState({});
  // Ratios — fetched once on first scheme click, cached for session
  const [ratiosMap,      setRatiosMap]      = useState({});
  const [ratiosLoaded,   setRatiosLoaded]   = useState(false);
  const [ratiosLoading,  setRatiosLoading]  = useState(false);
  const [selectedRatios, setSelectedRatios] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Fetch data
  const loadData = useCallback(async () => {
    setLoading(true); setError(null); setLoadPct(10);
    setLoadMsg("Connecting to data source...");
    try {
      if (!DATA_URL || DATA_URL === "YOUR_GIST_RAW_URL_HERE") {
        throw new Error("DATA_URL not configured. Run the Colab pipeline first.");
      }
      setLoadPct(30); setLoadMsg("Fetching scheme data...");
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
      setLoadPct(65); setLoadMsg("Parsing scheme data...");
      const json = await resp.json();
      setAllSchemes(json.schemes      || []);
      setAmcList(json.amcs            || []);
      setCategoryList(json.categories || []);
      setMeta(json.meta               || null);

      // Fetch v4 category index (leaderboard data) separately
      if (CATINDEX_URL) {
        setLoadMsg("Loading category index...");
        try {
          const catResp = await fetch(CATINDEX_URL);
          if (catResp.ok) {
            const cat = await catResp.json();
            // v4 structure: { index: { "Large Cap|Direct": [...] } }
            // Flatten to plan-filtered map: { "Large Cap": [...] }
            // Uses user's plan universe setting — show only matching plan
            const planUniverse = localStorage.getItem('fundlens_plan_universe') || 'Direct';
            const filtered = {};
            for (const [key, funds] of Object.entries(cat.index || {})) {
              const [category, plan] = key.split("|");
              if (plan === planUniverse) {
                // Deduplicate by name client-side — guards against multiple AMFI
                // codes for the same fund until next pipeline run cleans source data
                const seen = new Map();
                for (const f of funds) {
                  const name = (f.name || "").trim().toLowerCase();
                  if (!seen.has(name) || f.return1Y > seen.get(name).return1Y) {
                    seen.set(name, f);
                  }
                }
                filtered[category] = Array.from(seen.values())
                  .sort((a, b) => b.return1Y - a.return1Y);
              }
            }
            setLeaderboard(filtered);
          }
        } catch (e) {
          console.warn("Category index fetch failed:", e.message);
        }
      } else {
        setLeaderboard(json.leaderboard || {});
      }

      setLoadPct(100); setLoadMsg("Ready!");
      setTimeout(() => setLoading(false), 300);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch NAV history for selected scheme's category+plan when scheme selected
  // Used for: rolling returns chart + calendar year returns in peer panel
  useEffect(() => {
    if (!selected) { setPeerNavHist(null); setPeerYearReturns({}); return; }
    setPeerNavLoading(true);
    const file = categorySlug(selected.category, selected.plan);
    fetch(`${NAVHIST_BASE}/${file}`)
      .then(r => r.json())
      .then(json => {
        setPeerNavHist(json);
        // Compute year returns for all peers in this category+plan
        const yearMap = {};
        for (const [id, hist] of Object.entries(json)) {
          yearMap[id] = calcYearReturns(hist);
        }
        setPeerYearReturns(yearMap);
        // Set default year to most recent complete year
        const years = Object.keys(yearMap[selected.id] || {}).sort().reverse();
        if (years.length > 0) setPeerYear(years[0]);
      })
      .catch(() => { setPeerNavHist(null); setPeerYearReturns({}); })
      .finally(() => setPeerNavLoading(false));
  }, [selected?.id]);

  // Fetch ratios Gist once on first scheme click — cache for the session
  const loadRatios = useCallback(async () => {
    if (ratiosLoaded || ratiosLoading) return;
    setRatiosLoading(true);
    try {
      const resp = await fetch(RATIOS_URL);
      if (!resp.ok) throw new Error(`Ratios HTTP ${resp.status}`);
      const json = await resp.json();
      setRatiosMap(json.ratios || {});
      setRatiosLoaded(true);
    } catch (e) {
      console.warn("Ratios fetch failed:", e.message);
    } finally {
      setRatiosLoading(false);
    }
  }, [ratiosLoaded, ratiosLoading]);

  useEffect(() => {
    if (!selected) { setSelectedRatios(null); return; }
    loadRatios();
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    setSelectedRatios(ratiosMap[String(selected.id)] || null);
  }, [ratiosMap, selected?.id]);

  // Auto-select scheme when navigated from Z8 Category Leaderboard
  const location = useLocation();
  useEffect(() => {
    if (!location.state?.selectId || allSchemes.length === 0) return;
    const match = allSchemes.find(s => s.id === location.state.selectId);
    if (match) {
      setSelected(match);
      setPeerExpanded(false);
      setCatFilter(match.category);
      setPlanFilter(match.plan);
      if (match.plan !== "All") localStorage.setItem("fundlens_plan_universe", match.plan);
    }
  }, [location.state, allSchemes]);

  // Sync plan universe when changed via Nav toggle
  useEffect(() => {
    const handler = (e) => {
      setPlanFilter(e.detail);
      // Re-filter leaderboard for new plan universe
      if (CATINDEX_URL) {
        fetch(CATINDEX_URL).then(r => r.json()).then(cat => {
          const filtered = {};
          for (const [key, funds] of Object.entries(cat.index || {})) {
            const [category, plan] = key.split("|");
            if (plan === e.detail) {
              const seen = new Map();
              for (const f of funds) {
                const name = (f.name || "").trim().toLowerCase();
                if (!seen.has(name) || f.return1Y > seen.get(name).return1Y) {
                  seen.set(name, f);
                }
              }
              filtered[category] = Array.from(seen.values())
                .sort((a, b) => b.return1Y - a.return1Y);
            }
          }
          setLeaderboard(filtered);
        }).catch(() => {});
      }
    };
    window.addEventListener('fundlens_plan_change', handler);
    return () => window.removeEventListener('fundlens_plan_change', handler);
  }, []);

  // ── Derive option (Growth/IDCW) from navName suffix
  // AMFI navName format: "Scheme Name - Option" e.g. "HDFC Top 100 - Growth"
  // Splitting on last "-" and checking the suffix is more precise than
  // substring matching the full name — prevents Dividend Yield category
  // schemes from being misclassified as IDCW.
  const getOption = (s) => {
    const full = ((s.navName || s.name) || "").trim();
    const suffix = full.split("-").pop().trim().toLowerCase();
    if (suffix.includes("idcw") || suffix.includes("dividend") || suffix.includes("payout") || suffix.includes("reinvestment")) return "IDCW";
    if (suffix.includes("bonus")) return "Bonus";
    return "Growth";
  };

  // ── Category → implied type map (so Type filter doesn't block category browse)
  const CAT_TYPE = {
    "Liquid":"Debt","Overnight":"Debt","Money Market":"Debt","Ultra Short Duration":"Debt",
    "Low Duration":"Debt","Short Duration":"Debt","Medium Duration":"Debt",
    "Medium to Long Duration":"Debt","Long Duration":"Debt","Dynamic Bond":"Debt",
    "Corporate Bond":"Debt","Credit Risk":"Debt","Banking & PSU":"Debt",
    "Gilt":"Debt","Floater":"Debt","Debt":"Debt",
    "Large Cap":"Equity","Mid Cap":"Equity","Small Cap":"Equity","Multi Cap":"Equity",
    "Flexi Cap":"Equity","Large & Mid Cap":"Equity","Focused":"Equity","ELSS":"Equity",
    "Contra":"Equity","Dividend Yield":"Equity","Value":"Equity","Thematic":"Equity","Equity":"Equity",
    "Aggressive Hybrid":"Hybrid","Conservative Hybrid":"Hybrid","Balanced Hybrid":"Hybrid",
    "Dynamic AA":"Hybrid","Equity Savings":"Hybrid","Multi Asset":"Hybrid","Hybrid":"Hybrid",
    "Arbitrage":"Hybrid",
    "Index":"Passive","ETF":"Passive","Fund of Funds":"Passive",
  };

  // ── Filtering & sorting
  const filtered = allSchemes.filter(s => {
    // Always exclude segregated portfolio schemes
    if (s.name.toLowerCase().includes("segregated")) return false;

    if (planFilter   !== "All" && s.plan      !== planFilter)         return false;
    if (amcFilter    !== "All" && s.amc       !== amcFilter)          return false;
    if (natureFilter !== "All" && s.structure !== natureFilter)       return false;
    if (optionFilter !== "All" && getOption(s) !== optionFilter) return false;

    // Category filter — if set, ignore typeFilter (category implies type)
    if (catFilter !== "All") {
      if (s.category !== catFilter) return false;
    } else {
      // No category selected — apply type filter
      if (typeFilter !== "All" && s.type !== typeFilter) return false;
    }

    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
                  !s.amc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const aVal = sortKey === "SHARPE" ? (a.risk?.sharpe ?? -999)
               : sortKey === "DD"     ? (a.risk?.maxDD  ?? -999)
               : (a.returns?.[sortKey] ?? -999);
    const bVal = sortKey === "SHARPE" ? (b.risk?.sharpe ?? -999)
               : sortKey === "DD"     ? (b.risk?.maxDD  ?? -999)
               : (b.returns?.[sortKey] ?? -999);
    return sortDir * (aVal - bVal);
  });

  // ── Deduplicate — same scheme name can have multiple codes in AMFI
  // Keep the one with best 1Y return per name+plan+option combination
  const deduped = (() => {
    const seen = new Map();
    for (const s of filtered) {
      const key = `${s.name}||${s.plan}||${getOption(s)}`;
      if (!seen.has(key)) {
        seen.set(key, s);
      } else {
        // Keep whichever has better 1Y return
        const existing = seen.get(key);
        if ((s.returns?.["1Y"] ?? -999) > (existing.returns?.["1Y"] ?? -999)) {
          seen.set(key, s);
        }
      }
    }
    return Array.from(seen.values());
  })();

  const handleSort = (k) => {
    if (sortKey === k) setSortDir(d => -d);
    else { setSortKey(k); setSortDir(-1); }
  };

  const peers = selected
    ? allSchemes.filter(s => s.category === selected.category && s.plan === selected.plan)
    : [];

  // AMC dedup — Option A:
  // Only deduplicate when 3+ distinct AMCs in pool (avoids wiping single-AMC categories)
  // Always keep the selected scheme. Take top 1Y returner per AMC, top 6 total.
  const dedupedPeers = (() => {
    if (!selected || peers.length === 0) return [];
    const distinctAmcs = new Set(peers.map(p => p.amc)).size;
    if (distinctAmcs < 3) return [...peers].sort((a,b) => (b.returns?.["1Y"]??-999) - (a.returns?.["1Y"]??-999));
    // Deduplicate: best 1Y per AMC, always include selected scheme
    const byAmc = new Map();
    for (const p of peers) {
      const existing = byAmc.get(p.amc);
      if (!existing || (p.returns?.["1Y"]??-999) > (existing.returns?.["1Y"]??-999)) {
        byAmc.set(p.amc, p);
      }
    }
    const deduped = Array.from(byAmc.values()).sort((a,b) => (b.returns?.["1Y"]??-999) - (a.returns?.["1Y"]??-999));
    // Ensure selected scheme is always present
    const hasSelected = deduped.some(p => p.id === selected.id);
    if (!hasSelected) deduped.push(selected);
    return deduped;
  })();

  const sortCols = [
    { key:"1M",     label:"1M"    },
    { key:"3M",     label:"3M"    },
    { key:"6M",     label:"6M"    },
    { key:"1Y",     label:"1Y"    },
    { key:"3Y",     label:"3Y"    },
    { key:"SHARPE", label:"Sharpe"},
  ];

  // ── Loading / Error states
  if (loading) return <><style>{style}</style><LoadingScreen progress={loadPct} message={loadMsg}/></>;
  if (error)   return <><style>{style}</style><ErrorScreen error={error} onRetry={loadData}/></>;

  return (
    <div className="app">
      <style>{style}</style>

      <div className="hero">
        <div className="hero-eyebrow">◈ Institutional Grade MF Analytics</div>
        <div className="hero-title">MUTUAL FUND<br />INTELLIGENCE TERMINAL</div>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-val">{meta?.totalSchemes?.toLocaleString("en-IN") || allSchemes.length}</div>
            <div className="hero-stat-label">Schemes Tracked</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-val">{meta?.amcCount || amcList.length}</div>
            <div className="hero-stat-label">Fund Houses</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-val">{meta?.categoryCount || categoryList.length}</div>
            <div className="hero-stat-label">Categories</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-val">7</div>
            <div className="hero-stat-label">Return Periods</div>
          </div>
        </div>
      </div>

      {/* TABS — Scheme Explorer only. Category Leaderboard moved to Z8 (/category-leaderboard) */}
      <div style={{padding:"0 2rem",borderBottom:"1px solid var(--border)",display:"flex",gap:"0"}}>
        <button style={{
          padding:"14px 20px",background:"none",border:"none",cursor:"pointer",
          fontFamily:"'DM Mono'",fontSize:"11px",letterSpacing:"1.5px",textTransform:"uppercase",
          color:"var(--violet)",
          borderBottom:"2px solid var(--violet)",
          transition:"all 0.15s"
        }}>
          ◈ Scheme Explorer
        </button>
      </div>

      {/* SCHEME EXPLORER */}
      {<>
        <div className="filters-bar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search scheme or AMC..."
              value={search} onChange={e=>setSearch(e.target.value)} />
          </div>

          {/* Plan: Direct / Regular */}
          <div className="toggle-group">
            {["All","Direct","Regular"].map(p => (
              <button key={p} className={`toggle-btn ${planFilter===p?"active":""}`}
                onClick={() => {
                  setPlanFilter(p);
                  if (p !== "All") localStorage.setItem('fundlens_plan_universe', p);
                }}>{p}</button>
            ))}
          </div>

          {/* Option: Growth / IDCW */}
          <div className="toggle-group">
            {["All","Growth","IDCW","Bonus"].map(o => (
              <button key={o} className={`toggle-btn ${optionFilter===o?"active":""}`}
                onClick={()=>setOptionFilter(o)}>{o}</button>
            ))}
          </div>

          {/* Asset type */}
          <div className="toggle-group">
            {["All","Equity","Debt","Hybrid","Passive"].map(t => (
              <button key={t} className={`toggle-btn ${typeFilter===t?"active":""}`}
                onClick={()=>{ setTypeFilter(t); if (t !== "All") setCatFilter("All"); }}>{t}</button>
            ))}
          </div>

          {/* Nature: Open / Close / Interval */}
          <div className="toggle-group">
            {["All","Open Ended","Close Ended","Interval"].map(n => (
              <button key={n} className={`toggle-btn ${natureFilter===n?"active":""}`}
                onClick={()=>setNatureFilter(n)}
                style={{fontSize:"10px"}}>{n === "Open Ended" ? "Open" : n === "Close Ended" ? "Close" : n}</button>
            ))}
          </div>

          {/* AMC dropdown */}
          <select className="filter-select" value={amcFilter} onChange={e=>setAmcFilter(e.target.value)}>
            <option value="All">All AMCs</option>
            {amcList.map(a => {
              const name = typeof a === "string" ? a : a.name;
              return <option key={name} value={name}>{name}</option>;
            })}
          </select>

          {/* Category dropdown */}
          <select className="filter-select" value={catFilter} onChange={e => {
            setCatFilter(e.target.value);
            // When category selected, type is implicit — reset type to All
            if (e.target.value !== "All") setTypeFilter("All");
          }}>
            <option value="All">All Categories</option>
            {categoryList.map(c=><option key={c}>{c}</option>)}
          </select>

          <div className="results-count"><span>{deduped.length}</span> of {allSchemes.length} schemes</div>
        </div>

        {/* MOBILE FILTER BAR */}
        {(() => {
          const activeFilters = [
            planFilter !== "All"   && { key:"plan",   label: planFilter,   clear: ()=>setPlanFilter("All") },
            optionFilter !== "All" && { key:"option", label: optionFilter, clear: ()=>setOptionFilter("All") },
            typeFilter !== "All"   && { key:"type",   label: typeFilter,   clear: ()=>setTypeFilter("All") },
            natureFilter !== "All" && { key:"nature", label: natureFilter === "Open Ended" ? "Open" : natureFilter === "Close Ended" ? "Close" : natureFilter, clear: ()=>setNatureFilter("All") },
            amcFilter !== "All"    && { key:"amc",    label: amcFilter.split(" ")[0], clear: ()=>setAmcFilter("All") },
            catFilter !== "All"    && { key:"cat",    label: catFilter,    clear: ()=>setCatFilter("All") },
          ].filter(Boolean);

          return (
            <>
              <div className="mobile-filter-bar">
                <button
                  className={`mobile-filter-btn${activeFilters.length > 0 ? " has-active" : ""}`}
                  onClick={() => setShowFilterSheet(true)}
                >
                  ⚙ Filters{activeFilters.length > 0 ? ` (${activeFilters.length})` : ""} ▾
                </button>
                <div className="results-count" style={{display:"block"}}>
                  <span>{deduped.length}</span> of {allSchemes.length}
                </div>
              </div>

              {activeFilters.length > 0 && (
                <div className="filter-chips">
                  {activeFilters.map(f => (
                    <div key={f.key} className="filter-chip" onClick={f.clear}>
                      {f.label} <span className="filter-chip-x">✕</span>
                    </div>
                  ))}
                </div>
              )}

              {showFilterSheet && (
                <div className="filter-sheet" onClick={e => { if(e.target.classList.contains("filter-sheet")) setShowFilterSheet(false); }}>
                  <div className="filter-sheet-panel">
                    <div className="filter-sheet-handle" />
                    <div className="filter-sheet-title">Filters</div>

                    <div className="filter-sheet-group">
                      <div className="filter-sheet-label">Plan</div>
                      <div className="filter-sheet-row">
                        {["All","Direct","Regular"].map(p => (
                          <button key={p} className={`filter-sheet-btn${planFilter===p?" active":""}`}
                            onClick={()=>{ setPlanFilter(p); if(p!=="All") localStorage.setItem('fundlens_plan_universe',p); }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="filter-sheet-group">
                      <div className="filter-sheet-label">Option</div>
                      <div className="filter-sheet-row">
                        {["All","Growth","IDCW","Bonus"].map(o => (
                          <button key={o} className={`filter-sheet-btn${optionFilter===o?" active":""}`}
                            onClick={()=>setOptionFilter(o)}>{o}</button>
                        ))}
                      </div>
                    </div>

                    <div className="filter-sheet-group">
                      <div className="filter-sheet-label">Type</div>
                      <div className="filter-sheet-row">
                        {["All","Equity","Debt","Hybrid","Passive"].map(t => (
                          <button key={t} className={`filter-sheet-btn${typeFilter===t?" active":""}`}
                            onClick={()=>{ setTypeFilter(t); if(t!=="All") setCatFilter("All"); }}>{t}</button>
                        ))}
                      </div>
                    </div>

                    <div className="filter-sheet-group">
                      <div className="filter-sheet-label">Structure</div>
                      <div className="filter-sheet-row">
                        {["All","Open Ended","Close Ended","Interval"].map(n => (
                          <button key={n} className={`filter-sheet-btn${natureFilter===n?" active":""}`}
                            onClick={()=>setNatureFilter(n)}>
                            {n==="Open Ended"?"Open":n==="Close Ended"?"Close":n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="filter-sheet-group">
                      <div className="filter-sheet-label">Category</div>
                      <select className="filter-sheet-select" value={catFilter}
                        onChange={e=>{ setCatFilter(e.target.value); if(e.target.value!=="All") setTypeFilter("All"); }}>
                        <option value="All">All Categories</option>
                        {categoryList.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="filter-sheet-group">
                      <div className="filter-sheet-label">AMC</div>
                      <select className="filter-sheet-select" value={amcFilter}
                        onChange={e=>setAmcFilter(e.target.value)}>
                        <option value="All">All AMCs</option>
                        {amcList.map(a=>{ const n=typeof a==="string"?a:a.name; return <option key={n} value={n}>{n}</option>; })}
                      </select>
                    </div>

                    <button
                      onClick={() => setShowFilterSheet(false)}
                      style={{
                        width:"100%", padding:"12px", marginTop:"8px",
                        background:"linear-gradient(135deg,var(--violet),var(--pink))",
                        border:"none", borderRadius:"10px", color:"#fff",
                        fontFamily:"'DM Mono'", fontSize:"12px", letterSpacing:"1px",
                        cursor:"pointer"
                      }}
                    >
                      APPLY — {deduped.length} schemes
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        <div className="main">
          <div className="scheme-list">
            {isMobile ? (
              /* MOBILE SORT BAR — scrollable pill strip */
              <div className="sort-bar">
                {sortCols.map(c => (
                  <button key={c.key} className={`sort-btn ${sortKey===c.key?"active":""}`}
                    onClick={()=>handleSort(c.key)}>
                    {c.label} {sortKey===c.key ? (sortDir===-1?"↓":"↑") : ""}
                  </button>
                ))}
              </div>
            ) : (
              /* DESKTOP SORT BAR — column headers */
              <div className="sort-bar">
                <div>Scheme</div>
                {sortCols.map(c => (
                  <button key={c.key} className={`sort-btn ${sortKey===c.key?"active":""}`}
                    onClick={()=>handleSort(c.key)}>
                    {c.label} {sortKey===c.key ? (sortDir===-1?"↓":"↑") : ""}
                  </button>
                ))}
              </div>
            )}

            {deduped.length === 0 && (
              <div className="no-results">No schemes match your filters.</div>
            )}

            {deduped.slice(0,80).map((s,i) => {
              // Contextual secondary row: all periods minus active sortKey, take first 3
              const allPeriods = ["1M","3M","6M","1Y","3Y","SHARPE"];
              const secPeriods = allPeriods.filter(p => p !== sortKey).slice(0, 3);
              const getVal = (scheme, key) => {
                if (key === "SHARPE") return scheme.risk?.sharpe != null ? scheme.risk.sharpe.toFixed(2) : null;
                return scheme.returns?.[key] != null ? scheme.returns[key] : null;
              };
              const fmtVal = (val, key) => {
                if (val == null) return "—";
                if (key === "SHARPE") return val;
                return `${val > 0 ? "+" : ""}${val}%`;
              };
              const primaryVal = getVal(s, sortKey);
              const primaryFmt = fmtVal(primaryVal, sortKey);
              const primaryColor = sortKey === "SHARPE"
                ? ((s.risk?.sharpe ?? 0) > 1 ? "var(--violet)" : "var(--muted)")
                : returnColor(primaryVal);

              return (
                <div key={s.id}
                  className={`scheme-card ${selected?.id === s.id ? "selected" : ""}`}
                  style={{animationDelay:`${Math.min(i,20)*0.02}s`}}
                  onClick={() => { setSelected(s); setPeerExpanded(false); setPeerMetric("returns"); setPeerReturnMode("p2p"); setPeerPeriod("1Y"); }}
                >
                  {isMobile ? (
                    /* ── MOBILE CARD — Option A ── */
                    <>
                      <div className="mobile-card-top">
                        <div className="mobile-card-name-block">
                          <div className="mobile-card-name">{s.name}</div>
                          <div className="scheme-meta">
                            <span className="tag tag-cat">{s.category}</span>
                            <span className={`tag ${s.plan === "Direct" ? "tag-plan-d" : "tag-plan-r"}`}>{s.plan}</span>
                          </div>
                        </div>
                        <div className="mobile-card-metric">
                          <div className="mobile-card-metric-label">{sortKey}</div>
                          <div className="mobile-card-metric-val" style={{color: primaryColor}}>
                            {primaryFmt}
                          </div>
                        </div>
                      </div>
                      <div className="mobile-card-secondary">
                        {secPeriods.map(p => {
                          const v = getVal(s, p);
                          return (
                            <div className="mobile-card-sec-item" key={p}>
                              <div className="mobile-card-sec-label">{p}</div>
                              <div className="mobile-card-sec-val" style={{color: p === "SHARPE"
                                ? ((s.risk?.sharpe ?? 0) > 1 ? "var(--violet)" : "var(--muted)")
                                : returnColor(v)}}>
                                {fmtVal(v, p)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    /* ── DESKTOP CARD — original grid ── */
                    <>
                      <div className="scheme-name-col">
                        <div className="scheme-name">{s.name}</div>
                        <div className="scheme-meta">
                          <span className="tag tag-cat">{s.category}</span>
                          <span className={`tag ${s.plan === "Direct" ? "tag-plan-d" : "tag-plan-r"}`}>{s.plan}</span>
                          <span className="tag" style={{background:"rgba(99,91,255,0.07)",color:"var(--muted)",border:"1px solid var(--border)"}}>
                            {getOption(s)}
                          </span>
                        </div>
                      </div>
                      <ReturnCell value={s.returns?.["1M"]} />
                      <ReturnCell value={s.returns?.["3M"]} />
                      <ReturnCell value={s.returns?.["6M"]} />
                      <ReturnCell value={s.returns?.["1Y"]} />
                      <ReturnCell value={s.returns?.["3Y"]} />
                      <div className="ret-cell" style={{color: (s.risk?.sharpe ?? 0) > 1 ? "var(--violet)" : "var(--muted)"}}>
                        {s.risk?.sharpe != null ? s.risk.sharpe.toFixed(2) : "—"}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {deduped.length > 80 && (
              <div style={{textAlign:"center",padding:"1rem",fontFamily:"'DM Mono'",
                fontSize:"11px",color:"var(--muted)"}}>
                Showing 80 of {deduped.length} — refine filters to narrow results
              </div>
            )}
          </div>

          {/* DETAIL PANEL */}
          <div className="detail-panel">
            {!selected ? (
              <div className="panel-empty">
                <div className="panel-empty-icon">◈</div>
                <div className="panel-empty-text">SELECT A SCHEME<br/>TO VIEW DETAILS<br/>&amp; PEER COMPARISON</div>
              </div>
            ) : (
              <div>
                <div className="panel-header">
                  <div className="panel-amc">{selected.amc}</div>
                  <div className="panel-name">{selected.name.replace(selected.amc,"").trim()}</div>
                  <div className="panel-tags">
                    <span className="tag tag-cat">{selected.category}</span>
                    <span className="tag tag-plan-d">{selected.type}</span>
                    <span className={`tag ${selected.plan === "Direct" ? "tag-plan-d" : "tag-plan-r"}`}>
                      {selected.plan}
                    </span>
                  </div>
                  <div className="panel-nav-row">
                    <div>
                      <div className="panel-nav-label">NAV ({selected.navDate})</div>
                      <div className="panel-nav-val">₹{selected.nav}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="panel-nav-label">NAV since</div>
                      <div style={{fontFamily:"'DM Mono'",fontSize:"12px",color:"var(--muted)"}}>
                        {selected.navDate
                          ? new Date(selected.navDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Returns grid */}
                <div className="panel-section-title">Trailing Returns (%)</div>
                <div className="returns-grid">
                  {["1W","1M","3M","6M","1Y","3Y","5Y"].map(p => (
                    <div className="ret-tile" key={p}>
                      <div className="ret-tile-period">{p}</div>
                      <div className="ret-tile-val" style={{color:returnColor(selected.returns?.[p])}}>
                        {selected.returns?.[p] != null
                          ? `${selected.returns[p] > 0 ? "+" : ""}${selected.returns[p]}%`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Risk metrics */}
                <div className="panel-section-title">Risk Metrics (252-day)
                  {ratiosLoading && <span style={{marginLeft:8,fontFamily:"'DM Mono'",fontSize:"9px",color:"var(--muted)"}}>⟳ loading…</span>}
                </div>
                <div className="info-grid">
                  <div className="info-tile">
                    <div className="info-label">Sharpe Ratio</div>
                    <div className="info-val" style={{color:(selectedRatios?.sharpe??0)>1?"var(--violet)":"var(--text)"}}>
                      {selectedRatios?.sharpe != null ? selectedRatios.sharpe.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="info-tile">
                    <div className="info-label">Std Dev (Ann.)</div>
                    <div className="info-val">{selectedRatios?.stdDev != null ? `${selectedRatios.stdDev.toFixed(2)}%` : "—"}</div>
                  </div>
                  <div className="info-tile">
                    <div className="info-label">Max Drawdown</div>
                    <div className="info-val" style={{color:"var(--red)"}}>
                      {selectedRatios?.maxDrawdown != null ? `${selectedRatios.maxDrawdown.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                  <div className="info-tile">
                    <div className="info-label">Sortino Ratio</div>
                    <div className="info-val" style={{color:(selectedRatios?.sortino??0)>1?"var(--emerald)":"var(--text)"}}>
                      {selectedRatios?.sortino != null ? selectedRatios.sortino.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>

                {/* Rolling returns chart */}
                <div className="panel-section-title">1Y Rolling Returns</div>
                <RollingChart data={(() => {
                  const raw = peerNavHist?.[String(selected.id)];
                  if (raw && raw.length > 50) return computeRolling1Y(raw);
                  return rollingMap[String(selected.id)] || [];
                })()} />

                {/* Peer comparison — plan-matched, AMC-deduped */}
                {dedupedPeers.length > 1 && (() => {
                  // ── Peer panel helpers ───────────────────────────────────
                  const METRIC_TABS = [
                    { key:"returns",  label:"Returns" },
                    { key:"sharpe",   label:"Sharpe"  },
                    { key:"stddev",   label:"Std Dev" },
                    { key:"maxdd",    label:"Max DD"  },
                    { key:"sortino",  label:"Sortino" },
                  ];
                  const P2P_PERIODS = ["1M","3M","6M","1Y","3Y"];

                  // Get metric value for a peer
                  const getMetricVal = (p) => {
                    if (peerMetric === "returns") {
                      if (peerReturnMode === "p2p") return p.returns?.[peerPeriod] ?? null;
                      return peerYearReturns[p.id]?.[peerYear] ?? null;
                    }
                    const r = ratiosMap[String(p.id)];
                    if (peerMetric === "sharpe")  return r?.sharpe      ?? p.risk?.sharpe   ?? null;
                    if (peerMetric === "stddev")  return r?.stdDev      ?? p.risk?.stdDev   ?? null;
                    if (peerMetric === "maxdd")   return r?.maxDrawdown ?? p.risk?.maxDrawdown ?? null;
                    if (peerMetric === "sortino") return r?.sortino     ?? p.risk?.sortino  ?? null;
                    return null;
                  };

                  const fmtMetric = (v) => {
                    if (v == null) return "—";
                    if (peerMetric === "returns") return `${v > 0 ? "+" : ""}${v}%`;
                    return v.toFixed(2);
                  };

                  const metricColor = (v, p) => {
                    if (v == null) return "var(--muted)";
                    if (p.id === selected.id) return "var(--violet)";
                    if (peerMetric === "returns") return returnColor(v);
                    if (peerMetric === "sharpe" || peerMetric === "sortino")
                      return v > 1 ? "#059669" : v > 0 ? "var(--text)" : "#e11d48";
                    return "var(--text)";
                  };

                  // Sort peers
                  const sortedPeers = [...dedupedPeers].sort((a, b) => {
                    if (peerSortBy === "aum") return 0; // AUM not available yet
                    const av = getMetricVal(a) ?? -9999;
                    const bv = getMetricVal(b) ?? -9999;
                    // For stddev + maxdd: lower = better, so sort ascending
                    const lowerBetter = peerMetric === "stddev" || peerMetric === "maxdd";
                    return lowerBetter ? av - bv : bv - av;
                  });

                  const visibleRows  = peerExpanded ? sortedPeers.length : 8;
                  const barPeers     = sortedPeers.slice(0, 6);
                  const maxAbsVal    = Math.max(...barPeers.map(p => Math.abs(getMetricVal(p) ?? 0)), 0.01);

                  // Available years from selected scheme
                  const availYears = Object.keys(peerYearReturns[selected.id] || {})
                    .sort().reverse();

                  // Short name
                  const shortName = (p) => {
                    const n = p.name || "";
                    const amc = (p.amc || "").split(" ")[0];
                    const stripped = n.startsWith(amc) ? n.slice(amc.length).trim() : n;
                    return stripped.length > 22 ? stripped.slice(0, 21) + "…" : stripped;
                  };
                  const barLabel = (p) => (p.name || p.amc || "").split(" ")[0].slice(0,4).toUpperCase();

                  // Year table: columns = all available years sorted desc
                  const yearCols = availYears;

                  return (
                    <div className="peer-panel">
                      {/* Metric tabs + P2P|Year toggle + Fullscreen button */}
                      <div className="peer-tabs">
                        <div className="peer-tab-group">
                          {METRIC_TABS.map(t => (
                            <button key={t.key}
                              className={`peer-tab${peerMetric===t.key?" active":""}`}
                              onClick={() => { setPeerMetric(t.key); if(t.key!=="returns") setPeerReturnMode("p2p"); }}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <div style={{display:"flex",alignItems:"center"}}>
                          {peerMetric === "returns" && (
                            <div className="peer-toggle">
                              <button className={`peer-toggle-btn${peerReturnMode==="p2p"?" active":""}`}
                                onClick={() => setPeerReturnMode("p2p")}>P2P</button>
                              <button className={`peer-toggle-btn${peerReturnMode==="year"?" active":""}`}
                                onClick={() => setPeerReturnMode("year")}>Year</button>
                            </div>
                          )}
                          <button className="peer-fs-btn" title="Expand to fullscreen"
                            onClick={() => setPeerFullscreen(true)}>⛶</button>
                        </div>
                      </div>

                      {/* Period pills */}
                      {peerMetric === "returns" && (
                        <div className="peer-pills">
                          {peerReturnMode === "p2p" ? (
                            P2P_PERIODS.map(p => (
                              <button key={p} className={`peer-pill${peerPeriod===p?" active":""}`}
                                onClick={() => setPeerPeriod(p)}>{p}</button>
                            ))
                          ) : peerNavLoading ? (
                            <span style={{fontFamily:"'DM Mono'",fontSize:10,color:"var(--muted)"}}>Loading year data...</span>
                          ) : (
                            availYears.map(y => (
                              <button key={y} className={`peer-pill${peerYear===y?" active":""}`}
                                onClick={() => setPeerYear(y)}>
                                {y === new Date().getFullYear().toString() ? `${y} YTD` : y}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Bar chart */}
                      <div className="bar-chart" style={{marginTop:"4px"}}>
                        {barPeers.map(p => {
                          const v = getMetricVal(p);
                          const w = v != null ? Math.max(3, (Math.abs(v) / maxAbsVal) * 100) : 3;
                          return (
                            <div className="bar-row" key={p.id} title={p.name}>
                              <div className="bar-label" style={{color: p.id===selected.id ? "var(--violet)" : undefined, fontSize:"9px"}}>
                                {barLabel(p)}
                              </div>
                              <div className="bar-track">
                                <div className="bar-fill" style={{
                                  width:`${w}%`,
                                  background: p.id===selected.id
                                    ? "linear-gradient(90deg,var(--violet),var(--pink))"
                                    : "rgba(99,91,255,0.12)"
                                }}/>
                              </div>
                              <div className="bar-val" style={{color: metricColor(v, p)}}>
                                {fmtMetric(v)}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Peer table */}
                      <div style={{borderTop:"1px solid var(--border)",marginTop:"8px",overflowX:"auto"}}>
                        {peerMetric === "returns" && peerReturnMode === "year" ? (
                          /* YEAR TABLE — all years as columns */
                          <table className="peer-tbl" style={{minWidth: `${200 + yearCols.length * 52}px`}}>
                            <thead><tr>
                              <th style={{textAlign:"left"}}>Scheme</th>
                              <th style={{textAlign:"right",cursor:"pointer"}}
                                className={peerSortBy==="aum"?"sort-active":""}
                                onClick={() => setPeerSortBy("aum")}>AUM ↕</th>
                              {yearCols.map(y => (
                                <th key={y}
                                  className={peerYear===y?"sort-active":""}
                                  style={{textAlign:"right",cursor:"pointer",color:peerYear===y?"var(--violet)":undefined}}
                                  onClick={() => { setPeerYear(y); setPeerSortBy("metric"); }}>
                                  {y === new Date().getFullYear().toString() ? `${y}*` : y}
                                  {peerYear===y?" ↓":""}
                                </th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {sortedPeers.slice(0, visibleRows).map((p) => (
                                <tr key={p.id} className={p.id===selected.id?"peer-selected":""}>
                                  <td>
                                    <div className="peer-scheme-name" title={p.name}
                                      style={{color: p.id===selected.id ? "var(--violet)" : undefined}}>
                                      {shortName(p)}
                                    </div>
                                    <div className="peer-scheme-amc">{p.amc}</div>
                                  </td>
                                  <td style={{color:"var(--muted)"}}>—</td>
                                  {yearCols.map(y => {
                                    const v = peerYearReturns[p.id]?.[y] ?? null;
                                    return (
                                      <td key={y} style={{
                                        color: p.id===selected.id && y===peerYear ? "var(--violet)"
                                          : returnColor(v),
                                        fontWeight: y===peerYear ? 500 : 400
                                      }}>
                                        {v != null ? `${v>0?"+":""}${v}%` : "—"}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          /* P2P / RISK TABLE */
                          <table className="peer-tbl">
                            <thead><tr>
                              <th>#</th>
                              <th>Scheme</th>
                              <th className={peerSortBy==="aum"?"sort-active":""}
                                style={{cursor:"pointer"}} onClick={() => setPeerSortBy("aum")}>AUM ↕</th>
                              <th className={peerSortBy==="metric"?"sort-active":""}
                                style={{color:"var(--violet)",cursor:"pointer"}}
                                onClick={() => setPeerSortBy("metric")}>
                                {peerMetric==="returns" ? peerPeriod
                                  : peerMetric==="sharpe" ? "Sharpe"
                                  : peerMetric==="stddev" ? "StdDev"
                                  : peerMetric==="maxdd"  ? "MaxDD"
                                  : "Sortino"} ↓
                              </th>
                            </tr></thead>
                            <tbody>
                              {sortedPeers.slice(0, visibleRows).map((p, i) => {
                                const v = getMetricVal(p);
                                return (
                                  <tr key={p.id} className={p.id===selected.id?"peer-selected":""}>
                                    <td><span className="peer-rank-badge">{i+1}</span></td>
                                    <td>
                                      <div className="peer-scheme-name" title={p.name}
                                        style={{color: p.id===selected.id ? "var(--violet)" : undefined}}>
                                        {shortName(p)}
                                      </div>
                                      <div className="peer-scheme-amc">
                                        {p.amc}
                                        {p.id===selected.id && <span style={{color:"var(--violet)",marginLeft:4}}>· selected</span>}
                                      </div>
                                    </td>
                                    <td style={{color:"var(--muted)"}}>—</td>
                                    <td style={{color: metricColor(v,p), fontWeight: p.id===selected.id?500:400}}>
                                      {fmtMetric(v)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}

                        {/* Expand button */}
                        {sortedPeers.length > 8 && (
                          <button onClick={() => setPeerExpanded(e => !e)} style={{
                            width:"100%", padding:"7px",
                            background:"rgba(99,91,255,0.03)",
                            border:"none", borderTop:"1px dashed rgba(99,91,255,0.18)",
                            cursor:"pointer", fontFamily:"'DM Mono'", fontSize:"10px",
                            color:"var(--violet)", letterSpacing:"1px",
                          }}>
                            {peerExpanded ? "▲ Show less" : `▼ Show all ${sortedPeers.length} funds`}
                          </button>
                        )}

                        {/* Footer */}
                        <div style={{padding:"5px 8px 6px",fontFamily:"'DM Mono'",fontSize:"9px",color:"var(--muted)"}}>
                          {peerMetric==="returns" && peerReturnMode==="year" && `* YTD · `}
                          AUM: data source pending · Returns: AMFI India
                        </div>
                      </div>
                    </div>

                    {/* Fullscreen overlay */}
                    {peerFullscreen && (
                      <div className="peer-overlay"
                        onClick={e => { if (e.target.classList.contains("peer-overlay")) setPeerFullscreen(false); }}>
                        <div className="peer-overlay-panel">
                          <div className="peer-overlay-header">
                            <div className="peer-overlay-title">
                              {selected.category} · {selected.plan} · Peer Comparison
                            </div>
                            <button className="peer-overlay-close" onClick={() => setPeerFullscreen(false)}>✕</button>
                          </div>
                          {/* Metric tabs in overlay */}
                          <div className="peer-tabs" style={{marginBottom:0}}>
                            <div className="peer-tab-group">
                              {METRIC_TABS.map(t => (
                                <button key={t.key}
                                  className={`peer-tab${peerMetric===t.key?" active":""}`}
                                  onClick={() => { setPeerMetric(t.key); if(t.key!=="returns") setPeerReturnMode("p2p"); }}>
                                  {t.label}
                                </button>
                              ))}
                            </div>
                            {peerMetric === "returns" && (
                              <div className="peer-toggle">
                                <button className={`peer-toggle-btn${peerReturnMode==="p2p"?" active":""}`}
                                  onClick={() => setPeerReturnMode("p2p")}>P2P</button>
                                <button className={`peer-toggle-btn${peerReturnMode==="year"?" active":""}`}
                                  onClick={() => setPeerReturnMode("year")}>Year</button>
                              </div>
                            )}
                          </div>
                          {/* Period pills in overlay */}
                          {peerMetric === "returns" && (
                            <div className="peer-pills">
                              {peerReturnMode === "p2p" ? P2P_PERIODS.map(p => (
                                <button key={p} className={`peer-pill${peerPeriod===p?" active":""}`}
                                  onClick={() => setPeerPeriod(p)}>{p}</button>
                              )) : peerNavLoading ? (
                                <span style={{fontFamily:"'DM Mono'",fontSize:10,color:"var(--muted)"}}>Loading...</span>
                              ) : availYears.map(y => (
                                <button key={y} className={`peer-pill${peerYear===y?" active":""}`}
                                  onClick={() => setPeerYear(y)}>
                                  {y === new Date().getFullYear().toString() ? `${y} YTD` : y}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Full peer table — all rows, no expand needed */}
                          <div style={{borderTop:"1px solid rgba(99,91,255,0.1)",marginTop:8,overflowX:"auto"}}>
                            {peerMetric === "returns" && peerReturnMode === "year" ? (
                              <table className="peer-tbl" style={{minWidth:`${200+yearCols.length*56}px`}}>
                                <thead><tr>
                                  <th style={{textAlign:"left"}}>Scheme</th>
                                  <th>AUM</th>
                                  {yearCols.map(y => (
                                    <th key={y} className={peerYear===y?"sort-active":""}
                                      style={{cursor:"pointer",color:peerYear===y?"var(--violet)":undefined}}
                                      onClick={() => { setPeerYear(y); setPeerSortBy("metric"); }}>
                                      {y===new Date().getFullYear().toString()?`${y}*`:y}{peerYear===y?" ↓":""}
                                    </th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {sortedPeers.map(p => (
                                    <tr key={p.id} className={p.id===selected.id?"peer-selected":""}>
                                      <td>
                                        <div className="peer-scheme-name" title={p.name}
                                          style={{color:p.id===selected.id?"var(--violet)":undefined}}>
                                          {shortName(p)}
                                        </div>
                                        <div className="peer-scheme-amc">{p.amc}</div>
                                      </td>
                                      <td style={{color:"var(--muted)"}}>—</td>
                                      {yearCols.map(y => {
                                        const v = peerYearReturns[p.id]?.[y] ?? null;
                                        return (
                                          <td key={y} style={{
                                            color:p.id===selected.id&&y===peerYear?"var(--violet)":returnColor(v),
                                            fontWeight:y===peerYear?500:400
                                          }}>{v!=null?`${v>0?"+":""}${v}%`:"—"}</td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <table className="peer-tbl">
                                <thead><tr>
                                  <th>#</th><th>Scheme</th><th>AUM</th>
                                  <th style={{color:"var(--violet)"}}>
                                    {peerMetric==="returns"?peerPeriod:peerMetric==="sharpe"?"Sharpe":peerMetric==="stddev"?"StdDev":peerMetric==="maxdd"?"MaxDD":"Sortino"} ↓
                                  </th>
                                </tr></thead>
                                <tbody>
                                  {sortedPeers.map((p,i) => {
                                    const v = getMetricVal(p);
                                    return (
                                      <tr key={p.id} className={p.id===selected.id?"peer-selected":""}>
                                        <td><span className="peer-rank-badge">{i+1}</span></td>
                                        <td>
                                          <div className="peer-scheme-name" title={p.name}
                                            style={{color:p.id===selected.id?"var(--violet)":undefined}}>
                                            {shortName(p)}
                                          </div>
                                          <div className="peer-scheme-amc">
                                            {p.amc}{p.id===selected.id&&<span style={{color:"var(--violet)",marginLeft:4}}>· selected</span>}
                                          </div>
                                        </td>
                                        <td style={{color:"var(--muted)"}}>—</td>
                                        <td style={{color:metricColor(v,p),fontWeight:p.id===selected.id?500:400}}>
                                          {fmtMetric(v)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                            <div style={{padding:"5px 8px 6px",fontFamily:"'DM Mono'",fontSize:"9px",color:"var(--muted)"}}>
                              {peerMetric==="returns"&&peerReturnMode==="year"&&`* YTD · `}
                              All {sortedPeers.length} funds · AUM: data source pending · Returns: AMFI India
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </>}

      {/* SOURCE ATTRIBUTION */}
      <footer style={{
        padding:"1rem 2rem",
        borderTop:"1px solid var(--border)",
        textAlign:"center",
        fontFamily:"'DM Mono'",
        fontSize:"10px",
        color:"var(--muted)",
        letterSpacing:"0.5px",
        background:"rgba(255,255,255,0.3)"
      }}>
        Source:{" "}
        <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer"
          style={{color:"var(--violet)",textDecoration:"none"}}>
          AMFI India (amfiindia.com)
        </a>
        {" "}· Data updated daily
      </footer>
    </div>
  );
}
