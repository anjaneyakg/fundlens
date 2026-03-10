import { useState, useMemo } from "react";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #f1ede6;
    --bg2:     #ffffff;
    --bg3:     #e9e4db;
    --bg4:     #dedad0;
    --ink:     #1a1710;
    --ink2:    #5c5750;
    --ink3:    #9c9890;
    --navy:    #1e2d4a;  --navy-l: #e8ecf3;  --navy-b: rgba(30,45,74,0.18);
    --teal:    #1a6b6b;  --teal-l: #e6f4f4;  --teal-b: rgba(26,107,107,0.2);
    --terra:   #8b3a1a;  --terra-l:#fdeee8;  --terra-b:rgba(139,58,26,0.2);
    --amber:   #b86a1a;  --amber-l:#fef3e4;  --amber-b:rgba(184,106,26,0.2);
    --border:  rgba(26,23,16,0.1);
    --border2: rgba(26,23,16,0.06);
    --shadow:  0 2px 16px rgba(26,23,16,0.07);
    --shadow-m:0 6px 32px rgba(26,23,16,0.12);
  }

  .pv-page {
    min-height: 100vh; width: 100%; overflow-x: hidden;
    background: var(--bg); color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    background-image:
      radial-gradient(ellipse 60% 40% at 100% 0%, rgba(139,58,26,0.05) 0%, transparent 60%),
      radial-gradient(ellipse 40% 50% at 0% 100%, rgba(26,107,107,0.04) 0%, transparent 60%);
  }

  /* HEADER */
  .pv-header {
    max-width: 1380px; margin: 0 auto;
    padding: 2.5rem 2rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 1.5rem; flex-wrap: wrap;
  }
  .pv-eyebrow {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--terra); margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  .pv-eyebrow::after { content:''; width:40px; height:1px; background:var(--terra-b); }
  .pv-title {
    font-family: 'Libre Baskerville'; font-size: clamp(1.8rem,4vw,2.9rem);
    font-weight: 700; line-height: 1.05; color: var(--ink);
  }
  .pv-title em { font-style: italic; color: var(--terra); }
  .pv-subtitle { font-size: 12.5px; color: var(--ink2); margin-top: 6px; line-height: 1.6; max-width: 480px; }

  /* BODY */
  .pv-body {
    max-width: 1380px; margin: 0 auto;
    display: grid; grid-template-columns: 370px 1fr;
    gap: 1.5rem; padding: 1.5rem 2rem;
    align-items: start;
  }

  /* INPUT PANEL */
  .input-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
    display: flex; flex-direction: column; gap: 1rem;
  }
  .ip-section {
    font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--ink3); margin-bottom: 2px;
  }
  .ip-field { display: flex; flex-direction: column; gap: 4px; }
  .ip-label { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); }
  .ip-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ip-input {
    width: 100%; padding: 9px 12px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 8px; font-family: 'DM Sans'; font-size: 13px; color: var(--ink);
    outline: none; transition: border 0.15s;
  }
  .ip-input:focus { border-color: var(--terra); box-shadow: 0 0 0 2px var(--terra-b); }
  .ip-input-with-unit { position: relative; }
  .ip-unit {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    font-family: 'DM Mono'; font-size: 10px; color: var(--ink3); pointer-events: none;
  }
  .ip-divider { height: 1px; background: var(--border2); }
  .ip-sub-box { background: var(--bg3); border-radius: 10px; padding: 12px; border: 1px solid var(--border2); }
  .ip-sub-lbl { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
  .ip-sub-lbl.navy   { color: var(--navy); }
  .ip-sub-lbl.teal   { color: var(--teal); }
  .ip-sub-lbl.terra  { color: var(--terra); }
  .pill-row { display: flex; background: var(--bg3); border-radius: 8px; padding: 3px; gap: 3px; }
  .pill-btn {
    flex: 1; padding: 6px 8px; border-radius: 6px; border: none; cursor: pointer;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 0.5px; text-transform: uppercase;
    background: transparent; color: var(--ink2); transition: all 0.15s; text-align: center;
  }
  .pill-btn.active { background: var(--bg2); color: var(--terra); box-shadow: 0 1px 4px rgba(26,23,16,0.1); }

  /* RESULTS */
  .results-col { display: flex; flex-direction: column; gap: 1.25rem; }

  /* VERDICT CARD */
  .verdict-card {
    border-radius: 16px; padding: 1.75rem 2rem;
    box-shadow: var(--shadow-m);
    display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;
  }
  .verdict-card.prepay { background: linear-gradient(135deg, var(--navy) 0%, #2d4470 100%); }
  .verdict-card.invest { background: linear-gradient(135deg, var(--teal) 0%, #267a7a 100%); }
  .verdict-card.neutral{ background: linear-gradient(135deg, #4a4030 0%, #6b5a40 100%); }
  .verdict-icon { font-size: 2.5rem; flex-shrink: 0; }
  .verdict-body { flex: 1; }
  .verdict-tag { font-family: 'DM Mono'; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
  .verdict-headline { font-family: 'Libre Baskerville'; font-size: clamp(1.1rem,2.5vw,1.5rem); font-weight: 700; color: #ffffff; line-height: 1.2; margin-bottom: 6px; }
  .verdict-detail { font-size: 11.5px; color: rgba(255,255,255,0.65); line-height: 1.5; }
  .verdict-edge {
    text-align: center; flex-shrink: 0;
    background: rgba(255,255,255,0.12); border-radius: 12px; padding: 12px 18px;
  }
  .verdict-edge-lbl { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
  .verdict-edge-val { font-family: 'Libre Baskerville'; font-size: 1.6rem; font-weight: 700; color: #ffffff; }
  .verdict-edge-sub { font-family: 'DM Mono'; font-size: 8.5px; color: rgba(255,255,255,0.45); margin-top: 2px; }

  /* KPI GRID */
  .kpi-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-top: 1rem; }
  .kpi-card { border-radius: 11px; padding: 1rem 1.1rem; border: 1px solid var(--border2); }
  .kpi-card.navy  { background: var(--navy-l);  border-color: var(--navy-b); }
  .kpi-card.teal  { background: var(--teal-l);  border-color: var(--teal-b); }
  .kpi-card.amber { background: var(--amber-l); border-color: var(--amber-b); }
  .kpi-lbl { font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
  .kpi-card.navy  .kpi-lbl { color: var(--navy); }
  .kpi-card.teal  .kpi-lbl { color: var(--teal); }
  .kpi-card.amber .kpi-lbl { color: var(--amber); }
  .kpi-val { font-family: 'Libre Baskerville'; font-size: 1.15rem; font-weight: 700; color: var(--ink); line-height: 1; }
  .kpi-sub { font-size: 10px; color: var(--ink2); margin-top: 3px; }

  /* YEAR-WISE TABLE */
  .table-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .table-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 8px; }
  .panel-title { font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink2); }
  .res-scroll { overflow-x: auto; max-height: 340px; overflow-y: auto; }
  .res-table { width: 100%; border-collapse: collapse; min-width: 520px; }
  .res-table th {
    font-family: 'DM Mono'; font-size: 7.5px; letter-spacing: 1px; text-transform: uppercase;
    color: var(--ink3); padding: 6px 10px; border-bottom: 1px solid var(--border);
    text-align: right; position: sticky; top: 0; background: var(--bg2); z-index: 1;
  }
  .res-table th:first-child { text-align: left; }
  .res-table td {
    font-family: 'DM Mono'; font-size: 10px; padding: 7px 10px;
    border-bottom: 1px solid var(--border2); text-align: right; color: var(--ink);
  }
  .res-table td:first-child { text-align: left; font-weight: 500; color: var(--ink2); }
  .res-table tr:last-child td { border-bottom: none; font-weight: 600; background: var(--bg3); }
  .res-table tr:hover td { background: var(--bg3); }
  .col-prepay { color: var(--navy) !important; }
  .col-invest { color: var(--teal) !important; }
  .col-win    { font-weight: 600 !important; }

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

  /* BREAKEVEN */
  .breakeven-panel {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem; box-shadow: var(--shadow);
  }
  .be-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 9px; margin-bottom: 8px;
    font-size: 11.5px; color: var(--ink2); line-height: 1.5;
    background: var(--bg3); border: 1px solid var(--border2);
  }
  .be-row:last-child { margin-bottom: 0; }
  .be-row strong { color: var(--ink); }

  /* EMPTY */
  .empty-state {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 4rem 2rem; text-align: center; box-shadow: var(--shadow);
  }
  .empty-icon  { font-size: 3rem; margin-bottom: 1rem; opacity: 0.25; }
  .empty-title { font-family: 'Libre Baskerville'; font-size: 1.3rem; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
  .empty-sub   { font-size: 13px; color: var(--ink2); line-height: 1.6; }

  .b1-nudge {
    background: var(--navy-l); border: 1px solid var(--navy-b);
    border-radius: 14px; padding: 1rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; flex-wrap: wrap;
  }
  .b1-nudge-text { font-size: 12.5px; color: var(--ink2); line-height: 1.5; }
  .b1-nudge-text strong { color: var(--ink); }
  .b1-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: var(--navy); color: white; text-decoration: none;
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    transition: all 0.18s; white-space: nowrap; flex-shrink: 0;
  }
  .b1-link:hover { opacity: 0.88; box-shadow: 0 4px 16px var(--navy-b); }

  .sense-note {
    font-family: 'DM Mono'; font-size: 8.5px; color: var(--ink3);
    text-align: center; padding: 6px; letter-spacing: 0.5px;
    border-top: 1px solid var(--border2); margin-top: 8px;
  }

  @media (max-width: 1024px) {
    .pv-body { grid-template-columns: 1fr; padding: 1rem; }
    .kpi-grid { grid-template-columns: 1fr 1fr 1fr; }
    .verdict-card { flex-direction: column; }
  }
  @media (max-width: 600px) {
    .pv-header { padding: 1.5rem 1rem 1rem; }
    .pv-body { padding: 0.75rem; gap: 0.875rem; }
    .input-panel { padding: 1.1rem; }
    .kpi-grid { grid-template-columns: 1fr; }
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
  const y = Math.floor(n/12), m = Math.round(n%12);
  return y === 0 ? `${m}mo` : m === 0 ? `${y}yr` : `${y}yr ${m}mo`;
};
const fmtPct = n => (n == null || isNaN(n)) ? "—" : `${n.toFixed(2)}%`;

// ─── MATH ─────────────────────────────────────────────────────────────────────
function calcEMI(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate) return principal / tenureMonths;
  const r = annualRate / 12 / 100;
  return principal * r * Math.pow(1+r, tenureMonths) / (Math.pow(1+r, tenureMonths) - 1);
}

// Simulate prepayment: month-by-month with lumpsum at a given month
// Returns: {interest paid total, months to close, balance[] yearly snapshots}
function simPrepay(outstanding, annualRate, remainingMonths, lumpAmt, lumpMonth) {
  const r    = annualRate / 12 / 100;
  const emi  = calcEMI(outstanding, annualRate, remainingMonths);
  let balance = outstanding;
  let totalInterest = 0;
  let month = 0;
  const yearlyBalance = [{ year: 0, balance: outstanding }];

  while (balance > 0.5 && month < remainingMonths * 2) {
    month++;
    const interest = balance * r;
    totalInterest += interest;
    balance -= Math.max(0, emi - interest);
    if (month === lumpMonth && lumpAmt > 0) balance = Math.max(0, balance - lumpAmt);
    if (balance <= 0.5) break;
    if (month % 12 === 0) yearlyBalance.push({ year: month/12, balance });
  }
  if (!yearlyBalance.find(r => r.year === Math.ceil(month/12))) {
    yearlyBalance.push({ year: Math.ceil(month/12), balance: 0 });
  }

  return { totalInterest, months: month, yearlyBalance };
}

// Simulate MF investment of lump amount for a given tenure at a flat annual return
// Returns: {finalCorpus, yearlyCorpus[]}
function simMF(amount, annualReturn, tenureMonths) {
  const r = annualReturn / 100;
  const years = tenureMonths / 12;
  const yearlyCorpus = [];
  for (let y = 0; y <= Math.ceil(years); y++) {
    yearlyCorpus.push({ year: y, corpus: amount * Math.pow(1+r, Math.min(y, years)) });
  }
  return {
    finalCorpus: amount * Math.pow(1+r, years),
    yearlyCorpus,
  };
}

// Break-even return: the MF return at which investing = prepaying
// Uses binary search
function breakEvenReturn(interestSaved, lumpAmt, tenureMonths) {
  if (!interestSaved || !lumpAmt) return null;
  const years = tenureMonths / 12;
  // MF gain after tax (assumed 10% LTCG on equity gains for simplicity)
  let lo = 0, hi = 50;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const corpus = lumpAmt * Math.pow(1 + mid/100, years);
    const gain   = corpus - lumpAmt;
    const gainNet = gain * 0.9; // ~10% LTCG
    if (gainNet > interestSaved) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function WealthChart({ prepayRows, noPrepayRows, mfRows, lumpMonth, maxMonths }) {
  if (!prepayRows?.length) return null;

  const W=580, H=210, PL=68, PR=16, PT=12, PB=30;
  const iW=W-PL-PR, iH=H-PT-PB;

  const allV = [
    ...prepayRows.map(r => r.balance||0),
    ...noPrepayRows.map(r => r.balance||0),
    ...mfRows.map(r => r.corpus||0),
  ];
  const maxV  = Math.max(...allV, 1);
  // x-axis: years, 0..maxMonths/12
  const maxYr = Math.max(...noPrepayRows.map(r=>r.year), ...mfRows.map(r=>r.year), 1);
  const xS = y => PL + (y/maxYr)*iW;
  const yS = v => PT + iH - (Math.min(v,maxV)/maxV)*iH;

  const mkPath = (arr, xKey, yKey) =>
    arr.filter(r=>r[xKey]!=null&&r[yKey]!=null)
       .map((r,i)=>`${i===0?"M":"L"}${xS(r[xKey])},${yS(r[yKey])}`).join(" ");

  const yTicks = [0, maxV*0.5, maxV];
  const xStep  = Math.max(1, Math.floor(maxYr/6));
  const xTicks = Array.from({length:Math.ceil(maxYr)+1},(_,i)=>i).filter(y=>y%xStep===0||y===Math.ceil(maxYr));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="svg-chart">
      <defs>
        <linearGradient id="mf-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a6b6b" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#1a6b6b" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {yTicks.map((v,i)=>(
        <g key={i}>
          <line x1={PL} y1={yS(v)} x2={W-PR} y2={yS(v)} stroke="rgba(26,23,16,0.06)" strokeWidth="1"/>
          <text x={PL-5} y={yS(v)+3} fill="#9c9890" fontSize="8" textAnchor="end" fontFamily="DM Mono">{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map((y,i)=>(
        <text key={i} x={xS(y)} y={H-PB+13} fill="#9c9890" fontSize="8" textAnchor="middle" fontFamily="DM Mono">Y{y}</text>
      ))}
      {/* Lumpsum event marker */}
      {lumpMonth > 0 && (
        <line x1={xS(lumpMonth/12)} y1={PT} x2={xS(lumpMonth/12)} y2={H-PB}
          stroke="rgba(139,58,26,0.3)" strokeWidth="1" strokeDasharray="3 3"/>
      )}
      {/* MF corpus area + line */}
      <path d={`${mkPath(mfRows,"year","corpus")} L${xS(maxYr)},${H-PB} L${PL},${H-PB} Z`} fill="url(#mf-fill)"/>
      <path d={mkPath(mfRows,"year","corpus")} fill="none" stroke="#1a6b6b" strokeWidth="2.2" strokeLinecap="round"/>
      {/* No-prepay balance (outstanding) */}
      <path d={mkPath(noPrepayRows,"year","balance")} fill="none" stroke="#9c9890" strokeWidth="1.5" strokeDasharray="5 3" strokeLinecap="round"/>
      {/* Prepay balance */}
      <path d={mkPath(prepayRows,"year","balance")} fill="none" stroke="#1e2d4a" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function PrepayVsInvest() {
  // Loan inputs
  const [outstanding,    setOutstanding]    = useState("4000000");
  const [loanRate,       setLoanRate]       = useState("8.5");
  const [remainingTenure,setRemainingTenure]= useState("15");
  const [tenureUnit,     setTenureUnit]     = useState("years");

  // Prepayment inputs
  const [lumpAmt,   setLumpAmt]   = useState("500000");
  const [lumpMonth, setLumpMonth] = useState("1");

  // MF investment inputs
  const [mfReturn,     setMfReturn]     = useState("12");
  const [taxType,      setTaxType]      = useState("ltcg"); // ltcg | debt | none
  const [reinvestEMI,  setReinvestEMI]  = useState(true); // reinvest freed-up EMI into MF?

  const remainingMonths = useMemo(() => {
    const t = parseFloat(remainingTenure) || 0;
    return tenureUnit === "years" ? Math.round(t*12) : Math.round(t);
  }, [remainingTenure, tenureUnit]);

  const outstanding_n  = parseFloat(outstanding)    || 0;
  const loanRate_n     = parseFloat(loanRate)       || 0;
  const lumpAmt_n      = parseFloat(lumpAmt)        || 0;
  const lumpMonth_n    = Math.max(1, parseInt(lumpMonth)||1);
  const mfReturn_n     = parseFloat(mfReturn)       || 0;

  const emi = useMemo(()=>calcEMI(outstanding_n, loanRate_n, remainingMonths), [outstanding_n, loanRate_n, remainingMonths]);

  // Tax rate on MF gains
  const taxRate = taxType === "ltcg" ? 0.10 : taxType === "debt" ? 0.30 : 0;

  const calc = useMemo(() => {
    if (!outstanding_n || !loanRate_n || !remainingMonths || !lumpAmt_n) return null;

    // Scenario A: PREPAY
    const prepayResult    = simPrepay(outstanding_n, loanRate_n, remainingMonths, lumpAmt_n, lumpMonth_n);
    const noPrepayResult  = simPrepay(outstanding_n, loanRate_n, remainingMonths, 0, 0);
    const interestSaved   = noPrepayResult.totalInterest - prepayResult.totalInterest;
    const monthsSaved     = noPrepayResult.months - prepayResult.months;

    // Scenario B: INVEST in MF instead
    // Invest lumpAmt for the period it would have been with the loan
    const mfTenureMonths  = noPrepayResult.months; // invest for original loan duration
    const mfResult        = simMF(lumpAmt_n, mfReturn_n, mfTenureMonths);
    const mfGross         = mfResult.finalCorpus - lumpAmt_n;
    const mfTax           = mfGross * taxRate;
    const mfNet           = mfGross - mfTax;

    // If EMI is freed up earlier (prepay closes loan sooner), reinvest those months
    let reinvestBenefit = 0;
    if (reinvestEMI && monthsSaved > 0) {
      // After loan closes early, reinvest EMI for remaining months
      const reinvestMonths = monthsSaved;
      const r = mfReturn_n / 12 / 100;
      const fv = emi * (Math.pow(1+r, reinvestMonths) - 1) / r;
      const gain = fv - emi * reinvestMonths;
      reinvestBenefit = gain * (1 - taxRate);
    }
    const prepayNetBenefit = interestSaved + reinvestBenefit;

    // Winner
    const diff    = mfNet - prepayNetBenefit;
    const winner  = Math.abs(diff) < lumpAmt_n * 0.01 ? "neutral"
                  : diff > 0 ? "invest" : "prepay";

    // Effective return of prepayment (guaranteed, risk-free = loan rate)
    const prepayEffReturn = loanRate_n;

    // Break-even MF return (pre-tax equivalent)
    const beReturn = breakEvenReturn(interestSaved, lumpAmt_n, mfTenureMonths);

    // Year-wise comparison table
    const yearlyTable = [];
    const maxYrs = Math.ceil(noPrepayResult.months / 12);
    for (let y = 1; y <= maxYrs; y++) {
      const prepBal = prepayResult.yearlyBalance.find(r => r.year >= y)?.balance ?? 0;
      const noBal   = noPrepayResult.yearlyBalance.find(r => r.year >= y)?.balance ?? 0;
      const mfCorp  = lumpAmt_n * Math.pow(1 + mfReturn_n/100, y);
      const mfNetY  = lumpAmt_n + (mfCorp - lumpAmt_n) * (1 - taxRate);
      const intSavedY = (noPrepayResult.totalInterest - prepayResult.totalInterest) * Math.min(1, y*12/noPrepayResult.months);
      yearlyTable.push({ year: y, prepBal, noBal, mfCorp: mfNetY, intSavedYTD: intSavedY });
    }

    return {
      prepayResult, noPrepayResult, mfResult,
      interestSaved, monthsSaved,
      mfGross, mfNet, mfTax,
      reinvestBenefit, prepayNetBenefit,
      diff, winner,
      prepayEffReturn, beReturn,
      yearlyTable,
    };
  }, [outstanding_n, loanRate_n, remainingMonths, lumpAmt_n, lumpMonth_n,
      mfReturn_n, taxRate, reinvestEMI, emi]);

  const hasData = outstanding_n && loanRate_n && remainingMonths && lumpAmt_n;

  const verdictConfig = !calc ? null : {
    prepay:  { cls:"prepay", icon:"🏦", headline:`Prepay wins by ${fmt(calc.prepayNetBenefit - calc.mfNet)}`, detail:`At ${mfReturn}% MF return, you're better off reducing your ${loanRate}% loan. Prepayment gives a guaranteed ${loanRate}% effective return.` },
    invest:  { cls:"invest", icon:"📈", headline:`Invest wins by ${fmt(calc.mfNet - calc.prepayNetBenefit)}`, detail:`At ${mfReturn}% MF return, investing beats the interest saved on your ${loanRate}% loan. Your money works harder in the market.` },
    neutral: { cls:"neutral",icon:"⚖️", headline:"Too close to call",   detail:`At ${mfReturn}% MF return, the outcomes are nearly identical. Your risk appetite and liquidity needs should decide.` },
  }[calc?.winner] ?? null;

  return (
    <>
      <style>{style}</style>
      <div className="pv-page">

        {/* HEADER */}
        <div className="pv-header">
          <div>
            <div className="pv-eyebrow">◆ FundLens · B3</div>
            <h1 className="pv-title">Prepay vs <em>Invest</em></h1>
            <p className="pv-subtitle">
              Should you prepay your loan or invest the same amount in mutual funds?
              Compare interest saved against potential market returns — with tax and reinvestment.
            </p>
          </div>
        </div>

        <div className="pv-body">

          {/* ── LEFT: INPUTS ── */}
          <div className="input-panel">

            {/* LOAN */}
            <div className="ip-section">Your Loan</div>
            <div className="ip-field">
              <label className="ip-label">Outstanding Principal (₹)</label>
              <input type="number" className="ip-input" value={outstanding}
                onChange={e=>setOutstanding(e.target.value)} placeholder="40,00,000"/>
            </div>
            <div className="ip-row">
              <div className="ip-field">
                <label className="ip-label">Loan Rate (%)</label>
                <div className="ip-input-with-unit">
                  <input type="number" className="ip-input" style={{paddingRight:"26px"}}
                    value={loanRate} onChange={e=>setLoanRate(e.target.value)} step="0.1" placeholder="8.5"/>
                  <span className="ip-unit">%</span>
                </div>
              </div>
              <div className="ip-field">
                <label className="ip-label">Remaining Tenure</label>
                <div style={{display:"flex",gap:"6px"}}>
                  <input type="number" className="ip-input" style={{flex:1}}
                    value={remainingTenure} onChange={e=>setRemainingTenure(e.target.value)} placeholder="15"/>
                  <select className="ip-select" style={{width:"72px"}} value={tenureUnit} onChange={e=>setTenureUnit(e.target.value)}>
                    <option value="years">Yrs</option>
                    <option value="months">Mo</option>
                  </select>
                </div>
              </div>
            </div>
            {emi > 0 && (
              <div style={{fontFamily:"DM Mono",fontSize:"9.5px",color:"var(--ink3)",padding:"4px 0"}}>
                Current EMI: <span style={{color:"var(--navy)",fontWeight:500}}>{fmt(emi)}/mo</span>
              </div>
            )}

            <div className="ip-divider"/>

            {/* PREPAYMENT */}
            <div className="ip-section">Prepayment</div>
            <div className="ip-row">
              <div className="ip-field">
                <label className="ip-label">Lumpsum Amount (₹)</label>
                <input type="number" className="ip-input" value={lumpAmt}
                  onChange={e=>setLumpAmt(e.target.value)} placeholder="5,00,000"/>
              </div>
              <div className="ip-field">
                <label className="ip-label">At Month #</label>
                <input type="number" className="ip-input" value={lumpMonth}
                  onChange={e=>setLumpMonth(e.target.value)} placeholder="1" min="1"/>
              </div>
            </div>
            <div style={{fontFamily:"DM Mono",fontSize:"8.5px",color:"var(--ink3)",lineHeight:1.5}}>
              Guaranteed effective return = <span style={{color:"var(--navy)",fontWeight:500}}>{loanRate}%</span> (loan rate saved)
            </div>

            <div className="ip-divider"/>

            {/* MF */}
            <div className="ip-section">MF Investment (Alternate)</div>
            <div className="ip-field">
              <label className="ip-label">Expected MF Return (% p.a.)</label>
              <div className="ip-input-with-unit">
                <input type="number" className="ip-input" style={{paddingRight:"26px"}}
                  value={mfReturn} onChange={e=>setMfReturn(e.target.value)} step="0.5" placeholder="12"/>
                <span className="ip-unit">%</span>
              </div>
            </div>
            <div className="ip-field">
              <label className="ip-label">Tax on Gains</label>
              <div className="pill-row">
                <button className={`pill-btn ${taxType==="ltcg"?"active":""}`} onClick={()=>setTaxType("ltcg")}>10% LTCG</button>
                <button className={`pill-btn ${taxType==="debt"?"active":""}`} onClick={()=>setTaxType("debt")}>30% Debt</button>
                <button className={`pill-btn ${taxType==="none"?"active":""}`} onClick={()=>setTaxType("none")}>No Tax</button>
              </div>
            </div>

            <div className="ip-divider"/>

            {/* REINVEST OPTION */}
            <div className="ip-sub-box">
              <div className="ip-sub-lbl teal">Advanced: Freed EMI Reinvestment</div>
              <label style={{display:"flex",alignItems:"flex-start",gap:"8px",cursor:"pointer",fontFamily:"DM Sans",fontSize:"11.5px",color:"var(--ink2)",lineHeight:1.5}}>
                <input type="checkbox" checked={reinvestEMI} onChange={e=>setReinvestEMI(e.target.checked)} style={{marginTop:"2px"}}/>
                <span>After prepay closes loan early, reinvest freed-up EMI <strong style={{color:"var(--teal)"}}>{fmt(emi)}/mo</strong> into MF for remaining months.</span>
              </label>
            </div>
          </div>

          {/* ── RIGHT: RESULTS ── */}
          <div className="results-col">
            {!hasData || !calc ? (
              <div className="empty-state">
                <div className="empty-icon">⚖</div>
                <div className="empty-title">Enter your loan details</div>
                <p className="empty-sub">Fill in outstanding principal, rate, tenure and the lumpsum amount to see the comparison.</p>
              </div>
            ) : (
              <>
                {/* VERDICT */}
                {verdictConfig && (
                  <div className={`verdict-card ${verdictConfig.cls}`}>
                    <div className="verdict-icon">{verdictConfig.icon}</div>
                    <div className="verdict-body">
                      <div className="verdict-tag">Recommendation at {mfReturn}% MF return</div>
                      <div className="verdict-headline">{verdictConfig.headline}</div>
                      <div className="verdict-detail">{verdictConfig.detail}</div>
                    </div>
                    <div className="verdict-edge">
                      <div className="verdict-edge-lbl">Break-even MF Return</div>
                      <div className="verdict-edge-val">{calc.beReturn ? fmtPct(calc.beReturn) : "—"}</div>
                      <div className="verdict-edge-sub">to match prepayment</div>
                    </div>
                  </div>
                )}

                {/* KPI GRID */}
                <div className="kpi-panel">
                  <span className="panel-title">◈ Side-by-Side Outcome</span>
                  <div className="kpi-grid">
                    <div className="kpi-card navy">
                      <div className="kpi-lbl">Interest Saved (Prepay)</div>
                      <div className="kpi-val">{fmt(calc.interestSaved)}</div>
                      <div className="kpi-sub">loan closes {fmtM(calc.monthsSaved)} early</div>
                    </div>
                    <div className="kpi-card teal">
                      <div className="kpi-lbl">MF Gain After Tax (Invest)</div>
                      <div className="kpi-val">{fmt(calc.mfNet)}</div>
                      <div className="kpi-sub">{taxType==="none"?"no tax":taxType==="ltcg"?"10% LTCG":"30% tax"} on {fmt(calc.mfGross)} gross</div>
                    </div>
                    <div className={`kpi-card ${calc.winner==="prepay"?"navy":calc.winner==="invest"?"teal":"amber"}`}>
                      <div className="kpi-lbl">{calc.winner==="prepay"?"Prepay Edge":"Invest Edge"}</div>
                      <div className="kpi-val">{fmt(Math.abs(calc.diff))}</div>
                      <div className="kpi-sub">{calc.winner==="neutral"?"outcomes nearly equal":"in favour of " + calc.winner}</div>
                    </div>
                  </div>
                  {reinvestEMI && calc.reinvestBenefit > 0 && (
                    <div style={{marginTop:"12px",padding:"8px 12px",background:"var(--teal-l)",borderRadius:"9px",border:"1px solid var(--teal-b)",fontFamily:"DM Mono",fontSize:"9px",color:"var(--teal)"}}>
                      ✦ Reinvesting freed EMI ({fmt(emi)}/mo for {fmtM(calc.monthsSaved)}) adds <strong>{fmt(calc.reinvestBenefit)}</strong> to the prepay outcome after {taxType==="none"?"no":"applicable"} tax.
                    </div>
                  )}
                </div>

                {/* BREAKEVEN INSIGHTS */}
                <div className="breakeven-panel">
                  <div className="table-hdr">
                    <span className="panel-title">◈ Key Insights</span>
                  </div>
                  <div className="be-row">
                    <span>🔒</span>
                    <span>Prepayment gives a <strong>guaranteed {loanRate}% effective return</strong> — risk-free, equivalent to a tax-free bond at your loan rate.</span>
                  </div>
                  <div className="be-row">
                    <span>📊</span>
                    <span>Your MF needs to deliver <strong>{calc.beReturn ? fmtPct(calc.beReturn) : "—"} post-tax</strong> just to break even with prepayment — accounting for {taxType==="none"?"no tax":taxType==="ltcg"?"10% LTCG":"30% income tax"} on gains.</span>
                  </div>
                  <div className="be-row">
                    <span>⏱</span>
                    <span>Prepaying <strong>{fmt(lumpAmt_n)}</strong> at month <strong>{lumpMonth}</strong> closes your loan <strong>{fmtM(calc.monthsSaved)}</strong> early, freeing up <strong>{fmt(emi)}/mo</strong> in cash flow.</span>
                  </div>
                  {parseFloat(mfReturn) > parseFloat(loanRate) ? (
                    <div className="be-row">
                      <span>⚠</span>
                      <span>MF return assumption ({mfReturn}%) exceeds loan rate ({loanRate}%). Equity returns are <strong>uncertain</strong> — consider risk tolerance before choosing to invest over prepaying.</span>
                    </div>
                  ) : (
                    <div className="be-row">
                      <span>✓</span>
                      <span>Your loan rate ({loanRate}%) exceeds the assumed MF return ({mfReturn}%). Prepayment is the <strong>mathematically dominant</strong> choice at these parameters.</span>
                    </div>
                  )}
                </div>

                {/* CHART */}
                <div className="chart-panel">
                  <div className="chart-hdr">
                    <span className="panel-title">◈ Wealth Trajectory</span>
                    <div className="chart-legend">
                      <div className="leg-item"><div className="leg-line" style={{background:"var(--navy)"}}/> Balance (Prepaid)</div>
                      <div className="leg-item"><div className="leg-line" style={{background:"#9c9890",backgroundImage:"repeating-linear-gradient(90deg,#9c9890 0,#9c9890 5px,transparent 5px,transparent 8px)"}}/> Balance (No prepay)</div>
                      <div className="leg-item"><div className="leg-line" style={{background:"var(--teal)"}}/> MF Corpus (net)</div>
                    </div>
                  </div>
                  <div className="chart-scroll">
                    <WealthChart
                      prepayRows={calc.prepayResult.yearlyBalance}
                      noPrepayRows={calc.noPrepayResult.yearlyBalance}
                      mfRows={calc.mfResult.yearlyCorpus.map(r=>({...r, corpus: calc.lumpAmt_n + (r.corpus - (calc.lumpAmt_n||lumpAmt_n)) * (1-taxRate)}))}
                      lumpMonth={lumpMonth_n}
                      maxMonths={calc.noPrepayResult.months}
                    />
                  </div>
                </div>

                {/* YEAR-WISE TABLE */}
                <div className="table-panel">
                  <div className="table-hdr">
                    <span className="panel-title">◈ Year-wise Comparison</span>
                    <span style={{fontFamily:"DM Mono",fontSize:"8.5px",color:"var(--ink3)"}}>MF corpus is post-tax</span>
                  </div>
                  <div className="res-scroll">
                    <table className="res-table">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Balance (No Prepay)</th>
                          <th>Balance (Prepaid)</th>
                          <th>MF Corpus (net)</th>
                          <th>Better Choice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calc.yearlyTable.map((row, i) => {
                          const interestSavedToDate = row.intSavedYTD;
                          const mfVsInterest = row.mfCorp - lumpAmt_n;
                          const winner = mfVsInterest > interestSavedToDate ? "invest" : "prepay";
                          return (
                            <tr key={i}>
                              <td>Y{row.year}</td>
                              <td style={{color:"var(--ink3)"}}>{fmt(row.noBal)}</td>
                              <td className="col-prepay">{fmt(row.prepBal)}</td>
                              <td className="col-invest">{fmt(row.mfCorp)}</td>
                              <td className={winner==="prepay"?"col-prepay col-win":"col-invest col-win"}>
                                {winner==="prepay"?"🏦 Prepay":"📈 Invest"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="sense-note">
                    MF returns are assumed at {mfReturn}% p.a. flat. Equity returns are market-linked and not guaranteed. Tax computed at {taxType==="ltcg"?"10% LTCG":taxType==="debt"?"30% slab":""}{taxType==="none"?"no tax":""}.
                  </div>
                </div>

                {/* B1 nudge */}
                <div className="b1-nudge">
                  <div className="b1-nudge-text">
                    <strong>Need the full EMI breakdown?</strong> B1 shows your amortization schedule, tenure comparison, and the full interest cost of your loan.
                  </div>
                  <a href="/loan-calculator" className="b1-link">← B1 EMI Calculator</a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
