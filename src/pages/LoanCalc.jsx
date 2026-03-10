import { useState, useMemo } from "react";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #f2f0ec;
    --bg2:     #ffffff;
    --bg3:     #e8e5df;
    --bg4:     #dedad3;
    --ink:     #1a1814;
    --ink2:    #5a5650;
    --ink3:    #9a9690;
    --navy:    #1e2d4a;  --navy-l: #e8ecf3;  --navy-b: rgba(30,45,74,0.18);
    --teal:    #1a6b6b;  --teal-l: #e6f4f4;  --teal-b: rgba(26,107,107,0.2);
    --amber:   #b86a1a;  --amber-l:#fef3e4;  --amber-b:rgba(184,106,26,0.2);
    --danger:  #a83030;  --danger-l:#fdeaea;
    --safe:    #1a6b6b;  --safe-l: #e6f4f4;
    --border:  rgba(26,24,20,0.1);
    --border2: rgba(26,24,20,0.06);
    --shadow:  0 2px 16px rgba(26,24,20,0.07);
    --shadow-m:0 6px 32px rgba(26,24,20,0.12);
  }

  .lc-page {
    min-height: 100vh; width: 100%; overflow-x: hidden;
    background: var(--bg); color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    background-image:
      radial-gradient(ellipse 60% 40% at 100% 0%, rgba(30,45,74,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 40% 50% at 0% 100%, rgba(26,107,107,0.04) 0%, transparent 60%);
  }

  /* HEADER */
  .lc-header {
    max-width: 1380px; margin: 0 auto;
    padding: 2.5rem 2rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 1.5rem; flex-wrap: wrap;
  }
  .lc-eyebrow {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--navy); margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  .lc-eyebrow::after { content:''; width:40px; height:1px; background:var(--navy-b); }
  .lc-title {
    font-family: 'Libre Baskerville'; font-size: clamp(1.8rem,4vw,2.9rem);
    font-weight: 700; line-height: 1.05; color: var(--ink);
  }
  .lc-title em { font-style: italic; color: var(--navy); }
  .lc-subtitle { font-size: 12.5px; color: var(--ink2); margin-top: 6px; line-height: 1.6; max-width: 480px; }

  /* TAB BAR */
  .tab-bar {
    display: flex; background: var(--bg3); border-radius: 10px; padding: 3px; gap: 3px;
  }
  .tab-btn {
    padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.18s;
  }
  .tab-btn.active { background: var(--bg2); color: var(--navy); font-weight: 500; box-shadow: 0 1px 6px rgba(26,24,20,0.1); }

  /* BODY */
  .lc-body {
    max-width: 1380px; margin: 0 auto;
    display: grid; grid-template-columns: 360px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }

  /* INPUT PANEL */
  .input-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
    display: flex; flex-direction: column; gap: 1rem;
  }
  .ip-section { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink3); margin-bottom: 2px; }
  .ip-field { display: flex; flex-direction: column; gap: 4px; }
  .ip-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); }
  .ip-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ip-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

  .ip-input {
    width: 100%; padding: 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Sans'; font-size: 13px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .ip-input:focus { border-color: var(--navy); box-shadow: 0 0 0 2px var(--navy-b); }
  .ip-input-with-unit { position: relative; }
  .ip-unit {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    font-family: 'DM Mono'; font-size: 10px; color: var(--ink3); pointer-events: none;
  }
  .ip-select {
    width: 100%; padding: 9px 28px 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Mono'; font-size: 10px; color: var(--ink);
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239a9690'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    transition: border 0.15s;
  }
  .ip-select:focus { border-color: var(--navy); }

  .pill-row { display: flex; background: var(--bg3); border-radius: 8px; padding: 3px; gap: 3px; }
  .pill-btn {
    flex: 1; padding: 6px 8px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.5px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.15s; text-align: center;
  }
  .pill-btn.active { background: var(--bg2); color: var(--navy); box-shadow: 0 1px 4px rgba(26,24,20,0.1); }

  .ip-divider { height: 1px; background: var(--border2); }
  .ip-sub-box { background: var(--bg3); border-radius: 10px; padding: 12px; border: 1px solid var(--border2); }
  .ip-sub-lbl { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--navy); margin-bottom: 8px; }

  /* RESULTS */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }

  /* HERO STRIP */
  .hero-strip {
    background: var(--navy); border-radius: 16px; padding: 1.75rem 2rem;
    display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem;
    box-shadow: 0 8px 32px rgba(30,45,74,0.25);
  }
  .hero-kpi { display: flex; flex-direction: column; gap: 4px; }
  .hero-lbl { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.5); }
  .hero-val { font-family: 'Libre Baskerville'; font-size: clamp(1.1rem,2vw,1.6rem); font-weight: 700; color: #ffffff; line-height: 1; }
  .hero-val.accent { color: #7eb8b8; }
  .hero-sub { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px; }
  .hero-div { width: 1px; background: rgba(255,255,255,0.1); align-self: stretch; }

  /* TENURE COMPARISON */
  .comp-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .comp-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px; }
  .panel-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink2); }
  .comp-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
  .comp-card {
    border-radius: 12px; padding: 1rem 1.1rem;
    border: 1px solid var(--border); background: var(--bg3);
    transition: all 0.18s; cursor: default;
  }
  .comp-card.current { background: var(--navy-l); border-color: var(--navy-b); }
  .comp-card-lbl { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 8px; }
  .comp-card.current .comp-card-lbl { color: var(--navy); }
  .comp-emi { font-family: 'Libre Baskerville'; font-size: 1.25rem; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
  .comp-card.current .comp-emi { color: var(--navy); }
  .comp-row { display: flex; justify-content: space-between; font-family: 'DM Mono'; font-size: 9px; color: var(--ink2); padding: 2px 0; border-bottom: 1px solid var(--border2); }
  .comp-row:last-child { border-bottom: none; }
  .comp-row span:last-child { color: var(--ink); font-weight: 500; }

  /* INTEREST BREAKDOWN BAR */
  .breakdown-bar {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .bar-track { height: 10px; border-radius: 6px; background: var(--bg3); overflow: hidden; margin: 1rem 0; display: flex; }
  .bar-principal { background: var(--navy); border-radius: 6px 0 0 6px; transition: width 0.4s ease; }
  .bar-interest  { background: var(--amber); transition: width 0.4s ease; flex: 1; }
  .bar-legend { display: flex; gap: 16px; flex-wrap: wrap; }
  .bar-leg-item { display: flex; align-items: center; gap: 6px; font-family: 'DM Mono'; font-size: 9px; color: var(--ink2); }
  .bar-dot { width: 9px; height: 9px; border-radius: 50%; }

  /* AMORTIZATION */
  .amort-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .amort-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 8px; }
  .amort-scroll { overflow-x: auto; max-height: 320px; overflow-y: auto; }
  .amort-table { width: 100%; border-collapse: collapse; min-width: 500px; }
  .amort-table th {
    font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--ink3); padding: 6px 10px; border-bottom: 1px solid var(--border);
    text-align: right; position: sticky; top: 0; background: var(--bg2); z-index: 1;
  }
  .amort-table th:first-child { text-align: left; }
  .amort-table td {
    font-family: 'DM Mono'; font-size: 10px; padding: 7px 10px;
    border-bottom: 1px solid var(--border2); text-align: right; color: var(--ink);
  }
  .amort-table td:first-child { text-align: left; font-weight: 500; color: var(--navy); }
  .amort-table tr:last-child td { border-bottom: none; font-weight: 600; background: var(--bg3); }
  .amort-table tr:hover td { background: var(--bg3); }

  /* PREPAYMENT */
  .prep-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .prep-results {
    display: grid; grid-template-columns: repeat(2,1fr); gap: 1rem; margin-bottom: 1.25rem;
  }
  .prep-card {
    border-radius: 12px; padding: 1rem 1.2rem; border: 1px solid var(--border);
  }
  .prep-card.savings { background: var(--teal-l); border-color: var(--teal-b); }
  .prep-card.neutral { background: var(--bg3); }
  .prep-card.warn    { background: var(--amber-l); border-color: var(--amber-b); }
  .prep-card-lbl { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 5px; }
  .prep-card.savings .prep-card-lbl { color: var(--teal); }
  .prep-card.warn    .prep-card-lbl { color: var(--amber); }
  .prep-card-val { font-family: 'Libre Baskerville'; font-size: 1.2rem; font-weight: 700; color: var(--ink); line-height: 1; }
  .prep-card.savings .prep-card-val { color: var(--teal); }
  .prep-card.warn    .prep-card-val { color: var(--amber); }
  .prep-card-sub { font-size: 10px; color: var(--ink2); margin-top: 3px; }

  .prep-compare-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 9px;
    background: var(--bg3); margin-bottom: 8px;
    font-size: 11.5px; color: var(--ink2); line-height: 1.5;
  }
  .prep-compare-row strong { color: var(--ink); }

  /* CHART */
  .chart-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .chart-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 8px; }
  .chart-legend { display: flex; gap: 12px; flex-wrap: wrap; }
  .leg-item { display: flex; align-items: center; gap: 5px; font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink2); }
  .leg-line { width: 16px; height: 3px; border-radius: 2px; }
  .chart-scroll { overflow-x: auto; }
  .svg-chart { display: block; width: 100%; }

  /* EMPTY */
  .empty-state {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 4rem 2rem; text-align: center; box-shadow: var(--shadow);
  }
  .empty-icon  { font-size: 3rem; margin-bottom: 1rem; opacity: 0.25; }
  .empty-title { font-family: 'Libre Baskerville'; font-size: 1.3rem; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
  .empty-sub   { font-size: 13px; color: var(--ink2); line-height: 1.6; }

  .sense-note {
    font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink3);
    text-align: center; padding: 6px; letter-spacing: 0.5px;
    border-top: 1px solid var(--border2); margin-top: 8px;
  }

  /* B3 nudge */
  .b3-nudge {
    background: var(--navy-l); border: 1px solid var(--navy-b);
    border-radius: 14px; padding: 1rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }
  .b3-nudge-text { font-size: 12.5px; color: var(--ink2); line-height: 1.5; }
  .b3-nudge-text strong { color: var(--ink); }
  .b3-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: var(--navy); color: white; text-decoration: none;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.18s; white-space: nowrap; flex-shrink: 0; border: none; cursor: pointer;
  }
  .b3-link:hover { opacity: 0.88; box-shadow: 0 4px 16px var(--navy-b); }

  @media (max-width: 1024px) {
    .lc-body { grid-template-columns: 1fr; padding: 1rem; }
    .hero-strip { grid-template-columns: 1fr 1fr; }
    .comp-grid { grid-template-columns: 1fr; }
    .prep-results { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .lc-header { padding: 1.5rem 1rem 1rem; }
    .lc-body { padding: 0.75rem; gap: 0.875rem; }
    .input-panel { padding: 1.1rem; }
    .hero-strip { grid-template-columns: 1fr 1fr; padding: 1.25rem; }
    .prep-results { grid-template-columns: 1fr; }
    .ip-row { grid-template-columns: 1fr; }
  }
`;

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n/100000).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtM = n => {
  if (!n || !isFinite(n)) return "—";
  const y = Math.floor(n / 12), m = Math.round(n % 12);
  if (y === 0) return `${m}mo`;
  if (m === 0) return `${y}yr`;
  return `${y}yr ${m}mo`;
};

// ─── MATH ─────────────────────────────────────────────────────────────────────
function calcEMI(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate) return principal / tenureMonths;
  const r = annualRate / 12 / 100;
  return principal * r * Math.pow(1+r, tenureMonths) / (Math.pow(1+r, tenureMonths) - 1);
}

function buildAmortization(principal, annualRate, tenureMonths, granularity = "yearly") {
  const r = annualRate / 12 / 100;
  let balance = principal;
  const emi = calcEMI(principal, annualRate, tenureMonths);
  const rows = [];

  if (granularity === "yearly") {
    for (let y = 1; y <= Math.ceil(tenureMonths / 12); y++) {
      const mStart = (y-1)*12 + 1;
      const mEnd   = Math.min(y*12, tenureMonths);
      let yearPrincipal = 0, yearInterest = 0;
      const openBal = balance;
      for (let m = mStart; m <= mEnd; m++) {
        const interest  = balance * r;
        const principal2= Math.min(emi - interest, balance);
        yearInterest   += interest;
        yearPrincipal  += principal2;
        balance         = Math.max(0, balance - principal2);
      }
      rows.push({ label:`Y${y}`, open: openBal, principal: yearPrincipal, interest: yearInterest, close: balance });
    }
  } else {
    for (let m = 1; m <= tenureMonths; m++) {
      const interest   = balance * r;
      const principalP = Math.min(emi - interest, balance);
      const open = balance;
      balance = Math.max(0, balance - principalP);
      rows.push({ label:`M${m}`, open, principal: principalP, interest, close: balance });
    }
  }
  return rows;
}

// Prepayment simulation: returns month-by-month balance array
function simulateWithPrepay(principal, annualRate, tenureMonths, lumpMonth, lumpAmt, extraEMI) {
  const r   = annualRate / 12 / 100;
  const emi = calcEMI(principal, annualRate, tenureMonths);
  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  while (balance > 0.5 && month < tenureMonths * 2) {
    month++;
    const interest   = balance * r;
    totalInterest   += interest;
    const regularPrincipal = Math.max(0, emi - interest);
    balance -= regularPrincipal;

    // Extra EMI each month
    if (extraEMI > 0) balance = Math.max(0, balance - extraEMI);

    // One-time lumpsum at specified month
    if (month === lumpMonth && lumpAmt > 0) balance = Math.max(0, balance - lumpAmt);

    if (balance <= 0.5) break;
  }

  return { monthsClosed: month, totalInterest };
}

// ─── CHARTS ───────────────────────────────────────────────────────────────────
function AmortChart({ rows, prepRows }) {
  if (!rows?.length) return null;
  const W=580, H=200, PL=62, PR=16, PT=12, PB=30;
  const iW=W-PL-PR, iH=H-PT-PB;

  const allVals = rows.map(r => r.open);
  const maxV = Math.max(...allVals, 1);
  const maxX = rows.length;
  const xS = i => PL + (i/(maxX-1||1))*iW;
  const yS = v => PT + iH - (Math.min(v,maxV)/maxV)*iH;

  const mkPath = arr => arr.map((r,i)=>`${i===0?"M":"L"}${xS(i)},${yS(r.open)}`).join(" ");

  const yTicks = [0, maxV*0.5, maxV];
  const xTicks = rows.filter((_,i) => i % Math.max(1,Math.floor(rows.length/6))===0 || i===rows.length-1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2d4a" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#1e2d4a" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {yTicks.map((v,i)=>(
        <g key={i}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="rgba(26,24,20,0.06)" strokeWidth="1"/>
          <text x={PL-5} y={yS(v)+3} fill="#9a9690" fontSize="8" textAnchor="end" fontFamily="DM Mono">{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map((r,i)=>(
        <text key={i} x={xS(rows.indexOf(r))} y={H-PB+13} fill="#9a9690" fontSize="8" textAnchor="middle" fontFamily="DM Mono">{r.label}</text>
      ))}
      {/* Area fill for original */}
      <path d={`${mkPath(rows)} L${xS(rows.length-1)},${H-PB} L${PL},${H-PB} Z`} fill="url(#lc-grad)"/>
      {/* Original balance */}
      <path d={mkPath(rows)} fill="none" stroke="#1e2d4a" strokeWidth="2.2" strokeLinecap="round"/>
      {/* Prepaid balance */}
      {prepRows?.length > 0 && (
        <path d={mkPath(prepRows)} fill="none" stroke="#1a6b6b" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 3"/>
      )}
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function LoanCalc() {
  const [tab, setTab] = useState("emi"); // emi | prepay

  // EMI inputs
  const [principal,  setPrincipal]  = useState("5000000");
  const [rate,       setRate]       = useState("8.5");
  const [tenure,     setTenure]     = useState("20");
  const [tenureUnit, setTenureUnit] = useState("years"); // years | months
  const [granularity,setGranularity]= useState("yearly");

  // Prepayment inputs
  const [lumpMonth,  setLumpMonth]  = useState("12");
  const [lumpAmt,    setLumpAmt]    = useState("500000");
  const [extraEMI,   setExtraEMI]   = useState("5000");
  const [prepMode,   setPrepMode]   = useState("lump"); // lump | extra | both

  const tenureMonths = useMemo(() => {
    const t = parseFloat(tenure) || 0;
    return tenureUnit === "years" ? Math.round(t * 12) : Math.round(t);
  }, [tenure, tenureUnit]);

  const p  = parseFloat(principal) || 0;
  const r  = parseFloat(rate)      || 0;

  const emi          = useMemo(() => calcEMI(p, r, tenureMonths), [p, r, tenureMonths]);
  const totalPayment = emi * tenureMonths;
  const totalInterest= totalPayment - p;
  const intRatio     = p > 0 ? (totalInterest / totalPayment) * 100 : 0;

  const amortRows = useMemo(() =>
    p && r && tenureMonths ? buildAmortization(p, r, tenureMonths, granularity) : [],
    [p, r, tenureMonths, granularity]
  );

  // Tenure comparison: -5yr, current, +5yr (or -60mo, current, +60mo)
  const compTenures = useMemo(() => {
    const delta = tenureUnit === "years" ? 60 : 60;
    return [
      Math.max(12, tenureMonths - delta),
      tenureMonths,
      tenureMonths + delta,
    ].map(tm => ({
      months: tm,
      label: fmtM(tm),
      emi: calcEMI(p, r, tm),
      totalInterest: calcEMI(p, r, tm) * tm - p,
      totalPayment:  calcEMI(p, r, tm) * tm,
    }));
  }, [p, r, tenureMonths, tenureUnit]);

  // Prepayment calculation
  const prepCalc = useMemo(() => {
    if (!p || !r || !tenureMonths) return null;
    const lumpM  = prepMode !== "extra" ? Math.min(parseInt(lumpMonth)||1, tenureMonths) : 0;
    const lumpA  = prepMode !== "extra" ? (parseFloat(lumpAmt)||0) : 0;
    const extra  = prepMode !== "lump"  ? (parseFloat(extraEMI)||0) : 0;

    const orig   = { monthsClosed: tenureMonths, totalInterest };
    const prep   = simulateWithPrepay(p, r, tenureMonths, lumpM, lumpA, extra);

    return {
      origMonths:    orig.monthsClosed,
      prepMonths:    prep.monthsClosed,
      monthsSaved:   orig.monthsClosed - prep.monthsClosed,
      origInterest:  orig.totalInterest,
      prepInterest:  prep.totalInterest,
      interestSaved: orig.totalInterest - prep.totalInterest,
      totalPrepaid:  lumpA + extra * prep.monthsClosed,
    };
  }, [p, r, tenureMonths, lumpMonth, lumpAmt, extraEMI, prepMode, totalInterest]);

  // Amort chart rows for prepayment path
  const prepChartRows = useMemo(() => {
    if (!p || !r || !tenureMonths || !prepCalc) return [];
    const lumpM  = prepMode !== "extra" ? Math.min(parseInt(lumpMonth)||1, tenureMonths) : 0;
    const lumpA  = prepMode !== "extra" ? (parseFloat(lumpAmt)||0) : 0;
    const extra  = prepMode !== "lump"  ? (parseFloat(extraEMI)||0) : 0;
    const rM     = r / 12 / 100;
    const emi2   = calcEMI(p, r, tenureMonths);
    let balance  = p;
    const yearMap = {};
    let month = 0;
    while (balance > 0.5 && month < tenureMonths * 2) {
      month++;
      const interest = balance * rM;
      balance -= Math.max(0, emi2 - interest);
      if (extra > 0) balance = Math.max(0, balance - extra);
      if (month === lumpM && lumpA > 0) balance = Math.max(0, balance - lumpA);
      const yr = Math.ceil(month / 12);
      if (!yearMap[yr] || month % 12 === 1) yearMap[yr] = balance;
    }
    return Object.entries(yearMap).map(([y, bal]) => ({ label:`Y${y}`, open: bal }));
  }, [p, r, tenureMonths, lumpMonth, lumpAmt, extraEMI, prepMode, prepCalc]);

  const hasData = p > 0 && r > 0 && tenureMonths > 0;

  return (
    <>
      <style>{style}</style>
      <div className="lc-page">

        {/* HEADER */}
        <div className="lc-header">
          <div>
            <div className="lc-eyebrow">◆ FundLens · B1</div>
            <h1 className="lc-title">Loan <em>EMI</em> Calculator</h1>
            <p className="lc-subtitle">
              EMI breakdown, amortization schedule, tenure comparison, and prepayment impact — all in one place.
            </p>
          </div>
          <div className="tab-bar">
            <button className={`tab-btn ${tab==="emi"?"active":""}`} onClick={()=>setTab("emi")}>EMI & Schedule</button>
            <button className={`tab-btn ${tab==="prepay"?"active":""}`} onClick={()=>setTab("prepay")}>Prepayment Impact</button>
          </div>
        </div>

        <div className="lc-body">

          {/* ── LEFT: INPUTS ── */}
          <div className="input-panel">
            <div>
              <div className="ip-section">Loan Details</div>
            </div>

            <div className="ip-field">
              <label className="ip-label">Loan Amount (₹)</label>
              <div className="ip-input-with-unit">
                <input type="number" className="ip-input" style={{paddingRight:"50px"}}
                  value={principal} onChange={e=>setPrincipal(e.target.value)} placeholder="50,00,000"/>
                <span className="ip-unit">{fmt(parseFloat(principal)||0)}</span>
              </div>
            </div>

            <div className="ip-row">
              <div className="ip-field">
                <label className="ip-label">Interest Rate</label>
                <div className="ip-input-with-unit">
                  <input type="number" className="ip-input" style={{paddingRight:"26px"}}
                    value={rate} onChange={e=>setRate(e.target.value)} step="0.1" placeholder="8.5"/>
                  <span className="ip-unit">%</span>
                </div>
              </div>
              <div className="ip-field">
                <label className="ip-label">Tenure</label>
                <div style={{display:"flex",gap:"6px"}}>
                  <input type="number" className="ip-input" style={{flex:1}}
                    value={tenure} onChange={e=>setTenure(e.target.value)} placeholder="20"/>
                  <select className="ip-select" style={{width:"80px"}} value={tenureUnit} onChange={e=>setTenureUnit(e.target.value)}>
                    <option value="years">Yrs</option>
                    <option value="months">Mo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            {hasData && (
              <div className="ip-sub-box">
                <div className="ip-sub-lbl">Quick Summary</div>
                <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
                  {[
                    ["EMI",            fmt(emi)],
                    ["Total Payment",  fmt(totalPayment)],
                    ["Total Interest", fmt(totalInterest)],
                    ["Tenure",         fmtM(tenureMonths)],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",fontFamily:"DM Mono",fontSize:"10px",color:"var(--ink2)"}}>
                      <span>{l}</span><span style={{color:"var(--navy)",fontWeight:500}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "emi" && (
              <>
                <div className="ip-divider"/>
                <div>
                  <div className="ip-section">Amortization View</div>
                </div>
                <div className="ip-field">
                  <label className="ip-label">Granularity</label>
                  <div className="pill-row">
                    <button className={`pill-btn ${granularity==="yearly"?"active":""}`} onClick={()=>setGranularity("yearly")}>Year-wise</button>
                    <button className={`pill-btn ${granularity==="monthly"?"active":""}`} onClick={()=>setGranularity("monthly")}>Month-wise</button>
                  </div>
                </div>
              </>
            )}

            {tab === "prepay" && (
              <>
                <div className="ip-divider"/>
                <div>
                  <div className="ip-section">Prepayment Config</div>
                </div>
                <div className="ip-field">
                  <label className="ip-label">Prepayment Type</label>
                  <div className="pill-row">
                    <button className={`pill-btn ${prepMode==="lump"?"active":""}`} onClick={()=>setPrepMode("lump")}>Lumpsum</button>
                    <button className={`pill-btn ${prepMode==="extra"?"active":""}`} onClick={()=>setPrepMode("extra")}>Extra EMI</button>
                    <button className={`pill-btn ${prepMode==="both"?"active":""}`} onClick={()=>setPrepMode("both")}>Both</button>
                  </div>
                </div>

                {prepMode !== "extra" && (
                  <div className="ip-sub-box">
                    <div className="ip-sub-lbl">One-Time Lumpsum</div>
                    <div className="ip-row">
                      <div className="ip-field">
                        <label className="ip-label">Amount (₹)</label>
                        <input type="number" className="ip-input" value={lumpAmt}
                          onChange={e=>setLumpAmt(e.target.value)} placeholder="5,00,000"/>
                      </div>
                      <div className="ip-field">
                        <label className="ip-label">At Month #</label>
                        <input type="number" className="ip-input" value={lumpMonth}
                          onChange={e=>setLumpMonth(e.target.value)} placeholder="12" min="1"/>
                      </div>
                    </div>
                  </div>
                )}

                {prepMode !== "lump" && (
                  <div className="ip-sub-box">
                    <div className="ip-sub-lbl">Extra Monthly EMI (₹)</div>
                    <input type="number" className="ip-input" value={extraEMI}
                      onChange={e=>setExtraEMI(e.target.value)} placeholder="5,000"/>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── RIGHT: RESULTS ── */}
          <div className="results-col">
            {!hasData ? (
              <div className="empty-state">
                <div className="empty-icon">◎</div>
                <div className="empty-title">Enter loan details</div>
                <p className="empty-sub">Fill in the loan amount, interest rate and tenure to see your EMI breakdown.</p>
              </div>
            ) : tab === "emi" ? (
              <>
                {/* HERO STRIP */}
                <div className="hero-strip">
                  <div className="hero-kpi">
                    <div className="hero-lbl">Monthly EMI</div>
                    <div className="hero-val accent">{fmt(emi)}</div>
                    <div className="hero-sub">per month</div>
                  </div>
                  <div className="hero-div"/>
                  <div className="hero-kpi">
                    <div className="hero-lbl">Total Interest</div>
                    <div className="hero-val">{fmt(totalInterest)}</div>
                    <div className="hero-sub">{intRatio.toFixed(1)}% of total outflow</div>
                  </div>
                  <div className="hero-div"/>
                  <div className="hero-kpi">
                    <div className="hero-lbl">Total Outflow</div>
                    <div className="hero-val">{fmt(totalPayment)}</div>
                    <div className="hero-sub">{fmtM(tenureMonths)} tenure</div>
                  </div>
                  <div className="hero-div"/>
                  <div className="hero-kpi">
                    <div className="hero-lbl">Interest Multiple</div>
                    <div className="hero-val">{p > 0 ? (totalInterest/p).toFixed(2) : "—"}×</div>
                    <div className="hero-sub">interest to principal</div>
                  </div>
                </div>

                {/* INTEREST BREAKDOWN BAR */}
                <div className="breakdown-bar">
                  <div className="comp-hdr">
                    <span className="panel-title">◈ Principal vs Interest Breakdown</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-principal" style={{width:`${100 - intRatio}%`}}/>
                    <div className="bar-interest"/>
                  </div>
                  <div className="bar-legend">
                    <div className="bar-leg-item"><div className="bar-dot" style={{background:"var(--navy)"}}/> Principal — {fmt(p)} ({(100-intRatio).toFixed(1)}%)</div>
                    <div className="bar-leg-item"><div className="bar-dot" style={{background:"var(--amber)"}}/> Interest — {fmt(totalInterest)} ({intRatio.toFixed(1)}%)</div>
                  </div>
                </div>

                {/* TENURE COMPARISON */}
                <div className="comp-panel">
                  <div className="comp-hdr">
                    <span className="panel-title">◈ Tenure Comparison</span>
                    <span style={{fontFamily:"DM Mono",fontSize:"8.5px",color:"var(--ink3)"}}>±5 years vs current</span>
                  </div>
                  <div className="comp-grid">
                    {compTenures.map((ct, i) => (
                      <div key={i} className={`comp-card ${i===1?"current":""}`}>
                        <div className="comp-card-lbl">{i===0?"Shorter":i===1?"Current ✓":"Longer"} · {ct.label}</div>
                        <div className="comp-emi">{fmt(ct.emi)}<span style={{fontFamily:"DM Sans",fontSize:"10px",fontWeight:400,color:"inherit",opacity:0.6}}>/mo</span></div>
                        <div className="comp-row"><span>Total Interest</span><span>{fmt(ct.totalInterest)}</span></div>
                        <div className="comp-row"><span>Total Outflow</span><span>{fmt(ct.totalPayment)}</span></div>
                        <div className="comp-row"><span>vs Current EMI</span>
                          <span style={{color: i===0?"var(--danger)":i===2?"var(--teal)":"inherit"}}>
                            {i===1?"—": i===0 ? `+${fmt(ct.emi - compTenures[1].emi)}` : `-${fmt(compTenures[1].emi - ct.emi)}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BALANCE CHART */}
                <div className="chart-panel">
                  <div className="chart-hdr">
                    <span className="panel-title">◈ Outstanding Balance Over Time</span>
                    <div className="chart-legend">
                      <div className="leg-item"><div className="leg-line" style={{background:"var(--navy)"}}/> Outstanding Balance</div>
                    </div>
                  </div>
                  <div className="chart-scroll">
                    <AmortChart rows={amortRows}/>
                  </div>
                </div>

                {/* AMORTIZATION TABLE */}
                <div className="amort-panel">
                  <div className="amort-hdr">
                    <span className="panel-title">◈ Amortization Schedule</span>
                    <span style={{fontFamily:"DM Mono",fontSize:"8.5px",color:"var(--ink3)"}}>{granularity === "yearly" ? `${Math.ceil(tenureMonths/12)} rows` : `${tenureMonths} rows`}</span>
                  </div>
                  <div className="amort-scroll">
                    <table className="amort-table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Opening Bal</th>
                          <th>Principal</th>
                          <th>Interest</th>
                          <th>Closing Bal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {amortRows.map((row, i) => (
                          <tr key={i}>
                            <td>{row.label}</td>
                            <td>{fmt(row.open)}</td>
                            <td style={{color:"var(--navy)"}}>{fmt(row.principal)}</td>
                            <td style={{color:"var(--amber)"}}>{fmt(row.interest)}</td>
                            <td>{fmt(row.close)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td>Total</td>
                          <td>—</td>
                          <td style={{color:"var(--navy)"}}>{fmt(p)}</td>
                          <td style={{color:"var(--amber)"}}>{fmt(totalInterest)}</td>
                          <td>₹0</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* B3 nudge */}
                <div className="b3-nudge">
                  <div className="b3-nudge-text">
                    <strong>Should you prepay or invest?</strong> Compare the interest saved against potential MF returns — see the break-even in B3.
                  </div>
                  <button className="b3-link" onClick={()=>setTab("prepay")}>→ Prepayment Impact</button>
                </div>

                <div className="sense-note">EMI calculated using standard reducing-balance method. Actual schedules may vary by lender.</div>
              </>
            ) : (
              /* PREPAYMENT TAB */
              <>
                {prepCalc && (
                  <>
                    {/* Results cards */}
                    <div className="prep-panel">
                      <div className="amort-hdr">
                        <span className="panel-title">◈ Prepayment Impact</span>
                      </div>

                      <div className="prep-results">
                        <div className="prep-card savings">
                          <div className="prep-card-lbl">Interest Saved</div>
                          <div className="prep-card-val">{fmt(prepCalc.interestSaved)}</div>
                          <div className="prep-card-sub">{((prepCalc.interestSaved/prepCalc.origInterest)*100).toFixed(1)}% of original interest</div>
                        </div>
                        <div className="prep-card savings">
                          <div className="prep-card-lbl">Tenure Saved</div>
                          <div className="prep-card-val">{fmtM(prepCalc.monthsSaved)}</div>
                          <div className="prep-card-sub">closes {fmtM(prepCalc.prepMonths)} instead of {fmtM(prepCalc.origMonths)}</div>
                        </div>
                        <div className="prep-card neutral">
                          <div className="prep-card-lbl">Original Interest</div>
                          <div className="prep-card-val">{fmt(prepCalc.origInterest)}</div>
                          <div className="prep-card-sub">over {fmtM(prepCalc.origMonths)}</div>
                        </div>
                        <div className="prep-card neutral">
                          <div className="prep-card-lbl">Revised Interest</div>
                          <div className="prep-card-val">{fmt(prepCalc.prepInterest)}</div>
                          <div className="prep-card-sub">over {fmtM(prepCalc.prepMonths)}</div>
                        </div>
                      </div>

                      {/* Summary rows */}
                      {prepMode !== "extra" && (
                        <div className="prep-compare-row">
                          <span>💰</span>
                          <span>A lumpsum of <strong>{fmt(parseFloat(lumpAmt)||0)}</strong> at month <strong>{lumpMonth}</strong> saves <strong>{fmt(prepCalc.interestSaved)}</strong> in interest — a {((prepCalc.interestSaved/(parseFloat(lumpAmt)||1))*100).toFixed(0)}% effective return on the prepaid amount.</span>
                        </div>
                      )}
                      {prepMode !== "lump" && (
                        <div className="prep-compare-row">
                          <span>📅</span>
                          <span>An extra <strong>{fmt(parseFloat(extraEMI)||0)}/mo</strong> above your EMI closes the loan <strong>{fmtM(prepCalc.monthsSaved)}</strong> earlier, saving <strong>{fmt(prepCalc.interestSaved)}</strong> in interest.</span>
                        </div>
                      )}

                      <div className="sense-note">
                        Prepayment benefit assumes full principal reduction. Verify your loan agreement for prepayment charges.
                      </div>
                    </div>

                    {/* Balance comparison chart */}
                    <div className="chart-panel">
                      <div className="chart-hdr">
                        <span className="panel-title">◈ Balance: Original vs With Prepayment</span>
                        <div className="chart-legend">
                          <div className="leg-item"><div className="leg-line" style={{background:"var(--navy)"}}/> Original</div>
                          <div className="leg-item"><div className="leg-line" style={{background:"var(--teal)",height:"2px",backgroundImage:"repeating-linear-gradient(90deg,var(--teal) 0,var(--teal) 6px,transparent 6px,transparent 9px)"}}/> With Prepayment</div>
                        </div>
                      </div>
                      <div className="chart-scroll">
                        <AmortChart rows={amortRows} prepRows={prepChartRows}/>
                      </div>
                    </div>

                    {/* Opportunity cost note */}
                    <div className="b3-nudge">
                      <div className="b3-nudge-text">
                        <strong>Prepay vs Invest?</strong> Your loan rate is <strong>{rate}%</strong>. B3 shows whether investing the prepayment amount in MF beats the interest you'd save.
                      </div>
                      <button className="b3-link" onClick={()=>alert("B3 coming soon!")}>→ B3 Analysis</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
