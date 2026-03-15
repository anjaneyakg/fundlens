import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const DATA_URL     = "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
const NAVHIST_BASE = "https://gist.githubusercontent.com/anjaneyakg/6f82d116b7067a8d13aa620e99aa783f/raw";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const fmtPct = (n, decimals = 1) => {
  if (n == null || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const categorySlug = (category, plan) => {
  const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `nav_${slug}_${plan.toLowerCase()}.json`;
};

// Option detection — compound phrases only, preserves Dividend Yield category
const getOption = (s) => {
  const n = ((s.navName || s.name) || "").toLowerCase();
  if (n.includes("idcw") || n.includes("dividend payout") || n.includes("dividend reinvestment") || n.includes("payout") || n.includes("reinvestment")) return "IDCW";
  if (n.includes("bonus")) return "Bonus";
  return "Growth";
};

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const monthDiff = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
};

// XIRR via Newton-Raphson
function xirr(cashflows) {
  if (!cashflows || cashflows.length < 2) return null;
  const dates = cashflows.map(cf => new Date(cf.date));
  const amounts = cashflows.map(cf => cf.amount);
  const t0 = dates[0];
  const years = dates.map(d => (d - t0) / (365.25 * 24 * 3600 * 1000));

  let r = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let f = 0, df = 0;
    for (let i = 0; i < amounts.length; i++) {
      const denom = Math.pow(1 + r, years[i]);
      f  += amounts[i] / denom;
      df -= years[i] * amounts[i] / (denom * (1 + r));
    }
    const nr = r - f / df;
    if (Math.abs(nr - r) < 1e-7) return nr * 100;
    r = nr;
    if (!isFinite(r)) return null;
  }
  return null;
}

// Absolute return %
const absReturn = (invested, final) => invested > 0 ? ((final - invested) / invested) * 100 : null;

// CAGR
const cagr = (invested, final, years) =>
  invested > 0 && years > 0 ? (Math.pow(final / invested, 1 / years) - 1) * 100 : null;

// ─── Core STP Engine ─────────────────────────────────────────────────────────
function runSTP({ srcNav, tgtNav, startDate, months, corpus, transferMode, transferValue, freq }) {
  // Build date → nav lookup maps
  const srcMap = new Map(srcNav.map(e => [e.date, e.nav]));
  const tgtMap = new Map(tgtNav.map(e => [e.date, e.nav]));

  // Find closest NAV on or before a date
  const closestNav = (map, targetDate) => {
    const sorted = [...map.keys()].filter(d => d <= targetDate).sort();
    if (!sorted.length) return null;
    return { date: sorted[sorted.length - 1], nav: map.get(sorted[sorted.length - 1]) };
  };

  const startEntry = closestNav(srcMap, startDate);
  const tgtStartEntry = closestNav(tgtMap, startDate);
  if (!startEntry || !tgtStartEntry) return null;

  // Initial units in source
  let srcUnits = corpus / startEntry.nav;
  let tgtUnits = 0;

  const timeline = [];
  const cashflows = [{ date: startDate, amount: -corpus }]; // initial outflow

  // Transfer dates based on frequency
  const freqDays = freq === "weekly" ? 7 : freq === "monthly" ? 30 : 91;
  const endDate = addMonths(startDate, months);

  let cursor = new Date(startDate);
  let transferCount = 0;

  // Step through each transfer
  while (true) {
    // Advance by frequency
    const next = new Date(cursor);
    if (freq === "weekly")     next.setDate(next.getDate() + 7);
    else if (freq === "monthly") next.setMonth(next.getMonth() + 1);
    else                        next.setMonth(next.getMonth() + 3);

    if (next.toISOString().slice(0, 10) > endDate) break;
    cursor = next;
    const dateStr = cursor.toISOString().slice(0, 10);

    const srcEntry = closestNav(srcMap, dateStr);
    const tgtEntry = closestNav(tgtMap, dateStr);
    if (!srcEntry || !tgtEntry) continue;

    const srcValue = srcUnits * srcEntry.nav;
    if (srcValue <= 0) break;

    // Determine transfer amount
    let transferAmt;
    if (transferMode === "fixed") {
      transferAmt = Math.min(transferValue, srcValue);
    } else {
      // percentage of current source corpus
      transferAmt = Math.min(srcValue * (transferValue / 100), srcValue);
    }

    if (transferAmt <= 0) break;

    // Redeem from source
    const unitsRedeemed = transferAmt / srcEntry.nav;
    srcUnits = Math.max(0, srcUnits - unitsRedeemed);

    // Invest into target
    const unitsBought = transferAmt / tgtEntry.nav;
    tgtUnits += unitsBought;

    transferCount++;

    // Record timeline snapshot monthly
    timeline.push({
      date: dateStr,
      srcValue: srcUnits * srcEntry.nav,
      tgtValue: tgtUnits * tgtEntry.nav,
      total: (srcUnits * srcEntry.nav) + (tgtUnits * tgtEntry.nav),
      transferAmt,
    });
  }

  // Final values
  const endNavSrc = closestNav(srcMap, endDate);
  const endNavTgt = closestNav(tgtMap, endDate);
  if (!endNavSrc || !endNavTgt) return null;

  const finalSrc = srcUnits * endNavSrc.nav;
  const finalTgt = tgtUnits * endNavTgt.nav;
  const finalTotal = finalSrc + finalTgt;

  // Overall XIRR: initial corpus out, terminal combined value in
  cashflows.push({ date: endDate, amount: finalTotal });
  const xirrVal = xirr(cashflows);

  // Source XIRR: corpus invested, each transfer is partial withdrawal, remaining is final inflow
  const srcCashflows = [{ date: startDate, amount: -corpus }];
  for (const t of timeline) srcCashflows.push({ date: t.date, amount: t.transferAmt });
  srcCashflows.push({ date: endDate, amount: finalSrc });
  const srcXirr = xirr(srcCashflows);

  // Target XIRR: each transfer is an outflow (investment), final value is inflow
  const tgtCashflows = timeline.map(t => ({ date: t.date, amount: -t.transferAmt }));
  tgtCashflows.push({ date: endDate, amount: finalTgt });
  const tgtXirr = xirr(tgtCashflows);

  // Total actually transferred out of source
  const totalTransferred = timeline.reduce((s, t) => s + t.transferAmt, 0);
  const remainingInSrc = corpus - totalTransferred; // cost basis of what stayed in source

  // Baselines
  const srcOnlyUnits = corpus / startEntry.nav;
  const srcOnlyFinal = srcOnlyUnits * endNavSrc.nav;

  const tgtOnlyUnits = corpus / tgtStartEntry.nav;
  const tgtOnlyFinal = tgtOnlyUnits * endNavTgt.nav;

  const years = months / 12;

  return {
    // STP results
    finalSrc, finalTgt, finalTotal,
    totalTransferred,
    transferCount,
    corpus,
    // Source returns (on the portion that stayed)
    srcAbsAmt: finalSrc - remainingInSrc,
    srcAbsPct: absReturn(remainingInSrc, finalSrc),
    srcXirr,
    // Target returns (on what was transferred in)
    tgtAbsAmt: finalTgt - totalTransferred,
    tgtAbsPct: absReturn(totalTransferred, finalTgt),
    tgtXirr,
    // Combined
    totalAbsAmt: finalTotal - corpus,
    totalAbsPct: absReturn(corpus, finalTotal),
    totalCAGR: cagr(corpus, finalTotal, years),
    xirrVal,
    // Baselines
    srcOnlyFinal,
    srcOnlyAbsAmt: srcOnlyFinal - corpus,
    srcOnlyAbsPct: absReturn(corpus, srcOnlyFinal),
    srcOnlyCAGR: cagr(corpus, srcOnlyFinal, years),
    tgtOnlyFinal,
    tgtOnlyAbsAmt: tgtOnlyFinal - corpus,
    tgtOnlyAbsPct: absReturn(corpus, tgtOnlyFinal),
    tgtOnlyCAGR: cagr(corpus, tgtOnlyFinal, years),
    // Benefit vs baselines
    vsSourceOnly: finalTotal - srcOnlyFinal,
    vsSourceOnlyPct: absReturn(srcOnlyFinal, finalTotal),
    vsTargetOnly: finalTotal - tgtOnlyFinal,
    vsTargetOnlyPct: absReturn(tgtOnlyFinal, finalTotal),
    // Timeline for chart
    timeline,
    // Meta
    actualStartDate: startEntry.date,
    actualEndDate: endNavSrc.date,
    months,
    corpus,
  };
}

