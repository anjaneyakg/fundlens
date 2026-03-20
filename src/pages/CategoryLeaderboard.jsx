import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const CATINDEX_URL = "https://gist.githubusercontent.com/anjaneyakg/377985ac0904a27a0a328c0834faffda/raw/fundlens_category_index.json";
const DATA_URL     = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
const RATIOS_URL   = "https://gist.githubusercontent.com/anjaneyakg/90d783d7de0ba4a67b53138dd922a552/raw/fundlens_ratios.json";

const returnColor = (v) => v > 0 ? "#059669" : v < 0 ? "#e11d48" : "#6b72a0";

// SEBI category → type mapping for Type filter
const CAT_TYPE = {
  "Large Cap":"Equity","Mid Cap":"Equity","Small Cap":"Equity","Multi Cap":"Equity",
  "Flexi Cap":"Equity","Large & Mid Cap":"Equity","Focused":"Equity","ELSS":"Equity",
  "Contra":"Equity","Dividend Yield":"Equity","Value":"Equity","Thematic":"Equity",
  "Sectoral":"Equity","Equity":"Equity",
  "Liquid":"Debt","Overnight":"Debt","Money Market":"Debt","Ultra Short Duration":"Debt",
  "Low Duration":"Debt","Short Duration":"Debt","Medium Duration":"Debt",
  "Medium to Long Duration":"Debt","Long Duration":"Debt","Dynamic Bond":"Debt",
  "Corporate Bond":"Debt","Credit Risk":"Debt","Banking & PSU":"Debt",
  "Gilt":"Debt","Floater":"Debt","Debt":"Debt",
  "Aggressive Hybrid":"Hybrid","Conservative Hybrid":"Hybrid","Balanced Hybrid":"Hybrid",
  "Dynamic AA":"Hybrid","Equity Savings":"Hybrid","Multi Asset":"Hybrid",
  "Arbitrage":"Hybrid","Hybrid":"Hybrid",
  "Index":"Passive","ETF":"Passive","Fund of Funds":"Passive",
};

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .z8-page {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 70% 60% at 0% 0%, rgba(99,91,255,0.22) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 100% 0%, rgba(244,63,142,0.18) 0%, transparent 50%),
      radial-gradient(ellipse 50% 60% at 50% 100%, rgba(255,107,53,0.14) 0%, transparent 55%),
      linear-gradient(160deg, #eef2ff 0%, #fdf2f8 40%, #fff7ed 100%);
    font-family: 'Syne', sans-serif;
  }

  .z8-hero {
    padding: 3rem 2rem 2rem;
    border-bottom: 1px solid rgba(99,91,255,0.12);
  }
  .z8-eyebrow {
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 3px;
    color: #635bff; text-transform: uppercase; margin-bottom: 12px;
  }
  .z8-title {
    font-family: 'Bebas Neue'; font-size: clamp(2.5rem, 5vw, 4.5rem);
    line-height: 0.95; letter-spacing: 2px;
    background: linear-gradient(135deg, #4f46e5 0%, #635bff 40%, #f43f8e 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 1rem;
  }
  .z8-subtitle {
    font-family: 'DM Mono'; font-size: 12px; color: #6b72a0;
    letter-spacing: 0.5px; line-height: 1.8; max-width: 560px;
  }
  .z8-meta-row {
    display: flex; align-items: center; gap: 12px;
    margin-top: 1.25rem; flex-wrap: wrap;
  }
  .z8-pill {
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 0.5px;
    padding: 5px 12px; border-radius: 6px;
    background: rgba(99,91,255,0.06);
    border: 1px solid rgba(99,91,255,0.18);
    color: #635bff;
  }
  .z8-stat { display: flex; flex-direction: column; gap: 2px; }
  .z8-stat-val { font-family: 'Bebas Neue'; font-size: 1.4rem; color: #ff6b35; letter-spacing: 1px; }
  .z8-stat-label { font-family: 'DM Mono'; font-size: 10px; color: #6b72a0; letter-spacing: 1px; text-transform: uppercase; }

  .z8-body { padding: 2rem; }

  .z8-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }

  .z8-card {
    background: rgba(255,255,255,0.75);
    border: 1px solid rgba(99,91,255,0.12);
    border-radius: 12px; padding: 16px;
    transition: all 0.15s;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(99,91,255,0.06);
  }
  .z8-card:hover {
    border-color: rgba(255,107,53,0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99,91,255,0.12);
  }
  .z8-cat-label {
    font-family: 'DM Mono'; font-size: 10px; color: #635bff;
    letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;
    padding-bottom: 8px; border-bottom: 1px solid rgba(99,91,255,0.1);
  }
  .z8-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; border-bottom: 1px solid rgba(99,91,255,0.06);
    cursor: pointer; transition: background 0.1s; border-radius: 4px;
  }
  .z8-row:last-child { border-bottom: none; }
  .z8-row:hover { background: rgba(99,91,255,0.04); padding-left: 4px; }
  .z8-row-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  .z8-rank {
    font-family: 'Bebas Neue'; font-size: 14px; color: #6b72a0;
    width: 18px; flex-shrink: 0; text-align: center;
  }
  .z8-rank-1 { color: #ff6b35; }
  .z8-scheme-block { flex: 1; min-width: 0; }
  .z8-scheme-name {
    font-size: 12px; color: #0f0c2e; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.3;
  }
  .z8-scheme-amc {
    font-family: 'DM Mono'; font-size: 9px; color: #6b72a0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-top: 1px;
  }
  .z8-ret {
    font-family: 'DM Mono'; font-size: 12px; font-weight: 500;
    flex-shrink: 0; margin-left: 8px;
  }

  .z8-loading {
    min-height: 60vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 20px;
  }
  .z8-loading-bar {
    width: 260px; height: 3px;
    background: rgba(99,91,255,0.12); border-radius: 2px; overflow: hidden;
  }
  .z8-loading-fill {
    height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, #635bff, #f43f8e);
    animation: z8-load 1.4s ease-in-out infinite;
  }
  @keyframes z8-load {
    0% { width: 0%; margin-left: 0%; }
    50% { width: 60%; margin-left: 20%; }
    100% { width: 0%; margin-left: 100%; }
  }
  .z8-loading-text {
    font-family: 'DM Mono'; font-size: 11px; color: #6b72a0; letter-spacing: 1px;
  }

  .z8-footer {
    padding: 1rem 2rem; border-top: 1px solid rgba(99,91,255,0.12);
    text-align: center; font-family: 'DM Mono'; font-size: 10px;
    color: #6b72a0; background: rgba(255,255,255,0.3);
  }
  .z8-footer a { color: #635bff; text-decoration: none; }

  /* FILTER BAR */
  .z8-filters {
    padding: 1rem 2rem;
    display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
    border-bottom: 1px solid rgba(99,91,255,0.12);
    background: rgba(255,255,255,0.6);
    backdrop-filter: blur(16px);
    position: sticky; top: 60px; z-index: 90;
    box-shadow: 0 2px 12px rgba(99,91,255,0.05);
  }
  .z8-filter-label {
    font-family: 'DM Mono'; font-size: 10px; color: #6b72a0;
    letter-spacing: 1px; text-transform: uppercase; white-space: nowrap;
  }
  .z8-toggle-group {
    display: flex; background: rgba(255,255,255,0.9);
    border: 1px solid rgba(99,91,255,0.12); border-radius: 8px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(99,91,255,0.06);
  }
  .z8-toggle-btn {
    padding: 7px 13px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 0.5px;
    background: transparent; color: #6b72a0; transition: all 0.15s;
    white-space: nowrap;
  }
  .z8-toggle-btn.active {
    background: linear-gradient(135deg, #635bff, #f43f8e);
    color: #fff; font-weight: 500;
  }
  .z8-filter-sep {
    width: 1px; background: rgba(99,91,255,0.12); flex-shrink: 0;
  }
  .z8-results-count {
    margin-left: auto; font-family: 'DM Mono'; font-size: 11px;
    color: #6b72a0; white-space: nowrap;
  }
  .z8-results-count span { color: #635bff; font-weight: 600; }

  @media (max-width: 768px) {
    .z8-hero { padding: 2rem 1rem 1.5rem; }
    .z8-body { padding: 1rem; }
    .z8-grid { grid-template-columns: 1fr; }
    .z8-filters { padding: 0.75rem 1rem; gap: 8px; top: 56px; }
    .z8-toggle-btn { padding: 6px 10px; font-size: 10px; }
  }
`;

function dedupeByName(funds) {
  const seen = new Map();
  for (const f of funds) {
    const name = (f.name || "").trim().toLowerCase();
    if (!seen.has(name) || f.return1Y > seen.get(name).return1Y) {
      seen.set(name, f);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.return1Y - a.return1Y);
}

export default function CategoryLeaderboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState({});
  const [allSchemes,  setAllSchemes]  = useState([]);
  const [planUniverse, setPlanUniverse] = useState(
    () => localStorage.getItem("fundlens_plan_universe") || "Direct"
  );
  const [loading,  setLoading]  = useState(true);
  const [loadMsg,  setLoadMsg]  = useState("Loading category index...");

  // Filters
  const [typeFilter,   setTypeFilter]   = useState("All");   // All|Equity|Debt|Hybrid|Passive
  const [metricMode,   setMetricMode]   = useState("returns"); // returns|sharpe|stddev|maxdd|sortino
  const [period,       setPeriod]       = useState("1Y");    // 1M|3M|6M|1Y|3Y

  // Ratios
  const [ratiosMap,    setRatiosMap]    = useState({});
  const [ratiosLoaded, setRatiosLoaded] = useState(false);
  const [ratiosLoading,setRatiosLoading]= useState(false);

  // Raw index — stored separately so filters can re-apply without re-fetching
  const [rawIndex, setRawIndex] = useState({});

  const buildLeaderboard = useCallback((index, plan) => {
    setRawIndex(index);
    const filtered = {};
    for (const [key, funds] of Object.entries(index)) {
      const [category, p] = key.split("|");
      if (p === plan) filtered[category] = dedupeByName(funds);
    }
    setLeaderboard(filtered);
  }, []);

  // Load category index + scheme list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadMsg("Loading category index...");
        const [catResp, schemeResp] = await Promise.all([
          fetch(CATINDEX_URL),
          fetch(DATA_URL),
        ]);
        if (cancelled) return;
        const cat    = await catResp.json();
        const schemes = await schemeResp.json();
        if (cancelled) return;
        buildLeaderboard(cat.index || {}, planUniverse);
        setAllSchemes(schemes.schemes || []);
      } catch (e) {
        console.error("Z8 load failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync plan universe from Nav toggle
  useEffect(() => {
    const handler = async (e) => {
      setPlanUniverse(e.detail);
      try {
        const resp = await fetch(CATINDEX_URL);
        const cat  = await resp.json();
        buildLeaderboard(cat.index || {}, e.detail);
      } catch {}
    };
    window.addEventListener("fundlens_plan_change", handler);
    return () => window.removeEventListener("fundlens_plan_change", handler);
  }, [buildLeaderboard]);

  // Fetch ratios once
  useEffect(() => {
    if (ratiosLoaded || ratiosLoading) return;
    setRatiosLoading(true);
    fetch(RATIOS_URL)
      .then(r => r.json())
      .then(json => { setRatiosMap(json.ratios || {}); setRatiosLoaded(true); })
      .catch(e => console.warn("Z8 ratios fetch failed:", e.message))
      .finally(() => setRatiosLoading(false));
  }, []);

  // Build schemeMap for quick lookup by id
  const schemeMap = Object.fromEntries(allSchemes.map(s => [String(s.id), s]));

  const handleSchemeClick = (f) => {
    navigate("/schemes", {
      state: { selectId: f.id, category: f.plan === planUniverse ? undefined : null }
    });
  };

  // Get display value for a fund given current metricMode + period
  const getMetricVal = (f) => {
    const s = schemeMap[String(f.id)];
    if (metricMode === "returns") {
      if (period === "1Y") return f.return1Y ?? f["1Y"] ?? null;
      return s?.returns?.[period] ?? null;
    }
    const r = ratiosMap[String(f.id)];
    if (metricMode === "sharpe")  return r?.sharpe      ?? null;
    if (metricMode === "stddev")  return r?.stdDev      ?? null;
    if (metricMode === "maxdd")   return r?.maxDrawdown ?? null;
    if (metricMode === "sortino") return r?.sortino     ?? null;
    return null;
  };

  const fmtMetricVal = (v) => {
    if (v == null) return "—";
    if (metricMode === "returns") return `${v > 0 ? "+" : ""}${typeof v === "number" ? v.toFixed(2) : v}%`;
    if (metricMode === "stddev" || metricMode === "maxdd") return `${v.toFixed(2)}%`;
    return v.toFixed(2);
  };

  const metricColor = (v) => {
    if (v == null) return "#6b72a0";
    if (metricMode === "returns") return returnColor(v);
    if (metricMode === "sharpe" || metricMode === "sortino")
      return v > 1 ? "#059669" : v > 0 ? "#0f0c2e" : "#e11d48";
    return "#0f0c2e";
  };

  const LOWER_IS_BETTER = new Set(["stddev", "maxdd"]);

  // Apply type filter + re-sort by active metric
  const filteredLeaderboard = Object.fromEntries(
    Object.entries(leaderboard)
      .filter(([cat]) => typeFilter === "All" || CAT_TYPE[cat] === typeFilter)
      .map(([cat, funds]) => {
        const sorted = [...funds].sort((a, b) => {
          const av = getMetricVal(a) ?? (LOWER_IS_BETTER.has(metricMode) ? Infinity : -Infinity);
          const bv = getMetricVal(b) ?? (LOWER_IS_BETTER.has(metricMode) ? Infinity : -Infinity);
          return LOWER_IS_BETTER.has(metricMode) ? av - bv : bv - av;
        });
        return [cat, sorted];
      })
  );

  const categories = Object.keys(filteredLeaderboard).sort();
  const totalFunds = Object.values(filteredLeaderboard).reduce((s, v) => s + v.length, 0);

  return (
    <div className="z8-page">
      <style>{style}</style>

      {/* HERO */}
      <div className="z8-hero">
        <div className="z8-eyebrow">◆ Z8 · MF Explorer</div>
        <div className="z8-title">CATEGORY<br />LEADERBOARD</div>
        <div className="z8-subtitle">
          Top performers by Scheme category · Growth option <br /><br />
          Click any scheme to open its full detail in Scheme Explorer.
        </div>
        <div className="z8-meta-row">
          <div className="z8-pill">
            {planUniverse} · Growth only ·{" "}
            {metricMode === "returns" ? `${period} return` : metricMode.toUpperCase()}
          </div>
          {!loading && (
            <>
              <div className="z8-stat">
                <div className="z8-stat-val">{categories.length}</div>
                <div className="z8-stat-label">Categories</div>
              </div>
              <div className="z8-stat">
                <div className="z8-stat-val">{totalFunds}</div>
                <div className="z8-stat-label">Funds shown</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      {!loading && (
        <div className="z8-filters">
          {/* Type filter */}
          <span className="z8-filter-label">Type</span>
          <div className="z8-toggle-group">
            {["All","Equity","Debt","Hybrid","Passive"].map(t => (
              <button key={t}
                className={`z8-toggle-btn${typeFilter===t?" active":""}`}
                onClick={() => setTypeFilter(t)}>{t}</button>
            ))}
          </div>

          <div className="z8-filter-sep"/>

          {/* Metric mode */}
          <span className="z8-filter-label">Sort by</span>
          <div className="z8-toggle-group">
            {[
              {k:"returns", l:"Returns"},
              {k:"sharpe",  l:"Sharpe"},
              {k:"stddev",  l:"Std Dev"},
              {k:"maxdd",   l:"Max DD"},
              {k:"sortino", l:"Sortino"},
            ].map(({k,l}) => (
              <button key={k}
                className={`z8-toggle-btn${metricMode===k?" active":""}`}
                onClick={() => setMetricMode(k)}>{l}</button>
            ))}
          </div>

          {/* Period pills — only when Returns selected */}
          {metricMode === "returns" && (
            <>
              <div className="z8-filter-sep"/>
              <div className="z8-toggle-group">
                {["1M","3M","6M","1Y","3Y"].map(p => (
                  <button key={p}
                    className={`z8-toggle-btn${period===p?" active":""}`}
                    onClick={() => setPeriod(p)}>{p}</button>
                ))}
              </div>
            </>
          )}

          {ratiosLoading && metricMode !== "returns" && (
            <span style={{fontFamily:"'DM Mono'",fontSize:10,color:"#6b72a0"}}>⟳ loading ratios…</span>
          )}

          <div className="z8-results-count">
            <span>{categories.length}</span> categories · <span>{totalFunds}</span> funds
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="z8-body">
        {loading ? (
          <div className="z8-loading">
            <div style={{fontFamily:"'Bebas Neue'",fontSize:"1.8rem",letterSpacing:"2px",
              background:"linear-gradient(135deg,#4f46e5,#635bff,#f43f8e)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              FUNDLENS
            </div>
            <div className="z8-loading-bar"><div className="z8-loading-fill"/></div>
            <div className="z8-loading-text">{loadMsg}</div>
          </div>
        ) : (
          <div className="z8-grid">
            {categories.map(cat => (
              <div className="z8-card" key={cat}>
                <div className="z8-cat-label">{cat}</div>
                {(filteredLeaderboard[cat] || []).map((f, i) => {
                  const val = getMetricVal(f);
                  return (
                    <div className="z8-row" key={f.id}
                      title={f.name}
                      onClick={() => handleSchemeClick(f)}>
                      <div className="z8-row-left">
                        <div className={`z8-rank${i === 0 ? " z8-rank-1" : ""}`}>{i + 1}</div>
                        <div className="z8-scheme-block">
                          <div className="z8-scheme-name">{f.name || f.amc}</div>
                          <div className="z8-scheme-amc">{f.amc}</div>
                        </div>
                      </div>
                      <div className="z8-ret" style={{color: metricColor(val)}}>
                        {fmtMetricVal(val)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="z8-footer">
        Source:{" "}
        <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer">
          AMFI India (amfiindia.com)
        </a>
        {" "}· Data updated daily
      </footer>
    </div>
  );
}
