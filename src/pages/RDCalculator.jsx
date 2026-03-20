import { useState, useMemo } from "react";

const TIER = "investor"; // "advisor" | "alpha" | "investor"

// ─── Formatters ────────────────────────────────────────────────────────────
const fmt = (n) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr`
  : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L`
  : `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n) => `${Number(n).toFixed(2)}%`;
const pct1 = (n) => `${Number(n).toFixed(1)}%`;

// ─── XIRR (Newton-Raphson) ─────────────────────────────────────────────────
// cashflows: [{amount, monthIndex}] — negative = outflow, positive = inflow
// monthIndex 0 = today
function xirr(cashflows, guess = 0.1) {
  const DAYS_PER_YEAR = 365;
  // convert month index to fractional years
  const flows = cashflows.map(cf => ({
    amount: cf.amount,
    t: cf.monthIndex / 12,
  }));

  let rate = guess;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0, dnpv = 0;
    for (const f of flows) {
      const denom = Math.pow(1 + rate, f.t);
      npv += f.amount / denom;
      dnpv -= f.t * f.amount / (denom * (1 + rate));
    }
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-7) return newRate * 100;
    rate = newRate;
  }
  return rate * 100;
}

function rdXIRR(monthly, months, maturity) {
  const cfs = [];
  for (let m = 1; m <= months; m++) cfs.push({ amount: -monthly, monthIndex: m - 1 });
  cfs.push({ amount: maturity, monthIndex: months });
  return xirr(cfs);
}

function sipXIRR(monthly, months, maturity) {
  const cfs = [];
  for (let m = 1; m <= months; m++) cfs.push({ amount: -monthly, monthIndex: m - 1 });
  cfs.push({ amount: maturity, monthIndex: months });
  return xirr(cfs);
}

function fdXIRR(principal, months, maturity) {
  return xirr([
    { amount: -principal, monthIndex: 0 },
    { amount: maturity, monthIndex: months },
  ]);
}

// ─── RD Maturity — quarterly compounding (Indian bank standard) ────────────
function rdMaturity(monthly, annualRate, months) {
  const qr = annualRate / 100 / 4;
  let total = 0;
  const series = [];
  for (let m = 1; m <= months; m++) {
    const remainingMonths = months - m + 1;
    const quarters = remainingMonths / 3;
    total += monthly * Math.pow(1 + qr, quarters);
    series.push({ month: m, balance: total });
  }
  return { maturity: total, series };
}

// ─── FD Maturity — lumpsum, quarterly compounding ─────────────────────────
function fdMaturity(monthly, months, annualRate) {
  const principal = monthly * months;
  const qr = annualRate / 100 / 4;
  const quarters = months / 3;
  const maturity = principal * Math.pow(1 + qr, quarters);
  const series = [];
  for (let m = 1; m <= months; m++) {
    series.push({ month: m, balance: principal * Math.pow(1 + qr, m / 3) });
  }
  return { maturity, principal, series };
}

// ─── SIP Maturity — monthly compounding ───────────────────────────────────
function sipMaturity(monthly, months, annualRate) {
  const mr = annualRate / 100 / 12;
  let bal = 0;
  const series = [];
  for (let m = 1; m <= months; m++) {
    bal = bal * (1 + mr) + monthly;
    series.push({ month: m, balance: bal });
  }
  return { maturity: bal, series };
}

// ─── Tax calculations ──────────────────────────────────────────────────────
function taxOnFdRd(maturity, invested, taxRatePct) {
  const interest = maturity - invested;
  const tax = interest * (taxRatePct / 100);
  return { interest, tax, postTax: maturity - tax };
}

function taxOnSip(maturity, invested, months, stMonths, stRatePct, ltRatePct) {
  const gain = maturity - invested;
  const isLT = months > stMonths;
  const taxRate = isLT ? ltRatePct : stRatePct;
  const tax = gain * (taxRate / 100);
  return { gain, tax, postTax: maturity - tax, isLT, taxRate };
}

// ─── LineChart ─────────────────────────────────────────────────────────────
function LineChart({ series, totalMonths, monthly }) {
  if (!series || series.length === 0) return null;
  const W = 560, H = 210, PL = 72, PR = 16, PT = 20, PB = 36;
  const iW = W - PL - PR, iH = H - PT - PB;

  const allVals = series.flatMap(s => s.data.map(d => d.balance));
  const maxV = Math.max(...allVals, 1);
  const minV = 0;
  const range = maxV - minV || 1;

  const xPos = (i) => PL + (i / (totalMonths - 1)) * iW;
  const yPos = (v) => PT + iH - ((v - minV) / range) * iH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: minV + t * range, y: PT + iH - t * iH }));

  const showYears = totalMonths > 24;
  const xStep = showYears ? 12 : Math.max(1, Math.floor(totalMonths / 5));
  const xLabels = [];
  for (let i = 0; i < totalMonths; i += xStep) xLabels.push(i);
  if (xLabels[xLabels.length - 1] !== totalMonths - 1) xLabels.push(totalMonths - 1);

  // Invested cumulative line
  const invPath = Array.from({ length: totalMonths }, (_, i) => {
    const inv = series[0].isLumpsum ? monthly * totalMonths : monthly * (i + 1);
    return `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(inv).toFixed(1)}`;
  }).join(" ");

  const gradIds = { RD: "gRD2", FD: "gFD2", SIP: "gSIP2" };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="gRD2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" /><stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="gFD2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bbf7d0" /><stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="gSIP2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9d5ff" /><stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth={1} />
          <text x={PL - 5} y={t.y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
            {fmt(t.val).replace("₹", "")}
          </text>
        </g>
      ))}
      {/* Invested line */}
      <path d={invPath} fill="none" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4,3" />
      {series.map(s => {
        const pts = s.data.map((d, i) =>
          `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(d.balance).toFixed(1)}`).join(" ");
        const area = `M${xPos(0).toFixed(1)},${(PT + iH).toFixed(1)} ` +
          s.data.map((d, i) => `L${xPos(i).toFixed(1)},${yPos(d.balance).toFixed(1)}`).join(" ") +
          ` L${xPos(s.data.length - 1).toFixed(1)},${(PT + iH).toFixed(1)} Z`;
        return (
          <g key={s.key}>
            <path d={area} fill={`url(#${gradIds[s.key]})`} opacity="0.45" />
            <path d={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      })}
      {xLabels.map((i, idx) => (
        <text key={idx} x={xPos(i).toFixed(1)} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {showYears ? `Yr ${Math.round((i + 1) / 12)}` : `M${i + 1}`}
        </text>
      ))}
      {/* Legend */}
      {series.map((s, i) => (
        <g key={s.key}>
          <rect x={PL + i * 105} y={PT + 3} width={8} height={8} rx={2} fill={s.color} />
          <text x={PL + i * 105 + 11} y={PT + 11} fontSize={9} fill={s.color} fontWeight="600">{s.label}</text>
        </g>
      ))}
      <g>
        <line x1={PL + series.length * 105} x2={PL + series.length * 105 + 14} y1={PT + 7} y2={PT + 7}
          stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4,3" />
        <text x={PL + series.length * 105 + 18} y={PT + 11} fontSize={9} fill="#9ca3af">Invested</text>
      </g>
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
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
        <span>{min}</span>{hint && <span style={{ color: "#d97706" }}>{hint}</span>}<span>{max}</span>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, suffix = "", hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 12, color: "#374151", fontWeight: 500, marginBottom: 3 }}>{label}</label>}
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
        <span style={{ padding: "7px 9px", background: "#f3f4f6", color: "#6b7280", fontSize: 12, borderRight: "1px solid #e5e7eb" }}>₹</span>
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, border: "none", background: "transparent", padding: "7px 9px", fontSize: 13, color: "#111827", outline: "none" }} />
        {suffix && <span style={{ padding: "7px 9px", color: "#6b7280", fontSize: 12, borderLeft: "1px solid #e5e7eb" }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function SectionHead({ title }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, marginTop: 8 }}>
      {title}
    </div>
  );
}

