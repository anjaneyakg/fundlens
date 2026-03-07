import { useState, useMemo } from "react";

// ─── STYLES ──────────────────────────────────────────────────────────────────
const style = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cream:    #faf6ef;
    --paper:    #f4ede0;
    --ink:      #1a1208;
    --ink2:     #3d3020;
    --muted:    #8c7a5e;
    --border:   rgba(60,40,10,0.12);
    --green:    #1a6b3c;
    --green-l:  #e8f5ee;
    --amber:    #b45309;
    --amber-l:  #fef3c7;
    --red:      #9b1c1c;
    --red-l:    #fef2f2;
    --blue:     #1e40af;
    --blue-l:   #eff6ff;
    --gold:     #d97706;
  }

  body { background: var(--cream); color: var(--ink); font-family: 'DM Sans', sans-serif; }

  .calc-page {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 60% 40% at 100% 0%, rgba(180,83,9,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 50% 50% at 0% 100%, rgba(26,107,60,0.05) 0%, transparent 60%),
      var(--cream);
  }

  /* HEADER */
  .calc-header {
    padding: 3rem 2rem 2rem;
    max-width: 1100px; margin: 0 auto;
    border-bottom: 1px solid var(--border);
  }
  .calc-eyebrow {
    font-family: 'DM Mono'; font-size: 11px; letter-spacing: 3px;
    text-transform: uppercase; color: var(--amber); margin-bottom: 10px;
  }
  .calc-title {
    font-family: 'Playfair Display'; font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 900; line-height: 1.05; color: var(--ink);
    margin-bottom: 12px;
  }
  .calc-title span { color: var(--green); }
  .calc-subtitle {
    font-size: 15px; color: var(--muted); max-width: 540px; line-height: 1.6;
  }

  /* MAIN LAYOUT */
  .calc-body {
    max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: 380px 1fr;
    gap: 2rem; padding: 2rem;
    align-items: start;
  }

  /* INPUT PANEL */
  .input-panel {
    background: white; border: 1px solid var(--border);
    border-radius: 16px; padding: 1.75rem;
    box-shadow: 0 4px 24px rgba(60,40,10,0.06);
    position: sticky; top: 2rem;
  }
  .panel-title {
    font-family: 'Playfair Display'; font-size: 1.1rem; font-weight: 700;
    color: var(--ink); margin-bottom: 1.25rem; padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .panel-section { margin-bottom: 1.25rem; }
  .section-label {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
  }

  .field { margin-bottom: 14px; }
  .field-label {
    font-size: 12px; font-weight: 500; color: var(--ink2);
    margin-bottom: 5px; display: flex; justify-content: space-between;
  }
  .field-value {
    font-family: 'DM Mono'; font-size: 11px; color: var(--amber); font-weight: 500;
  }
  .field-input {
    width: 100%; padding: 9px 12px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--cream); color: var(--ink);
    font-family: 'DM Mono'; font-size: 13px;
    outline: none; transition: border 0.15s, box-shadow 0.15s;
  }
  .field-input:focus {
    border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(217,119,6,0.1);
  }

  .range-wrap { position: relative; }
  .range-input {
    -webkit-appearance: none; width: 100%; height: 4px;
    border-radius: 2px; outline: none; cursor: pointer;
    background: linear-gradient(to right, var(--gold) 0%, var(--border) 0%);
  }
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: var(--gold); cursor: pointer;
    box-shadow: 0 2px 6px rgba(217,119,6,0.35);
    border: 2px solid white;
  }

  .preset-row { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .preset-btn {
    padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border);
    background: transparent; font-family: 'DM Mono'; font-size: 11px;
    color: var(--muted); cursor: pointer; transition: all 0.15s;
  }
  .preset-btn.active { background: var(--amber); color: white; border-color: var(--amber); }
  .preset-btn:hover:not(.active) { border-color: var(--gold); color: var(--ink); }

  .divider { height: 1px; background: var(--border); margin: 1rem 0; }

  /* RESULTS PANEL */
  .results-panel { display: flex; flex-direction: column; gap: 1.25rem; }

  /* WINNER BANNER */
  .winner-banner {
    border-radius: 16px; padding: 1.5rem 1.75rem;
    display: flex; align-items: center; gap: 16px;
    animation: fadeUp 0.4s ease both;
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  .winner-icon { font-size: 2.5rem; }
  .winner-label { font-family: 'DM Mono'; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .winner-title { font-family: 'Playfair Display'; font-size: 1.5rem; font-weight: 700; }
  .winner-diff { font-size: 13px; margin-top: 4px; opacity: 0.85; }

  /* THREE CARDS */
  .cards-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;
  }
  .result-card {
    background: white; border: 1px solid var(--border);
    border-radius: 14px; padding: 1.25rem;
    box-shadow: 0 2px 12px rgba(60,40,10,0.05);
    transition: transform 0.15s, box-shadow 0.15s;
    animation: fadeUp 0.4s ease both;
  }
  .result-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(60,40,10,0.1); }
  .result-card.winner { border-width: 2px; }
  .card-scenario {
    font-family: 'DM Mono'; font-size: 9px; letter-spacing: 2px;
    text-transform: uppercase; margin-bottom: 8px;
  }
  .card-name {
    font-family: 'Playfair Display'; font-size: 1rem; font-weight: 700;
    color: var(--ink); margin-bottom: 12px; line-height: 1.2;
  }
  .card-metric { margin-bottom: 10px; }
  .metric-label { font-size: 11px; color: var(--muted); margin-bottom: 2px; }
  .metric-value { font-family: 'DM Mono'; font-size: 13px; font-weight: 500; color: var(--ink); }
  .metric-value.big { font-size: 1.3rem; font-family: 'Playfair Display'; font-weight: 700; }
  .card-tag {
    display: inline-block; font-family: 'DM Mono'; font-size: 9px;
    letter-spacing: 1px; text-transform: uppercase;
    padding: 3px 8px; border-radius: 20px; margin-top: 8px;
  }

  /* VISUAL BAR CHART */
  .viz-panel {
    background: white; border: 1px solid var(--border);
    border-radius: 16px; padding: 1.5rem;
    box-shadow: 0 2px 12px rgba(60,40,10,0.05);
    animation: fadeUp 0.5s ease both;
  }
  .viz-title {
    font-family: 'Playfair Display'; font-size: 1rem; font-weight: 600;
    color: var(--ink); margin-bottom: 1.25rem;
  }
  .bar-group { margin-bottom: 16px; }
  .bar-label-row {
    display: flex; justify-content: space-between;
    font-size: 12px; color: var(--ink2); margin-bottom: 6px;
    font-weight: 500;
  }
  .bar-track {
    height: 10px; background: var(--paper); border-radius: 5px; overflow: hidden;
  }
  .bar-fill {
    height: 100%; border-radius: 5px;
    transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
  }
  .bar-sublabel { font-size: 11px; color: var(--muted); margin-top: 3px; }

  /* BREAKEVEN */
  .breakeven-panel {
    background: var(--amber-l); border: 1px solid rgba(180,83,9,0.15);
    border-radius: 14px; padding: 1.25rem 1.5rem;
    animation: fadeUp 0.6s ease both;
  }
  .breakeven-title {
    font-family: 'DM Mono'; font-size: 10px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--amber); margin-bottom: 8px;
  }
  .breakeven-text {
    font-size: 14px; color: var(--ink2); line-height: 1.6;
  }
  .breakeven-rate {
    font-family: 'Playfair Display'; font-size: 1.4rem; font-weight: 700;
    color: var(--amber);
  }

  /* AMORTISATION TOGGLE */
  .amort-toggle {
    background: none; border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 16px; font-family: 'DM Mono'; font-size: 11px;
    color: var(--muted); cursor: pointer; transition: all 0.15s;
    letter-spacing: 0.5px;
  }
  .amort-toggle:hover { border-color: var(--gold); color: var(--ink); }

  .amort-table {
    width: 100%; border-collapse: collapse; margin-top: 1rem;
    font-family: 'DM Mono'; font-size: 11px;
  }
  .amort-table th {
    text-align: right; padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--muted); font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
  }
  .amort-table th:first-child { text-align: left; }
  .amort-table td {
    text-align: right; padding: 7px 10px;
    border-bottom: 1px solid rgba(60,40,10,0.05);
    color: var(--ink2);
  }
  .amort-table td:first-child { text-align: left; color: var(--muted); }
  .amort-table tr:hover td { background: var(--paper); }

  @media (max-width: 900px) {
    .calc-body { grid-template-columns: 1fr; }
    .cards-row { grid-template-columns: 1fr; }
    .input-panel { position: static; }
  }
