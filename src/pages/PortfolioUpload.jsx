// src/pages/PortfolioUpload.jsx
import { useState, useRef, useCallback } from "react";
import { AMC_LIST, CAT_LABELS } from "../data/amcList";

const GITHUB_OWNER  = "anjaneyakg";
const GITHUB_REPO   = "FundInsight";
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN  = import.meta.env.VITE_GITHUB_PAT;

// Raw URL for holdings_latest.csv — used for duplicate check
const HOLDINGS_CSV_URL =
  "https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/data/processed/holdings_latest.csv";

async function saveFileToGitHub(path, fileBuffer, commitMessage) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  let sha = null;
  const checkRes = await fetch(apiUrl, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
  if (checkRes.status === 200) { const ex = await checkRes.json(); sha = ex.sha; }
  const base64Content = btoa(new Uint8Array(fileBuffer).reduce((d, b) => d + String.fromCharCode(b), ""));
  const body = { message: commitMessage, content: base64Content, branch: GITHUB_BRANCH, ...(sha ? { sha } : {}) };
  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err.message || `GitHub error ${res.status}`); }
  return res.json();
}

// Check holdings_latest.csv for existing rows matching amc + month
// Returns { exists: bool, rowCount: number }
async function checkDuplicate(amcName, month) {
  try {
    const res = await fetch(`${HOLDINGS_CSV_URL}?t=${Date.now()}`);
    if (!res.ok) return { exists: false, rowCount: 0 }; // CSV not found yet — first upload
    const text = await res.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) return { exists: false, rowCount: 0 };

    // Parse header to find amc_name and portfolio_date column indices
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const amcIdx  = headers.indexOf("amc_name");
    const dateIdx = headers.indexOf("portfolio_date");
    if (amcIdx === -1 || dateIdx === -1) return { exists: false, rowCount: 0 };

    // Month is YYYY-MM, portfolio_date is YYYY-MM-DD — match by prefix
    const matchingRows = lines.slice(1).filter(line => {
      const cols = line.split(",");
      const rowAmc  = (cols[amcIdx]  || "").trim().replace(/^"|"$/g, "");
      const rowDate = (cols[dateIdx] || "").trim().replace(/^"|"$/g, "");
      return rowAmc === amcName && rowDate.startsWith(month);
    });

    return { exists: matchingRows.length > 0, rowCount: matchingRows.length };
  } catch {
    return { exists: false, rowCount: 0 }; // On any error, allow upload to proceed
  }
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
function getMonthLabel(v) {
  if (!v) return "";
  const [y, m] = v.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
function defaultMonth() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const grouped = AMC_LIST.reduce((acc, a) => { (acc[a.category] = acc[a.category] || []).push(a); return acc; }, {});

export default function PortfolioUpload() {
  const [selectedAmc, setSelectedAmc] = useState(null);
  const [useCustom,   setUseCustom]   = useState(false);
  const [customAmc,   setCustomAmc]   = useState("");
  const [month,       setMonth]       = useState(defaultMonth());
  const [file,        setFile]        = useState(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [status,      setStatus]      = useState("idle");
  const [result,      setResult]      = useState(null);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [progress,    setProgress]    = useState(0);

  // ── Duplicate guard state
  const [dupCheck,       setDupCheck]       = useState(null);   // { exists, rowCount } | null
  const [dupChecking,    setDupChecking]    = useState(false);  // spinner while checking CSV
  const [dupConfirmed,   setDupConfirmed]   = useState(false);  // user clicked "Yes, overwrite"

  const fileInputRef = useRef(null);

  const acceptFile = useCallback((f) => {
    const lower = f.name.toLowerCase();
    if (![ ".xlsx", ".xls", ".zip" ].some((e) => lower.endsWith(e))) {
      setErrorMsg("Only .xlsx, .xls, and .zip files are accepted."); return;
    }
    setFile(f); setErrorMsg(""); setStatus("idle"); setResult(null);
    // Reset duplicate state when a new file is selected
    setDupCheck(null); setDupConfirmed(false);
  }, []);

  const effectiveAmc = useCustom ? customAmc.trim() : (selectedAmc?.name || "");
  const canSubmit    = !!effectiveAmc && !!month && !!file && status !== "uploading" && !dupChecking;

  // ── Upload handler — with duplicate guard
  async function handleUpload() {
    if (!canSubmit) return;
    if (!GITHUB_TOKEN) { setErrorMsg("VITE_GITHUB_PAT is not set in Vercel environment variables."); return; }

    // Step 1 — if we haven't checked for duplicates yet, check now
    if (!dupCheck && !dupConfirmed) {
      setDupChecking(true);
      const check = await checkDuplicate(effectiveAmc, month);
      setDupChecking(false);
      setDupCheck(check);

      // If duplicate found — stop here and show warning. User must confirm.
      if (check.exists) return;
      // No duplicate — fall through to upload immediately
    }

    // Step 2 — proceed with upload
    setStatus("uploading"); setProgress(10); setErrorMsg("");
    const t = setInterval(() => setProgress((p) => Math.min(p + Math.random() * 15, 85)), 200);
    try {
      const buffer   = await file.arrayBuffer();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const rawPath  = `data/raw/${month}/${safeName}`;
      await saveFileToGitHub(rawPath, buffer, `raw: manual upload — ${effectiveAmc} ${month}`);
      clearInterval(t); setProgress(100);
      setResult({ amc: effectiveAmc, month, path: rawPath, size: file.size });
      setStatus("success");
      setDupCheck(null); setDupConfirmed(false);
    } catch (err) {
      clearInterval(t); setProgress(0); setStatus("error");
      setErrorMsg(err.message || "Upload failed. Check your GitHub token.");
    }
  }

  function reset() {
    setFile(null); setStatus("idle"); setResult(null);
    setErrorMsg(""); setProgress(0);
    setDupCheck(null); setDupConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .pu-select { width:100%; background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; padding:10px 36px 10px 14px; font-size:13.5px; color:#374151; font-family:'Plus Jakarta Sans',sans-serif; appearance:none; outline:none; cursor:pointer; transition:border-color 0.15s; }
        .pu-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .pu-input { width:100%; background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; padding:10px 14px; font-size:13.5px; color:#374151; font-family:'Plus Jakarta Sans',sans-serif; outline:none; transition:border-color 0.15s; box-sizing:border-box; }
        .pu-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
        .pu-drop { border:2px dashed #e5e7eb; border-radius:14px; padding:2.5rem; text-align:center; cursor:pointer; transition:all 0.2s; background:#fafafa; }
        .pu-drop:hover { border-color:#6366f1; background:#f5f3ff; }
        .pu-drop.dragging { border-color:#6366f1; background:#ede9fe; }
        .pu-drop.has-file { padding:1rem 1.25rem; cursor:default; border-style:solid; border-color:#6366f1; background:#f5f3ff; }
        .pu-btn { width:100%; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:10px; padding:13px; font-size:14px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; letter-spacing:0.02em; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(99,102,241,0.3); transition:opacity 0.15s,transform 0.1s; }
        .pu-btn:hover:not(:disabled) { opacity:0.92; transform:translateY(-1px); }
        .pu-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; box-shadow:none; }
        .pu-btn-warn { width:100%; background:linear-gradient(135deg,#d97706,#b45309); color:#fff; border:none; border-radius:10px; padding:13px; font-size:14px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; letter-spacing:0.02em; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 14px rgba(217,119,6,0.3); transition:opacity 0.15s,transform 0.1s; }
        .pu-btn-warn:hover { opacity:0.92; transform:translateY(-1px); }
        .pu-ghost { background:none; border:1.5px solid #e5e7eb; border-radius:10px; padding:9px 18px; font-size:13px; font-weight:500; color:#6b7280; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; transition:all 0.15s; }
        .pu-ghost:hover { border-color:#6366f1; color:#4f46e5; }
        .pu-link { background:none; border:none; color:#6366f1; font-size:12px; font-family:'Plus Jakarta Sans',sans-serif; cursor:pointer; padding:4px 0 0; font-weight:500; }
        .pu-link:hover { text-decoration:underline; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes prog { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      `}</style>

      {/* Page header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>⬆</div>
          <div>
            <h1 style={s.title}>Portfolio Upload</h1>
            <p style={s.subtitle}>Manually upload an AMC month-end portfolio file to FundInsight GitHub. Use as backup for any AMC the pipeline cannot auto-fetch.</p>
          </div>
        </div>
        <div style={s.headerBadges}>
          <span style={s.badge}>FundInsight</span>
          <span style={{ ...s.badge, ...s.badgeLive }}>● Live</span>
        </div>
      </div>

      <div style={s.grid}>
        {/* ── Left: Form card ── */}
        <div style={s.card}>
          {/* AMC */}
          <div style={s.field}>
            <label style={s.label}>AMC name</label>
            {!useCustom ? (
              <div style={{ position: "relative" }}>
                <select className="pu-select"
                  value={selectedAmc?.id || ""}
                  onChange={(e) => {
                    setSelectedAmc(AMC_LIST.find((a) => a.id === e.target.value) || null);
                    setDupCheck(null); setDupConfirmed(false);
                  }}>
                  <option value="">— select AMC —</option>
                  {[4, 1, 3].map((cat) => grouped[cat]?.length ? (
                    <optgroup key={cat} label={CAT_LABELS[cat]}>
                      {grouped[cat].map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                  ) : null)}
                </select>
                <span style={s.arrow}>▾</span>
              </div>
            ) : (
              <input className="pu-input" type="text" placeholder="Type AMC name exactly" value={customAmc}
                onChange={(e) => { setCustomAmc(e.target.value); setDupCheck(null); setDupConfirmed(false); }}
                autoFocus />
            )}
            <button className="pu-link" onClick={() => { setUseCustom(!useCustom); setSelectedAmc(null); setCustomAmc(""); setDupCheck(null); }}>
              {useCustom ? "← Back to list" : "AMC not in list? Type manually →"}
            </button>
            {selectedAmc?.note && (
              <div style={s.amcNote}>
                <span style={s.noteIcon}>⚠</span>
                {selectedAmc.note}
              </div>
            )}
          </div>

          {/* Month */}
          <div style={s.field}>
            <label style={s.label}>Portfolio closing month</label>
            <input className="pu-input" type="month" value={month}
              onChange={(e) => { setMonth(e.target.value); setDupCheck(null); setDupConfirmed(false); }}
              style={{ colorScheme: "light" }} />
            {month && <span style={s.monthHint}>{getMonthLabel(month)}</span>}
          </div>

          {/* Drop zone */}
          <div style={s.field}>
            <label style={s.label}>Portfolio file</label>
            <div
              className={`pu-drop${isDragging ? " dragging" : ""}${file ? " has-file" : ""}`}
              onClick={() => !file && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) acceptFile(e.dataTransfer.files[0]); }}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.zip"
                onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                style={{ display: "none" }} />
              {!file ? (
                <>
                  <div style={s.dropIcon}>☁</div>
                  <div style={s.dropPrimary}>Drop file here or click to browse</div>
                  <div style={s.dropSub}>.xlsx · .xls · .zip · max 20 MB</div>
                </>
              ) : (
                <div style={s.fileRow}>
                  <div style={s.fileIconWrap}>{file.name.endsWith(".zip") ? "🗜" : "📊"}</div>
                  <div style={s.fileInfo}>
                    <div style={s.fileName}>{file.name}</div>
                    <div style={s.fileSize}>{formatBytes(file.size)}</div>
                  </div>
                  <button style={s.removeBtn} onClick={(e) => { e.stopPropagation(); reset(); }}>✕</button>
                </div>
              )}
            </div>
          </div>

          {errorMsg && <div style={s.errorBar}><span>⚠</span> {errorMsg}</div>}

          {/* ── Duplicate warning banner ── */}
          {dupCheck?.exists && !dupConfirmed && (
            <div style={s.dupWarn}>
              <div style={s.dupWarnIcon}>⚠</div>
              <div style={{ flex: 1 }}>
                <div style={s.dupWarnTitle}>
                  Data already exists for {effectiveAmc} · {getMonthLabel(month)}
                </div>
                <div style={s.dupWarnBody}>
                  <strong>{dupCheck.rowCount.toLocaleString("en-IN")} rows</strong> are currently in{" "}
                  <code style={s.inlineCode}>holdings_latest.csv</code> for this AMC and month.
                  Uploading will overwrite them when you run Cell 7M.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="pu-btn-warn"
                    style={{ flex: 1, padding: "9px", fontSize: 13 }}
                    onClick={() => { setDupConfirmed(true); setDupCheck(null); }}>
                    Yes, overwrite →
                  </button>
                  <button className="pu-ghost"
                    style={{ flex: 1, padding: "9px", fontSize: 13 }}
                    onClick={reset}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Main upload button ── */}
          {!(dupCheck?.exists && !dupConfirmed) && (
            <button className="pu-btn" onClick={handleUpload} disabled={!canSubmit}>
              {dupChecking
                ? <><span style={s.spinner} /> Checking for existing data…</>
                : status === "uploading"
                ? <><span style={s.spinner} /> Uploading to GitHub…</>
                : "Upload to GitHub →"}
            </button>
          )}

          {status === "uploading" && (
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* ── Right: Status panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {status === "idle" && (
            <div style={s.card}>
              <div style={s.panelTitle}>Upload checklist</div>
              <div style={{ marginBottom: 20 }}>
                {[
                  { done: !!effectiveAmc, label: "AMC selected" },
                  { done: !!month,        label: "Closing month set" },
                  { done: !!file,         label: "File attached" },
                ].map((item) => (
                  <div key={item.label} style={{ ...s.checkRow, ...(item.done ? s.checkRowDone : {}) }}>
                    <div style={{ ...s.checkCircle, ...(item.done ? s.checkCircleDone : {}) }}>
                      {item.done ? "✓" : ""}
                    </div>
                    {item.label}
                  </div>
                ))}
              </div>
              <div style={s.divider} />
              <div style={s.helpTitle}>What happens after upload?</div>
              <ol style={s.helpList}>
                <li>File saved to <code style={s.inlineCode}>data/raw/YYYY-MM/</code> on GitHub</li>
                <li>Open Colab → run <strong>Cell 7M</strong> to parse</li>
                <li><code style={s.inlineCode}>holdings_latest.csv</code> updated</li>
              </ol>
            </div>
          )}

          {status === "success" && result && (
            <div style={{ ...s.card, ...s.cardSuccess }}>
              <div style={s.successBadge}>✓ Uploaded successfully</div>
              <div style={{ marginBottom: 20 }}>
                {[
                  { k: "AMC",   v: result.amc },
                  { k: "Month", v: getMonthLabel(result.month) },
                  { k: "Size",  v: formatBytes(result.size) },
                  { k: "Path",  v: result.path, code: true },
                ].map((row) => (
                  <div key={row.k} style={s.resultRow}>
                    <span style={s.resultKey}>{row.k}</span>
                    {row.code
                      ? <code style={s.resultCode}>{row.v}</code>
                      : <span style={s.resultVal}>{row.v}</span>}
                  </div>
                ))}
              </div>
              <div style={s.nextBox}>
                <div style={s.nextLabel}>Next step</div>
                <div style={s.nextBody}>Open Colab and run <strong>Cell 7M</strong> to parse this file and merge into <code style={s.inlineCode}>holdings_latest.csv</code>.</div>
              </div>
              <button className="pu-ghost" onClick={reset} style={{ marginTop: 12 }}>Upload another file</button>
            </div>
          )}

          {status === "error" && (
            <div style={{ ...s.card, ...s.cardError }}>
              <div style={s.errorBadge}>✕ Upload failed</div>
              <div style={s.errorDetail}>{errorMsg}</div>
              <button className="pu-ghost" onClick={() => setStatus("idle")} style={{ marginTop: 12 }}>Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page:     { fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#111827", maxWidth: 960 },
  header:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid #e5e7eb" },
  headerLeft: { display: "flex", alignItems: "flex-start", gap: 16 },
  headerIcon: { width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  title:    { fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 5px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: 13, color: "#6b7280", margin: 0, maxWidth: 480, lineHeight: 1.7 },
  headerBadges: { display: "flex", gap: 6, flexShrink: 0, marginTop: 4 },
  badge:    { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, border: "1.5px solid #e5e7eb", color: "#6b7280", background: "#fff", fontFamily: "inherit" },
  badgeLive:{ borderColor: "#a7f3d0", color: "#059669", background: "#f0fdf4" },
  grid:     { display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem", alignItems: "start" },
  card:     { background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", padding: "1.75rem" },
  cardSuccess: { border: "1.5px solid #a7f3d0", background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)" },
  cardError:   { border: "1.5px solid #fecaca", background: "linear-gradient(135deg,#fff5f5,#fef2f2)" },
  field:    { marginBottom: "1.5rem" },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 },
  arrow:    { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af", pointerEvents: "none" },
  monthHint:{ display: "block", fontSize: 12, color: "#6366f1", fontWeight: 500, marginTop: 6 },
  amcNote:  { display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8, fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 },
  noteIcon: { flexShrink: 0, fontSize: 13 },
  dropIcon: { fontSize: 32, marginBottom: 10, color: "#6366f1" },
  dropPrimary: { fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 4 },
  dropSub:     { fontSize: 12, color: "#9ca3af" },
  fileRow:     { display: "flex", alignItems: "center", gap: 12, textAlign: "left" },
  fileIconWrap:{ fontSize: 26, flexShrink: 0 },
  fileInfo:    { flex: 1, minWidth: 0 },
  fileName:    { fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  fileSize:    { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  removeBtn:   { background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: 4, flexShrink: 0, fontFamily: "inherit", borderRadius: 6, transition: "color 0.15s" },
  errorBar:    { background: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 },
  spinner:     { width: 14, height: 14, border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 },
  progressTrack: { height: 4, background: "#ede9fe", borderRadius: 4, marginTop: 12, overflow: "hidden" },
  progressFill:  { height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6,#6366f1)", backgroundSize: "200% 100%", borderRadius: 4, transition: "width 0.3s ease", animation: "prog 2s linear infinite" },
  panelTitle:  { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 },
  checkRow:    { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13, color: "#9ca3af" },
  checkRowDone:{ color: "#374151" },
  checkCircle: { width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: "#d1d5db" },
  checkCircleDone: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff" },
  divider:     { height: 1, background: "#f3f4f6", margin: "1rem 0" },
  helpTitle:   { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 },
  helpList:    { paddingLeft: 18, margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 2.2 },
  inlineCode:  { background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: "#4f46e5" },
  successBadge:{ fontSize: 14, fontWeight: 700, color: "#059669", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 },
  resultRow:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #d1fae5", gap: 16, fontSize: 12 },
  resultKey:   { fontWeight: 600, color: "#065f46", flexShrink: 0 },
  resultVal:   { color: "#047857", textAlign: "right", wordBreak: "break-all" },
  resultCode:  { fontFamily: "monospace", fontSize: 11, color: "#4f46e5", background: "#ede9fe", padding: "2px 6px", borderRadius: 4, textAlign: "right", wordBreak: "break-all" },
  nextBox:     { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginTop: 4 },
  nextLabel:   { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#059669", marginBottom: 4 },
  nextBody:    { fontSize: 12, color: "#047857", lineHeight: 1.7 },
  errorBadge:  { fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 10 },
  errorDetail: { fontSize: 12, color: "#b91c1c", lineHeight: 1.7 },
  // Duplicate warning
  dupWarn:     { display: "flex", gap: 12, alignItems: "flex-start", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 12, padding: "14px 16px", marginBottom: 16 },
  dupWarnIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  dupWarnTitle:{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 },
  dupWarnBody: { fontSize: 12, color: "#78350f", lineHeight: 1.7 },
};