function ResultBlock({ label, type, color, bg, border, maturity, invested, interest, tax, postTax, xirr, taxRate, isLT }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{type}</div>
        </div>
        <div style={{ fontSize: 10, background: color, color: "#fff", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
          XIRR {pct(xirr)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Maturity (pre-tax)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color }}>{fmt(maturity)}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Maturity (post-tax)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{fmt(postTax)}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>Interest / Gain</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{fmt(interest)}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "#6b7280" }}>
            Tax @ {pct1(taxRate)}{isLT !== undefined ? (isLT ? " LTCG" : " STCG") : ""}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>−{fmt(tax)}</div>
        </div>
      </div>
    </div>
  );
}

function CompareRow({ label, rd, fd, sip, bestKey }) {
  const cols = [
    { key: "rd", val: rd, color: "#1d4ed8", bg: "#eff6ff" },
    { key: "fd", val: fd, color: "#059669", bg: "#f0fdf4" },
    { key: "sip", val: sip, color: "#7c3aed", bg: "#f5f3ff" },
  ];
  return (
    <tr>
      <td style={{ fontSize: 12, color: "#6b7280", padding: "9px 12px", borderBottom: "1px solid #f3f4f6" }}>{label}</td>
      {cols.map(c => (
        <td key={c.key} style={{
          fontSize: 12, fontWeight: bestKey === c.key ? 800 : 500,
          color: bestKey === c.key ? c.color : "#374151",
          padding: "9px 12px", textAlign: "right", borderBottom: "1px solid #f3f4f6",
          background: bestKey === c.key ? c.bg : "transparent",
        }}>
          {c.val}{bestKey === c.key && <span style={{ fontSize: 9, marginLeft: 3 }}>★</span>}
        </td>
      ))}
    </tr>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function RDCalculator() {
  // Deposit inputs
  const [monthly, setMonthly] = useState(10000);
  const [tenureMonths, setTenureMonths] = useState(36);

  // Rate inputs
  const [rdRate, setRdRate] = useState(7.0);
  const [fdRate, setFdRate] = useState(7.5);
  const [sipRate, setSipRate] = useState(12.0);

  // Tax inputs
  const [fdRdTaxRate, setFdRdTaxRate] = useState(30);
  const [sipStMonths, setSipStMonths] = useState(12);
  const [sipStRate, setSipStRate] = useState(20);
  const [sipLtRate, setSipLtRate] = useState(12.5);

  const years = Math.floor(tenureMonths / 12);
  const remMonths = tenureMonths % 12;
  const tenureDisplay = years > 0
    ? (remMonths > 0 ? `${years}y ${remMonths}m` : `${years} yrs`)
    : `${tenureMonths} mo`;

  const results = useMemo(() => {
    if (monthly <= 0 || tenureMonths <= 0) return null;
    const totalInvested = monthly * tenureMonths;

    // Maturity values
    const rd = rdMaturity(monthly, rdRate, tenureMonths);
    const fd = fdMaturity(monthly, tenureMonths, fdRate);
    const sip = sipMaturity(monthly, tenureMonths, sipRate);

    // XIRR
    const rdXirrVal = rdXIRR(monthly, tenureMonths, rd.maturity);
    const fdXirrVal = fdXIRR(fd.principal, tenureMonths, fd.maturity);
    const sipXirrVal = sipXIRR(monthly, tenureMonths, sip.maturity);

    // Tax
    const rdTax = taxOnFdRd(rd.maturity, totalInvested, fdRdTaxRate);
    const fdTax = taxOnFdRd(fd.maturity, fd.principal, fdRdTaxRate);
    const sipTaxCalc = taxOnSip(sip.maturity, totalInvested, tenureMonths, sipStMonths, sipStRate, sipLtRate);

    // Post-tax XIRR
    const rdPostXirr = rdXIRR(monthly, tenureMonths, rdTax.postTax);
    const fdPostXirr = fdXIRR(fd.principal, tenureMonths, fdTax.postTax);
    const sipPostXirr = sipXIRR(monthly, tenureMonths, sipTaxCalc.postTax);

    // Best pre-tax and post-tax
    const preTaxMat = { rd: rd.maturity, fd: fd.maturity, sip: sip.maturity };
    const postTaxMat = { rd: rdTax.postTax, fd: fdTax.postTax, sip: sipTaxCalc.postTax };
    const bestPreTax = Object.entries(preTaxMat).sort((a, b) => b[1] - a[1])[0][0];
    const bestPostTax = Object.entries(postTaxMat).sort((a, b) => b[1] - a[1])[0][0];

    const chartSeries = [
      { key: "RD", label: "RD", color: "#1d4ed8", data: rd.series, isLumpsum: false },
      { key: "FD", label: "FD (one-time)", color: "#059669", data: fd.series, isLumpsum: true },
      { key: "SIP", label: "SIP", color: "#7c3aed", data: sip.series, isLumpsum: false },
    ];

    return {
      totalInvested, rd, fd, sip,
      rdXirrVal, fdXirrVal, sipXirrVal,
      rdTax, fdTax, sipTaxCalc,
      rdPostXirr, fdPostXirr, sipPostXirr,
      bestPreTax, bestPostTax,
      chartSeries,
    };
  }, [monthly, tenureMonths, rdRate, fdRate, sipRate, fdRdTaxRate, sipStMonths, sipStRate, sipLtRate]);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "linear-gradient(135deg, #f0fdf4 0%, #fafafa 60%, #eff6ff 100%)", minHeight: "100vh", padding: "24px 16px" }}>

      {/* Header */}
      <div style={{ maxWidth: 920, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#059669", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 3 }}>D3 · RD Calculator</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: -0.5 }}>Recurring Deposit</h1>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 3, marginBottom: 0 }}>RD · FD · SIP — pre & post-tax comparison on same monthly amount</p>
          </div>
          <div style={{ background: TIER === "advisor" ? "#dbeafe" : TIER === "alpha" ? "#ede9fe" : "#dcfce7", color: TIER === "advisor" ? "#1d4ed8" : TIER === "alpha" ? "#7c3aed" : "#16a34a", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {TIER.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gridTemplateColumns: "270px 1fr", gap: 18, alignItems: "start" }}>

        {/* ── Left: Inputs ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb" }}>

          <SectionHead title="Deposit" />
          <NumInput label="Monthly Deposit" value={monthly} onChange={setMonthly} />
          <Slider label="Tenure" value={tenureMonths} min={6} max={120} step={1}
            onChange={setTenureMonths} display={tenureDisplay} />

          {results && (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Total invested</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>{fmt(results.totalInvested)}</div>
            </div>
          )}

          <SectionHead title="Interest / Return Rates" />

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>RD Rate</span>
              <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>Monthly deposit</span>
            </div>
            <Slider label="" value={rdRate} min={4} max={10} step={0.25}
              onChange={setRdRate} display={pct1(rdRate)} accentColor="#1d4ed8" />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: -6 }}>Quarterly compounding — bank standard</div>
          </div>

          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>FD Rate</span>
              <span style={{ fontSize: 10, background: "#dcfce7", color: "#059669", padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>One-time deposit</span>
            </div>
            <Slider label="" value={fdRate} min={4} max={10} step={0.25}
              onChange={setFdRate} display={pct1(fdRate)} accentColor="#059669" />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: -6 }}>Full amount (monthly × tenure) invested upfront</div>
          </div>

          <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>SIP Return</span>
              <span style={{ fontSize: 10, background: "#ede9fe", color: "#7c3aed", padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>Monthly deposit</span>
            </div>
            <Slider label="" value={sipRate} min={6} max={20} step={0.5}
              onChange={setSipRate} display={pct1(sipRate)} accentColor="#7c3aed" />
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: -6 }}>Expected annual return — equity MF</div>
          </div>

          <SectionHead title="Taxation" />

          <div style={{ background: "#fef9ec", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginBottom: 8 }}>FD & RD — Interest Income Tax</div>
            <Slider label="Tax rate (income slab)" value={fdRdTaxRate} min={0} max={35} step={2.5}
              onChange={setFdRdTaxRate} display={pct1(fdRdTaxRate)} accentColor="#d97706"
              hint="Suggested: 30% (highest slab)" />
          </div>

          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#9f1239", fontWeight: 700, marginBottom: 8 }}>SIP — Capital Gains Tax</div>
            <Slider label="Short-term threshold" value={sipStMonths} min={6} max={36} step={1}
              onChange={setSipStMonths} display={`${sipStMonths} mo`} accentColor="#e11d48"
              hint="Equity MF: 12 months" />
            <Slider label="STCG rate" value={sipStRate} min={0} max={35} step={2.5}
              onChange={setSipStRate} display={pct1(sipStRate)} accentColor="#e11d48"
              hint="Suggested: 20%" />
            <Slider label="LTCG rate" value={sipLtRate} min={0} max={20} step={1.25}
              onChange={setSipLtRate} display={pct1(sipLtRate)} accentColor="#e11d48"
              hint="Suggested: 12.5%" />
            {results && (
              <div style={{ fontSize: 11, color: "#9f1239", background: "rgba(255,255,255,0.6)", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}>
                Tenure {tenureDisplay} → {tenureMonths > sipStMonths ? `LTCG @ ${pct1(sipLtRate)}` : `STCG @ ${pct1(sipStRate)}`} applies
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Results ── */}
        {results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Three result blocks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ResultBlock label="RD" type="Monthly deposit · Guaranteed"
                color="#1d4ed8" bg="#eff6ff" border="#bfdbfe"
                maturity={results.rd.maturity} invested={results.totalInvested}
                interest={results.rd.maturity - results.totalInvested}
                tax={results.rdTax.tax} postTax={results.rdTax.postTax}
                xirr={results.rdXirrVal} taxRate={fdRdTaxRate} />
              <ResultBlock label="FD" type="One-time deposit · Guaranteed"
                color="#059669" bg="#f0fdf4" border="#bbf7d0"
                maturity={results.fd.maturity} invested={results.fd.principal}
                interest={results.fd.maturity - results.fd.principal}
                tax={results.fdTax.tax} postTax={results.fdTax.postTax}
                xirr={results.fdXirrVal} taxRate={fdRdTaxRate} />
              <ResultBlock label="SIP" type="Monthly deposit · Market-linked"
                color="#7c3aed" bg="#f5f3ff" border="#ddd6fe"
                maturity={results.sip.maturity} invested={results.totalInvested}
                interest={results.sip.maturity - results.totalInvested}
                tax={results.sipTaxCalc.tax} postTax={results.sipTaxCalc.postTax}
                xirr={results.sipXirrVal}
                taxRate={results.sipTaxCalc.taxRate}
                isLT={results.sipTaxCalc.isLT} />
            </div>

            {/* Chart */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 18px", border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
                Growth Comparison (pre-tax)
                <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400, marginLeft: 8 }}>
                  ₹{monthly.toLocaleString("en-IN")}/mo · {tenureDisplay}
                </span>
              </div>
              <LineChart series={results.chartSeries} totalMonths={tenureMonths} monthly={monthly} />
            </div>

            {/* Head-to-head table */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Head-to-Head</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>★ = best for that row</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #f3f4f6" }}></th>
                    {[["RD", "#1d4ed8"], ["FD", "#059669"], ["SIP", "#7c3aed"]].map(([k, c]) => (
                      <th key={k} style={{ fontSize: 11, color: c, fontWeight: 700, padding: "8px 12px", textAlign: "right", borderBottom: "1px solid #f3f4f6" }}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Investment type"
                    rd="Monthly" fd="One-time" sip="Monthly" bestKey={null} />
                  <CompareRow label="Total invested"
                    rd={fmt(results.totalInvested)} fd={fmt(results.fd.principal)} sip={fmt(results.totalInvested)} bestKey={null} />
                  <CompareRow label="Maturity (pre-tax)"
                    rd={fmt(results.rd.maturity)} fd={fmt(results.fd.maturity)} sip={fmt(results.sip.maturity)}
                    bestKey={results.bestPreTax} />
                  <CompareRow label="Interest / Gain"
                    rd={fmt(results.rd.maturity - results.totalInvested)}
                    fd={fmt(results.fd.maturity - results.fd.principal)}
                    sip={fmt(results.sip.maturity - results.totalInvested)}
                    bestKey={results.bestPreTax} />
                  <CompareRow label="Tax deducted"
                    rd={`−${fmt(results.rdTax.tax)}`}
                    fd={`−${fmt(results.fdTax.tax)}`}
                    sip={`−${fmt(results.sipTaxCalc.tax)}`}
                    bestKey={["rd","fd","sip"].reduce((a,b) =>
                      ({rd:results.rdTax.tax,fd:results.fdTax.tax,sip:results.sipTaxCalc.tax}[a] <
                       {rd:results.rdTax.tax,fd:results.fdTax.tax,sip:results.sipTaxCalc.tax}[b] ? a : b))} />
                  <CompareRow label="Maturity (post-tax)"
                    rd={fmt(results.rdTax.postTax)} fd={fmt(results.fdTax.postTax)} sip={fmt(results.sipTaxCalc.postTax)}
                    bestKey={results.bestPostTax} />
                  <CompareRow label="XIRR (pre-tax)"
                    rd={pct(results.rdXirrVal)} fd={pct(results.fdXirrVal)} sip={pct(results.sipXirrVal)}
                    bestKey={results.bestPreTax} />
                  <CompareRow label="XIRR (post-tax)"
                    rd={pct(results.rdPostXirr)} fd={pct(results.fdPostXirr)} sip={pct(results.sipPostXirr)}
                    bestKey={results.bestPostTax} />
                  <CompareRow label="Capital safety"
                    rd="Guaranteed" fd="Guaranteed" sip="Market risk" bestKey={null} />
                  <CompareRow label="Liquidity"
                    rd="Penalty on break" fd="Penalty on break" sip="Anytime" bestKey="sip" />
                </tbody>
              </table>
            </div>

            {/* Quick read */}
            <div style={{ background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Quick Read</div>
              <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.9 }}>
                {results.bestPostTax === "sip"
                  ? <>SIP wins post-tax at <strong>{pct(results.sipPostXirr)} XIRR</strong> — {fmt(results.sipTaxCalc.postTax)} in hand after {results.sipTaxCalc.isLT ? "LTCG" : "STCG"} tax of {pct1(results.sipTaxCalc.taxRate)}. That's <strong>{fmt(results.sipTaxCalc.postTax - results.rdTax.postTax)}</strong> more than RD. But returns are market-linked — not guaranteed.</>
                  : results.bestPostTax === "fd"
                  ? <>FD wins post-tax at <strong>{pct(results.fdPostXirr)} XIRR</strong> — benefits from full lumpsum compounding from day one. RD earns less because monthly deposits compound for less time on average.</>
                  : <>RD wins post-tax — <strong>{fmt(results.rdTax.postTax)}</strong> in hand. Consistent monthly saving with guaranteed returns and quarterly compounding.</>
                }
                {" "}<strong>RD and FD are capital-safe</strong>; SIP is market-linked.
              </div>
            </div>

            {/* Assumptions */}
            <div style={{ fontSize: 11, color: "#9ca3af", background: "#f9fafb", borderRadius: 10, padding: "10px 14px", border: "1px solid #f3f4f6", lineHeight: 1.8 }}>
              <strong>Assumptions:</strong> RD: quarterly compounding (Indian bank standard). FD: total amount (₹{monthly.toLocaleString("en-IN")} × {tenureMonths} = {fmt(results.totalInvested)}) deposited as lumpsum at start, quarterly compounding. SIP: monthly compounding, invested at month-end.
              Tax: RD and FD assumed fully matured — interest taxed as income at {pct1(fdRdTaxRate)}. SIP assumed fully redeemed at end of tenure — entire gain taxed as {results.sipTaxCalc.isLT ? `LTCG at ${pct1(sipLtRate)}` : `STCG at ${pct1(sipStRate)}`} (tenure {tenureMonths > sipStMonths ? ">" : "≤"} {sipStMonths}-month threshold). LTCG exemption of ₹1.25L not modelled. No TDS or surcharge. All returns pre-surcharge.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
