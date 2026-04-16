// src/pages/PortfolioUpload.jsx
import { useState, useRef, useCallback } from "react";
import { AMC_LIST, CAT_LABELS, CAT_DESCRIPTIONS } from "../data/amcList";

const GITHUB_OWNER  = "anjaneyakg";
const GITHUB_REPO   = "FundInsight";
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN  = import.meta.env.VITE_GITHUB_PAT;

// ── GitHub helpers ────────────────────────────────────────────────────────────

async function ghGet(path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" } }
  );
  return res.ok ? res.json() : null;
}

async function ghPut(path, buffer, message, sha = null) {
  const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ""));
  const body = { message, content: base64, branch: GITHUB_BRANCH, ...(sha ? { sha } : {}) };
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    { method: "PUT", headers: { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || `GitHub ${res.status}`); }
  return res.json();
}

async function ghDelete(path, sha, message) {
  const body = { message, sha, branch: GITHUB_BRANCH };
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    { method: "DELETE", headers: { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || `GitHub ${res.status}`); }
  return res.json();
}

async function listMonthFiles(month) {
  const items = await ghGet(`data/raw/${month}`);
  if (!Array.isArray(items)) return [];
  return items
    .filter(f => f.type === "file" && f.name !== "amc_map.json" &&
      [".xlsx", ".xls", ".zip"].some(ext => f.name.toLowerCase().endsWith(ext)))
    .map(f => ({ name: f.name, path: f.path, sha: f.sha, size: f.size }));
}

