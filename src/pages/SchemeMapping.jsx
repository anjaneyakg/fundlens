// src/pages/SchemeMapping.jsx
// Admin tool — maps AMC-internal scheme codes to canonical AMFI scheme names.
// Saves mapping to data/processed/scheme_code_map.json in FundInsight repo.
// Route: /admin/scheme-mapping

import { useState, useEffect, useRef, useCallback } from 'react'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Syne:wght@400;600;700&display=swap');

  .sm-root {
    min-height: 100vh;
    background: #f7f6f3;
    font-family: 'DM Mono', monospace;
    color: #1a1830;
  }

  /* ── HEADER ── */
  .sm-header {
    background: #fff;
    border-bottom: 1px solid rgba(99,91,255,0.1);
    padding: 1.25rem 2rem;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 100;
    box-shadow: 0 2px 12px rgba(99,91,255,0.05);
  }
  .sm-header-left { display: flex; align-items: center; gap: 14px; }
  .sm-header-pill {
    background: rgba(99,91,255,0.08); color: #635bff;
    border: 1px solid rgba(99,91,255,0.18);
    border-radius: 6px; padding: 3px 10px;
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
  }
  .sm-header-title {
    font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 700;
    color: #1a1830; letter-spacing: -0.3px;
  }
  .sm-header-sub { font-size: 10px; color: #9aa0c8; letter-spacing: 0.5px; margin-top: 1px; }
  .sm-save-btn {
    background: linear-gradient(135deg, #635bff, #4f46e5);
    color: #fff; border: none; border-radius: 8px;
    padding: 8px 20px; font-family: 'DM Mono'; font-size: 11px;
    letter-spacing: 0.5px; cursor: pointer;
    box-shadow: 0 3px 10px rgba(99,91,255,0.25);
    transition: all 0.15s; display: flex; align-items: center; gap: 8px;
  }
  .sm-save-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(99,91,255,0.35); }
  .sm-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── STATS BAR ── */
  .sm-stats {
    display: flex; gap: 1px;
    background: rgba(99,91,255,0.08);
    border-radius: 10px; overflow: hidden;
    margin: 1.25rem 2rem 0;
  }
  .sm-stat {
    background: #fff; flex: 1; padding: 12px 16px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .sm-stat-val {
    font-family: 'Syne'; font-size: 1.4rem; font-weight: 700;
    color: #1a1830; line-height: 1;
  }
  .sm-stat-val.green { color: #16a34a; }
  .sm-stat-val.amber { color: #d97706; }
  .sm-stat-val.red   { color: #dc2626; }
  .sm-stat-label { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #9aa0c8; }

  /* ── PROGRESS BAR ── */
  .sm-progress-wrap { margin: 1rem 2rem 0; }
  .sm-progress-track {
    height: 4px; background: rgba(99,91,255,0.08); border-radius: 4px; overflow: hidden;
  }
  .sm-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #635bff, #16a34a);
    border-radius: 4px;
    transition: width 0.4s ease;
  }
  .sm-progress-label { font-size: 10px; color: #9aa0c8; margin-top: 4px; letter-spacing: 0.3px; }

  /* ── LAYOUT ── */
  .sm-body { display: flex; gap: 0; height: calc(100vh - 180px); margin-top: 1.25rem; }

  /* ── AMC SIDEBAR ── */
  .sm-amc-list {
    width: 260px; flex-shrink: 0;
    background: #fff; border-right: 1px solid rgba(99,91,255,0.08);
    overflow-y: auto; padding: 8px 0;
  }
  .sm-amc-search {
    margin: 8px 10px 4px;
    padding: 7px 10px;
    border: 1px solid rgba(99,91,255,0.15);
    border-radius: 7px; background: #f7f6f3;
    font-family: 'DM Mono'; font-size: 11px; color: #1a1830;
    outline: none; width: calc(100% - 20px); box-sizing: border-box;
  }
  .sm-amc-search:focus { border-color: #635bff; background: #fff; }
  .sm-amc-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 14px; cursor: pointer;
    border-left: 3px solid transparent;
    transition: all 0.1s;
  }
  .sm-amc-item:hover { background: rgba(99,91,255,0.04); }
  .sm-amc-item.active {
    background: rgba(99,91,255,0.06);
    border-left-color: #635bff;
  }
  .sm-amc-name { font-size: 11px; color: #2d2b4e; line-height: 1.3; }
  .sm-amc-item.active .sm-amc-name { color: #635bff; font-weight: 500; }
  .sm-amc-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; margin-left: 8px; }
  .sm-badge {
    font-size: 9px; letter-spacing: 0.3px; padding: 1px 6px;
    border-radius: 8px; white-space: nowrap;
  }
  .sm-badge.done  { background: rgba(22,163,74,0.1);  color: #16a34a; border: 1px solid rgba(22,163,74,0.2); }
  .sm-badge.part  { background: rgba(217,119,6,0.1);  color: #d97706; border: 1px solid rgba(217,119,6,0.2); }
  .sm-badge.none  { background: rgba(220,38,38,0.08); color: #dc2626; border: 1px solid rgba(220,38,38,0.15); }
  .sm-badge.clean { background: rgba(99,91,255,0.07); color: #635bff; border: 1px solid rgba(99,91,255,0.15); }

  /* ── MAIN PANEL ── */
  .sm-main { flex: 1; overflow-y: auto; padding: 0; }

  /* ── EMPTY STATE ── */
  .sm-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 12px; color: #9aa0c8;
  }
  .sm-empty-icon { font-size: 2.5rem; opacity: 0.4; }
  .sm-empty-text { font-size: 12px; letter-spacing: 0.5px; }

  /* ── AMC HEADER IN MAIN ── */
  .sm-amc-header {
    padding: 16px 24px 12px;
    background: #fff; border-bottom: 1px solid rgba(99,91,255,0.08);
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sm-amc-title { font-family: 'Syne'; font-size: 1rem; font-weight: 700; color: #1a1830; }
  .sm-amc-meta { font-size: 10px; color: #9aa0c8; letter-spacing: 0.3px; margin-top: 2px; }
  .sm-filter-tabs { display: flex; gap: 4px; }
  .sm-filter-tab {
    padding: 5px 12px; border-radius: 6px; font-size: 10px; letter-spacing: 0.5px;
    border: 1px solid rgba(99,91,255,0.15); background: transparent;
    color: #9aa0c8; cursor: pointer; font-family: 'DM Mono';
    transition: all 0.15s;
  }
  .sm-filter-tab.active { background: #635bff; color: #fff; border-color: #635bff; }
  .sm-filter-tab:hover:not(.active) { color: #635bff; border-color: rgba(99,91,255,0.3); }

  /* ── SCHEME ROWS ── */
  .sm-scheme-list { padding: 8px 0; }
  .sm-scheme-row {
    display: grid;
    grid-template-columns: 160px 1fr 32px;
    gap: 0;
    align-items: stretch;
    border-bottom: 1px solid rgba(99,91,255,0.06);
    transition: background 0.1s;
    min-height: 52px;
  }
  .sm-scheme-row:hover { background: rgba(99,91,255,0.02); }
  .sm-scheme-row.mapped { }
  .sm-scheme-row.unmapped { background: rgba(220,38,38,0.02); }

  .sm-code-cell {
    padding: 12px 16px;
    border-right: 1px solid rgba(99,91,255,0.06);
    display: flex; flex-direction: column; justify-content: center; gap: 3px;
  }
  .sm-code-val {
    font-size: 11px; font-weight: 500; color: #2d2b4e;
    font-family: 'DM Mono'; letter-spacing: 0.3px;
  }
  .sm-code-rows { font-size: 9px; color: #b0b8d8; letter-spacing: 0.3px; }

  .sm-name-cell {
    padding: 8px 12px;
    display: flex; align-items: center;
  }
  .sm-name-input-wrap { position: relative; width: 100%; }
  .sm-name-input {
    width: 100%; padding: 7px 10px;
    border: 1px solid rgba(99,91,255,0.15);
    border-radius: 7px; background: #f7f6f3;
    font-family: 'DM Mono'; font-size: 11px; color: #1a1830;
    outline: none; box-sizing: border-box;
    transition: all 0.15s;
  }
  .sm-name-input:focus { border-color: #635bff; background: #fff; box-shadow: 0 0 0 3px rgba(99,91,255,0.08); }
  .sm-name-input.has-value { background: rgba(22,163,74,0.04); border-color: rgba(22,163,74,0.25); }
  .sm-name-input.has-value:focus { border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.08); }

  /* Autocomplete dropdown */
  .sm-autocomplete {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    background: #fff; border: 1px solid rgba(99,91,255,0.15);
    border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.1);
    max-height: 220px; overflow-y: auto; z-index: 200;
  }
  .sm-ac-item {
    padding: 8px 12px; font-size: 11px; color: #2d2b4e;
    cursor: pointer; transition: background 0.1s;
    border-bottom: 1px solid rgba(99,91,255,0.05);
  }
  .sm-ac-item:last-child { border-bottom: none; }
  .sm-ac-item:hover, .sm-ac-item.highlighted { background: rgba(99,91,255,0.06); color: #635bff; }
  .sm-ac-item mark { background: rgba(99,91,255,0.15); color: #635bff; border-radius: 2px; padding: 0 1px; }
  .sm-ac-empty { padding: 10px 12px; font-size: 10px; color: #b0b8d8; font-style: italic; }

  .sm-clear-cell {
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px;
    border-left: 1px solid rgba(99,91,255,0.06);
  }
  .sm-clear-btn {
    width: 20px; height: 20px; border-radius: 50%;
    border: 1px solid rgba(220,38,38,0.2); background: transparent;
    color: #dc2626; font-size: 12px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: all 0.15s; line-height: 1;
  }
  .sm-scheme-row:hover .sm-clear-btn { opacity: 0.6; }
  .sm-clear-btn:hover { opacity: 1 !important; background: rgba(220,38,38,0.06); }

  /* ── TOAST ── */
  .sm-toast {
    position: fixed; bottom: 24px; right: 24px;
    background: #1a1830; color: #fff;
    padding: 10px 18px; border-radius: 10px;
    font-size: 11px; letter-spacing: 0.3px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.18);
    display: flex; align-items: center; gap: 8px;
    animation: slideUp 0.25s ease; z-index: 999;
  }
  .sm-toast.success { border-left: 3px solid #16a34a; }
  .sm-toast.error   { border-left: 3px solid #dc2626; }
  @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

  /* ── LOADING ── */
  .sm-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 12px; color: #9aa0c8;
  }
  .sm-spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid rgba(99,91,255,0.15);
    border-top-color: #635bff;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sm-loading-text { font-size: 11px; letter-spacing: 0.5px; }

  @media (max-width: 768px) {
    .sm-body { flex-direction: column; height: auto; }
    .sm-amc-list { width: 100%; height: 200px; border-right: none; border-bottom: 1px solid rgba(99,91,255,0.08); }
    .sm-stats { margin: 1rem 1rem 0; }
    .sm-header { padding: 1rem; }
    .sm-progress-wrap { margin: 1rem 1rem 0; }
  }
`

// ── Highlight matching text in autocomplete ──────────────────────────────────
function highlight(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Single scheme row ────────────────────────────────────────────────────────
function SchemeRow({ code, rowCount, currentName, amfiSchemes, onChange }) {
  const [query, setQuery]     = useState(currentName || '')
  const [open, setOpen]       = useState(false)
  const [hiIdx, setHiIdx]     = useState(-1)
  const inputRef              = useRef(null)
  const dropRef               = useRef(null)

  // Keep in sync if parent mapping changes (e.g. on load)
  useEffect(() => { setQuery(currentName || '') }, [currentName])

  const filtered = query.length >= 1
    ? amfiSchemes.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : amfiSchemes.slice(0, 12)

  const commit = useCallback((val) => {
    setQuery(val)
    setOpen(false)
    setHiIdx(-1)
    onChange(code, val || null)
  }, [code, onChange])

  const handleKey = (e) => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setHiIdx(0) } ; return }
    if (e.key === 'ArrowDown')  { setHiIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')    { setHiIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')      { if (hiIdx >= 0) commit(filtered[hiIdx]); else { commit(query); } }
    if (e.key === 'Escape')     { setOpen(false) }
    if (e.key === 'Tab')        { if (hiIdx >= 0) { e.preventDefault(); commit(filtered[hiIdx]) } else commit(query) }
  }

  const isMapped = !!currentName

  return (
    <div className={`sm-scheme-row ${isMapped ? 'mapped' : 'unmapped'}`}>
      <div className="sm-code-cell">
        <span className="sm-code-val">{code || '—'}</span>
        <span className="sm-code-rows">{rowCount} holdings</span>
      </div>
      <div className="sm-name-cell">
        <div className="sm-name-input-wrap">
          <input
            ref={inputRef}
            className={`sm-name-input ${isMapped ? 'has-value' : ''}`}
            value={query}
            placeholder="Type to search AMFI scheme name…"
            onChange={e => { setQuery(e.target.value); setOpen(true); setHiIdx(-1) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            onKeyDown={handleKey}
          />
          {open && (
            <div className="sm-autocomplete" ref={dropRef}>
              {filtered.length === 0
                ? <div className="sm-ac-empty">No matches — type exact name to save custom</div>
                : filtered.map((s, i) => (
                  <div
                    key={s}
                    className={`sm-ac-item ${i === hiIdx ? 'highlighted' : ''}`}
                    onMouseDown={() => commit(s)}
                  >
                    {highlight(s, query)}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
      <div className="sm-clear-cell">
        {isMapped && (
          <button className="sm-clear-btn" title="Clear mapping" onClick={() => commit('')}>×</button>
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SchemeMapping() {
  const [holdings, setHoldings]     = useState([])   // [{amc_name, scheme_code_amc, rows}]
  const [amfiMap, setAmfiMap]       = useState({})   // {amc_name: [scheme_name, ...]}
  const [mapping, setMapping]       = useState({})   // {amc_name: {code: amfi_name}}
  const [selectedAmc, setSelected]  = useState(null)
  const [filter, setFilter]         = useState('all') // all | unmapped | mapped
  const [amcSearch, setAmcSearch]   = useState('')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState(null)
  const [dirty, setDirty]           = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load holdings CSV + AMFI master + existing mapping ──────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // 1. Holdings CSV (via proxy)
        const csvRes = await fetch('/api/holdings-csv')
        const csv    = await csvRes.text()
        const rows   = csv.trim().split('\n')
        const header = rows[0].split(',').map(h => h.trim())
        const amcIdx  = header.indexOf('amc_name')
        const codeIdx = header.indexOf('scheme_code_amc')

        const codeCount = {}  // {amc|code: count}
        for (let i = 1; i < rows.length; i++) {
          const parts = rows[i].split(',')
          const amc   = parts[amcIdx]?.trim()
          const code  = parts[codeIdx]?.trim()
          if (!amc || !code) continue
          const key = `${amc}|||${code}`
          codeCount[key] = (codeCount[key] || 0) + 1
        }

        const holdingsList = Object.entries(codeCount).map(([key, cnt]) => {
          const [amc, code] = key.split('|||')
          return { amc_name: amc, scheme_code_amc: code, rows: cnt }
        })
        setHoldings(holdingsList)

        // 2. AMFI scheme master
        const amfiRes  = await fetch('/api/amfi-schemes-list')
        const amfiData = await amfiRes.json()
        setAmfiMap(amfiData.byAmc || {})

        // 3. Existing mapping from GitHub
        const mapRes = await fetch('/api/scheme-code-map')
        if (mapRes.ok) {
          const mapData = await mapRes.json()
          setMapping(mapData || {})
        }
      } catch (err) {
        console.error('SchemeMapping load error:', err)
        showToast('Failed to load data — ' + err.message, 'error')
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Derived stats ────────────────────────────────────────────────────────
  const amcStats = () => {
    const amcs = [...new Set(holdings.map(h => h.amc_name))].sort()
    return amcs.map(amc => {
      const codes    = holdings.filter(h => h.amc_name === amc)
      const mapped   = codes.filter(h => mapping[amc]?.[h.scheme_code_amc]).length
      const total    = codes.length
      const status   = mapped === 0 ? 'none' : mapped === total ? 'done' : 'part'
      const needsMap = total > 1  // single-code AMCs are fine
      return { amc, total, mapped, status, needsMap }
    })
  }

  const stats = amcStats()
  const totalCodes  = holdings.length
  const totalMapped = holdings.filter(h => mapping[h.amc_name]?.[h.scheme_code_amc]).length
  const pct         = totalCodes > 0 ? Math.round((totalMapped / totalCodes) * 100) : 0

  // ── Filter AMC sidebar ───────────────────────────────────────────────────
  const filteredAmcs = stats.filter(s =>
    s.amc.toLowerCase().includes(amcSearch.toLowerCase())
  )

  // ── Current AMC data ─────────────────────────────────────────────────────
  const currentCodes = selectedAmc
    ? holdings
        .filter(h => h.amc_name === selectedAmc)
        .sort((a, b) => a.scheme_code_amc.localeCompare(b.scheme_code_amc))
    : []

  const filteredCodes = currentCodes.filter(h => {
    const isMapped = !!mapping[selectedAmc]?.[h.scheme_code_amc]
    if (filter === 'unmapped') return !isMapped
    if (filter === 'mapped')   return isMapped
    return true
  })

  const amfiSchemes = selectedAmc
    ? (amfiMap[selectedAmc] || Object.values(amfiMap).flat())
    : []

  // ── Handle mapping change ────────────────────────────────────────────────
  const handleChange = useCallback((code, name) => {
    setMapping(prev => {
      const updated = { ...prev }
      if (!updated[selectedAmc]) updated[selectedAmc] = {}
      if (name) updated[selectedAmc][code] = name
      else      delete updated[selectedAmc][code]
      return updated
    })
    setDirty(true)
  }, [selectedAmc])

  // ── Save mapping to GitHub via API ───────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/scheme-code-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setDirty(false)
      showToast(`✓ Saved — ${totalMapped} mappings written to GitHub`)
    } catch (err) {
      console.error('Save error:', err)
      showToast('Save failed: ' + err.message, 'error')
    }
    setSaving(false)
  }

  // ── Selected AMC stats ───────────────────────────────────────────────────
  const selStat = stats.find(s => s.amc === selectedAmc)
  const unmappedCount = selStat ? selStat.total - selStat.mapped : 0

  return (
    <div className="sm-root">
      <style>{styles}</style>

      {/* Header */}
      <div className="sm-header">
        <div className="sm-header-left">
          <span className="sm-header-pill">Admin</span>
          <div>
            <div className="sm-header-title">Scheme Code Mapping</div>
            <div className="sm-header-sub">Map AMC-internal codes → canonical AMFI scheme names</div>
          </div>
        </div>
        <button
          className="sm-save-btn"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? '⏳ Saving…' : dirty ? '💾 Save Mappings' : '✓ Saved'}
        </button>
      </div>

      {/* Stats */}
      <div className="sm-stats">
        <div className="sm-stat">
          <span className="sm-stat-val">{totalCodes.toLocaleString()}</span>
          <span className="sm-stat-label">Total Codes</span>
        </div>
        <div className="sm-stat">
          <span className={`sm-stat-val ${totalMapped > 0 ? 'green' : ''}`}>{totalMapped.toLocaleString()}</span>
          <span className="sm-stat-label">Mapped</span>
        </div>
        <div className="sm-stat">
          <span className={`sm-stat-val ${totalCodes - totalMapped > 0 ? 'amber' : 'green'}`}>
            {(totalCodes - totalMapped).toLocaleString()}
          </span>
          <span className="sm-stat-label">Unmapped</span>
        </div>
        <div className="sm-stat">
          <span className={`sm-stat-val ${pct === 100 ? 'green' : pct > 50 ? 'amber' : 'red'}`}>{pct}%</span>
          <span className="sm-stat-label">Coverage</span>
        </div>
        <div className="sm-stat">
          <span className="sm-stat-val">{stats.length}</span>
          <span className="sm-stat-label">AMCs</span>
        </div>
      </div>

      {/* Progress */}
      <div className="sm-progress-wrap">
        <div className="sm-progress-track">
          <div className="sm-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="sm-progress-label">{totalMapped} of {totalCodes} scheme codes mapped</div>
      </div>

      {/* Body */}
      <div className="sm-body">

        {/* AMC sidebar */}
        <div className="sm-amc-list">
          <input
            className="sm-amc-search"
            placeholder="Search AMC…"
            value={amcSearch}
            onChange={e => setAmcSearch(e.target.value)}
          />
          {filteredAmcs.map(({ amc, total, mapped, status, needsMap }) => (
            <div
              key={amc}
              className={`sm-amc-item ${selectedAmc === amc ? 'active' : ''}`}
              onClick={() => { setSelected(amc); setFilter('all') }}
            >
              <div className="sm-amc-name">{amc.replace(' Mutual Fund', '')}</div>
              <div className="sm-amc-badges">
                {needsMap
                  ? <span className={`sm-badge ${status}`}>
                      {status === 'done' ? `${mapped}/${total} ✓` :
                       status === 'part' ? `${mapped}/${total}` :
                       `0/${total}`}
                    </span>
                  : <span className="sm-badge clean">auto</span>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div className="sm-main">
          {loading ? (
            <div className="sm-loading">
              <div className="sm-spinner" />
              <div className="sm-loading-text">Loading holdings + AMFI data…</div>
            </div>
          ) : !selectedAmc ? (
            <div className="sm-empty">
              <div className="sm-empty-icon">←</div>
              <div className="sm-empty-text">Select an AMC from the sidebar to begin mapping</div>
            </div>
          ) : (
            <>
              <div className="sm-amc-header">
                <div>
                  <div className="sm-amc-title">{selectedAmc}</div>
                  <div className="sm-amc-meta">
                    {selStat?.mapped}/{selStat?.total} mapped
                    {unmappedCount > 0 && ` · ${unmappedCount} remaining`}
                  </div>
                </div>
                <div className="sm-filter-tabs">
                  {['all','unmapped','mapped'].map(f => (
                    <button
                      key={f}
                      className={`sm-filter-tab ${filter === f ? 'active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {f === 'all' ? `All (${currentCodes.length})` :
                       f === 'unmapped' ? `Unmapped (${currentCodes.filter(h => !mapping[selectedAmc]?.[h.scheme_code_amc]).length})` :
                       `Mapped (${currentCodes.filter(h => !!mapping[selectedAmc]?.[h.scheme_code_amc]).length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column headers */}
              <div style={{
                display:'grid', gridTemplateColumns:'160px 1fr 32px',
                padding:'6px 0', background:'#f7f6f3',
                borderBottom:'1px solid rgba(99,91,255,0.08)',
                position:'sticky', top:'57px', zIndex:9
              }}>
                <div style={{padding:'0 16px', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', color:'#9aa0c8'}}>AMC Code</div>
                <div style={{padding:'0 12px', fontSize:'9px', letterSpacing:'1px', textTransform:'uppercase', color:'#9aa0c8'}}>AMFI Scheme Name</div>
              </div>

              <div className="sm-scheme-list">
                {filteredCodes.length === 0 ? (
                  <div className="sm-empty" style={{height:'200px'}}>
                    <div className="sm-empty-icon">✓</div>
                    <div className="sm-empty-text">
                      {filter === 'unmapped' ? 'All codes mapped for this AMC!' : 'No codes found'}
                    </div>
                  </div>
                ) : filteredCodes.map(h => (
                  <SchemeRow
                    key={`${h.amc_name}|||${h.scheme_code_amc}`}
                    code={h.scheme_code_amc}
                    rowCount={h.rows}
                    currentName={mapping[selectedAmc]?.[h.scheme_code_amc] || ''}
                    amfiSchemes={amfiSchemes}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`sm-toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
