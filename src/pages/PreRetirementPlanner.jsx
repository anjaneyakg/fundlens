import { useState, useMemo } from "react";

const TIER = "investor"; // "advisor" | "alpha" | "investor"

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n) => `${Number(n).toFixed(1)}%`;

// ─── Math helpers ──────────────────────────────────────────────────────────
function sipRequired(target, corpus, mr, months) {
  if (months <= 0) return 0;
  const fv = corpus * Math.pow(1 + mr, months);
  const gap = target - fv;
  if (mr === 0) return Math.max(0, gap / months);
  return Math.max(0, gap / ((Math.pow(1 + mr, months) - 1) / mr));
}

function pvGrowingAnnuity(monthlyExp, postR, inflR, years) {
  const mr = postR / 12, mi = inflR / 12, months = years * 12;
  if (Math.abs(mr - mi) < 1e-9) return monthlyExp * months;
  return monthlyExp * (1 - Math.pow((1 + mi) / (1 + mr), months)) / (mr - mi);
}

function phasedCorpusNeeded(expAtRetireBase, retireAge, splitAge, lifeExp, postR, inflR, phase1Pct, phase2Pct) {
  const p1Years = splitAge - retireAge;
  const p2Years = lifeExp - splitAge;
  const exp1 = expAtRetireBase * (phase1Pct / 100);
  const pv1 = pvGrowingAnnuity(exp1, postR, inflR, p1Years);
  const exp2start = expAtRetireBase * Math.pow(1 + inflR / 12, p1Years * 12) * (phase2Pct / 100);
  const pv2atSplit = pvGrowingAnnuity(exp2start, postR, inflR, p2Years);
  const discountFactor = Math.pow(1 + postR / 12, -(p1Years * 12));
  return pv1 + pv2atSplit * discountFactor;
}

function phasedDepletionSeries(corpus, retireAge, splitAge, lifeExp, expAtRetireBase, phase1Pct, phase2Pct, postR, inflR) {
  const mr = postR / 12, mi = inflR / 12;
  let bal = corpus;
  let exp = expAtRetireBase * (phase1Pct / 100);
  const series = [{ age: retireAge, balance: bal }];
  const totalMonths = (lifeExp - retireAge) * 12;
  const splitMonth = (splitAge - retireAge) * 12;
  for (let m = 1; m <= totalMonths; m++) {
    if (m === splitMonth + 1) exp = exp * (phase2Pct / phase1Pct);
    bal = bal * (1 + mr) - exp;
    exp = exp * (1 + mi);
    if (m % 12 === 0) series.push({ age: retireAge + m / 12, balance: Math.max(0, bal) });
  }
  return series;
}

function accumulationSeries(corpus, sip, preR, currentAge, retireAge) {
  const mr = preR / 12;
  let bal = corpus;
  const series = [{ age: currentAge, balance: bal }];
  const years = retireAge - currentAge;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) bal = bal * (1 + mr) + sip;
    series.push({ age: currentAge + y, balance: bal });
  }
  return series;
}

