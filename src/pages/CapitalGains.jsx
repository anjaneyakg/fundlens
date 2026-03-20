import { useState, useMemo, useEffect } from "react";

const TIER = "investor";

// ─── Responsive hook ───────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 900);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const fmtSigned = (n) => (n < 0 ? `−${fmt(n)}` : fmt(n));
const pct = (n) => `${Number(n).toFixed(2)}%`;
const pct1 = (n) => `${Number(n).toFixed(1)}%`;

// ─── Asset rules ───────────────────────────────────────────────────────────
const ASSETS = [
  {
    key: "equity_mf",
    label: "Equity MF",
    sub: "/ Stocks",
    stMonths: 12,
    stRate: 20,
    ltRate: 12.5,
    indexation: false,
    hasExemption: true,
    slabForST: false,
    slabForLT: false,
    note: "Post-Jul 2024 budget rates",
  },
  {
    key: "debt_mf",
    label: "Debt MF",
    sub: null,
    stMonths: 24,
    stRate: null, // slab
    ltRate: 12.5,
    indexation: false,
    hasExemption: false,
    slabForST: true,
    slabForLT: false,
    note: "Post-Apr 2023 rules — no indexation",
  },
  {
    key: "fd",
    label: "FD",
    sub: "Fixed Deposit",
    stMonths: null, // always slab
    stRate: null,
    ltRate: null,
    indexation: false,
    hasExemption: false,
    slabForST: true,
    slabForLT: true,
    alwaysSlab: true,
    note: "Interest income — always taxed at slab rate",
  },
  {
    key: "real_estate",
    label: "Real Estate",
    sub: null,
    stMonths: 24,
    stRate: null,
    ltRate: 12.5,
    indexation: false,
    hasExemption: false,
    slabForST: true,
    slabForLT: false,
    has54EC: true,
    note: "Post-Jul 2024 budget — indexation removed",
  },
  {
    key: "gold_physical",
    label: "Gold",
    sub: "Physical",
    stMonths: 24,
    stRate: null,
    ltRate: 12.5,
    indexation: false,
    hasExemption: false,
    slabForST: true,
    slabForLT: false,
    note: "Post-Jul 2024 budget rates",
  },
  {
    key: "gold_etf",
    label: "Gold ETF",
    sub: "/ SGB",
    stMonths: 12,
    stRate: 20,
    ltRate: 12.5,
    indexation: false,
    hasExemption: true,
    slabForST: false,
    slabForLT: false,
    note: "Treated as equity for tax purposes",
  },
];

// ─── XIRR (Newton-Raphson) ─────────────────────────────────────────────────
function calcXIRR(buyAmt, sellAmt, years) {
  if (years <= 0) return 0;
  // Single buy, single sell
  const flows = [
    { amount: -buyAmt, t: 0 },
    { amount: sellAmt, t: years },
  ];
  let rate = 0.1;
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0;
    for (const f of flows) {
      const d = Math.pow(1 + rate, f.t);
      npv += f.amount / d;
      dnpv -= f.t * f.amount / (d * (1 + rate));
    }
    const nr = rate - npv / dnpv;
    if (Math.abs(nr - rate) < 1e-8) return nr * 100;
    rate = nr;
  }
  return rate * 100;
}

// ─── Date helpers ──────────────────────────────────────────────────────────
function monthsBetween(d1, d2) {
  const from = new Date(d1), to = new Date(d2);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}
