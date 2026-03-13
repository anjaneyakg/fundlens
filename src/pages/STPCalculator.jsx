import { useState, useMemo } from "react";

// ─── Fonts ───────────────────────────────────────────────────────────────────
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
`;

// ─── Core Math ───────────────────────────────────────────────────────────────
function calcSTP({ lumpsum, stpAmount, freqPerYear, debtRate, equityRate, months }) {
  const debtMonthly = debtRate / 100 / 12;
  const eqMonthly = equityRate / 100 / 12;
  const transferPerMonth = stpAmount * (freqPerYear / 12);

  let sourceBalance = lumpsum;
  let destBalance = 0;
  const timeline = [];

  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      // Source grows then deducts transfer
      sourceBalance = sourceBalance * (1 + debtMonthly) - transferPerMonth;
      if (sourceBalance < 0) sourceBalance = 0;
      // Destination receives transfer and grows
      destBalance = destBalance * (1 + eqMonthly) + transferPerMonth;
    }
    if (m % 3 === 0 || m === months) {
      timeline.push({
        month: m,
        source: Math.max(0, sourceBalance),
        dest: destBalance,
        total: Math.max(0, sourceBalance) + destBalance,
      });
    }
  }

  // Benchmark 1: Lumpsum fully in equity from day 0
  const lsEquity = lumpsum * Math.pow(1 + eqMonthly, months);
  // Benchmark 2: Lumpsum stays in debt, never transferred
  const lsDebt = lumpsum * Math.pow(1 + debtMonthly, months);
  // Total invested via STP
  const actualMonthsRunning = Math.min(months, Math.ceil(lumpsum / transferPerMonth));
  const totalTransferred = Math.min(lumpsum, transferPerMonth * actualMonthsRunning);

  return {
    finalSource: Math.max(0, sourceBalance),
    finalDest: destBalance,
    finalTotal: Math.max(0, sourceBalance) + destBalance,
    lsEquity,
    lsDebt,
    totalTransferred,
    timeline,
    stpComplete: sourceBalance <= 0,
    actualMonthsRunning,
  };
}

function fmt(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function pct(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ─── Micro Sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 160, h = 40;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Chart ──────────────────────────────────────────────────────────────
function AreaChart({ timeline, lsEquity, lsDebt }) {
  if (!timeline || timeline.length < 2) return null;

  const totalMonths = timeline[timeline.length - 1].month;
  const maxVal = Math.max(
    ...timeline.map(t => t.total),
    lsEquity,
    lsDebt
  );
  const W = 680, H = 260, PAD = { t: 20, r: 20, b: 40, l: 70 };
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;

  const xScale = m => PAD.l + (m / totalMonths) * IW;
  const yScale = v => PAD.t + IH - (v / maxVal) * IH;

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const toArea = (pts, base) => {
    const top = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    return `${top} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`;
  };

  const sourcePts = timeline.map(t => ({ x: xScale(t.month), y: yScale(t.source) }));
  const destPts = timeline.map(t => ({ x: xScale(t.month), y: yScale(t.dest) }));
  const totalPts = timeline.map(t => ({ x: xScale(t.month), y: yScale(t.total) }));
  const base = yScale(0);

  // Y axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: maxVal * f, y: yScale(maxVal * f) }));
  // X axis labels — show every 12m or so
  const xStep = totalMonths <= 24 ? 6 : totalMonths <= 60 ? 12 : 24;
  const xTicks = [];
  for (let m = 0; m <= totalMonths; m += xStep) xTicks.push(m);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block" }}>
      <defs>
        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d7a6e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3d7a6e" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="gDest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8893f" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#c8893f" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yTicks.map(t => (
        <g key={t.v}>
          <line x1={PAD.l} y1={t.y} x2={PAD.l + IW} y2={t.y} stroke="#d6cfc4" strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fill="#8a8278" fontSize="10" fontFamily="DM Mono, monospace">
            {t.v >= 1e7 ? `${(t.v / 1e7).toFixed(1)}Cr` : t.v >= 1e5 ? `${(t.v / 1e5).toFixed(0)}L` : `${(t.v / 1e3).toFixed(0)}K`}
          </text>
        </g>
      ))}
      {xTicks.map(m => (
        <g key={m}>
          <text x={xScale(m)} y={PAD.t + IH + 16} textAnchor="middle" fill="#8a8278" fontSize="10" fontFamily="DM Mono, monospace">
            {m === 0 ? "Start" : `M${m}`}
          </text>
        </g>
      ))}

      {/* Areas */}
      <path d={toArea(totalPts, base)} fill="url(#gTotal)" />
      <path d={toArea(destPts, base)} fill="url(#gDest)" />

      {/* Lines */}
      <path d={toPath(sourcePts)} fill="none" stroke="#7b9e9a" strokeWidth="1.5" strokeDasharray="5,3" />
      <path d={toPath(destPts)} fill="none" stroke="#c8893f" strokeWidth="2" strokeLinecap="round" />
      <path d={toPath(totalPts)} fill="none" stroke="#3d7a6e" strokeWidth="2.5" strokeLinecap="round" />

      {/* Benchmarks — terminal lines */}
      <line x1={xScale(totalMonths) - 40} y1={yScale(lsEquity)} x2={xScale(totalMonths)} y2={yScale(lsEquity)}
        stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4,2" />
      <line x1={xScale(totalMonths) - 40} y1={yScale(lsDebt)} x2={xScale(totalMonths)} y2={yScale(lsDebt)}
        stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,2" />

      {/* Legend */}
      {[
        { color: "#3d7a6e", label: "STP Total Wealth", w: 18, dash: false },
        { color: "#c8893f", label: "Equity Fund (Dest)", w: 14, dash: false },
        { color: "#7b9e9a", label: "Debt Fund (Source)", w: 14, dash: true },
        { color: "#8b5cf6", label: "LS in Equity", w: 12, dash: true },
        { color: "#94a3b8", label: "LS in Debt", w: 12, dash: true },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.l + i * 132}, ${H - 8})`}>
          <line x1="0" y1="0" x2={l.w} y2="0" stroke={l.color} strokeWidth={l.w === 18 ? 2.5 : 1.5}
            strokeDasharray={l.dash ? "4,2" : "none"} />
          <text x={l.w + 4} y="4" fill="#5a5550" fontSize="9.5" fontFamily="DM Sans, sans-serif">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Year-wise Table ─────────────────────────────────────────────────────────
