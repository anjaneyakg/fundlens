import { useState, useMemo, useEffect, useCallback } from "react";

const TIER = "investor";

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const pct2 = (n) => `${Number(n).toFixed(2)}%`;
const pct1 = (n) => `${Number(n).toFixed(1)}%`;

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

// ─── XIRR (Newton-Raphson) ─────────────────────────────────────────────────
// cashflows: [{amount, date}] — negative = outflow, positive = inflow
function calcXIRR(cashflows, guess = 0.1) {
  if (!cashflows || cashflows.length < 2) return null;
  const dates = cashflows.map(cf => new Date(cf.date));
  const t0 = dates[0];
  const years = dates.map(d => (d - t0) / (365.25 * 24 * 3600 * 1000));

  let rate = guess;
  for (let iter = 0; iter < 300; iter++) {
    let npv = 0, dnpv = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const t = years[i];
      const denom = Math.pow(1 + rate, t);
      npv += cashflows[i].amount / denom;
      dnpv -= t * cashflows[i].amount / (denom * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const nr = rate - npv / dnpv;
    if (Math.abs(nr - rate) < 1e-8) return nr * 100;
    rate = isFinite(nr) ? nr : guess;
  }
  return rate * 100;
}

// ─── Date helpers ──────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}
function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().split("T")[0];
}
function holdingDisplay(buyDate, valDate) {
  const d1 = new Date(buyDate), d2 = new Date(valDate);
  const months = Math.round((d2 - d1) / (30.44 * 24 * 3600 * 1000));
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m}mo`;
  if (m === 0) return `${y}yr`;
  return `${y}yr ${m}mo`;
}

// ─── ID generator ──────────────────────────────────────────────────────────
let _id = 0;
const uid = () => `id_${++_id}`;

// ─── Default data ──────────────────────────────────────────────────────────
function defaultMultiInvestments() {
  return [
    { id: uid(), name: "Mirae Large Cap", buyDate: yearsAgo(5), invested: 200000, currentValue: 340000, valueDate: today() },
    { id: uid(), name: "HDFC FD", buyDate: yearsAgo(2), invested: 500000, currentValue: 575000, valueDate: today() },
    { id: uid(), name: "Flat in Pune", buyDate: yearsAgo(7), invested: 4500000, currentValue: 7200000, valueDate: today() },
  ];
}

function defaultTranches() {
  return [
    { id: uid(), type: "investment", date: monthsAgo(36), amount: 10000 },
    { id: uid(), type: "investment", date: monthsAgo(24), amount: 10000 },
    { id: uid(), type: "investment", date: monthsAgo(12), amount: 10000 },
  ];
}

// ─── Sub-components ────────────────────────────────────────────────────────
function SectionHead({ title }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 6 }}>
      {title}
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

function DateInput({ value, onChange, style = {} }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      style={{ border: "1.5px solid #d1d5db", borderRadius: 7, padding: "5px 7px", fontSize: 11, color: "#111827", outline: "none", background: "#f9fafb", width: "100%", ...style }} />
  );
}

function AmtInput({ value, onChange, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 7, overflow: "hidden", background: "#f9fafb", ...style }}>
      <span style={{ padding: "5px 6px", background: "#f3f4f6", color: "#6b7280", fontSize: 11, borderRight: "1px solid #e5e7eb" }}>₹</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, border: "none", background: "transparent", padding: "5px 7px", fontSize: 12, color: "#111827", outline: "none", minWidth: 0 }} />
    </div>
  );
}

function DelBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 16, padding: "2px 4px", lineHeight: 1, borderRadius: 4, flexShrink: 0 }}
      onMouseEnter={e => e.target.style.color = "#ef4444"}
      onMouseLeave={e => e.target.style.color = "#d1d5db"}>✕</button>
  );
}

function AddBtn({ onClick, label, color = "#1d4ed8" }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "6px 12px", borderRadius: 7, border: `1px solid ${color}22`, color, background: `${color}11`, cursor: "pointer", fontWeight: 600 }}>
      + {label}
    </button>
  );
}

function XIRRBadge({ xirr }) {
  if (xirr == null || !isFinite(xirr)) return <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
  const color = xirr >= 12 ? "#059669" : xirr >= 8 ? "#1d4ed8" : xirr >= 4 ? "#d97706" : "#dc2626";
  return <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct2(xirr)}</span>;
}

// ─── Waterfall chart ───────────────────────────────────────────────────────
function WaterfallChart({ items, portfolioXIRR, isMobile }) {
  if (!items || items.length === 0) return null;
  const maxXIRR = Math.max(...items.map(i => i.xirr || 0), portfolioXIRR || 0, 1);

  const barColor = (xirr) =>
    xirr >= 12 ? "#059669"
    : xirr >= 8 ? "#1d4ed8"
    : xirr >= 4 ? "#d97706"
    : "#dc2626";

  return (
    <div style={{ padding: "4px 0" }}>
      {[...items].sort((a, b) => (b.xirr || 0) - (a.xirr || 0)).map((item, i) => {
        const w = Math.max(4, ((item.xirr || 0) / maxXIRR) * 100);
        const color = barColor(item.xirr || 0);
        return (
          <div key={item.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                {item.name || `Investment ${i + 1}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color, flexShrink: 0 }}>{item.xirr != null ? pct2(item.xirr) : "—"}</span>
            </div>
            <div style={{ height: 20, background: "#f3f4f6", borderRadius: 5, overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", width: `${w}%`, background: `linear-gradient(90deg, ${color}, ${color}99)`, borderRadius: 5, display: "flex", alignItems: "center", paddingLeft: 8, transition: "width 0.4s" }}>
                {w > 20 && <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{fmt(item.gain >= 0 ? item.gain : 0)}</span>}
              </div>
            </div>
          </div>
        );
      })}

      {/* Portfolio blended line */}
      {portfolioXIRR != null && isFinite(portfolioXIRR) && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 2, background: "#7c3aed", borderRadius: 1 }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", flexShrink: 0 }}>
              Portfolio blended XIRR: {pct2(portfolioXIRR)}
            </span>
            <div style={{ flex: 1, height: 2, background: "#7c3aed", borderRadius: 1 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function PortfolioXIRR() {
  const winWidth = useWindowWidth();
  const isMobile = winWidth <= 768;

  const [mode, setMode] = useState("multi"); // "multi" | "tranche"

  // Mode A — multi-investment
  const [investments, setInvestments] = useState(defaultMultiInvestments);

  // Mode B — multi-tranche
  const [trancheName, setTrancheName] = useState("Axis Bluechip Fund SIP");
  const [tranches, setTranches] = useState(defaultTranches);
  const [maturityValue, setMaturityValue] = useState(485000);
  const [maturityDate, setMaturityDate] = useState(today());

  // ── Mode A helpers ──────────────────────────────────────────────────────
  const addInvestment = () => {
    setInvestments(prev => [...prev, {
      id: uid(), name: "", buyDate: yearsAgo(1), invested: 100000, currentValue: 120000, valueDate: today(),
    }]);
  };
  const updateInvestment = (id, patch) => setInvestments(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  const removeInvestment = (id) => setInvestments(prev => prev.filter(i => i.id !== id));

  // ── Mode B helpers ──────────────────────────────────────────────────────
  const addTranche = () => {
    setTranches(prev => [...prev, { id: uid(), type: "investment", date: today(), amount: 10000 }]);
  };
  const updateTranche = (id, patch) => setTranches(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const removeTranche = (id) => setTranches(prev => prev.filter(t => t.id !== id));

  // ── Calculations ────────────────────────────────────────────────────────
  const multiResults = useMemo(() => {
    const items = investments.map(inv => {
      const cfs = [
        { amount: -inv.invested, date: inv.buyDate },
        { amount: inv.currentValue, date: inv.valueDate },
      ];
      const xirr = (inv.invested > 0 && inv.currentValue > 0 && inv.buyDate && inv.valueDate)
        ? calcXIRR(cfs) : null;
      const gain = inv.currentValue - inv.invested;
      return { ...inv, xirr, gain, cfs };
    });

    // Portfolio blended XIRR — all cashflows combined
    const allCFs = items.flatMap(i => i.cfs);
    const portfolioXIRR = allCFs.length >= 2 ? calcXIRR(allCFs) : null;
    const totalInvested = items.reduce((s, i) => s + i.invested, 0);
    const totalValue = items.reduce((s, i) => s + i.currentValue, 0);
    const totalGain = totalValue - totalInvested;
    const simpleReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    return { items, portfolioXIRR, totalInvested, totalValue, totalGain, simpleReturn };
  }, [investments]);

  const trancheResults = useMemo(() => {
    if (tranches.length === 0) return null;
    const totalInvested = tranches.reduce((s, t) => s + t.amount, 0);
    const gain = maturityValue - totalInvested;
    const simpleReturn = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    const cfs = [
      ...tranches.map(t => ({ amount: -t.amount, date: t.date })),
      { amount: maturityValue, date: maturityDate },
    ];
    const xirr = calcXIRR(cfs);

    return { totalInvested, currentValue: maturityValue, gain, simpleReturn, xirr };
  }, [tranches, maturityValue, maturityDate]);

  const results = mode === "multi" ? multiResults : trancheResults;

  // ── Tab style ────────────────────────────────────────────────────────────
  const tabStyle = (active) => ({
    flex: 1, padding: "10px 8px", fontSize: 11, fontWeight: active ? 700 : 500,
    border: "none", borderRadius: 8, cursor: "pointer",
    background: active ? "#1d4ed8" : "transparent",
    color: active ? "#fff" : "#6b7280", transition: "all 0.2s", textAlign: "center", lineHeight: 1.4,
  });

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "linear-gradient(135deg,#f0f7ff 0%,#fafafa 60%,#f5f3ff 100%)", minHeight: "100vh", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>E4 · Portfolio XIRR</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>Portfolio XIRR Calculator</h1>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, marginBottom: 0 }}>True annualised return · Per-investment XIRR · Blended portfolio XIRR</p>
          </div>
          <div style={{ background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7", color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 18 }}>
          <button style={tabStyle(mode === "multi")} onClick={() => setMode("multi")}>
            Multi-investment portfolio
            <div style={{ fontSize: 9, opacity: 0.75, marginTop: 2 }}>Each investment independent</div>
          </button>
          <button style={tabStyle(mode === "tranche")} onClick={() => setMode("tranche")}>
            Single investment — multi-tranche
            <div style={{ fontSize: 9, opacity: 0.75, marginTop: 2 }}>SIP-style, one final value</div>
          </button>
        </div>

        {/* ── Mode A: Multi-investment ── */}
        {mode === "multi" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", marginBottom: 18, overflowX: "auto" }}>
            <SectionHead title="Investments" />

            {isMobile ? (
              // Mobile: card per investment
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {investments.map((inv, idx) => {
                  const res = multiResults.items.find(i => i.id === inv.id);
                  return (
                    <div key={inv.id} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <input value={inv.name} onChange={e => updateInvestment(inv.id, { name: e.target.value })}
                          placeholder={`Investment ${idx + 1}`}
                          style={{ flex: 1, border: "1.5px solid #d1d5db", borderRadius: 7, padding: "5px 8px", fontSize: 13, color: "#111827", outline: "none", background: "#fff", marginRight: 8 }} />
                        <DelBtn onClick={() => removeInvestment(inv.id)} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Buy date</div><DateInput value={inv.buyDate} onChange={v => updateInvestment(inv.id, { buyDate: v })} /></div>
                        <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Invested</div><AmtInput value={inv.invested} onChange={v => updateInvestment(inv.id, { invested: v })} /></div>
                        <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Value date</div><DateInput value={inv.valueDate} onChange={v => updateInvestment(inv.id, { valueDate: v })} /></div>
                        <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Current value</div><AmtInput value={inv.currentValue} onChange={v => updateInvestment(inv.id, { currentValue: v })} /></div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "6px 8px", background: "#fff", borderRadius: 7, border: "1px solid #e5e7eb" }}>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>XIRR</span>
                        <XIRRBadge xirr={res?.xirr} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Desktop: table
              <div style={{ minWidth: 680 }}>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 130px 110px 80px 28px", gap: 8, padding: "7px 8px", background: "#f9fafb", borderRadius: "8px 8px 0 0", border: "1px solid #e5e7eb", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>
                  <span>Name</span><span>Buy date</span><span>Invested</span><span>Current / maturity value</span><span>Value date</span><span>XIRR</span><span></span>
                </div>
                {investments.map((inv, idx) => {
                  const res = multiResults.items.find(i => i.id === inv.id);
                  return (
                    <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 130px 110px 80px 28px", gap: 8, padding: "8px", border: "1px solid #f3f4f6", borderTop: "none", alignItems: "center", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <input value={inv.name} onChange={e => updateInvestment(inv.id, { name: e.target.value })}
                        placeholder={`Investment ${idx + 1}`}
                        style={{ border: "1.5px solid #d1d5db", borderRadius: 7, padding: "5px 8px", fontSize: 12, color: "#111827", outline: "none", background: "#f9fafb", width: "100%" }} />
                      <DateInput value={inv.buyDate} onChange={v => updateInvestment(inv.id, { buyDate: v })} />
                      <AmtInput value={inv.invested} onChange={v => updateInvestment(inv.id, { invested: v })} />
                      <AmtInput value={inv.currentValue} onChange={v => updateInvestment(inv.id, { currentValue: v })}
                        style={{ border: "1.5px solid #bbf7d0", background: "#f0fdf4" }} />
                      <DateInput value={inv.valueDate} onChange={v => updateInvestment(inv.id, { valueDate: v })} />
                      <XIRRBadge xirr={res?.xirr} />
                      <DelBtn onClick={() => removeInvestment(inv.id)} />
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <AddBtn onClick={addInvestment} label="Add investment" />
            </div>
          </div>
        )}

        {/* ── Mode B: Multi-tranche ── */}
        {mode === "tranche" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", marginBottom: 18 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Investment name</label>
              <input value={trancheName} onChange={e => setTrancheName(e.target.value)}
                placeholder="e.g. Axis Bluechip Fund SIP"
                style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#111827", outline: "none", background: "#f9fafb", boxSizing: "border-box" }} />
            </div>

            <SectionHead title="Investment tranches" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {tranches.map((t, idx) => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 28px" : "120px 1fr 28px", gap: 8, alignItems: "center", padding: "8px 10px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: 8 }}>Investment</span>
                    {!isMobile && <span style={{ fontSize: 10, color: "#9ca3af" }}>#{idx + 1}</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <DateInput value={t.date} onChange={v => updateTranche(t.id, { date: v })} />
                    <AmtInput value={t.amount} onChange={v => updateTranche(t.id, { amount: v })} />
                  </div>
                  <DelBtn onClick={() => removeTranche(t.id)} />
                </div>
              ))}

              {/* Maturity row */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 28px" : "120px 1fr 28px", gap: 8, alignItems: "center", padding: "8px 10px", background: "#f0fdf4", borderRadius: 8, border: "1.5px solid #bbf7d0" }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#059669", padding: "2px 8px", borderRadius: 8, display: "inline-block" }}>Maturity / Current</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <DateInput value={maturityDate} onChange={setMaturityDate} style={{ border: "1.5px solid #bbf7d0" }} />
                  <AmtInput value={maturityValue} onChange={setMaturityValue} style={{ border: "1.5px solid #bbf7d0", background: "#f0fdf4" }} />
                </div>
                <div style={{ width: 28 }} />
              </div>
            </div>

            <AddBtn onClick={addTranche} label="Add tranche" />
          </div>
        )}

        {/* ── Results ── */}
        {results && (
          <>
            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
              <StatCard label="Total invested" value={fmt(results.totalInvested)}
                sub={mode === "multi" ? `${investments.length} investment${investments.length !== 1 ? "s" : ""}` : `${tranches.length} tranche${tranches.length !== 1 ? "s" : ""}`}
                color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" />
              <StatCard label="Current / maturity value" value={fmt(results.currentValue ?? results.totalValue)}
                sub="Total across portfolio"
                color="#059669" bg="#f0fdf4" border="#bbf7d0" />
              <StatCard
                label="Portfolio XIRR"
                value={mode === "multi"
                  ? (multiResults.portfolioXIRR != null && isFinite(multiResults.portfolioXIRR) ? pct2(multiResults.portfolioXIRR) : "—")
                  : (trancheResults?.xirr != null && isFinite(trancheResults.xirr) ? pct2(trancheResults.xirr) : "—")}
                sub="Blended · all cashflows combined"
                color="#7c3aed" bg="#f5f3ff" border="#ddd6fe" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <StatCard
                label="Absolute gain / loss"
                value={`${(results.totalGain ?? results.gain) >= 0 ? "+" : "−"}${fmt(Math.abs(results.totalGain ?? results.gain))}`}
                sub={`${((results.totalGain ?? results.gain) / results.totalInvested * 100).toFixed(1)}% on ${fmt(results.totalInvested)} invested`}
                color={(results.totalGain ?? results.gain) >= 0 ? "#d97706" : "#dc2626"}
                bg={(results.totalGain ?? results.gain) >= 0 ? "#fffbeb" : "#fef2f2"}
                border={(results.totalGain ?? results.gain) >= 0 ? "#fde68a" : "#fca5a5"} />
              <StatCard
                label="Simple return vs XIRR"
                value={`${pct1(results.simpleReturn)} absolute`}
                sub={`vs ${mode === "multi"
                  ? (multiResults.portfolioXIRR != null ? pct2(multiResults.portfolioXIRR) : "—")
                  : (trancheResults?.xirr != null ? pct2(trancheResults.xirr) : "—")} XIRR — XIRR accounts for timing of each cashflow`}
                color="#374151" bg="#f9fafb" border="#e5e7eb" />
            </div>

            {/* Waterfall chart — mode A only */}
            {mode === "multi" && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid #e5e7eb", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Per-investment XIRR — ranked</div>
                <WaterfallChart
                  items={multiResults.items.map(i => ({ ...i, gain: i.gain }))}
                  portfolioXIRR={multiResults.portfolioXIRR}
                  isMobile={isMobile}
                />
              </div>
            )}

            {/* Mode B — tranche summary */}
            {mode === "tranche" && trancheResults && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid #e5e7eb", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                  {trancheName || "Investment"} — XIRR Summary
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tranches.map((t, i) => (
                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#f9fafb", borderRadius: 7, border: "1px solid #e5e7eb", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Tranche #{i + 1} · {t.date}</span>
                      <span style={{ color: "#374151", fontWeight: 600 }}>{fmt(t.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#f0fdf4", borderRadius: 7, border: "1.5px solid #bbf7d0", fontSize: 12 }}>
                    <span style={{ color: "#059669", fontWeight: 600 }}>Maturity · {maturityDate}</span>
                    <span style={{ color: "#059669", fontWeight: 800 }}>{fmt(maturityValue)}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>XIRR</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>
                        {trancheResults.xirr != null && isFinite(trancheResults.xirr) ? pct2(trancheResults.xirr) : "—"}
                      </span>
                    </div>
                    <div style={{ height: 20, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.max(4, (trancheResults.xirr || 0) / 25 * 100))}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)", borderRadius: 5 }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assumptions */}
            <div style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6", lineHeight: 1.8 }}>
              <strong>How XIRR works:</strong> XIRR (Extended Internal Rate of Return) calculates the annualised return accounting for the exact timing of each cashflow.
              Unlike simple CAGR, XIRR is accurate for irregular investments and withdrawals.
              Portfolio blended XIRR combines all cashflows across investments into a single calculation — not a weighted average of individual XIRRs.
              Negative amounts = outflows (investments). Positive amounts = inflows (maturity/current value).
              Results are pre-tax. For post-tax analysis, use E1 or E2.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
