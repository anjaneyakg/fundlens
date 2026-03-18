// src/pages/CoverageDashboard.jsx
// Admin: Portfolio Coverage Dashboard
//
// Data sources:
//   Y (expected schemes) — AMFI NAV feed, deduped to Direct Growth plans only
//   X (uploaded schemes) — holdings_latest.csv, distinct scheme_name per AMC+month
//
// Both fetched fresh on load + on month change. No manual entry needed.

import { useState, useEffect, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const AMFI_NAV_URL  = "https://www.amfiindia.com/spages/NAVAll.txt";
const HOLDINGS_URL  = "https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/data/processed/holdings_latest.csv";

// AMC name normalisation — mirrors amfi_normalise.py logic
const AMC_ALIASES = {
  "Aditya Birla Sun Life AMC Limited":   "Aditya Birla Sun Life Mutual Fund",
  "Aditya Birla Sun Life":               "Aditya Birla Sun Life Mutual Fund",
  "HDFC Asset Management Company":       "HDFC Mutual Fund",
  "HDFC Mutual Fund":                    "HDFC Mutual Fund",
  "SBI Funds Management":                "SBI Mutual Fund",
  "UTI Asset Management":                "UTI Mutual Fund",
  "DSP Investment Managers":             "DSP Mutual Fund",
  "JM Financial Asset Management":       "JM Financial Mutual Fund",
  "Motilal Oswal Asset Management":      "Motilal Oswal Mutual Fund",
  "Motilal Owsal":                       "Motilal Oswal Mutual Fund",
  "Franklin Templeton Asset Management": "Franklin Templeton Mutual Fund",
  "Templeton India":                     "Franklin Templeton Mutual Fund",
  "PGIM India Asset Management":         "PGIM India Mutual Fund",
  "HSBC Asset Management":               "HSBC Mutual Fund",
  "LIC Mutual Fund Asset Management":    "LIC Mutual Fund",
  "360 ONE Asset Management":            "360 ONE Mutual Fund",
  "Angel One Asset Management":          "Angel One Mutual Fund",
  "ICICI Prudential Asset Management":   "ICICI Prudential Mutual Fund",
  "Nippon India":                        "Nippon India Mutual Fund",
  "Kotak Mahindra":                      "Kotak Mahindra Mutual Fund",
  "Trust Asset Management":              "Trust Mutual Fund",
  "Shriram Asset Management":            "Shriram Mutual Fund",
  "Taurus Asset Management":             "Taurus Mutual Fund",
  "Canara Robeco":                       "Canara Robeco Mutual Fund",
  "Bandhan":                             "Bandhan Mutual Fund",
  "Mirae Asset":                         "Mirae Asset Mutual Fund",
  "WhiteOak Capital":                    "WhiteOak Capital Mutual Fund",
  "Edelweiss":                           "Edelweiss Mutual Fund",
  "Helios":                              "Helios Mutual Fund",
  "Groww":                               "Groww Mutual Fund",
  "Navi":                                "Navi Mutual Fund",
  "NJ":                                  "NJ Mutual Fund",
  "PPFAS":                               "PPFAS Mutual Fund",
  "Quantum":                             "Quantum Mutual Fund",
  "quant":                               "quant Mutual Fund",
  "Samco":                               "Samco Mutual Fund",
  "Sundaram":                            "Sundaram Mutual Fund",
  "Tata":                                "Tata Mutual Fund",
  "Union":                               "Union Mutual Fund",
  "Unifi":                               "Unifi Mutual Fund",
  "Baroda BNP Paribas":                  "Baroda BNP Paribas Mutual Fund",
  "Invesco":                             "Invesco Mutual Fund",
  "Mahindra Manulife":                   "Mahindra Manulife Mutual Fund",
  "ITI":                                 "ITI Mutual Fund",
  "Bajaj Finserv":                       "Bajaj Finserv Mutual Fund",
  "Bank of India":                       "Bank of India Mutual Fund",
  "Axis":                                "Axis Mutual Fund",
  "BHARAT Bond":                         "Edelweiss Mutual Fund",
  "Capitalmind":                         "Capitalmind Mutual Fund",
  "Abakkus":                             "Abakkus Mutual Fund",
  "Old Bridge":                          "Old Bridge Mutual Fund",
  "Jio BlackRock":                       "Jio BlackRock Mutual Fund",
  "Choice":                              "Choice Mutual Fund",
  "The Wealth Company":                  "The Wealth Company Mutual Fund",
};

function normaliseAmc(raw) {
  if (!raw) return "Unknown";
  const s = raw.trim();
  if (AMC_ALIASES[s]) return AMC_ALIASES[s];
  for (const [alias, canonical] of Object.entries(AMC_ALIASES)) {
    if (s.startsWith(alias)) return canonical;
  }
  return s;
}

function isDirectGrowth(schemeName) {
  const n = schemeName.toLowerCase();
  const idcw = ["idcw", "dividend", "payout", "reinvestment", "bonus"];
  const isDirect = n.includes("direct");
  const isGrowth = !idcw.some(t => n.includes(t));
  return isDirect && isGrowth;
}

// ── AMFI parser ───────────────────────────────────────────────────────────────
function parseAmfiNav(text) {
  // Returns { amcName: Set<uniqueSchemeName> }
  const result = {};
  let currentAmc = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // AMC header line — no semicolons, not a scheme code line
    if (!line.includes(";") && line.length > 3 && !/^\d/.test(line)) {
      currentAmc = normaliseAmc(line);
      if (!result[currentAmc]) result[currentAmc] = new Set();
      continue;
    }

    // Scheme line: code;name;isin1;isin2;nav;repurchase;sale;date
    if (line.includes(";") && currentAmc) {
      const parts = line.split(";");
      if (parts.length < 2) continue;
      const schemeName = parts[1]?.trim();
      if (!schemeName) continue;

      // Only count Direct Growth — one portfolio per unique fund
      if (isDirectGrowth(schemeName)) {
        // Strip "Direct Plan - Growth" suffix to get base scheme name
        const base = schemeName
          .replace(/[-–]\s*(direct\s*plan\s*[-–]?\s*growth|direct\s*[-–]?\s*growth|direct\s*plan|direct)/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        result[currentAmc].add(base);
      }
    }
  }
  return result;
}

// ── CSV parser (minimal, no library) ─────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

// ── Status helpers ────────────────────────────────────────────────────────────
function getStatus(uploaded, expected) {
  if (!expected) return "unknown";
  if (uploaded === 0) return "none";
  if (uploaded >= expected) return "complete";
  if (uploaded / expected >= 0.8) return "high";
  return "partial";
}

const STATUS_CONFIG = {
  complete: { label: "Complete",  color: "#059669", bg: "#f0fdf4", border: "#a7f3d0", dot: "#10b981" },
  high:     { label: "Near done", color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  partial:  { label: "Partial",   color: "#dc2626", bg: "#fff5f5", border: "#fecaca", dot: "#ef4444" },
  none:     { label: "Not started",color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", dot: "#d1d5db" },
  unknown:  { label: "Unknown",   color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", dot: "#d1d5db" },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CoverageDashboard() {
  const months        = getMonthOptions();
  const [month, setMonth]           = useState(months[0].value);
  const [amfiData,  setAmfiData]    = useState(null);   // { amc: Set }
  const [holdings,  setHoldings]    = useState([]);     // parsed CSV rows
  const [loading,   setLoading]     = useState(true);
  const [error,     setError]       = useState("");
  const [filter,    setFilter]      = useState("all");  // all | complete | partial | none
  const [search,    setSearch]      = useState("");
  const [expanded,  setExpanded]    = useState(null);   // expanded AMC id

  // ── Fetch AMFI + holdings on mount ─────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.all([
      fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(AMFI_NAV_URL)}`)
        .then(r => r.text())
        .then(parseAmfiNav),
      fetch(HOLDINGS_URL)
        .then(r => r.text())
        .then(parseCsv),
    ])
      .then(([amfi, rows]) => {
        setAmfiData(amfi);
        setHoldings(rows);
        setLoading(false);
      })
      .catch(err => {
        setError("Failed to load data: " + err.message);
        setLoading(false);
      });
  }, []);

  // ── Compute coverage per AMC for selected month ────────────────────────────
  const coverage = useMemo(() => {
    if (!amfiData) return [];

    // Count distinct scheme_name per AMC in holdings for selected month
    const uploadedMap = {};
    const schemesByAmc = {};
    for (const row of holdings) {
      if (!row.portfolio_date?.startsWith(month)) continue;
      const amc = row.amc_name?.trim();
      if (!amc) continue;
      if (!uploadedMap[amc]) { uploadedMap[amc] = new Set(); schemesByAmc[amc] = []; }
      uploadedMap[amc].add(row.scheme_name?.trim());
      schemesByAmc[amc].push(row.scheme_name?.trim());
    }

    // Build coverage rows from AMFI master
    const rows = Object.entries(amfiData).map(([amc, expectedSet]) => {
      const expected = expectedSet.size;
      const uploaded = uploadedMap[amc]?.size ?? 0;
      const status   = getStatus(uploaded, expected);
      const schemes  = Array.from(expectedSet).sort();
      const uploadedSchemes = uploadedMap[amc] ? Array.from(uploadedMap[amc]).sort() : [];
      const missing  = schemes.filter(s => !uploadedSchemes.some(u =>
        u.toLowerCase().includes(s.toLowerCase().slice(0, 15))
      ));
      return { amc, expected, uploaded, status, schemes, uploadedSchemes, missing };
    });

    return rows.sort((a, b) => {
      const order = { none: 0, partial: 1, high: 2, complete: 3, unknown: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5) ||
             a.amc.localeCompare(b.amc);
    });
  }, [amfiData, holdings, month]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = coverage.length;
    const complete  = coverage.filter(r => r.status === "complete").length;
    const partial   = coverage.filter(r => r.status === "partial" || r.status === "high").length;
    const none      = coverage.filter(r => r.status === "none").length;
    const totalExp  = coverage.reduce((s, r) => s + r.expected, 0);
    const totalUpl  = coverage.reduce((s, r) => s + r.uploaded, 0);
    return { total, complete, partial, none, totalExp, totalUpl };
  }, [coverage]);

  // ── Filtered + searched rows ───────────────────────────────────────────────
  const visible = useMemo(() => {
    return coverage
      .filter(r => {
        if (filter === "complete") return r.status === "complete";
        if (filter === "partial")  return r.status === "partial" || r.status === "high";
        if (filter === "none")     return r.status === "none";
        return true;
      })
      .filter(r => !search || r.amc.toLowerCase().includes(search.toLowerCase()));
  }, [coverage, filter, search]);

  // ── Remaining download list ────────────────────────────────────────────────
  const remaining = useMemo(() =>
    coverage.filter(r => r.status !== "complete").map(r => r.amc),
    [coverage]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .cd-row { transition: background 0.12s; }
        .cd-row:hover { background: #f8faff !important; }
        .cd-row.expanded { background: #f5f3ff !important; }
        .cd-filter-btn { border:none; cursor:pointer; border-radius:20px; padding:5px 14px; font-size:12px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
        .cd-copy-btn { background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 14px; font-size:12px; color:#6b7280; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; }
        .cd-copy-btn:hover { border-color:#6366f1; color:#4f46e5; }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Coverage Dashboard</h1>
          <p style={s.subtitle}>
            Track portfolio upload progress across all 49 AMCs.
            Y = active schemes from AMFI NAV feed (Direct Growth only).
            X = schemes uploaded to FundInsight this month.
          </p>
        </div>
        {/* Month selector */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select
            style={s.monthSelect}
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <span style={s.selectArrow}>▾</span>
        </div>
      </div>

      {/* Error */}
      {error && <div style={s.errorBar}>{error}</div>}

      {/* Loading */}
      {loading && (
        <div style={s.loadingWrap}>
          <div style={s.loadingSpinner} />
          <span style={s.loadingText}>Loading AMFI NAV feed + holdings data…</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div style={s.statsRow}>
            {[
              { label: "AMCs complete",    value: stats.complete,  color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
              { label: "AMCs partial",     value: stats.partial,   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
              { label: "AMCs not started", value: stats.none,      color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
              { label: "Schemes uploaded", value: `${stats.totalUpl} / ${stats.totalExp}`, color: "#4f46e5", bg: "#f5f3ff", border: "#ddd6fe" },
            ].map((card) => (
              <div key={card.label} style={{ ...s.statCard, background: card.bg, borderColor: card.border }}>
                <div style={{ ...s.statValue, color: card.color }}>{card.value}</div>
                <div style={s.statLabel}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={s.progressWrap}>
            <div style={s.progressTrack}>
              <div style={{
                ...s.progressFill,
                width: stats.totalExp ? `${Math.min(100, (stats.totalUpl / stats.totalExp) * 100)}%` : "0%"
              }} />
            </div>
            <span style={s.progressLabel}>
              {stats.totalExp ? `${((stats.totalUpl / stats.totalExp) * 100).toFixed(1)}% of all schemes uploaded` : ""}
            </span>
          </div>

          {/* Filters + Search */}
          <div style={s.controlsRow}>
            <div style={s.filterGroup}>
              {[
                { key: "all",      label: `All (${stats.total})` },
                { key: "none",     label: `Not started (${stats.none})` },
                { key: "partial",  label: `Partial (${stats.partial})` },
                { key: "complete", label: `Complete (${stats.complete})` },
              ].map(f => (
                <button
                  key={f.key}
                  className="cd-filter-btn"
                  style={{
                    background: filter === f.key ? "#4f46e5" : "#f3f4f6",
                    color: filter === f.key ? "#fff" : "#6b7280",
                  }}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search AMC…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={s.searchInput}
            />
          </div>

          {/* Table */}
          <div style={s.tableWrap}>
            {/* Table header */}
            <div style={s.tableHeader}>
              <div style={{ flex: 3 }}>AMC</div>
              <div style={{ flex: 1, textAlign: "center" }}>Uploaded</div>
              <div style={{ flex: 1, textAlign: "center" }}>Expected</div>
              <div style={{ flex: 1, textAlign: "center" }}>Coverage</div>
              <div style={{ flex: 1, textAlign: "center" }}>Status</div>
              <div style={{ flex: 1, textAlign: "center" }}>Detail</div>
            </div>

            {visible.length === 0 && (
              <div style={s.emptyRow}>No AMCs match current filter.</div>
            )}

            {visible.map((row) => {
              const cfg  = STATUS_CONFIG[row.status];
              const pct  = row.expected ? Math.round((row.uploaded / row.expected) * 100) : 0;
              const isEx = expanded === row.amc;

              return (
                <div key={row.amc}>
                  <div
                    className={`cd-row ${isEx ? "expanded" : ""}`}
                    style={{ ...s.tableRow, background: isEx ? "#f5f3ff" : "#fff" }}
                  >
                    <div style={{ flex: 3, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...s.dot, background: cfg.dot }} />
                      <span style={s.amcName}>{row.amc}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", fontWeight: 600, color: "#374151" }}>
                      {row.uploaded}
                    </div>
                    <div style={{ flex: 1, textAlign: "center", color: "#6b7280" }}>
                      {row.expected}
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={s.miniTrack}>
                        <div style={{
                          ...s.miniFill,
                          width: `${pct}%`,
                          background: cfg.dot,
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{pct}%</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={{
                        ...s.statusPill,
                        color: cfg.color,
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                      }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <button
                        style={s.expandBtn}
                        onClick={() => setExpanded(isEx ? null : row.amc)}
                      >
                        {isEx ? "▲ Hide" : "▼ Schemes"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded scheme detail */}
                  {isEx && (
                    <div style={s.expandedPanel}>
                      <div style={s.expandedCols}>
                        {/* Missing schemes */}
                        <div style={s.expandedCol}>
                          <div style={s.expandedColTitle}>
                            ⚠ Missing / not yet uploaded ({row.missing.length})
                          </div>
                          {row.missing.length === 0
                            ? <div style={s.expandedNone}>All schemes accounted for ✓</div>
                            : row.missing.map(s => (
                                <div key={s} style={s.schemeChip}>{s}</div>
                              ))
                          }
                        </div>
                        {/* Uploaded schemes */}
                        <div style={s.expandedCol}>
                          <div style={{ ...s.expandedColTitle, color: "#059669" }}>
                            ✓ Uploaded ({row.uploadedSchemes.length})
                          </div>
                          {row.uploadedSchemes.length === 0
                            ? <div style={s.expandedNone}>None uploaded yet</div>
                            : row.uploadedSchemes.map(s => (
                                <div key={s} style={{ ...s.schemeChip, background: "#f0fdf4", color: "#047857", borderColor: "#a7f3d0" }}>{s}</div>
                              ))
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Remaining download list */}
          {remaining.length > 0 && (
            <div style={s.remainingCard}>
              <div style={s.remainingHeader}>
                <div>
                  <div style={s.remainingTitle}>📋 Remaining download list</div>
                  <div style={s.remainingSub}>
                    {remaining.length} AMCs still need portfolios for {months.find(m => m.value === month)?.label}
                  </div>
                </div>
                <button
                  className="cd-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(remaining.join("\n"));
                    alert("Copied to clipboard!");
                  }}
                >
                  Copy list
                </button>
              </div>
              <div style={s.remainingGrid}>
                {remaining.map((amc, i) => (
                  <div key={amc} style={s.remainingItem}>
                    <span style={s.remainingNum}>{i + 1}</span>
                    {amc}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:         { fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#111827", maxWidth: 1100 },
  header:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "1.75rem", paddingBottom: "1.5rem", borderBottom: "1px solid #e5e7eb" },
  title:        { fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 5px", letterSpacing: "-0.5px" },
  subtitle:     { fontSize: 12.5, color: "#6b7280", margin: 0, maxWidth: 600, lineHeight: 1.7 },
  monthSelect:  { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "9px 36px 9px 14px", fontSize: 13.5, fontWeight: 500, color: "#374151", fontFamily: "'Plus Jakarta Sans',sans-serif", appearance: "none", outline: "none", cursor: "pointer" },
  selectArrow:  { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af", pointerEvents: "none" },
  errorBar:     { background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626", marginBottom: 20 },
  loadingWrap:  { display: "flex", alignItems: "center", gap: 12, padding: "3rem 0", justifyContent: "center" },
  loadingSpinner: { width: 20, height: 20, border: "2.5px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 },
  loadingText:  { fontSize: 14, color: "#6b7280" },
  statsRow:     { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" },
  statCard:     { borderRadius: 12, border: "1.5px solid", padding: "14px 16px" },
  statValue:    { fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginBottom: 4 },
  statLabel:    { fontSize: 12, color: "#6b7280", fontWeight: 500 },
  progressWrap: { marginBottom: "1.5rem" },
  progressTrack:{ height: 6, background: "#f3f4f6", borderRadius: 6, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 6, transition: "width 0.6s ease" },
  progressLabel:{ fontSize: 12, color: "#9ca3af" },
  controlsRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: "1rem", flexWrap: "wrap" },
  filterGroup:  { display: "flex", gap: 6, flexWrap: "wrap" },
  searchInput:  { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "8px 14px", fontSize: 13.5, fontFamily: "'Plus Jakarta Sans',sans-serif", color: "#374151", outline: "none", minWidth: 200 },
  tableWrap:    { background: "#fff", border: "1px solid #f3f4f6", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 12px rgba(0,0,0,0.05)", marginBottom: "1.5rem" },
  tableHeader:  { display: "flex", alignItems: "center", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
  tableRow:     { display: "flex", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #f9fafb", cursor: "default" },
  emptyRow:     { padding: "2rem", textAlign: "center", color: "#9ca3af", fontSize: 14 },
  dot:          { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  amcName:      { fontSize: 13.5, fontWeight: 500, color: "#374151" },
  miniTrack:    { height: 4, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 3 },
  miniFill:     { height: "100%", borderRadius: 4, transition: "width 0.4s ease" },
  statusPill:   { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20 },
  expandBtn:    { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#6b7280", fontFamily: "'Plus Jakarta Sans',sans-serif", cursor: "pointer" },
  expandedPanel:{ background: "#fafbff", borderBottom: "1px solid #ede9fe", padding: "1rem 1.25rem 1.25rem" },
  expandedCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  expandedCol:  { },
  expandedColTitle: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#dc2626", marginBottom: 10 },
  expandedNone: { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  schemeChip:   { display: "inline-block", fontSize: 11, fontWeight: 500, background: "#fff5f5", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 8px", margin: "2px 3px 2px 0" },
  remainingCard:{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, padding: "1.25rem 1.5rem", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" },
  remainingHeader:{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" },
  remainingTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 3 },
  remainingSub: { fontSize: 12, color: "#6b7280" },
  remainingGrid:{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 },
  remainingItem:{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "#374151", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "7px 10px" },
  remainingNum: { fontSize: 10, fontWeight: 700, color: "#9ca3af", minWidth: 18 },
};
