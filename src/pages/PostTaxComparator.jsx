import { useState, useMemo, useEffect } from "react";

const TIER = "investor";

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(n).toLocaleString("en-IN")}`;
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
// Lumpsum FV with annual compounding
function lumpFV(principal, annualRate, years) {
  return principal * Math.pow(1 + annualRate / 100, years);
}

// Post-tax value for lumpsum
function postTaxValue(principal, maturity, taxType, slabRate, customRate, ltcgExemption) {
  const gain = maturity - principal;
  if (gain <= 0) return maturity;
  if (taxType === "eee") return maturity;
  let rate;
  if (taxType === "slab") rate = slabRate;
  else if (taxType === "ltcg") rate = 12.5;
  else if (taxType === "stcg") rate = 20;
  else rate = customRate; // custom
  const exemption = (taxType === "ltcg") ? Math.min(ltcgExemption, gain) : 0;
  const taxable = Math.max(0, gain - exemption);
  const tax = taxable * (rate / 100);
  return maturity - tax;
}

// XIRR for lumpsum (simple CAGR — single cashflow)
function xirrLump(principal, value, years) {
  if (years <= 0 || principal <= 0) return 0;
  return (Math.pow(value / principal, 1 / years) - 1) * 100;
}

// Tax drag in percentage points
function taxDrag(preXIRR, postXIRR) {
  return preXIRR - postXIRR;
}

// ─── Default instruments ───────────────────────────────────────────────────
const DEFAULT_INSTRUMENTS = [
  { key: "equity_mf", name: "Equity MF", rate: 12.0, taxType: "ltcg", lockIn: "None", enabled: true, editable: false },
  { key: "debt_mf",   name: "Debt MF",   rate: 7.5,  taxType: "ltcg", lockIn: "None", enabled: true, editable: false },
  { key: "fd",        name: "FD",        rate: 7.0,  taxType: "slab", lockIn: "None", enabled: true, editable: false },
  { key: "rd",        name: "RD",        rate: 7.0,  taxType: "slab", lockIn: "None", enabled: true, editable: false },
  { key: "ppf",       name: "PPF",       rate: 7.1,  taxType: "eee",  lockIn: "15 yrs", enabled: true, editable: false },
  { key: "real_estate", name: "Real Estate", rate: 10.0, taxType: "ltcg", lockIn: "None", enabled: true, editable: false },
  { key: "gold",      name: "Gold",      rate: 8.0,  taxType: "ltcg", lockIn: "None", enabled: true, editable: false },
];

const TAX_TYPE_OPTIONS = [
  { value: "ltcg",   label: "LTCG 12.5%",     color: "#1d4ed8", bg: "#eff6ff" },
  { value: "stcg",   label: "STCG 20%",        color: "#d97706", bg: "#fffbeb" },
  { value: "slab",   label: "Slab rate",        color: "#92400e", bg: "#fef9ec" },
  { value: "eee",    label: "EEE (exempt)",     color: "#059669", bg: "#f0fdf4" },
  { value: "custom", label: "Custom rate",      color: "#7c3aed", bg: "#f5f3ff" },
];

function taxTag(taxType, slabRate, customRate) {
  const opt = TAX_TYPE_OPTIONS.find(o => o.value === taxType);
  if (!opt) return null;
  const label = taxType === "slab" ? `Slab ${pct1(slabRate)}`
    : taxType === "custom" ? `Custom ${pct1(customRate)}`
    : opt.label;
  return { label, color: opt.color, bg: opt.bg };
}

// ─── Sub-components ────────────────────────────────────────────────────────
function SectionHead({ title }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 6 }}>
      {title}
    </div>
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

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 36, height: 20, borderRadius: 10, cursor: "pointer",
      background: value ? "#1d4ed8" : "#d1d5db", position: "relative",
      transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 8, background: "#fff",
        position: "absolute", top: 2, left: value ? 18 : 2,
        transition: "left 0.2s",
      }} />
    </div>
  );
}

// ─── Instrument row in input table ─────────────────────────────────────────
function InstRow({ inst, slabRate, onUpdate, isMobile }) {
  const tag = taxTag(inst.taxType, slabRate, inst.customRate ?? 15);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "160px 100px 1fr 80px 40px",
      gap: isMobile ? 6 : 10,
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #f3f4f6",
      opacity: inst.enabled ? 1 : 0.4,
    }}>
      {/* Name */}
      <div>
        {inst.key === "custom" ? (
          <input value={inst.name} onChange={e => onUpdate({ name: e.target.value })}
            placeholder="Name this instrument"
            style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 7, padding: "5px 8px", fontSize: 12, color: "#111827", outline: "none", background: "#f9fafb" }} />
        ) : (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{inst.name}</div>
            {inst.lockIn !== "None" && (
              <div style={{ fontSize: 10, color: "#d97706", marginTop: 1 }}>⏳ {inst.lockIn} lock-in</div>
            )}
          </div>
        )}
      </div>

      {/* Rate */}
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 7, overflow: "hidden", background: "#f9fafb" }}>
        <input type="number" value={inst.rate} step={0.1}
          onChange={e => onUpdate({ rate: Number(e.target.value) })}
          style={{ flex: 1, border: "none", background: "transparent", padding: "5px 8px", fontSize: 13, color: "#111827", outline: "none", width: 0 }} />
        <span style={{ padding: "5px 7px", color: "#6b7280", fontSize: 11, borderLeft: "1px solid #e5e7eb" }}>%</span>
      </div>

      {/* Tax type */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {inst.key === "custom" ? (
          <>
            <select value={inst.taxType} onChange={e => onUpdate({ taxType: e.target.value })}
              style={{ border: "1.5px solid #d1d5db", borderRadius: 7, padding: "5px 8px", fontSize: 12, color: "#374151", outline: "none", background: "#f9fafb", cursor: "pointer" }}>
              {TAX_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {inst.taxType === "custom" && (
              <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #ddd6fe", borderRadius: 7, overflow: "hidden", background: "#f5f3ff", width: 80 }}>
                <input type="number" value={inst.customRate ?? 15} step={0.5}
                  onChange={e => onUpdate({ customRate: Number(e.target.value) })}
                  style={{ flex: 1, border: "none", background: "transparent", padding: "5px 6px", fontSize: 12, color: "#7c3aed", outline: "none", width: 0 }} />
                <span style={{ padding: "5px 6px", color: "#7c3aed", fontSize: 11 }}>%</span>
              </div>
            )}
          </>
        ) : (
          tag && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 8, background: tag.bg, color: tag.color }}>
              {tag.label}
            </span>
          )
        )}
        {/* Custom lock-in */}
        {inst.key === "custom" && (
          <input value={inst.lockIn} onChange={e => onUpdate({ lockIn: e.target.value })}
            placeholder="Lock-in (e.g. 3 yrs)"
            style={{ border: "1.5px solid #d1d5db", borderRadius: 7, padding: "5px 8px", fontSize: 11, color: "#374151", outline: "none", background: "#f9fafb", width: 110 }} />
        )}
      </div>

      {/* Lock-in (non-custom) */}
      {inst.key !== "custom" && (
        <div style={{ fontSize: 11, color: inst.lockIn !== "None" ? "#d97706" : "#9ca3af" }}>
          {inst.lockIn}
        </div>
      )}

      {/* Toggle */}
      <Toggle value={inst.enabled} onChange={v => onUpdate({ enabled: v })} />
    </div>
  );
}

// ─── Rank row in results table ─────────────────────────────────────────────
function RankRow({ rank, inst, preXIRR, postXIRR, maturity, postTax, drag, maxPostTax, isBest, isMobile }) {
  const tag = taxTag(inst.taxType, 0, inst.customRate ?? 15);
  const barWidth = maxPostTax > 0 ? (postTax / maxPostTax) * 100 : 0;
  const rankColors = ["#d97706", "#6b7280", "#92400e"];
  const rankColor = rankColors[rank - 1] ?? "#9ca3af";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "28px 1fr 80px" : "28px 180px 90px 90px 80px 1fr",
      gap: isMobile ? 8 : 10,
      alignItems: "center",
      padding: "10px 14px",
      borderBottom: "1px solid #f3f4f6",
      background: isBest ? "#f0fdf4" : rank % 2 === 0 ? "#fafafa" : "#fff",
    }}>
      {/* Rank */}
      <div style={{ fontSize: 14, fontWeight: 800, color: rankColor }}>{rank}</div>

      {/* Name */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{inst.name}</span>
          {isBest && <span style={{ fontSize: 10, background: "#059669", color: "#fff", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>★ Best</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, flexWrap: "wrap" }}>
          {tag && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6, background: tag.bg, color: tag.color }}>{tag.label}</span>}
          {inst.lockIn !== "None" && <span style={{ fontSize: 10, color: "#d97706" }}>⏳ {inst.lockIn}</span>}
        </div>
      </div>

      {/* Pre-tax XIRR */}
      {!isMobile && <div style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", textAlign: "right" }}>{pct2(preXIRR)}</div>}

      {/* Post-tax XIRR */}
      <div style={{ fontSize: 13, fontWeight: 800, color: isBest ? "#059669" : "#374151", textAlign: "right" }}>{pct2(postXIRR)}</div>

      {/* Tax drag */}
      {!isMobile && (
        <div style={{ fontSize: 11, fontWeight: 600, color: drag === 0 ? "#059669" : "#dc2626", textAlign: "right" }}>
          {drag === 0 ? "0 drag" : `−${pct1(drag)} pts`}
        </div>
      )}

      {/* Post-tax value + bar */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: isBest ? "#059669" : "#374151", marginBottom: 4 }}>{fmt(postTax)}</div>
        <div style={{ height: 5, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barWidth}%`, background: isBest ? "#059669" : "#93c5fd", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function PostTaxComparator() {
  const winWidth = useWindowWidth();
  const isMobile = winWidth <= 768;

  // Inputs
  const [principal, setPrincipal] = useState(500000);
  const [tenure, setTenure] = useState(10);
  const [slabRate, setSlabRate] = useState(30);
  const [ltcgExemption, setLtcgExemption] = useState(125000);
  const [sortBy, setSortBy] = useState("post"); // "pre" | "post"

  // Instruments
  const [instruments, setInstruments] = useState([
    ...DEFAULT_INSTRUMENTS,
    {
      key: "custom", name: "", rate: 9.0, taxType: "ltcg",
      lockIn: "None", enabled: true, editable: true, customRate: 15,
    },
  ]);

  const updateInst = (key, patch) => {
    setInstruments(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i));
  };

  const results = useMemo(() => {
    return instruments
      .filter(i => i.enabled && (i.key !== "custom" || i.name.trim() !== ""))
      .map(inst => {
        // PPF ineligible if tenure < 15
        if (inst.key === "ppf" && tenure < 15) {
          return { inst, ineligible: true, preXIRR: 0, postXIRR: 0, maturity: 0, postTax: 0, drag: 0 };
        }
        const maturity = lumpFV(principal, inst.rate, tenure);
        const ptv = postTaxValue(principal, maturity, inst.taxType, slabRate, inst.customRate ?? 15, ltcgExemption);
        const preXIRR = xirrLump(principal, maturity, tenure);
        const postXIRR = xirrLump(principal, ptv, tenure);
        const drag = taxDrag(preXIRR, postXIRR);
        return { inst, ineligible: false, preXIRR, postXIRR, maturity, postTax: ptv, drag };
      })
      .filter(r => !r.ineligible);
  }, [instruments, principal, tenure, slabRate, ltcgExemption]);

  const sorted = useMemo(() => {
    return [...results].sort((a, b) =>
      sortBy === "post" ? b.postTax - a.postTax : b.maturity - a.maturity
    );
  }, [results, sortBy]);

  const maxPostTax = Math.max(...sorted.map(r => r.postTax), 1);

  // Best and worst
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const mostDrag = [...results].sort((a, b) => b.drag - a.drag)[0];

  const years = tenure;
  const tenureDisplay = `${years} yr${years !== 1 ? "s" : ""}`;

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "linear-gradient(135deg,#f0fdf4 0%,#fafafa 60%,#f0f7ff 100%)", minHeight: "100vh", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>E2 · Post-Tax Comparator</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>Which Investment Wins After Tax?</h1>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, marginBottom: 0 }}>Pre-tax vs post-tax ranking · XIRR · Tax drag · All instruments</p>
          </div>
          <div style={{ background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7", color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ── Input card ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", marginBottom: 18 }}>

          {/* Top inputs */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div>
              <SectionHead title="Investment" />
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>Lumpsum amount</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
                  <span style={{ padding: "7px 10px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>₹</span>
                  <input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))}
                    style={{ flex: 1, border: "none", background: "transparent", padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none" }} />
                </div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Tenure</span>
                  <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>{tenureDisplay}</span>
                </div>
                <input type="range" min={1} max={30} step={1} value={tenure}
                  onChange={e => setTenure(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#1d4ed8", cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                  <span>1 yr</span><span>30 yrs</span>
                </div>
              </div>
            </div>

            <div>
              <SectionHead title="Tax Parameters" />
              <Slider label="Your income slab rate" value={slabRate} min={0} max={35} step={2.5}
                onChange={setSlabRate} display={pct1(slabRate)} accentColor="#d97706" hint="Suggested: 30%" />
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>LTCG exemption (equity instruments)</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
                  <span style={{ padding: "7px 10px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>₹</span>
                  <input type="number" value={ltcgExemption} onChange={e => setLtcgExemption(Number(e.target.value))}
                    style={{ flex: 1, border: "none", background: "transparent", padding: "7px 10px", fontSize: 13, color: "#111827", outline: "none" }} />
                </div>
                <div style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>Default ₹1.25L — applies to Equity MF, Debt MF, Gold, custom LTCG</div>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "7px 10px", lineHeight: 1.6 }}>
                CG rates auto-applied per instrument (post Jul-2024 budget). Toggle instruments on/off using the switches.
              </div>
            </div>
          </div>

          {/* Instrument table */}
          <SectionHead title="Expected Pre-Tax Returns — edit any rate" />
          <div style={{ background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 12px" }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "160px 100px 1fr 80px 40px",
              gap: 10, padding: "8px 0",
              borderBottom: "1px solid #e5e7eb",
              fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8,
            }}>
              {!isMobile && <><span>Instrument</span><span>Return</span><span>Tax type · Lock-in</span><span>Lock-in</span><span>On</span></>}
            </div>

            {instruments.map(inst => (
              <InstRow key={inst.key} inst={inst} slabRate={slabRate}
                onUpdate={patch => updateInst(inst.key, patch)} isMobile={isMobile} />
            ))}
          </div>

          {/* PPF warning */}
          {tenure < 15 && instruments.find(i => i.key === "ppf")?.enabled && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#92400e", background: "#fef9ec", border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px" }}>
              ⏳ PPF requires minimum 15-year tenure. Currently excluded from ranking (tenure = {tenureDisplay}).
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {sorted.length > 0 && (
          <>
            {/* Sort toggle + summary */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                Ranking — {fmt(principal)} · {tenureDisplay}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["post", "Post-tax"], ["pre", "Pre-tax"]].map(([v, l]) => (
                  <button key={v} onClick={() => setSortBy(v)} style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: sortBy === v ? 700 : 500,
                    border: `1px solid ${sortBy === v ? "#1d4ed8" : "#e5e7eb"}`,
                    borderRadius: 7, cursor: "pointer",
                    background: sortBy === v ? "#eff6ff" : "#fff",
                    color: sortBy === v ? "#1d4ed8" : "#9ca3af",
                  }}>{l} sort</button>
                ))}
              </div>
            </div>

            {/* Rank table */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 14 }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "28px 1fr 80px" : "28px 180px 90px 90px 80px 1fr",
                gap: isMobile ? 8 : 10,
                padding: "9px 14px",
                background: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7,
              }}>
                <span>#</span>
                <span>Instrument</span>
                {!isMobile && <span style={{ textAlign: "right" }}>Pre-tax XIRR</span>}
                <span style={{ textAlign: "right" }}>Post-tax XIRR</span>
                {!isMobile && <span style={{ textAlign: "right" }}>Tax drag</span>}
                <span>Post-tax value</span>
              </div>

              {sorted.map((r, i) => (
                <RankRow key={r.inst.key} rank={i + 1} inst={r.inst}
                  preXIRR={r.preXIRR} postXIRR={r.postXIRR}
                  maturity={r.maturity} postTax={r.postTax} drag={r.drag}
                  maxPostTax={maxPostTax} isBest={i === 0} isMobile={isMobile} />
              ))}
            </div>

            {/* Insight callout */}
            {best && worst && (
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "16px 20px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Tax Impact Analysis</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 4 }}>★ Post-tax winner</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{best.inst.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {fmt(best.postTax)} in hand · {pct2(best.postXIRR)} XIRR
                    </div>
                  </div>
                  <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginBottom: 4 }}>Highest tax drag</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{mostDrag.inst.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      −{pct1(mostDrag.drag)} pts · Pre {pct1(mostDrag.preXIRR)} → Post {pct1(mostDrag.postXIRR)}
                    </div>
                  </div>
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 4 }}>Best vs worst gap</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{fmt(best.postTax - worst.postTax)}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      {best.inst.name} vs {worst.inst.name} over {tenureDisplay}
                    </div>
                  </div>
                </div>

                {/* Pre vs post ranking shift narrative */}
                <div style={{ marginTop: 12, fontSize: 12, color: "#4b5563", background: "#f9fafb", borderRadius: 8, padding: "10px 14px", lineHeight: 1.8, border: "1px solid #f3f4f6" }}>
                  <strong>Pre-tax ranking:</strong>{" "}
                  {[...results].sort((a, b) => b.preXIRR - a.preXIRR).map(r => r.inst.name).join(" → ")}
                  <br />
                  <strong>Post-tax ranking:</strong>{" "}
                  {sorted.map(r => r.inst.name).join(" → ")}
                  {sorted[0].inst.name !== [...results].sort((a, b) => b.preXIRR - a.preXIRR)[0].inst.name && (
                    <span style={{ color: "#d97706", fontWeight: 600 }}> — ranking shifts after tax!</span>
                  )}
                </div>
              </div>
            )}

            {/* Assumptions */}
            <div style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6", lineHeight: 1.8 }}>
              <strong>Assumptions:</strong> All instruments: lumpsum invested on day 1, annual compounding.
              LTCG 12.5% for Equity MF, Debt MF (≥24mo), Real Estate, Gold (post Jul-2024 budget).
              FD/RD interest taxed at slab rate on maturity.
              PPF: EEE — no tax, min 15-yr tenure required.
              LTCG exemption of ₹{fmt(ltcgExemption)} applied to eligible instruments.
              Surcharge, cess, TDS not modelled. Pre-tax returns are user assumptions — not guaranteed.
              This tool is for indicative purposes only — not investment or tax advice.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
