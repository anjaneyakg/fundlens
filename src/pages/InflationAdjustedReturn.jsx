import { useState, useMemo, useEffect } from "react";

const TIER = "investor";

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const pct1 = (n) => `${Number(n).toFixed(1)}%`;
const pct2 = (n) => `${Number(n).toFixed(2)}%`;

// ─── Responsive hook ───────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(() => typeof window !== "undefined" ? window.innerWidth : 900);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ─── Math ──────────────────────────────────────────────────────────────────
// Fisher equation: real return = ((1 + nominal) / (1 + inflation)) - 1
function realReturn(nominal, inflation) {
  return ((1 + nominal / 100) / (1 + inflation / 100) - 1) * 100;
}

// Break-even inflation = nominal rate (real return = 0 when inflation = nominal)
function breakEvenInflation(nominal) {
  return nominal; // simplified: at inflation = nominal, real ≈ 0
}

// Nominal maturity series — yearly
function nominalSeries(principal, nominalRate, years) {
  const r = nominalRate / 100;
  return Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    value: principal * Math.pow(1 + r, y),
  }));
}

// Real maturity series — in today's purchasing power
function realSeries(principal, nominalRate, inflationRate, years) {
  const n = nominalRate / 100, i = inflationRate / 100;
  return Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    value: principal * Math.pow((1 + n) / (1 + i), y),
  }));
}

// Purchasing power of ₹1 over time
function ppSeries(inflationRate, years) {
  const i = inflationRate / 100;
  return Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    value: Math.pow(1 / (1 + i), y),
  }));
}

// Real return at each inflation point for break-even chart
function breakEvenSeries(nominal, steps = 20) {
  return Array.from({ length: steps + 1 }, (_, k) => {
    const inf = k * (nominal * 1.5) / steps;
    return { inf, real: realReturn(nominal, inf) };
  });
}

