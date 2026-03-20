import { useState, useMemo, useCallback } from "react";

// ─── Tier gate (same pattern as other tools) ───────────────────────────────
const TIER = "investor"; // "advisor" | "alpha" | "investor"

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7
    ? `₹${(n / 1e7).toFixed(2)} Cr`
    : n >= 1e5
    ? `₹${(n / 1e5).toFixed(2)} L`
    : `₹${Math.round(n).toLocaleString("en-IN")}`;

const pct = (n) => `${n.toFixed(1)}%`;

// Monthly SIP to reach FV given existing corpus
function sipRequired(targetCorpus, existingCorpus, monthlyRate, months) {
  if (months <= 0) return 0;
  const fvExisting = existingCorpus * Math.pow(1 + monthlyRate, months);
  const gap = targetCorpus - fvExisting;
  if (monthlyRate === 0) return Math.max(0, gap / months);
  const fvFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  return Math.max(0, gap / fvFactor);
}

// Corpus needed at retirement to sustain inflation-adjusted expenses
function corpusNeeded(monthlyExpenseAtRetirement, postRetRate, inflationRate, years) {
  const mr = postRetRate / 12;
  const mi = inflationRate / 12;
  const months = years * 12;
  if (Math.abs(mr - mi) < 1e-9) return monthlyExpenseAtRetirement * months;
  // PV of growing annuity
  return (
    monthlyExpenseAtRetirement *
    (1 - Math.pow((1 + mi) / (1 + mr), months)) /
    (mr - mi)
  );
}

// Build post-retirement depletion series (monthly → yearly sampled)
function depletionSeries(corpus, monthlyExpense, postRetRate, inflationRate, years) {
  const mr = postRetRate / 12;
  const mi = inflationRate / 12;
  const months = years * 12;
  let bal = corpus;
  let exp = monthlyExpense;
  const series = [{ year: 0, balance: bal }];
  for (let m = 1; m <= months; m++) {
    bal = bal * (1 + mr) - exp;
    exp = exp * (1 + mi);
    if (m % 12 === 0) series.push({ year: m / 12, balance: Math.max(0, bal) });
  }
  return series;
}

// Build pre-retirement corpus growth series (yearly)
function accumulationSeries(existingCorpus, sip, preRetRate, years) {
  const mr = preRetRate / 12;
  const series = [{ year: 0, balance: existingCorpus }];
  let bal = existingCorpus;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) {
      bal = bal * (1 + mr) + sip;
    }
    series.push({ year: y, balance: bal });
  }
  return series;
}

// ─── Mini chart using SVG ──────────────────────────────────────────────────
function LineChart({ series, color, label, zeroLine }) {
  if (!series || series.length < 2) return null;
  const W = 560, H = 200, PL = 70, PR = 20, PT = 16, PB = 36;
  const iW = W - PL - PR, iH = H - PT - PB;
  const vals = series.map((d) => d.balance);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;
  const xs = series.map((_, i) => PL + (i / (series.length - 1)) * iW);
  const ys = series.map((d) => PT + iH - ((d.balance - minV) / range) * iH);
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area =
    `M${xs[0]},${PT + iH} ` +
    xs.map((x, i) => `L${x},${ys[i]}`).join(" ") +
    ` L${xs[xs.length - 1]},${PT + iH} Z`;

  // y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    val: minV + t * range,
    y: PT + iH - t * iH,
  }));

  // x-axis labels — show ~5
  const xStep = Math.max(1, Math.floor(series.length / 5));
  const xLabels = series.filter((_, i) => i % xStep === 0 || i === series.length - 1);

  // Zero line y
  const zeroY = zeroLine ? PT + iH - ((0 - minV) / range) * iH : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color === "#1d4ed8" ? "#dbeafe" : "#dcfce7"} stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#e5e7eb" strokeDasharray="3,3" />
          <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
            {fmt(t.val).replace("₹", "")}
          </text>
        </g>
      ))}
      {/* Zero line */}
      {zeroY && zeroY < PT + iH && (
        <line x1={PL} x2={W - PR} y1={zeroY} y2={zeroY} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,2" />
      )}
      {/* Area */}
      <path d={area} fill={`url(#grad-${label})`} />
      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {/* X labels */}
      {xLabels.map((d, i) => {
        const idx = series.indexOf(d);
        return (
          <text key={i} x={xs[idx]} y={H - 6} textAnchor="middle" fontSize={10} fill="#9ca3af">
            Yr {d.year}
          </text>
        );
      })}
      {/* Label */}
      <text x={PL + 4} y={PT + 12} fontSize={11} fill={color} fontWeight="600">{label}</text>
    </svg>
  );
}

