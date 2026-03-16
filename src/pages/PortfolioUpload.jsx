// src/pages/PortfolioUpload.jsx
// Admin: Manual AMC Portfolio Upload
//
// How the upload works (no backend needed):
//   1. User fills AMC, month, picks file
//   2. On submit, file is sent directly to GitHub via the GitHub API
//   3. GitHub token is read from import.meta.env.VITE_GITHUB_PAT
//      → set this in Vercel environment variables (never hardcode it here)
//   4. File is saved to: data/raw/YYYY-MM/<filename> in the FundInsight repo
//
// Security note: VITE_ prefix means this value IS visible in the browser bundle.
// This is acceptable for an internal admin tool you access yourself.
// If you later need stricter security, move to a backend API route.

import { useState, useRef, useCallback } from "react";
import { AMC_LIST, CAT_LABELS } from "../data/amcList";

// ── Config — reads from Vercel environment variables ─────────────────────────
const GITHUB_OWNER = "anjaneyakg";
const GITHUB_REPO  = "FundInsight";
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN  = import.meta.env.VITE_GITHUB_PAT;

// ── GitHub helper — saves a file to the repo ─────────────────────────────────
async function saveFileToGitHub(path, fileBuffer, commitMessage) {
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

  // Check if file already exists (to get its SHA for overwrite)
  let sha = null;
  const checkRes = await fetch(apiUrl, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` },
  });
  if (checkRes.status === 200) {
    const existing = await checkRes.json();
    sha = existing.sha;
  }

  // Convert file to base64
  const base64Content = btoa(
    new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  // Push to GitHub
  const body = {
    message: commitMessage,
    content: base64Content,
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `GitHub error ${res.status}`);
  }

  return await res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getMonthLabel(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function defaultMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Group AMCs by category for the dropdown
const grouped = AMC_LIST.reduce((acc, amc) => {
  (acc[amc.category] = acc[amc.category] || []).push(amc);
  return acc;
}, {});

// ── Main component ────────────────────────────────────────────────────────────
export default function PortfolioUpload() {
  const [selectedAmc, setSelectedAmc] = useState(null);
  const [useCustom,   setUseCustom]   = useState(false);
  const [customAmc,   setCustomAmc]   = useState("");
  const [month,       setMonth]       = useState(defaultMonth());
  const [file,        setFile]        = useState(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [status,      setStatus]      = useState("idle"); // idle | uploading | success | error
  const [result,      setResult]      = useState(null);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [progress,    setProgress]    = useState(0);

  const fileInputRef = useRef(null);

  // ── File handling ───────────────────────────────────────────────────────────
  const acceptFile = useCallback((f) => {
    const lower = f.name.toLowerCase();
    if (![".xlsx", ".xls", ".zip"].some((ext) => lower.endsWith(ext))) {
      setErrorMsg("Only .xlsx, .xls, and .zip files are accepted.");
      return;
    }
    setFile(f);
    setErrorMsg("");
    setStatus("idle");
    setResult(null);
  }, []);

  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = ()  => setIsDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) acceptFile(e.dataTransfer.files[0]);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const effectiveAmc = useCustom ? customAmc.trim() : (selectedAmc?.name || "");
  const canSubmit    = !!effectiveAmc && !!month && !!file && status !== "uploading";

  // ── Upload ──────────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!canSubmit) return;

    if (!GITHUB_TOKEN) {
      setErrorMsg("VITE_GITHUB_PAT is not set. Add it to your Vercel environment variables.");
      return;
    }

    setStatus("uploading");
    setProgress(10);
    setErrorMsg("");

    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 85));
    }, 200);

    try {
      const buffer    = await file.arrayBuffer();
      const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const rawPath   = `data/raw/${month}/${safeName}`;
      const commitMsg = `raw: manual upload — ${effectiveAmc} ${month}`;

      await saveFileToGitHub(rawPath, buffer, commitMsg);

      clearInterval(progressTimer);
      setProgress(100);
      setResult({ amc: effectiveAmc, month, path: rawPath, size: file.size });
      setStatus("success");
    } catch (err) {
      clearInterval(progressTimer);
      setProgress(0);
      setStatus("error");
      setErrorMsg(err.message || "Upload failed. Check your GitHub token and try again.");
    }
  }

  function reset() {
    setFile(null);
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Portfolio Upload</h1>
          <p style={s.subtitle}>
            Manually upload an AMC month-end portfolio file.
            Saves directly to the FundInsight GitHub repo as a raw file.
            Then run Cell 7M in Colab to parse and merge it.
          </p>
        </div>
        <div style={s.headerBadges}>
          <span style={s.badge}>FundInsight</span>
          <span style={{ ...s.badge, ...s.badgeLive }}>● Live</span>
        </div>
      </div>

      <div style={s.grid}>
        {/* ── Left: Form ────────────────────────────────────────────────────── */}
        <div style={s.formCol}>

          {/* AMC */}
          <div style={s.fieldBlock}>
            <label style={s.fieldLabel}>AMC</label>
            {!useCustom ? (
              <div style={{ position: "relative" }}>
                <select
                  style={s.select}
                  value={selectedAmc?.id || ""}
                  onChange={(e) => {
                    const found = AMC_LIST.find((a) => a.id === e.target.value);
                    setSelectedAmc(found || null);
                  }}
                >
                  <option value="">— select AMC —</option>
                  {[4, 1, 3].map((cat) =>
                    grouped[cat]?.length ? (
                      <optgroup key={cat} label={CAT_LABELS[cat]}>
                        {grouped[cat].map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </optgroup>
                    ) : null
                  )}
                </select>
                <span style={s.selectArrow}>▾</span>
              </div>
            ) : (
              <input
                type="text"
                style={s.textInput}
                placeholder="Type AMC name exactly as it should appear in the CSV"
                value={customAmc}
                onChange={(e) => setCustomAmc(e.target.value)}
                autoFocus
              />
            )}
            <button style={s.linkBtn} onClick={() => { setUseCustom(!useCustom); setSelectedAmc(null); setCustomAmc(""); }}>
              {useCustom ? "← Back to list" : "AMC not in list? Type manually →"}
            </button>
            {selectedAmc?.note && (
              <div style={s.amcNote}>
                <span style={s.noteDot} />
                {selectedAmc.note}
              </div>
            )}
          </div>

          {/* Month */}
          <div style={s.fieldBlock}>
            <label style={s.fieldLabel}>Portfolio closing month</label>
            <input
              type="month"
              style={{ ...s.textInput, colorScheme: "dark" }}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            {month && <span style={s.monthLabel}>{getMonthLabel(month)}</span>}
          </div>

          {/* Drop zone */}
          <div style={s.fieldBlock}>
            <label style={s.fieldLabel}>Portfolio file</label>
            <div
              style={{
                ...s.dropZone,
                ...(isDragging ? s.dropZoneDragging : {}),
                ...(file ? s.dropZoneHasFile : {}),
              }}
              onClick={() => !file && fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.zip"
                onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                style={{ display: "none" }}
              />
              {!file ? (
                <>
                  <div style={s.dropIcon}>↑</div>
                  <div style={s.dropPrimary}>Drop file here or click to browse</div>
                  <div style={s.dropSecondary}>.xlsx · .xls · .zip · max 20 MB</div>
                </>
              ) : (
                <div style={s.fileRow}>
                  <span style={s.fileIcon}>{file.name.endsWith(".zip") ? "◈" : "◆"}</span>
                  <div style={s.fileInfo}>
                    <div style={s.fileName}>{file.name}</div>
                    <div style={s.fileSize}>{formatBytes(file.size)}</div>
                  </div>
                  <button style={s.removeBtn} onClick={(e) => { e.stopPropagation(); reset(); }}>✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Error message */}
          {errorMsg && <div style={s.errorBar}>{errorMsg}</div>}

          {/* Submit button */}
          <button
            style={{ ...s.submitBtn, ...((!canSubmit || status === "uploading") ? s.submitBtnDisabled : {}) }}
            onClick={handleUpload}
            disabled={!canSubmit}
          >
            {status === "uploading" ? (
              <><span style={s.spinner} />  Uploading to GitHub…</>
            ) : (
              "Upload to GitHub →"
            )}
          </button>

          {/* Progress bar */}
          {status === "uploading" && (
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* ── Right: Status panel ────────────────────────────────────────────── */}
        <div style={s.statusCol}>

          {/* Idle: checklist */}
          {status === "idle" && (
            <div style={s.panel}>
              <div style={s.panelTitle}>Upload checklist</div>
              <div style={s.checklist}>
                {[
                  { done: !!effectiveAmc, label: "AMC selected" },
                  { done: !!month,        label: "Closing month set" },
                  { done: !!file,         label: "File attached" },
                ].map((item) => (
                  <div key={item.label} style={{ ...s.checkItem, ...(item.done ? s.checkItemDone : {}) }}>
                    <span style={{ ...s.checkMark, ...(item.done ? s.checkMarkDone : {}) }}>
                      {item.done ? "✓" : "○"}
                    </span>
                    {item.label}
                  </div>
                ))}
              </div>
              <div style={s.helpSection}>
                <div style={s.helpTitle}>What happens after upload?</div>
                <ol style={s.helpList}>
                  <li>File is saved to <code style={s.code}>data/raw/YYYY-MM/</code> on GitHub</li>
                  <li>Open Colab → run <strong>Cell 7M</strong> to parse it</li>
                  <li><code style={s.code}>holdings_latest.csv</code> gets updated</li>
                </ol>
              </div>
            </div>
          )}

          {/* Success */}
          {status === "success" && result && (
            <div style={{ ...s.panel, ...s.panelSuccess }}>
              <div style={s.successIcon}>✓</div>
              <div style={s.successTitle}>Uploaded successfully</div>
              <div style={s.resultRows}>
                {[
                  { key: "AMC",   val: result.amc },
                  { key: "Month", val: getMonthLabel(result.month) },
                  { key: "Size",  val: formatBytes(result.size) },
                  { key: "Path",  val: result.path, isCode: true },
                ].map((row) => (
                  <div key={row.key} style={s.resultRow}>
                    <span style={s.resultKey}>{row.key}</span>
                    {row.isCode
                      ? <code style={s.resultCode}>{row.val}</code>
                      : <span style={s.resultVal}>{row.val}</span>}
                  </div>
                ))}
              </div>
              <div style={s.nextStep}>
                <div style={s.nextLabel}>Next step</div>
                <div style={s.nextBody}>
                  Open Colab and run <strong>Cell 7M</strong> to parse this file
                  and merge it into <code style={s.code}>holdings_latest.csv</code>.
                </div>
              </div>
              <button style={s.ghostBtn} onClick={reset}>Upload another file</button>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div style={{ ...s.panel, ...s.panelError }}>
              <div style={s.errorIcon}>✕</div>
              <div style={s.errorTitle}>Upload failed</div>
              <div style={s.errorDetail}>{errorMsg}</div>
              <button style={s.ghostBtn} onClick={() => setStatus("idle")}>Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:         { fontFamily: "'IBM Plex Mono', 'Courier New', monospace", color: "#c8d8e8", maxWidth: 960 },
  header:       { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "2.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1e2430" },
  title:        { fontSize: 22, fontWeight: 600, color: "#e8f4f8", margin: "0 0 6px", letterSpacing: "-0.5px" },
  subtitle:     { fontSize: 12, color: "#4a5a70", margin: 0, maxWidth: 520, lineHeight: 1.7 },
  headerBadges: { display: "flex", gap: 6, flexShrink: 0, marginTop: 4 },
  badge:        { fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "1px solid #1e2430", color: "#4a5a70", letterSpacing: "0.08em", fontFamily: "inherit" },
  badgeLive:    { borderColor: "#1e4a2e", color: "#3ab86a", background: "#0d1f16" },
  grid:         { display: "grid", gridTemplateColumns: "1fr 320px", gap: "2.5rem", alignItems: "start" },
  formCol:      {},
  fieldBlock:   { marginBottom: "1.75rem" },
  fieldLabel:   { display: "block", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3a4e66", marginBottom: 8, fontFamily: "inherit" },
  select:       { width: "100%", background: "#0d1017", border: "1px solid #1e2a3a", borderRadius: 6, padding: "10px 36px 10px 12px", fontSize: 13, color: "#c8d8e8", fontFamily: "'IBM Plex Mono', monospace", appearance: "none", outline: "none", cursor: "pointer", boxSizing: "border-box" },
  selectArrow:  { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#3a4e66", pointerEvents: "none" },
  textInput:    { width: "100%", background: "#0d1017", border: "1px solid #1e2a3a", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "#c8d8e8", fontFamily: "'IBM Plex Mono', monospace", outline: "none", boxSizing: "border-box" },
  monthLabel:   { display: "block", fontSize: 11, color: "#4a9eca", marginTop: 6 },
  linkBtn:      { background: "none", border: "none", color: "#3a6a8a", fontSize: 11, fontFamily: "inherit", cursor: "pointer", padding: "4px 0 0", textDecoration: "underline" },
  amcNote:      { display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8, fontSize: 11, color: "#7a6a3a", lineHeight: 1.5 },
  noteDot:      { width: 5, height: 5, borderRadius: "50%", background: "#a08020", flexShrink: 0, marginTop: 4, display: "inline-block" },
  dropZone:     { border: "1px dashed #2a3a50", borderRadius: 8, padding: "2rem", textAlign: "center", cursor: "pointer", transition: "border-color 0.15s" },
  dropZoneDragging: { borderColor: "#2a5a7a", background: "#0d1825" },
  dropZoneHasFile:  { cursor: "default", padding: "1rem 1.25rem" },
  dropIcon:     { fontSize: 22, color: "#2a3a50", marginBottom: 8 },
  dropPrimary:  { fontSize: 13, color: "#7a96b0", marginBottom: 4 },
  dropSecondary:{ fontSize: 11, color: "#3a4e66" },
  fileRow:      { display: "flex", alignItems: "center", gap: 10, textAlign: "left" },
  fileIcon:     { fontSize: 18, color: "#4a9eca", flexShrink: 0 },
  fileInfo:     { flex: 1, minWidth: 0 },
  fileName:     { fontSize: 13, color: "#c8d8e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  fileSize:     { fontSize: 11, color: "#4a5a70", marginTop: 2 },
  removeBtn:    { background: "none", border: "none", color: "#3a4e66", fontSize: 13, cursor: "pointer", padding: 4, flexShrink: 0, fontFamily: "inherit" },
  errorBar:     { background: "#1a0d0d", border: "1px solid #4a1a1a", borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#e87a6a", marginBottom: 16 },
  submitBtn:    { width: "100%", background: "#4a9eca", color: "#050810", border: "none", borderRadius: 6, padding: 12, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  submitBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  spinner:      { width: 12, height: 12, border: "2px solid #7ab8d8", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" },
  progressTrack:{ height: 2, background: "#1e2a3a", borderRadius: 2, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%", background: "#4a9eca", borderRadius: 2, transition: "width 0.25s ease" },
  statusCol:    { display: "flex", flexDirection: "column", gap: 16 },
  panel:        { background: "#0d1017", border: "1px solid #1e2430", borderRadius: 8, padding: "1.25rem 1.5rem" },
  panelSuccess: { background: "#0a1a12", borderColor: "#1a3a24" },
  panelError:   { background: "#130d0d", borderColor: "#3a1a1a" },
  panelTitle:   { fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3a4e66", marginBottom: 16 },
  checklist:    { marginBottom: 20 },
  checkItem:    { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#3a4e66", padding: "5px 0" },
  checkItemDone:{ color: "#7ab8a8" },
  checkMark:    { width: 14, fontSize: 11, flexShrink: 0 },
  checkMarkDone:{ color: "#3ab86a" },
  helpSection:  { borderTop: "1px solid #1e2430", paddingTop: 16 },
  helpTitle:    { fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3a4e66", marginBottom: 8 },
  helpList:     { paddingLeft: 20, margin: 0, fontSize: 11, color: "#4a5a70", lineHeight: 2.2 },
  code:         { background: "#1a2230", padding: "1px 5px", borderRadius: 3, fontFamily: "inherit", fontSize: 10, color: "#4a9eca" },
  successIcon:  { fontSize: 24, color: "#3ab86a", marginBottom: 8 },
  successTitle: { fontSize: 14, fontWeight: 600, color: "#3ab86a", marginBottom: 20 },
  resultRows:   { marginBottom: 20 },
  resultRow:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #1a3a24", gap: 16, fontSize: 12 },
  resultKey:    { color: "#3a6a4a", flexShrink: 0 },
  resultVal:    { color: "#a8d8b8", textAlign: "right", wordBreak: "break-all" },
  resultCode:   { fontFamily: "inherit", fontSize: 10, color: "#4a9eca", background: "#0d1825", padding: "2px 6px", borderRadius: 3, textAlign: "right", wordBreak: "break-all" },
  nextStep:     { background: "#0d1a24", border: "1px solid #1a3a4a", borderRadius: 6, padding: "10px 12px", marginBottom: 16 },
  nextLabel:    { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "#3a6a8a", marginBottom: 5 },
  nextBody:     { fontSize: 11, color: "#7ab8d8", lineHeight: 1.6 },
  errorIcon:    { fontSize: 20, color: "#e87a6a", marginBottom: 8 },
  errorTitle:   { fontSize: 14, fontWeight: 600, color: "#e87a6a", marginBottom: 8 },
  errorDetail:  { fontSize: 11, color: "#9a6a5a", marginBottom: 16, lineHeight: 1.6 },
  ghostBtn:     { background: "none", border: "1px solid #2a3a50", borderRadius: 6, padding: "8px 16px", fontSize: 12, color: "#7a96b0", fontFamily: "inherit", cursor: "pointer" },
};
