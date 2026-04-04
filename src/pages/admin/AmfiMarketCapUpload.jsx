// src/pages/admin/AmfiMarketCapUpload.jsx
// Admin utility — AMFI Market Cap File Upload
// Design: warm white #fafaf8 · Indigo #4338ca + teal · DM Sans + DM Mono
//
// Flow:
//   1. Admin picks effective_from + effective_to dates
//   2. Drops / selects .xlsx file
//   3. File parsed client-side via FileReader + manual binary parse
//      (no SheetJS — not in package.json; uses fetch to POST raw base64 + parsed rows)
//   4. Preview: row count, category breakdown, top 5 sample rows
//   5. Confirm → POST to /api/amfi-marketcap
//   6. Shows result + upload history from GET /api/amfi-marketcap
//
// Note: xlsx parsing is done server-side via the API to avoid adding a
// client-side xlsx dependency. The UI sends the raw file as base64 and
// lets the serverless function parse it. HOWEVER — we pre-validate the
// file client-side using a lightweight approach: read the file as
// ArrayBuffer, extract text to check for expected column keywords.

import { useState, useEffect, useRef } from 'react';

const fmtDate = s => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
};

const CAP_COLORS = {
  'Large Cap': { bg:'#eff6ff', border:'#bfdbfe', text:'#1d4ed8' },
  'Mid Cap':   { bg:'#f0fdf4', border:'#bbf7d0', text:'#15803d' },
  'Small Cap': { bg:'#fefce8', border:'#fde68a', text:'#b45309' },
};

