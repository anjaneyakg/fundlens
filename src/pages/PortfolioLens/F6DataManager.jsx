import { useState, useCallback, useRef } from 'react'
import {
  hasConsent, saveConsent,
  getPortfolios, getPortfolio, addPortfolio, deletePortfolio, updatePortfolio, deleteAllData,
  newPortfolio,
} from './utils/portfolioStore'
import { detectAndParse } from './utils/fileParser'
import { mergeRawToHoldings } from './utils/portfolioEngine'

const ACC  = '#1D9E75'
const WARN = '#ef4444'

const CONSENT_ITEMS = [
  'My files are read entirely in my browser. No transaction data is ever sent to any server.',
  'Portfolio data (holdings, transactions) will be stored in my browser\'s local storage only.',
  'PAN numbers are never stored. Folio numbers are one-way hashed for privacy.',
  'I can permanently delete all my data at any time using the "Delete all my data" button.',
]

const SOURCE_META = {
  CAMS:     { label: 'CAMS',     color: '#635bff', desc: 'CAMS Transaction Export',   hint: 'covers CAMS-registered AMCs' },
  KFin:     { label: 'KFin',     color: '#f43f8e', desc: 'KFin Transaction Export',    hint: 'covers KFin-registered AMCs' },
  Holdings: { label: 'Holdings', color: '#f59e0b', desc: 'CAMS Current Valuation',     hint: 'optional — adds current NAV & value' },
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${dd} ${mon} ${d.getFullYear()}`
}

function mergedPii(raw) {
  const sources = ['cams', 'kfin', 'holdings'].map(k => raw?.[k]?.meta).filter(Boolean)
  return {
    pan_present:  sources.some(m => m.pan_present),
    folio_hashes: [...new Set(sources.flatMap(m => m.folio_hashes ?? []))],
  }
}

function deriveStatus(raw, holdings) {
  const hasCAMS     = Boolean(raw?.cams)
  const hasKFin     = Boolean(raw?.kfin)
  const hasHoldings = Boolean(raw?.holdings)
  const count       = (holdings ?? []).filter(h => h.units > 0).length

  if (!hasCAMS && !hasKFin && !hasHoldings) return { label: 'Pending',   color: '#9ca3af', bg: '#f3f4f6' }
  if (count === 0)                           return { label: 'No active', color: '#9ca3af', bg: '#f3f4f6' }

  const sources = [hasCAMS && 'CAMS', hasKFin && 'KFin'].filter(Boolean).join(' + ')
  const nav     = hasHoldings ? ' · with NAV' : ''
  return { label: `${sources} · ${count} schemes${nav}`, color: ACC, bg: `${ACC}15` }
}

// ── Consent gate ─────────────────────────────────────────────────────────────

function ConsentGate({ onConsent }) {
  const [checked, setChecked] = useState(Array(CONSENT_ITEMS.length).fill(false))
  const allChecked = checked.every(Boolean)
  const toggle = i => setChecked(c => c.map((v, idx) => idx === i ? !v : v))

  return (
    <div style={s.consentWrap}>
      <div style={s.consentCard}>
        <div style={s.consentIcon}>🔒</div>
        <h2 style={s.consentTitle}>Your data, your control</h2>
        <p style={s.consentSub}>
          PortfolioLens is built for the <strong>DPDP Act 2025</strong>. Please read and accept the following before uploading your portfolio files.
        </p>
        <div style={s.checkList}>
          {CONSENT_ITEMS.map((label, i) => (
            <label key={i} style={s.checkRow} onClick={() => toggle(i)}>
              <span style={{ ...s.checkbox, ...(checked[i] ? s.checkboxOn : {}) }}>{checked[i] && '✓'}</span>
              <span style={s.checkLabel}>{label}</span>
            </label>
          ))}
        </div>
        <button
          style={{ ...s.btn, ...s.btnPrimary, ...(allChecked ? {} : s.btnDisabled) }}
          disabled={!allChecked}
          onClick={() => { saveConsent(CONSENT_ITEMS); onConsent() }}
        >
          I agree and continue
        </button>
        <p style={s.consentNote}>
          Consent recorded with timestamp · Version <code style={{ fontFamily: 'monospace', fontSize: 11 }}>1.0</code> · Re-consent required before any cloud sync
        </p>
      </div>
    </div>
  )
}

// ── Add portfolio wizard ──────────────────────────────────────────────────────
// Step 1: Name + owner type
// Step 2: Upload files (optional — auto-detected, multiple allowed)
// Step 3: Confirm

function AddWizard({ onDone, onCancel }) {
  const [step, setStep]         = useState(1)
  const [name, setName]         = useState('')
  const [ownerType, setOwner]   = useState('individual')
  // parsedFiles: [{ file, detected, data, error, loading }]
  const [parsedFiles, setParsedFiles] = useState([])
  const [dragging, setDrag]     = useState(false)
  const [saving, setSaving]     = useState(false)

  const steps = ['Setup', 'Upload', 'Confirm']

  const addFiles = useCallback(async (fileList) => {
    const files = [...fileList].filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['xls', 'xlsx'].includes(ext)
    })
    if (!files.length) return

    // Mark as loading immediately
    const stubs = files.map(f => ({ id: crypto.randomUUID(), file: f, detected: null, data: null, error: null, loading: true }))
    setParsedFiles(prev => {
      const next = [...prev]
      stubs.forEach(stub => next.push(stub))
      return next
    })

    // Parse each file
    for (const stub of stubs) {
      const result = await detectAndParse(stub.file).catch(err => ({ error: err.message }))
      setParsedFiles(prev => prev.map(p => p.id !== stub.id ? p : {
        ...p,
        loading:  false,
        detected: result.detected ?? null,
        data:     (result.detected && !result.error) ? result : null,
        error:    result.error ?? (result.detected ? null : 'File type not recognised'),
      }))
    }
  }, [])

  const removeFile = id => setParsedFiles(prev => prev.filter(p => p.id !== id))

  const save = async () => {
    setSaving(true)
    const portfolio = newPortfolio(name.trim(), ownerType)

    if (parsedFiles.some(p => p.data)) {
      // Build raw from parsed files (last file wins per source if duplicates)
      const raw = { cams: null, kfin: null, holdings: null }
      for (const pf of parsedFiles) {
        if (!pf.data || !pf.detected) continue
        const key = pf.detected.toLowerCase()
        if (!(key in raw)) continue
        raw[key] = pf.detected === 'Holdings'
          ? { snapshots: pf.data.snapshots, meta: pf.data.meta, filename: pf.file.name, size_kb: Math.round(pf.file.size / 1024), parse_date: new Date().toISOString(), count: pf.data.snapshots.length }
          : { transactions: pf.data.transactions, meta: pf.data.meta, filename: pf.file.name, size_kb: Math.round(pf.file.size / 1024), parse_date: new Date().toISOString(), tx_count: pf.data.transactions.length }
      }
      const holdings = mergeRawToHoldings(raw)
      const pii      = mergedPii(raw)
      const hasData  = Object.values(raw).some(Boolean)
      portfolio.raw      = raw
      portfolio.holdings = holdings
      portfolio.pii      = pii
      portfolio.status   = hasData && holdings.length > 0 ? 'active' : (hasData ? 'partial' : 'pending')
    }

    addPortfolio(portfolio)
    setSaving(false)
    onDone()
  }

  // Duplicate source warning
  const detectedSources = parsedFiles.filter(p => p.detected).map(p => p.detected)
  const hasDuplicates   = new Set(detectedSources).size < detectedSources.length

  return (
    <div style={s.wizardWrap}>
      {/* Step bar */}
      <div style={s.stepBar}>
        {steps.map((label, i) => {
          const n = i + 1; const done = step > n; const active = step === n
          return (
            <div key={label} style={s.stepItem}>
              <div style={{ ...s.stepDot, ...(active ? s.stepDotActive : done ? s.stepDotDone : {}) }}>
                {done ? '✓' : n}
              </div>
              <span style={{ ...s.stepLabel, ...(active || done ? { color: ACC } : {}) }}>{label}</span>
              {i < steps.length - 1 && <div style={{ ...s.stepLine, ...(done ? s.stepLineDone : {}) }} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Setup */}
      {step === 1 && (
        <div style={s.stepBody}>
          <h3 style={s.stepTitle}>Name your portfolio</h3>
          <label style={s.fieldLabel}>Portfolio name</label>
          <input
            style={s.input} autoFocus maxLength={60}
            placeholder="e.g. My Portfolio, Priya Sharma, Retirement Fund"
            value={name} onChange={e => setName(e.target.value)}
          />
          <label style={s.fieldLabel}>Portfolio type</label>
          <div style={s.radioGroup}>
            {[['individual','Personal portfolio','Your own investments'],
              ['advisor_client','Client portfolio','Managed on behalf of a client']
            ].map(([val, lbl, desc]) => (
              <label key={val}
                style={{ ...s.radioCard, ...(ownerType === val ? s.radioCardActive : {}) }}
                onClick={() => setOwner(val)}
              >
                <div style={{ ...s.radioCircle, ...(ownerType === val ? s.radioCircleOn : {}) }} />
                <div>
                  <div style={s.radioLabel}>{lbl}</div>
                  <div style={s.radioDesc}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnGhost }} onClick={onCancel}>Cancel</button>
            <button
              style={{ ...s.btn, ...s.btnPrimary, ...(name.trim().length < 2 ? s.btnDisabled : {}) }}
              disabled={name.trim().length < 2}
              onClick={() => setStep(2)}
            >Next: Upload files</button>
          </div>
        </div>
      )}

      {/* Step 2: Upload files */}
      {step === 2 && (
        <div style={s.stepBody}>
          <h3 style={s.stepTitle}>Upload files <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 14 }}>(optional)</span></h3>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b7280', margin: '0 0 1rem', lineHeight: 1.6 }}>
            An investor typically has two files — one from <strong>CAMS</strong> and one from <strong>KFin</strong>. Drop both here for a complete merged view.
            File type is auto-detected. You can also add files later from the portfolio card.
          </p>

          {/* Drop zone */}
          <div
            style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}) }}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
            onClick={() => document.getElementById('pl-wiz-file').click()}
          >
            <input
              id="pl-wiz-file" type="file" accept=".xls,.xlsx" multiple style={{ display: 'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value = '' }}
            />
            <div style={s.dropIcon}>⬆</div>
            <div style={s.dropText}>Drop .xls / .xlsx files here or click to browse</div>
            <div style={s.dropHint}>CAMS + KFin transactions · Holdings snapshot · Read in-browser only</div>
          </div>

          {/* Parsed file chips */}
          {parsedFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              {parsedFiles.map(pf => {
                const sm = pf.detected ? SOURCE_META[pf.detected] : null
                return (
                  <div key={pf.id} style={{ ...s.fileChip, borderColor: pf.error ? '#fca5a5' : (sm ? sm.color + '40' : '#e5e7eb') }}>
                    <span style={{ ...s.fileChipBadge, background: sm ? sm.color + '18' : '#f3f4f6', color: sm ? sm.color : '#9ca3af' }}>
                      {pf.loading ? '…' : pf.detected ?? '?'}
                    </span>
                    <span style={s.fileChipName}>{pf.file.name}</span>
                    {!pf.loading && pf.data && (
                      <span style={s.fileChipCount}>
                        {pf.detected === 'Holdings' ? `${pf.data.snapshots.length} funds` : `${pf.data.transactions.length} txns`}
                      </span>
                    )}
                    {pf.error && <span style={s.fileChipError}>{pf.error}</span>}
                    <button style={s.fileChipRemove} onClick={() => removeFile(pf.id)}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Duplicate source warning */}
          {hasDuplicates && (
            <div style={{ ...s.infoBox, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', marginBottom: '1rem' }}>
              You have two files of the same type — the second will replace the first for that source.
            </div>
          )}

          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setStep(1)}>Back</button>
            <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setStep(3)}>
              Skip → Confirm
            </button>
            <button
              style={{ ...s.btn, ...s.btnPrimary, ...(parsedFiles.some(p => p.loading) ? s.btnDisabled : {}) }}
              disabled={parsedFiles.some(p => p.loading)}
              onClick={() => setStep(3)}
            >
              Next: Confirm
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div style={s.stepBody}>
          <h3 style={s.stepTitle}>Confirm & save</h3>
          <div style={s.summaryCard}>
            <div style={s.summaryRow}><span style={s.summaryKey}>Portfolio</span><span style={s.summaryVal}>{name}</span></div>
            <div style={s.summaryRow}><span style={s.summaryKey}>Type</span><span style={s.summaryVal}>{ownerType === 'individual' ? 'Personal' : 'Client'}</span></div>
            <div style={s.summaryRow}>
              <span style={s.summaryKey}>Files</span>
              <span style={s.summaryVal}>
                {parsedFiles.filter(p => p.data).length > 0
                  ? parsedFiles.filter(p => p.data).map(p => p.detected).join(' + ')
                  : <span style={{ color: '#9ca3af' }}>None — add later from portfolio card</span>
                }
              </span>
            </div>
            {parsedFiles.filter(p => p.data).length > 0 && (
              <div style={s.summaryRow}>
                <span style={s.summaryKey}>Transactions</span>
                <span style={s.summaryVal}>
                  {parsedFiles.filter(p => p.data && p.detected !== 'Holdings').reduce((n, p) => n + p.data.transactions.length, 0)} total
                </span>
              </div>
            )}
          </div>
          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setStep(2)}>Back</button>
            <button style={{ ...s.btn, ...s.btnPrimary, ...(saving ? s.btnDisabled : {}) }} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save portfolio'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Source row (per-RTA file slot inside PortfolioCard) ───────────────────────

function SourceRow({ sourceKey, data, loading, error, onUpload }) {
  const fileRef  = useRef(null)
  const meta     = SOURCE_META[sourceKey === 'cams' ? 'CAMS' : sourceKey === 'kfin' ? 'KFin' : 'Holdings']
  const isHoldings = sourceKey === 'holdings'

  return (
    <div style={s.sourceRow}>
      <span style={{ ...s.srcBadge, background: meta.color + '18', color: meta.color, minWidth: 58, textAlign: 'center' }}>
        {meta.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {data ? (
          <div style={s.sourceRowData}>
            <span style={s.sourceRowFilename}>{data.filename}</span>
            <span style={s.sourceRowMeta}>
              {isHoldings ? `${data.count} funds` : `${data.tx_count} txns`} · {fmtDate(data.parse_date)}
            </span>
          </div>
        ) : (
          <span style={s.sourceRowEmpty}>
            {meta.hint}
          </span>
        )}
        {error && <div style={s.sourceRowError}>{error}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        <input
          ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }}
          onChange={e => { onUpload(e.target.files[0]); e.target.value = '' }}
        />
        <button
          style={{ ...s.btn, ...(data ? s.btnGhost : s.btnOutline), fontSize: 11, padding: '5px 12px', ...(loading ? s.btnDisabled : {}) }}
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          {loading ? 'Parsing…' : data ? 'Replace' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

// ── Portfolio card ────────────────────────────────────────────────────────────

function PortfolioCard({ portfolio, onDelete, onParsed }) {
  const [confirming,  setConfirming]  = useState(false)
  const [loadingKey,  setLoadingKey]  = useState(null)   // 'cams'|'kfin'|'holdings'|null
  const [sourceErrors, setSourceErrors] = useState({})   // { cams: '...', kfin: '...' }

  const raw      = portfolio.raw ?? { cams: null, kfin: null, holdings: null }
  const status   = deriveStatus(raw, portfolio.holdings)

  const handleUpload = async (sourceKey, file) => {
    if (!file) return
    setLoadingKey(sourceKey)
    setSourceErrors(prev => ({ ...prev, [sourceKey]: null }))

    try {
      const parsed = await detectAndParse(file)
      if (parsed.error || !parsed.detected) {
        setSourceErrors(prev => ({ ...prev, [sourceKey]: parsed.error ?? 'File not recognised' }))
        return
      }

      // Detect source from file (ignore which slot the user intended)
      const detectedKey = parsed.detected.toLowerCase()
      if (detectedKey !== sourceKey) {
        // Warn but still accept — place in correct slot
        setSourceErrors(prev => ({ ...prev, [sourceKey]: `Auto-detected as ${parsed.detected} — placed in correct slot.` }))
      }

      // Build updated raw (preserve other slots from current portfolio state)
      const currentPortfolio = portfolio   // closure captures current prop
      const currentRaw = currentPortfolio.raw ?? { cams: null, kfin: null, holdings: null }
      const newSlotData = parsed.detected === 'Holdings'
        ? { snapshots: parsed.snapshots, meta: parsed.meta, filename: file.name, size_kb: Math.round(file.size / 1024), parse_date: new Date().toISOString(), count: parsed.snapshots.length }
        : { transactions: parsed.transactions, meta: parsed.meta, filename: file.name, size_kb: Math.round(file.size / 1024), parse_date: new Date().toISOString(), tx_count: parsed.transactions.length }

      const updatedRaw = { ...currentRaw, [detectedKey]: newSlotData }
      const holdings   = mergeRawToHoldings(updatedRaw)
      const pii        = mergedPii(updatedRaw)
      const hasData    = Object.values(updatedRaw).some(Boolean)
      const newStatus  = hasData && holdings.length > 0 ? 'active' : (hasData ? 'partial' : 'pending')

      updatePortfolio(portfolio.portfolio_id, { raw: updatedRaw, holdings, pii, status: newStatus })
      onParsed()
    } catch (err) {
      console.error('PortfolioCard: upload failed', sourceKey, err)
      setSourceErrors(prev => ({ ...prev, [sourceKey]: 'Parse failed: ' + err.message }))
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div style={s.portCard}>
      <div style={s.portCardTop}>
        <div>
          <div style={s.portName}>{portfolio.name}</div>
          <div style={s.portMeta}>
            <span style={s.portType}>{portfolio.owner_type === 'individual' ? 'Personal' : 'Client'}</span>
            <span style={s.portDate}>Added {fmtDate(portfolio.created_at)}</span>
          </div>
        </div>
        <div style={{ ...s.statusChip, background: status.bg, color: status.color }}>
          {status.label}
        </div>
      </div>

      {/* Source slots */}
      <div style={s.sourceSlots}>
        {['cams', 'kfin', 'holdings'].map(key => (
          <SourceRow
            key={key}
            sourceKey={key}
            data={raw[key]}
            loading={loadingKey === key}
            error={sourceErrors[key]}
            onUpload={file => handleUpload(key, file)}
          />
        ))}
      </div>

      {/* Delete */}
      <div style={s.portActions}>
        {!confirming
          ? <button style={{ ...s.btn, ...s.btnDanger, fontSize: 12, padding: '5px 14px' }} onClick={() => setConfirming(true)}>Delete</button>
          : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: WARN }}>Delete this portfolio?</span>
              <button style={{ ...s.btn, ...s.btnDanger, fontSize: 12, padding: '5px 12px' }} onClick={() => onDelete(portfolio.portfolio_id)}>Yes</button>
              <button style={{ ...s.btn, ...s.btnGhost, fontSize: 12, padding: '5px 12px' }} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Main F6 page ─────────────────────────────────────────────────────────────

export default function F6DataManager() {
  const [consented,    setConsented]    = useState(hasConsent)
  const [portfolios,   setPortfolios]   = useState(getPortfolios)
  const [showWizard,   setShowWizard]   = useState(false)
  const [deleteAllDlg, setDeleteAllDlg] = useState(false)

  const refresh = () => setPortfolios(getPortfolios())

  const handleDelete = id => { deletePortfolio(id); refresh() }

  const handleDeleteAll = () => {
    deleteAllData()
    setPortfolios([])
    setConsented(false)
    setDeleteAllDlg(false)
  }

  if (!consented) return <ConsentGate onConsent={() => setConsented(true)} />

  if (showWizard) {
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>Add Portfolio</h1>
          <p style={s.pageSub}>Create a portfolio and upload your CAMS and KFin transaction files.</p>
        </div>
        <AddWizard onDone={() => { refresh(); setShowWizard(false) }} onCancel={() => setShowWizard(false)} />
      </div>
    )
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={s.pageTitle}>Data Manager</h1>
            <p style={s.pageSub}>Manage your portfolio files · CAMS + KFin are merged automatically · all data stored locally.</p>
          </div>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowWizard(true)}>+ Add portfolio</button>
        </div>
      </div>

      {portfolios.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>📂</div>
          <div style={s.emptyTitle}>No portfolios yet</div>
          <div style={s.emptySub}>Add a portfolio and upload your CAMS and KFin statements to start analysing your investments.</div>
          <button style={{ ...s.btn, ...s.btnPrimary, marginTop: '1rem' }} onClick={() => setShowWizard(true)}>
            Add your first portfolio
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '2rem' }}>
          {portfolios.map(p => (
            <PortfolioCard key={p.portfolio_id} portfolio={p} onDelete={handleDelete} onParsed={refresh} />
          ))}
        </div>
      )}

      {/* DPDP / Delete all */}
      <div style={s.dpdpSection}>
        <div style={s.dpdpSectionHeader}><span style={s.dpdpDot2} /> Data privacy</div>
        <p style={s.dpdpText}>
          All portfolio data is stored in your browser's local storage only. PAN numbers are never stored. Folio numbers are one-way hashed. Use the button below to exercise your right to erasure under the DPDP Act 2025.
        </p>
        {!deleteAllDlg ? (
          <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => setDeleteAllDlg(true)}>Delete all my data</button>
        ) : (
          <div style={s.deleteAllConfirm}>
            <span style={{ fontSize: 13, color: WARN, fontWeight: 600 }}>This will permanently delete all portfolios and your consent record.</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{ ...s.btn, ...s.btnDanger }} onClick={handleDeleteAll}>Yes, delete everything</button>
              <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setDeleteAllDlg(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Consent
  consentWrap:  { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '1.5rem' },
  consentCard:  { background: '#fff', borderRadius: 20, border: `1px solid ${ACC}20`, boxShadow: `0 4px 40px ${ACC}10`, padding: '2.5rem', maxWidth: 520, width: '100%', textAlign: 'center' },
  consentIcon:  { fontSize: 36, marginBottom: '1rem' },
  consentTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  consentSub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' },
  checkList:    { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '1.5rem' },
  checkRow:     { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' },
  checkbox:     { flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: '2px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 1, transition: 'all 0.15s' },
  checkboxOn:   { background: ACC, borderColor: ACC },
  checkLabel:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#374151', lineHeight: 1.5 },
  consentNote:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', marginTop: '1rem', lineHeight: 1.5 },

  // Wizard
  wizardWrap:   { maxWidth: 560, marginTop: '0.5rem' },
  stepBar:      { display: 'flex', alignItems: 'center', marginBottom: '2rem' },
  stepItem:     { display: 'flex', alignItems: 'center', flex: 1 },
  stepDot:      { width: 28, height: 28, borderRadius: '50%', border: '2px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af', flexShrink: 0, transition: 'all 0.2s' },
  stepDotActive:{ border: `2px solid ${ACC}`, background: `${ACC}10`, color: ACC },
  stepDotDone:  { border: `2px solid ${ACC}`, background: ACC, color: '#fff' },
  stepLabel:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', marginLeft: 6, fontWeight: 600, whiteSpace: 'nowrap' },
  stepLine:     { flex: 1, height: 2, background: '#e5e7eb', margin: '0 8px', transition: 'background 0.2s' },
  stepLineDone: { background: ACC },
  stepBody:     { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, padding: '1.5rem', boxShadow: `0 2px 16px ${ACC}08` },
  stepTitle:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#0d3d2b', margin: '0 0 1.25rem' },

  // Fields
  fieldLabel: { display: 'block', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:      { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', marginBottom: '1.25rem', boxSizing: 'border-box', color: '#111827' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' },
  radioCard:        { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', cursor: 'pointer', background: '#fafafa' },
  radioCardActive:  { border: `1.5px solid ${ACC}`, background: `${ACC}06` },
  radioCircle:      { width: 16, height: 16, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0, transition: 'all 0.15s' },
  radioCircleOn:    { border: `5px solid ${ACC}`, background: '#fff' },
  radioLabel:       { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827' },
  radioDesc:        { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#6b7280', marginTop: 2 },

  // Dropzone
  dropzone:     { border: '2px dashed #d1d5db', borderRadius: 12, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#fafafa', marginBottom: '1rem' },
  dropzoneDrag: { borderColor: ACC, background: `${ACC}06` },
  dropIcon:     { fontSize: 28, marginBottom: 8 },
  dropText:     { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  dropHint:     { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },

  // File chips in wizard
  fileChip:        { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fafafa' },
  fileChipBadge:   { fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, flexShrink: 0, letterSpacing: '0.04em' },
  fileChipName:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileChipCount:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: ACC, fontWeight: 600, flexShrink: 0 },
  fileChipError:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: WARN, flex: 1 },
  fileChipRemove:  { background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 },

  // Summary
  summaryCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', marginBottom: '1rem' },
  summaryRow:  { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', gap: 12 },
  summaryKey:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#6b7280', fontWeight: 500 },
  summaryVal:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#111827', fontWeight: 600, textAlign: 'right' },
  infoBox:     { borderRadius: 10, padding: '10px 14px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, lineHeight: 1.5 },

  // Buttons
  btnRow:     { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.25rem' },
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
  btnGhost:   { background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb' },
  btnOutline: { background: 'transparent', color: ACC, border: `1.5px solid ${ACC}60` },
  btnDanger:  { background: '#fee2e2', color: WARN, border: '1px solid #fca5a5' },
  btnDisabled:{ opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' },

  // Page
  pageHeader: { marginBottom: '1.5rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.25rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#6b9e8d', margin: 0 },

  // Portfolio cards
  portCard:    { background: '#fff', border: `1px solid ${ACC}18`, borderRadius: 14, padding: '1rem 1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  portCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '0.875rem' },
  portName:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: '#0d3d2b', marginBottom: 4 },
  portMeta:    { display: 'flex', alignItems: 'center', gap: 8 },
  portType:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },
  portDate:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },
  statusChip:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0, letterSpacing: '0.04em', whiteSpace: 'nowrap' },

  // Source slots
  sourceSlots:       { display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid #f3f4f6', borderRadius: 10, overflow: 'hidden', marginBottom: '0.875rem' },
  sourceRow:         { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fafafa' },
  srcBadge:          { fontFamily: 'monospace', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em', flexShrink: 0 },
  sourceRowData:     { display: 'flex', flexDirection: 'column', gap: 1 },
  sourceRowFilename: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 },
  sourceRowMeta:     { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#9ca3af' },
  sourceRowEmpty:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', fontStyle: 'italic' },
  sourceRowError:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: WARN, marginTop: 2 },

  portActions: { display: 'flex', justifyContent: 'flex-end' },

  // Empty state
  emptyState: { textAlign: 'center', padding: '3.5rem 1rem', background: '#fff', borderRadius: 16, border: `1px dashed ${ACC}30` },
  emptyIcon:  { fontSize: 40, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#0d3d2b', marginBottom: 6 },
  emptySub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', lineHeight: 1.6, maxWidth: 380, margin: '0 auto' },

  // DPDP section
  dpdpSection:      { borderTop: `1px solid ${ACC}14`, paddingTop: '1.25rem', marginTop: '1rem' },
  dpdpSectionHeader:{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, color: ACC, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' },
  dpdpDot2:         { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ACC, flexShrink: 0 },
  dpdpText:         { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: '0.75rem' },
  deleteAllConfirm: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px' },
}