// ─── LineChart ─────────────────────────────────────────────────────────────
function LineChart({ series, color, label, zeroLine, phaseSplitAge }) {
  if (!series || series.length < 2) return null;
  const W = 560, H = 200, PL = 72, PR = 16, PT = 20, PB = 36;
  const iW = W - PL - PR, iH = H - PT - PB;
  const vals = series.map(d => d.balance);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;
  const minAge = series[0].age, maxAge = series[series.length - 1].age;
  const ageRange = maxAge - minAge || 1;

  const xPos = (age) => PL + ((age - minAge) / ageRange) * iW;
  const yPos = (bal) => PT + iH - ((bal - minV) / range) * iH;

  const xs = series.map(d => xPos(d.age));
  const ys = series.map(d => yPos(d.balance));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `M${xs[0].toFixed(1)},${(PT + iH).toFixed(1)} ` +
    xs.map((x, i) => `L${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ") +
    ` L${xs[xs.length - 1].toFixed(1)},${(PT + iH).toFixed(1)} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: minV + t * range, y: PT + iH - t * iH }));

  const totalYears = maxAge - minAge;
  const stepYrs = Math.max(1, Math.ceil(totalYears / 4 / 5) * 5);
  const xLabels = [];
  for (let a = minAge; a <= maxAge; a += stepYrs) xLabels.push(a);
  if (xLabels[xLabels.length - 1] !== maxAge) xLabels.push(maxAge);

  const zeroY = zeroLine ? yPos(0) : null;
  const gradId = `grad${color.replace("#", "")}`;
  const fillColor = color === "#1d4ed8" ? "#dbeafe" : "#dcfce7";
  const splitX = phaseSplitAge ? xPos(phaseSplitAge) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      {splitX && (
        <>
          <rect x={PL} y={PT} width={splitX - PL} height={iH} fill="#EFF6FF" opacity="0.5" />
          <rect x={splitX} y={PT} width={W - PR - splitX} height={iH} fill="#F0FDF4" opacity="0.5" />
          <line x1={splitX} x2={splitX} y1={PT} y2={PT + iH} stroke="#93c5fd" strokeWidth={1} strokeDasharray="4,3" />
          <text x={splitX - 4} y={PT + 11} textAnchor="end" fontSize={9} fill="#3b82f6">Active</text>
          <text x={splitX + 4} y={PT + 11} textAnchor="start" fontSize={9} fill="#16a34a">Passive</text>
        </>
      )}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth={1} />
          <text x={PL - 5} y={t.y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
            {fmt(t.val).replace("₹", "")}
          </text>
        </g>
      ))}
      {zeroY && zeroY <= PT + iH && (
        <line x1={PL} x2={W - PR} y1={zeroY} y2={zeroY} stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="4,2" />
      )}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {xLabels.map((age, i) => (
        <text key={i} x={xPos(age).toFixed(1)} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {age}
        </text>
      ))}
      <text x={PL + 6} y={PT + 14} fontSize={10} fill={color} fontWeight="600">{label}</text>
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange, display, accentColor = "#1d4ed8" }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, suffix = "" }) {
  return (
    <div style={{ marginBottom: 13 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>{label}</label>}
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
        <span style={{ padding: "7px 9px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>₹</span>
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, border: "none", background: "transparent", padding: "7px 9px", fontSize: 13, color: "#111827", outline: "none" }} />
        {suffix && <span style={{ padding: "7px 9px", color: "#6b7280", fontSize: 12, borderLeft: "1px solid #e5e7eb" }}>{suffix}</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent = "#1d4ed8", warn }) {
  return (
    <div style={{ background: warn ? "#fef2f2" : "#f0f7ff", border: `1.5px solid ${warn ? "#fca5a5" : "#bfdbfe"}`, borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: warn ? "#b91c1c" : "#4b5563", fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: warn ? "#dc2626" : accent, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionHead({ title }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 6 }}>
      {title}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function PreRetirementPlanner() {
  const [mode, setMode] = useState("accumulate");
  const [corpusMode, setCorpusMode] = useState("auto");

  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(60);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);
  const [earlyRetireAge, setEarlyRetireAge] = useState(60);

  const [currentCorpus, setCurrentCorpus] = useState(1500000);
  const [monthlyExpense, setMonthlyExpense] = useState(60000);
  const [manualCorpus, setManualCorpus] = useState(20000000);

  const [preReturnRate, setPreReturnRate] = useState(12);
  const [postReturnRate, setPostReturnRate] = useState(7);
  const [inflationRate, setInflationRate] = useState(6);

  const [phaseSplitAge, setPhaseSplitAge] = useState(75);
  const [phase1Pct, setPhase1Pct] = useState(90);
  const [phase2Pct, setPhase2Pct] = useState(60);

  const [lumpsumFraction, setLumpsumFraction] = useState(0);

  const retAge = earlyRetireAge;
  const yearsToRetire = retAge - currentAge;
  const yearsPostRetire = lifeExpectancy - retAge;
  const effectiveSplitAge = Math.max(retAge + 1, Math.min(phaseSplitAge, lifeExpectancy - 1));

  const results = useMemo(() => {
    if (yearsToRetire <= 0 || yearsPostRetire <= 0) return null;
    const preR = preReturnRate / 100;
    const postR = postReturnRate / 100;
    const infR = inflationRate / 100;
    const preRM = preR / 12;

    const expAtRetireBase = monthlyExpense * Math.pow(1 + infR / 12, yearsToRetire * 12);
    const expPhase1 = expAtRetireBase * (phase1Pct / 100);
    const expPhase2AtSplit = expAtRetireBase * Math.pow(1 + infR / 12, (effectiveSplitAge - retAge) * 12) * (phase2Pct / 100);

    const target = phasedCorpusNeeded(expAtRetireBase, retAge, effectiveSplitAge, lifeExpectancy, postR, infR, phase1Pct, phase2Pct);
    const emergencyLow = expPhase1 * 6;
    const emergencyHigh = expPhase1 * 12;

    if (mode === "accumulate") {
      const months = yearsToRetire * 12;
      const fvExisting = currentCorpus * Math.pow(1 + preRM, months);
      const gap = Math.max(0, target - fvExisting);
      const lumpsumAmt = (lumpsumFraction / 100) * gap / Math.pow(1 + preRM, months);
      const effectiveCorpus = currentCorpus + lumpsumAmt;
      const sip = sipRequired(target, effectiveCorpus, preRM, months);
      const projCorpus = effectiveCorpus * Math.pow(1 + preRM, months) +
        (preRM === 0 ? sip * months : sip * (Math.pow(1 + preRM, months) - 1) / preRM);
      const surplus = projCorpus - target;
      const accSeries = accumulationSeries(effectiveCorpus, sip, preR, currentAge, retAge);
      const deplSeries = phasedDepletionSeries(projCorpus, retAge, effectiveSplitAge, lifeExpectancy, expAtRetireBase, phase1Pct, phase2Pct, postR, infR);
      return { target, sip, lumpsumAmt, projCorpus, surplus, expPhase1, expPhase2AtSplit, accSeries, deplSeries, emergencyLow, emergencyHigh };
    } else {
      const userCorpus = corpusMode === "manual" ? manualCorpus : target;
      const deplSeries = phasedDepletionSeries(userCorpus, retAge, effectiveSplitAge, lifeExpectancy, expAtRetireBase, phase1Pct, phase2Pct, postR, infR);
      const lastPositiveIdx = deplSeries.reduce((last, d, i) => d.balance > 0 ? i : last, 0);
      const lastsUntilAge = deplSeries[lastPositiveIdx]?.age ?? retAge;
      const survives = lastsUntilAge >= lifeExpectancy;
      const surplus = userCorpus - target;
      return { target, userCorpus, surplus, expPhase1, expPhase2AtSplit, deplSeries, lastsUntilAge, survives, emergencyLow, emergencyHigh };
    }
  }, [mode, corpusMode, currentAge, retAge, lifeExpectancy, effectiveSplitAge,
    currentCorpus, monthlyExpense, manualCorpus, preReturnRate, postReturnRate,
    inflationRate, phase1Pct, phase2Pct, lumpsumFraction, yearsToRetire, yearsPostRetire]);

  const tabStyle = (active) => ({
    flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 700,
    border: "none", borderRadius: 7, cursor: "pointer",
    background: active ? "#1d4ed8" : "transparent",
    color: active ? "#fff" : "#6b7280", transition: "all 0.2s",
  });

  const toggleStyle = (active) => ({
    flex: 1, padding: "7px 8px", fontSize: 11, fontWeight: active ? 700 : 500,
    border: `1px solid ${active ? "#1d4ed8" : "#e5e7eb"}`,
    borderRadius: 7, cursor: "pointer",
    background: active ? "#eff6ff" : "#fff",
    color: active ? "#1d4ed8" : "#9ca3af",
    transition: "all 0.15s", textAlign: "center",
  });

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "linear-gradient(135deg, #f0f7ff 0%, #fafafa 60%, #f0fdf4 100%)", minHeight: "100vh", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 860, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>C3 · Pre-Retirement Planner</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>Retirement Readiness</h1>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, marginBottom: 0 }}>Plan your corpus · Simulate depletion · Stress-test early retirement</p>
          </div>
          <div style={{ background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7", color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.8 }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "290px 1fr", gap: 18, alignItems: "start" }}>

        {/* ── Left: Inputs ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" }}>

          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 9, padding: 3, marginBottom: 18 }}>
            <button style={tabStyle(mode === "accumulate")} onClick={() => setMode("accumulate")}>Plan Savings</button>
            <button style={tabStyle(mode === "sustain")} onClick={() => setMode("sustain")}>Will It Last?</button>
          </div>

          <SectionHead title="Your Profile" />
          <Slider label="Current Age" value={currentAge} min={20} max={55} step={1}
            onChange={v => { setCurrentAge(v); if (retirementAge <= v) setRetirementAge(v + 1); if (earlyRetireAge <= v) setEarlyRetireAge(v + 1); }}
            display={`${currentAge} yrs`} />
          <Slider label="Planned Retirement Age" value={retirementAge} min={currentAge + 1} max={70} step={1}
            onChange={v => { setRetirementAge(v); setEarlyRetireAge(v); if (phaseSplitAge <= v) setPhaseSplitAge(v + 1); }}
            display={`${retirementAge} yrs`} />
          <Slider label="Life Expectancy" value={lifeExpectancy} min={retirementAge + 5} max={100} step={1}
            onChange={setLifeExpectancy} display={`${lifeExpectancy} yrs`} />

          <SectionHead title="Early Retirement Stress Test" />
          <div style={{ background: "#fef9ec", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 13 }}>
            <Slider label="What if I retire at..." value={earlyRetireAge}
              min={currentAge + 1} max={retirementAge} step={1}
              onChange={setEarlyRetireAge}
              display={`Age ${earlyRetireAge} (${earlyRetireAge - currentAge} yrs away)`}
              accentColor="#d97706" />
            {earlyRetireAge < retirementAge && (
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                ⚡ {retirementAge - earlyRetireAge} yrs earlier — corpus target rises
              </div>
            )}
          </div>

          <SectionHead title="Finances" />
          <NumInput label="Current Savings / Corpus" value={currentCorpus} onChange={setCurrentCorpus} />
          <NumInput label="Monthly Expenses Today" value={monthlyExpense} onChange={setMonthlyExpense} suffix="/mo" />

          {mode === "sustain" && (
            <div style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 6 }}>Corpus at Retirement</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button style={toggleStyle(corpusMode === "auto")} onClick={() => setCorpusMode("auto")}>Auto from expenses</button>
                <button style={toggleStyle(corpusMode === "manual")} onClick={() => setCorpusMode("manual")}>Enter my target</button>
              </div>
              {corpusMode === "auto" && results && (
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #bbf7d0", borderRadius: 8, background: "#f0fdf4", padding: "7px 12px" }}>
                  <span style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>{fmt(results.target)}</span>
                  <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>computed ↗</span>
                </div>
              )}
              {corpusMode === "manual" && (
                <>
                  <NumInput label="" value={manualCorpus} onChange={setManualCorpus} />
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: -8, marginBottom: 4 }}>
                    Shows surplus / shortfall vs computed {results ? fmt(results.target) : "target"}
                  </div>
                </>
              )}
            </div>
          )}

          <SectionHead title="Return & Inflation Rates" />
          <Slider label="Pre-Retirement Return" value={preReturnRate} min={6} max={18} step={0.5}
            onChange={setPreReturnRate} display={pct(preReturnRate)} />
          <Slider label="Post-Retirement Return" value={postReturnRate} min={4} max={12} step={0.5}
            onChange={setPostReturnRate} display={pct(postReturnRate)} />
          <Slider label="Inflation Rate" value={inflationRate} min={3} max={10} step={0.5}
            onChange={setInflationRate} display={pct(inflationRate)} />

          <SectionHead title="Post-Retirement Spending Phases" />
          <div style={{ background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 10, padding: "10px 12px", marginBottom: 13 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ fontSize: 10, color: "#1d4ed8", fontWeight: 700, marginBottom: 2 }}>Phase 1 — Active</div>
                <div style={{ fontSize: 11, color: "#3b82f6" }}>Ret. → Age {effectiveSplitAge}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Travel, lifestyle</div>
              </div>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, marginBottom: 2 }}>Phase 2 — Passive</div>
                <div style={{ fontSize: 11, color: "#16a34a" }}>Age {effectiveSplitAge} → {lifeExpectancy}</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Home, medical</div>
              </div>
            </div>
            <Slider label="Phase split age" value={effectiveSplitAge}
              min={retAge + 1} max={lifeExpectancy - 1} step={1}
              onChange={setPhaseSplitAge} display={`Age ${effectiveSplitAge}`} accentColor="#7c3aed" />
            <Slider label="Phase 1 expenses" value={phase1Pct} min={50} max={120} step={5}
              onChange={setPhase1Pct} display={`${phase1Pct}% of today`} accentColor="#1d4ed8" />
            <Slider label="Phase 2 expenses" value={phase2Pct} min={30} max={100} step={5}
              onChange={setPhase2Pct} display={`${phase2Pct}% of today`} accentColor="#059669" />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: -4 }}>Inflation applies within each phase independently</div>
          </div>

          {mode === "accumulate" && (
            <>
              <SectionHead title="Savings Mix" />
              <Slider label="Lumpsum vs SIP"
                value={lumpsumFraction} min={0} max={100} step={5}
                onChange={setLumpsumFraction}
                display={lumpsumFraction === 0 ? "100% SIP" : lumpsumFraction === 100 ? "100% Lumpsum" : `${lumpsumFraction}% Lump + ${100 - lumpsumFraction}% SIP`} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: -8, marginBottom: 8 }}>
                Slide right to replace SIP with a one-time deposit today
              </div>
            </>
          )}
        </div>

        {/* ── Right: Results ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!results ? (
            <div style={{ background: "#fff", borderRadius: 16, padding: 32, textAlign: "center", color: "#9ca3af" }}>Adjust inputs to see projections</div>
          ) : (
            <>
              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <StatCard label="Corpus Needed at Retirement" value={fmt(results.target)}
                  sub={`Phased model · ${yearsPostRetire} yrs post-retirement`} />
                <StatCard label={`Phase 1 Expense at Age ${retAge}`} value={`${fmt(results.expPhase1)}/mo`}
                  sub={`${phase1Pct}% of ₹${monthlyExpense.toLocaleString("en-IN")} inflated · active phase`} />

                {mode === "accumulate" && (
                  <>
                    <StatCard label="Monthly SIP Required" value={fmt(results.sip)}
                      sub={lumpsumFraction > 0 ? `After ${fmt(results.lumpsumAmt)} lumpsum today` : "Starting today"}
                      accent="#059669" />
                    <StatCard label={results.surplus >= 0 ? "Projected Surplus" : "Shortfall"}
                      value={fmt(Math.abs(results.surplus))}
                      sub={results.surplus >= 0 ? "Above target at retirement" : "Gap to cover"}
                      warn={results.surplus < 0} accent="#059669" />
                    {lumpsumFraction > 0 && (
                      <StatCard label="Lumpsum to Deploy Today" value={fmt(results.lumpsumAmt)}
                        sub={`${lumpsumFraction}% of gap · reduces SIP needed`} accent="#7c3aed" />
                    )}
                    <StatCard label={`Projected Corpus at Age ${retAge}`} value={fmt(results.projCorpus)}
                      sub={`${yearsToRetire} yrs of compounding`} accent="#0284c7" />
                  </>
                )}

                {mode === "sustain" && (
                  <>
                    <StatCard label={results.surplus >= 0 ? "Surplus vs Target" : "Shortfall vs Target"}
                      value={fmt(Math.abs(results.surplus))}
                      sub={results.surplus >= 0 ? "Buffer above requirement" : "Corpus may run out early"}
                      warn={results.surplus < 0} accent="#059669" />
                    <StatCard label="Corpus Lasts Until"
                      value={results.survives ? `Age ${lifeExpectancy}+` : `Age ${Math.round(results.lastsUntilAge)}`}
                      sub={results.survives ? "Survives full retirement" : `${Math.round(lifeExpectancy - results.lastsUntilAge)} yr shortfall`}
                      warn={!results.survives} accent="#059669" />
                  </>
                )}
              </div>

              {/* Emergency buffer */}
              <div style={{ border: "1.5px dashed #f59e0b", background: "#fffbeb", borderRadius: 14, padding: "14px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  ⚠ Suggested Emergency Buffer
                  <span style={{ fontSize: 10, background: "#fde68a", color: "#78350f", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>Advisory · not in projections</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#b45309" }}>
                  {fmt(results.emergencyLow)} – {fmt(results.emergencyHigh)}
                </div>
                <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>6–12 months of Phase 1 post-retirement expenses</div>
                <div style={{ fontSize: 11, color: "#78350f", marginTop: 8, paddingTop: 8, borderTop: "1px solid #fde68a", lineHeight: 1.6 }}>
                  Keep this in liquid instruments — FD, liquid MF, or savings account. Separate from your retirement corpus.
                </div>
              </div>

              {/* Accumulation chart */}
              {mode === "accumulate" && results.accSeries && (
                <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                    Corpus Growth — Pre-Retirement
                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400, marginLeft: 8 }}>Age {currentAge} → {retAge}</span>
                  </div>
                  <LineChart series={results.accSeries} color="#1d4ed8" label="Portfolio value" />
                </div>
              )}

              {/* Depletion chart */}
              {results.deplSeries && (
                <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                    Corpus Depletion — Post-Retirement
                    <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400, marginLeft: 8 }}>Age {retAge} → {lifeExpectancy}</span>
                    {results.deplSeries[results.deplSeries.length - 1]?.balance > 0
                      ? <span style={{ marginLeft: 10, fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ Corpus survives</span>
                      : <span style={{ marginLeft: 10, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>⚠ Runs out</span>}
                  </div>
                  <LineChart series={results.deplSeries} color="#059669" label="Remaining corpus"
                    zeroLine phaseSplitAge={effectiveSplitAge} />
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#6b7280" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: "#EFF6FF", border: "1px solid #93c5fd", display: "inline-block" }} />
                      Phase 1 — Active (to Age {effectiveSplitAge})
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: "#F0FDF4", border: "1px solid #86efac", display: "inline-block" }} />
                      Phase 2 — Passive (Age {effectiveSplitAge}+)
                    </span>
                  </div>
                </div>
              )}

              {/* Early retirement callout */}
              {earlyRetireAge < retirementAge && (
                <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 14, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#c2410c", marginBottom: 5 }}>⚡ Early Retirement Impact</div>
                  <div style={{ fontSize: 12, color: "#7c2d12", lineHeight: 1.7 }}>
                    Retiring at <strong>Age {earlyRetireAge}</strong> instead of <strong>Age {retirementAge}</strong> — {retirementAge - earlyRetireAge} fewer accumulation years, {retirementAge - earlyRetireAge} more depletion years. Corpus target: <strong>{fmt(results.target)}</strong>.
                  </div>
                </div>
              )}

              {/* Assumptions */}
              <div style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6", lineHeight: 1.7 }}>
                <strong>Assumptions:</strong> SIP at month-end. Inflation compounds monthly on expenses. Returns pre-tax nominal.
                Pre-ret: {pct(preReturnRate)} · Post-ret: {pct(postReturnRate)} · Inflation: {pct(inflationRate)}.
                Phase 1: {phase1Pct}% of today's expenses (Age {retAge}–{effectiveSplitAge}) · Phase 2: {phase2Pct}% (Age {effectiveSplitAge}–{lifeExpectancy}).
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
