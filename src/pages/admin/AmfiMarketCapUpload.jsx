// src/pages/admin/AmfiMarketCapUpload.jsx
// Admin utility — AMFI Market Cap File Upload
// Architecture v2: xlsx parsed CLIENT-SIDE via SheetJS (CDN, no package.json dep)
// Only clean JSON rows sent to API — no base64, no server-side parsing
// GitHub backup done client-side via VITE_GITHUB_PAT

import { useState, useEffect, useRef } from 'react';

const GITHUB_PAT  = import.meta.env.VITE_GITHUB_PAT;
const GITHUB_REPO = 'anjaneyakg/FundInsight';

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

// ── Load SheetJS from CDN (once) ─────────────────────────────────────────────
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload  = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load SheetJS'));
    document.head.appendChild(script);
  });
}

// ── Parse AMFI xlsx using SheetJS ────────────────────────────────────────────
// Col layout (0-based after header skip):
//   0=Rank, 1=Company Name, 2=ISIN, 3=BSE Symbol, 4=BSE Avg MCap,
//   5=NSE Symbol, 6=NSE Avg MCap, 7=MSEI Symbol, 8=MSEI Avg MCap,
//   9=Avg All Exchanges, 10=SEBI Category
async function parseXlsx(file) {
  const XLSX    = await loadSheetJS();
  const buffer  = await file.arrayBuffer();
  const wb      = XLSX.read(buffer, { type:'array', cellFormula:false, cellNF:false });
  const ws      = wb.Sheets[wb.SheetNames[0]];
  // Get raw 2D array, skip first 2 header rows
  const raw     = XLSX.utils.sheet_to_json(ws, { header:1, defval:null });

  const rows = [];
  for (let i = 2; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.length < 11) continue;

    const isin         = r[2]?.toString()?.trim();
    const company_name = r[1]?.toString()?.trim();
    const market_cap   = r[10]?.toString()?.trim();

    if (!isin || !company_name || !market_cap) continue;
    if (!/^IN[A-Z0-9]{10}$/.test(isin)) continue;
    if (!['Large Cap','Mid Cap','Small Cap'].includes(market_cap)) continue;

    const bse_avg  = parseFloat(r[4])  || null;
    const nse_avg  = parseFloat(r[6])  || null;
    const msei_avg = parseFloat(r[8])  || null;
    let avg_all    = parseFloat(r[9])  || null;

    // Fallback: compute average if formula didn't resolve
    if (!avg_all) {
      const vals = [bse_avg, nse_avg, msei_avg].filter(v => v != null && v > 0);
      avg_all = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }

    rows.push({
      isin,
      company_name,
      bse_symbol:     r[3]?.toString()?.trim() || null,
      nse_symbol:     r[5]?.toString()?.trim() || null,
      msei_symbol:    r[7]?.toString()?.trim() || null,
      bse_avg_mcap:   bse_avg,
      nse_avg_mcap:   nse_avg,
      msei_avg_mcap:  msei_avg,
      avg_mcap_all:   avg_all,
      market_cap_sebi: market_cap,
    });
  }
  return rows;
}

// ── GitHub backup — client-side via VITE_GITHUB_PAT ──────────────────────────
async function backupToGitHub(file) {
  const path   = `data/amfi-marketcap/${file.name}`;
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;

  // Read file as base64
  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Check if file already exists (get SHA)
  let sha;
  try {
    const check = await fetch(apiUrl, {
      headers: { 'Authorization':`Bearer ${GITHUB_PAT}`, 'Accept':'application/vnd.github.v3+json' },
    });
    if (check.ok) sha = (await check.json()).sha;
  } catch (_) {}

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      message: `Add AMFI market cap file: ${file.name}`,
      content: b64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) throw new Error(`GitHub backup: ${res.status}`);
  return path;
}

