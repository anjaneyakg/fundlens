// src/pages/CoverageDashboard.jsx
// Admin: Portfolio Coverage Dashboard
//
// Data sources:
//   Y (expected schemes) — /api/amfi?action=schemes (Vercel route → AMFI scheme master, server-side)
//   X (uploaded schemes) — holdings_latest.csv from FundInsight GitHub
//
// No CORS issues — AMFI is fetched server-side via the API route.

import { useState, useEffect, useMemo } from "react";
import { parseCsvLine } from "../utils/csvParser.js";

const HOLDINGS_URL = "/api/holdings-csv";

// RFC 4180-safe CSV parser using shared utility.
function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line).map(v => v.trim());
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

function getStatus(uploaded, expected) {
  if (!expected) return "unknown";
  if (uploaded === 0) return "none";
  if (uploaded >= expected) return "complete";
  if (uploaded / expected >= 0.8) return "high";
  return "partial";
}

const STATUS_CONFIG = {
  complete: { label: "Complete",    color: "#059669", bg: "#f0fdf4", border: "#a7f3d0", dot: "#10b981" },
  high:     { label: "Near done",   color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  partial:  { label: "Partial",     color: "#dc2626", bg: "#fff5f5", border: "#fecaca", dot: "#ef4444" },
  none:     { label: "Not started", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", dot: "#d1d5db" },
  unknown:  { label: "Unknown",     color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", dot: "#d1d5db" },
};

export default function CoverageDashboard() {
  const months = getMonthOptions();
  const [month,    setMonth]    = useState(months[0].value);
  const [amfiData, setAmfiData] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null);

  // ── Outlier state ──────────────────────────────────────────────────────────
  const [outliers,        setOutliers]        = useState([]);
  const [outliersLoading, setOutliersLoading] = useState(false);
  const [outliersError,   setOutliersError]   = useState("");
  const [resolvingId,     setResolvingId]     = useState(null);

  // ── Reconciler state ───────────────────────────────────────────────────────
  const [reconcilerRunning, setReconcilerRunning] = useState(false);
  const [reconcilerResult,  setReconcilerResult]  = useState(null);
  const [diagRunning,       setDiagRunning]        = useState(false);
  const [diagResult,        setDiagResult]         = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/amfi?action=schemes")
        .then(r => r.json())
        .then(d => { if (!d.ok) throw new Error(d.error || "AMFI fetch failed"); return d.amcs; }),
      fetch(HOLDINGS_URL).then(r => r.text()).then(parseCsv),
    ])
      .then(([amfi, rows]) => { setAmfiData(amfi); setHoldings(rows); setLoading(false); })
      .catch(err => { setError("Failed to load: " + err.message); setLoading(false); });
  }, []);

  // Load all pending outliers once on mount (not month-filtered — run_date ≠ portfolio month)
  useEffect(() => {
    setOutliersLoading(true);
    setOutliersError("");
    fetch("/api/amfi?action=parser-outliers")
      .then(r => r.json())
      .then(d => { setOutliers(d.outliers || []); setOutliersLoading(false); })
      .catch(err => { setOutliersError(err.message); setOutliersLoading(false); });
  }, []);

  async function resolveOutlier(id, status) {
    setResolvingId(id);
    try {
      const r = await fetch("/api/amfi?action=parser-outliers-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!r.ok) throw new Error("Resolve failed");
      setOutliers(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error("Resolve outlier error:", err);
    }
    setResolvingId(null);
  }

  async function runReconciler() {
    setReconcilerRunning(true);
    setReconcilerResult(null);
    try {
      // Extract distinct (amc_name, scheme_code_amc) pairs from the already-loaded holdings.
      // Sending these from the frontend avoids a 24 MB CSV download inside the serverless function.
      const seen = new Set();
      const codes = [];
      for (const h of holdings) {
        const key = `${h.amc_name}|||${h.scheme_code_amc}`;
        if (h.amc_name && h.scheme_code_amc && !seen.has(key)) {
          seen.add(key);
          codes.push({ amc_name: h.amc_name, scheme_code_amc: h.scheme_code_amc });
        }
      }
      const r = await fetch("/api/cell-c?action=run-reconciler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Reconciler failed");
      setReconcilerResult({ ok: true, stats: d.stats, elapsed_ms: d.elapsed_ms });
    } catch (err) {
      setReconcilerResult({ ok: false, error: err.message });
    }
    setReconcilerRunning(false);
  }

  async function runDiagnose() {
    setDiagRunning(true);
    setDiagResult(null);
    try {
      const seen = new Set();
      const codes = [];
      for (const h of holdings) {
        const key = `${h.amc_name}|||${h.scheme_code_amc}`;
        if (h.amc_name && h.scheme_code_amc && !seen.has(key)) {
          seen.add(key);
          codes.push({ amc_name: h.amc_name, scheme_code_amc: h.scheme_code_amc });
        }
      }
      const r = await fetch("/api/cell-c?action=dry-run-reconciler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Diagnose failed");
      setDiagResult({ ok: true, ...d });
    } catch (err) {
      setDiagResult({ ok: false, error: err.message });
    }
    setDiagRunning(false);
  }

  const coverage = useMemo(() => {
    if (!amfiData) return [];
    const uploadedMap = {};
    for (const row of holdings) {
      if (!row.portfolio_date?.startsWith(month)) continue;
      const amc = row.amc_name?.trim();
      if (!amc) continue;
      if (!uploadedMap[amc]) uploadedMap[amc] = new Set();
      uploadedMap[amc].add(row.scheme_name?.trim());
    }
    return Object.entries(amfiData)
      .map(([amc, expected]) => ({
        amc,
        expected,
        uploaded: uploadedMap[amc]?.size ?? 0,
        status:   getStatus(uploadedMap[amc]?.size ?? 0, expected),
        uploadedSchemes: uploadedMap[amc] ? Array.from(uploadedMap[amc]).sort() : [],
      }))
      .sort((a, b) => {
        const o = { none: 0, partial: 1, high: 2, complete: 3, unknown: 4 };
        return (o[a.status] ?? 5) - (o[b.status] ?? 5) || a.amc.localeCompare(b.amc);
      });
  }, [amfiData, holdings, month]);

  const stats = useMemo(() => ({
    total:    coverage.length,
    complete: coverage.filter(r => r.status === "complete").length,
    partial:  coverage.filter(r => r.status === "partial" || r.status === "high").length,
    none:     coverage.filter(r => r.status === "none").length,
    totalExp: coverage.reduce((s, r) => s + r.expected, 0),
    totalUpl: coverage.reduce((s, r) => s + r.uploaded, 0),
  }), [coverage]);

  const visible = useMemo(() => coverage
    .filter(r => filter === "all" || (filter === "complete" ? r.status === "complete" : filter === "partial" ? (r.status === "partial" || r.status === "high") : r.status === "none"))
    .filter(r => !search || r.amc.toLowerCase().includes(search.toLowerCase())),
    [coverage, filter, search]
  );

  const remaining = useMemo(() => coverage.filter(r => r.status !== "complete").map(r => r.amc), [coverage]);

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .cd-row:hover { background: #f8faff !important; }
        .cd-fb { border:none; cursor:pointer; border-radius:20px; padding:5px 14px; font-size:12px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.15s; }
      `}</style>

      <div style={s.header}>
        <div>
          <h1 style={s.title}>Coverage Dashboard</h1>
          <p style={s.subtitle}>Y = unique Direct Growth schemes from AMFI scheme master. X = schemes in holdings_latest.csv for selected month.</p>
        </div>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select style={s.monthSelect} value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <span style={s.selectArrow}>▾</span>
        </div>
      </div>

      {error && <div style={s.errorBar}>{error}</div>}

      {loading && (
        <div style={s.loadingWrap}>
          <div style={s.spinner} />
          <span style={s.loadingText}>Fetching AMFI scheme master + holdings…</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={s.statsRow}>
            {[
              { label: "AMCs complete",    value: stats.complete,  color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
              { label: "AMCs partial",     value: stats.partial,   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
              { label: "AMCs not started", value: stats.none,      color: "#dc2626", bg: "#fff5f5", border: "#fecaca" },
              { label: "Schemes uploaded", value: `${stats.totalUpl} / ${stats.totalExp}`, color: "#4f46e5", bg: "#f5f3ff", border: "#ddd6fe" },
            ].map(c => (
              <div key={c.label} style={{ ...s.statCard, background: c.bg, borderColor: c.border }}>
                <div style={{ ...s.statValue, color: c.color }}>{c.value}</div>
                <div style={s.statLabel}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={s.progressWrap}>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: stats.totalExp ? `${Math.min(100, (stats.totalUpl / stats.totalExp) * 100)}%` : "0%" }} />
            </div>
            <span style={s.progressLabel}>{stats.totalExp ? `${((stats.totalUpl / stats.totalExp) * 100).toFixed(1)}% of all schemes uploaded` : ""}</span>
          </div>

          <div style={s.controlsRow}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["all", `All (${stats.total})`], ["none", `Not started (${stats.none})`], ["partial", `Partial (${stats.partial})`], ["complete", `Complete (${stats.complete})`]].map(([k, l]) => (
                <button key={k} className="cd-fb"
                  style={{ background: filter === k ? "#4f46e5" : "#f3f4f6", color: filter === k ? "#fff" : "#6b7280" }}
                  onClick={() => setFilter(k)}>{l}</button>
              ))}
            </div>
            <input type="text" placeholder="Search AMC…" value={search} onChange={e => setSearch(e.target.value)} style={s.searchInput} />
          </div>

          <div style={s.tableWrap}>
            <div style={s.tableHeader}>
              <div style={{ flex: 3 }}>AMC</div>
              <div style={{ flex: 1, textAlign: "center" }}>Uploaded</div>
              <div style={{ flex: 1, textAlign: "center" }}>Expected</div>
              <div style={{ flex: 2, textAlign: "center" }}>Coverage</div>
              <div style={{ flex: 1, textAlign: "center" }}>Status</div>
              <div style={{ flex: 1, textAlign: "center" }}>Detail</div>
            </div>

            {visible.length === 0 && <div style={s.emptyRow}>No AMCs match current filter.</div>}

            {visible.map(row => {
              const cfg = STATUS_CONFIG[row.status];
              const pct = row.expected ? Math.round((row.uploaded / row.expected) * 100) : 0;
              const isEx = expanded === row.amc;
              return (
                <div key={row.amc}>
                  <div className="cd-row" style={{ ...s.tableRow, background: isEx ? "#f5f3ff" : "#fff" }}>
                    <div style={{ flex: 3, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...s.dot, background: cfg.dot }} />
                      <span style={s.amcName}>{row.amc}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", fontWeight: 600, color: "#374151" }}>{row.uploaded}</div>
                    <div style={{ flex: 1, textAlign: "center", color: "#6b7280" }}>{row.expected}</div>
                    <div style={{ flex: 2, textAlign: "center", padding: "0 12px" }}>
                      <div style={s.miniTrack}><div style={{ ...s.miniFill, width: `${pct}%`, background: cfg.dot }} /></div>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{pct}%</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ ...s.statusPill, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <button style={s.expandBtn} onClick={() => setExpanded(isEx ? null : row.amc)}>{isEx ? "▲ Hide" : "▼ Schemes"}</button>
                    </div>
                  </div>
                  {isEx && (
                    <div style={s.expandedPanel}>
                      <div style={s.expandedTitle}>✓ Uploaded ({row.uploadedSchemes.length})</div>
                      {row.uploadedSchemes.length === 0
                        ? <div style={s.expandedNone}>None uploaded yet for this month.</div>
                        : <div style={s.chipGrid}>{row.uploadedSchemes.map(sc => <span key={sc} style={s.chip}>{sc}</span>)}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {remaining.length > 0 && (
            <div style={s.remainingCard}>
              <div style={s.remainingHeader}>
                <div>
                  <div style={s.remainingTitle}>📋 Remaining download list</div>
                  <div style={s.remainingSub}>{remaining.length} AMCs still need portfolios for {months.find(m => m.value === month)?.label}</div>
                </div>
                <button style={s.copyBtn} onClick={() => { navigator.clipboard.writeText(remaining.join("\n")); alert("Copied!"); }}>Copy list</button>
              </div>
              <div style={s.remainingGrid}>
                {remaining.map((amc, i) => (
                  <div key={amc} style={s.remainingItem}><span style={s.remainingNum}>{i + 1}</span>{amc}</div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sheets Needing Review ── */}
          <div style={s.outlierCard}>
            <div style={s.outlierHeader}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={s.outlierTitle}>Sheets Needing Review</div>
                  {outliers.length > 0 && (
                    <span style={s.outlierBadge}>{outliers.length} pending</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 8,
                      border: "1.5px solid rgba(99,91,255,0.35)", background: reconcilerRunning ? "rgba(99,91,255,0.06)" : "rgba(99,91,255,0.04)",
                      color: reconcilerRunning ? "#9aa0c8" : "#635bff", cursor: reconcilerRunning ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s",
                    }}
                    onClick={runReconciler}
                    disabled={reconcilerRunning}
                  >
                    {reconcilerRunning && <div style={{ ...s.spinner, width: 12, height: 12, borderWidth: 2 }} />}
                    {reconcilerRunning ? "Running — this may take up to 30 seconds…" : "Run Scheme Code Reconciler"}
                  </button>
                  <button
                    style={{
                      fontSize: 11, fontWeight: 500, padding: "4px 12px", borderRadius: 7,
                      border: "1px dashed rgba(99,91,255,0.3)", background: "transparent",
                      color: (diagRunning || reconcilerRunning) ? "#9aa0c8" : "#635bff",
                      cursor: (diagRunning || reconcilerRunning) ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                    }}
                    onClick={runDiagnose}
                    disabled={diagRunning || reconcilerRunning}
                  >
                    {diagRunning && <div style={{ ...s.spinner, width: 10, height: 10, borderWidth: 2 }} />}
                    {diagRunning ? "Analysing scores…" : "Check Score Distribution (dry run)"}
                  </button>
                  {reconcilerResult && !reconcilerResult.ok && (
                    <div style={{ fontSize: 11, color: "#dc2626" }}>Error: {reconcilerResult.error}</div>
                  )}
                  {reconcilerResult?.ok && (
                    <div style={{ fontSize: 11, color: "#374151", textAlign: "right", lineHeight: 1.7 }}>
                      <strong style={{ color: "#16a34a" }}>{reconcilerResult.stats.auto_exact} exact</strong>
                      {" · "}
                      <strong style={{ color: "#b45309" }}>{reconcilerResult.stats.auto_fuzzy_pending} suggested</strong>
                      {" · "}
                      {reconcilerResult.stats.no_match} unmatched
                      {" · "}
                      <a href="/admin/scheme-mapping" style={{ color: "#635bff", textDecoration: "none", fontWeight: 600 }}>Review →</a>
                    </div>
                  )}
                </div>
              </div>
              <div style={s.outlierSub}>
                Parser outliers logged by <code style={s.code}>cell_4d_v2.py</code> — sheets that were not skip-listed and did not parse successfully.
                Resolving here updates status only; adding a sheet to the skip list in code is a separate manual step.
              </div>
            </div>

            {/* ── Diagnostic result (dry run) ── */}
            {diagResult && (
              <div style={{ borderTop: "1px solid rgba(99,91,255,0.08)", padding: "1rem 0 0.5rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Score Distribution — Dry Run</div>
                  <button onClick={() => setDiagResult(null)} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>
                    ✕ dismiss
                  </button>
                </div>
                {!diagResult.ok ? (
                  <div style={{ fontSize: 12, color: "#dc2626" }}>Error: {diagResult.error}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                      {diagResult.totals.distinct_codes} distinct codes · {diagResult.totals.already_mapped} already mapped · <strong>{diagResult.totals.to_process} to process</strong>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {[
                        { label: "95–100", val: diagResult.distribution.score_95_100, color: "#16a34a", bg: "rgba(22,163,74,0.07)" },
                        { label: "92–94",  val: diagResult.distribution.score_92_94,  color: "#d97706", bg: "rgba(217,119,6,0.07)" },
                        { label: "85–91 ⚠", val: diagResult.distribution.score_85_91, color: "#b45309", bg: "rgba(180,83,9,0.1)", bold: true },
                        { label: "70–84",  val: diagResult.distribution.score_70_84,  color: "#6b7280", bg: "rgba(107,114,128,0.07)" },
                        { label: "<70",    val: diagResult.distribution.below_70,     color: "#9ca3af", bg: "rgba(156,163,175,0.07)" },
                      ].map(b => (
                        <div key={b.label} style={{
                          padding: "3px 10px", borderRadius: 6,
                          background: b.bg, color: b.color,
                          fontSize: 12, fontWeight: b.bold ? 700 : 500,
                          border: b.bold ? `1px solid rgba(180,83,9,0.25)` : "1px solid transparent",
                        }}>
                          {b.label}: <strong>{b.val}</strong>
                        </div>
                      ))}
                    </div>
                    {diagResult.near_miss_amcs.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#16a34a" }}>✓ No near-misses — all codes either score ≥92 or clearly below 85</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#b45309", marginBottom: 6 }}>
                          {diagResult.near_miss_amcs.length} AMC{diagResult.near_miss_amcs.length > 1 ? "s" : ""} with near-misses (85–91, just under threshold):
                        </div>
                        {diagResult.near_miss_amcs.map(amc => (
                          <div key={amc.amc} style={{
                            marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                            background: "rgba(180,83,9,0.04)", border: "1px solid rgba(180,83,9,0.12)",
                          }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{amc.amc}</span>
                              <span style={{ fontSize: 11, color: "#16a34a" }}>{amc.codes_92_plus} pass (≥92)</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>{amc.codes_85_91} near-miss (85–91)</span>
                              {amc.codes_below_85 > 0 && <span style={{ fontSize: 11, color: "#9ca3af" }}>{amc.codes_below_85} below 85</span>}
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                              <thead>
                                <tr style={{ color: "#9ca3af" }}>
                                  <th style={{ textAlign: "left", fontWeight: 500, paddingBottom: 3 }}>scheme_code_amc</th>
                                  <th style={{ textAlign: "left", fontWeight: 500, paddingBottom: 3, paddingLeft: 8 }}>Best AMFI match (base name)</th>
                                  <th style={{ textAlign: "right", fontWeight: 500, paddingBottom: 3 }}>Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {amc.samples_85_91.map((s, i) => (
                                  <tr key={i} style={{ borderTop: "1px solid rgba(180,83,9,0.08)" }}>
                                    <td style={{ padding: "3px 0", color: "#374151", fontFamily: "monospace", fontSize: 10 }}>{s.code}</td>
                                    <td style={{ padding: "3px 8px", color: "#6b7280" }}>{s.best_match}</td>
                                    <td style={{ padding: "3px 0", textAlign: "right", color: "#b45309", fontWeight: 700 }}>{s.score}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </>
                    )}
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                      Would insert: {diagResult.totals.would_auto_exact} auto-exact + {diagResult.totals.would_fuzzy_pending} suggested · {diagResult.elapsed_ms}ms
                    </div>
                  </>
                )}
              </div>
            )}

            {outliersLoading && (
              <div style={{ padding: "1.5rem 0", color: "#9ca3af", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={s.spinner} />
                Loading outliers…
              </div>
            )}

            {outliersError && (
              <div style={{ ...s.errorBar, marginTop: 0 }}>Failed to load outliers: {outliersError}</div>
            )}

            {!outliersLoading && !outliersError && outliers.length === 0 && (
              <div style={s.outlierEmpty}>
                <span style={{ fontSize: 22, opacity: 0.4 }}>✓</span>
                <span>No pending outliers — all sheets reviewed</span>
              </div>
            )}

            {!outliersLoading && outliers.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <div style={s.outlierTableHead}>
                  <div style={{ flex: 2 }}>AMC</div>
                  <div style={{ flex: 1 }}>Sheet</div>
                  <div style={{ flex: 2 }}>Reason</div>
                  <div style={{ flex: 3, textAlign: "right" }}>Actions</div>
                </div>
                {outliers.map(o => {
                  const busy = resolvingId === o.id;
                  return (
                    <div key={o.id} style={s.outlierRow}>
                      <div style={{ flex: 2, fontWeight: 500, color: "#374151", fontSize: 13 }}>{o.amc_name}</div>
                      <div style={{ flex: 1, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>{o.sheet_name}</div>
                      <div style={{ flex: 2 }}>
                        <span style={{
                          ...s.reasonPill,
                          ...(o.reason === "no_column_headers"
                            ? { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }
                            : { background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }),
                        }}>
                          {o.reason}
                        </span>
                      </div>
                      <div style={{ flex: 3, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          style={{ ...s.actionBtn, ...s.actionIgnore }}
                          disabled={busy}
                          onClick={() => resolveOutlier(o.id, "ignored")}
                          title="Mark as reviewed — not expected to parse"
                        >
                          {busy ? "…" : "Ignore"}
                        </button>
                        <button
                          style={{ ...s.actionBtn, ...s.actionIndex }}
                          disabled={busy}
                          onClick={() => resolveOutlier(o.id, "index_sheet")}
                          title="Mark as index/summary sheet. Note: does NOT auto-add to cell_4d_v2.py skip list — that edit remains manual."
                        >
                          {busy ? "…" : "Index Sheet"}
                        </button>
                        <button
                          style={{ ...s.actionBtn, ...s.actionMap }}
                          disabled={busy}
                          onClick={async () => {
                            await resolveOutlier(o.id, "mapped");
                            window.location.href = "/admin/scheme-mapping";
                          }}
                          title="Mark as needing mapping and go to Scheme Mapping"
                        >
                          {busy ? "…" : "Map to Scheme →"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  page:           { fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#111827", maxWidth: 1100 },
  header:         { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "1.75rem", paddingBottom: "1.5rem", borderBottom: "1px solid #e5e7eb" },
  title:          { fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 5px", letterSpacing: "-0.5px" },
  subtitle:       { fontSize: 12.5, color: "#6b7280", margin: 0, maxWidth: 600, lineHeight: 1.7 },
  monthSelect:    { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "9px 36px 9px 14px", fontSize: 13.5, fontWeight: 500, color: "#374151", fontFamily: "inherit", appearance: "none", outline: "none", cursor: "pointer" },
  selectArrow:    { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af", pointerEvents: "none" },
  errorBar:       { background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626", marginBottom: 20 },
  loadingWrap:    { display: "flex", alignItems: "center", gap: 12, padding: "3rem 0", justifyContent: "center" },
  spinner:        { width: 20, height: 20, border: "2.5px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 },
  loadingText:    { fontSize: 14, color: "#6b7280" },
  statsRow:       { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: "1.5rem" },
  statCard:       { borderRadius: 12, border: "1.5px solid", padding: "14px 16px" },
  statValue:      { fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginBottom: 4 },
  statLabel:      { fontSize: 12, color: "#6b7280", fontWeight: 500 },
  progressWrap:   { marginBottom: "1.5rem" },
  progressTrack:  { height: 6, background: "#f3f4f6", borderRadius: 6, overflow: "hidden", marginBottom: 6 },
  progressFill:   { height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 6, transition: "width 0.6s ease" },
  progressLabel:  { fontSize: 12, color: "#9ca3af" },
  controlsRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: "1rem", flexWrap: "wrap" },
  searchInput:    { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "8px 14px", fontSize: 13.5, fontFamily: "inherit", color: "#374151", outline: "none", minWidth: 200 },
  tableWrap:      { background: "#fff", border: "1px solid #f3f4f6", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 12px rgba(0,0,0,0.05)", marginBottom: "1.5rem" },
  tableHeader:    { display: "flex", alignItems: "center", padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
  tableRow:       { display: "flex", alignItems: "center", padding: "13px 20px", borderBottom: "1px solid #f9fafb" },
  emptyRow:       { padding: "2rem", textAlign: "center", color: "#9ca3af", fontSize: 14 },
  dot:            { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  amcName:        { fontSize: 13.5, fontWeight: 500, color: "#374151" },
  miniTrack:      { height: 4, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 3 },
  miniFill:       { height: "100%", borderRadius: 4, transition: "width 0.4s ease" },
  statusPill:     { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20 },
  expandBtn:      { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#6b7280", fontFamily: "inherit", cursor: "pointer" },
  expandedPanel:  { background: "#fafbff", borderBottom: "1px solid #ede9fe", padding: "1rem 1.25rem 1.25rem 3.5rem" },
  expandedTitle:  { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#059669", marginBottom: 10 },
  expandedNone:   { fontSize: 12, color: "#9ca3af", fontStyle: "italic" },
  chipGrid:       { display: "flex", flexWrap: "wrap", gap: 6 },
  chip:           { fontSize: 11, fontWeight: 500, background: "#f0fdf4", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 6, padding: "3px 8px" },
  remainingCard:  { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, padding: "1.25rem 1.5rem", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" },
  remainingHeader:{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" },
  remainingTitle: { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 3 },
  remainingSub:   { fontSize: 12, color: "#6b7280" },
  copyBtn:        { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#6b7280", fontFamily: "inherit", cursor: "pointer" },
  remainingGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 6 },
  remainingItem:  { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, color: "#374151", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "7px 10px" },
  remainingNum:   { fontSize: 10, fontWeight: 700, color: "#9ca3af", minWidth: 18 },

  // ── Sheets Needing Review ──
  outlierCard:      { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, padding: "1.25rem 1.5rem", boxShadow: "0 1px 8px rgba(0,0,0,0.04)", marginTop: "1.5rem" },
  outlierHeader:    { marginBottom: "1.25rem" },
  outlierTitle:     { fontSize: 14, fontWeight: 700, color: "#374151" },
  outlierBadge:     { background: "#fff5f5", border: "1px solid #fecaca", color: "#dc2626", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12 },
  outlierSub:       { fontSize: 12, color: "#6b7280", marginTop: 5, lineHeight: 1.6 },
  outlierEmpty:     { display: "flex", alignItems: "center", gap: 8, padding: "1.5rem 0", color: "#9ca3af", fontSize: 13 },
  outlierTableHead: { display: "flex", padding: "8px 12px", background: "#f9fafb", borderRadius: 8, marginBottom: 4, fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" },
  outlierRow:       { display: "flex", padding: "11px 12px", borderBottom: "1px solid #f3f4f6", alignItems: "center", gap: 8 },
  reasonPill:       { display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, fontFamily: "monospace" },
  actionBtn:        { border: "none", borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap" },
  actionIgnore:     { background: "#f3f4f6", color: "#6b7280" },
  actionIndex:      { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" },
  actionMap:        { background: "#f5f3ff", color: "#4f46e5", border: "1px solid #ddd6fe" },
  code:             { fontFamily: "monospace", fontSize: 11, background: "#f3f4f6", borderRadius: 3, padding: "1px 4px" },
};
