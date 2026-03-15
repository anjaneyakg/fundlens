import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DATA_URL     = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
const NAVHIST_BASE = "https://gist.githubusercontent.com/anjaneyakg/6f82d116b7067a8d13aa620e99aa783f/raw";
const MAX_SCHEMES  = 3;
const COLORS       = ["#635bff", "#f43f8e", "#ff6b35"];
const COLOR_LABELS = ["violet", "pink", "orange"];

// ─── Style ────────────────────────────────────────────────────────────────────
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #eef2ff;
    --surface: rgba(255,255,255,0.75);
    --border: rgba(99,91,255,0.12);
    --violet: #635bff;
    --pink: #f43f8e;
    --orange: #ff6b35;
    --text: #0f0c2e;
    --muted: #6b72a0;
  }

  .z2-app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 70% 60% at 0% 0%, rgba(99,91,255,0.22) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 100% 0%, rgba(244,63,142,0.18) 0%, transparent 50%),
      linear-gradient(160deg, #eef2ff 0%, #fdf2f8 40%, #fff7ed 100%);
    font-family: 'Syne', sans-serif;
    color: var(--text);
  }

  .z2-hero {
    padding: 3rem 2rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  .z2-eyebrow { font-family:'DM Mono'; font-size:11px; letter-spacing:3px; color:var(--violet); text-transform:uppercase; margin-bottom:10px; }
  .z2-title {
    font-family:'Bebas Neue'; font-size:clamp(3rem,6vw,4.5rem);
    line-height:0.95; letter-spacing:2px;
    background:linear-gradient(135deg,#4f46e5 0%,#635bff 40%,#f43f8e 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    margin-bottom:0.75rem;
  }
  .z2-sub { font-family:'DM Mono'; font-size:12px; color:var(--muted); letter-spacing:0.5px; }

  .z2-body { max-width: 1100px; margin: 0 auto; padding: 2rem; }

  /* Scheme picker cards */
  .z2-pickers { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 1.5rem; }
  .z2-picker-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px;
    backdrop-filter: blur(8px);
  }
  .z2-picker-card.slot-empty { border-style: dashed; opacity: 0.7; }
  .z2-picker-accent { height: 3px; border-radius: 2px; margin-bottom: 12px; }
  .z2-picker-label { font-family:'DM Mono'; font-size:10px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; }
  .z2-search-wrap { position:relative; }
  .z2-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:13px; }
  .z2-search-input {
    width:100%; padding:8px 10px 8px 30px;
    background:rgba(255,255,255,0.9); border:1px solid var(--border);
    border-radius:7px; color:var(--text);
    font-family:'DM Mono'; font-size:12px; outline:none;
    transition: border 0.2s;
  }
  .z2-search-input:focus { border-color: var(--violet); }
  .z2-dropdown {
    position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:200;
    background:#fff; border:1px solid rgba(99,91,255,0.18);
    border-radius:8px; box-shadow:0 8px 32px rgba(99,91,255,0.12);
    max-height:220px; overflow-y:auto;
  }
  .z2-dropdown-item { padding:8px 12px; cursor:pointer; transition:background 0.1s; }
  .z2-dropdown-item:hover { background:rgba(99,91,255,0.05); }
  .z2-dropdown-name { font-family:'DM Mono'; font-size:11px; color:var(--text); }
  .z2-dropdown-meta { font-family:'DM Mono'; font-size:9px; color:var(--muted); margin-top:2px; }
  .z2-selected-scheme { margin-top:10px; }
  .z2-selected-name { font-size:13px; font-weight:600; color:var(--text); line-height:1.3; margin-bottom:4px; }
  .z2-selected-meta { font-family:'DM Mono'; font-size:10px; color:var(--muted); }
  .z2-clear-btn {
    font-family:'DM Mono'; font-size:9px; color:var(--muted); background:none;
    border:1px solid var(--border); border-radius:4px; padding:2px 7px;
    cursor:pointer; margin-top:6px; transition:all 0.15s;
  }
  .z2-clear-btn:hover { color:var(--violet); border-color:var(--violet); }
  .z2-add-btn {
    width:100%; padding:10px; background:none; border:1px dashed rgba(99,91,255,0.25);
    border-radius:7px; color:var(--muted); font-family:'DM Mono'; font-size:11px;
    cursor:pointer; transition:all 0.15s; margin-top:8px;
  }
  .z2-add-btn:hover { border-color:var(--violet); color:var(--violet); }

  /* Date input */
  .z2-date-row {
    display:flex; align-items:center; gap:12px; margin-bottom:1.5rem;
    background:var(--surface); border:1px solid var(--border); border-radius:10px;
    padding:14px 18px; flex-wrap:wrap;
  }
  .z2-date-label { font-family:'DM Mono'; font-size:10px; color:var(--muted); letter-spacing:1px; text-transform:uppercase; }
  .z2-date-input {
    padding:7px 12px; background:rgba(255,255,255,0.9); border:1px solid var(--border);
    border-radius:6px; font-family:'DM Mono'; font-size:12px; color:var(--text); outline:none;
  }
  .z2-date-input:focus { border-color:var(--violet); }
  .z2-overlap-info { font-family:'DM Mono'; font-size:10px; color:var(--violet); }
  .z2-compare-btn {
    padding:10px 28px; background:linear-gradient(135deg,var(--violet),var(--pink));
    border:none; border-radius:8px; color:#fff;
    font-family:'DM Mono'; font-size:11px; letter-spacing:1px; text-transform:uppercase;
    cursor:pointer; transition:opacity 0.15s; margin-left:auto;
  }
  .z2-compare-btn:disabled { opacity:0.4; cursor:not-allowed; }

  /* Section card */
  .z2-card {
    background:var(--surface); border:1px solid var(--border);
    border-radius:12px; padding:20px 24px; margin-bottom:16px;
    backdrop-filter:blur(8px);
  }
  .z2-section-title {
    font-family:'DM Mono'; font-size:10px; color:var(--muted);
    letter-spacing:2px; text-transform:uppercase;
    margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid var(--border);
  }

  /* Legend */
  .z2-legend { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:14px; }
  .z2-legend-item { display:flex; align-items:center; gap:6px; font-family:'DM Mono'; font-size:10px; color:var(--muted); }
  .z2-legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }

  /* Comparison table */
  .z2-table { width:100%; border-collapse:collapse; }
  .z2-table th {
    font-family:'DM Mono'; font-size:10px; color:var(--muted);
    letter-spacing:1px; text-transform:uppercase;
    padding:8px 12px; text-align:right; border-bottom:1px solid var(--border);
  }
  .z2-table th:first-child { text-align:left; }
  .z2-table td {
    padding:9px 12px; border-bottom:1px solid rgba(99,91,255,0.05);
    font-family:'DM Mono'; font-size:12px; text-align:right;
  }
  .z2-table td:first-child { text-align:left; color:var(--muted); font-size:11px; }
  .z2-table tr:last-child td { border-bottom:none; }

  /* Rank badge */
  .z2-rank {
    display:inline-flex; align-items:center; justify-content:center;
    width:18px; height:18px; border-radius:50%;
    font-family:'DM Mono'; font-size:9px; font-weight:500;
    margin-left:5px; vertical-align:middle;
  }
  .z2-rank-1 { background:rgba(234,179,8,0.15); color:#854d0e; border:1px solid rgba(234,179,8,0.3); }
  .z2-rank-2 { background:rgba(148,163,184,0.15); color:#475569; border:1px solid rgba(148,163,184,0.3); }
  .z2-rank-3 { background:rgba(180,120,80,0.12); color:#7c3b1e; border:1px solid rgba(180,120,80,0.25); }

  /* Rolling chart */
  .z2-rolling-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px; }
  .z2-rolling-label { font-family:'DM Mono'; font-size:10px; color:var(--muted); margin-bottom:6px; }

  /* Loading */
  .z2-loading { text-align:center; padding:2rem; font-family:'DM Mono'; font-size:11px; color:var(--muted); }

  /* Footer */
  .z2-footer {
    text-align:center; padding:1rem 2rem;
    border-top:1px solid var(--border);
    font-family:'DM Mono'; font-size:10px; color:var(--muted);
    background:rgba(255,255,255,0.3);
  }
  .z2-footer a { color:var(--violet); text-decoration:none; }

  @media (max-width:768px) {
    .z2-pickers { grid-template-columns:1fr; }
    .z2-body { padding:1rem; }
    .z2-date-row { flex-direction:column; align-items:flex-start; }
    .z2-compare-btn { width:100%; text-align:center; }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtRet  = (v) => v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const fmtRisk = (v, decimals=2) => v == null ? "—" : v.toFixed(decimals);
const returnColor = (v) => v == null ? "#6b72a0" : v > 0 ? "#059669" : v < 0 ? "#e11d48" : "#6b72a0";

const categorySlug = (category, plan) => {
  const slug = category.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
  return `nav_${slug}_${plan.toLowerCase()}.json`;
};

const getOption = (s) => {
  const full = ((s.navName || s.name) || "").trim();
  const suffix = full.split("-").pop().trim().toLowerCase();
  if (suffix.includes("idcw")||suffix.includes("dividend")||suffix.includes("payout")||suffix.includes("reinvestment")) return "IDCW";
  if (suffix.includes("bonus")) return "Bonus";
  return "Growth";
};

// Rank helper — returns 1,2,3 for each value. higherBetter=true means highest value = rank 1
function getRanks(values, higherBetter=true) {
  const indexed = values.map((v,i) => ({v,i})).filter(x => x.v != null);
  indexed.sort((a,b) => higherBetter ? b.v - a.v : a.v - b.v);
  const ranks = new Array(values.length).fill(null);
  indexed.forEach((x,pos) => { ranks[x.i] = pos+1; });
  return ranks;
}

// ─── Indexed Growth Chart ─────────────────────────────────────────────────────
function IndexedChart({ navHistories, schemes, startDate }) {
  if (!navHistories || navHistories.length === 0) return null;

  const W = 720, H = 260, PAD = { t:16, r:20, b:36, l:56 };
  const IW = W - PAD.l - PAD.r, IH = H - PAD.t - PAD.b;

  // Build indexed series for each scheme
  const series = navHistories.map((hist, si) => {
    if (!hist || hist.length === 0) return [];
    const filtered = hist.filter(e => e.date >= startDate);
    if (filtered.length === 0) return [];
    const base = filtered[0].nav;
    return filtered.map(e => ({ date: e.date, idx: (e.nav / base) * 100 }));
  });

  if (series.every(s => s.length === 0)) return null;

  // Date range
  const allDates = series.flatMap(s => s.map(e => e.date)).sort();
  const minDate  = allDates[0];
  const maxDate  = allDates[allDates.length - 1];
  const dateRange = new Date(maxDate) - new Date(minDate) || 1;

  // Value range
  const allVals = series.flatMap(s => s.map(e => e.idx));
  const minVal  = Math.min(...allVals, 95);
  const maxVal  = Math.max(...allVals, 105);
  const valRange = (maxVal - minVal) || 1;

  const xScale = (date) => PAD.l + ((new Date(date) - new Date(minDate)) / dateRange) * IW;
  const yScale = (v)    => PAD.t + IH - ((v - minVal) / valRange) * IH;

  const toPath = (pts) => pts.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Y ticks
  const yStep  = valRange > 50 ? 20 : valRange > 20 ? 10 : 5;
  const yStart = Math.ceil(minVal / yStep) * yStep;
  const yTicks = [];
  for (let v = yStart; v <= maxVal; v += yStep) yTicks.push(v);

  // X ticks — show ~5 dates
  const xTickCount = 5;
  const xTicks = series[0]?.filter((_,i,arr) => i % Math.max(1,Math.floor(arr.length/xTickCount))===0 || i===arr.length-1) || [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}>
      <defs>
        {series.map((_, si) => (
          <linearGradient key={si} id={`z2grad${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[si]} stopOpacity="0.12"/>
            <stop offset="100%" stopColor={COLORS[si]} stopOpacity="0.01"/>
          </linearGradient>
        ))}
      </defs>

      {/* 100 baseline */}
      {minVal <= 100 && maxVal >= 100 && (
        <line x1={PAD.l} y1={yScale(100)} x2={PAD.l+IW} y2={yScale(100)}
          stroke="rgba(99,91,255,0.2)" strokeWidth="1" strokeDasharray="4,3"/>
      )}

      {/* Grid */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.l} y1={yScale(v)} x2={PAD.l+IW} y2={yScale(v)}
            stroke="rgba(99,91,255,0.06)" strokeWidth="0.5"/>
          <text x={PAD.l-6} y={yScale(v)+4} textAnchor="end"
            fill="#6b72a0" fontSize="9" fontFamily="DM Mono, monospace">
            {v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* X ticks */}
      {xTicks.map((e,i) => (
        <text key={i} x={xScale(e.date)} y={PAD.t+IH+14} textAnchor="middle"
          fill="#6b72a0" fontSize="8.5" fontFamily="DM Mono, monospace">
          {e.date.slice(0,7)}
        </text>
      ))}

      {/* Areas + lines */}
      {series.map((s, si) => {
        if (s.length < 2) return null;
        const pts = s.map(e => ({ x: xScale(e.date), y: yScale(e.idx) }));
        const base = yScale(minVal);
        return (
          <g key={si}>
            <path d={`${toPath(pts)} L${pts[pts.length-1].x},${base} L${pts[0].x},${base} Z`}
              fill={`url(#z2grad${si})`}/>
            <path d={toPath(pts)} fill="none" stroke={COLORS[si]} strokeWidth="2" strokeLinecap="round"/>
          </g>
        );
      })}

      {/* Terminal value labels */}
      {series.map((s, si) => {
        if (s.length === 0) return null;
        const last = s[s.length-1];
        const x = xScale(last.date);
        const y = yScale(last.idx);
        return (
          <g key={si}>
            <circle cx={x} cy={y} r="3" fill={COLORS[si]}/>
            <text x={x+6} y={y+4} fill={COLORS[si]} fontSize="10" fontFamily="DM Mono, monospace" fontWeight="500">
              {last.idx.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Rolling Returns Chart (per scheme) ──────────────────────────────────────
function RollingSparkline({ navHist, color, label }) {
  if (!navHist || navHist.length < 252) return (
    <div>
      <div className="z2-rolling-label">{label}</div>
      <div style={{fontFamily:"'DM Mono'",fontSize:10,color:"#6b72a0",padding:"8px 0"}}>
        Insufficient history (&lt;252 days)
      </div>
    </div>
  );

  // Compute 1Y rolling returns
  const rolling = [];
  for (let i = 252; i < navHist.length; i++) {
    const ret = ((navHist[i].nav - navHist[i-252].nav) / navHist[i-252].nav) * 100;
    rolling.push({ date: navHist[i].date, ret });
  }
  if (rolling.length < 2) return null;

  const vals  = rolling.map(d => d.ret);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const range = (max - min) || 1;
  const W = 280, H = 60;
  const pts = rolling.map((d,i) => {
    const x = (i / (rolling.length-1)) * W;
    const y = H - ((d.ret - min) / range) * (H-8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const zeroY = H - ((0 - min) / range) * (H-8) - 4;
  const latest = rolling[rolling.length-1].ret;

  return (
    <div>
      <div className="z2-rolling-label" style={{color}}>
        {label}
        <span style={{marginLeft:8,fontSize:11,fontWeight:500}}>
          {latest >= 0 ? "+" : ""}{latest.toFixed(1)}% latest
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:W,display:"block"}}>
        <defs>
          <linearGradient id={`rg${label.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {min < 0 && max > 0 && (
          <line x1="0" y1={zeroY} x2={W} y2={zeroY}
            stroke="rgba(99,91,255,0.2)" strokeWidth="0.8" strokeDasharray="3,3"/>
        )}
        <polyline points={`0,${H} ${pts} ${W},${H}`}
          fill={`url(#rg${label.replace(/\s/g,"")})`} stroke="none"/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"'DM Mono'",fontSize:9,color:"#6b72a0",marginTop:3}}>
        <span>{rolling[0].date.slice(0,7)}</span>
        <span>1Y Rolling Returns</span>
        <span>{rolling[rolling.length-1].date.slice(0,7)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CompareSchemes() {
  const [allSchemes, setAllSchemes]   = useState([]);
  const [amcList,    setAmcList]      = useState([]);
  const [dataLoaded, setDataLoaded]   = useState(false);

  // Up to 3 scheme slots
  const [slots,      setSlots]        = useState([null, null, null]); // scheme objects or null
  const [queries,    setQueries]      = useState(["","",""]);
  const [dropdowns,  setDropdowns]    = useState([false,false,false]);
  const [results,    setResults]      = useState([[],[],[]]);
  const searchRefs = [useRef(null), useRef(null), useRef(null)];

  // NAV data
  const [navHistories, setNavHistories] = useState([null,null,null]);
  const [navLoading,   setNavLoading]   = useState(false);
  const [overlapInfo,  setOverlapInfo]  = useState(null);

  // Comparison params
  const [startDate, setStartDate] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compared,  setCompared]  = useState(false);

  const planUniverse = localStorage.getItem("fundlens_plan_universe") || "Direct";

  // Load scheme master
  useEffect(() => {
    if (dataLoaded) return;
    fetch(DATA_URL).then(r => r.json()).then(json => {
      setAllSchemes(json.schemes || []);
      setAmcList(json.amcs || []);
      setDataLoaded(true);
    }).catch(e => console.error("Z2 scheme load failed", e));
  }, [dataLoaded]);

  // Search handler
  const handleSearch = useCallback((idx, q) => {
    const newQ = [...queries]; newQ[idx] = q; setQueries(newQ);
    if (!q || q.length < 2) { const nd=[...dropdowns]; nd[idx]=false; setDropdowns(nd); return; }
    const lq = q.toLowerCase();
    const hits = allSchemes
      .filter(s => s.plan === planUniverse && getOption(s) === "Growth")
      .filter(s => s.name.toLowerCase().includes(lq) || s.amc.toLowerCase().includes(lq))
      .slice(0, 25);
    const nr = [...results]; nr[idx] = hits; setResults(nr);
    const nd = [...dropdowns]; nd[idx] = hits.length > 0; setDropdowns(nd);
  }, [allSchemes, queries, dropdowns, results, planUniverse]);

  // Select scheme
  const selectScheme = (idx, scheme) => {
    const ns = [...slots]; ns[idx] = scheme; setSlots(ns);
    const nq = [...queries]; nq[idx] = scheme.name; setQueries(nq);
    const nd = [...dropdowns]; nd[idx] = false; setDropdowns(nd);
    setCompared(false); setOverlapInfo(null); setNavHistories([null,null,null]);
  };

  // Clear slot
  const clearSlot = (idx) => {
    const ns = [...slots]; ns[idx] = null; setSlots(ns);
    const nq = [...queries]; nq[idx] = ""; setQueries(nq);
    setCompared(false); setOverlapInfo(null);
  };

  // Outside click closes dropdowns
  useEffect(() => {
    const handler = (e) => {
      const nd = dropdowns.map((open, i) =>
        open && searchRefs[i].current && !searchRefs[i].current.contains(e.target) ? false : open
      );
      if (nd.some((v,i) => v !== dropdowns[i])) setDropdowns(nd);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdowns]);

  // Active schemes (non-null slots)
  const activeSchemes = slots.filter(Boolean);
  const activeIndices = slots.map((s,i) => s ? i : -1).filter(i => i >= 0);

  // Fetch NAV histories when ≥2 schemes selected
  useEffect(() => {
    if (activeSchemes.length < 2) { setOverlapInfo(null); setNavHistories([null,null,null]); return; }
    setNavLoading(true);
    const fetches = slots.map(s => {
      if (!s) return Promise.resolve(null);
      return fetch(`${NAVHIST_BASE}/${categorySlug(s.category, s.plan)}`)
        .then(r => r.json())
        .then(json => json[s.id] || [])
        .catch(() => []);
    });
    Promise.all(fetches).then(hists => {
      setNavHistories(hists);
      // Compute overlap
      const active = hists.filter(h => h && h.length > 0);
      if (active.length < 2) { setNavLoading(false); return; }
      const fromDates = active.map(h => h[0].date);
      const toDates   = active.map(h => h[h.length-1].date);
      const overlapFrom = fromDates.reduce((a,b) => a > b ? a : b);
      const overlapTo   = toDates.reduce((a,b) => a < b ? a : b);
      if (overlapFrom < overlapTo) {
        setOverlapInfo({ from: overlapFrom, to: overlapTo });
        setStartDate(overlapFrom);
      } else {
        setOverlapInfo(null);
      }
      setNavLoading(false);
    });
  }, [slots.map(s => s?.id).join(",")]);

  // Filter nav histories to startDate onwards
  const filteredHistories = navHistories.map(h =>
    h ? h.filter(e => e.date >= startDate) : null
  );

  // Run comparison
  const runComparison = () => {
    setComparing(true);
    setTimeout(() => { setCompared(true); setComparing(false); }, 100);
  };

  const canCompare = activeSchemes.length >= 2 && overlapInfo && startDate >= overlapInfo.from;

  // ── Render returns + risk tables ──────────────────────────────────────────
  const RETURN_PERIODS = [
    { key:"1W", label:"1W", higherBetter:true },
    { key:"1M", label:"1M", higherBetter:true },
    { key:"3M", label:"3M", higherBetter:true },
    { key:"6M", label:"6M", higherBetter:true },
    { key:"1Y", label:"1Y", higherBetter:true },
    { key:"3Y", label:"3Y", higherBetter:true },
  ];
  const RISK_METRICS = [
    { key:"sharpe",      label:"Sharpe Ratio",   higherBetter:true,  fmt:(v)=>fmtRisk(v,2) },
    { key:"stdDev",      label:"Std Dev (Ann.)",  higherBetter:false, fmt:(v)=>v==null?"—":`${fmtRisk(v,1)}%` },
    { key:"sortino",     label:"Sortino Ratio",   higherBetter:true,  fmt:(v)=>fmtRisk(v,2) },
    { key:"maxDrawdown", label:"Max Drawdown",     higherBetter:false, fmt:(v)=>v==null?"—":`-${fmtRisk(Math.abs(v),1)}%` },
  ];

  const RankBadge = ({ rank }) => {
    if (!rank) return null;
    return <span className={`z2-rank z2-rank-${rank}`}>{rank}</span>;
  };

  const activeSlots = slots.map((s,i) => ({scheme:s, idx:i, color:COLORS[i], hist:navHistories[i]})).filter(x=>x.scheme);

  return (
    <>
      <style>{style}</style>
      <div className="z2-app">

        {/* Hero */}
        <div className="z2-hero">
          <div className="z2-eyebrow">◈ Z2 · MF Explorer</div>
          <div className="z2-title">COMPARE<br/>SCHEMES</div>
          <div className="z2-sub">
            Side-by-side comparison of up to 3 schemes · indexed growth · returns · risk · rolling consistency
          </div>
        </div>

        <div className="z2-body">

          {/* Scheme pickers */}
          <div className="z2-pickers">
            {[0,1,2].map(idx => {
              const scheme = slots[idx];
              const color  = COLORS[idx];
              return (
                <div key={idx} className={`z2-picker-card${!scheme ? " slot-empty" : ""}`}>
                  <div className="z2-picker-accent" style={{background: scheme ? color : "rgba(99,91,255,0.12)"}}/>
                  <div className="z2-picker-label" style={{color: scheme ? color : undefined}}>
                    Scheme {idx+1}
                  </div>
                  <div className="z2-search-wrap" ref={searchRefs[idx]}>
                    <span className="z2-search-icon">⌕</span>
                    <input className="z2-search-input"
                      placeholder={`Search ${planUniverse} scheme...`}
                      value={queries[idx]}
                      onChange={e => handleSearch(idx, e.target.value)}
                      onFocus={() => { if (!dataLoaded) return; if (results[idx].length > 0) { const nd=[...dropdowns]; nd[idx]=true; setDropdowns(nd); } }}
                    />
                    {dropdowns[idx] && (
                      <div className="z2-dropdown">
                        {results[idx].map(s => (
                          <div key={s.id} className="z2-dropdown-item"
                            onMouseDown={() => selectScheme(idx, s)}>
                            <div className="z2-dropdown-name">{s.name}</div>
                            <div className="z2-dropdown-meta">{s.amc} · {s.category} · {s.plan}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {scheme && (
                    <div className="z2-selected-scheme">
                      <div className="z2-selected-name">{scheme.name}</div>
                      <div className="z2-selected-meta">{scheme.amc} · {scheme.category}</div>
                      <div className="z2-selected-meta" style={{marginTop:3}}>
                        NAV ₹{scheme.nav} · {fmtDate(scheme.navDate)}
                      </div>
                      <button className="z2-clear-btn" onClick={() => clearSlot(idx)}>✕ Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Date + compare controls */}
          {activeSchemes.length >= 2 && (
            <div className="z2-date-row">
              <span className="z2-date-label">Compare from</span>
              <input className="z2-date-input" type="date" value={startDate}
                min={overlapInfo?.from} max={overlapInfo?.to}
                onChange={e => { setStartDate(e.target.value); setCompared(false); }} />
              {navLoading && <span className="z2-overlap-info">Fetching NAV data...</span>}
              {overlapInfo && !navLoading && (
                <span className="z2-overlap-info">
                  Overlap: {fmtDate(overlapInfo.from)} → {fmtDate(overlapInfo.to)}
                </span>
              )}
              <button className="z2-compare-btn"
                onClick={runComparison}
                disabled={!canCompare || comparing}>
                {comparing ? "Loading..." : "Compare →"}
              </button>
            </div>
          )}

          {/* ── Results ── */}
          {compared && activeSlots.length >= 2 && (
            <>
              {/* Legend */}
              <div className="z2-legend" style={{marginBottom:"1rem"}}>
                {activeSlots.map(({scheme,color}) => (
                  <div key={scheme.id} className="z2-legend-item">
                    <div className="z2-legend-dot" style={{background:color}}/>
                    <span style={{color}}>{scheme.name.split(" ").slice(0,4).join(" ")}</span>
                  </div>
                ))}
              </div>

              {/* Indexed growth chart */}
              <div className="z2-card">
                <div className="z2-section-title">Indexed NAV Growth (Base = 100 at start date)</div>
                <IndexedChart
                  navHistories={activeSlots.map(x => x.hist?.filter(e => e.date >= startDate) || [])}
                  schemes={activeSlots.map(x => x.scheme)}
                  startDate={startDate}
                />
                <div style={{fontFamily:"'DM Mono'",fontSize:10,color:"var(--muted)",marginTop:8}}>
                  Starting {fmtDate(startDate)} · end = latest available NAV per scheme · terminal values shown
                </div>
              </div>

              {/* Returns table */}
              <div className="z2-card">
                <div className="z2-section-title">Trailing Returns (%)</div>
                <table className="z2-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      {activeSlots.map(({scheme,color}) => (
                        <th key={scheme.id} style={{color}}>
                          {scheme.name.split(" ").slice(0,3).join(" ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RETURN_PERIODS.map(({key,label,higherBetter}) => {
                      const vals = activeSlots.map(({scheme}) => scheme.returns?.[key] ?? null);
                      const ranks = getRanks(vals, higherBetter);
                      return (
                        <tr key={key}>
                          <td>{label}</td>
                          {activeSlots.map(({scheme,color},i) => {
                            const v = scheme.returns?.[key] ?? null;
                            return (
                              <td key={scheme.id} style={{color: returnColor(v)}}>
                                {fmtRet(v)}
                                <RankBadge rank={ranks[i]} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Risk metrics table */}
              <div className="z2-card">
                <div className="z2-section-title">Risk Metrics (252-day)</div>
                <table className="z2-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {activeSlots.map(({scheme,color}) => (
                        <th key={scheme.id} style={{color}}>
                          {scheme.name.split(" ").slice(0,3).join(" ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_METRICS.map(({key,label,higherBetter,fmt}) => {
                      const vals  = activeSlots.map(({scheme}) => scheme.risk?.[key] ?? null);
                      const ranks = getRanks(vals, higherBetter);
                      return (
                        <tr key={key}>
                          <td>{label}</td>
                          {activeSlots.map(({scheme,color},i) => {
                            const v = scheme.risk?.[key] ?? null;
                            const c = key==="sharpe"||key==="sortino"
                              ? (v==null?"#6b72a0":v>1?"#635bff":v>0?"#059669":"#e11d48")
                              : "#0f0c2e";
                            return (
                              <td key={scheme.id} style={{color:c}}>
                                {fmt(v)}
                                <RankBadge rank={ranks[i]} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{fontFamily:"'DM Mono'",fontSize:9,color:"var(--muted)",marginTop:10}}>
                  Rank badge: <span className="z2-rank z2-rank-1" style={{display:"inline-flex"}}>1</span> best &nbsp;
                  <span className="z2-rank z2-rank-2" style={{display:"inline-flex"}}>2</span> second &nbsp;
                  <span className="z2-rank z2-rank-3" style={{display:"inline-flex"}}>3</span> third &nbsp;·&nbsp;
                  Returns: higher = better · StdDev + MaxDrawdown: lower = better
                </div>
              </div>

              {/* Rolling returns */}
              <div className="z2-card">
                <div className="z2-section-title">1Y Rolling Returns Consistency</div>
                <div className="z2-rolling-grid">
                  {activeSlots.map(({scheme,color,hist}) => (
                    <RollingSparkline
                      key={scheme.id}
                      navHist={hist}
                      color={color}
                      label={scheme.name.split(" ").slice(0,4).join(" ")}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {activeSchemes.length < 2 && (
            <div style={{textAlign:"center",padding:"3rem",fontFamily:"'DM Mono'",fontSize:12,color:"var(--muted)"}}>
              Select at least 2 schemes above to begin comparison
            </div>
          )}
        </div>

        <footer className="z2-footer">
          Source:{" "}
          <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer">
            AMFI India (amfiindia.com)
          </a>
          {" "}· Data updated daily
        </footer>
      </div>
    </>
  );
}