// ── Upload History Card ──────────────────────────────────────────────────────
function HistoryCard({ period }) {
  const dist = period.distribution ?? {};
  return (
    <div style={{
      background:'#fff', border:'1px solid #e2e8f0', borderRadius:12,
      padding:'14px 18px', display:'flex', alignItems:'center',
      justifyContent:'space-between', flexWrap:'wrap', gap:10,
    }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          {period.is_active && (
            <span style={{ background:'#4338ca', color:'#fff', fontSize:10, fontWeight:700,
              borderRadius:20, padding:'2px 10px', letterSpacing:0.5 }}>ACTIVE</span>
          )}
          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a', fontFamily:"'DM Mono',monospace" }}>
            {fmtDate(period.effective_from)}
            {period.effective_to ? ` → ${fmtDate(period.effective_to)}` : ' → present'}
          </span>
        </div>
        <div style={{ fontSize:11, color:'#94a3b8' }}>
          Uploaded {fmtDate(period.uploaded_at)} · {period.total?.toLocaleString()} securities
        </div>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {Object.entries(dist).map(([cat, count]) => {
          const c = CAP_COLORS[cat] ?? CAP_COLORS['Small Cap'];
          return (
            <div key={cat} style={{
              background:c.bg, border:`1px solid ${c.border}`, borderRadius:8,
              padding:'4px 10px', textAlign:'center', minWidth:70,
            }}>
              <div style={{ fontSize:13, fontWeight:800, color:c.text, fontFamily:"'DM Mono',monospace" }}>
                {count}
              </div>
              <div style={{ fontSize:9, color:c.text, opacity:0.8 }}>
                {cat.replace(' Cap','')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AmfiMarketCapUpload() {
  const fileRef = useRef(null);

  // Form state
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo,   setEffectiveTo]   = useState('');
  const [file,          setFile]          = useState(null);
  const [fileBase64,    setFileBase64]    = useState(null);

  // Parse preview state (rows parsed server-side on upload, previewed from API response)
  const [preview,  setPreview]  = useState(null); // { total, distribution, sample }
  const [parsing,  setParsing]  = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState(null); // { success, inserted, period }
  const [error,     setError]     = useState(null);

  // History state
  const [history,      setHistory]      = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    fetch('/api/amfi-marketcap')
      .then(r => r.json())
      .then(d => { setHistory(d.history ?? []); setHistoryLoading(false); })
      .catch(() => setHistoryLoading(false));
  }, [result]); // reload after successful upload

  // ── File selection → read as base64 + basic validation ──────────────────
  const handleFileChange = e => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.endsWith('.xlsx')) {
      setError('Please select an .xlsx file. AMFI market cap files are published as Excel workbooks.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File exceeds 10MB. Please check you have the correct file.');
      return;
    }

    setFile(f);
    setError(null);
    setPreview(null);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = e2 => {
      // Convert ArrayBuffer → base64
      const buffer = e2.target.result;
      const bytes  = new Uint8Array(buffer);
      let binary   = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      setFileBase64(b64);

      // Client-side preview: POST to /api/amfi-marketcap with parse_only=true
      // so the server parses and returns sample + distribution without committing
      fetch('/api/amfi-marketcap', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          parse_only: true,
          filename:   f.name,
          fileBase64: b64,
        }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.error) { setError(d.error); setParsing(false); return; }
          setPreview(d.preview);
          setParsing(false);
        })
        .catch(err => {
          setError('Failed to parse file: ' + err.message);
          setParsing(false);
        });
    };
    reader.readAsArrayBuffer(f);
  };

  // ── Submit upload ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!fileBase64 || !effectiveFrom || !file) {
      setError('Please select a file and set the effective from date.');
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const res = await fetch('/api/amfi-marketcap', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          parse_only:     false,
          filename:       file.name,
          fileBase64,
          effective_from: effectiveFrom,
          effective_to:   effectiveTo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload failed');
      setResult(data);
      // Reset form
      setFile(null);
      setFileBase64(null);
      setPreview(null);
      setEffectiveFrom('');
      setEffectiveTo('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const page  = { minHeight:'100vh', background:'#fafaf8', fontFamily:"'DM Sans','Segoe UI',sans-serif", padding:'28px 20px 60px' };
  const card  = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, marginBottom:20, overflow:'hidden' };
  const hdr   = { padding:'16px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:10 };
  const body  = { padding:'20px 22px' };
  const label = { fontSize:12, fontWeight:700, color:'#374151', marginBottom:6, display:'block' };
  const input = {
    width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e2e8f0',
    fontSize:13, color:'#0f172a', background:'#fff', boxSizing:'border-box',
    fontFamily:"'DM Sans',sans-serif", outline:'none',
  };
  const btn = (variant='primary') => ({
    padding:'10px 24px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
    border:'none', transition:'all 0.15s',
    ...(variant === 'primary'
      ? { background:'#4338ca', color:'#fff' }
      : { background:'#f1f5f9', color:'#374151', border:'1.5px solid #e2e8f0' }
    ),
  });

  return (
    <div style={page}>
      <div style={{ maxWidth:780, margin:'0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom:24 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:6, background:'#eff6ff',
            border:'1px solid #bfdbfe', borderRadius:20, padding:'3px 12px',
            fontSize:12, fontWeight:600, color:'#1d4ed8', marginBottom:10,
          }}>
            📊 Admin · Portfolio Data
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#0f172a', margin:'0 0 6px' }}>
            AMFI Market Cap Upload
          </h1>
          <p style={{ fontSize:13, color:'#64748b', margin:0, lineHeight:1.6 }}>
            Upload the half-yearly AMFI Average Market Capitalisation file.
            Securities are classified as Large Cap (top 100), Mid Cap (101–250), and Small Cap (251+)
            per SEBI circular dated Oct 6, 2017. This data drives market cap exposure in all portfolio tools.
          </p>
        </div>

        {/* Success banner */}
        {result?.success && (
          <div style={{
            background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12,
            padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12,
          }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontWeight:700, color:'#15803d', fontSize:14 }}>
                Upload complete — {result.inserted?.toLocaleString()} securities loaded
              </div>
              <div style={{ fontSize:12, color:'#166534', marginTop:2 }}>
                Period: {fmtDate(result.period?.effective_from)}
                {result.period?.effective_to ? ` → ${fmtDate(result.period.effective_to)}` : ' → present'}
                {result.github_path && ` · Backed up to GitHub at ${result.github_path}`}
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12,
            padding:'12px 16px', marginBottom:20, fontSize:13, color:'#dc2626',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Upload form */}
        <div style={card}>
          <div style={hdr}>
            <span style={{ background:'#4338ca', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>1</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Set Effective Period</span>
          </div>
          <div style={body}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div>
                <label style={label}>Effective From <span style={{ color:'#dc2626' }}>*</span></label>
                <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} style={input}/>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                  Start date this list is valid — e.g. 2025-07-01 for the Jun 2025 file
                </div>
              </div>
              <div>
                <label style={label}>Effective To <span style={{ color:'#94a3b8', fontWeight:400 }}>(optional)</span></label>
                <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} style={input}/>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                  Leave blank — auto-filled when next period is uploaded
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={hdr}>
            <span style={{ background:'#4338ca', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>2</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Select AMFI Excel File (.xlsx)</span>
          </div>
          <div style={body}>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border:'2px dashed #c7d2fe', borderRadius:12, padding:'32px 20px',
                textAlign:'center', cursor:'pointer', background:'#f8faff',
                transition:'all 0.15s', marginBottom:16,
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleFileChange({ target:{ files:[f] } }); } }}
            >
              <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#4338ca' }}>
                {file ? file.name : 'Click to select or drag & drop'}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                {file
                  ? `${(file.size / 1024).toFixed(0)} KB · Ready to upload`
                  : 'AMFI Average Market Capitalisation .xlsx file'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={handleFileChange}/>

            {/* Parsing indicator */}
            {parsing && (
              <div style={{ textAlign:'center', padding:'12px 0', color:'#4338ca', fontSize:13, fontWeight:600 }}>
                ⏳ Parsing file…
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div style={{ marginTop:4 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:10 }}>
                  File Preview — {preview.total?.toLocaleString()} securities detected
                </div>

                {/* Distribution */}
                <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                  {Object.entries(preview.distribution ?? {}).map(([cat, count]) => {
                    const c = CAP_COLORS[cat] ?? CAP_COLORS['Small Cap'];
                    return (
                      <div key={cat} style={{
                        flex:1, background:c.bg, border:`1.5px solid ${c.border}`,
                        borderRadius:10, padding:'12px 14px', textAlign:'center',
                      }}>
                        <div style={{ fontSize:22, fontWeight:800, color:c.text, fontFamily:"'DM Mono',monospace" }}>{count}</div>
                        <div style={{ fontSize:11, color:c.text, marginTop:2 }}>{cat}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Sample rows */}
                {preview.sample?.length > 0 && (
                  <div style={{ overflowX:'auto' }}>
                    <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6 }}>Sample rows (first 5)</div>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                      <thead>
                        <tr>
                          {['ISIN','Company','BSE Symbol','NSE Symbol','Avg MCap (Cr)','Category'].map(h => (
                            <th key={h} style={{ padding:'6px 10px', borderBottom:'2px solid #f1f5f9', color:'#94a3b8', fontWeight:600, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample.map((row, i) => {
                          const c = CAP_COLORS[row.market_cap_sebi] ?? CAP_COLORS['Small Cap'];
                          return (
                            <tr key={i} style={{ borderBottom:'1px solid #f8fafc' }}>
                              <td style={{ padding:'6px 10px', fontFamily:"'DM Mono',monospace", color:'#374151', fontSize:10 }}>{row.isin}</td>
                              <td style={{ padding:'6px 10px', color:'#0f172a', fontWeight:600 }}>{row.company_name}</td>
                              <td style={{ padding:'6px 10px', color:'#64748b', fontFamily:"'DM Mono',monospace" }}>{row.bse_symbol ?? '—'}</td>
                              <td style={{ padding:'6px 10px', color:'#64748b', fontFamily:"'DM Mono',monospace" }}>{row.nse_symbol ?? '—'}</td>
                              <td style={{ padding:'6px 10px', color:'#374151', fontFamily:"'DM Mono',monospace", textAlign:'right' }}>
                                {row.avg_mcap_all != null ? Number(row.avg_mcap_all).toLocaleString('en-IN', { maximumFractionDigits:0 }) : '—'}
                              </td>
                              <td style={{ padding:'6px 10px' }}>
                                <span style={{ background:c.bg, border:`1px solid ${c.border}`, color:c.text, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                                  {row.market_cap_sebi}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload button */}
        {preview && (
          <div style={{ ...card }}>
            <div style={hdr}>
              <span style={{ background:'#4338ca', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>3</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Confirm & Upload</span>
            </div>
            <div style={body}>
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#92400e', lineHeight:1.6 }}>
                <b>⚠️ This will deactivate the current active period</b> and replace it with this upload.
                Historical data is preserved — this action cannot be undone, but previous periods remain in the database.
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !effectiveFrom}
                  style={{ ...btn('primary'), opacity: (uploading || !effectiveFrom) ? 0.6 : 1 }}
                >
                  {uploading ? '⏳ Uploading…' : `✅ Upload ${preview.total?.toLocaleString()} Securities`}
                </button>
                <button onClick={() => { setFile(null); setFileBase64(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }} style={btn('secondary')}>
                  ✕ Cancel
                </button>
                {!effectiveFrom && (
                  <span style={{ fontSize:12, color:'#dc2626' }}>Set effective from date to continue</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload history */}
        <div style={card}>
          <div style={hdr}>
            <span style={{ background:'#64748b', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>📋</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Upload History</span>
          </div>
          <div style={body}>
            {historyLoading ? (
              <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>Loading…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'#94a3b8', fontSize:13 }}>
                No uploads yet. Upload your first AMFI market cap file above.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {history.map((p, i) => <HistoryCard key={i} period={p}/>)}
              </div>
            )}
          </div>
        </div>

        {/* Methodology note */}
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#64748b' }}>Source:</b> AMFI Average Market Capitalisation of listed companies — published half-yearly (Jan and Jul).
          Classification: <b>Large Cap</b> = top 100 by avg market cap · <b>Mid Cap</b> = 101–250 · <b>Small Cap</b> = 251 and below.
          Per SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114 dated Oct 6, 2017.
          This classification is used for security-level cap exposure in scheme portfolios and overrides AMC-declared categories.
        </div>

      </div>
    </div>
  );
}
