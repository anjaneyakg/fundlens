import { useState, useMemo } from "react";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #f5f1ea;
    --bg2:     #ffffff;
    --bg3:     #ede8df;
    --bg4:     #e4ddd1;
    --amber:   #b07d2e;
    --amber-l: #fdf5e6;
    --amber-b: rgba(176,125,46,0.2);
    --orange:  #c4622d;
    --orange-l:#fef0e8;
    --green:   #2e7d52;
    --green-l: #e8f5ee;
    --blue:    #3d5fa0;
    --blue-l:  #edf1fb;
    --violet:  #6b52a8;
    --violet-l:#f2eefb;
    --red:     #b94040;
    --text:    #2a2318;
    --text2:   #7a6e5e;
    --border:  rgba(60,45,20,0.1);
    --borderA: rgba(176,125,46,0.22);
    --shadow:  0 2px 14px rgba(60,45,20,0.07);
    --shadow-m:0 6px 28px rgba(60,45,20,0.11);
  }

  .wc-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'Outfit', sans-serif;
    background-image:
      radial-gradient(ellipse 55% 40% at 95% 0%,  rgba(176,125,46,0.09) 0%, transparent 60%),
      radial-gradient(ellipse 40% 50% at 0%  95%, rgba(196,98,45,0.07)  0%, transparent 60%),
      radial-gradient(ellipse 35% 35% at 50% 50%, rgba(46,125,82,0.04)  0%, transparent 70%);
  }

  /* HEADER */
  .wc-header {
    max-width: 1300px; margin: 0 auto;
    padding: 3rem 2rem 2rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem;
    flex-wrap: wrap;
  }
  .wc-eyebrow {
    font-family: 'IBM Plex Mono'; font-size: 10px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--amber); margin-bottom: 10px;
  }
  .wc-title {
    font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800;
    line-height: 1.05; color: var(--text);
  }
  .wc-title span { color: var(--amber); }
  .wc-subtitle { font-size: 14px; color: var(--text2); margin-top: 8px; line-height: 1.6; max-width: 440px; }

  /* MODE TABS */
  .mode-tabs { display: flex; gap: 6px; align-self: flex-start; margin-top: 1rem; }
  .mode-tab {
    padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border);
    background: transparent; color: var(--text2); cursor: pointer;
    font-family: 'IBM Plex Mono'; font-size: 11px; letter-spacing: 1px;
    text-transform: uppercase; transition: all 0.15s;
  }
  .mode-tab.active {
    background: var(--amber-l); border-color: var(--borderA); color: var(--amber);
  }

  /* LAYOUT */
  .wc-body {
    max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem;
    display: grid; grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto; gap: 1.25rem;
  }

  /* PANELS */
  .panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .panel.amber-glow { border-color: var(--borderA); }
  .panel-eyebrow {
    font-family: 'IBM Plex Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--amber); margin-bottom: 1rem;
    padding-bottom: 0.75rem; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .panel-eyebrow .badge {
    padding: 2px 8px; border-radius: 10px; font-size: 8px;
    background: var(--amber-l); border: 1px solid var(--borderA);
  }

  /* INPUTS */
  .field { margin-bottom: 1rem; }
  .field-label {
    font-family: 'IBM Plex Mono'; font-size: 9px; letter-spacing: 1.5px;
    text-transform: uppercase; color: var(--text2); margin-bottom: 6px;
    display: flex; justify-content: space-between;
  }
  .field-val { color: var(--amber); font-size: 10px; font-weight: 600; }
  .field-input {
    width: 100%; padding: 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text);
    font-family: 'IBM Plex Mono'; font-size: 13px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .field-input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(176,125,46,0.1); }
  .range-input {
    -webkit-appearance: none; width: 100%; height: 4px;
    border-radius: 2px; outline: none; cursor: pointer; margin-top: 6px;
  }
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: var(--amber); cursor: pointer;
    box-shadow: 0 2px 8px rgba(176,125,46,0.4); border: 2px solid white;
  }
  .tog-row { display: flex; gap: 6px; margin-bottom: 1rem; }
  .tog-btn {
    flex: 1; padding: 8px 0; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg3);
    color: var(--text2); cursor: pointer;
    font-family: 'IBM Plex Mono'; font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; transition: all 0.15s;
  }
  .tog-btn.active {
    background: var(--amber-l); border-color: var(--borderA); color: var(--amber); font-weight: 600;
  }
  .divider { height: 1px; background: var(--border); margin: 1rem 0; }

  /* SHARED PARAMS */
  .shared-panel {
    grid-column: 1 / -1;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.25rem 1.5rem; box-shadow: var(--shadow);
  }
  .shared-label {
    font-family: 'IBM Plex Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--amber); margin-bottom: 0.75rem;
    grid-column: 1 / -1; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);
  }

  /* RESULT CARDS */
  .result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
  .r-card {
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 10px; padding: 1rem;
    animation: fadeUp 0.35s ease both;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  .r-card.hero {
    grid-column: 1 / -1;
    background: linear-gradient(135deg, var(--amber-l), var(--orange-l));
    border-color: var(--borderA);
  }
  .r-eyebrow {
    font-family: 'IBM Plex Mono'; font-size: 8px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--text2); margin-bottom: 6px;
  }
  .r-value { font-size: 1.5rem; font-weight: 800; line-height: 1; margin-bottom: 3px; }
  .r-sub { font-size: 11px; color: var(--text2); }

  /* CHART */
  .chart-panel {
    grid-column: 1 / -1;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem; box-shadow: var(--shadow);
    animation: fadeUp 0.5s ease both;
  }
  .chart-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px;
  }
  .chart-title {
    font-family: 'IBM Plex Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--text2);
  }
  .chart-legend { display: flex; gap: 16px; }
  .legend-item {
    display: flex; align-items: center; gap: 6px;
    font-family: 'IBM Plex Mono'; font-size: 9px; color: var(--text2);
  }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .svg-chart { width: 100%; overflow: visible; }

  /* YEAR TABLE */
  .table-panel {
    grid-column: 1 / -1;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem; box-shadow: var(--shadow);
    animation: fadeUp 0.6s ease both;
  }
  .yr-table { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Mono'; font-size: 11px; }
  .yr-table th {
    text-align: right; padding: 8px 10px;
    border-bottom: 2px solid var(--border);
    color: var(--text2); font-size: 9px; letter-spacing: 1px;
    text-transform: uppercase; font-weight: 500;
  }
  .yr-table th:first-child { text-align: left; }
  .yr-table td {
    text-align: right; padding: 9px 10px;
    border-bottom: 1px solid var(--border);
  }
  .yr-table td:first-child { text-align: left; color: var(--text2); }
  .yr-table tr:last-child td { border-bottom: none; font-weight: 700; }
  .yr-table tr:hover td { background: var(--bg3); }

  /* REVERSE SOLVER */
  .reverse-answer {
    background: linear-gradient(135deg, var(--blue-l), var(--violet-l));
    border: 1px solid rgba(61,95,160,0.18);
    border-radius: 10px; padding: 1.25rem; margin-top: 1rem;
    animation: fadeUp 0.35s ease both;
  }
  .reverse-answer-label {
    font-family: 'IBM Plex Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--blue); margin-bottom: 8px;
  }
  .reverse-answer-value {
    font-size: 2rem; font-weight: 800; color: var(--blue); line-height: 1; margin-bottom: 4px;
  }
  .reverse-answer-sub { font-size: 12px; color: var(--text2); }
  .reverse-sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem; }
  .reverse-sub-card { background: var(--bg3); border-radius: 8px; padding: 0.75rem; }

  @media (max-width: 900px) {
    .wc-body { grid-template-columns: 1fr; }
    .shared-panel { grid-template-columns: 1fr 1fr; }
    .chart-panel, .table-panel { grid-column: 1; }
  }