// ─── Area Chart ──────────────────────────────────────────────────────────────
function AreaChart({ timeline, srcOnlyFinal, tgtOnlyFinal, corpus }) {
  if (!timeline || timeline.length < 2) return null;
  const W = 680, H = 240, PAD = { t: 16, r: 20, b: 36, l: 66 };
  const IW = W - PAD.l - PAD.r, IH = H - PAD.t - PAD.b;

  const allVals = [...timeline.map(t => t.total), ...timeline.map(t => t.tgtValue), srcOnlyFinal, tgtOnlyFinal, corpus];
  const maxVal = Math.max(...allVals) * 1.05;
  const minVal = 0;

  const xScale = i => PAD.l + (i / (timeline.length - 1)) * IW;
  const yScale = v => PAD.t + IH - ((v - minVal) / (maxVal - minVal)) * IH;

  const toPath = pts => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const base = yScale(minVal);

  const totalPts  = timeline.map((t, i) => ({ x: xScale(i), y: yScale(t.total) }));
  const tgtPts    = timeline.map((t, i) => ({ x: xScale(i), y: yScale(t.tgtValue) }));
  const srcPts    = timeline.map((t, i) => ({ x: xScale(i), y: yScale(t.srcValue) }));

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: maxVal * f, y: yScale(maxVal * f) }));
  const step = Math.max(1, Math.floor(timeline.length / 6));
  const xTicks = timeline.filter((_, i) => i % step === 0 || i === timeline.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
      <defs>
        <linearGradient id="a4bTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d7a6e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3d7a6e" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="a4bTgt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8893f" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#c8893f" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map(t => (
        <g key={t.v}>
          <line x1={PAD.l} y1={t.y} x2={PAD.l + IW} y2={t.y} stroke="#d6cfc4" strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fill="#8a8278" fontSize="10" fontFamily="DM Mono, monospace">
            {t.v >= 1e7 ? `${(t.v / 1e7).toFixed(1)}Cr` : t.v >= 1e5 ? `${(t.v / 1e5).toFixed(0)}L` : `${(t.v / 1e3).toFixed(0)}K`}
          </text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <text key={i} x={xScale(timeline.indexOf(t))} y={PAD.t + IH + 14} textAnchor="middle" fill="#8a8278" fontSize="9" fontFamily="DM Mono, monospace">
          {t.date.slice(0, 7)}
        </text>
      ))}
      <path d={`${toPath(totalPts)} L${totalPts[totalPts.length-1].x},${base} L${totalPts[0].x},${base} Z`} fill="url(#a4bTotal)" />
      <path d={`${toPath(tgtPts)} L${tgtPts[tgtPts.length-1].x},${base} L${tgtPts[0].x},${base} Z`} fill="url(#a4bTgt)" />
      <path d={toPath(srcPts)}   fill="none" stroke="#7b9e9a" strokeWidth="1.5" strokeDasharray="4,3" />
      <path d={toPath(tgtPts)}   fill="none" stroke="#c8893f" strokeWidth="1.5" />
      <path d={toPath(totalPts)} fill="none" stroke="#3d7a6e" strokeWidth="2.5" />
      {/* Baseline terminal markers */}
      <line x1={xScale(timeline.length - 1) - 30} y1={yScale(srcOnlyFinal)} x2={xScale(timeline.length - 1)} y2={yScale(srcOnlyFinal)} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2" />
      <line x1={xScale(timeline.length - 1) - 30} y1={yScale(tgtOnlyFinal)} x2={xScale(timeline.length - 1)} y2={yScale(tgtOnlyFinal)} stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4,2" />
      {/* Legend */}
      {[
        { color: "#3d7a6e", label: "STP Total", w: 18, dash: false },
        { color: "#c8893f", label: "Target corpus", w: 14, dash: false },
        { color: "#7b9e9a", label: "Source corpus", w: 14, dash: true },
        { color: "#8b5cf6", label: "Target-only LS", w: 12, dash: true },
        { color: "#94a3b8", label: "Source-only LS", w: 12, dash: true },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.l + i * 126}, ${H - 6})`}>
          <line x1="0" y1="0" x2={l.w} y2="0" stroke={l.color} strokeWidth={l.w === 18 ? 2.5 : 1.5} strokeDasharray={l.dash ? "4,2" : "none"} />
          <text x={l.w + 4} y="4" fill="#5a5550" fontSize="9.5" fontFamily="DM Sans, sans-serif">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Styles (matching A4) ─────────────────────────────────────────────────────
const S = {
  root:          { minHeight:"100vh", background:"#f0ece4", fontFamily:"DM Sans, sans-serif", color:"#2a2622", overflowX:"hidden" },
  header:        { background:"#e8e2d8", borderBottom:"1px solid #cec6ba", padding:"28px 40px 24px" },
  headerLabel:   { fontFamily:"DM Mono, monospace", fontSize:11, letterSpacing:"0.15em", color:"#8a8278", textTransform:"uppercase", marginBottom:6 },
  headerTitle:   { fontFamily:"Spectral, serif", fontSize:32, fontWeight:300, color:"#1e1c19", letterSpacing:"-0.02em", lineHeight:1.15, margin:0 },
  headerSub:     { fontFamily:"DM Sans, sans-serif", fontSize:13, color:"#7a7470", marginTop:6, fontStyle:"italic" },
  badge:         { display:"inline-block", background:"#3d7a6e", color:"#fff", fontFamily:"DM Mono, monospace", fontSize:10, letterSpacing:"0.12em", padding:"3px 10px", borderRadius:2, marginLeft:14, verticalAlign:"middle" },
  body:          { maxWidth:940, margin:"0 auto", padding:"32px 24px" },
  card:          { background:"#faf8f4", border:"1px solid #ddd8d0", borderRadius:6, padding:"24px 28px", marginBottom:20 },
  sectionLabel:  { fontFamily:"DM Mono, monospace", fontSize:10, letterSpacing:"0.18em", color:"#9a9490", textTransform:"uppercase", marginBottom:16 },
  label:         { fontFamily:"DM Mono, monospace", fontSize:10, color:"#8a8278", letterSpacing:"0.1em", textTransform:"uppercase" },
  input:         { fontFamily:"DM Mono, monospace", fontSize:14, color:"#1e1c19", background:"#f0ece4", border:"1px solid #cec6ba", borderRadius:4, padding:"9px 12px", outline:"none", width:"100%", boxSizing:"border-box" },
  select:        { fontFamily:"DM Mono, monospace", fontSize:13, color:"#1e1c19", background:"#f0ece4", border:"1px solid #cec6ba", borderRadius:4, padding:"9px 12px", outline:"none", width:"100%", boxSizing:"border-box", minWidth:0 },
  inputGroup:    { display:"flex", flexDirection:"column", gap:6 },
  inputRow:      { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:"18px 24px" },
  navInfo:       { fontFamily:"DM Mono, monospace", fontSize:11, color:"#3d7a6e", background:"#eef6f0", border:"1px solid #a3d4b0", borderRadius:4, padding:"10px 14px", marginTop:12 },
  navWarn:       { fontFamily:"DM Mono, monospace", fontSize:11, color:"#b45309", background:"#fef9ec", border:"1px solid #f4d07a", borderRadius:4, padding:"10px 14px", marginTop:12 },
  tabs:          { display:"flex", gap:0, borderBottom:"1px solid #cec6ba", marginBottom:24 },
  tab:    (a)  => ({ fontFamily:"DM Mono, monospace", fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", padding:"10px 20px", border:"none", background:"none", cursor:"pointer", color: a?"#3d7a6e":"#9a9490", borderBottom: a?"2px solid #3d7a6e":"2px solid transparent", marginBottom:-1 }),
  kpi:    (ac) => ({ background:"#faf8f4", border:`1px solid ${ac}33`, borderLeft:`3px solid ${ac}`, borderRadius:4, padding:"16px 18px" }),
  kpiLabel:      { fontFamily:"DM Mono, monospace", fontSize:9.5, color:"#9a9490", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:8 },
  kpiVal: (c)  => ({ fontFamily:"Spectral, serif", fontSize:22, fontWeight:400, color: c||"#1e1c19", lineHeight:1 }),
  kpiSub:        { fontFamily:"DM Sans, sans-serif", fontSize:11, color:"#9a9490", marginTop:4 },
  kpiGrid:       { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:12, marginBottom:20 },
  outputGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 },
  outputHeader:  { fontFamily:"DM Mono, monospace", fontSize:9, letterSpacing:"0.14em", color:"#9a9490", textTransform:"uppercase", marginBottom:10, paddingBottom:6, borderBottom:"1px solid #e0d9cf" },
  row:           { display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"5px 0", borderBottom:"1px solid #f0ece4" },
  rowLabel:      { fontFamily:"DM Mono, monospace", fontSize:10, color:"#7a7470" },
  rowVal: (c)  => ({ fontFamily:"Spectral, serif", fontSize:15, color: c||"#1e1c19" }),
  verdictCard: (pos) => ({ background: pos?"#eef6f0":"#fef3f0", border:`1px solid ${pos?"#a3d4b0":"#f4bfb3"}`, borderRadius:6, padding:"18px 22px", marginBottom:20 }),
  verdictTitle:  { fontFamily:"Spectral, serif", fontSize:17, fontWeight:400, marginBottom:4 },
  verdictSub:    { fontFamily:"DM Sans, sans-serif", fontSize:13, color:"#5a5550" },
  calcBtn:       { background:"#3d7a6e", color:"#fff", fontFamily:"DM Mono, monospace", fontSize:12, letterSpacing:"0.12em", textTransform:"uppercase", padding:"12px 32px", border:"none", borderRadius:4, cursor:"pointer", marginTop:20 },
  spinner:       { display:"inline-block", width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"a4b-spin 0.7s linear infinite", marginRight:8 },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function STPActual() {
  // ── Scheme data
  const [allSchemes, setAllSchemes]   = useState([]);
  const [amcList,    setAmcList]      = useState([]);
  const [dataLoaded, setDataLoaded]   = useState(false);
  const [dataLoading,setDataLoading]  = useState(false);

  // ── Scheme selection
  const [selectedAMC,  setSelectedAMC]  = useState("");
  const [srcCategory,  setSrcCategory]  = useState("");
  const [srcSchemeId,  setSrcSchemeId]  = useState("");
  const [tgtCategory,  setTgtCategory]  = useState("");
  const [tgtSchemeId,  setTgtSchemeId]  = useState("");

  // ── NAV data
  const [srcNavData,   setSrcNavData]   = useState(null);
  const [tgtNavData,   setTgtNavData]   = useState(null);
  const [navLoading,   setNavLoading]   = useState(false);
  const [navError,     setNavError]     = useState("");
  const [overlapInfo,  setOverlapInfo]  = useState(null); // { from, to, months }

  // ── STP inputs
  const [corpus,       setCorpus]       = useState(1000000);
  const [startDate,    setStartDate]    = useState("");
  const [months,       setMonths]       = useState(12);
  const [transferMode, setTransferMode] = useState("fixed"); // "fixed" | "percent"
  const [transferVal,  setTransferVal]  = useState(50000);
  const [freq,         setFreq]         = useState("monthly");

  // ── Results
  const [result,  setResult]  = useState(null);
  const [tab,     setTab]     = useState("summary");
  const [computing, setComputing] = useState(false);

  // ── Load scheme master
  const loadSchemes = useCallback(async () => {
    if (dataLoaded || dataLoading) return;
    setDataLoading(true);
    try {
      const resp = await fetch(DATA_URL);
      const json = await resp.json();
      setAllSchemes(json.schemes || []);
      setAmcList(json.amcs || []);
      setDataLoaded(true);
    } catch (e) {
      console.error("A4b: scheme load failed", e);
    } finally {
      setDataLoading(false);
    }
  }, [dataLoaded, dataLoading]);

  useEffect(() => { loadSchemes(); }, [loadSchemes]);

  // ── Derived lists
  const planUniverse = localStorage.getItem("fundlens_plan_universe") || "Direct";

  const amcSchemes = allSchemes.filter(s =>
    s.amc === selectedAMC && s.plan === planUniverse && getOption(s) === "Growth"
  );

  const srcCategories = [...new Set(amcSchemes.map(s => s.category))].sort();
  const tgtCategories = srcCategories;

  const srcSchemes = amcSchemes.filter(s => s.category === srcCategory);
  // Target: same AMC, same plan, Growth, different category
  const tgtSchemes = amcSchemes.filter(s => s.category === tgtCategory);

  const srcScheme = allSchemes.find(s => s.id === srcSchemeId);
  const tgtScheme = allSchemes.find(s => s.id === tgtSchemeId);

  // ── Fetch NAV history for both schemes
  const fetchNavHistories = useCallback(async () => {
    if (!srcScheme || !tgtScheme) return;
    setNavLoading(true);
    setNavError("");
    setOverlapInfo(null);
    setSrcNavData(null);
    setTgtNavData(null);
    setResult(null);

    try {
      const srcFile = categorySlug(srcScheme.category, srcScheme.plan);
      const tgtFile = categorySlug(tgtScheme.category, tgtScheme.plan);

      const [srcResp, tgtResp] = await Promise.all([
        fetch(`${NAVHIST_BASE}/${srcFile}`),
        fetch(`${NAVHIST_BASE}/${tgtFile}`),
      ]);

      const [srcJson, tgtJson] = await Promise.all([srcResp.json(), tgtResp.json()]);

      const srcHist = srcJson[srcSchemeId] || [];
      const tgtHist = tgtJson[tgtSchemeId] || [];

      if (!srcHist.length) { setNavError(`No NAV history found for source scheme.`); setNavLoading(false); return; }
      if (!tgtHist.length) { setNavError(`No NAV history found for target scheme.`); setNavLoading(false); return; }

      setSrcNavData(srcHist);
      setTgtNavData(tgtHist);

      // Overlap = latest start date to earliest end date across both schemes
      const srcFrom = srcHist[0].date, srcTo = srcHist[srcHist.length - 1].date;
      const tgtFrom = tgtHist[0].date, tgtTo = tgtHist[tgtHist.length - 1].date;
      const overlapFrom = srcFrom > tgtFrom ? srcFrom : tgtFrom;
      const overlapTo   = srcTo   < tgtTo   ? srcTo   : tgtTo;

      if (overlapFrom >= overlapTo) {
        setNavError("No overlapping NAV history between the two schemes. Pick a different combination.");
        setNavLoading(false);
        return;
      }

      // Max safe months: from overlapFrom to overlapTo
      const overlapMonths = monthDiff(overlapFrom, overlapTo);
      // Default to 12 months or max available, whichever is less
      const defaultMonths = Math.min(12, overlapMonths);
      setOverlapInfo({ from: overlapFrom, to: overlapTo, months: overlapMonths });
      setStartDate(overlapFrom);
      setMonths(defaultMonths);

    } catch (e) {
      setNavError("Failed to fetch NAV history. Please try again.");
      console.error(e);
    } finally {
      setNavLoading(false);
    }
  }, [srcScheme, tgtScheme, srcSchemeId, tgtSchemeId]);

  useEffect(() => {
    if (srcSchemeId && tgtSchemeId) fetchNavHistories();
  }, [srcSchemeId, tgtSchemeId]);

  // ── Run STP calculation
  const calculate = () => {
    if (!srcNavData || !tgtNavData) return;
    setComputing(true);
    setResult(null);

    setTimeout(() => {
      try {
        const r = runSTP({
          srcNav: srcNavData,
          tgtNav: tgtNavData,
          startDate,
          months,
          corpus,
          transferMode,
          transferValue: transferVal,
          freq,
        });
        setResult(r);
        setTab("summary");
      } catch (e) {
        console.error("STP calc error:", e);
      } finally {
        setComputing(false);
      }
    }, 50);
  };

  // ── Validation
  const startDateValid = overlapInfo && startDate >= overlapInfo.from && startDate <= overlapInfo.to;
  const endDate = startDate ? addMonths(startDate, months) : null;
  const endDateValid = endDate && overlapInfo && endDate <= overlapInfo.to;
  const canCalculate = srcNavData && tgtNavData && startDateValid && endDateValid && corpus > 0 && transferVal > 0;

  return (
    <>
      <style>{FONTS}
        {`@keyframes a4b-spin { to { transform: rotate(360deg); } }
          .a4b-input:focus { border-color: #3d7a6e !important; }
          .a4b-select:focus { border-color: #3d7a6e !important; }
        `}
      </style>
      <div style={S.root}>

        {/* Header */}
        <div style={S.header}>
          <div style={S.headerLabel}>A5 · MF Calculators</div>
          <h1 style={S.headerTitle}>
            Actual STP Analyser
            <span style={S.badge}>REAL NAV DATA</span>
          </h1>
          <div style={S.headerSub}>
            Analyse a real Systematic Transfer Plan using actual historical NAVs — not assumed returns
          </div>
        </div>

        <div style={S.body}>

          {/* ── Step 1: Scheme Selection ── */}
          <div style={S.card}>
            <div style={S.sectionLabel}>Step 1 — Select Schemes (same AMC)</div>
            <div style={S.inputRow}>
              <div style={S.inputGroup}>
                <label style={S.label}>AMC</label>
                <select style={S.select} value={selectedAMC}
                  onChange={e => { setSelectedAMC(e.target.value); setSrcCategory(""); setSrcSchemeId(""); setTgtCategory(""); setTgtSchemeId(""); setResult(null); setOverlapInfo(null); }}>
                  <option value="">Select AMC...</option>
                  {amcList.map(a => {
                    const name = typeof a === "string" ? a : a.name;
                    return <option key={name} value={name}>{name}</option>;
                  })}
                </select>
              </div>
            </div>

            {selectedAMC && (
              <div style={{ ...S.inputRow, marginTop: 16 }}>
                {/* Source */}
                <div style={S.inputGroup}>
                  <label style={S.label}>Source Category</label>
                  <select style={S.select} value={srcCategory}
                    onChange={e => { setSrcCategory(e.target.value); setSrcSchemeId(""); setResult(null); setOverlapInfo(null); }}>
                    <option value="">Select category...</option>
                    {srcCategories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>Source Scheme</label>
                  <select style={S.select} value={srcSchemeId}
                    onChange={e => { setSrcSchemeId(e.target.value); setResult(null); setOverlapInfo(null); }}
                    disabled={!srcCategory}>
                    <option value="">Select scheme...</option>
                    {srcSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Target */}
                <div style={S.inputGroup}>
                  <label style={S.label}>Target Category</label>
                  <select style={S.select} value={tgtCategory}
                    onChange={e => { setTgtCategory(e.target.value); setTgtSchemeId(""); setResult(null); setOverlapInfo(null); }}
                    disabled={!srcSchemeId}>
                    <option value="">Select category...</option>
                    {tgtCategories.filter(c => c !== srcCategory).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>Target Scheme</label>
                  <select style={S.select} value={tgtSchemeId}
                    onChange={e => { setTgtSchemeId(e.target.value); setResult(null); setOverlapInfo(null); }}
                    disabled={!tgtCategory}>
                    <option value="">Select scheme...</option>
                    {tgtSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* NAV loading / overlap info */}
            {navLoading && (
              <div style={{ ...S.navInfo, color: "#8a8278" }}>
                Fetching NAV histories...
              </div>
            )}
            {navError && <div style={S.navWarn}>{navError}</div>}
            {overlapInfo && (
              <div style={S.navInfo}>
                NAV data available: {fmtDate(overlapInfo.from)} → {fmtDate(overlapInfo.to)} ({overlapInfo.months} months overlap)
                {" "}· Set your STP window within this range.
              </div>
            )}
          </div>

          {/* ── Step 2: STP Parameters ── */}
          {overlapInfo && (
            <div style={S.card}>
              <div style={S.sectionLabel}>Step 2 — STP Parameters</div>
              <div style={S.inputRow}>
                <div style={S.inputGroup}>
                  <label style={S.label}>Initial Corpus (₹)</label>
                  <input style={S.input} type="number" value={corpus}
                    onChange={e => setCorpus(+e.target.value)} />
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>STP Start Date</label>
                  <input style={S.input} type="date" value={startDate}
                    min={overlapInfo.from} max={overlapInfo.to}
                    onChange={e => setStartDate(e.target.value)} />
                  {!startDateValid && startDate && (
                    <span style={{ fontSize: 10, color: "#b45309", fontFamily: "DM Mono, monospace" }}>
                      Must be within {fmtDate(overlapInfo.from)} – {fmtDate(overlapInfo.to)}
                    </span>
                  )}
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>Duration (months)</label>
                  <input style={S.input} type="number" value={months} min={1}
                    max={overlapInfo.months}
                    onChange={e => setMonths(Math.max(1, +e.target.value))} />
                  {endDate && overlapInfo && endDate > overlapInfo.to && (
                    <span style={{ fontSize: 10, color: "#b45309", fontFamily: "DM Mono, monospace" }}>
                      End date {fmtDate(endDate)} exceeds available data ({fmtDate(overlapInfo.to)})
                    </span>
                  )}
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>Transfer Frequency</label>
                  <select style={S.select} value={freq} onChange={e => setFreq(e.target.value)}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>Transfer Mode</label>
                  <select style={S.select} value={transferMode} onChange={e => setTransferMode(e.target.value)}>
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="percent">% of Source Corpus</option>
                  </select>
                </div>
                <div style={S.inputGroup}>
                  <label style={S.label}>
                    {transferMode === "fixed" ? "Transfer Amount (₹)" : "Transfer % per period"}
                  </label>
                  <input style={S.input} type="number"
                    value={transferVal}
                    min={transferMode === "percent" ? 1 : 1000}
                    max={transferMode === "percent" ? 100 : undefined}
                    step={transferMode === "percent" ? 1 : 1000}
                    onChange={e => setTransferVal(+e.target.value)} />
                </div>
              </div>

              <button style={{ ...S.calcBtn, opacity: canCalculate ? 1 : 0.5, cursor: canCalculate ? "pointer" : "not-allowed" }}
                onClick={calculate} disabled={!canCalculate || computing}>
                {computing && <span style={S.spinner} />}
                {computing ? "Calculating..." : "Calculate STP"}
              </button>
            </div>
          )}

          {/* ── Results ── */}
          {result && (
            <>
              {/* Tabs */}
              <div style={S.tabs}>
                {[["summary","Summary"], ["detail","Returns Detail"], ["baseline","vs Baselines"], ["chart","Wealth Chart"]].map(([id, label]) => (
                  <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>

              {/* ── SUMMARY TAB ── */}
              {tab === "summary" && (
                <>
                  {/* KPI strip */}
                  <div style={S.kpiGrid}>
                    <div style={S.kpi("#3d7a6e")}>
                      <div style={S.kpiLabel}>Final STP Wealth</div>
                      <div style={S.kpiVal("#3d7a6e")}>{fmt(result.finalTotal)}</div>
                      <div style={S.kpiSub}>Source + Target combined</div>
                    </div>
                    <div style={S.kpi("#c8893f")}>
                      <div style={S.kpiLabel}>Target Corpus</div>
                      <div style={S.kpiVal("#c8893f")}>{fmt(result.finalTgt)}</div>
                      <div style={S.kpiSub}>{result.transferCount} transfers made</div>
                    </div>
                    <div style={S.kpi("#7b9e9a")}>
                      <div style={S.kpiLabel}>Remaining in Source</div>
                      <div style={S.kpiVal("#7b9e9a")}>{fmt(result.finalSrc)}</div>
                      <div style={S.kpiSub}>{fmt(result.totalTransferred)} transferred out</div>
                    </div>
                    <div style={S.kpi("#8b5cf6")}>
                      <div style={S.kpiLabel}>XIRR (Overall)</div>
                      <div style={S.kpiVal(result.xirrVal >= 0 ? "#2d6a4f" : "#b91c1c")}>
                        {fmtPct(result.xirrVal, 2)}
                      </div>
                      <div style={S.kpiSub}>On total corpus deployed</div>
                    </div>
                    <div style={S.kpi(result.vsSourceOnly >= 0 ? "#2d6a4f" : "#b91c1c")}>
                      <div style={S.kpiLabel}>vs Source-only</div>
                      <div style={S.kpiVal(result.vsSourceOnly >= 0 ? "#2d6a4f" : "#b91c1c")}>
                        {fmt(result.vsSourceOnly)}
                      </div>
                      <div style={S.kpiSub}>{fmtPct(result.vsSourceOnlyPct)} · {result.vsSourceOnly >= 0 ? "STP wins" : "STP loses"}</div>
                    </div>
                    <div style={S.kpi(result.vsTargetOnly >= 0 ? "#2d6a4f" : "#b91c1c")}>
                      <div style={S.kpiLabel}>vs Target-only</div>
                      <div style={S.kpiVal(result.vsTargetOnly >= 0 ? "#2d6a4f" : "#b91c1c")}>
                        {fmt(result.vsTargetOnly)}
                      </div>
                      <div style={S.kpiSub}>{fmtPct(result.vsTargetOnlyPct)} · {result.vsTargetOnly >= 0 ? "STP wins" : "STP loses"}</div>
                    </div>
                  </div>

                  {/* Verdicts */}
                  <div style={S.verdictCard(result.vsSourceOnly >= 0)}>
                    <div style={S.verdictTitle}>
                      {result.vsSourceOnly >= 0
                        ? `✅ STP outperformed keeping everything in ${srcScheme?.name}`
                        : `⚠️ Staying in ${srcScheme?.name} would have done better`}
                    </div>
                    <div style={S.verdictSub}>
                      Source-only final: {fmt(result.srcOnlyFinal)} · STP final: {fmt(result.finalTotal)} ·
                      Difference: {fmt(Math.abs(result.vsSourceOnly))} ({fmtPct(Math.abs(result.vsSourceOnlyPct))})
                    </div>
                  </div>

                  <div style={S.verdictCard(result.vsTargetOnly >= 0)}>
                    <div style={S.verdictTitle}>
                      {result.vsTargetOnly >= 0
                        ? `✅ STP outperformed a lumpsum into ${tgtScheme?.name}`
                        : `⚠️ Lumpsum into ${tgtScheme?.name} on day 1 would have done better`}
                    </div>
                    <div style={S.verdictSub}>
                      Target-only final: {fmt(result.tgtOnlyFinal)} · STP final: {fmt(result.finalTotal)} ·
                      Difference: {fmt(Math.abs(result.vsTargetOnly))} ({fmtPct(Math.abs(result.vsTargetOnlyPct))})
                    </div>
                  </div>
                </>
              )}

              {/* ── RETURNS DETAIL TAB ── */}
              {tab === "detail" && (
                <div style={S.card}>
                  <div style={S.sectionLabel}>Returns Breakdown</div>

                  {/* 3-column output grid */}
                  <div style={S.outputGrid}>
                    {/* Source */}
                    <div>
                      <div style={S.outputHeader}>Source · {srcScheme?.name?.split(" ").slice(0,3).join(" ")}</div>
                      <div style={S.row}><span style={S.rowLabel}>Final corpus</span><span style={S.kpiVal("#7b9e9a")}>{fmt(result.finalSrc)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Remaining invested</span><span style={S.rowVal()}>{fmt(result.corpus - result.totalTransferred)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Abs return (₹)</span><span style={S.rowVal(result.srcAbsAmt >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmt(result.srcAbsAmt)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Abs return (%)</span><span style={S.rowVal(result.srcAbsPct >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.srcAbsPct)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>XIRR</span><span style={S.rowVal(result.srcXirr >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.srcXirr, 2)}</span></div>
                    </div>

                    {/* Target */}
                    <div>
                      <div style={S.outputHeader}>Target · {tgtScheme?.name?.split(" ").slice(0,3).join(" ")}</div>
                      <div style={S.row}><span style={S.rowLabel}>Final corpus</span><span style={S.kpiVal("#c8893f")}>{fmt(result.finalTgt)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Total invested</span><span style={S.rowVal()}>{fmt(result.totalTransferred)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Abs return (₹)</span><span style={S.rowVal(result.tgtAbsAmt >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmt(result.tgtAbsAmt)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Abs return (%)</span><span style={S.rowVal(result.tgtAbsPct >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.tgtAbsPct)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>XIRR</span><span style={S.rowVal(result.tgtXirr >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.tgtXirr, 2)}</span></div>
                    </div>

                    {/* Combined */}
                    <div style={{ background:"#f5f1ea", borderRadius:4, padding:"0 12px 12px" }}>
                      <div style={{ ...S.outputHeader, marginTop:12 }}>Combined STP Result</div>
                      <div style={S.row}><span style={S.rowLabel}>Final corpus</span><span style={S.kpiVal("#3d7a6e")}>{fmt(result.finalTotal)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Initial corpus</span><span style={S.rowVal()}>{fmt(result.corpus)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Abs return (₹)</span><span style={S.rowVal(result.totalAbsAmt >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmt(result.totalAbsAmt)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>Abs return (%)</span><span style={S.rowVal(result.totalAbsPct >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.totalAbsPct)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>CAGR</span><span style={S.rowVal(result.totalCAGR >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.totalCAGR, 2)}</span></div>
                      <div style={S.row}><span style={S.rowLabel}>XIRR</span><span style={S.rowVal(result.xirrVal >= 0 ? "#2d6a4f" : "#b91c1c")}>{fmtPct(result.xirrVal, 2)}</span></div>
                    </div>
                  </div>

                  <div style={{ fontFamily:"DM Mono, monospace", fontSize:10, color:"#9a9490", marginTop:8 }}>
                    Period: {fmtDate(result.actualStartDate)} – {fmtDate(result.actualEndDate)} · {result.months} months · {result.transferCount} transfers · {freq} frequency
                  </div>
                </div>
              )}

              {/* ── BASELINE TAB ── */}
              {tab === "baseline" && (
                <div style={S.card}>
                  <div style={S.sectionLabel}>STP vs No-STP Baselines</div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"DM Mono, monospace", fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:"1.5px solid #c8c0b4" }}>
                          {["Metric", "STP (Actual)", "Source-only Lumpsum", "Target-only Lumpsum"].map(h => (
                            <th key={h} style={{ padding:"8px 12px", textAlign:"right", color:"#5a5550", fontWeight:500, fontSize:11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Final Corpus",     fmt(result.finalTotal),          fmt(result.srcOnlyFinal),    fmt(result.tgtOnlyFinal)],
                          ["Abs Return (₹)",   fmt(result.totalAbsAmt),         fmt(result.srcOnlyAbsAmt),   fmt(result.tgtOnlyAbsAmt)],
                          ["Abs Return (%)",   fmtPct(result.totalAbsPct),      fmtPct(result.srcOnlyAbsPct), fmtPct(result.tgtOnlyAbsPct)],
                          ["CAGR",             fmtPct(result.totalCAGR,2),      fmtPct(result.srcOnlyCAGR,2), fmtPct(result.tgtOnlyCAGR,2)],
                          ["XIRR (STP)",       fmtPct(result.xirrVal,2),        "—",                          "—"],
                          ["Benefit vs STP",   "—",                             fmt(result.vsSourceOnly) + " · " + fmtPct(result.vsSourceOnlyPct), fmt(result.vsTargetOnly) + " · " + fmtPct(result.vsTargetOnlyPct)],
                        ].map(([label, stp, srcOnly, tgtOnly], i) => (
                          <tr key={label} style={{ borderBottom:"0.5px solid #ddd8d0", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.4)" }}>
                            <td style={{ padding:"8px 12px", color:"#8a8278", fontSize:11 }}>{label}</td>
                            <td style={{ padding:"8px 12px", textAlign:"right", color:"#3d7a6e", fontWeight:500 }}>{stp}</td>
                            <td style={{ padding:"8px 12px", textAlign:"right", color:"#7b9e9a" }}>{srcOnly}</td>
                            <td style={{ padding:"8px 12px", textAlign:"right", color:"#c8893f" }}>{tgtOnly}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontFamily:"DM Mono, monospace", fontSize:10, color:"#9a9490", marginTop:12 }}>
                    Benefit column shows STP Final vs that baseline. Positive = STP wins. Source-only: corpus stays in {srcScheme?.name} for full period. Target-only: full corpus lumpsum into {tgtScheme?.name} on start date.
                  </div>
                </div>
              )}

              {/* ── CHART TAB ── */}
              {tab === "chart" && (
                <div style={S.card}>
                  <div style={S.sectionLabel}>Wealth Trajectory — Actual NAV-based</div>
                  <AreaChart
                    timeline={result.timeline}
                    srcOnlyFinal={result.srcOnlyFinal}
                    tgtOnlyFinal={result.tgtOnlyFinal}
                    corpus={result.corpus}
                  />
                  <div style={{ fontFamily:"DM Mono, monospace", fontSize:10, color:"#9a9490", marginTop:12 }}>
                    Based on actual daily NAVs from AMFI · {srcScheme?.name} (source) → {tgtScheme?.name} (target)
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div style={{ textAlign:"center", marginTop:32, fontFamily:"DM Mono, monospace", fontSize:10, color:"#b0a89e", letterSpacing:"0.1em" }}>
            FUNDLENS · A5 ACTUAL STP ANALYSER · REAL NAV DATA · SOURCE: AMFI INDIA
          </div>
        </div>
      </div>
    </>
  );
}
