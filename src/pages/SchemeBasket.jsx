import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SCHEMES_URL =
  "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";
const NAV_GIST_ID = "6f82d116b7067a8d13aa620e99aa783f";
const NAV_BASE    = `https://gist.githubusercontent.com/anjaneyakg/${NAV_GIST_ID}/raw`;
const PLAN_KEY    = "fundlens_plan_universe";
const STALE_DAYS  = 5;
const MAX_SLOTS   = 5;
const SLOT_COLORS = ["#635bff", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];
const MODES       = { sip: "SIP", lumpsum: "Lumpsum", both: "Both" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStoredPlan = () => localStorage.getItem(PLAN_KEY) || "Direct";

// Growth detection — mirrors pipeline is_growth() exclusion logic.
// Excludes IDCW/dividend/bonus keywords from the full name.
// "Bare dividend" allowed (preserves Dividend Yield Growth schemes).
const IDCW_KEYWORDS = ["idcw", "dividend payout", "dividend reinvestment", "payout", "reinvestment", "bonus"];
function isGrowth(s) {
  const raw = (s.navName || s.name || "").toLowerCase();
  return !IDCW_KEYWORDS.some(kw => raw.includes(kw));
}

function isActive(s) { return s.nav > 0; }

function isStale(navDate) {
  if (!navDate) return true;
  return (Date.now() - new Date(navDate).getTime()) / 86400000 > STALE_DAYS;
}

function slugify(cat) {
  return (cat || "other")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function navUrl(category, plan) {
  return `${NAV_BASE}/nav_${slugify(category)}_${(plan || "direct").toLowerCase()}.json`;
}

function fmtINR(v) {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v), sg = v < 0 ? "-" : "";
  if (a >= 10000000) return `${sg}₹${(a / 10000000).toFixed(2)} Cr`;
  if (a >= 100000)   return `${sg}₹${(a / 100000).toFixed(2)} L`;
  if (a >= 1000)     return `${sg}₹${(a / 1000).toFixed(1)} k`;
  return `${sg}₹${Math.round(a).toLocaleString("en-IN")}`;
}

function fmtPct(v, dp = 2) {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${Number(v).toFixed(dp)}%`;
}

function fmtD(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function todayStr()      { return new Date().toISOString().slice(0, 10); }
function monthsAgo(n)    { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); }
function yearsAgoDate(n) { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); }

// ─── XIRR (Newton-Raphson) ────────────────────────────────────────────────────
function calcXIRR(cfs, dates) {
  if (!cfs?.length || cfs.length < 2) return null;
  const t0  = dates[0].getTime();
  const yrs = dates.map(d => (d.getTime() - t0) / (365.25 * 86400000));
  const f   = r => cfs.reduce((s, c, i) => s + c / Math.pow(1 + r, yrs[i]), 0);
  const df  = r => cfs.reduce((s, c, i) => s - yrs[i] * c / Math.pow(1 + r, yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 120; i++) {
    const dv = df(r);
    if (Math.abs(dv) < 1e-12) break;
    const nr = r - f(r) / dv;
    if (Math.abs(nr - r) < 1e-8) return isFinite(nr) ? nr : null;
    r = Math.max(nr, -0.9999);
  }
  return null;
}

// Binary search: latest NAV entry with date ≤ targetStr
function navOnOrBefore(sorted, targetStr) {
  const tms = new Date(targetStr).getTime();
  let lo = 0, hi = sorted.length - 1, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const dms = new Date(sorted[mid].date).getTime();
    if (dms <= tms) { best = sorted[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

// ─── Core computation ─────────────────────────────────────────────────────────
// Primary result: performance as-of obsDate (or latest if not set)
// Footnote: latest NAV value + date (when obsDate is set and differs from latest)
function computeSlot(navHistory, slot, sipStartStr, lsDateStr, obsDateStr) {
  if (!navHistory?.length) return null;
  const sorted      = [...navHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstEntry  = sorted[0];
  const lastEntry   = sorted[sorted.length - 1];
  const endEntry    = obsDateStr ? (navOnOrBefore(sorted, obsDateStr) || lastEntry) : lastEntry;
  const endDate     = new Date(endEntry.date);
  const endNav      = endEntry.nav;

  let sipRes = null, lsRes = null;

  // ── SIP ──────────────────────────────────────────────────────────────────
  if (slot.mode === "sip" || slot.mode === "both") {
    const rawStart     = sipStartStr ? new Date(sipStartStr + "-01") : new Date(firstEntry.date);
    const clampedStart = rawStart < new Date(firstEntry.date) ? new Date(firstEntry.date) : rawStart;
    const startedLate  = rawStart < new Date(firstEntry.date);
    const cfs = [], cfDates = [], curve = [];
    let units = 0, invested = 0;

    const cur = new Date(clampedStart.getFullYear(), clampedStart.getMonth(), 1);
    while (cur <= endDate) {
      const e = navOnOrBefore(sorted, cur.toISOString().slice(0, 10));
      if (e && new Date(e.date) <= endDate) {
        const u = slot.sipAmount / e.nav;
        units += u; invested += slot.sipAmount;
        cfs.push(-slot.sipAmount);
        cfDates.push(new Date(e.date));
        curve.push({ date: e.date, invested, value: units * endNav });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    if (cfs.length) {
      const value = units * endNav;
      sipRes = {
        totalInvested: invested, currentValue: value,
        gain: value - invested, pctRet: ((value - invested) / invested) * 100,
        xirr: calcXIRR([...cfs, value], [...cfDates, endDate]),
        months: cfs.length, curve,
        startedLate, adjustedStart: clampedStart.toISOString().slice(0, 7),
      };
    }
  }

  // ── Lumpsum ───────────────────────────────────────────────────────────────
  if (slot.mode === "lumpsum" || slot.mode === "both") {
    const rawLsDate  = lsDateStr || firstEntry.date;
    const lsEntry    = navOnOrBefore(sorted, rawLsDate) || firstEntry;
    const lsDateAdj  = lsEntry.date !== rawLsDate;
    if (new Date(lsEntry.date) <= endDate) {
      const u = slot.lsAmount / lsEntry.nav;
      const value = u * endNav;
      const gain  = value - slot.lsAmount;
      const lsDt  = new Date(lsEntry.date);
      const curve = [];
      const cur2  = new Date(lsDt.getFullYear(), lsDt.getMonth(), 1);
      while (cur2 <= endDate) {
        const e = navOnOrBefore(sorted, cur2.toISOString().slice(0, 10));
        if (e && new Date(e.date) <= endDate)
          curve.push({ date: e.date, invested: slot.lsAmount, value: u * e.nav });
        cur2.setMonth(cur2.getMonth() + 1);
      }
      lsRes = {
        totalInvested: slot.lsAmount, currentValue: value,
        gain, pctRet: (gain / slot.lsAmount) * 100,
        xirr: calcXIRR([-slot.lsAmount, value], [lsDt, endDate]),
        investDate: lsEntry.date, curve,
        lsDateAdj, adjustedLsDate: lsEntry.date,
      };
    }
  }

  // ── Combine ───────────────────────────────────────────────────────────────
  let primary = null;
  if (!sipRes && !lsRes) return null;
  if (!sipRes) primary = lsRes;
  else if (!lsRes) primary = sipRes;
  else {
    const totalInvested = sipRes.totalInvested + lsRes.totalInvested;
    const currentValue  = sipRes.currentValue  + lsRes.currentValue;
    const gain          = currentValue - totalInvested;
    const dateMap = {};
    [sipRes, lsRes].forEach(r => r.curve.forEach(p => {
      if (!dateMap[p.date]) dateMap[p.date] = { invested: 0, value: 0 };
      dateMap[p.date].invested += p.invested;
      dateMap[p.date].value    += p.value;
    }));
    const curve = Object.entries(dateMap)
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, { invested, value }]) => ({ date, invested, value }));
    const xirr = (sipRes.xirr != null && lsRes.xirr != null)
      ? (sipRes.xirr * sipRes.totalInvested + lsRes.xirr * lsRes.totalInvested) / totalInvested
      : sipRes.xirr ?? lsRes.xirr;
    primary = {
      totalInvested, currentValue, gain,
      pctRet: (gain / totalInvested) * 100,
      xirr, curve,
      startedLate: sipRes.startedLate, adjustedStart: sipRes.adjustedStart,
      lsDateAdj: lsRes.lsDateAdj, adjustedLsDate: lsRes.adjustedLsDate,
    };
  }

  // ── Latest footnote (only when obsDate differs from last available NAV) ──
  let latestFootnote = null;
  if (obsDateStr && endEntry.date !== lastEntry.date) {
    // Just need the final portfolio value at latest NAV — fast calc without full curve
    let latestValue = 0;
    if (sipRes) {
      // Recompute units held as of endDate, mark to lastEntry.nav
      let units = 0;
      const cur = new Date(
        (sipRes.adjustedStart || sipStartStr || firstEntry.date.slice(0, 7)) + "-01"
      );
      while (cur <= endDate) {
        const e = navOnOrBefore(sorted, cur.toISOString().slice(0, 10));
        if (e && new Date(e.date) <= endDate) units += slot.sipAmount / e.nav;
        cur.setMonth(cur.getMonth() + 1);
      }
      latestValue += units * lastEntry.nav;
    }
    if (lsRes) {
      const lsEntry = navOnOrBefore(sorted, lsDateStr || firstEntry.date) || firstEntry;
      latestValue  += (slot.lsAmount / lsEntry.nav) * lastEntry.nav;
    }
    latestFootnote = { value: latestValue, date: lastEntry.date };
  }

  return {
    ...primary,
    obsDate:        endEntry.date,
    firstNavDate:   firstEntry.date,
    lastNavDate:    lastEntry.date,
    latestFootnote,
  };
}

// ─── Growth Chart (Canvas) ────────────────────────────────────────────────────
function GrowthChart({ slots, results, obsDate }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const active = slots
      .map((s, i) => s.scheme && results[i] ? { curve: results[i].curve, color: SLOT_COLORS[i] } : null)
      .filter(Boolean);
    if (!active.length) return;

    const pad = { top: 14, right: 16, bottom: 36, left: 68 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;

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

    const yMax = Math.max(...blended.map(p => Math.max(p.value, p.invested))) * 1.06;
    const xS = i => pad.left + (i / (allDates.length - 1)) * cW;
    const yS = v => pad.top + cH - (v / yMax) * cH;

    // Grid + Y labels — white-toned for dark purple background
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px 'DM Mono',monospace"; ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i, v = yMax * (1 - i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      const lbl = v >= 10000000 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 100000 ? `₹${(v/1e5).toFixed(0)}L` : `₹${(v/1000).toFixed(0)}k`;
      ctx.fillText(lbl, pad.left - 5, y + 3);
    }

    // X labels
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.5)";
    const step = Math.ceil(allDates.length / 6);
    allDates.forEach((d, i) => {
      if (i % step === 0 || i === allDates.length - 1) {
        const dt = new Date(d);
        ctx.fillText(`${dt.toLocaleString("en-IN", { month: "short" })} ${dt.getFullYear()}`, xS(i), pad.top + cH + 18);
      }
    });

    // Observation date marker
    if (obsDate) {
      const oi = allDates.findIndex(d => d >= obsDate);
      if (oi >= 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(xS(oi), pad.top + 8); ctx.lineTo(xS(oi), pad.top + cH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "9px 'DM Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText("obs ▼", xS(oi), pad.top + 6);
      }
    }

    // Individual scheme lines (when > 1)
    if (active.length > 1) {
      active.forEach(({ curve, color }) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.55; ctx.setLineDash([]);
        ctx.beginPath();
        curve.forEach((p, ii) => {
          const di = allDates.indexOf(p.date); if (di < 0) return;
          ii === 0 ? ctx.moveTo(xS(di), yS(p.value)) : ctx.lineTo(xS(di), yS(p.value));
        });
        ctx.stroke(); ctx.globalAlpha = 1;
      });
    }

    // Invested (dashed white)
    ctx.setLineDash([4, 3]); ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    blended.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p.invested)) : ctx.lineTo(xS(i), yS(p.invested)));
    ctx.stroke(); ctx.setLineDash([]);

    // Portfolio value — fill + solid white line
    ctx.beginPath();
    blended.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p.value)) : ctx.lineTo(xS(i), yS(p.value)));
    ctx.lineTo(xS(blended.length - 1), pad.top + cH); ctx.lineTo(xS(0), pad.top + cH); ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, "rgba(255,255,255,0.2)"); grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    blended.forEach((p, i) => i === 0 ? ctx.moveTo(xS(i), yS(p.value)) : ctx.lineTo(xS(i), yS(p.value)));
    ctx.stroke();
  }, [slots, results, obsDate]);

  return (
    <div style={{ width: "100%", height: 220 }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

// ─── Breakdown Bar Chart (per-scheme stacked grouped bars) ───────────────────
// Two bars per scheme: Invested | Value — each stacked SIP (bottom) + Lumpsum (top)
// XIRR label floats above Value bar. Renders on white background (outside summary card).
function BreakdownChart({ slots, results }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const active = slots
      .map((s, i) => {
        const r = results[i]; if (!s.scheme || !r) return null;
        // SIP and lumpsum breakdowns
        const sipInv  = r.sipPart?.totalInvested  ?? (s.mode === "sip"  ? r.totalInvested : 0);
        const sipVal  = r.sipPart?.currentValue   ?? (s.mode === "sip"  ? r.currentValue  : 0);
        const lsInv   = r.lsPart?.totalInvested   ?? (s.mode === "lumpsum" ? r.totalInvested : 0);
        const lsVal   = r.lsPart?.currentValue    ?? (s.mode === "lumpsum" ? r.currentValue  : 0);
        // For "both" mode where parts may not exist (single-mode fallback)
        const totalInv = r.totalInvested;
        const totalVal = r.currentValue;
        return {
          label: s.scheme.name.split(" ").slice(0, 3).join(" "),
          color: SLOT_COLORS[i],
          sipInv:  s.mode === "both" ? sipInv  : (s.mode === "sip" ? totalInv : 0),
          lsInv:   s.mode === "both" ? lsInv   : (s.mode === "lumpsum" ? totalInv : 0),
          sipVal:  s.mode === "both" ? sipVal  : (s.mode === "sip" ? totalVal : 0),
          lsVal:   s.mode === "both" ? lsVal   : (s.mode === "lumpsum" ? totalVal : 0),
          xirr:    r.xirr,
        };
      })
      .filter(Boolean);

    if (!active.length) return;

    const pad    = { top: 36, right: 16, bottom: 52, left: 68 };
    const cW     = W - pad.left - pad.right;
    const cH     = H - pad.top - pad.bottom;
    const n      = active.length;
    const groupW = cW / n;
    const barW   = Math.min(groupW * 0.28, 36);
    const gap    = Math.min(groupW * 0.06, 8);

    const yMax = Math.max(...active.map(d => Math.max(d.sipInv + d.lsInv, d.sipVal + d.lsVal))) * 1.15;
    const yS   = v => pad.top + cH - (v / yMax) * cH;

    // Grid lines + Y labels
    ctx.strokeStyle = "rgba(99,91,255,0.07)"; ctx.lineWidth = 0.5;
    ctx.fillStyle = "#8b8fa8"; ctx.font = "10px 'DM Mono',monospace"; ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (cH / 4) * i, v = yMax * (1 - i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      const lbl = v >= 10000000 ? `₹${(v/1e7).toFixed(1)}Cr` : v >= 100000 ? `₹${(v/1e5).toFixed(0)}L` : `₹${(v/1000).toFixed(0)}k`;
      ctx.fillText(lbl, pad.left - 5, y + 3);
    }

    active.forEach((d, gi) => {
      const gx    = pad.left + gi * groupW + groupW / 2;
      const invX  = gx - gap / 2 - barW;
      const valX  = gx + gap / 2;

      // ── Invested bar (SIP bottom + LS top, muted color) ──────────────────
      const invTotal = d.sipInv + d.lsInv;
      if (invTotal > 0) {
        // SIP segment
        if (d.sipInv > 0) {
          const bh = (d.sipInv / yMax) * cH;
          ctx.fillStyle = d.color + "55"; // 33% opacity
          ctx.fillRect(invX, yS(d.sipInv), barW, bh);
        }
        // Lumpsum segment on top
        if (d.lsInv > 0) {
          const sipH = (d.sipInv / yMax) * cH;
          const lsH  = (d.lsInv / yMax) * cH;
          ctx.fillStyle = d.color + "33"; // lighter
          ctx.fillRect(invX, yS(invTotal), barW, lsH);
          // Divider line between SIP and LS on invested bar
          if (d.sipInv > 0 && d.lsInv > 0) {
            ctx.strokeStyle = d.color + "60"; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
            ctx.beginPath(); ctx.moveTo(invX, yS(d.sipInv)); ctx.lineTo(invX + barW, yS(d.sipInv)); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        // "Invested" label below
        ctx.fillStyle = "#8b8fa8"; ctx.font = "9px 'DM Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText("Inv", invX + barW / 2, pad.top + cH + 14);
      }

      // ── Value bar (SIP bottom + LS top, full color) ────────────────────
      const valTotal = d.sipVal + d.lsVal;
      if (valTotal > 0) {
        // SIP segment
        if (d.sipVal > 0) {
          ctx.fillStyle = d.color + "cc"; // 80% opacity
          ctx.fillRect(valX, yS(d.sipVal), barW, (d.sipVal / yMax) * cH);
        }
        // Lumpsum segment on top
        if (d.lsVal > 0) {
          ctx.fillStyle = d.color; // full opacity
          ctx.fillRect(valX, yS(valTotal), barW, (d.lsVal / yMax) * cH);
          // Divider
          if (d.sipVal > 0 && d.lsVal > 0) {
            ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(valX, yS(d.sipVal)); ctx.lineTo(valX + barW, yS(d.sipVal)); ctx.stroke();
          }
        }
        // "Value" label below
        ctx.fillStyle = "#8b8fa8"; ctx.font = "9px 'DM Mono',monospace"; ctx.textAlign = "center";
        ctx.fillText("Val", valX + barW / 2, pad.top + cH + 14);

        // XIRR label above value bar
        if (d.xirr != null) {
          const xLabel = `${d.xirr >= 0 ? "+" : ""}${(d.xirr * 100).toFixed(1)}%`;
          ctx.fillStyle = d.color;
          ctx.font = "bold 10px 'DM Mono',monospace";
          ctx.textAlign = "center";
          ctx.fillText(xLabel, valX + barW / 2, yS(valTotal) - 5);
        }
      }

      // Scheme label below group
      ctx.fillStyle = "#1a1a2e"; ctx.font = "10px 'Syne',sans-serif"; ctx.textAlign = "center";
      // Truncate label to fit group width
      const maxChars = Math.floor(groupW / 6);
      const truncLabel = d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + "…" : d.label;
      ctx.fillText(truncLabel, gx, pad.top + cH + 30);
    });

    // Legend at top
    const legendItems = [
      { label: "SIP invested",  alpha: "55" },
      { label: "LS invested",   alpha: "33" },
      { label: "SIP value",     alpha: "cc" },
      { label: "LS value",      alpha: "ff" },
    ];
    // Use first active scheme's color for legend swatches
    const lc = active[0].color;
    let lx = pad.left;
    ctx.font = "9px 'Syne',sans-serif"; ctx.textAlign = "left";
    legendItems.forEach(({ label, alpha }) => {
      ctx.fillStyle = lc + alpha;
      ctx.fillRect(lx, 12, 10, 10);
      ctx.fillStyle = "#8b8fa8";
      ctx.fillText(label, lx + 13, 21);
      lx += ctx.measureText(label).width + 26;
    });
    ctx.fillStyle = "#635bff"; ctx.font = "bold 9px 'DM Mono',monospace";
    ctx.fillText("XIRR above value bar", lx, 21);

  }, [slots, results]);

  return (
    <div style={{ width: "100%", height: Math.max(200, 160 + slots.filter((s, i) => s.scheme && results[i]).length * 20) }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const IS = {
  width: "100%", boxSizing: "border-box", background: "#f8f8ff",
  border: "1px solid rgba(99,91,255,0.18)", borderRadius: 8,
  padding: "8px 12px", fontSize: 13, color: "#1a1a2e",
  fontFamily: "Syne, sans-serif", outline: "none",
};
const SS = {
  ...IS, appearance: "none", WebkitAppearance: "none", cursor: "pointer", paddingRight: 28,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238b8fa8'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
};
const Lbl = ({ children }) => (
  <div style={{ fontSize: 10, color: "#8b8fa8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
    {children}
  </div>
);

// ─── Metric cell (value + obs date footnote + optional latest footnote) ───────
function MetricCell({ label, value, obsDate, latestValue, latestDate, color, mono = true }) {
  const showFootnote = latestValue != null && latestDate && latestDate !== obsDate;
  return (
    <div>
      <div style={{ fontSize: 9, color: "#8b8fa8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || "#1a1a2e", fontFamily: mono ? "DM Mono, monospace" : "Syne, sans-serif" }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: "#8b8fa8", marginTop: 1 }}>
        as on {fmtD(obsDate)}
      </div>
      {showFootnote && (
        <div style={{ fontSize: 10, color: "#8b8fa8", marginTop: 3, paddingTop: 3, borderTop: "1px dashed rgba(99,91,255,0.15)" }}>
          {latestValue} <span style={{ fontSize: 9 }}>latest · {fmtD(latestDate)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Slot Card ────────────────────────────────────────────────────────────────
function SlotCard({ idx, slot, schemes, onUpdate, onRemove, canRemove, result }) {
  const color   = SLOT_COLORS[idx];
  const blurRef = useRef(null);
  const [query, setQuery] = useState(slot.scheme?.name || "");
  const [open,  setOpen]  = useState(false);
  useEffect(() => { if (!slot.scheme) setQuery(""); }, [slot.scheme]);

  // AMC list (all schemes)
  const amcs = useMemo(() => [...new Set(schemes.map(s => s.amc))].sort(), [schemes]);

  // Categories filtered by selected AMC
  const categories = useMemo(() => {
    const base = slot.amc ? schemes.filter(s => s.amc === slot.amc) : schemes;
    return [...new Set(base.map(s => s.category))].sort();
  }, [schemes, slot.amc]);

  // Scheme pool filtered by AMC + category
  const pool = useMemo(() =>
    schemes.filter(s =>
      (!slot.amc      || s.amc      === slot.amc) &&
      (!slot.category || s.category === slot.category)
    ), [schemes, slot.amc, slot.category]);

  const searchResults = useMemo(() => {
    if (!query.trim() || query.length < 2) return pool.slice(0, 8);
    const q = query.toLowerCase();
    return pool.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, pool]);

  const setAMC = v => { onUpdate("amc", v); onUpdate("category", ""); onUpdate("scheme", null); setQuery(""); };
  const setCat = v => { onUpdate("category", v); onUpdate("scheme", null); setQuery(""); };
  const pick   = s => { onUpdate("scheme", s); setQuery(s.name); setOpen(false); };

  const stale   = slot.scheme && isStale(slot.scheme.navDate);
  const showSIP = slot.mode === "sip"  || slot.mode === "both";
  const showLS  = slot.mode === "lumpsum" || slot.mode === "both";

  const warnings = [];
  if (result?.startedLate)
    warnings.push(`SIP start adjusted to ${fmtD(result.adjustedStart)} — no NAV available before that date.`);
  if (result?.lsDateAdj)
    warnings.push(`Lumpsum date adjusted to ${fmtD(result.adjustedLsDate)} — nearest available NAV used.`);

  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: `1px solid ${slot.scheme ? color + "35" : "rgba(99,91,255,0.12)"}`,
      borderLeft: `4px solid ${color}`, padding: "18px 20px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: color + "18",
          border: `1.5px solid ${color}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 11, fontWeight: 700, color,
          fontFamily: "DM Mono, monospace",
        }}>{idx + 1}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>
          Scheme {idx + 1}
          {slot.scheme && <span style={{ color: "#8b8fa8", fontWeight: 400, marginLeft: 6 }}>· {slot.scheme.amc}</span>}
        </span>
        {/* Mode toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {Object.entries(MODES).map(([key, label]) => (
            <button key={key} onClick={() => onUpdate("mode", key)} style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: "pointer", border: "1.5px solid",
              borderColor: slot.mode === key ? color : "rgba(99,91,255,0.2)",
              background:  slot.mode === key ? color + "15" : "transparent",
              color:       slot.mode === key ? color : "#8b8fa8",
              fontFamily: "Syne, sans-serif",
            }}>{label}</button>
          ))}
        </div>
        {canRemove && (
          <button onClick={onRemove} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#8b8fa8", fontSize: 20, lineHeight: 1, padding: 0, marginLeft: 4,
          }}>×</button>
        )}
      </div>

      {/* Alerts */}
      {stale && (
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, padding: "6px 12px", marginBottom: 10, fontSize: 11, color: "#92400e" }}>
          NAV last updated {fmtD(slot.scheme.navDate)} — scheme may be inactive or illiquid
        </div>
      )}
      {warnings.map((w, i) => (
        <div key={i} style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6, padding: "6px 12px", marginBottom: 8, fontSize: 11, color: "#1e40af" }}>
          {w}
        </div>
      ))}

      {/* AMC → Category → Scheme */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <Lbl>AMC</Lbl>
          <select value={slot.amc || ""} onChange={e => setAMC(e.target.value)} style={SS}>
            <option value="">All AMCs</option>
            {amcs.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <Lbl>Category {slot.amc && categories.length > 0 && <span style={{ color }}>· {categories.length}</span>}</Lbl>
          <select value={slot.category || ""} onChange={e => setCat(e.target.value)} style={SS}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Scheme search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Lbl>Scheme {pool.length > 0 && <span style={{ color }}>· {pool.length} available</span>}</Lbl>
        <input
          style={IS}
          placeholder="Type to search scheme…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (searchResults.length) setOpen(true); }}
          onBlur={() => { blurRef.current = setTimeout(() => setOpen(false), 200); }}
        />
        {open && searchResults.length > 0 && (
          <div style={{
            position: "absolute", zIndex: 999, top: "calc(100% + 2px)", left: 0, right: 0,
            background: "#fff", border: "1px solid rgba(99,91,255,0.2)",
            borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.09)",
            maxHeight: 220, overflowY: "auto",
          }}>
            {searchResults.map(s => (
              <div key={s.id}
                onMouseDown={e => { e.preventDefault(); clearTimeout(blurRef.current); pick(s); }}
                style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid rgba(99,91,255,0.07)" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f4ff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e" }}>{s.name}</div>
                <div style={{ fontSize: 10, color: "#8b8fa8", marginTop: 2 }}>
                  {s.amc} · {s.category} · NAV ₹{s.nav?.toFixed(2)} · {fmtD(s.navDate)}
                </div>
              </div>
            ))}
          </div>
        )}
        {slot.scheme && (
          <div style={{ fontSize: 10, color: "#8b8fa8", marginTop: 4, fontFamily: "DM Mono, monospace" }}>
            NAV ₹{slot.scheme.nav?.toFixed(4)} · {fmtD(slot.scheme.navDate)}
            {result && <span style={{ marginLeft: 8 }}>· data {fmtD(result.firstNavDate)} → {fmtD(result.lastNavDate)}</span>}
          </div>
        )}
      </div>

      {/* Amount inputs (conditional on mode) */}
      {slot.scheme && (
        <div style={{ display: "grid", gridTemplateColumns: showSIP && showLS ? "1fr 1fr" : "1fr", gap: 10 }}>
          {showSIP && (
            <div>
              <Lbl>Monthly SIP (₹)</Lbl>
              <input type="number" min="500" step="500" value={slot.sipAmount}
                onChange={e => onUpdate("sipAmount", Number(e.target.value))}
                style={{ ...IS, textAlign: "right", fontFamily: "DM Mono, monospace" }} />
            </div>
          )}
          {showLS && (
            <div>
              <Lbl>Lumpsum amount (₹)</Lbl>
              <input type="number" min="1000" step="1000" value={slot.lsAmount}
                onChange={e => onUpdate("lsAmount", Number(e.target.value))}
                style={{ ...IS, textAlign: "right", fontFamily: "DM Mono, monospace" }} />
            </div>
          )}
        </div>
      )}

      {/* Per-slot metrics */}
      {slot.scheme && result && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color}22`,
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 10,
        }}>
          {[
            { label: "Invested", value: fmtINR(result.totalInvested) },
            { label: "Value",    value: fmtINR(result.currentValue),
              latestValue: result.latestFootnote ? fmtINR(result.latestFootnote.value) : null,
              color: result.gain >= 0 ? "#10b981" : "#ef4444" },
            { label: "Gain",     value: fmtINR(result.gain),    color: result.gain   >= 0 ? "#10b981" : "#ef4444" },
            { label: "Return",   value: fmtPct(result.pctRet),  color: result.pctRet >= 0 ? "#10b981" : "#ef4444" },
            { label: "XIRR",     value: result.xirr != null ? fmtPct(result.xirr * 100) : "—",
              color: (result.xirr ?? 0) >= 0 ? "#10b981" : "#ef4444" },
          ].map(m => (
            <MetricCell key={m.label} label={m.label} value={m.value}
              obsDate={result.obsDate}
              latestValue={m.latestValue}
              latestDate={result.lastNavDate}
              color={m.color} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const makeSlot = () => ({ mode: "sip", scheme: null, amc: "", category: "", sipAmount: 5000, lsAmount: 50000 });

export default function SchemeBasket() {
  const [plan, setPlan]               = useState(getStoredPlan);
  const [allSchemes, setAllSchemes]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [slots, setSlots]             = useState([makeSlot(), makeSlot()]);
  const [sipStart, setSipStart]       = useState(monthsAgo(36));   // YYYY-MM
  const [lsDate, setLsDate]           = useState(yearsAgoDate(3)); // YYYY-MM-DD
  const [obsDate, setObsDate]         = useState("");              // "" = use latest
  const [navCache, setNavCache]       = useState({});
  const [navFetching, setNavFetching] = useState({});
  const [results, setResults]         = useState(Array(MAX_SLOTS).fill(null));
  const [computing, setComputing]     = useState(false);

  // Plan listener
  useEffect(() => {
    const h = () => setPlan(getStoredPlan());
    window.addEventListener("fundlens_plan_change", h);
    return () => window.removeEventListener("fundlens_plan_change", h);
  }, []);

  // Load schemes: Growth (navName suffix) + active + plan
  useEffect(() => {
    setLoading(true);
    fetch(SCHEMES_URL)
      .then(r => r.json())
      .then(d => {
        const filtered = (d.schemes || []).filter(s =>
          s.plan === plan && isActive(s) && isGrowth(s)
        );
        setAllSchemes(filtered);
      })
      .catch(() => setAllSchemes([]))
      .finally(() => setLoading(false));
  }, [plan]);

  // Fetch NAV file, cached by category|plan
  const fetchNav = useCallback(async scheme => {
    const key = `${scheme.category}|${scheme.plan}`;
    if (navCache[key]) return navCache[key];
    if (navFetching[key]) {
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 300));
        if (navCache[key]) return navCache[key];
      }
      return {};
    }
    setNavFetching(p => ({ ...p, [key]: true }));
    try {
      const data = await fetch(navUrl(scheme.category, scheme.plan)).then(r => r.json());
      setNavCache(p => ({ ...p, [key]: data }));
      return data;
    } catch {
      setNavCache(p => ({ ...p, [key]: {} }));
      return {};
    } finally {
      setNavFetching(p => ({ ...p, [key]: false }));
    }
  }, [navCache, navFetching]);

  // Compute all slots
  const runCompute = useCallback(async () => {
    if (!slots.some(s => s.scheme)) return;
    setComputing(true);
    const newResults = await Promise.all(slots.map(async slot => {
      if (!slot.scheme) return null;
      const navData    = await fetchNav(slot.scheme);
      const navHistory = navData[slot.scheme.id] || [];
      if (!navHistory.length) return null;
      return computeSlot(navHistory, slot, sipStart, lsDate, obsDate || null);
    }));
    setResults(newResults);
    setComputing(false);
  }, [slots, sipStart, lsDate, obsDate, fetchNav]);

  useEffect(() => {
    if (slots.some(s => s.scheme)) {
      const t = setTimeout(runCompute, 500);
      return () => clearTimeout(t);
    }
  }, [slots, sipStart, lsDate, obsDate]);

  const updateSlot = (idx, field, val) =>
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  // Portfolio aggregates (over primary obsDate results)
  const activeRes      = slots.map((_, i) => results[i]).filter(Boolean);
  const totalInvested  = activeRes.reduce((s, r) => s + r.totalInvested, 0);
  const totalValue     = activeRes.reduce((s, r) => s + r.currentValue,  0);
  const totalGain      = totalValue - totalInvested;
  const totalPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const blendedXIRR    = activeRes.length && totalInvested
    ? activeRes.reduce((s, r) => s + (r.xirr ?? 0) * r.totalInvested, 0) / totalInvested
    : null;
  // Latest footnote totals
  const totalLatestValue = activeRes.reduce((s, r) => s + (r.latestFootnote?.value ?? r.currentValue), 0);

  const hasResults = activeRes.length > 0;
  const showSIPDate = slots.some(s => s.mode === "sip"  || s.mode === "both");
  const showLSDate  = slots.some(s => s.mode === "lumpsum" || s.mode === "both");
  const primaryDate = activeRes[0]?.obsDate || obsDate || "";
  const latestNavDate = activeRes.reduce((best, r) => r.lastNavDate > best ? r.lastNavDate : best, "");
  const showFootnote  = !!obsDate && !!latestNavDate && primaryDate !== latestNavDate;

  return (
    <div style={{ fontFamily: "Syne, sans-serif", background: "#eef2ff", minHeight: "100vh", padding: "24px 16px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        select:focus, input:focus { border-color: rgba(99,91,255,0.5) !important; box-shadow: 0 0 0 3px rgba(99,91,255,0.1); outline: none; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "clamp(38px,6vw,54px)", letterSpacing: "0.04em", color: "#635bff", margin: 0, lineHeight: 1 }}>
              Scheme Basket
            </h1>
            <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "clamp(20px,3vw,28px)", color: "#8b8fa8", letterSpacing: "0.06em" }}>
              Performance · A6
            </span>
          </div>
          <p style={{ color: "#8b8fa8", fontSize: 13, margin: "8px 0 10px" }}>
            Up to 5 schemes · SIP, lumpsum, or both per slot · custom observation date · blended XIRR
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", background: "rgba(99,91,255,0.1)", borderRadius: 20, fontSize: 12, color: "#635bff", fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#635bff" }} />
            {plan} · Growth only · Active schemes
          </div>
        </div>

        {/* Date controls */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(99,91,255,0.12)", padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#8b8fa8", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Investment &amp; Observation Dates
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
            {showSIPDate && (
              <div style={{ flex: "1 1 150px" }}>
                <Lbl>SIP start month</Lbl>
                <input type="month" value={sipStart} max={new Date().toISOString().slice(0, 7)}
                  onChange={e => setSipStart(e.target.value)}
                  style={{ ...IS, fontFamily: "DM Mono, monospace" }} />
              </div>
            )}
            {showLSDate && (
              <div style={{ flex: "1 1 150px" }}>
                <Lbl>Lumpsum date</Lbl>
                <input type="date" value={lsDate} max={todayStr()}
                  onChange={e => setLsDate(e.target.value)}
                  style={{ ...IS, fontFamily: "DM Mono, monospace" }} />
              </div>
            )}
            <div style={{ flex: "1 1 170px" }}>
              <Lbl>
                Final observation date
                {!obsDate && <span style={{ color: "#635bff", marginLeft: 4 }}>· defaults to latest NAV</span>}
              </Lbl>
              <input type="date" value={obsDate} max={todayStr()}
                onChange={e => setObsDate(e.target.value)}
                style={{ ...IS, fontFamily: "DM Mono, monospace" }} />
              {obsDate && (
                <button onClick={() => setObsDate("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b8fa8", fontSize: 11, padding: "4px 0 0", textDecoration: "underline", display: "block" }}>
                  Clear — use latest NAV
                </button>
              )}
            </div>
          </div>
          {obsDate && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#6366f1", background: "rgba(99,91,255,0.06)", borderRadius: 6, padding: "6px 12px" }}>
              Output shows performance as on {fmtD(obsDate)}. Latest NAV value shown as footnote where it differs.
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 11, color: "#8b8fa8" }}>
            SIPs invest on 1st of each month · if a scheme has no NAV before start date, SIP begins at first available NAV
          </div>
        </div>

        {/* Slot cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
          {loading
            ? <div style={{ background: "#fff", borderRadius: 12, padding: 24, textAlign: "center", color: "#8b8fa8", fontSize: 13 }}>Loading schemes…</div>
            : slots.map((slot, idx) => (
                <SlotCard key={idx} idx={idx} slot={slot} schemes={allSchemes}
                  onUpdate={(f, v) => updateSlot(idx, f, v)}
                  onRemove={() => { setSlots(p => p.filter((_, i) => i !== idx)); setResults(p => p.filter((_, i) => i !== idx)); }}
                  canRemove={slots.length > 1}
                  result={results[idx]} />
              ))
          }
        </div>

        {/* Add slot */}
        {slots.length < MAX_SLOTS && (
          <button onClick={() => setSlots(p => [...p, makeSlot()])} style={{
            width: "100%", background: "rgba(99,91,255,0.05)", border: "1.5px dashed rgba(99,91,255,0.35)",
            borderRadius: 12, padding: "13px 20px", cursor: "pointer", color: "#635bff",
            fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            + Add scheme {slots.length + 1}
            <span style={{ fontSize: 11, color: "#8b8fa8", fontWeight: 400 }}>({MAX_SLOTS - slots.length} slots remaining)</span>
          </button>
        )}

        {/* Portfolio summary */}
        {hasResults && (
          <>
            <div style={{ background: "linear-gradient(130deg,#4f46e5,#635bff)", borderRadius: 16, padding: "24px 28px", marginBottom: 16, color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 20, letterSpacing: "0.06em", opacity: 0.9 }}>
                  Basket Portfolio Summary
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {computing ? "Updating…" : `As on ${fmtD(primaryDate)}`}
                </div>
              </div>

              {/* Summary metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 16, marginBottom: 20 }}>
                {[
                  { l: "Total invested",  v: fmtINR(totalInvested) },
                  { l: "Current value",   v: fmtINR(totalValue),    c: totalGain >= 0 ? "#86efac" : "#fca5a5",
                    fn: showFootnote ? fmtINR(totalLatestValue) : null },
                  { l: "Total gain",      v: fmtINR(totalGain),     c: totalGain >= 0 ? "#86efac" : "#fca5a5" },
                  { l: "Overall return",  v: fmtPct(totalPct),      c: totalPct  >= 0 ? "#86efac" : "#fca5a5" },
                  { l: "Blended XIRR",   v: blendedXIRR != null ? fmtPct(blendedXIRR * 100) : "—",
                    c: (blendedXIRR ?? 0) >= 0 ? "#86efac" : "#fca5a5" },
                ].map(({ l, v, c, fn }) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "DM Mono, monospace", color: c || "#fff" }}>{v}</div>
                    {fn && (
                      <div style={{ fontSize: 10, opacity: 0.65, marginTop: 3, paddingTop: 3, borderTop: "1px dashed rgba(255,255,255,0.25)" }}>
                        {fn} <span style={{ fontSize: 9 }}>latest · {fmtD(latestNavDate)}</span>
                      </div>
                    )}
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
                    <span style={{ width: 16, borderTop: "2px dashed rgba(255,255,255,0.4)", display: "inline-block" }} />
                    Invested
                  </span>
                  {obsDate && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 16, borderTop: "2px dashed rgba(255,255,255,0.7)", display: "inline-block" }} />
                      Obs date
                    </span>
                  )}
                  {slots.length > 1 && slots.map((s, i) => s.scheme && results[i] ? (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 16, height: 2, background: SLOT_COLORS[i], opacity: 0.8, display: "inline-block" }} />
                      <span>{s.scheme.name.split(" ").slice(0, 2).join(" ")}</span>
                    </span>
                  ) : null)}
                </div>
                <GrowthChart slots={slots} results={results} obsDate={obsDate} />
              </div>
            </div>

            {/* Breakdown table */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(99,91,255,0.12)", padding: "20px 24px" }}>
              <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 18, color: "#635bff", letterSpacing: "0.04em", marginBottom: 14 }}>
                Allocation Breakdown
                <span style={{ fontSize: 12, color: "#8b8fa8", fontFamily: "Syne, sans-serif", marginLeft: 8 }}>
                  as on {fmtD(primaryDate)}
                  {showFootnote && <span style={{ marginLeft: 4 }}>· latest NAV shown as footnote</span>}
                </span>
              </div>

              {/* Allocation bar */}
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 8, marginBottom: 16 }}>
                {slots.map((s, i) => {
                  const r = results[i];
                  if (!s.scheme || !r || !totalValue) return null;
                  return <div key={i} style={{ width: `${(r.currentValue / totalValue) * 100}%`, background: SLOT_COLORS[i], transition: "width 0.4s" }} />;
                })}
              </div>

              {/* Scheme breakdown bar chart */}
              <BreakdownChart slots={slots} results={results} />

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(99,91,255,0.1)" }}>
                      <th style={{ padding: "6px 8px", width: 32 }} />
                      <th style={{ padding: "6px 10px", textAlign: "left", color: "#8b8fa8", fontWeight: 500 }}>Scheme</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", color: "#8b8fa8", fontWeight: 500 }}>Mode</th>
                      {["Invested", "Value", "Gain", "Return", "XIRR", "Weight"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "right", color: "#8b8fa8", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s, i) => {
                      const r = results[i]; if (!s.scheme || !r) return null;
                      const wt = totalValue > 0 ? (r.currentValue / totalValue) * 100 : 0;
                      const gc = v => v >= 0 ? "#10b981" : "#ef4444";
                      const cell = (primary, footnote, c) => (
                        <div>
                          <span style={{ color: c }}>{primary}</span>
                          {footnote && (
                            <div style={{ fontSize: 10, color: c, opacity: 0.55, marginTop: 2, paddingTop: 2, borderTop: "1px dashed rgba(99,91,255,0.15)" }}>
                              {footnote} <span style={{ fontSize: 9, color: "#8b8fa8" }}>latest</span>
                            </div>
                          )}
                        </div>
                      );
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(99,91,255,0.07)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f5f4ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "10px 8px", textAlign: "center" }}>
                            <span style={{ width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, background: SLOT_COLORS[i] + "20", color: SLOT_COLORS[i], border: `1.5px solid ${SLOT_COLORS[i]}` }}>{i + 1}</span>
                          </td>
                          <td style={{ padding: "10px", maxWidth: 200 }}>
                            <div style={{ fontWeight: 600, color: "#1a1a2e", fontSize: 12, lineHeight: 1.3 }}>{s.scheme.name}</div>
                            <div style={{ color: "#8b8fa8", fontSize: 10, marginTop: 2 }}>{s.scheme.amc} · {s.scheme.category}</div>
                          </td>
                          <td style={{ padding: "10px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: "rgba(99,91,255,0.1)", color: "#635bff" }}>{MODES[s.mode]}</span>
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{fmtINR(r.totalInvested)}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600 }}>
                            {cell(fmtINR(r.currentValue), r.latestFootnote ? fmtINR(r.latestFootnote.value) : null, gc(r.gain))}
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{cell(fmtINR(r.gain), null, gc(r.gain))}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace" }}>{cell(fmtPct(r.pctRet), null, gc(r.pctRet))}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600 }}>{cell(r.xirr != null ? fmtPct(r.xirr * 100) : "—", null, gc(r.xirr ?? 0))}</td>
                          <td style={{ padding: "10px", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(99,91,255,0.1)", overflow: "hidden" }}>
                                <div style={{ width: `${wt}%`, height: "100%", background: SLOT_COLORS[i] }} />
                              </div>
                              <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#8b8fa8", minWidth: 36 }}>{wt.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Totals row */}
                    <tr style={{ background: "rgba(99,91,255,0.04)", borderTop: "2px solid rgba(99,91,255,0.18)" }}>
                      <td /><td style={{ padding: "10px", fontWeight: 700, color: "#635bff", fontSize: 12 }}>
                        BASKET TOTAL
                        <div style={{ fontSize: 10, color: "#8b8fa8", fontWeight: 400, marginTop: 1 }}>{fmtD(primaryDate)}</div>
                      </td><td />
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700 }}>{fmtINR(totalInvested)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 700 }}>
                        <div style={{ color: totalGain >= 0 ? "#10b981" : "#ef4444" }}>{fmtINR(totalValue)}</div>
                        {showFootnote && <div style={{ fontSize: 10, color: "#8b8fa8", marginTop: 2 }}>{fmtINR(totalLatestValue)} <span style={{ fontSize: 9 }}>latest</span></div>}
                      </td>
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
          {" · "}NAV updated daily · XIRR = annualised return on actual cashflows · Growth option only
        </div>
      </div>
    </div>
  );
}