`;

// ─── MATH ────────────────────────────────────────────────────────────────────
const fmt = n => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtC = n => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtPct = n => `${n.toFixed(1)}%`;

// Fixed SIP future value
function sipFV(monthly, annualRate, years) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

// Step-up SIP future value
function stepupFV(monthlyStart, annualRate, years, stepUpPct) {
  const r = annualRate / 12 / 100;
  let total = 0;
  let sip   = monthlyStart;
  for (let y = 0; y < years; y++) {
    const monthsLeft = (years - y) * 12;
    if (r === 0) {
      total += sip * monthsLeft; // simplified
    } else {
      total += sip * ((Math.pow(1 + r, monthsLeft) - 1) / r) * (1 + r);
    }
    sip *= (1 + stepUpPct / 100);
  }
  return total;
}

// Total invested for step-up
function stepupTotalInvested(monthlyStart, years, stepUpPct) {
  let total = 0, sip = monthlyStart;
  for (let y = 0; y < years; y++) {
    total += sip * 12;
    sip   *= (1 + stepUpPct / 100);
  }
  return total;
}

// Reverse: required SIP for target corpus (fixed)
function reverseSIP(target, annualRate, years) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return target / n;
  return target / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

// Reverse: required SIP for target corpus (step-up) via binary search
function reverseStepupSIP(target, annualRate, years, stepUpPct) {
  let lo = 100, hi = 1000000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fv  = stepupFV(mid, annualRate, years, stepUpPct);
    if (Math.abs(fv - target) < 1) return mid;
    if (fv < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Year-wise breakdown
function yearwiseData(monthly, annualRate, years, sipType, stepUpPct, inflationRate) {
  const rows = [];
  let   sip  = monthly;
  let   cumInvested = 0;

  for (let y = 1; y <= years; y++) {
    cumInvested += sip * 12;
    const corpus     = sipType === "stepup"
      ? stepupFV(monthly, annualRate, y, stepUpPct)
      : sipFV(monthly, annualRate, y);
    const realCorpus = corpus / Math.pow(1 + inflationRate / 100, y);
    const gain       = corpus - cumInvested;

    rows.push({
      year: y, sip: Math.round(sip),
      invested: Math.round(cumInvested),
      corpus:   Math.round(corpus),
      gain:     Math.round(gain),
      gainPct:  (gain / cumInvested) * 100,
      real:     Math.round(realCorpus),
    });

    if (sipType === "stepup") sip *= (1 + stepUpPct / 100);
  }
  return rows;
}

// ─── CHART ───────────────────────────────────────────────────────────────────
function CompareChart({ fixedData, stepupData, showStepup }) {
  if (!fixedData?.length) return null;
  const W = 900, H = 240, PL = 70, PR = 20, PT = 16, PB = 36;
  const iW = W - PL - PR, iH = H - PT - PB;

  const allVals = [
    ...fixedData.map(d => d.corpus),
    ...(showStepup ? stepupData.map(d => d.corpus) : []),
    ...fixedData.map(d => d.invested),
  ];
  const maxV = Math.max(...allVals);

  const xS = i => PL + (i / (fixedData.length - 1 || 1)) * iW;
  const yS = v => PT + iH - (v / maxV) * iH;

  const makePath = (data, key) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${xS(i)},${yS(d[key])}`).join(" ");

  const yTicks = [0, maxV * 0.5, maxV].map(v => ({ v, y: yS(v) }));
  const xTicks = fixedData.filter((_, i) => i % Math.ceil(fixedData.length / 8) === 0 || i === fixedData.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b07d2e" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#b07d2e" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b52a8" stopOpacity="0.14"/>
          <stop offset="100%" stopColor="#6b52a8" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={t.y} x2={W - PR} y2={t.y}
            stroke="rgba(60,45,20,0.06)" strokeWidth="1"/>
          <text x={PL - 6} y={t.y + 4} fill="#9a8070" fontSize="9"
            textAnchor="end" fontFamily="IBM Plex Mono">{fmtC(t.v)}</text>
        </g>
      ))}

      {xTicks.map((d, i) => (
        <text key={i} x={xS(fixedData.indexOf(d))} y={H - PB + 14}
          fill="#9a8070" fontSize="9" textAnchor="middle"
          fontFamily="IBM Plex Mono">Y{d.year}</text>
      ))}

      {/* Invested area */}
      <path
        d={`${makePath(fixedData, "invested")} L${xS(fixedData.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
        fill="rgba(96,165,250,0.06)"/>
      <path d={makePath(fixedData, "invested")} fill="none"
        stroke="#3d5fa0" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>

      {/* Step-up area + line */}
      {showStepup && (
        <>
          <path
            d={`${makePath(stepupData, "corpus")} L${xS(stepupData.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
            fill="url(#violetGrad)"/>
          <path d={makePath(stepupData, "corpus")} fill="none"
            stroke="#6b52a8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}

      {/* Fixed corpus area + line */}
      <path
        d={`${makePath(fixedData, "corpus")} L${xS(fixedData.length-1)},${PT+iH} L${PL},${PT+iH} Z`}
        fill="url(#amberGrad)"/>
      <path d={makePath(fixedData, "corpus")} fill="none"
        stroke="#b07d2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const RETURN_PRESETS = [
  { label: "10%", v: 10 }, { label: "12%", v: 12 },
  { label: "14%", v: 14 }, { label: "16%", v: 16 },
];

export default function WealthCreator() {
  // Shared params
  const [annualReturn,  setAnnualReturn]  = useState(12);
  const [years,         setYears]         = useState(15);
  const [inflationRate, setInflationRate] = useState(6);
  const [sipType,       setSipType]       = useState("fixed");
  const [stepUpPct,     setStepUpPct]     = useState(10);

  // Forward mode
  const [monthly, setMonthly] = useState(10000);

  // Reverse mode
  const [targetCorpus,  setTargetCorpus]  = useState(10000000);
  const [reverseType,   setReverseType]   = useState("fixed");
  const [reverseStepUp, setReverseStepUp] = useState(10);

  // Forward calculations
  const fwd = useMemo(() => {
    const corpus    = sipType === "stepup"
      ? stepupFV(monthly, annualReturn, years, stepUpPct)
      : sipFV(monthly, annualReturn, years);
    const invested  = sipType === "stepup"
      ? stepupTotalInvested(monthly, years, stepUpPct)
      : monthly * 12 * years;
    const gain      = corpus - invested;
    const real      = corpus / Math.pow(1 + inflationRate / 100, years);
    const multiple  = corpus / invested;

    // For compare chart — always compute both
    const fixedRows  = yearwiseData(monthly, annualReturn, years, "fixed",  0,         inflationRate);
    const stepupRows = yearwiseData(monthly, annualReturn, years, "stepup", stepUpPct, inflationRate);

    return { corpus, invested, gain, real, multiple, fixedRows, stepupRows };
  }, [monthly, annualReturn, years, sipType, stepUpPct, inflationRate]);

  // Reverse calculations
  const rev = useMemo(() => {
    const reqFixed  = reverseSIP(targetCorpus, annualReturn, years);
    const reqStepup = reverseStepupSIP(targetCorpus, annualReturn, years, reverseStepUp);
    const reqSIP    = reverseType === "fixed" ? reqFixed : reqStepup;

    const totalInvFixed  = reqFixed * 12 * years;
    const totalInvStepup = stepupTotalInvested(reqStepup, years, reverseStepUp);
    const totalInv       = reverseType === "fixed" ? totalInvFixed : totalInvStepup;
    const saving         = totalInvFixed - totalInvStepup;

    return { reqSIP, totalInv, saving, reqFixed, reqStepup };
  }, [targetCorpus, annualReturn, years, reverseType, reverseStepUp]);

  // Year-wise table
  const tableRows = useMemo(() =>
    yearwiseData(monthly, annualReturn, years, sipType, stepUpPct, inflationRate),
    [monthly, annualReturn, years, sipType, stepUpPct, inflationRate]
  );

  const rangeStyle = (v, min, max) =>
    `linear-gradient(to right, var(--amber) ${((v-min)/(max-min))*100}%, var(--border) 0%)`;

  return (
    <div className="wc-page">
      <style>{style}</style>

      {/* Header */}
      <div className="wc-header">
        <div>
          <div className="wc-eyebrow">◈ FundLens Calculator</div>
          <div className="wc-title">SIP <span>Wealth</span> Creator</div>
          <div className="wc-subtitle">
            Project your SIP into the future — or reverse-engineer the SIP
            you need to hit a target corpus. Both, side by side.
          </div>
        </div>
      </div>

      <div className="wc-body">

        {/* ── SHARED PARAMS ── */}
        <div className="shared-panel">
          <div className="shared-label">◈ Common Parameters</div>

          {/* Expected return */}
          <div className="field">
            <div className="field-label">
              <span>Expected Return</span>
              <span className="field-val">{annualReturn}% p.a.</span>
            </div>
            <div style={{display:"flex",gap:"6px",marginBottom:"8px",flexWrap:"wrap"}}>
              {RETURN_PRESETS.map(p => (
                <button key={p.v}
                  style={{
                    padding:"3px 10px",borderRadius:"20px",cursor:"pointer",
                    fontFamily:"IBM Plex Mono",fontSize:"10px",
                    background: annualReturn===p.v ? "var(--amber)" : "transparent",
                    color: annualReturn===p.v ? "var(--bg)" : "var(--text2)",
                    border: annualReturn===p.v ? "1px solid var(--amber)" : "1px solid var(--border)",
                    transition:"all 0.15s",
                  }}
                  onClick={()=>setAnnualReturn(p.v)}>{p.label}</button>
              ))}
            </div>
            <input type="range" className="range-input"
              min="6" max="20" step="0.5" value={annualReturn}
              style={{background: rangeStyle(annualReturn,6,20)}}
              onChange={e=>setAnnualReturn(+e.target.value)}/>
          </div>

          {/* Duration */}
          <div className="field">
            <div className="field-label">
              <span>Duration</span>
              <span className="field-val">{years} years</span>
            </div>
            <input type="range" className="range-input"
              min="1" max="40" step="1" value={years}
              style={{background: rangeStyle(years,1,40)}}
              onChange={e=>setYears(+e.target.value)}/>
            <input type="number" className="field-input" style={{marginTop:"6px"}}
              value={years} min="1" max="40"
              onChange={e=>setYears(Math.min(40,Math.max(1,+e.target.value)))}/>
          </div>

          {/* Inflation */}
          <div className="field">
            <div className="field-label">
              <span>Inflation Rate</span>
              <span className="field-val">{inflationRate}% p.a.</span>
            </div>
            <input type="range" className="range-input"
              min="2" max="12" step="0.5" value={inflationRate}
              style={{background: rangeStyle(inflationRate,2,12)}}
              onChange={e=>setInflationRate(+e.target.value)}/>
            <input type="number" className="field-input" style={{marginTop:"6px"}}
              value={inflationRate} min="2" max="12" step="0.5"
              onChange={e=>setInflationRate(+e.target.value)}/>
          </div>

          {/* SIP Type */}
          <div className="field">
            <div className="field-label">SIP Type</div>
            <div className="tog-row">
              <button className={`tog-btn ${sipType==="fixed"?"active":""}`}
                onClick={()=>setSipType("fixed")}>Fixed</button>
              <button className={`tog-btn ${sipType==="stepup"?"active":""}`}
                onClick={()=>setSipType("stepup")}>Step-up</button>
            </div>
            {sipType === "stepup" && (
              <div>
                <div className="field-label">
                  <span>Annual Step-up</span>
                  <span className="field-val">{stepUpPct}%</span>
                </div>
                <input type="range" className="range-input"
                  min="5" max="25" step="1" value={stepUpPct}
                  style={{background: rangeStyle(stepUpPct,5,25)}}
                  onChange={e=>setStepUpPct(+e.target.value)}/>
              </div>
            )}
          </div>
        </div>

        {/* ── FORWARD PANEL ── */}
        <div className="panel amber-glow">
          <div className="panel-eyebrow">
            ◈ Forward Calculator
            <span className="badge">What will I accumulate?</span>
          </div>

          <div className="field">
            <div className="field-label">
              <span>Monthly SIP</span>
              <span className="field-val">₹{monthly.toLocaleString("en-IN")}</span>
            </div>
            <input type="range" className="range-input"
              min="500" max="200000" step="500" value={monthly}
              style={{background: rangeStyle(monthly,500,200000)}}
              onChange={e=>setMonthly(+e.target.value)}/>
            <input type="number" className="field-input" style={{marginTop:"6px"}}
              value={monthly} min="500"
              onChange={e=>setMonthly(Math.max(500,+e.target.value))}/>
          </div>

          <div className="divider"/>

          {/* Results */}
          <div className="r-card hero" style={{marginBottom:"0.75rem"}}>
            <div className="r-eyebrow">Final Corpus</div>
            <div className="r-value" style={{color:"var(--amber)"}}>
              {fmt(fwd.corpus)}
            </div>
            <div className="r-sub">
              Real value today: <strong style={{color:"var(--orange)"}}>
                {fmt(fwd.real)}
              </strong> (after {inflationRate}% inflation)
            </div>
          </div>

          <div className="result-grid">
            <div className="r-card">
              <div className="r-eyebrow">Total Invested</div>
              <div className="r-value" style={{color:"var(--blue)",fontSize:"1.2rem"}}>
                {fmt(fwd.invested)}
              </div>
            </div>
            <div className="r-card">
              <div className="r-eyebrow">Total Gains</div>
              <div className="r-value" style={{color:"var(--green)",fontSize:"1.2rem"}}>
                {fmt(fwd.gain)}
              </div>
            </div>
            <div className="r-card">
              <div className="r-eyebrow">Wealth Multiple</div>
              <div className="r-value" style={{color:"var(--amber)",fontSize:"1.2rem"}}>
                {fwd.multiple.toFixed(2)}x
              </div>
              <div className="r-sub">Corpus ÷ Invested</div>
            </div>
            <div className="r-card">
              <div className="r-eyebrow">Gain %</div>
              <div className="r-value" style={{color:"var(--green)",fontSize:"1.2rem"}}>
                {fmtPct((fwd.gain / fwd.invested) * 100)}
              </div>
              <div className="r-sub">Absolute return</div>
            </div>
          </div>
        </div>

        {/* ── REVERSE PANEL ── */}
        <div className="panel" style={{borderColor:"rgba(61,95,160,0.18)"}}>
          <div className="panel-eyebrow" style={{color:"var(--blue)"}}>
            ◈ Reverse Calculator
            <span className="badge" style={{background:"rgba(61,95,160,0.08)",borderColor:"rgba(61,95,160,0.18)",color:"var(--blue)"}}>
              How much SIP do I need?
            </span>
          </div>

          <div className="field">
            <div className="field-label">
              <span>Target Corpus</span>
              <span className="field-val" style={{color:"var(--blue)"}}>{fmt(targetCorpus)}</span>
            </div>
            <input type="range" className="range-input"
              min="1000000" max="500000000" step="500000" value={targetCorpus}
              style={{background:`linear-gradient(to right,var(--blue) ${((targetCorpus-1000000)/(500000000-1000000))*100}%,var(--border) 0%)`}}
              onChange={e=>setTargetCorpus(+e.target.value)}/>
            <input type="number" className="field-input" style={{marginTop:"6px"}}
              value={targetCorpus} min="100000"
              onChange={e=>setTargetCorpus(Math.max(100000,+e.target.value))}/>
          </div>

          <div className="field">
            <div className="field-label">SIP Type for Reverse</div>
            <div className="tog-row">
              <button className={`tog-btn ${reverseType==="fixed"?"active":""}`}
                style={reverseType==="fixed"?{background:"rgba(61,95,160,0.08)",borderColor:"var(--blue)",color:"var(--blue)"}:{}}
                onClick={()=>setReverseType("fixed")}>Fixed</button>
              <button className={`tog-btn ${reverseType==="stepup"?"active":""}`}
                style={reverseType==="stepup"?{background:"rgba(61,95,160,0.08)",borderColor:"var(--blue)",color:"var(--blue)"}:{}}
                onClick={()=>setReverseType("stepup")}>Step-up</button>
            </div>
          </div>

          {reverseType === "stepup" && (
            <div className="field">
              <div className="field-label">
                <span>Annual Step-up</span>
                <span className="field-val" style={{color:"var(--blue)"}}>{reverseStepUp}%</span>
              </div>
              <input type="range" className="range-input"
                min="5" max="25" step="1" value={reverseStepUp}
                style={{background:`linear-gradient(to right,var(--blue) ${((reverseStepUp-5)/(25-5))*100}%,var(--border) 0%)`}}
                onChange={e=>setReverseStepUp(+e.target.value)}/>
            </div>
          )}

          <div className="divider"/>

          <div className="reverse-answer">
            <div className="reverse-answer-label">Required Monthly SIP</div>
            <div className="reverse-answer-value">{fmt(rev.reqSIP)}</div>
            <div className="reverse-answer-sub">
              to reach {fmt(targetCorpus)} in {years} years at {annualReturn}% p.a.
            </div>

            <div className="reverse-sub-grid">
              <div className="reverse-sub-card">
                <div className="r-eyebrow">Total You'll Invest</div>
                <div style={{fontSize:"1rem",fontWeight:700,color:"var(--blue)"}}>
                  {fmt(rev.totalInv)}
                </div>
              </div>
              <div className="reverse-sub-card">
                <div className="r-eyebrow">Your Gains</div>
                <div style={{fontSize:"1rem",fontWeight:700,color:"var(--green)"}}>
                  {fmt(targetCorpus - rev.totalInv)}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed vs Step-up saving */}
          {rev.saving > 0 && (
            <div style={{
              marginTop:"0.75rem",padding:"0.75rem 1rem",borderRadius:"8px",
              background:"rgba(46,125,82,0.07)",border:"1px solid rgba(46,125,82,0.15)",
              fontSize:"12px",color:"var(--text2)",lineHeight:"1.6"
            }}>
              💡 With {reverseStepUp}% annual step-up, you invest{" "}
              <strong style={{color:"var(--green)"}}>{fmt(rev.saving)}</strong> less
              than a fixed SIP to reach the same goal.
            </div>
          )}
        </div>

        {/* ── COMPARE CHART ── */}
        <div className="chart-panel">
          <div className="chart-header">
            <div className="chart-title">◈ Corpus Growth — Fixed vs Step-up SIP</div>
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-dot" style={{background:"#3d5fa0"}}/>
                Amount Invested
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{background:"#b07d2e"}}/>
                Fixed SIP Corpus
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{background:"#6b52a8"}}/>
                Step-up Corpus ({stepUpPct}%)
              </div>
            </div>
          </div>
          <CompareChart
            fixedData={fwd.fixedRows}
            stepupData={fwd.stepupRows}
            showStepup={true}
          />
        </div>

        {/* ── YEAR TABLE ── */}
        <div className="table-panel">
          <div className="panel-eyebrow" style={{marginBottom:"1rem"}}>
            ◈ Year-wise Breakdown
            <span style={{marginLeft:"auto",fontSize:"9px",color:"var(--text2)"}}>
              {sipType === "stepup" ? `Step-up ${stepUpPct}% annually` : "Fixed SIP"} · {annualReturn}% return
            </span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="yr-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Monthly SIP</th>
                  <th>Invested (Cum.)</th>
                  <th>Corpus</th>
                  <th>Gains ₹</th>
                  <th>Gains %</th>
                  <th>Real Corpus</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(row => (
                  <tr key={row.year}>
                    <td>Year {row.year}</td>
                    <td style={{color:"var(--text2)"}}>₹{row.sip.toLocaleString("en-IN")}</td>
                    <td style={{color:"var(--blue)"}}>{fmt(row.invested)}</td>
                    <td style={{color:"var(--amber)",fontWeight:600}}>{fmt(row.corpus)}</td>
                    <td style={{color:"var(--green)"}}>+{fmt(row.gain)}</td>
                    <td style={{color:"var(--green)"}}>+{fmtPct(row.gainPct)}</td>
                    <td style={{color:"var(--orange)"}}>{fmt(row.real)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