// ─── SVG Line Chart ────────────────────────────────────────────────────────
// Fully contained, no overflow. Width always 100% via viewBox.
function LineChart({ seriesList, xKey = "year", yKey = "value", xLabel = "Yr", breakEvenX, zeroLine }) {
  if (!seriesList || seriesList.length === 0) return null;

  const W = 500, H = 180, PL = 64, PR = 12, PT = 20, PB = 30;
  const iW = W - PL - PR, iH = H - PT - PB;

  const allX = seriesList[0].data.map(d => d[xKey]);
  const allY = seriesList.flatMap(s => s.data.map(d => d[yKey]));
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY, 0), maxY = Math.max(...allY, 1);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

  const xp = (x) => PL + ((x - minX) / rangeX) * iW;
  const yp = (y) => PT + iH - ((y - minY) / rangeY) * iH;

  // Y-axis ticks — 4 ticks
  const yTicks = [0, 0.33, 0.67, 1].map(t => ({ val: minY + t * rangeY, y: PT + iH - t * iH }));

  // X-axis labels — max 6, always include first and last
  const xVals = allX;
  const step = Math.max(1, Math.ceil(xVals.length / 6));
  const xLabels = xVals.filter((_, i) => i % step === 0 || i === xVals.length - 1);

  // Zero line
  const zeroY = zeroLine ? yp(0) : null;

  // Break-even vertical line
  const beX = breakEvenX != null ? xp(breakEvenX) : null;

  const gradIds = ["gL0", "gL1", "gL2"];
  const fills = ["#bfdbfe", "#bbf7d0", "#e9d5ff"];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", overflow: "hidden" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {seriesList.map((_, i) => (
          <linearGradient key={i} id={gradIds[i]} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fills[i]} />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        ))}
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />

      {/* Grid + Y labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth={1} />
          <text x={PL - 4} y={t.y + 4} textAnchor="end" fontSize={8} fill="#9ca3af">
            {t.val >= 1e7 ? `${(t.val / 1e7).toFixed(1)}Cr`
              : t.val >= 1e5 ? `${(t.val / 1e5).toFixed(1)}L`
              : t.val >= 1e3 ? `${(t.val / 1000).toFixed(0)}K`
              : t.val.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Zero line */}
      {zeroY != null && zeroY >= PT && zeroY <= PT + iH && (
        <line x1={PL} x2={W - PR} y1={zeroY} y2={zeroY} stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="4,2" />
      )}

      {/* Break-even vertical */}
      {beX != null && (
        <>
          <line x1={beX} x2={beX} y1={PT} y2={PT + iH} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4,2" />
          <text x={beX + 3} y={PT + 10} fontSize={8} fill="#dc2626" fontWeight="600">Break-even</text>
        </>
      )}

      {/* Area + line per series */}
      {seriesList.map((s, si) => {
        const pts = s.data.map(d => ({ x: xp(d[xKey]), y: yp(d[yKey]) }));
        const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const areaPath = `M${pts[0].x.toFixed(1)},${(PT + iH).toFixed(1)} ` +
          pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
          ` L${pts[pts.length - 1].x.toFixed(1)},${(PT + iH).toFixed(1)} Z`;
        return (
          <g key={si}>
            <path d={areaPath} fill={`url(#${gradIds[si]})`} opacity="0.5" />
            <path d={linePath} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      })}

      {/* X labels */}
      {xLabels.map((v, i) => (
        <text key={i} x={xp(v).toFixed(1)} y={H - 5} textAnchor="middle" fontSize={8} fill="#9ca3af">
          {xLabel}{v % 1 === 0 ? v : v.toFixed(1)}
        </text>
      ))}

      {/* Legend */}
      {seriesList.map((s, i) => (
        <g key={i}>
          <rect x={PL + i * 110} y={PT - 12} width={7} height={7} rx={2} fill={s.color} />
          <text x={PL + i * 110 + 10} y={PT - 5} fontSize={8} fill={s.color} fontWeight="600">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function SectionHead({ title }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 6 }}>
      {title}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, display, accentColor = "#1d4ed8", hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
        <span>{min}%</span>
        {hint && <span style={{ color: accentColor, fontWeight: 500 }}>{hint}</span>}
        <span>{max}%</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, bg, border }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", overflow: "hidden" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>{title}</div>
      <div style={{ width: "100%", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function InflationAdjustedReturn() {
  const winWidth = useWindowWidth();
  const isMobile = winWidth <= 768;

  const [investName, setInvestName] = useState("");
  const [principal, setPrincipal] = useState(500000);
  const [nominalRate, setNominalRate] = useState(12);
  const [inflationRate, setInflationRate] = useState(6);
  const [tenure, setTenure] = useState(10);
  const [monthlyExpenses, setMonthlyExpenses] = useState(60000);

  const years = tenure;
  const tenureDisplay = `${years} yr${years !== 1 ? "s" : ""}`;

  const results = useMemo(() => {
    const rr = realReturn(nominalRate, inflationRate);
    const nomMaturity = principal * Math.pow(1 + nominalRate / 100, years);
    const realMaturity = principal * Math.pow(1 + rr / 100, years);
    const ppLost = nomMaturity - realMaturity;
    const ppPct = nomMaturity > 0 ? (ppLost / nomMaturity) * 100 : 0;
    const beInflation = breakEvenInflation(nominalRate);

    // Today's equivalent of nominal maturity
    const todayEquiv = nomMaturity / Math.pow(1 + inflationRate / 100, years);

    // Expenses at maturity (inflation-adjusted)
    const expAtMaturity = monthlyExpenses * Math.pow(1 + inflationRate / 100, years);
    const coverageYears = expAtMaturity > 0 ? realMaturity / (expAtMaturity * 12) : 0;

    // Series for charts
    const nomSeries = nominalSeries(principal, nominalRate, years);
    const realSer = realSeries(principal, nominalRate, inflationRate, years);
    const ppSer = ppSeries(inflationRate, years);
    const beSeries = breakEvenSeries(nominalRate, 40);

    return {
      rr, nomMaturity, realMaturity, ppLost, ppPct,
      beInflation, todayEquiv, coverageYears, expAtMaturity,
      nomSeries, realSer, ppSer, beSeries,
    };
  }, [principal, nominalRate, inflationRate, years, monthlyExpenses]);

  const isPositiveReal = results.rr > 0;

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "linear-gradient(135deg,#f0fdf4 0%,#fafafa 60%,#f0f7ff 100%)", minHeight: "100vh", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 860, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>E3 · Inflation-Adjusted Return</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>What's Your Real Return?</h1>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, marginBottom: 0 }}>Nominal → real · Purchasing power · Break-even inflation · Coverage</p>
          </div>
          <div style={{ background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7", color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* ── Input card ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", marginBottom: 18 }}>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Name this investment <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
            <input type="text" value={investName} onChange={e => setInvestName(e.target.value)}
              placeholder="e.g. Mirae Large Cap, PPF, FD at SBI..."
              style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#111827", outline: "none", background: "#f9fafb", boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>

            {/* Left */}
            <div>
              <SectionHead title="Investment" />
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>Principal / invested amount</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
                  <span style={{ padding: "7px 10px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>₹</span>
                  <input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))}
                    style={{ flex: 1, border: "none", background: "transparent", padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none" }} />
                </div>
              </div>
              <SliderRow label="Nominal return (pre-inflation)" value={nominalRate}
                min={1} max={25} step={0.5} onChange={setNominalRate}
                display={pct1(nominalRate)} accentColor="#1d4ed8" />
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Tenure</span>
                  <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{tenureDisplay}</span>
                </div>
                <input type="range" min={1} max={40} step={1} value={tenure}
                  onChange={e => setTenure(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#1d4ed8", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                  <span>1 yr</span><span>40 yrs</span>
                </div>
              </div>
            </div>

            {/* Right */}
            <div>
              <SectionHead title="Inflation" />
              <SliderRow label="Inflation rate" value={inflationRate}
                min={2} max={12} step={0.25} onChange={setInflationRate}
                display={pct1(inflationRate)} accentColor="#d97706" hint="Suggested: 6%" />

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>
                  Monthly expenses today <span style={{ color: "#9ca3af", fontWeight: 400 }}>(for coverage calc)</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
                  <span style={{ padding: "7px 10px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>₹</span>
                  <input type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(Number(e.target.value))}
                    style={{ flex: 1, border: "none", background: "transparent", padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none" }} />
                  <span style={{ padding: "7px 10px", color: "#6b7280", fontSize: 12, borderLeft: "1px solid #e5e7eb" }}>/mo</span>
                </div>
              </div>

              {/* Formula reference */}
              <div style={{ background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 9, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Fisher equation</div>
                <div style={{ fontSize: 12, color: "#374151", fontFamily: "monospace" }}>
                  Real = ((1 + nominal) / (1 + inflation)) − 1
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                  = ((1 + {pct1(nominalRate)}) / (1 + {pct1(inflationRate)})) − 1
                  = <strong style={{ color: results.rr > 0 ? "#059669" : "#dc2626" }}>{pct2(results.rr)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
          <StatCard label="Nominal maturity" value={fmt(results.nomMaturity)}
            sub={`${pct1(nominalRate)} for ${tenureDisplay}`}
            color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
          <StatCard label="Real maturity value" value={fmt(results.realMaturity)}
            sub="In today's purchasing power"
            color="#059669" bg="#f0fdf4" border="#bbf7d0" />
          <StatCard label="Purchasing power lost" value={fmt(results.ppLost)}
            sub={`${pct1(results.ppPct)} eroded by inflation`}
            color="#d97706" bg="#fffbeb" border="#fde68a" />
          <StatCard label="Real XIRR" value={pct2(results.rr)}
            sub={`vs ${pct1(nominalRate)} nominal`}
            color={isPositiveReal ? "#7c3aed" : "#dc2626"}
            bg={isPositiveReal ? "#f5f3ff" : "#fef2f2"}
            border={isPositiveReal ? "#ddd6fe" : "#fca5a5"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <StatCard label="Today's equivalent value"
            value={fmt(results.todayEquiv)}
            sub={`${fmt(results.nomMaturity)} in ${tenureDisplay} = ${fmt(results.todayEquiv)} in today's money at ${pct1(inflationRate)} inflation`}
            color="#059669" bg="#f0fdf4" border="#bbf7d0" />
          <StatCard label="Expenses coverage (real terms)"
            value={`${results.coverageYears.toFixed(1)} yrs`}
            sub={`Real corpus covers ${results.coverageYears.toFixed(1)} yrs of ₹${monthlyExpenses.toLocaleString("en-IN")}/mo (inflated to ${fmt(results.expAtMaturity)}/mo at maturity)`}
            color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
        </div>

        {/* ── Break-even callout ── */}
        <div style={{
          border: `1.5px solid ${isPositiveReal ? "#fca5a5" : "#fca5a5"}`,
          background: "#fef2f2", borderRadius: 14, padding: "14px 18px", marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 4 }}>
            Break-even inflation rate
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#dc2626" }}>{pct1(results.beInflation)}</div>
            <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.7 }}>
              At <strong>{pct1(results.beInflation)}</strong> inflation, real return = 0% — corpus merely preserves purchasing power.<br />
              {isPositiveReal
                ? <>Current inflation ({pct1(inflationRate)}) is <strong style={{ color: "#059669" }}>{pct1(results.beInflation - inflationRate)} pts below break-even</strong> — you have a healthy real return of <strong>{pct2(results.rr)}</strong>.</>
                : <>⚠ Current inflation ({pct1(inflationRate)}) <strong style={{ color: "#dc2626" }}>exceeds break-even</strong> — you are losing real value at {pct2(Math.abs(results.rr))} p.a.</>
              }
            </div>
          </div>
        </div>

        {/* ── Charts ── */}
        {/* Chart 1: Nominal vs Real */}
        <ChartCard title={`Nominal vs real value over time${investName ? ` — ${investName}` : ""}`}>
          <LineChart
            seriesList={[
              { label: "Nominal value", color: "#1d4ed8", data: results.nomSeries },
              { label: "Real value (today's ₹)", color: "#059669", data: results.realSer },
            ]}
            xKey="year" yKey="value" xLabel="Yr"
          />
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
            Gap between lines = purchasing power eroded by {pct1(inflationRate)} inflation over {tenureDisplay}
          </div>
        </ChartCard>

        {/* Chart 2: Purchasing power erosion */}
        <div style={{ marginTop: 12 }}>
          <ChartCard title={`Purchasing power of ₹1 at ${pct1(inflationRate)} inflation`}>
            <LineChart
              seriesList={[
                { label: "₹1 purchasing power", color: "#d97706", data: results.ppSer },
              ]}
              xKey="year" yKey="value" xLabel="Yr"
            />
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
              ₹1 today = {results.ppSer[Math.min(years, results.ppSer.length - 1)]?.value.toFixed(2)} in real value after {tenureDisplay} at {pct1(inflationRate)} inflation
            </div>
          </ChartCard>
        </div>

        {/* Chart 3: Real return vs inflation scenarios */}
        <div style={{ marginTop: 12 }}>
          <ChartCard title={`Real return at different inflation rates (nominal = ${pct1(nominalRate)})`}>
            <LineChart
              seriesList={[
                { label: "Real return", color: "#374151", data: results.beSeries.map(d => ({ inf: d.inf, real: d.real })) },
              ]}
              xKey="inf" yKey="real" xLabel=""
              breakEvenX={results.beInflation}
              zeroLine
            />
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: "#9ca3af", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#dcfce7", border: "1px solid #86efac", display: "inline-block" }} />
                Left of dashed = positive real return
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#fef2f2", border: "1px solid #fca5a5", display: "inline-block" }} />
                Right of dashed = negative real return
              </span>
            </div>
          </ChartCard>
        </div>

        {/* Assumptions */}
        <div style={{ marginTop: 14, fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6", lineHeight: 1.8 }}>
          <strong>Assumptions:</strong> Real return calculated using Fisher equation: ((1 + nominal) / (1 + inflation)) − 1.
          Nominal maturity: annual compounding on principal.
          Real maturity: today's purchasing power equivalent of nominal maturity.
          Purchasing power erosion: compound effect of inflation over tenure.
          Break-even inflation = nominal return rate (real return = 0).
          Expenses coverage: real corpus ÷ (monthly expenses inflated to maturity × 12).
          Pre-tax returns — tax not modelled here (see E1 / E2 for post-tax analysis).
        </div>
      </div>
    </div>
  );
}