function formatHolding(months) {
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr${y > 1 ? "s" : ""}`;
  return `${y} yr${y > 1 ? "s" : ""} ${m} mo`;
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function dateMinusYears(yrs) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yrs);
  return d.toISOString().split("T")[0];
}

// ─── Sub-components ────────────────────────────────────────────────────────
function SectionHead({ title }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 4 }}>
      {title}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function AmtInput({ label, value, onChange, prefix = "₹", hint }) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
        <span style={{ padding: "7px 10px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>{prefix}</span>
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, border: "none", background: "transparent", padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none" }} />
      </div>
    </Field>
  );
}

function Slider({ label, value, min, max, step, onChange, display, accentColor = "#1d4ed8", hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>{display ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
        <span>{min}%</span>
        {hint && <span style={{ color: "#d97706" }}>{hint}</span>}
        <span>{max}%</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = "#1d4ed8", bg = "#f0f7ff", border = "#bfdbfe" }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function WorkingRow({ label, value, color, bold, topBorder }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderTop: topBorder ? "1px solid #e5e7eb" : "none",
      borderBottom: "1px solid #f3f4f6",
    }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: color || "#374151" }}>{value}</span>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function CapitalGains() {
  // Identity
  const [investName, setInvestName] = useState("");

  // Asset
  const [assetKey, setAssetKey] = useState("equity_mf");

  // Transaction
  const [buyPrice, setBuyPrice] = useState(500000);
  const [sellPrice, setSellPrice] = useState(900000);

  // Holding period — date or manual
  const [holdingMode, setHoldingMode] = useState("date"); // "date" | "manual"
  const [buyDate, setBuyDate] = useState(dateMinusYears(4));
  const [sellDate, setSellDate] = useState(today());
  const [manualYears, setManualYears] = useState(4);
  const [manualMonths, setManualMonths] = useState(0);

  // Tax params
  const [ltcgExemption, setLtcgExemption] = useState(125000);
  const [slabRate, setSlabRate] = useState(30);

  const asset = ASSETS.find(a => a.key === assetKey);

  // Holding months
  const holdingMonths = useMemo(() => {
    if (holdingMode === "date") {
      const m = monthsBetween(buyDate, sellDate);
      return Math.max(0, m);
    }
    return manualYears * 12 + manualMonths;
  }, [holdingMode, buyDate, sellDate, manualYears, manualMonths]);

  const holdingYears = holdingMonths / 12;

  const results = useMemo(() => {
    if (buyPrice <= 0 || sellPrice <= 0) return null;

    const gain = sellPrice - buyPrice;
    const isLT = asset.alwaysSlab ? false
      : asset.stMonths ? holdingMonths >= asset.stMonths
      : true;

    // Determine tax rate
    let taxRate, taxType;
    if (asset.alwaysSlab) {
      taxRate = slabRate;
      taxType = "slab";
    } else if (isLT) {
      taxRate = asset.slabForLT ? slabRate : asset.ltRate;
      taxType = "ltcg";
    } else {
      taxRate = asset.slabForST ? slabRate : asset.stRate;
      taxType = "stcg";
    }

    // Exemption — only for LT equity/gold ETF
    const exemption = (isLT && asset.hasExemption) ? Math.min(ltcgExemption, Math.max(0, gain)) : 0;
    const taxableGain = Math.max(0, gain - exemption);
    const tax = taxableGain * (taxRate / 100);
    const postTaxGain = gain - tax;
    const postTaxValue = sellPrice - tax;

    // XIRR
    const preXIRR = holdingYears > 0 ? calcXIRR(buyPrice, sellPrice, holdingYears) : 0;
    const postXIRR = holdingYears > 0 ? calcXIRR(buyPrice, postTaxValue, holdingYears) : 0;

    // "Hold more months" nudge — only for ST near threshold
    let holdNudge = null;
    if (!isLT && !asset.alwaysSlab && asset.stMonths) {
      const monthsToLT = asset.stMonths - holdingMonths;
      if (monthsToLT > 0 && monthsToLT <= 6) {
        // Tax if sold today vs if sold after threshold
        const ltExemption = asset.hasExemption ? Math.min(ltcgExemption, Math.max(0, gain)) : 0;
        const ltTaxableGain = Math.max(0, gain - ltExemption);
        const ltTaxRate = asset.slabForLT ? slabRate : asset.ltRate;
        const ltTax = ltTaxableGain * (ltTaxRate / 100);
        const taxSaved = tax - ltTax;
        holdNudge = { monthsToLT, taxSaved, ltTax };
      }
    }

    // 54EC — only real estate LTCG
    let ec54 = null;
    if (asset.has54EC && isLT && gain > 0) {
      const maxBond = Math.min(taxableGain, 5000000); // max 50L
      const taxSavedByBond = maxBond * (taxRate / 100);
      ec54 = { maxBond, taxSavedByBond };
    }

    return {
      gain, isLT, taxType, taxRate, exemption, taxableGain,
      tax, postTaxGain, postTaxValue, preXIRR, postXIRR,
      holdNudge, ec54,
    };
  }, [asset, buyPrice, sellPrice, holdingMonths, holdingYears, ltcgExemption, slabRate]);

  // ── Responsive ──────────────────────────────────────────────────────────
  const winWidth = useWindowWidth();
  const isMobile = winWidth <= 768;
  const isSmall = winWidth <= 480;

  // ── Styles ──────────────────────────────────────────────────────────────
  const isLT = results?.isLT;
  const classColor = results
    ? (results.gain < 0 ? "#dc2626"
      : isLT ? "#059669" : "#d97706")
    : "#6b7280";
  const classBg = results
    ? (results.gain < 0 ? "#fef2f2"
      : isLT ? "#f0fdf4" : "#fffbeb")
    : "#f9fafb";
  const classBorder = results
    ? (results.gain < 0 ? "#fca5a5"
      : isLT ? "#bbf7d0" : "#fde68a")
    : "#e5e7eb";

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "linear-gradient(135deg, #f0fdf4 0%, #fafafa 60%, #f0f7ff 100%)", minHeight: "100vh", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>E1 · Capital Gains</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>Capital Gains Calculator</h1>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, marginBottom: 0 }}>Tax liability · Post-tax gain · XIRR · 54EC advisory</p>
          </div>
          <div style={{ background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7", color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ── Input card ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", marginBottom: 18 }}>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 4 }}>Name this investment</label>
            <input
              type="text"
              value={investName}
              onChange={e => setInvestName(e.target.value)}
              placeholder="e.g. Mirae Asset Large Cap, HDFC FD, Flat in Pune..."
              style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#111827", outline: "none", background: "#f9fafb", boxSizing: "border-box" }}
            />
          </div>

          {/* Asset selector */}
          <SectionHead title="Asset Type" />
          <div style={{ display: "grid", gridTemplateColumns: isSmall ? "repeat(2, 1fr)" : isMobile ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: 8, marginBottom: 18 }}>
            {ASSETS.map(a => (
              <button key={a.key} onClick={() => setAssetKey(a.key)}
                style={{
                  padding: "9px 4px", borderRadius: 10, border: `1.5px solid ${assetKey === a.key ? "#1d4ed8" : "#e5e7eb"}`,
                  background: assetKey === a.key ? "#eff6ff" : "#f9fafb",
                  color: assetKey === a.key ? "#1d4ed8" : "#6b7280",
                  fontSize: 11, fontWeight: assetKey === a.key ? 700 : 500,
                  cursor: "pointer", textAlign: "center", lineHeight: 1.4,
                  transition: "all 0.15s",
                }}>
                {a.label}
                {a.sub && <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{a.sub}</div>}
              </button>
            ))}
          </div>

          {/* Asset rule badge */}
          <div style={{ background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 8, padding: "8px 14px", marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Rules applied:</span>
            {asset.alwaysSlab ? (
              <span style={{ fontSize: 11, background: "#fef9ec", color: "#92400e", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>Always slab rate</span>
            ) : (
              <>
                <span style={{ fontSize: 11, background: "#fef2f2", color: "#b91c1c", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>
                  ST &lt; {asset.stMonths}mo → {asset.slabForST ? "slab" : `${asset.stRate}%`}
                </span>
                <span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>
                  LT ≥ {asset.stMonths}mo → {asset.slabForLT ? "slab" : `${asset.ltRate}%`}
                </span>
                {asset.hasExemption && (
                  <span style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>LTCG exemption applies</span>
                )}
              </>
            )}
            <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: "auto" }}>{asset.note}</span>
          </div>

          {/* Two col inputs */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>

            {/* Left: Transaction + Holding */}
            <div>
              <SectionHead title="Transaction" />
              <AmtInput label="Buy price / cost" value={buyPrice} onChange={setBuyPrice} />
              <AmtInput label="Sell price / value" value={sellPrice} onChange={setSellPrice} />

              {results && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: results.gain >= 0 ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${results.gain >= 0 ? "#bbf7d0" : "#fca5a5"}`,
                  borderRadius: 8, padding: "7px 12px", marginBottom: 12,
                }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Total gain / loss</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: results.gain >= 0 ? "#059669" : "#dc2626" }}>
                    {results.gain >= 0 ? "+" : "−"}{fmt(results.gain)}
                  </span>
                </div>
              )}

              <SectionHead title="Holding Period" />
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {["date", "manual"].map(m => (
                  <button key={m} onClick={() => setHoldingMode(m)} style={{
                    flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: holdingMode === m ? 700 : 500,
                    border: `1px solid ${holdingMode === m ? "#1d4ed8" : "#e5e7eb"}`,
                    borderRadius: 7, cursor: "pointer",
                    background: holdingMode === m ? "#eff6ff" : "#fff",
                    color: holdingMode === m ? "#1d4ed8" : "#9ca3af",
                  }}>
                    {m === "date" ? "Date picker" : "Manual entry"}
                  </button>
                ))}
              </div>

              {holdingMode === "date" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <Field label="Buy date">
                    <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#111827", outline: "none", background: "#f9fafb" }} />
                  </Field>
                  <Field label="Sell date">
                    <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "7px 10px", fontSize: 12, color: "#111827", outline: "none", background: "#f9fafb" }} />
                  </Field>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <Field label="Years">
                    <input type="number" value={manualYears} onChange={e => setManualYears(Math.max(0, Number(e.target.value)))} min={0}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none", background: "#f9fafb" }} />
                  </Field>
                  <Field label="Months">
                    <input type="number" value={manualMonths} onChange={e => setManualMonths(Math.min(11, Math.max(0, Number(e.target.value))))} min={0} max={11}
                      style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none", background: "#f9fafb" }} />
                  </Field>
                </div>
              )}

              {/* Holding summary pill */}
              <div style={{ background: classBg, border: `1.5px solid ${classBorder}`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Holding period</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: classColor }}>
                  {formatHolding(holdingMonths)} → {results ? (results.isLT ? "Long Term" : (asset.alwaysSlab ? "Income" : "Short Term")) : "—"}
                </span>
              </div>
            </div>

            {/* Right: Tax params */}
            <div>
              <SectionHead title="Tax Parameters" />

              <Slider label="Your income slab rate" value={slabRate} min={0} max={35} step={2.5}
                onChange={setSlabRate} display={pct1(slabRate)} accentColor="#d97706"
                hint="Suggested: 30%" />

              {asset.hasExemption && (
                <AmtInput
                  label="LTCG annual exemption"
                  value={ltcgExemption}
                  onChange={setLtcgExemption}
                  hint="Default ₹1.25L · equity MF, stocks, Gold ETF/SGB"
                />
              )}

              {/* Tax rule summary for this asset + holding */}
              {results && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Applied tax rule</div>
                  <WorkingRow label="Gain type" value={
                    asset.alwaysSlab ? "Income (slab)"
                    : results.isLT ? `LTCG` : `STCG`
                  } color={classColor} />
                  <WorkingRow label="Tax rate" value={pct1(results.taxRate)} color={classColor} />
                  {results.exemption > 0 && (
                    <WorkingRow label="Exemption applied" value={`−${fmt(results.exemption)}`} color="#059669" />
                  )}
                  <WorkingRow label="Taxable gain" value={fmt(results.taxableGain)} />
                  <WorkingRow label="Tax payable" value={fmt(results.tax)} color="#dc2626" bold />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Results ── */}
        {results && (
          <>
            {/* Classification banner */}
            <div style={{
              background: classBg, border: `1.5px solid ${classBorder}`,
              borderRadius: 14, padding: "14px 20px", marginBottom: 14,
              display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            }}>
              <span style={{
                fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
                background: classColor, color: "#fff", letterSpacing: 0.5,
              }}>
                {asset.alwaysSlab ? "INCOME" : results.isLT ? "LONG TERM" : "SHORT TERM"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: classColor }}>
                {investName ? `"${investName}" · ` : ""}{asset.label} · {formatHolding(holdingMonths)} ·{" "}
                {asset.alwaysSlab ? `Slab @ ${pct1(slabRate)}`
                  : results.isLT ? `LTCG @ ${pct1(results.taxRate)}${results.exemption > 0 ? ` · ₹${fmt(results.exemption)} exempt` : ""}`
                  : `STCG @ ${pct1(results.taxRate)}`}
              </span>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: isSmall ? "1fr" : isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              <StatCard label="Total gain" value={`${results.gain >= 0 ? "+" : "−"}${fmt(results.gain)}`}
                color={results.gain >= 0 ? "#059669" : "#dc2626"}
                bg={results.gain >= 0 ? "#f0fdf4" : "#fef2f2"}
                border={results.gain >= 0 ? "#bbf7d0" : "#fca5a5"}
                sub={`Buy ${fmt(buyPrice)} → Sell ${fmt(sellPrice)}`} />
              <StatCard label="Tax liability" value={`−${fmt(results.tax)}`}
                color="#dc2626" bg="#fef2f2" border="#fca5a5"
                sub={`${pct1(results.taxRate)} on ${fmt(results.taxableGain)} taxable`} />
              <StatCard label="Post-tax value in hand" value={fmt(results.postTaxValue)}
                color="#1d4ed8" bg="#eff6ff" border="#bfdbfe"
                sub={`Gain after tax: +${fmt(results.postTaxGain)}`} />
              <StatCard label="Pre-tax XIRR" value={holdingYears > 0 ? pct(results.preXIRR) : "—"}
                color="#374151" bg="#f9fafb" border="#e5e7eb"
                sub={`${formatHolding(holdingMonths)} holding`} />
              <StatCard label="Post-tax XIRR" value={holdingYears > 0 ? pct(results.postXIRR) : "—"}
                color="#1d4ed8" bg="#eff6ff" border="#bfdbfe"
                sub={`Tax drag: ${holdingYears > 0 ? pct1(results.preXIRR - results.postXIRR) : "—"} pts`} />
              <StatCard label="Effective tax rate on gain" value={results.gain > 0 ? pct1(results.tax / results.gain * 100) : "—"}
                color="#d97706" bg="#fffbeb" border="#fde68a"
                sub="Tax as % of total gain" />
            </div>

            {/* Tax workings */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", border: "1px solid #e5e7eb", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Tax Workings</div>
              <WorkingRow label="Sale consideration" value={fmt(sellPrice)} />
              <WorkingRow label="Cost of acquisition" value={`−${fmt(buyPrice)}`} color="#dc2626" />
              <WorkingRow label="Total gain" value={fmt(results.gain)} color={results.gain >= 0 ? "#059669" : "#dc2626"} bold topBorder />
              {results.exemption > 0 && (
                <WorkingRow label={`LTCG exemption (₹${fmt(ltcgExemption)} limit)`} value={`−${fmt(results.exemption)}`} color="#059669" />
              )}
              <WorkingRow label="Taxable gain" value={fmt(results.taxableGain)} bold topBorder />
              <WorkingRow label={`Tax @ ${pct1(results.taxRate)} (${asset.alwaysSlab ? "slab" : results.isLT ? "LTCG" : "STCG"})`}
                value={`−${fmt(results.tax)}`} color="#dc2626" />
              <WorkingRow label="Net in hand (post-tax)" value={fmt(results.postTaxValue)} color="#1d4ed8" bold topBorder />
            </div>

            {/* Hold-more nudge */}
            {results.holdNudge && (
              <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                  ⏳ Wait {results.holdNudge.monthsToLT} more month{results.holdNudge.monthsToLT > 1 ? "s" : ""} — save {fmt(results.holdNudge.taxSaved)} in tax
                </div>
                <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.7 }}>
                  Selling now = <strong>STCG @ {pct1(results.taxRate)}</strong> → Tax: <strong>{fmt(results.tax)}</strong><br />
                  Wait {results.holdNudge.monthsToLT} mo → qualifies as <strong>LTCG @ {pct1(asset.ltRate)}%</strong>
                  {asset.hasExemption ? ` with ₹${fmt(ltcgExemption)} exemption` : ""} → Tax: <strong>{fmt(results.holdNudge.ltTax)}</strong>
                </div>
              </div>
            )}

            {/* 54EC advisory — real estate LTCG only */}
            {results.ec54 && (
              <div style={{ border: "1.5px dashed #f59e0b", background: "#fffbeb", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  🏛 54EC Bonds — Save up to {fmt(results.ec54.taxSavedByBond)} in tax
                  <span style={{ fontSize: 10, background: "#fde68a", color: "#78350f", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>Advisory only</span>
                </div>
                <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.8 }}>
                  Invest your LTCG in <strong>NHAI / REC 54EC bonds</strong> within <strong>6 months of sale</strong> to claim full exemption.<br />
                  Max investment: <strong>₹50L</strong> · Lock-in: <strong>5 years</strong> · Yield: ~5.25% p.a. (taxable)<br />
                  If you invest <strong>{fmt(Math.min(results.taxableGain, 5000000))}</strong> → Tax saved: <strong>{fmt(results.ec54.taxSavedByBond)}</strong>
                </div>
              </div>
            )}

            {/* Assumptions */}
            <div style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6", lineHeight: 1.8 }}>
              <strong>Assumptions & Disclaimer:</strong> Tax rates as per post-Jul 2024 Union Budget.
              Debt MF: post-Apr 2023 rules (no indexation, LTCG at 12.5% if &gt;24 months).
              Real estate & gold physical: indexation benefit removed post-Jul 2024.
              LTCG exemption of ₹{fmt(ltcgExemption)} applicable only for equity MF, stocks, Gold ETF/SGB.
              Surcharge and cess not included. Consult a tax advisor for filing.
              This tool is for indicative purposes only — not tax advice.
            </div>
          </>
        )}
      </div>

    </div>
  );
}