`;

// ─── MATH ENGINE ─────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};
const fmtShort = (n) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

function calcEMI(principal, annualRate, months) {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12 / 100;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

function calcLoanSchedule(principal, annualRate, months) {
  const r    = annualRate / 12 / 100;
  const emi  = calcEMI(principal, annualRate, months);
  let   bal  = principal;
  let   totalInterest = 0;
  const schedule = [];
  for (let i = 1; i <= months; i++) {
    const interest  = bal * r;
    const principal_ = emi - interest;
    bal            -= principal_;
    totalInterest  += interest;
    schedule.push({
      month: i, emi: Math.round(emi),
      principal: Math.round(principal_),
      interest:  Math.round(interest),
      balance:   Math.round(Math.max(0, bal)),
      cumInterest: Math.round(totalInterest),
    });
  }
  return { emi, totalInterest, schedule };
}

function calcSIPCorpus(monthlySIP, annualReturn, months) {
  const r = annualReturn / 12 / 100;
  if (r === 0) return monthlySIP * months;
  return monthlySIP * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

function calcLumpsumCorpus(amount, annualReturn, months) {
  return amount * Math.pow(1 + annualReturn / 100, months / 12);
}

function computeThreeWay(inputs) {
  const { loanAmount, rate, tenureMonths, lumpsum, mfReturn } = inputs;

  // ── BASELINE: Original loan ──────────────────────────────
  const base      = calcLoanSchedule(loanAmount, rate, tenureMonths);
  const baseEMI   = base.emi;
  const baseTotalInterest = base.totalInterest;

  // ── SCENARIO A: Prepay lumpsum, keep EMI same (tenure reduces) ──
  const afterPrepay   = Math.max(0, loanAmount - lumpsum);
  let   prepayMonths  = tenureMonths;
  if (afterPrepay > 0) {
    // Find new tenure with same EMI
    const r = rate / 12 / 100;
    if (r > 0) {
      prepayMonths = Math.ceil(
        Math.log(baseEMI / (baseEMI - afterPrepay * r)) / Math.log(1 + r)
      );
    } else {
      prepayMonths = Math.ceil(afterPrepay / baseEMI);
    }
    prepayMonths = Math.min(prepayMonths, tenureMonths);
  } else {
    prepayMonths = 0;
  }
  const prepaySchedule    = afterPrepay > 0
    ? calcLoanSchedule(afterPrepay, rate, prepayMonths)
    : { totalInterest: 0, schedule: [] };
  const prepayInterestSaved = baseTotalInterest - prepaySchedule.totalInterest;
  const prepayMonthsSaved   = tenureMonths - prepayMonths;
  // After loan closes early, EMI freed — invest that as SIP for remaining months
  const freeSIPMonths  = prepayMonthsSaved;
  const freeSIPCorpus  = freeSIPMonths > 0
    ? calcSIPCorpus(baseEMI, mfReturn, freeSIPMonths)
    : 0;
  const prepayNetWealth = prepayInterestSaved + freeSIPCorpus;

  // ── SCENARIO B: Reduce EMI, keep tenure same ─────────────
  const afterPrepayB    = Math.max(0, loanAmount - lumpsum);
  const newEMI          = afterPrepayB > 0
    ? calcEMI(afterPrepayB, rate, tenureMonths)
    : 0;
  const emiSavedMonthly = baseEMI - newEMI;
  const reduceSchedule  = afterPrepayB > 0
    ? calcLoanSchedule(afterPrepayB, rate, tenureMonths)
    : { totalInterest: 0 };
  const reduceInterestSaved = baseTotalInterest - reduceSchedule.totalInterest;
  // Invest the monthly EMI saving as SIP
  const reduceSIPCorpus = emiSavedMonthly > 0
    ? calcSIPCorpus(emiSavedMonthly, mfReturn, tenureMonths)
    : 0;
  const reduceNetWealth = reduceInterestSaved + reduceSIPCorpus;

  // ── SCENARIO C: Invest lumpsum + continue SIP with EMI saving ──
  // Keep original loan, invest lumpsum in MF + continue paying full EMI
  // (no EMI saving, but lumpsum grows)
  const investLumpsumCorpus = calcLumpsumCorpus(lumpsum, mfReturn, tenureMonths);
  // Total interest paid (cost)
  const investNetWealth     = investLumpsumCorpus - baseTotalInterest;

  // ── BREAKEVEN: At what MF return does Invest beat Prepay? ──
  let breakeven = null;
  for (let r = 0; r <= 30; r += 0.1) {
    const testCorpus = calcLumpsumCorpus(lumpsum, r, tenureMonths);
    const testNet    = testCorpus - baseTotalInterest;
    if (testNet >= prepayNetWealth) {
      breakeven = r;
      break;
    }
  }

  // ── DETERMINE WINNER ──────────────────────────────────────
  const scenarios = [
    { key: "prepay",  label: "Prepay Loan",     net: prepayNetWealth  },
    { key: "reduce",  label: "Reduce EMI + SIP", net: reduceNetWealth  },
    { key: "invest",  label: "Invest in MF",     net: investNetWealth  },
  ];
  const winner = scenarios.reduce((a, b) => a.net > b.net ? a : b);
  const maxNet = Math.max(...scenarios.map(s => s.net));

  return {
    baseEMI, baseTotalInterest,
    // Scenario A
    prepayMonths, prepayMonthsSaved, prepayInterestSaved,
    freeSIPCorpus, prepayNetWealth,
    // Scenario B
    newEMI, emiSavedMonthly, reduceInterestSaved,
    reduceSIPCorpus, reduceNetWealth,
    // Scenario C
    investLumpsumCorpus, investNetWealth,
    // Summary
    winner, scenarios, maxNet, breakeven,
    schedule: base.schedule,
  };
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
const RETURN_PRESETS = [
  { label: "Conservative 10%", value: 10 },
  { label: "Moderate 12%",     value: 12 },
  { label: "Aggressive 14%",   value: 14 },
];

const SCENARIO_COLORS = {
  prepay:  { bg: "#e8f5ee", border: "#1a6b3c", text: "#1a6b3c", tag: "#1a6b3c", tagBg: "#e8f5ee" },
  reduce:  { bg: "#eff6ff", border: "#1e40af", text: "#1e40af", tag: "#1e40af", tagBg: "#eff6ff" },
  invest:  { bg: "#fef3c7", border: "#b45309", text: "#b45309", tag: "#b45309", tagBg: "#fef3c7" },
};

export default function LoanVsSIP() {
  const [loanAmount,    setLoanAmount]    = useState(5000000);
  const [rate,          setRate]          = useState(8.5);
  const [tenureYears,   setTenureYears]   = useState(20);
  const [lumpsum,       setLumpsum]       = useState(500000);
  const [mfReturn,      setMfReturn]      = useState(12);
  const [showAmort,     setShowAmort]     = useState(false);

  const tenureMonths = tenureYears * 12;

  const result = useMemo(() =>
    computeThreeWay({ loanAmount, rate, tenureMonths, lumpsum, mfReturn }),
    [loanAmount, rate, tenureMonths, lumpsum, mfReturn]
  );

  const winnerColors = SCENARIO_COLORS[result.winner.key];

  const updateRange = (setter, val, min, max) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= min && n <= max) setter(n);
  };

  return (
    <div className="calc-page">
      <style>{style}</style>

      <div className="calc-header">
        <div className="calc-eyebrow">◈ FundLens Decision Tool</div>
        <div className="calc-title">
          Loan Prepayment<br/>
          <span>vs SIP Investment</span>
        </div>
        <div className="calc-subtitle">
          Your ₹{fmtShort(lumpsum)} surplus — three ways to deploy it.
          See exactly which decision builds more wealth over {tenureYears} years.
        </div>
      </div>

      <div className="calc-body">

        {/* ── INPUT PANEL ── */}
        <div className="input-panel">
          <div className="panel-title">
            <span>🏠</span> Home Loan Details
          </div>

          <div className="panel-section">
            <div className="section-label">Loan Parameters</div>

            <div className="field">
              <div className="field-label">
                <span>Outstanding Loan Amount</span>
                <span className="field-value">{fmtShort(loanAmount)}</span>
              </div>
              <div className="range-wrap">
                <input type="range" className="range-input"
                  min="500000" max="50000000" step="100000"
                  value={loanAmount}
                  style={{background:`linear-gradient(to right, var(--gold) ${(loanAmount-500000)/(50000000-500000)*100}%, var(--border) 0%)`}}
                  onChange={e => setLoanAmount(+e.target.value)} />
              </div>
              <input type="number" className="field-input" style={{marginTop:"6px"}}
                value={loanAmount} min="500000" max="50000000"
                onChange={e => updateRange(setLoanAmount, e.target.value, 100000, 100000000)} />
            </div>

            <div className="field">
              <div className="field-label">
                <span>Interest Rate (% p.a.)</span>
                <span className="field-value">{rate}%</span>
              </div>
              <input type="range" className="range-input"
                min="6" max="15" step="0.1"
                value={rate}
                style={{background:`linear-gradient(to right, var(--gold) ${(rate-6)/(15-6)*100}%, var(--border) 0%)`}}
                onChange={e => setRate(+e.target.value)} />
            </div>

            <div className="field">
              <div className="field-label">
                <span>Remaining Tenure</span>
                <span className="field-value">{tenureYears} years</span>
              </div>
              <input type="range" className="range-input"
                min="1" max="30" step="1"
                value={tenureYears}
                style={{background:`linear-gradient(to right, var(--gold) ${(tenureYears-1)/(30-1)*100}%, var(--border) 0%)`}}
                onChange={e => setTenureYears(+e.target.value)} />
            </div>
          </div>

          <div className="divider" />

          <div className="panel-section">
            <div className="section-label">Your Surplus</div>
            <div className="field">
              <div className="field-label">
                <span>Lumpsum Available</span>
                <span className="field-value">{fmtShort(lumpsum)}</span>
              </div>
              <div className="range-wrap">
                <input type="range" className="range-input"
                  min="50000" max="5000000" step="50000"
                  value={lumpsum}
                  style={{background:`linear-gradient(to right, var(--gold) ${(lumpsum-50000)/(5000000-50000)*100}%, var(--border) 0%)`}}
                  onChange={e => setLumpsum(+e.target.value)} />
              </div>
              <input type="number" className="field-input" style={{marginTop:"6px"}}
                value={lumpsum} min="50000"
                onChange={e => updateRange(setLumpsum, e.target.value, 10000, 50000000)} />
            </div>
          </div>

          <div className="divider" />

          <div className="panel-section">
            <div className="section-label">Expected MF Return</div>
            <div className="preset-row">
              {RETURN_PRESETS.map(p => (
                <button key={p.value}
                  className={`preset-btn ${mfReturn === p.value ? "active" : ""}`}
                  onClick={() => setMfReturn(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="field">
              <div className="field-label">
                <span>Custom Return</span>
                <span className="field-value">{mfReturn}% p.a.</span>
              </div>
              <input type="range" className="range-input"
                min="6" max="20" step="0.5"
                value={mfReturn}
                style={{background:`linear-gradient(to right, var(--gold) ${(mfReturn-6)/(20-6)*100}%, var(--border) 0%)`}}
                onChange={e => setMfReturn(+e.target.value)} />
            </div>
          </div>

          <div className="divider" />
          <div style={{fontFamily:"'DM Mono'",fontSize:"10px",color:"var(--muted)",lineHeight:"1.6"}}>
            Current EMI: <strong style={{color:"var(--ink)"}}>{fmt(result.baseEMI)}/mo</strong><br/>
            Total interest (original): <strong style={{color:"var(--red)"}}>{fmt(result.baseTotalInterest)}</strong>
          </div>
        </div>

        {/* ── RESULTS ── */}
        <div className="results-panel">

          {/* Winner Banner */}
          <div className="winner-banner" style={{
            background: winnerColors.bg,
            border: `2px solid ${winnerColors.border}`,
          }}>
            <div className="winner-icon">
              {result.winner.key === "prepay" ? "🏦" : result.winner.key === "reduce" ? "📉" : "📈"}
            </div>
            <div>
              <div className="winner-label" style={{color: winnerColors.text}}>
                ◈ Recommended Strategy
              </div>
              <div className="winner-title" style={{color: winnerColors.text}}>
                {result.winner.label} wins
              </div>
              <div className="winner-diff" style={{color: winnerColors.text}}>
                Net advantage: {fmt(result.winner.net)} over {tenureYears} years
                {result.scenarios.length > 1 && (() => {
                  const sorted = [...result.scenarios].sort((a,b) => b.net - a.net);
                  const margin = sorted[0].net - sorted[1].net;
                  return ` · beats 2nd by ${fmt(margin)}`;
                })()}
              </div>
            </div>
          </div>

          {/* Three Cards */}
          <div className="cards-row">
            {/* Card A: Prepay */}
            {(() => {
              const c = SCENARIO_COLORS.prepay;
              const isWinner = result.winner.key === "prepay";
              return (
                <div className="result-card" style={{
                  borderColor: isWinner ? c.border : "var(--border)",
                  borderWidth: isWinner ? "2px" : "1px",
                }}>
                  <div className="card-scenario" style={{color: c.text}}>Scenario A</div>
                  <div className="card-name">Prepay Loan</div>
                  <div className="card-metric">
                    <div className="metric-label">Interest Saved</div>
                    <div className="metric-value big" style={{color: c.text}}>
                      {fmt(result.prepayInterestSaved)}
                    </div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Tenure Reduced By</div>
                    <div className="metric-value">{result.prepayMonthsSaved} months</div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">SIP from freed EMI</div>
                    <div className="metric-value">{fmt(result.freeSIPCorpus)}</div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Total Benefit</div>
                    <div className="metric-value" style={{color:c.text,fontWeight:600}}>
                      {fmt(result.prepayNetWealth)}
                    </div>
                  </div>
                  {isWinner && (
                    <div className="card-tag" style={{background: c.tagBg, color: c.text, border:`1px solid ${c.border}`}}>
                      ★ WINNER
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Card B: Reduce EMI */}
            {(() => {
              const c = SCENARIO_COLORS.reduce;
              const isWinner = result.winner.key === "reduce";
              return (
                <div className="result-card" style={{
                  borderColor: isWinner ? c.border : "var(--border)",
                  borderWidth: isWinner ? "2px" : "1px",
                }}>
                  <div className="card-scenario" style={{color: c.text}}>Scenario B</div>
                  <div className="card-name">Reduce EMI + SIP</div>
                  <div className="card-metric">
                    <div className="metric-label">New EMI</div>
                    <div className="metric-value big" style={{color: c.text}}>
                      {fmt(result.newEMI)}/mo
                    </div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Monthly Saving</div>
                    <div className="metric-value">{fmt(result.emiSavedMonthly)}/mo</div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">SIP Corpus Built</div>
                    <div className="metric-value">{fmt(result.reduceSIPCorpus)}</div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Total Benefit</div>
                    <div className="metric-value" style={{color:c.text,fontWeight:600}}>
                      {fmt(result.reduceNetWealth)}
                    </div>
                  </div>
                  {isWinner && (
                    <div className="card-tag" style={{background: c.tagBg, color: c.text, border:`1px solid ${c.border}`}}>
                      ★ WINNER
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Card C: Invest */}
            {(() => {
              const c = SCENARIO_COLORS.invest;
              const isWinner = result.winner.key === "invest";
              return (
                <div className="result-card" style={{
                  borderColor: isWinner ? c.border : "var(--border)",
                  borderWidth: isWinner ? "2px" : "1px",
                }}>
                  <div className="card-scenario" style={{color: c.text}}>Scenario C</div>
                  <div className="card-name">Invest in Mutual Fund</div>
                  <div className="card-metric">
                    <div className="metric-label">MF Corpus at {tenureYears}Y</div>
                    <div className="metric-value big" style={{color: c.text}}>
                      {fmt(result.investLumpsumCorpus)}
                    </div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Interest Cost (loan)</div>
                    <div className="metric-value" style={{color:"var(--red)"}}>
                      − {fmt(result.baseTotalInterest)}
                    </div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Assumed Return</div>
                    <div className="metric-value">{mfReturn}% p.a.</div>
                  </div>
                  <div className="card-metric">
                    <div className="metric-label">Net Benefit</div>
                    <div className="metric-value" style={{
                      color: result.investNetWealth > 0 ? c.text : "var(--red)",
                      fontWeight: 600
                    }}>
                      {result.investNetWealth > 0 ? "" : "−"}{fmt(Math.abs(result.investNetWealth))}
                    </div>
                  </div>
                  {isWinner && (
                    <div className="card-tag" style={{background: c.tagBg, color: c.text, border:`1px solid ${c.border}`}}>
                      ★ WINNER
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Visual Comparison */}
          <div className="viz-panel">
            <div className="viz-title">Net Wealth Comparison — {tenureYears} Year Horizon</div>
            {result.scenarios.map(s => {
              const c    = SCENARIO_COLORS[s.key];
              const pct  = result.maxNet > 0 ? Math.max(4, (s.net / result.maxNet) * 100) : 4;
              const labels = {
                prepay: "Prepay Loan",
                reduce: "Reduce EMI + SIP",
                invest: `Invest @ ${mfReturn}%`,
              };
              return (
                <div className="bar-group" key={s.key}>
                  <div className="bar-label-row">
                    <span>{labels[s.key]}</span>
                    <span style={{color: c.text, fontFamily:"'DM Mono'", fontSize:"12px"}}>
                      {s.net > 0 ? "" : "−"}{fmtShort(Math.abs(s.net))}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${pct}%`,
                      background: s.key === result.winner.key
                        ? `linear-gradient(90deg, ${c.border}, ${c.text})`
                        : c.border,
                      opacity: s.key === result.winner.key ? 1 : 0.4,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Breakeven Panel */}
          {result.breakeven !== null && (
            <div className="breakeven-panel">
              <div className="breakeven-title">◈ Break-Even Analysis</div>
              <div className="breakeven-text">
                Investing beats prepayment only if your MF delivers more than{" "}
                <span className="breakeven-rate">{result.breakeven.toFixed(1)}% p.a.</span>
                {" "}consistently over {tenureYears} years.
                {mfReturn >= result.breakeven
                  ? ` At your assumed ${mfReturn}%, investing is the better call.`
                  : ` Your assumed ${mfReturn}% falls below this — prepayment wins.`
                }
              </div>
            </div>
          )}

          {/* Amortisation Table */}
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button className="amort-toggle" onClick={() => setShowAmort(v => !v)}>
              {showAmort ? "▲ Hide" : "▼ Show"} Year-wise Loan Schedule
            </button>
          </div>

          {showAmort && (
            <div className="viz-panel" style={{overflowX:"auto"}}>
              <div className="viz-title">Year-wise Amortisation Schedule</div>
              <table className="amort-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>EMI Paid</th>
                    <th>Principal</th>
                    <th>Interest</th>
                    <th>Cum. Interest</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({length: tenureYears}, (_, i) => {
                    const idx  = Math.min((i + 1) * 12 - 1, result.schedule.length - 1);
                    const row  = result.schedule[idx];
                    const startIdx = i * 12;
                    const yearRows = result.schedule.slice(startIdx, startIdx + 12);
                    const yearPrincipal = yearRows.reduce((s, r) => s + r.principal, 0);
                    const yearInterest  = yearRows.reduce((s, r) => s + r.interest,  0);
                    const yearEMI       = yearRows.reduce((s, r) => s + r.emi,       0);
                    return row ? (
                      <tr key={i}>
                        <td>Year {i + 1}</td>
                        <td>{fmt(yearEMI)}</td>
                        <td>{fmt(yearPrincipal)}</td>
                        <td style={{color:"var(--red)"}}>{fmt(yearInterest)}</td>
                        <td style={{color:"var(--red)"}}>{fmt(row.cumInterest)}</td>
                        <td>{fmt(row.balance)}</td>
                      </tr>
                    ) : null;
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