// ── History Card ──────────────────────────────────────────────────────────────
function HistoryCard({ period }) {
  const dist = period.distribution ?? {};
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          {period.is_active && (
            <span style={{ background:'#4338ca', color:'#fff', fontSize:10, fontWeight:700, borderRadius:20, padding:'2px 10px', letterSpacing:0.5 }}>ACTIVE</span>
          )}
          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a', fontFamily:"'DM Mono',monospace" }}>
            {fmtDate(period.effective_from)}{period.effective_to ? ` → ${fmtDate(period.effective_to)}` : ' → present'}
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
            <div key={cat} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:8, padding:'4px 10px', textAlign:'center', minWidth:70 }}>
              <div style={{ fontSize:13, fontWeight:800, color:c.text, fontFamily:"'DM Mono',monospace" }}>{count}</div>
              <div style={{ fontSize:9, color:c.text, opacity:0.8 }}>{cat.replace(' Cap','')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AmfiMarketCapUpload() {
  const fileRef = useRef(null);

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo,   setEffectiveTo]   = useState('');
  const [file,          setFile]          = useState(null);
  const [parsedRows,    setParsedRows]    = useState(null); // parsed client-side
  const [preview,       setPreview]       = useState(null);
  const [parsing,       setParsing]       = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState(null);
  const [history,       setHistory]       = useState([]);
  const [historyLoading,setHistoryLoading]= useState(true);

  // Load history on mount + after successful upload
  useEffect(() => {
    setHistoryLoading(true);
    fetch('/api/amfi-marketcap')
      .then(r => r.json())
      .then(d => { setHistory(d.history ?? []); setHistoryLoading(false); })
      .catch(() => setHistoryLoading(false));
  }, [result]);

  // ── File selection → parse client-side ──────────────────────────────────
  const handleFileChange = async e => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.endsWith('.xlsx')) {
      setError('Please select an .xlsx file.');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError('File exceeds 15MB. Please check you have the correct file.');
      return;
    }

    setFile(f);
    setError(null);
    setPreview(null);
    setParsedRows(null);
    setParsing(true);

    try {
      const rows = await parseXlsx(f);
      if (!rows.length) throw new Error('No valid rows found. Check this is the AMFI market cap .xlsx file.');

      const dist = { 'Large Cap': 0, 'Mid Cap': 0, 'Small Cap': 0 };
      rows.forEach(r => { if (dist[r.market_cap_sebi] !== undefined) dist[r.market_cap_sebi]++; });

      const warnings = [];
      if (dist['Large Cap'] !== 100) warnings.push(`Expected 100 Large Cap, found ${dist['Large Cap']}.`);
      if (dist['Mid Cap']   !== 150) warnings.push(`Expected 150 Mid Cap, found ${dist['Mid Cap']}.`);

      setParsedRows(rows);
      setPreview({ total: rows.length, distribution: dist, sample: rows.slice(0, 5), warnings });
    } catch (err) {
      setError('Parse error: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  // ── Upload — send parsed rows to API + backup to GitHub ──────────────────
  const handleUpload = async () => {
    if (!parsedRows?.length || !effectiveFrom) {
      setError('Ensure file is parsed and effective from date is set.');
      return;
    }
    setUploading(true);
    setError(null);

    try {
      // Step 1 — send parsed rows to API (no base64, no xlsx)
      const res = await fetch('/api/amfi-marketcap', {
        method:  'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          rows:           parsedRows,
          effective_from: effectiveFrom,
          effective_to:   effectiveTo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload failed');

      // Step 2 — backup raw file to GitHub (non-fatal)
      let githubPath = null;
      try {
        githubPath = await backupToGitHub(file);
      } catch (ghErr) {
        console.error('GitHub backup non-fatal:', ghErr.message);
      }

      setResult({ ...data, github_path: githubPath });
      // Reset form
      setFile(null);
      setParsedRows(null);
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

  // ── Styles ────────────────────────────────────────────────────────────────
  const card  = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, marginBottom:20, overflow:'hidden' };
  const hdr   = { padding:'16px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:10 };
  const body  = { padding:'20px 22px' };
  const label = { fontSize:12, fontWeight:700, color:'#374151', marginBottom:6, display:'block' };
  const input = { width:'100%', padding:'10px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', fontSize:13, color:'#0f172a', background:'#fff', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif", outline:'none' };
  const btnPrimary   = { padding:'10px 24px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:'none', background:'#4338ca', color:'#fff' };
  const btnSecondary = { padding:'10px 24px', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer', border:'1.5px solid #e2e8f0', background:'#f1f5f9', color:'#374151' };

  return (
    <div style={{ minHeight:'100vh', background:'#fafaf8', fontFamily:"'DM Sans','Segoe UI',sans-serif", padding:'28px 20px 60px' }}>
      <div style={{ maxWidth:780, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600, color:'#1d4ed8', marginBottom:10 }}>
            📊 Admin · Portfolio Data
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#0f172a', margin:'0 0 6px' }}>AMFI Market Cap Upload</h1>
          <p style={{ fontSize:13, color:'#64748b', margin:0, lineHeight:1.6 }}>
            Upload the half-yearly AMFI Average Market Capitalisation file. Securities are classified as Large Cap (top 100), Mid Cap (101–250), and Small Cap (251+) per SEBI circular dated Oct 6, 2017.
          </p>
        </div>

        {/* Success banner */}
        {result?.success && (
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontWeight:700, color:'#15803d', fontSize:14 }}>
                Upload complete — {result.inserted?.toLocaleString()} securities loaded
              </div>
              <div style={{ fontSize:12, color:'#166534', marginTop:2 }}>
                Period: {fmtDate(result.period?.effective_from)} → present
                {result.github_path && ` · Backed up to GitHub`}
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#dc2626' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Step 1 — Effective period */}
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
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>e.g. 2025-07-01 for the Jun 2025 file</div>
              </div>
              <div>
                <label style={label}>Effective To <span style={{ color:'#94a3b8', fontWeight:400 }}>(optional)</span></label>
                <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} style={input}/>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Leave blank — auto-filled on next upload</div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 — File select */}
        <div style={card}>
          <div style={hdr}>
            <span style={{ background:'#4338ca', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>2</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Select AMFI Excel File (.xlsx)</span>
          </div>
          <div style={body}>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileChange({ target:{ files:[f] } }); }}
              style={{ border:'2px dashed #c7d2fe', borderRadius:12, padding:'32px 20px', textAlign:'center', cursor:'pointer', background:'#f8faff', marginBottom:16 }}
            >
              <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#4338ca' }}>
                {file ? file.name : 'Click to select or drag & drop'}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
                {file ? `${(file.size/1024).toFixed(0)} KB · Parsed in browser` : 'AMFI Average Market Capitalisation .xlsx'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display:'none' }} onChange={handleFileChange}/>

            {parsing && (
              <div style={{ textAlign:'center', padding:'12px 0', color:'#4338ca', fontSize:13, fontWeight:600 }}>
                ⏳ Parsing file in browser…
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:10 }}>
                  File Preview — {preview.total?.toLocaleString()} securities detected
                </div>

                {/* Warnings */}
                {preview.warnings?.length > 0 && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#92400e' }}>
                    {preview.warnings.map((w,i) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}

                {/* Distribution */}
                <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                  {Object.entries(preview.distribution ?? {}).map(([cat, count]) => {
                    const c = CAP_COLORS[cat] ?? CAP_COLORS['Small Cap'];
                    return (
                      <div key={cat} style={{ flex:1, background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:10, padding:'12px 14px', textAlign:'center' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:c.text, fontFamily:"'DM Mono',monospace" }}>{count}</div>
                        <div style={{ fontSize:11, color:c.text, marginTop:2 }}>{cat}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Sample table */}
                {preview.sample?.length > 0 && (
                  <div style={{ overflowX:'auto' }}>
                    <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6 }}>Sample rows (first 5)</div>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                      <thead>
                        <tr>{['ISIN','Company','BSE','NSE','Avg MCap (Cr)','Category'].map(h => (
                          <th key={h} style={{ padding:'6px 10px', borderBottom:'2px solid #f1f5f9', color:'#94a3b8', fontWeight:600, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                        ))}</tr>
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

        {/* Step 3 — Confirm */}
        {preview && (
          <div style={card}>
            <div style={hdr}>
              <span style={{ background:'#4338ca', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>3</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>Confirm & Upload</span>
            </div>
            <div style={body}>
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:12, color:'#92400e', lineHeight:1.6 }}>
                <b>⚠️ This will deactivate the current active period</b> and replace it with this upload.
                Historical data is preserved — previous periods remain in the database.
              </div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !effectiveFrom}
                  style={{ ...btnPrimary, opacity:(uploading || !effectiveFrom) ? 0.6 : 1 }}
                >
                  {uploading ? '⏳ Uploading…' : `✅ Upload ${preview.total?.toLocaleString()} Securities`}
                </button>
                <button
                  onClick={() => { setFile(null); setParsedRows(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  style={btnSecondary}
                >
                  ✕ Cancel
                </button>
                {!effectiveFrom && <span style={{ fontSize:12, color:'#dc2626' }}>Set effective from date first</span>}
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

        {/* Methodology */}
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', fontSize:12, color:'#94a3b8', lineHeight:1.7 }}>
          <b style={{ color:'#64748b' }}>Source:</b> AMFI Average Market Capitalisation — published half-yearly (Jan and Jul).
          <b> Large Cap</b> = top 100 · <b>Mid Cap</b> = 101–250 · <b>Small Cap</b> = 251+.
          Per SEBI Circular dated Oct 6, 2017. Overrides AMC-declared categories for all portfolio tools.
        </div>

      </div>
    </div>
  );
}
