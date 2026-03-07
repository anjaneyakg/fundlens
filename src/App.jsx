import { useState, useEffect, useCallback, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";

// ─── DATA SOURCE ─────────────────────────────────────────────────────────────
// After running your Colab pipeline, paste the Gist raw URL here:
const DATA_URL = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
// e.g. "https://gist.githubusercontent.com/yourusername/abc123/raw/fundlens_schemes.json"

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1000 ? `₹${(n/1000).toFixed(1)}K Cr` : `₹${n} Cr`;
const returnColor = (v) => v > 0 ? "#059669" : v < 0 ? "#e11d48" : "#6b72a0";
const riskColor = (r) => ({ "Low":"#059669","Moderate":"#d97706","High":"#ea580c","Very High":"#e11d48" }[r] || "#6b72a0");

// ─── STYLES ──────────────────────────────────────────────────────────────────
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f0f4ff;
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
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 0 2rem;
    display: flex; align-items: center; justify-content: space-between;
    height: 64px;
    box-shadow: 0 1px 0 rgba(99,91,255,0.08), 0 4px 24px rgba(99,91,255,0.06);
  }
  .nav-logo { display: flex; align-items: center; gap: 10px; }
  .nav-logo-mark {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--violet), var(--pink));
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Bebas Neue'; font-size: 18px; color: #fff; letter-spacing: 0;
    box-shadow: 0 4px 12px rgba(99,91,255,0.35);
  }
  .nav-brand { font-family: 'Bebas Neue'; font-size: 22px; letter-spacing: 2px; color: var(--text); }
  .nav-brand span { color: var(--violet); }
  .nav-tag {
    font-family: 'DM Mono'; font-size: 10px; color: var(--muted);
    border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px;
    letter-spacing: 1px; background: rgba(99,91,255,0.05);
  }
  .nav-live {
    display: flex; align-items: center; gap: 6px;
    font-family: 'DM Mono'; font-size: 11px; color: var(--emerald);
  }
  .live-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--emerald);
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }

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
    position: sticky; top: 64px; z-index: 90;
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
    grid-template-columns: 2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr;
    gap: 0; margin-bottom: 1rem;
    font-family: 'DM Mono'; font-size: 10px; color: var(--muted);
    letter-spacing: 1px; text-transform: uppercase; padding: 0 12px;
  }
  .sort-btn { background: none; border: none; color: var(--muted); font-family: 'DM Mono'; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; text-align: right; padding: 0; }
  .sort-btn:hover { color: var(--violet); }
  .sort-btn.active { color: var(--orange); }

  .scheme-card {
    display: grid;
    grid-template-columns: 2.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr;
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
  <div className="ret-cell" style={{ color: returnColor(value) }}>
    {value > 0 ? "+" : ""}{value}%
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
  const [search,      setSearch]      = useState("");
  const [amcFilter,   setAmcFilter]   = useState("All");
  const [catFilter,   setCatFilter]   = useState("All");
  const [typeFilter,  setTypeFilter]  = useState("All");
  const [planFilter,  setPlanFilter]  = useState("Direct");
  const [sortKey,     setSortKey]     = useState("1Y");
  const [sortDir,     setSortDir]     = useState(-1);
  const [selected,    setSelected]    = useState(null);
  const [tab,         setTab]         = useState("schemes");

  // ── Fetch data
  const loadData = useCallback(async () => {
    setLoading(true); setError(null); setLoadPct(10);
    setLoadMsg("Connecting to data source...");
    try {
      if (!DATA_URL || DATA_URL === "YOUR_GIST_RAW_URL_HERE") {
        throw new Error("DATA_URL not configured. Run the Colab pipeline first, then paste your Gist raw URL into the DATA_URL constant.");
      }
      setLoadPct(30); setLoadMsg("Fetching scheme data...");
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
      setLoadPct(65); setLoadMsg("Parsing analytics data...");
      const json = await resp.json();
      setLoadPct(85); setLoadMsg("Building dashboard...");
      setAllSchemes(json.schemes   || []);
      setAmcList(json.amcs         || []);
      setCategoryList(json.categories || []);
      setLeaderboard(json.leaderboard || {});
      setRollingMap(json.rolling   || {});
      setMeta(json.meta            || null);
      setLoadPct(100); setLoadMsg("Ready!");
      setTimeout(() => setLoading(false), 300);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtering & sorting
  const filtered = allSchemes.filter(s => {
    if (planFilter !== "All" && s.plan     !== planFilter)  return false;
    if (amcFilter  !== "All" && s.amc      !== amcFilter)   return false;
    if (typeFilter !== "All" && s.type     !== typeFilter)   return false;
    if (catFilter  !== "All" && s.category !== catFilter)    return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
                  !s.amc.toLowerCase().includes(search.toLowerCase()))  return false;
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

  const handleSort = (k) => {
    if (sortKey === k) setSortDir(d => -d);
    else { setSortKey(k); setSortDir(-1); }
  };

  const peers = selected
    ? allSchemes.filter(s => s.category === selected.category && s.plan === selected.plan)
    : [];

  const sortCols = [
    { key:"1W",     label:"1W"    },
    { key:"1M",     label:"1M"    },
    { key:"3M",     label:"3M"    },
    { key:"1Y",     label:"1Y"    },
    { key:"3Y",     label:"3Y"    },
    { key:"5Y",     label:"5Y"    },
    { key:"SHARPE", label:"Sharpe"},
  ];

  // ── Loading / Error states
  if (loading) return <><style>{style}</style><LoadingScreen progress={loadPct} message={loadMsg}/></>;
  if (error)   return <><style>{style}</style><ErrorScreen error={error} onRetry={loadData}/></>;

  return (
    <div className="app">
      <style>{style}</style>

      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-mark">F</div>
          <div className="nav-brand">FUND<span>LENS</span></div>
          <div className="nav-tag">ADVISOR TERMINAL</div>
        </div>
        <div style={{display:"flex",gap:"16px",alignItems:"center"}}>
          {meta && (
            <div style={{fontFamily:"'DM Mono'",fontSize:"10px",color:"var(--muted)"}}>
              Updated {meta.generatedAt?.slice(0,10)}
            </div>
          )}
          <div className="nav-live"><div className="live-dot"/>LIVE DATA</div>
          <div style={{fontFamily:"'DM Mono'",fontSize:"11px",color:"var(--muted)"}}>
            {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
          </div>
        </div>
      </nav>

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

      {/* TABS */}
      <div style={{padding:"0 2rem",borderBottom:"1px solid var(--border)",display:"flex",gap:"0"}}>
        {["schemes","leaderboard"].map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"14px 20px",background:"none",border:"none",cursor:"pointer",
            fontFamily:"'DM Mono'",fontSize:"11px",letterSpacing:"1.5px",textTransform:"uppercase",
            color: tab===t ? "var(--violet)" : "var(--muted)",
            borderBottom: tab===t ? "2px solid var(--violet)" : "2px solid transparent",
            transition:"all 0.15s"
          }}>
            {t === "schemes" ? "◈ Scheme Explorer" : "◆ Category Leaderboard"}
          </button>
        ))}
      </div>

      {tab === "schemes" && <>
        <div className="filters-bar">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Search scheme or AMC..."
              value={search} onChange={e=>setSearch(e.target.value)} />
          </div>

          {/* Direct / Regular toggle */}
          <div className="toggle-group">
            {["All","Direct","Regular"].map(p => (
              <button key={p} className={`toggle-btn ${planFilter===p?"active":""}`}
                onClick={()=>setPlanFilter(p)}>{p}</button>
            ))}
          </div>

          {/* Asset type filter */}
          <div className="toggle-group">
            {["All","Equity","Debt","Hybrid","Passive","FoF"].map(t => (
              <button key={t} className={`toggle-btn ${typeFilter===t?"active":""}`}
                onClick={()=>setTypeFilter(t)}>{t}</button>
            ))}
          </div>

          <select className="filter-select" value={amcFilter} onChange={e=>setAmcFilter(e.target.value)}>
            <option value="All">All AMCs</option>
            {amcList.map(a=><option key={a}>{a}</option>)}
          </select>

          <select className="filter-select" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categoryList.map(c=><option key={c}>{c}</option>)}
          </select>

          <div className="results-count"><span>{filtered.length}</span> of {allSchemes.length} schemes</div>
        </div>

        <div className="main">
          <div className="scheme-list">
            <div className="sort-bar">
              <div>Scheme</div>
              {sortCols.map(c => (
                <button key={c.key} className={`sort-btn ${sortKey===c.key?"active":""}`}
                  onClick={()=>handleSort(c.key)}>
                  {c.label} {sortKey===c.key ? (sortDir===-1?"↓":"↑") : ""}
                </button>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="no-results">No schemes match your filters.</div>
            )}

            {filtered.slice(0,80).map((s,i) => (
              <div key={s.id}
                className={`scheme-card ${selected?.id === s.id ? "selected" : ""}`}
                style={{animationDelay:`${Math.min(i,20)*0.02}s`}}
                onClick={() => setSelected(s)}
              >
                <div className="scheme-name-col">
                  <div className="scheme-name">{s.name}</div>
                  <div className="scheme-meta">
                    <span className="tag tag-cat">{s.category}</span>
                    <span className="tag tag-plan-d">{s.type}</span>
                  </div>
                </div>
                <ReturnCell value={s.returns?.["1W"]} />
                <ReturnCell value={s.returns?.["1M"]} />
                <ReturnCell value={s.returns?.["3M"]} />
                <ReturnCell value={s.returns?.["1Y"]} />
                <ReturnCell value={s.returns?.["3Y"]} />
                <ReturnCell value={s.returns?.["5Y"]} />
                <div className="ret-cell" style={{color: (s.risk?.sharpe ?? 0) > 1 ? "var(--violet)" : "var(--muted)"}}>
                  {s.risk?.sharpe != null ? s.risk.sharpe.toFixed(2) : "—"}
                </div>
              </div>
            ))}
            {filtered.length > 80 && (
              <div style={{textAlign:"center",padding:"1rem",fontFamily:"'DM Mono'",
                fontSize:"11px",color:"var(--muted)"}}>
                Showing 80 of {filtered.length} — refine filters to narrow results
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
                    <span className="tag" style={{background:"rgba(244,63,142,0.1)",color:"var(--pink)",border:"1px solid rgba(244,63,142,0.2)"}}>
                      Direct
                    </span>
                  </div>
                  <div className="panel-nav-row">
                    <div>
                      <div className="panel-nav-label">NAV ({selected.navDate})</div>
                      <div className="panel-nav-val">₹{selected.nav}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="panel-nav-label">Since</div>
                      <div style={{fontFamily:"'DM Mono'",fontSize:"12px",color:"var(--muted)"}}>
                        {selected.inceptionDate}
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
                <div className="panel-section-title">Risk Metrics (252-day)</div>
                <div className="info-grid">
                  <div className="info-tile">
                    <div className="info-label">Sharpe Ratio</div>
                    <div className="info-val" style={{color: (selected.risk?.sharpe??0)>1?"var(--violet)":"var(--text)"}}>
                      {selected.risk?.sharpe ?? "—"}
                    </div>
                  </div>
                  <div className="info-tile">
                    <div className="info-label">Std Dev (Ann.)</div>
                    <div className="info-val">{selected.risk?.stdDev != null ? `${selected.risk.stdDev}%` : "—"}</div>
                  </div>
                  <div className="info-tile">
                    <div className="info-label">Max Drawdown</div>
                    <div className="info-val" style={{color:"var(--red)"}}>
                      {selected.risk?.maxDD != null ? `${selected.risk.maxDD}%` : "—"}
                    </div>
                  </div>
                  <div className="info-tile">
                    <div className="info-label">Risk Grade</div>
                    <div className="info-val" style={{color:riskColor(selected.risk?.grade)}}>
                      {selected.risk?.grade ?? "—"}
                    </div>
                  </div>
                </div>

                {/* Rolling returns chart */}
                <div className="panel-section-title">1Y Rolling Returns</div>
                <RollingChart data={rollingMap[String(selected.id)] || []} />

                {/* Peer bar chart */}
                {peers.length > 1 && (() => {
                  const sorted = [...peers].sort((a,b)=>(b.returns?.["1Y"]??-999)-(a.returns?.["1Y"]??-999)).slice(0,6);
                  const maxRet = Math.max(...sorted.map(p=>p.returns?.["1Y"]??0));
                  return (
                    <>
                      <div className="panel-section-title">1Y Return — Peer Benchmark</div>
                      <div className="bar-chart">
                        {sorted.map(p => (
                          <div className="bar-row" key={p.id}>
                            <div className="bar-label" style={{color:p.id===selected.id?"var(--violet)":undefined,fontSize:"9px"}}>
                              {p.amc.split(" ")[0].slice(0,4).toUpperCase()}
                            </div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{
                                width:`${Math.max(2,((p.returns?.["1Y"]??0)/maxRet)*100)}%`,
                                background: p.id===selected.id
                                  ? "linear-gradient(90deg,var(--violet),var(--pink))"
                                  : "rgba(99,91,255,0.12)"
                              }}/>
                            </div>
                            <div className="bar-val" style={{color:p.id===selected.id?"var(--violet)":returnColor(p.returns?.["1Y"])}}>
                              {p.returns?.["1Y"] != null ? `${p.returns["1Y"]>0?"+":""}${p.returns["1Y"]}%` : "—"}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="panel-section-title">Category Ranking — 1Y</div>
                      <table className="peer-table">
                        <thead><tr>
                          <th>#</th><th>Fund</th><th>1Y</th><th>3Y</th><th>Sharpe</th>
                        </tr></thead>
                        <tbody>
                          {[...peers].sort((a,b)=>(b.returns?.["1Y"]??-999)-(a.returns?.["1Y"]??-999))
                            .slice(0,8).map((p,i) => (
                            <tr key={p.id} className={p.id===selected.id?"highlight":""}>
                              <td><span className="peer-rank">{i+1}</span></td>
                              <td><div className="peer-name" title={p.name}>{p.amc}</div></td>
                              <td style={{color:returnColor(p.returns?.["1Y"])}}>
                                {p.returns?.["1Y"] != null ? `${p.returns["1Y"]>0?"+":""}${p.returns["1Y"]}%` : "—"}
                              </td>
                              <td style={{color:returnColor(p.returns?.["3Y"])}}>
                                {p.returns?.["3Y"] != null ? `${p.returns["3Y"]>0?"+":""}${p.returns["3Y"]}%` : "—"}
                              </td>
                              <td style={{color:"var(--muted)"}}>{p.risk?.sharpe ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </>}

      {tab === "leaderboard" && (
        <div className="leaderboard">
          <div className="lb-title">◆ TOP PERFORMERS BY CATEGORY — 1Y RETURNS</div>
          <div className="lb-grid">
            {Object.entries(leaderboard).map(([cat, funds]) => (
              <div className="lb-card" key={cat}>
                <div className="lb-cat">{cat}</div>
                {(funds || []).map((f,i) => (
                  <div className="lb-row" key={f.id}
                    onClick={()=>{
                      const full = allSchemes.find(s=>s.id===f.id);
                      if(full){setSelected(full);setTab("schemes");}
                    }}
                    style={{cursor:"pointer"}}>
                    <div className="lb-row-rank">{i+1}</div>
                    <div className="lb-row-name" title={f.name}>{f.amc}</div>
                    <div className="lb-row-ret" style={{color:returnColor(f["1Y"])}}>
                      {f["1Y"] != null ? `${f["1Y"]>0?"+":""}${f["1Y"]}%` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <Analytics />
    </div>
  );
}
