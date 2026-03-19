import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const SCHEMES_URL =
  "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
const NAV_GIST_ID = "6f82d116b7067a8d13aa620e99aa783f";
const NAV_BASE = `https://gist.githubusercontent.com/anjaneyakg/${NAV_GIST_ID}/raw`;
const PLAN_KEY = "fundlens_plan_universe";
const STALE_DAYS = 5;
const MAX_SLOTS = 5;
const SLOT_COLORS = ["#635bff", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

const MODES = {
  sip: { label: "SIP", icon: "↻" },
  lumpsum: { label: "Lumpsum", icon: "◈" },
  both: { label: "Both", icon: "⊕" },
};

// ─── Utilities ────────────────────────────────────────────────────────────────
const getStoredPlan = () => localStorage.getItem(PLAN_KEY) || "Direct";

function categorySlug(cat) {
  return (cat || "other")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function navFileUrl(category, plan) {
  return `${NAV_BASE}/nav_${categorySlug(category)}_${(plan || "direct").toLowerCase()}.json`;
}

function isStaleNav(navDate) {
  if (!navDate) return true;
  const diff = (Date.now() - new Date(navDate).getTime()) / 86400000;
  return diff > STALE_DAYS;
}

function isActiveScheme(s) {
  return s.nav > 0 && s.structure !== "Close Ended";
}

function fmtINR(val) {
  if (val == null || isNaN(val)) return "—";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000)     return `${sign}₹${(abs / 1000).toFixed(1)} k`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

function fmtPct(val, dp = 2) {
  if (val == null || isNaN(val)) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(dp)}%`;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── XIRR (Newton-Raphson) ───────────────────────────────────────────────────
function computeXIRR(cashflows, dates) {
  if (!cashflows?.length || cashflows.length < 2) return null;
  const t0 = dates[0].getTime();
  const yrs = dates.map(d => (d.getTime() - t0) / (365.25 * 86400000));
  const npv  = r => cashflows.reduce((s, c, i) => s + c / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = r => cashflows.reduce((s, c, i) => s - yrs[i] * c / Math.pow(1 + r, yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const d = dnpv(r);
    if (Math.abs(d) < 1e-12) break;
    const nr = r - npv(r) / d;
    if (Math.abs(nr - r) < 1e-8) return nr;
    r = Math.max(nr, -0.999); // guard against < -100%
  }
  return null;
}

// ─── NAV lookup (binary search, finds closest date ≤ target) ────────────────
function findNavOnOrBefore(sorted, targetDate) {
  const tms = new Date(targetDate).getTime();
  let lo = 0, hi = sorted.length - 1, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const dms = new Date(sorted[mid].date).getTime();
    if (dms <= tms) { best = sorted[mid]; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}

// ─── SIP computation ─────────────────────────────────────────────────────────
function computeSIP(navHistory, monthlyAmt, startDateStr) {
  if (!navHistory?.length || monthlyAmt <= 0) return null;
  const sorted = [...navHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  const start  = startDateStr ? new Date(startDateStr) : new Date(sorted[0].date);
  const lastEntry = sorted[sorted.length - 1];
  const lastDate  = new Date(lastEntry.date);

  const sipCashflows = [], sipDates = [];
  let totalUnits = 0, totalInvested = 0;
  const curve = [];

  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= lastDate) {
    const entry = findNavOnOrBefore(sorted, cur.toISOString().slice(0, 10));
    if (entry) {
      const units = monthlyAmt / entry.nav;
      totalUnits    += units;
      totalInvested += monthlyAmt;
      sipCashflows.push(-monthlyAmt);
      sipDates.push(new Date(entry.date));
      curve.push({ date: entry.date, invested: totalInvested, value: totalUnits * lastEntry.nav });
    }
    cur.setMonth(cur.getMonth() + 1);
  }

  if (!sipCashflows.length) return null;
  const currentValue = totalUnits * lastEntry.nav;
  const allCF    = [...sipCashflows, currentValue];
  const allDates = [...sipDates, lastDate];

  return {
    totalInvested,
    currentValue,
    gain:    currentValue - totalInvested,
    pctRet:  ((currentValue - totalInvested) / totalInvested) * 100,
    xirr:    computeXIRR(allCF, allDates),
    months:  sipCashflows.length,
    latestNavDate: lastEntry.date,
    curve,
  };
}

// ─── Lumpsum computation ─────────────────────────────────────────────────────
function computeLumpsum(navHistory, amount, investDateStr) {
  if (!navHistory?.length || amount <= 0) return null;
  const sorted = [...navHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

  const investEntry = findNavOnOrBefore(sorted, investDateStr || sorted[0].date);
  if (!investEntry) return null;

  const lastEntry  = sorted[sorted.length - 1];
  const units      = amount / investEntry.nav;
  const currentValue = units * lastEntry.nav;
  const gain       = currentValue - amount;

  const cf    = [-amount, currentValue];
  const dates = [new Date(investEntry.date), new Date(lastEntry.date)];

  // build a monthly curve for chart (no extra SIP, just mark-to-market each month)
  const curve = [];
  const start = new Date(investEntry.date);
  const end   = new Date(lastEntry.date);
  const cur   = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const entry = findNavOnOrBefore(sorted, cur.toISOString().slice(0, 10));
    if (entry) curve.push({ date: entry.date, invested: amount, value: units * entry.nav });
    cur.setMonth(cur.getMonth() + 1);
  }

  return {
    totalInvested: amount,
    currentValue,
    gain,
    pctRet:  (gain / amount) * 100,
    xirr:    computeXIRR(cf, dates),
    investDate: investEntry.date,
    latestNavDate: lastEntry.date,
    curve,
  };
}

// ─── Combine SIP + Lumpsum ────────────────────────────────────────────────────
function combineResults(sipRes, lsRes) {
  if (!sipRes && !lsRes) return null;
  if (!sipRes) return lsRes;
  if (!lsRes)  return sipRes;

  const totalInvested  = sipRes.totalInvested  + lsRes.totalInvested;
  const currentValue   = sipRes.currentValue   + lsRes.currentValue;
  const gain           = currentValue - totalInvested;

  // Combined XIRR: merge cashflows, sort by date
  const combined = [];
  sipRes.curve.forEach(p => combined.push({ date: p.date, invested: p.invested, value: p.value, lsInvested: 0, lsValue: 0 }));
  // merge curves by date for chart
  const dateMap = {};
  sipRes.curve.forEach(p => { dateMap[p.date] = { sipInv: p.invested, sipVal: p.value, lsInv: 0, lsVal: 0 }; });
  lsRes.curve.forEach(p => {
    if (dateMap[p.date]) { dateMap[p.date].lsInv = p.invested; dateMap[p.date].lsVal = p.value; }
    else dateMap[p.date] = { sipInv: 0, sipVal: 0, lsInv: p.invested, lsVal: p.value };
  });
  const curve = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, invested: v.sipInv + v.lsInv, value: v.sipVal + v.lsVal }));

  return {
    totalInvested,
    currentValue,
    gain,
    pctRet: (gain / totalInvested) * 100,
    xirr:   ((sipRes.xirr ?? 0) * sipRes.totalInvested + (lsRes.xirr ?? 0) * lsRes.totalInvested) / totalInvested,
    latestNavDate: sipRes.latestNavDate,
    curve,
    sipPart: sipRes,
    lsPart:  lsRes,
  };
}

// ─── Portfolio Growth Chart (Canvas) ─────────────────────────────────────────
function GrowthChart({ slots, results }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const active = slots
      .map((s, i) => results[i] ? { curve: results[i].curve, color: SLOT_COLORS[i], label: s.scheme?.name } : null)
      .filter(Boolean);
    if (!active.length) return;

    const pad = { top: 12, right: 16, bottom: 36, left: 66 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    // Blended curve
    const allDates = [...new Set(active.flatMap(a => a.curve.map(p => p.date)))].sort();
    if (allDates.length < 2) return;
    const blended = allDates.map(date => {
      let inv = 0, val = 0;
      active.forEach(({ curve }) => {
        const p = curve.find(q => q.date === date);
        if (p) { inv += p.invested; val += p.value; }
      });
      return { date, invested: inv, value: val };
    });

    const yMax = Math.max(...blended.map(p => p.value), ...blended.map(p => p.invested)) * 1.06;
    const yMin = 0;
    const xS = i => pad.left + (i / (allDates.length - 1)) * cW;
    const yS = v => pad.top + cH - ((v - yMin) / (yMax - yMin)) * cH;

    // Grid
    ctx.strokeStyle = "rgba(99,91,255,0.07)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      const v = yMax - (yMax / 4) * i;
      const lbl = v >= 10000000 ? `₹${(v/10000000).toFixed(1)}Cr` : v >= 100000 ? `₹${(v/100000).toFixed(0)}L` : `₹${(v/1000).toFixed(0)}k`;
      ctx.fillStyle = "#8b8fa8"; ctx.font = "10px 'DM Mono', monospace";
      ctx.textAlign = "right"; ctx.fillText(lbl, pad.left - 5, y + 3);
    }

    // X labels
    ctx.textAlign = "center"; ctx.fillStyle = "#8b8fa8"; ctx.font = "10px 'DM Mono', monospace";
    const step = Math.ceil(allDates.length / 6);
    allDates.forEach((d, i) => {
      if (i % step === 0 || i === allDates.length - 1) {
        const dt = new Date(d);
        ctx.fillText(`${dt.toLocaleString("en-IN", {month:"short"})} ${dt.getFullYear()}`, xS(i), pad.top + cH + 18);
      }
    });

    // Individual scheme lines (thin, semi-transparent)
    if (active.length > 1) {
      active.forEach(({ curve, color }) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
        ctx.setLineDash([]); ctx.beginPath();
        curve.forEach((p, i) => {
          const di = allDates.indexOf(p.date);
          if (di < 0) return;
          i === 0 ? ctx.moveTo(xS(di), yS(p.value)) : ctx.lineTo(xS(di), yS(p.value));
        });
        ctx.stroke(); ctx.globalAlpha = 1;
      });
    }

    // Invested dashed line
    ctx.setLineDash([4, 3]); ctx.strokeStyle = "rgba(99,91,255,0.3)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    blended.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p.invested)) : ctx.lineTo(xS(i), yS(p.invested)));
    ctx.stroke(); ctx.setLineDash([]);

    // Portfolio value fill + line
    ctx.beginPath();
    blended.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p.value)) : ctx.lineTo(xS(i), yS(p.value)));
    ctx.lineTo(xS(blended.length - 1), pad.top + cH); ctx.lineTo(xS(0), pad.top + cH); ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, "rgba(99,91,255,0.18)"); grad.addColorStop(1, "rgba(99,91,255,0)");
    ctx.fillStyle = grad; ctx.fill();

    ctx.strokeStyle = "#635bff"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    blended.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p.value)) : ctx.lineTo(xS(i), yS(p.value)));
    ctx.stroke();
  }, [slots, results]);

  return (
    <div style={{ width: "100%", height: 220 }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

// ─── Slot Card ────────────────────────────────────────────────────────────────
function SlotCard({ idx, slot, schemes, plan, onUpdate, onRemove, canRemove, result, computing }) {
  const color = SLOT_COLORS[idx];

  // Derived scheme lists
  const categories = useMemo(() => {
    const cats = [...new Set(schemes.map(s => s.category))].sort();
    return cats;
  }, [schemes]);

  const amcs = useMemo(() => {
    if (!slot.category) return [];
    return [...new Set(
      schemes.filter(s => s.category === slot.category).map(s => s.amc)
    )].sort();
  }, [schemes, slot.category]);

  const filteredSchemes = useMemo(() => {
    return schemes.filter(s =>
      (!slot.category || s.category === slot.category) &&
      (!slot.amc      || s.amc      === slot.amc)
    );
  }, [schemes, slot.category, slot.amc]);

  const [schemeQuery, setSchemeQuery] = useState(slot.scheme?.name || "");
  const [dropOpen, setDropOpen]       = useState(false);
  const blurRef = useRef(null);

  // Keep query in sync if scheme cleared externally
  useEffect(() => { if (!slot.scheme) setSchemeQuery(""); }, [slot.scheme]);

  const searchResults = useMemo(() => {
    if (!schemeQuery.trim() || schemeQuery.length < 2) return filteredSchemes.slice(0, 8);
    const q = schemeQuery.toLowerCase();
    return filteredSchemes.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [schemeQuery, filteredSchemes]);

  const pickScheme = s => {
    setSchemeQuery(s.name);
    setDropOpen(false);
    onUpdate("scheme", s);
  };

  const setCategory = val => {
    onUpdate("category", val);
    onUpdate("amc", "");
    onUpdate("scheme", null);
    setSchemeQuery("");
  };

  const setAMC = val => {
    onUpdate("amc", val);
    onUpdate("scheme", null);
    setSchemeQuery("");
  };

  const staleWarn = slot.scheme && isStaleNav(slot.scheme.navDate);

  const showSIP      = slot.mode === "sip"  || slot.mode === "both";
  const showLumpsum  = slot.mode === "lumpsum" || slot.mode === "both";

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: 12,
      border: `1px solid ${slot.scheme ? color + "35" : "rgba(99,91,255,0.12)"}`,
      borderLeft: `4px solid ${color}`,
      padding: "18px 20px",
      transition: "box-shadow 0.2s",
    }}>
      {/* Slot header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: color + "18", border: `1.5px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color, fontFamily: "DM Mono, monospace",
        }}>{idx + 1}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
          Scheme {idx + 1}
          {slot.scheme && <span style={{ color: "#8b8fa8", fontWeight: 400, marginLeft: 6 }}>· {slot.scheme.amc}</span>}
        </span>

        {/* Mode toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {Object.entries(MODES).map(([key, { label }]) => (
            <button key={key}
              onClick={() => onUpdate("mode", key)}
              style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: "pointer", border: "1.5px solid",
                borderColor: slot.mode === key ? color : "rgba(99,91,255,0.2)",
                background: slot.mode === key ? color + "15" : "transparent",
                color: slot.mode === key ? color : "#8b8fa8",
                fontFamily: "Syne, sans-serif",
              }}
            >{label}</button>
          ))}
        </div>

        {canRemove && (
          <button onClick={onRemove} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#8b8fa8", fontSize: 20, lineHeight: 1, padding: "0 0 0 4px",
          }}>×</button>
        )}
      </div>

      {/* Stale NAV warning */}
      {staleWarn && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6,
          padding: "6px 12px", marginBottom: 12, fontSize: 11, color: "#92400e",
        }}>
          NAV last updated {fmtDate(slot.scheme.navDate)} — scheme may be inactive or illiquid
        </div>
      )}

      {/* Guided filter row: Category → AMC */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</div>
          <select
            value={slot.category || ""}
            onChange={e => setCategory(e.target.value)}
            style={selectStyle}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>AMC</div>
          <select
            value={slot.amc || ""}
            onChange={e => setAMC(e.target.value)}
            disabled={amcs.length === 0}
            style={{ ...selectStyle, opacity: amcs.length === 0 ? 0.5 : 1 }}
          >
            <option value="">All AMCs</option>
            {amcs.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Scheme search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Scheme {filteredSchemes.length > 0 && <span style={{ color: color }}>· {filteredSchemes.length} available</span>}
        </div>
        <input
          style={inputStyle}
          placeholder={filteredSchemes.length ? "Type to search scheme…" : "Select category first"}
          value={schemeQuery}
          disabled={filteredSchemes.length === 0}
          onChange={e => { setSchemeQuery(e.target.value); setDropOpen(true); }}
          onFocus={() => setDropOpen(true)}
          onBlur={() => { blurRef.current = setTimeout(() => setDropOpen(false), 200); }}
        />
        {dropOpen && searchResults.length > 0 && (
          <div style={{
            position: "absolute", zIndex: 999, top: "calc(100% + 2px)", left: 0, right: 0,
            background: "#fff", border: "1px solid rgba(99,91,255,0.2)",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            maxHeight: 220, overflowY: "auto",
          }}>
            {searchResults.map(s => (
              <div key={s.id}
                onMouseDown={e => { e.preventDefault(); clearTimeout(blurRef.current); pickScheme(s); }}
                style={{
                  padding: "9px 14px", cursor: "pointer",
                  borderBottom: "1px solid rgba(99,91,255,0.08)",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f4ff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#8b8fa8", marginTop: 2 }}>
                  {s.amc} · NAV ₹{s.nav?.toFixed(2)} · {fmtDate(s.navDate)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Amount inputs — conditional on mode */}
      {slot.scheme && (
        <div style={{ display: "grid", gridTemplateColumns: showSIP && showLumpsum ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 4 }}>
          {showSIP && (
            <div>
              <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly SIP (₹)</div>
              <input
                type="number" min="500" step="500"
                value={slot.sipAmount}
                onChange={e => onUpdate("sipAmount", Number(e.target.value))}
                style={{ ...inputStyle, textAlign: "right", fontFamily: "DM Mono, monospace" }}
              />
            </div>
          )}
          {showLumpsum && (
            <div>
              <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lumpsum amount (₹)</div>
              <input
                type="number" min="1000" step="1000"
                value={slot.lsAmount}
                onChange={e => onUpdate("lsAmount", Number(e.target.value))}
                style={{ ...inputStyle, textAlign: "right", fontFamily: "DM Mono, monospace" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Per-slot result */}
      {slot.scheme && result && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${color}25`,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
          gap: 10,
        }}>
          {[
            { l: "Invested",  v: fmtINR(result.totalInvested) },
            { l: "Value",     v: fmtINR(result.currentValue) },
            { l: "Gain",      v: fmtINR(result.gain),   c: result.gain >= 0 ? "#10b981" : "#ef4444" },
            { l: "Return",    v: fmtPct(result.pctRet), c: result.pctRet >= 0 ? "#10b981" : "#ef4444" },
            { l: "XIRR",      v: result.xirr != null ? fmtPct(result.xirr * 100) : "—", c: (result.xirr ?? 0) >= 0 ? "#10b981" : "#ef4444" },
          ].map(({ l, v, c }) => (
            <div key={l}>
              <div style={{ fontSize: 9, color: "#8b8fa8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c || "#1a1a2e", fontFamily: "DM Mono, monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {slot.scheme && !result && computing && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#8b8fa8" }}>Computing…</div>
      )}
    </div>
  );
}

// ─── Shared input/select styles ───────────────────────────────────────────────
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#f8f8ff", border: "1px solid rgba(99,91,255,0.18)",
  borderRadius: 8, padding: "8px 12px", fontSize: 13,
  color: "#1a1a2e", fontFamily: "Syne, sans-serif", outline: "none",
};
const selectStyle = {
  ...inputStyle,
  appearance: "none", WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b8fa8'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
  paddingRight: 28, cursor: "pointer",
};

// ─── Main Component ───────────────────────────────────────────────────────────
const makeSlot = () => ({
  mode: "sip", scheme: null, category: "", amc: "",
  sipAmount: 5000, lsAmount: 50000,
});

export default function SchemeBasket() {
  const [plan, setPlan]                 = useState(getStoredPlan);
  const [allSchemes, setAllSchemes]     = useState([]);
  const [schemesLoading, setSchemesLoading] = useState(true);
  const [slots, setSlots]               = useState([makeSlot(), makeSlot()]);
  const [sipStartDate, setSipStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().slice(0, 7);
  });
  const [lsDate, setLsDate]             = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [navCache, setNavCache]         = useState({});
  const [navLoading, setNavLoading]     = useState({});
  const [results, setResults]           = useState(Array(MAX_SLOTS).fill(null));
  const [computing, setComputing]       = useState(false);

  // Plan universe listener
  useEffect(() => {
    const h = () => setPlan(getStoredPlan());
    window.addEventListener("fundlens_plan_change", h);
    return () => window.removeEventListener("fundlens_plan_change", h);
  }, []);

  // Load + filter schemes: Growth + active + plan
  useEffect(() => {
    setSchemesLoading(true);
    fetch(SCHEMES_URL)
      .then(r => r.json())
      .then(d => {
        const filtered = (d.schemes || []).filter(s =>
          s.type === "Growth" &&
          s.plan === plan &&
          isActiveScheme(s)
        );
        setAllSchemes(filtered);
      })
      .catch(() => setAllSchemes([]))
      .finally(() => setSchemesLoading(false));
  }, [plan]);

  // Fetch NAV file (cached by category|plan key)
  const fetchNav = useCallback(async scheme => {
    const key = `${scheme.category}|${scheme.plan}`;
    if (navCache[key]) return navCache[key];
    if (navLoading[key]) {
      // Wait for in-flight
      await new Promise(res => setTimeout(res, 600));
      return navCache[key] || {};
    }
    setNavLoading(p => ({ ...p, [key]: true }));
    try {
      const data = await fetch(navFileUrl(scheme.category, scheme.plan)).then(r => r.json());
      setNavCache(p => ({ ...p, [key]: data }));
      return data;
    } catch {
      setNavCache(p => ({ ...p, [key]: {} }));
      return {};
    } finally {
      setNavLoading(p => ({ ...p, [key]: false }));
    }
  }, [navCache, navLoading]);

  // Run computation
  const runCompute = useCallback(async () => {
    const active = slots.some(s => s.scheme);
    if (!active) return;
    setComputing(true);

    const newResults = await Promise.all(slots.map(async slot => {
      if (!slot.scheme) return null;
      const navData    = await fetchNav(slot.scheme);
      const navHistory = navData[slot.scheme.id] || [];
      if (!navHistory.length) return null;

      const startDt = sipStartDate ? sipStartDate + "-01" : null;
      const sipRes  = (slot.mode === "sip"  || slot.mode === "both") ? computeSIP(navHistory, slot.sipAmount, startDt) : null;
      const lsRes   = (slot.mode === "lumpsum" || slot.mode === "both") ? computeLumpsum(navHistory, slot.lsAmount, lsDate) : null;
      return combineResults(sipRes, lsRes);
    }));

    setResults(newResults);
    setComputing(false);
  }, [slots, sipStartDate, lsDate, fetchNav]);

  // Auto-compute with debounce
  useEffect(() => {
    if (slots.some(s => s.scheme)) {
      const t = setTimeout(runCompute, 500);
      return () => clearTimeout(t);
    }
  }, [slots, sipStartDate, lsDate]);

  const updateSlot = (idx, field, val) =>
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const addSlot = () => {
    if (slots.length < MAX_SLOTS) setSlots(p => [...p, makeSlot()]);
  };

  const removeSlot = idx => {
    setSlots(p => p.filter((_, i) => i !== idx));
    setResults(p => p.filter((_, i) => i !== idx));
  };

  // Portfolio aggregates
  const activeRes = slots.map((_, i) => results[i]).filter(Boolean);
  const totalInvested    = activeRes.reduce((s, r) => s + r.totalInvested, 0);
  const totalValue       = activeRes.reduce((s, r) => s + r.currentValue, 0);
  const totalGain        = totalValue - totalInvested;
  const totalPct         = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const blendedXIRR      = activeRes.length
    ? activeRes.reduce((s, r) => s + (r.xirr ?? 0) * r.totalInvested, 0) / totalInvested
    : null;

  const hasResults = activeRes.length > 0;
  const showSIPDate = slots.some(s => s.mode === "sip" || s.mode === "both");
  const showLSDate  = slots.some(s => s.mode === "lumpsum" || s.mode === "both");

  return (
    <div style={{
      fontFamily: "Syne, sans-serif",
      background: "#eef2ff",
      minHeight: "100vh",
      padding: "24px 16px 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        select:focus, input:focus { border-color: rgba(99,91,255,0.5) !important; box-shadow: 0 0 0 3px rgba(99,91,255,0.1); }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{
              fontFamily: "Bebas Neue, sans-serif", fontSize: "clamp(38px,6vw,54px)",
              letterSpacing: "0.04em", color: "#635bff", margin: 0, lineHeight: 1,
            }}>Scheme Basket</h1>
            <span style={{
              fontFamily: "Bebas Neue, sans-serif", fontSize: "clamp(20px,3vw,28px)",
              color: "#8b8fa8", letterSpacing: "0.06em",
            }}>Performance · A6</span>
          </div>
          <p style={{ color: "#8b8fa8", fontSize: 13, margin: "8px 0 10px" }}>
            Up to 5 schemes · SIP, lumpsum, or both per slot · blended portfolio XIRR &amp; growth chart
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", background: "rgba(99,91,255,0.1)",
            borderRadius: 20, fontSize: 12, color: "#635bff", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#635bff" }} />
            {plan} · Growth only · Active schemes
          </div>
        </div>

        {/* ── Global date controls ── */}
        {(showSIPDate || showLSDate) && (
          <div style={{
            background: "#fff", borderRadius: 12, border: "1px solid rgba(99,91,255,0.12)",
            padding: "16px 20px", marginBottom: 18,
            display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center",
          }}>
            {showSIPDate && (
              <div>
                <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>SIP start month</div>
                <input
                  type="month"
                  value={sipStartDate}
                  max={new Date().toISOString().slice(0, 7)}
                  onChange={e => setSipStartDate(e.target.value)}
                  style={{ ...inputStyle, width: "auto", fontFamily: "DM Mono, monospace" }}
                />
              </div>
            )}
            {showLSDate && (
              <div>
                <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lumpsum investment date</div>
                <input
                  type="date"
                  value={lsDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setLsDate(e.target.value)}
                  style={{ ...inputStyle, width: "auto", fontFamily: "DM Mono, monospace" }}
                />
              </div>
            )}
            <div style={{ fontSize: 11, color: "#8b8fa8", lineHeight: 1.5 }}>
              SIPs invested on 1st of each month<br/>
              Lumpsum invested at closest available NAV date
            </div>
          </div>
        )}

        {/* ── Slot cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
          {schemesLoading ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#8b8fa8", fontSize: 13 }}>
              Loading schemes…
            </div>
          ) : (
            slots.map((slot, idx) => (
              <SlotCard
                key={idx}
                idx={idx}
                slot={slot}
                schemes={allSchemes}
                plan={plan}
                onUpdate={(field, val) => updateSlot(idx, field, val)}
                onRemove={() => removeSlot(idx)}
                canRemove={slots.length > 1}
                result={results[idx]}
                computing={computing}
              />
            ))
          )}
        </div>

        {/* ── Add slot button ── */}
        {slots.length < MAX_SLOTS && (
          <button
            onClick={addSlot}
            style={{
              width: "100%", background: "rgba(99,91,255,0.05)",
              border: "1.5px dashed rgba(99,91,255,0.35)", borderRadius: 12,
              padding: "13px 20px", cursor: "pointer",
              color: "#635bff", fontFamily: "Syne, sans-serif",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 20,
            }}
          >
            + Add scheme {slots.length + 1}
            <span style={{ fontSize: 11, color: "#8b8fa8", fontWeight: 400 }}>({MAX_SLOTS - slots.length} slots remaining)</span>
          </button>
        )}

        {/* ── Portfolio summary ── */}
        {hasResults && (
          <>
            <div style={{
              background: "linear-gradient(130deg, #4f46e5 0%, #635bff 100%)",
              borderRadius: 16, padding: "24px 28px", marginBottom: 16, color: "#fff",
            }}>
              <div style={{
                fontFamily: "Bebas Neue, sans-serif", fontSize: 20,
                letterSpacing: "0.06em", marginBottom: 20, opacity: 0.9,
              }}>Basket Portfolio Summary</div>

              {/* Summary metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                  { l: "Total invested",  v: fmtINR(totalInvested) },
                  { l: "Current value",   v: fmtINR(totalValue) },
                  { l: "Total gain",      v: fmtINR(totalGain),     c: totalGain >= 0 ? "#86efac" : "#fca5a5" },
                  { l: "Overall return",  v: fmtPct(totalPct),       c: totalPct >= 0  ? "#86efac" : "#fca5a5" },
                  { l: "Blended XIRR",   v: blendedXIRR != null ? fmtPct(blendedXIRR * 100) : "—",
                    c: (blendedXIRR ?? 0) >= 0 ? "#86efac" : "#fca5a5" },
                ].map(({ l, v, c }) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "DM Mono, monospace", color: c || "#fff" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 10, fontSize: 11, opacity: 0.75 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 16, height: 2, background: "rgba(255,255,255,0.9)", display: "inline-block" }} />
                    Portfolio value
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 16, borderTop: "2px dashed rgba(255,255,255,0.45)", display: "inline-block" }} />
                    Amount invested
                  </span>
                  {slots.map((s, i) => s.scheme && results[i] ? (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 16, height: 2, background: SLOT_COLORS[i], opacity: 0.8, display: "inline-block" }} />
                      {s.scheme.name.split(" ").slice(0, 3).join(" ")}
                    </span>
                  ) : null)}
                </div>
                <GrowthChart slots={slots} results={results} />
              </div>
            </div>

            {/* ── Allocation breakdown table ── */}
            <div style={{
              background: "#fff", borderRadius: 12,
              border: "1px solid rgba(99,91,255,0.12)", padding: "20px 24px",
            }}>
              <div style={{
                fontFamily: "Bebas Neue, sans-serif", fontSize: 18,
                color: "#635bff", letterSpacing: "0.04em", marginBottom: 16,
              }}>Allocation Breakdown</div>

              {/* Stacked allocation bar */}
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 8, marginBottom: 16 }}>
                {slots.map((s, i) => {
                  const r = results[i];
                  if (!s.scheme || !r || !totalValue) return null;
                  return <div key={i} style={{ width: `${(r.currentValue / totalValue) * 100}%`, background: SLOT_COLORS[i], transition: "width 0.4s" }} />;
                })}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(99,91,255,0.1)" }}>
                      {["", "Scheme", "Mode", "Invested", "Value", "Gain", "Return", "XIRR", "Weight"].map(h => (
                        <th key={h} style={{
                          padding: "6px 10px", textAlign: h === "Scheme" ? "left" : "right",
                          color: "#8b8fa8", fontWeight: 500, whiteSpace: "nowrap",
                          ...(h === "" ? { width: 36 } : {}),
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s, i) => {
                      const r = results[i];
                      if (!s.scheme || !r) return null;
                      const wt = totalValue > 0 ? (r.currentValue / totalValue) * 100 : 0;
                      const modeLabel = MODES[s.mode].label;
                      return (
                        <tr key={i}
                          style={{ borderBottom: "1px solid rgba(99,91,255,0.07)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f5f4ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <td style={{ padding: "10px 10px 10px 6px", textAlign: "center" }}>
                            <span style={{
                              width: 20, height: 20, borderRadius: "50%", display: "inline-flex",
                              alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                              background: SLOT_COLORS[i] + "20", color: SLOT_COLORS[i],
                              border: `1.5px solid ${SLOT_COLORS[i]}`,
                            }}>{i + 1}</span>
                          </td>
                          <td style={{ padding: "10px", maxWidth: 200 }}>
                            <div style={{ fontWeight: 600, color: "#1a1a2e", fontSize: 12, lineHeight: 1.3 }}>{s.scheme.name}</div>
                            <div style={{ color: "#8b8fa8", fontSize: 10, marginTop: 2 }}>{s.scheme.amc} · {s.scheme.category}</div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right" }}>
                            <span style={{
                              fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                              background: "rgba(99,91,255,0.1)", color: "#635bff",
                            }}>{modeLabel}</span>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{fmtINR(r.totalInvested)}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600 }}>{fmtINR(r.currentValue)}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", color: r.gain >= 0 ? "#10b981" : "#ef4444" }}>{fmtINR(r.gain)}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", color: r.pctRet >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(r.pctRet)}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600, color: (r.xirr ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
                            {r.xirr != null ? fmtPct(r.xirr * 100) : "—"}
                          </td>
                          <td style={{ padding: "10px", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(99,91,255,0.1)", overflow: "hidden" }}>
                                <div style={{ width: `${wt}%`, height: "100%", background: SLOT_COLORS[i], transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#8b8fa8", minWidth: 36 }}>{wt.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals */}
                    <tr style={{ background: "rgba(99,91,255,0.04)", borderTop: "2px solid rgba(99,91,255,0.18)" }}>
                      <td />
                      <td style={{ padding: "10px", fontWeight: 700, color: "#635bff", fontSize: 12 }}>BASKET TOTAL</td>
                      <td />
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700 }}>{fmtINR(totalInvested)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700 }}>{fmtINR(totalValue)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700, color: totalGain >= 0 ? "#10b981" : "#ef4444" }}>{fmtINR(totalGain)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700, color: totalPct >= 0 ? "#10b981" : "#ef4444" }}>{fmtPct(totalPct)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700, color: (blendedXIRR ?? 0) >= 0 ? "#10b981" : "#ef4444" }}>
                        {blendedXIRR != null ? fmtPct(blendedXIRR * 100) : "—"}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontSize: 11, color: "#8b8fa8" }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 11, color: "#8b8fa8", marginTop: 20 }}>
          Source:{" "}
          <a href="https://www.amfiindia.com" target="_blank" rel="noopener noreferrer" style={{ color: "#8b8fa8" }}>
            AMFI India (amfiindia.com)
          </a>
          {" · "}NAV updated daily · XIRR = annualised return on actual cashflows
        </div>

      </div>
    </div>
  );
}
