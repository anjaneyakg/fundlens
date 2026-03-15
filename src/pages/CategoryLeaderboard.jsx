import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const CATINDEX_URL = "https://gist.githubusercontent.com/anjaneyakg/377985ac0904a27a0a328c0834faffda/raw/fundlens_category_index.json";
const DATA_URL     = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";

const returnColor = (v) => v > 0 ? "#059669" : v < 0 ? "#e11d48" : "#6b72a0";

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

  @media (max-width: 768px) {
    .z8-hero { padding: 2rem 1rem 1.5rem; }
    .z8-body { padding: 1rem; }
    .z8-grid { grid-template-columns: 1fr; }
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

  const buildLeaderboard = useCallback((index, plan) => {
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

  const handleSchemeClick = (f) => {
    // Navigate to /schemes with state so Z1 can pick it up
    navigate("/schemes", {
      state: { selectId: f.id, category: f.plan === planUniverse ? undefined : null }
    });
  };

  const categories = Object.keys(leaderboard).sort();
  const totalFunds = Object.values(leaderboard).reduce((s, v) => s + v.length, 0);

  return (
    <div className="z8-page">
      <style>{style}</style>

      {/* HERO */}
      <div className="z8-hero">
        <div className="z8-eyebrow">◆ Z8 · MF Explorer</div>
        <div className="z8-title">CATEGORY<br />LEADERBOARD</div>
        <div className="z8-subtitle">
          Top performers by SEBI category · Growth option · ranked by 1Y return.
          Click any scheme to open its full detail in Scheme Explorer.
        </div>
        <div className="z8-meta-row">
          <div className="z8-pill">
            {planUniverse} · Growth only · 1Y ranked
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
                {(leaderboard[cat] || []).map((f, i) => (
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
                    <div className="z8-ret" style={{color: returnColor(f["1Y"] ?? f.return1Y)}}>
                      {(f["1Y"] ?? f.return1Y) != null
                        ? `${(f["1Y"] ?? f.return1Y) > 0 ? "+" : ""}${f["1Y"] ?? f.return1Y}%`
                        : "—"}
                    </div>
                  </div>
                ))}
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