async function saveFile(path, buffer, commitMessage) {
  const existing = await ghGet(path);
  const sha = existing?.sha || null;
  return ghPut(path, buffer, commitMessage, sha);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatBytes(b) {
  if (!b) return "—";
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

function fileIcon(name) {
  if (!name) return "📄";
  const n = name.toLowerCase();
  if (n.endsWith(".zip")) return "🗜";
  return "📊";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_ORDER = [3, 4, 1, 2]; // C first (most used), then D, A, B
const grouped = AMC_LIST.reduce((acc, a) => {
  (acc[a.category] = acc[a.category] || []).push(a);
  return acc;
}, {});

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioUpload() {
  const [selectedAmc, setSelectedAmc] = useState(null);
  const [month,       setMonth]       = useState(defaultMonth());
  const [files,       setFiles]       = useState([]);         // queued local files
  const [isDragging,  setIsDragging]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [uploadResults, setUploadResults] = useState([]);    // [{name, status, path, error}]

  // Existing files panel
  const [existingFiles, setExistingFiles]     = useState(null);  // null = not loaded
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [deletingFile,  setDeletingFile]      = useState(null);  // filename being deleted

  const fileInputRef = useRef(null);

  // ── File acceptance ──────────────────────────────────────────────────────────

  const acceptFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter(f => {
      const n = f.name.toLowerCase();
      return [".xlsx", ".xls", ".zip"].some(e => n.endsWith(e));
    });
    if (!valid.length) return;
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
    setUploadResults([]);
  }, []);

  function removeQueuedFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name));
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!selectedAmc || !month || !files.length || uploading) return;
    if (!GITHUB_TOKEN) { alert("VITE_GITHUB_PAT not set."); return; }

    setUploading(true);
    setUploadResults([]);
    const results = [];

    for (const file of files) {
      try {
        const buffer   = await file.arrayBuffer();
        const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, "_");
        const path     = `data/raw/${month}/${safeName}`;
        const msg      = `raw: manual upload — ${selectedAmc.name} ${month}`;
        await saveFile(path, buffer, msg);
        results.push({ name: file.name, status: "ok", path, size: file.size });
      } catch (err) {
        results.push({ name: file.name, status: "error", error: err.message });
      }
    }

    setUploadResults(results);
    setUploading(false);
    if (results.every(r => r.status === "ok")) {
      setFiles([]);
      // Refresh existing files panel if open
      if (existingFiles !== null) loadExistingFiles();
    }
  }

  // ── Existing files panel ─────────────────────────────────────────────────────

  async function loadExistingFiles() {
    setLoadingExisting(true);
    const items = await listMonthFiles(month);
    setExistingFiles(items);
    setLoadingExisting(false);
  }

  async function handleDeleteExisting(file) {
    if (!confirm(`Delete "${file.name}" from GitHub?\n\nThis cannot be undone.`)) return;
    setDeletingFile(file.name);
    try {
      await ghDelete(file.path, file.sha, `cleanup: remove ${file.name} from data/raw/${month}`);
      setExistingFiles(prev => prev.filter(f => f.name !== file.name));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
    setDeletingFile(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const canUpload = !!selectedAmc && !!month && files.length > 0 && !uploading;
  const allOk     = uploadResults.length > 0 && uploadResults.every(r => r.status === "ok");

  return (
    <div style={s.page}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>⬆</div>
          <div>
            <h1 style={s.title}>Portfolio Upload</h1>
            <p style={s.subtitle}>
              Upload AMC month-end portfolio files to FundInsight GitHub.
              Supports single or multiple files per AMC. After upload, run{" "}
              <code style={s.ic}>cell_4d_v2.py --source github</code> to parse.
            </p>
          </div>
        </div>
        <div style={s.headerBadges}>
          <span style={s.badge}>FundInsight</span>
          <span style={{ ...s.badge, ...s.badgeLive }}>● Live</span>
        </div>
      </div>

      <div style={s.grid}>

        {/* ── Left: Upload form ── */}
        <div style={s.card}>

          {/* AMC selector */}
          <div style={s.field}>
            <label style={s.label}>AMC</label>
            <div style={{ position: "relative" }}>
              <select
                className="pu-select"
                value={selectedAmc?.id || ""}
                onChange={e => {
                  setSelectedAmc(AMC_LIST.find(a => a.id === e.target.value) || null);
                  setUploadResults([]);
                  setExistingFiles(null);
                }}
              >
                <option value="">— select AMC —</option>
                {GROUP_ORDER.map(cat => grouped[cat]?.length ? (
                  <optgroup key={cat} label={CAT_LABELS[cat]}>
                    {grouped[cat].map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </optgroup>
                ) : null)}
              </select>
              <span style={s.arrow}>▾</span>
            </div>
            {selectedAmc?.note && (
              <div style={s.amcNote}>
                <span>⚠</span> {selectedAmc.note}
              </div>
            )}
            {selectedAmc && (
              <div style={s.groupHint}>
                {CAT_DESCRIPTIONS[selectedAmc.category]}
              </div>
            )}
          </div>

          {/* Month */}
          <div style={s.field}>
            <label style={s.label}>Portfolio closing month</label>
            <input
              className="pu-input"
              type="month"
              value={month}
              onChange={e => {
                setMonth(e.target.value);
                setUploadResults([]);
                setExistingFiles(null);
              }}
              style={{ colorScheme: "light" }}
            />
            {month && <span style={s.monthHint}>{getMonthLabel(month)}</span>}
          </div>

          {/* Drop zone */}
          <div style={s.field}>
            <label style={s.label}>
              Portfolio file(s)
              <span style={s.labelSub}> — .xlsx · .xls · .zip · multiple allowed</span>
            </label>
            <div
              className={`pu-drop${isDragging ? " dragging" : ""}${files.length ? " has-files" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); acceptFiles(e.dataTransfer.files); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.zip"
                multiple
                onChange={e => e.target.files?.length && acceptFiles(e.target.files)}
                style={{ display: "none" }}
              />
              {!files.length ? (
                <>
                  <div style={s.dropIcon}>☁</div>
                  <div style={s.dropPrimary}>Drop files here or click to browse</div>
                  <div style={s.dropSub}>Multiple files supported — all added to queue</div>
                </>
              ) : (
                <div style={s.dropHint}>
                  <span style={{ fontSize: 13 }}>📁</span>
                  {files.length} file{files.length > 1 ? "s" : ""} queued — drop more or click to add
                </div>
              )}
            </div>

            {/* Queued file list */}
            {files.length > 0 && (
              <div style={s.fileList}>
                {files.map(f => (
                  <div key={f.name} style={s.fileRow}>
                    <span style={s.fileIcon}>{fileIcon(f.name)}</span>
                    <div style={s.fileInfo}>
                      <div style={s.fileName}>{f.name}</div>
                      <div style={s.fileSize}>{formatBytes(f.size)}</div>
                    </div>
                    <button
                      style={s.removeBtn}
                      onClick={() => removeQueuedFile(f.name)}
                      title="Remove from queue"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload results */}
          {uploadResults.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {uploadResults.map(r => (
                <div key={r.name} style={r.status === "ok" ? s.resultOk : s.resultErr}>
                  <span>{r.status === "ok" ? "✓" : "✗"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                    {r.status === "ok"
                      ? <div style={{ fontSize: 11, opacity: 0.8 }}>{r.path} · {formatBytes(r.size)}</div>
                      : <div style={{ fontSize: 11 }}>{r.error}</div>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <button
            className="pu-btn"
            onClick={handleUpload}
            disabled={!canUpload}
          >
            {uploading
              ? <><span style={s.spinner} /> Uploading…</>
              : <>Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "file"}</>
            }
          </button>

          {allOk && (
            <div style={s.nextBox}>
              <div style={s.nextLabel}>Next step</div>
              <div style={s.nextBody}>
                Run <code style={s.ic}>python pipeline/cell_4d_v2.py --month {month} --source github</code> to parse.
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Existing files panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Existing files card */}
          <div style={s.card}>
            <div style={s.panelTitle}>Existing files on GitHub</div>
            <p style={s.panelSub}>
              Files already in <code style={s.ic}>data/raw/{month || "YYYY-MM"}/</code>
              {selectedAmc ? ` for ${selectedAmc.name}` : ""}.
              Delete duplicates before uploading fresh files.
            </p>

            <button
              className="pu-ghost"
              style={{ width: "100%", marginBottom: 12 }}
              onClick={loadExistingFiles}
              disabled={!month || loadingExisting}
            >
              {loadingExisting
                ? <><span style={{ ...s.spinner, borderTopColor: "#6366f1", borderColor: "#e5e7eb" }} /> Loading…</>
                : existingFiles === null ? "Load existing files" : "Refresh"
              }
            </button>

            {existingFiles !== null && (
              existingFiles.length === 0
                ? <div style={s.emptyMsg}>No files found in this folder yet.</div>
                : <div style={s.existingList}>
                    {existingFiles.map(f => (
                      <div key={f.name} style={s.existingRow}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(f.name)}</span>
                        <div style={s.fileInfo}>
                          <div style={{ ...s.fileName, fontSize: 12 }}>{f.name}</div>
                          <div style={s.fileSize}>{formatBytes(f.size)}</div>
                        </div>
                        <button
                          style={s.deleteBtn}
                          onClick={() => handleDeleteExisting(f)}
                          disabled={deletingFile === f.name}
                          title="Delete from GitHub"
                        >
                          {deletingFile === f.name ? "…" : "🗑"}
                        </button>
                      </div>
                    ))}
                  </div>
            )}
          </div>

          {/* Checklist card */}
          <div style={s.card}>
            <div style={s.panelTitle}>Upload checklist</div>
            {[
              { done: !!selectedAmc, label: "AMC selected" },
              { done: !!month,       label: "Closing month set" },
              { done: files.length > 0, label: `File${files.length > 1 ? "s" : ""} attached${files.length > 1 ? ` (${files.length})` : ""}` },
            ].map(item => (
              <div key={item.label} style={{ ...s.checkRow, ...(item.done ? s.checkRowDone : {}) }}>
                <div style={{ ...s.checkCircle, ...(item.done ? s.checkCircleDone : {}) }}>
                  {item.done ? "✓" : ""}
                </div>
                {item.label}
              </div>
            ))}

            <div style={s.divider} />
            <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.8 }}>
              <strong style={{ color: "#6b7280" }}>Commit format</strong><br />
              <code style={s.ic}>raw: manual upload — {selectedAmc?.name || "{AMC}"} {month}</code>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  .pu-select {
    width: 100%; background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 10px 36px 10px 14px; font-size: 13.5px; color: #374151;
    font-family: 'Plus Jakarta Sans', sans-serif; appearance: none; outline: none;
    cursor: pointer; transition: border-color 0.15s;
  }
  .pu-select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
  .pu-input {
    width: 100%; background: #fff; border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 10px 14px; font-size: 13.5px; color: #374151;
    font-family: 'Plus Jakarta Sans', sans-serif; outline: none;
    transition: border-color 0.15s; box-sizing: border-box;
  }
  .pu-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
  .pu-drop {
    border: 2px dashed #e5e7eb; border-radius: 14px; padding: 2rem;
    text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa;
  }
  .pu-drop:hover { border-color: #6366f1; background: #f5f3ff; }
  .pu-drop.dragging { border-color: #6366f1; background: #ede9fe; }
  .pu-drop.has-files { padding: 0.75rem 1rem; border-style: solid; border-color: #6366f1; background: #f5f3ff; }
  .pu-btn {
    width: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border: none; border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600;
    font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; letter-spacing: 0.02em;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: opacity 0.15s, transform 0.1s;
  }
  .pu-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
  .pu-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .pu-ghost {
    background: none; border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 9px 18px; font-size: 13px; font-weight: 500; color: #6b7280;
    font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer;
    transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .pu-ghost:hover:not(:disabled) { border-color: #6366f1; color: #4f46e5; }
  .pu-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const s = {
  page:     { fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#111827", maxWidth: 980 },
  header:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid #e5e7eb" },
  headerLeft: { display: "flex", alignItems: "flex-start", gap: 16 },
  headerIcon: { width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, boxShadow: "0 4px 14px rgba(99,102,241,0.3)" },
  title:    { fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 5px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: 13, color: "#6b7280", margin: 0, maxWidth: 520, lineHeight: 1.7 },
  headerBadges: { display: "flex", gap: 6, flexShrink: 0, marginTop: 4 },
  badge:    { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, border: "1.5px solid #e5e7eb", color: "#6b7280", background: "#fff" },
  badgeLive:{ borderColor: "#a7f3d0", color: "#059669", background: "#f0fdf4" },
  grid:     { display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem", alignItems: "start" },
  card:     { background: "#fff", borderRadius: 16, border: "1px solid #f3f4f6", boxShadow: "0 1px 12px rgba(0,0,0,0.06)", padding: "1.75rem" },
  field:    { marginBottom: "1.5rem" },
  label:    { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 },
  labelSub: { fontWeight: 400, color: "#9ca3af", fontSize: 12 },
  arrow:    { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af", pointerEvents: "none" },
  monthHint:{ display: "block", fontSize: 12, color: "#6366f1", fontWeight: 500, marginTop: 6 },
  amcNote:  { display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8, fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 },
  groupHint:{ marginTop: 6, fontSize: 11, color: "#6b7280", lineHeight: 1.6 },
  dropIcon: { fontSize: 30, marginBottom: 8, color: "#6366f1" },
  dropPrimary: { fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 4 },
  dropSub:     { fontSize: 12, color: "#9ca3af" },
  dropHint:    { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4f46e5", fontWeight: 500, justifyContent: "center" },
  fileList:    { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  fileRow:     { display: "flex", alignItems: "center", gap: 10, background: "#f5f3ff", borderRadius: 10, padding: "8px 12px", border: "1px solid #ede9fe" },
  fileIcon:    { fontSize: 18, flexShrink: 0 },
  fileInfo:    { flex: 1, minWidth: 0 },
  fileName:    { fontSize: 13, fontWeight: 500, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  fileSize:    { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  removeBtn:   { background: "none", border: "none", color: "#c4b5fd", fontSize: 13, cursor: "pointer", padding: "2px 4px", borderRadius: 4, transition: "color 0.15s", flexShrink: 0 },
  resultOk:    { display: "flex", gap: 10, alignItems: "flex-start", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px", marginBottom: 6, color: "#059669", fontSize: 13 },
  resultErr:   { display: "flex", gap: 10, alignItems: "flex-start", background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", marginBottom: 6, color: "#dc2626", fontSize: 13 },
  spinner:     { width: 13, height: 13, border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", flexShrink: 0 },
  nextBox:     { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginTop: 14 },
  nextLabel:   { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#059669", marginBottom: 4 },
  nextBody:    { fontSize: 12, color: "#047857", lineHeight: 1.8 },
  ic:          { background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: "#4f46e5" },
  panelTitle:  { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 },
  panelSub:    { fontSize: 12, color: "#9ca3af", lineHeight: 1.6, marginBottom: 14, marginTop: 0 },
  emptyMsg:    { fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "12px 0" },
  existingList:{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" },
  existingRow: { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "#fafafa", border: "1px solid #f3f4f6" },
  deleteBtn:   { background: "none", border: "none", fontSize: 14, cursor: "pointer", padding: "2px 4px", flexShrink: 0, opacity: 0.5, transition: "opacity 0.15s" },
  checkRow:    { display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13, color: "#9ca3af" },
  checkRowDone:{ color: "#374151" },
  checkCircle: { width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: "#d1d5db" },
  checkCircleDone: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff" },
  divider:     { height: 1, background: "#f3f4f6", margin: "1rem 0" },
};