function YearTable({ timeline, lsEquity, lsDebt, months }) {
  const yearRows = timeline.filter(t => t.month % 12 === 0 || t.month === months);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{
        width: "100%", borderCollapse: "collapse",
        fontFamily: "DM Mono, monospace", fontSize: 12
      }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #c8c0b4" }}>
            {["Month", "Debt Source", "Equity Dest", "STP Total", "vs LS Equity", "vs LS Debt"].map(h => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: "#5a5550", fontWeight: 500, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {yearRows.map((row, i) => {
            // Interpolate benchmarks at this point
            const frac = row.month / months;
            const lsEqAt = lsEquity * (frac === 1 ? 1 : frac); // simplified linear for table display
            const lsDebtAt = lsDebt * (frac === 1 ? 1 : frac);
            const vsEq = ((row.total - (lsEquity * (row.month / months))) / (lsEquity * (row.month / months))) * 100;
            const vsDebt = ((row.total - (lsDebt * (row.month / months))) / (lsDebt * (row.month / months))) * 100;
            return (
              <tr key={row.month} style={{
                borderBottom: "0.5px solid #ddd8d0",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.4)"
              }}>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#8a8278" }}>M{row.month}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#7b9e9a" }}>{fmt(row.source)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#c8893f" }}>{fmt(row.dest)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: "#3d7a6e", fontWeight: 500 }}>{fmt(row.total)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: vsEq >= 0 ? "#2d6a4f" : "#b91c1c", fontSize: 11 }}>{pct(vsEq)}</td>
                <td style={{ padding: "7px 10px", textAlign: "right", color: vsDebt >= 0 ? "#2d6a4f" : "#b91c1c", fontSize: 11 }}>{pct(vsDebt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function STPCalculator() {
  const [inputs, setInputs] = useState({
    lumpsum: 1000000,
    stpAmount: 50000,
    freqPerYear: 12,
    debtRate: 7.0,
    equityRate: 13.0,
    months: 24,
  });
  const [tab, setTab] = useState("overview");

  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const result = useMemo(() => calcSTP(inputs), [inputs]);

  const stpVsEq = ((result.finalTotal - result.lsEquity) / result.lsEquity) * 100;
  const stpVsDebt = ((result.finalTotal - result.lsDebt) / result.lsDebt) * 100;

  const sparkData = result.timeline.map(t => t.total);

  const styles = {
    root: {
      minHeight: "100vh",
      background: "#f0ece4",
      fontFamily: "DM Sans, sans-serif",
      color: "#2a2622",
      overflowX: "hidden",
    },
    header: {
      background: "#e8e2d8",
      borderBottom: "1px solid #cec6ba",
      padding: "28px 40px 24px",
      position: "relative",
    },
    headerLabel: {
      fontFamily: "DM Mono, monospace",
      fontSize: 11,
      letterSpacing: "0.15em",
      color: "#8a8278",
      textTransform: "uppercase",
      marginBottom: 6,
    },
    headerTitle: {
      fontFamily: "Spectral, serif",
      fontSize: 32,
      fontWeight: 300,
      color: "#1e1c19",
      letterSpacing: "-0.02em",
      lineHeight: 1.15,
      margin: 0,
    },
    headerSub: {
      fontFamily: "DM Sans, sans-serif",
      fontSize: 13,
      color: "#7a7470",
      marginTop: 6,
      fontStyle: "italic",
    },
    badge: {
      display: "inline-block",
      background: "#3d7a6e",
      color: "#fff",
      fontFamily: "DM Mono, monospace",
      fontSize: 10,
      letterSpacing: "0.12em",
      padding: "3px 10px",
      borderRadius: 2,
      marginLeft: 14,
      verticalAlign: "middle",
    },
    body: {
      maxWidth: 900,
      margin: "0 auto",
      padding: "32px 24px",
    },
    card: {
      background: "#faf8f4",
      border: "1px solid #ddd8d0",
      borderRadius: 6,
      padding: "28px 28px",
      marginBottom: 20,
    },
    sectionLabel: {
      fontFamily: "DM Mono, monospace",
      fontSize: 10,
      letterSpacing: "0.18em",
      color: "#9a9490",
      textTransform: "uppercase",
      marginBottom: 16,
    },
    inputRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
      gap: "18px 24px",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    label: {
      fontFamily: "DM Mono, monospace",
      fontSize: 10,
      color: "#8a8278",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
    input: {
      fontFamily: "DM Mono, monospace",
      fontSize: 14,
      color: "#1e1c19",
      background: "#f0ece4",
      border: "1px solid #cec6ba",
      borderRadius: 4,
      padding: "9px 12px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
      transition: "border-color 0.15s",
    },
    select: {
      fontFamily: "DM Mono, monospace",
      fontSize: 13,
      color: "#1e1c19",
      background: "#f0ece4",
      border: "1px solid #cec6ba",
      borderRadius: 4,
      padding: "9px 12px",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
    },
    kpiGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
      gap: 14,
      marginBottom: 24,
    },
    kpi: (accent) => ({
      background: "#faf8f4",
      border: `1px solid ${accent}33`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 4,
      padding: "16px 18px",
    }),
    kpiLabel: {
      fontFamily: "DM Mono, monospace",
      fontSize: 9.5,
      color: "#9a9490",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      marginBottom: 8,
    },
    kpiVal: (color) => ({
      fontFamily: "Spectral, serif",
      fontSize: 24,
      fontWeight: 400,
      color: color || "#1e1c19",
      lineHeight: 1,
    }),
    kpiSub: {
      fontFamily: "DM Sans, sans-serif",
      fontSize: 11,
      color: "#9a9490",
      marginTop: 4,
    },
    tabs: {
      display: "flex",
      gap: 0,
      borderBottom: "1px solid #cec6ba",
      marginBottom: 24,
    },
    tab: (active) => ({
      fontFamily: "DM Mono, monospace",
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      padding: "10px 20px",
      border: "none",
      background: "none",
      cursor: "pointer",
      color: active ? "#3d7a6e" : "#9a9490",
      borderBottom: active ? "2px solid #3d7a6e" : "2px solid transparent",
      marginBottom: -1,
      transition: "color 0.15s",
    }),
    insightRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginTop: 18,
    },
    insight: {
      background: "#f5f1ea",
      border: "1px solid #e0d9cf",
      borderRadius: 4,
      padding: "14px 16px",
      fontFamily: "DM Sans, sans-serif",
      fontSize: 13,
      color: "#4a4642",
      lineHeight: 1.55,
    },
    verdictCard: (positive) => ({
      background: positive ? "#eef6f0" : "#fef3f0",
      border: `1px solid ${positive ? "#a3d4b0" : "#f4bfb3"}`,
      borderRadius: 6,
      padding: "20px 24px",
      marginBottom: 20,
    }),
    verdictTitle: {
      fontFamily: "Spectral, serif",
      fontSize: 18,
      fontWeight: 400,
      marginBottom: 4,
    },
    verdictSub: {
      fontFamily: "DM Sans, sans-serif",
      fontSize: 13,
      color: "#5a5550",
    },
  };

  const transferMonths = Math.min(inputs.months, Math.ceil(inputs.lumpsum / (inputs.stpAmount * inputs.freqPerYear / 12)));
  const stpCompleteMonth = inputs.lumpsum / (inputs.stpAmount * inputs.freqPerYear / 12);
  const rushIn = stpVsEq < 0;

  return (
    <>
      <style>{FONTS}</style>
      <div style={styles.root}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLabel}>A4 · MF Calculators</div>
          <h1 style={styles.headerTitle}>
            STP Performance
            <span style={styles.badge}>ADVISOR</span>
          </h1>
          <div style={styles.headerSub}>
            Systematic Transfer Plan — model your debt-to-equity glide with benchmarks
          </div>
        </div>

        <div style={styles.body}>

          {/* Inputs */}
          <div style={styles.card}>
            <div style={styles.sectionLabel}>Plan Parameters</div>
            <div style={styles.inputRow}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Lumpsum Amount (₹)</label>
                <input style={styles.input} type="number" value={inputs.lumpsum}
                  onChange={e => set("lumpsum", +e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>STP Amount (₹)</label>
                <input style={styles.input} type="number" value={inputs.stpAmount}
                  onChange={e => set("stpAmount", +e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Frequency</label>
                <select style={styles.select} value={inputs.freqPerYear}
                  onChange={e => set("freqPerYear", +e.target.value)}>
                  <option value={12}>Monthly</option>
                  <option value={4}>Quarterly</option>
                  <option value={2}>Half-yearly</option>
                  <option value={52}>Weekly</option>
                </select>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Duration (months)</label>
                <input style={styles.input} type="number" value={inputs.months}
                  onChange={e => set("months", Math.max(1, +e.target.value))} min={1} max={360} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Debt / Source Return (%)</label>
                <input style={styles.input} type="number" step="0.1" value={inputs.debtRate}
                  onChange={e => set("debtRate", +e.target.value)} />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Equity / Dest Return (%)</label>
                <input style={styles.input} type="number" step="0.1" value={inputs.equityRate}
                  onChange={e => set("equityRate", +e.target.value)} />
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpi("#3d7a6e")}>
              <div style={styles.kpiLabel}>Final STP Wealth</div>
              <div style={styles.kpiVal("#3d7a6e")}>{fmt(result.finalTotal)}</div>
              <div style={styles.kpiSub}>Source + Dest at M{inputs.months}</div>
              <div style={{ marginTop: 8 }}>
                <Sparkline data={sparkData} color="#3d7a6e" />
              </div>
            </div>
            <div style={styles.kpi("#c8893f")}>
              <div style={styles.kpiLabel}>Equity Dest Corpus</div>
              <div style={styles.kpiVal("#c8893f")}>{fmt(result.finalDest)}</div>
              <div style={styles.kpiSub}>Accumulated in equity fund</div>
            </div>
            <div style={styles.kpi("#7b9e9a")}>
              <div style={styles.kpiLabel}>Remaining in Debt</div>
              <div style={styles.kpiVal("#7b9e9a")}>{fmt(result.finalSource)}</div>
              <div style={styles.kpiSub}>{result.stpComplete ? "STP fully deployed" : "Still earning in source"}</div>
            </div>
            <div style={styles.kpi("#8b5cf6")}>
              <div style={styles.kpiLabel}>vs Lumpsum Equity</div>
              <div style={styles.kpiVal(stpVsEq >= 0 ? "#2d6a4f" : "#b91c1c")}>
                {pct(stpVsEq)}
              </div>
              <div style={styles.kpiSub}>{fmt(result.lsEquity)} if invested on day 1</div>
            </div>
            <div style={styles.kpi("#94a3b8")}>
              <div style={styles.kpiLabel}>vs Stay in Debt</div>
              <div style={styles.kpiVal(stpVsDebt >= 0 ? "#2d6a4f" : "#b91c1c")}>
                {pct(stpVsDebt)}
              </div>
              <div style={styles.kpiSub}>{fmt(result.lsDebt)} if never moved</div>
            </div>
            <div style={styles.kpi("#c8893f")}>
              <div style={styles.kpiLabel}>STP Depletion</div>
              <div style={{ fontFamily: "Spectral, serif", fontSize: 20, color: "#1e1c19" }}>
                {stpCompleteMonth <= inputs.months
                  ? `M${Math.ceil(stpCompleteMonth)}`
                  : "Partial"}
              </div>
              <div style={styles.kpiSub}>
                {stpCompleteMonth <= inputs.months
                  ? `Source depleted at month ${Math.ceil(stpCompleteMonth)}`
                  : `₹${fmt(result.finalSource)} still in source`}
              </div>
            </div>
          </div>

          {/* Verdict */}
          <div style={styles.verdictCard(!rushIn)}>
            <div style={styles.verdictTitle}>
              {rushIn
                ? "⚠️ Rush-in to equity would have done better"
                : "✅ STP outperforms a direct lumpsum equity entry"}
            </div>
            <div style={styles.verdictSub}>
              {rushIn
                ? `Lumpsum directly into equity yields ${fmt(result.lsEquity)} vs STP's ${fmt(result.finalTotal)}. STP underperforms in strong bull runs — the cost of averaging.`
                : `STP's phased deployment earns ${fmt(result.finalTotal - result.lsEquity)} more than a day-1 lumpsum. Averaging protects against sequence risk.`}
            </div>
          </div>

          {/* Tabs */}
          <div style={styles.tabs}>
            {[["overview", "Wealth Trajectory"], ["table", "Year-wise Detail"]].map(([id, label]) => (
              <button key={id} style={styles.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "overview" && (
            <div style={styles.card}>
              <div style={styles.sectionLabel}>Wealth Trajectory</div>
              <AreaChart timeline={result.timeline} lsEquity={result.lsEquity} lsDebt={result.lsDebt} />

              {/* Insights */}
              <div style={styles.insightRow}>
                <div style={styles.insight}>
                  <strong>Transfer Rate:</strong> ₹{(inputs.stpAmount * inputs.freqPerYear / 12).toLocaleString("en-IN")}/mo · Source depletes in{" "}
                  <em>{stpCompleteMonth <= inputs.months
                    ? `${Math.ceil(stpCompleteMonth)} months`
                    : `>${inputs.months} months (partial STP)`}</em>
                </div>
                <div style={styles.insight}>
                  <strong>Equity Averaging:</strong> Each transfer buys equity at different NAVs — rupee cost averaging reduces entry timing risk vs one-shot deployment.
                </div>
                <div style={styles.insight}>
                  <strong>Debt Cushion:</strong> Undeployed capital earns {inputs.debtRate}% in source while waiting, limiting opportunity cost vs idle cash.
                </div>
                <div style={styles.insight}>
                  <strong>Break-even Equity:</strong> STP matches lumpsum-equity if equity return ≥ ~{(inputs.debtRate + (inputs.equityRate - inputs.debtRate) * 0.7).toFixed(1)}% — else direct entry wins in hindsight.
                </div>
              </div>
            </div>
          )}

          {tab === "table" && (
            <div style={styles.card}>
              <div style={styles.sectionLabel}>Quarter-wise Snapshot</div>
              <YearTable timeline={result.timeline} lsEquity={result.lsEquity} lsDebt={result.lsDebt} months={inputs.months} />
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 32, fontFamily: "DM Mono, monospace", fontSize: 10, color: "#b0a89e", letterSpacing: "0.1em" }}>
            FUNDLENS · A4 STP PERFORMANCE · ADVISOR TOOL · ILLUSTRATIVE ONLY
          </div>
        </div>
      </div>
    </>
  );
}