// ─── Slider with label ──────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange, display }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 700 }}>{display ?? value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#1d4ed8", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

// ─── Number input ───────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, prefix = "₹", suffix = "" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
        {prefix && <span style={{ padding: "8px 10px", background: "#f3f4f6", color: "#6b7280", fontSize: 13, borderRight: "1px solid #e5e7eb" }}>{prefix}</span>}
        <input
          type="number" value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, border: "none", background: "transparent", padding: "8px 10px", fontSize: 14, color: "#111827", outline: "none" }}
        />
        {suffix && <span style={{ padding: "8px 10px", color: "#6b7280", fontSize: 13, borderLeft: "1px solid #e5e7eb" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = "#1d4ed8", warn }) {
  return (
    <div style={{
      background: warn ? "#fef2f2" : "#f0f7ff",
      border: `1.5px solid ${warn ? "#fca5a5" : "#bfdbfe"}`,
      borderRadius: 12, padding: "14px 18px",
    }}>
      <div style={{ fontSize: 12, color: warn ? "#b91c1c" : "#4b5563", fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn ? "#dc2626" : accent, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function PreRetirementPlanner() {
  const [mode, setMode] = useState("accumulate"); // "accumulate" | "sustain"

  // Inputs
  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(60);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [currentCorpus, setCurrentCorpus] = useState(1500000);
  const [monthlyExpense, setMonthlyExpense] = useState(60000);
  const [preReturnRate, setPreReturnRate] = useState(12);
  const [postReturnRate, setPostReturnRate] = useState(7);
  const [inflationRate, setInflationRate] = useState(6);
  const [lumpsumFraction, setLumpsumFraction] = useState(0); // 0=all SIP, 100=all lumpsum
  const [earlyRetireAge, setEarlyRetireAge] = useState(retirementAge);

  // Sustain mode: user provides corpus at retirement
  const [corpusAtRetirement, setCorpusAtRetirement] = useState(20000000);

  const yearsToRetire = earlyRetireAge - currentAge;
  const yearsPostRetire = lifeExpectancy - earlyRetireAge;

  const results = useMemo(() => {
    if (yearsToRetire <= 0 || yearsPostRetire <= 0) return null;

    const preR = preReturnRate / 100;
    const postR = postReturnRate / 100;
    const infR = inflationRate / 100;
    const preRM = preR / 12;

    // Expense at retirement (inflation-adjusted)
    const expAtRetire = monthlyExpense * Math.pow(1 + infR, yearsToRetire);

    // Corpus target
    const target = corpusNeeded(expAtRetire, postR, infR, yearsPostRetire);

    if (mode === "accumulate") {
      // How much SIP (or lumpsum+SIP split) is needed?
      const months = yearsToRetire * 12;
      const fvExisting = currentCorpus * Math.pow(1 + preRM, months);
      const gap = Math.max(0, target - fvExisting);

      // Lumpsum fraction: user allocates lumpsumFraction% of gap as lumpsum today
      const lumpsumAmt = (lumpsumFraction / 100) * gap / Math.pow(1 + preRM, months);
      const effectiveCorpus = currentCorpus + lumpsumAmt;
      const sip = sipRequired(target, effectiveCorpus, preRM, months);

      // Projected corpus
      const projCorpus = effectiveCorpus * Math.pow(1 + preRM, months) +
        (preRM === 0 ? sip * months : sip * (Math.pow(1 + preRM, months) - 1) / preRM);

      const surplus = projCorpus - target;
      const accSeries = accumulationSeries(effectiveCorpus, sip, preR, yearsToRetire);
      const deplSeries = depletionSeries(projCorpus, expAtRetire, postR, infR, yearsPostRetire);

      return { target, sip, lumpsumAmt, projCorpus, surplus, expAtRetire, accSeries, deplSeries, gap };
    } else {
      // Sustain mode: how long does given corpus last?
      const deplSeries = depletionSeries(corpusAtRetirement, expAtRetire, postR, infR, yearsPostRetire);
      const lastPositive = deplSeries.reduce((last, d, i) => d.balance > 0 ? i : last, 0);
      const lastsYears = deplSeries[lastPositive]?.year ?? 0;
      const shortfall = corpusAtRetirement < target;
      const surplus = corpusAtRetirement - target;
      return { target, expAtRetire, deplSeries, lastsYears, shortfall, surplus, corpusAtRetirement };
    }
  }, [mode, currentAge, earlyRetireAge, lifeExpectancy, currentCorpus, monthlyExpense,
    preReturnRate, postReturnRate, inflationRate, lumpsumFraction, corpusAtRetirement,
    yearsToRetire, yearsPostRetire]);

  const tabStyle = (active) => ({
    flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700,
    border: "none", borderRadius: 8, cursor: "pointer",
    background: active ? "#1d4ed8" : "transparent",
    color: active ? "#fff" : "#6b7280",
    transition: "all 0.2s",
  });

  const sectionHead = (title) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12, marginTop: 4 }}>
      {title}
    </div>
  );

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: "linear-gradient(135deg, #f0f7ff 0%, #fafafa 60%, #f0fdf4 100%)",
      minHeight: "100vh", padding: "28px 16px",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 780, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
              C3 · Pre-Retirement Planner
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>
              Retirement Readiness
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>
              Plan your corpus, simulate depletion, stress-test early retirement
            </p>
          </div>
          <div style={{
            background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7",
            color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a",
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, letterSpacing: 0.8,
          }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left panel: inputs ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" }}>

          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 20 }}>
            <button style={tabStyle(mode === "accumulate")} onClick={() => setMode("accumulate")}>Plan Savings</button>
            <button style={tabStyle(mode === "sustain")} onClick={() => setMode("sustain")}>Will It Last?</button>
          </div>

          {sectionHead("Your Profile")}
          <Slider label="Current Age" value={currentAge} min={20} max={55} step={1}
            onChange={(v) => { setCurrentAge(v); if (earlyRetireAge < v + 1) setEarlyRetireAge(v + 1); }}
            display={`${currentAge} yrs`} />
          <Slider label="Planned Retirement Age" value={retirementAge} min={currentAge + 1} max={70} step={1}
            onChange={(v) => { setRetirementAge(v); setEarlyRetireAge(v); }} display={`${retirementAge} yrs`} />
          <Slider label="Life Expectancy" value={lifeExpectancy} min={retirementAge + 5} max={100} step={1}
            onChange={setLifeExpectancy} display={`${lifeExpectancy} yrs`} />

          {sectionHead("Early Retirement Stress Test")}
          <div style={{ background: "#fef9ec", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <Slider label="What if I retire at..." value={earlyRetireAge}
              min={currentAge + 1} max={retirementAge} step={1}
              onChange={setEarlyRetireAge} display={`Age ${earlyRetireAge} (${earlyRetireAge - currentAge} yrs away)`} />
            {earlyRetireAge < retirementAge && (
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                ⚡ {retirementAge - earlyRetireAge} years earlier than plan — corpus target rises
              </div>
            )}
          </div>

          {sectionHead("Finances")}
          <NumInput label="Current Savings / Corpus" value={currentCorpus} onChange={setCurrentCorpus} />
          <NumInput label="Monthly Expenses Today" value={monthlyExpense} onChange={setMonthlyExpense} suffix="/mo" />
          {mode === "sustain" && (
            <NumInput label="Corpus at Retirement" value={corpusAtRetirement} onChange={setCorpusAtRetirement} />
          )}

          {sectionHead("Return & Inflation Rates")}
          <Slider label="Pre-Retirement Return" value={preReturnRate} min={6} max={18} step={0.5}
            onChange={setPreReturnRate} display={pct(preReturnRate)} />
          <Slider label="Post-Retirement Return" value={postReturnRate} min={4} max={12} step={0.5}
            onChange={setPostReturnRate} display={pct(postReturnRate)} />
          <Slider label="Inflation Rate" value={inflationRate} min={3} max={10} step={0.5}
            onChange={setInflationRate} display={pct(inflationRate)} />

          {mode === "accumulate" && (
            <>
              {sectionHead("Savings Mix")}
              <Slider label="Lumpsum vs SIP allocation"
                value={lumpsumFraction} min={0} max={100} step={5}
                onChange={setLumpsumFraction}
                display={lumpsumFraction === 0 ? "100% SIP" : lumpsumFraction === 100 ? "100% Lumpsum" : `${lumpsumFraction}% Lump + ${100 - lumpsumFraction}% SIP`} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: -8, marginBottom: 8 }}>
                Slide right to replace SIP with a one-time deposit today
              </div>
            </>
          )}
        </div>

        {/* ── Right panel: results ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {!results ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", color: "#9ca3af" }}>
              Adjust inputs to see projections
            </div>
          ) : (
            <>
              {/* Key stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <StatCard
                  label="Corpus Needed at Retirement"
                  value={fmt(results.target)}
                  sub={`For ${yearsPostRetire} yrs post-retirement`}
                />
                <StatCard
                  label={`Monthly Expense at Retirement (Age ${earlyRetireAge})`}
                  value={fmt(results.expAtRetire)}
                  sub={`₹${monthlyExpense.toLocaleString("en-IN")}/mo today → inflated`}
                />
                {mode === "accumulate" && (
                  <>
                    <StatCard
                      label="Monthly SIP Required"
                      value={fmt(results.sip)}
                      sub={lumpsumFraction > 0 ? `After ₹${fmt(results.lumpsumAmt)} lumpsum today` : "Starting today"}
                      accent="#059669"
                    />
                    <StatCard
                      label={results.surplus >= 0 ? "Projected Surplus" : "Shortfall"}
                      value={fmt(Math.abs(results.surplus))}
                      sub={results.surplus >= 0 ? "Above target at retirement" : "Gap to cover"}
                      warn={results.surplus < 0}
                      accent="#059669"
                    />
                    {lumpsumFraction > 0 && (
                      <StatCard
                        label="Lumpsum to Deploy Today"
                        value={fmt(results.lumpsumAmt)}
                        sub={`${lumpsumFraction}% of gap — reduces SIP needed`}
                        accent="#7c3aed"
                      />
                    )}
                    <StatCard
                      label="Projected Corpus at Retirement"
                      value={fmt(results.projCorpus)}
                      sub={`Age ${earlyRetireAge} · ${yearsToRetire} yrs of compounding`}
                      accent="#0284c7"
                    />
                  </>
                )}
                {mode === "sustain" && (
                  <>
                    <StatCard
                      label={results.shortfall ? "Shortfall vs Target" : "Surplus vs Target"}
                      value={fmt(Math.abs(results.surplus))}
                      sub={results.shortfall ? "Corpus may run out early" : "Buffer above requirement"}
                      warn={results.shortfall}
                      accent="#059669"
                    />
                    <StatCard
                      label="Corpus Lasts Until"
                      value={results.lastsYears >= yearsPostRetire ? `Age ${lifeExpectancy}+` : `Age ${earlyRetireAge + results.lastsYears}`}
                      sub={results.lastsYears >= yearsPostRetire ? "Survives full retirement" : `${yearsPostRetire - results.lastsYears} yr shortfall`}
                      warn={results.lastsYears < yearsPostRetire}
                      accent="#059669"
                    />
                  </>
                )}
              </div>

              {/* Accumulation chart */}
              {mode === "accumulate" && results.accSeries && (
                <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                    Corpus Growth — Pre-Retirement ({yearsToRetire} yrs)
                  </div>
                  <LineChart series={results.accSeries} color="#1d4ed8" label="Portfolio Value" />
                </div>
              )}

              {/* Depletion chart */}
              {results.deplSeries && (
                <div style={{ background: "#fff", borderRadius: 16, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                    Corpus Depletion — Post-Retirement ({yearsPostRetire} yrs)
                    {results.deplSeries[results.deplSeries.length - 1]?.balance > 0
                      ? <span style={{ marginLeft: 8, fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ Corpus survives</span>
                      : <span style={{ marginLeft: 8, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>⚠ Runs out</span>}
                  </div>
                  <LineChart series={results.deplSeries} color="#059669" label="Remaining Corpus" zeroLine />
                </div>
              )}

              {/* Early retirement impact callout */}
              {earlyRetireAge < retirementAge && (
                <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 14, padding: "14px 18px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#c2410c", marginBottom: 6 }}>
                    ⚡ Early Retirement Impact
                  </div>
                  <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.7 }}>
                    Retiring at <strong>{earlyRetireAge}</strong> instead of <strong>{retirementAge}</strong> means:
                    <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                      <li><strong>{retirementAge - earlyRetireAge} fewer years</strong> of accumulation</li>
                      <li><strong>{retirementAge - earlyRetireAge} more years</strong> of corpus depletion</li>
                      <li>Target corpus rises to <strong>{fmt(results.target)}</strong></li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Assumptions footnote */}
              <div style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6" }}>
                <strong>Assumptions:</strong> SIP invested at month-end. Inflation compounds monthly on expenses post-retirement.
                Returns are pre-tax nominal. Pre-retirement: {pct(preReturnRate)} p.a. · Post-retirement: {pct(postReturnRate)} p.a. · Inflation: {pct(inflationRate)} p.a.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
