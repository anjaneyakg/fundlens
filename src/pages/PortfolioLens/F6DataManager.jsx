import { useState, useCallback, useRef } from 'react'
import {
  hasConsent, saveConsent,
  getPortfolios, addPortfolio, deletePortfolio, updatePortfolio, deleteAllData,
  newPortfolio,
} from './utils/portfolioStore'
import { detectAndParse } from './utils/fileParser'
import { buildHoldings } from './utils/portfolioEngine'

const ACC  = '#1D9E75'
const WARN = '#ef4444'

const SOURCE_OPTIONS = [
  { value: 'CAMS',     label: 'CAMS Transaction Export',      desc: '14-column statement · purchase, redemption, dividend history',  ext: '.xls / .xlsx' },
  { value: 'KFin',     label: 'KFin Transaction Export',       desc: '13-column statement · includes ISIN · multiple investors',      ext: '.xls / .xlsx' },
  { value: 'Holdings', label: 'CAMS Current Valuation',        desc: '11-column snapshot · current units, NAV & value per scheme',    ext: '.xls' },
]

const CONSENT_ITEMS = [
  'My files are read entirely in my browser. No transaction data is ever sent to any server.',
  'Portfolio data (holdings, transactions) will be stored in my browser\'s local storage only.',
  'PAN numbers are never stored. Folio numbers are one-way hashed for privacy.',
  'I can permanently delete all my data at any time using the "Delete all my data" button.',
]

// ── Consent gate ────────────────────────────────────────────────────────────

function ConsentGate({ onConsent }) {
  const [checked, setChecked] = useState(Array(CONSENT_ITEMS.length).fill(false))
  const allChecked = checked.every(Boolean)

  const toggle = (i) => setChecked(c => c.map((v, idx) => idx === i ? !v : v))

  return (
    <div style={s.consentWrap}>
      <div style={s.consentCard}>
        <div style={s.consentIcon}>🔒</div>
        <h2 style={s.consentTitle}>Your data, your control</h2>
        <p style={s.consentSub}>
          PortfolioLens is built for the{' '}
          <strong>DPDP Act 2025</strong>. Please read and accept the following
          before uploading your portfolio files.
        </p>

        <div style={s.checkList}>
          {CONSENT_ITEMS.map((label, i) => (
            <label key={i} style={s.checkRow} onClick={() => toggle(i)}>
              <span style={{ ...s.checkbox, ...(checked[i] ? s.checkboxOn : {}) }}>
                {checked[i] && '✓'}
              </span>
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
          Consent recorded with timestamp · Version {' '}
          <code style={{ fontFamily: 'monospace', fontSize: 11 }}>1.0</code>
          {' '}· Re-consent required before any cloud sync
        </p>
      </div>
    </div>
  )
}

// ── Add portfolio wizard ────────────────────────────────────────────────────

function AddWizard({ onDone, onCancel }) {
  const [step, setStep]       = useState(1)
  const [name, setName]       = useState('')
  const [ownerType, setOwner] = useState('individual')
  const [source, setSource]   = useState('')
  const [file, setFile]       = useState(null)
  const [dragging, setDrag]   = useState(false)

  const ACCEPT = '.xls,.xlsx'

  const handleFile = useCallback((f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xls', 'xlsx'].includes(ext)) return
    setFile(f)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const save = () => {
    const uploadInfo = file ? {
      filename:    file.name,
      size_kb:     Math.round(file.size / 1024),
      upload_date: new Date().toISOString(),
    } : null
    addPortfolio(newPortfolio(name.trim(), ownerType, source, uploadInfo))
    onDone()
  }

  // step indicators
  const steps = ['Setup', 'Upload', 'Done']

  return (
    <div style={s.wizardWrap}>
      {/* Step bar */}
      <div style={s.stepBar}>
        {steps.map((label, i) => {
          const n = i + 1
          const done    = step > n
          const active  = step === n
          return (
            <div key={label} style={s.stepItem}>
              <div style={{ ...s.stepDot, ...(active ? s.stepDotActive : done ? s.stepDotDone : {}) }}>
                {done ? '✓' : n}
              </div>
              <span style={{ ...s.stepLabel, ...(active ? { color: ACC } : done ? { color: ACC } : {}) }}>
                {label}
              </span>
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
            style={s.input}
            placeholder="e.g. My Portfolio, Priya Sharma, Retirement Fund"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />

          <label style={s.fieldLabel} >Portfolio type</label>
          <div style={s.radioGroup}>
            {[['individual', 'Personal portfolio', 'Your own investments'],
              ['advisor_client', 'Client portfolio', 'Managed on behalf of a client']
            ].map(([val, label, desc]) => (
              <label key={val} style={{ ...s.radioCard, ...(ownerType === val ? s.radioCardActive : {}) }}
                onClick={() => setOwner(val)}>
                <div style={{ ...s.radioCircle, ...(ownerType === val ? s.radioCircleOn : {}) }} />
                <div>
                  <div style={s.radioLabel}>{label}</div>
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
            >
              Next: Upload file
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 2 && (
        <div style={s.stepBody}>
          <h3 style={s.stepTitle}>Select data source</h3>

          <label style={s.fieldLabel}>File type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' }}>
            {SOURCE_OPTIONS.map(opt => (
              <label key={opt.value}
                style={{ ...s.sourceCard, ...(source === opt.value ? s.sourceCardActive : {}) }}
                onClick={() => setSource(opt.value)}>
                <div style={{ ...s.radioCircle, ...(source === opt.value ? s.radioCircleOn : {}) }} />
                <div style={{ flex: 1 }}>
                  <div style={s.sourceLabel}>{opt.label}</div>
                  <div style={s.sourceDesc}>{opt.desc}</div>
                </div>
                <span style={s.extChip}>{opt.ext}</span>
              </label>
            ))}
          </div>

          <label style={s.fieldLabel}>Upload file <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional — can be added later)</span></label>
          <div
            style={{ ...s.dropzone, ...(dragging ? s.dropzoneDrag : {}), ...(file ? s.dropzoneDone : {}) }}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('pl-file-input').click()}
          >
            <input
              id="pl-file-input"
              type="file"
              accept={ACCEPT}
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <div style={s.dropIcon}>📄</div>
                <div style={s.dropFilename}>{file.name}</div>
                <div style={s.dropMeta}>{Math.round(file.size / 1024)} KB · click to replace</div>
              </>
            ) : (
              <>
                <div style={s.dropIcon}>⬆</div>
                <div style={s.dropText}>Drop .xls / .xlsx here or click to browse</div>
                <div style={s.dropHint}>File is read in-browser only — never uploaded</div>
              </>
            )}
          </div>

          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setStep(1)}>Back</button>
            <button
              style={{ ...s.btn, ...s.btnPrimary, ...(!source ? s.btnDisabled : {}) }}
              disabled={!source}
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
            <div style={s.summaryRow}><span style={s.summaryKey}>Source</span><span style={{ ...s.summaryVal, ...s.sourceBadge }}>{source}</span></div>
            {file
              ? <div style={s.summaryRow}><span style={s.summaryKey}>File</span><span style={s.summaryVal}>{file.name} ({Math.round(file.size / 1024)} KB)</span></div>
              : <div style={s.summaryRow}><span style={s.summaryKey}>File</span><span style={{ ...s.summaryVal, color: '#9ca3af' }}>Not uploaded — add later via Data Manager</span></div>
            }
          </div>

          <div style={{ ...s.infoBox, marginBottom: '1.25rem' }}>
            <strong>Note:</strong> After saving, use the <strong>Parse transactions</strong> button on the portfolio card to load your data.
          </div>

          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnGhost }} onClick={() => setStep(2)}>Back</button>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={save}>Save portfolio</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Portfolio card ──────────────────────────────────────────────────────────

function PortfolioCard({ portfolio, onDelete, onParsed }) {
  const [confirming,  setConfirming]  = useState(false)
  const [parsing,     setParsing]     = useState(false)
  const [parseError,  setParseError]  = useState(null)
  const [parseResult, setParseResult] = useState(null)
  const fileRef = useRef(null)

  const sourceColors = { CAMS: '#635bff', KFin: '#f43f8e', Holdings: '#f59e0b' }

  const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const handleParseFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setParsing(true)
    setParseError(null)
    setParseResult(null)
    try {
      const parsed = await detectAndParse(file)
      if (parsed.error || !parsed.detected) {
        setParseError(parsed.error ?? 'Could not identify file type.')
        return
      }
      if (parsed.detected === 'Holdings') {
        // Holdings snapshot: update current_value / current_nav on existing holdings
        updatePortfolio(portfolio.portfolio_id, {
          status:     'active',
          holdings:   parsed.snapshots,
          pii:        parsed.meta,
          upload:     { filename: file.name, size_kb: Math.round(file.size / 1024), upload_date: new Date().toISOString() },
        })
      } else {
        // Transaction file: build full holdings
        const holdings = buildHoldings(parsed.transactions)
        updatePortfolio(portfolio.portfolio_id, {
          status:   'active',
          holdings,
          pii:      parsed.meta,
          upload:   { filename: file.name, size_kb: Math.round(file.size / 1024), upload_date: new Date().toISOString() },
        })
        setParseResult({ detected: parsed.detected, count: holdings.length, txCount: parsed.transactions.length })
      }
      onParsed()
    } catch (err) {
      console.error('PortfolioCard: parse failed', err)
      setParseError('Parsing failed: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  const active   = portfolio.status === 'active'
  const holdings = portfolio.holdings ?? []

  return (
    <div style={s.portCard}>
      <div style={s.portCardTop}>
        <div>
          <div style={s.portName}>{portfolio.name}</div>
          <div style={s.portMeta}>
            <span style={{ ...s.srcBadge, background: `${sourceColors[portfolio.source]}18`, color: sourceColors[portfolio.source] }}>
              {portfolio.source}
            </span>
            <span style={s.portDate}>Added {fmtDate(portfolio.created_at)}</span>
          </div>
        </div>
        <div style={{ ...s.statusChip, ...(active ? s.statusActive : s.statusPending) }}>
          {active ? `Active · ${holdings.length} schemes` : 'Pending parse'}
        </div>
      </div>

      {portfolio.upload && (
        <div style={s.portFile}>
          📄 {portfolio.upload.filename} · {portfolio.upload.size_kb} KB · parsed {fmtDate(portfolio.upload.upload_date)}
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div style={{ ...s.infoBox, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', marginBottom: 10 }}>
          {parseError}
        </div>
      )}

      {/* Parse success */}
      {parseResult && (
        <div style={{ ...s.infoBox, marginBottom: 10 }}>
          Parsed {parseResult.txCount} transactions → {parseResult.count} active holdings.
        </div>
      )}

      <div style={s.portActions}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Parse / re-parse button */}
          <input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx"
            style={{ display: 'none' }}
            onChange={handleParseFile}
          />
          <button
            style={{ ...s.btn, ...s.btnPrimary, fontSize: 12, padding: '6px 14px', ...(parsing ? s.btnDisabled : {}) }}
            disabled={parsing}
            onClick={() => { setParseError(null); setParseResult(null); fileRef.current?.click() }}
          >
            {parsing ? 'Parsing…' : active ? 'Re-parse file' : 'Parse transactions'}
          </button>

          {/* Delete */}
          {!confirming
            ? <button style={{ ...s.btn, ...s.btnDanger, fontSize: 12, padding: '6px 14px' }} onClick={() => setConfirming(true)}>Delete</button>
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: WARN }}>Delete this portfolio?</span>
                <button style={{ ...s.btn, ...s.btnDanger,   fontSize: 12, padding: '6px 12px' }} onClick={() => onDelete(portfolio.portfolio_id)}>Yes</button>
                <button style={{ ...s.btn, ...s.btnGhost,    fontSize: 12, padding: '6px 12px' }} onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ── Main F6 page ────────────────────────────────────────────────────────────

export default function F6DataManager() {
  const [consented,    setConsented]    = useState(hasConsent)
  const [portfolios,   setPortfolios]   = useState(getPortfolios)
  const [showWizard,   setShowWizard]   = useState(false)
  const [deleteAllDlg, setDeleteAllDlg] = useState(false)

  const refresh = () => setPortfolios(getPortfolios())

  const handleWizardDone = () => {
    refresh()
    setShowWizard(false)
  }

  const handleDelete = (id) => {
    deletePortfolio(id)
    refresh()
  }

  const handleDeleteAll = () => {
    deleteAllData()
    setPortfolios([])
    setConsented(false)
    setDeleteAllDlg(false)
  }

  if (!consented) {
    return <ConsentGate onConsent={() => setConsented(true)} />
  }

  if (showWizard) {
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>Add Portfolio</h1>
          <p style={s.pageSub}>Upload your CAMS or KFin statement to get started.</p>
        </div>
        <AddWizard onDone={handleWizardDone} onCancel={() => setShowWizard(false)} />
      </div>
    )
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={s.pageTitle}>Data Manager</h1>
            <p style={s.pageSub}>Manage your portfolio files · all data stored locally in your browser.</p>
          </div>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setShowWizard(true)}>
            + Add portfolio
          </button>
        </div>
      </div>

      {/* Portfolio list */}
      {portfolios.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>📂</div>
          <div style={s.emptyTitle}>No portfolios yet</div>
          <div style={s.emptySub}>Add your CAMS or KFin statement to start analysing your investments.</div>
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

      {/* DPDP / Delete all section */}
      <div style={s.dpdpSection}>
        <div style={s.dpdpSectionHeader}>
          <span style={s.dpdpDot2} /> Data privacy
        </div>
        <p style={s.dpdpText}>
          All portfolio data is stored in your browser's local storage only.
          PAN numbers are never stored. Folio numbers are one-way hashed.
          Use the button below to exercise your right to erasure under the DPDP Act 2025.
        </p>
        {!deleteAllDlg ? (
          <button style={{ ...s.btn, ...s.btnDanger }} onClick={() => setDeleteAllDlg(true)}>
            Delete all my data
          </button>
        ) : (
          <div style={s.deleteAllConfirm}>
            <span style={{ fontSize: 13, color: WARN, fontWeight: 600 }}>
              This will permanently delete all portfolios and your consent record.
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={{ ...s.btn, ...s.btnDanger }}  onClick={handleDeleteAll}>Yes, delete everything</button>
              <button style={{ ...s.btn, ...s.btnGhost }}   onClick={() => setDeleteAllDlg(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  // Consent gate
  consentWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '1.5rem' },
  consentCard: { background: '#fff', borderRadius: 20, border: `1px solid ${ACC}20`, boxShadow: `0 4px 40px ${ACC}10`, padding: '2.5rem', maxWidth: 520, width: '100%', textAlign: 'center' },
  consentIcon: { fontSize: 36, marginBottom: '1rem' },
  consentTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  consentSub: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' },
  checkList: { textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '1.5rem' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', userSelect: 'none' },
  checkbox: { flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: '2px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 1, transition: 'all 0.15s' },
  checkboxOn: { background: ACC, borderColor: ACC },
  checkLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#374151', lineHeight: 1.5 },
  consentNote: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', marginTop: '1rem', lineHeight: 1.5 },

  // Wizard
  wizardWrap: { maxWidth: 560, marginTop: '0.5rem' },
  stepBar: { display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: 0 },
  stepItem: { display: 'flex', alignItems: 'center', flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: '50%', border: '2px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af', flexShrink: 0, transition: 'all 0.2s' },
  stepDotActive: { border: `2px solid ${ACC}`, background: `${ACC}10`, color: ACC },
  stepDotDone: { border: `2px solid ${ACC}`, background: ACC, color: '#fff' },
  stepLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', marginLeft: 6, fontWeight: 600, whiteSpace: 'nowrap' },
  stepLine: { flex: 1, height: 2, background: '#e5e7eb', margin: '0 8px', transition: 'background 0.2s' },
  stepLineDone: { background: ACC },
  stepBody: { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, padding: '1.5rem', boxShadow: `0 2px 16px ${ACC}08` },
  stepTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#0d3d2b', margin: '0 0 1.25rem' },

  // Fields
  fieldLabel: { display: 'block', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, marginTop: 0 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", outline: 'none', marginBottom: '1.25rem', boxSizing: 'border-box', color: '#111827' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' },
  radioCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', cursor: 'pointer', background: '#fafafa', transition: 'border-color 0.15s' },
  radioCardActive: { border: `1.5px solid ${ACC}`, background: `${ACC}06` },
  radioCircle: { width: 16, height: 16, borderRadius: '50%', border: '2px solid #d1d5db', flexShrink: 0, transition: 'all 0.15s' },
  radioCircleOn: { border: `5px solid ${ACC}`, background: '#fff' },
  radioLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827' },
  radioDesc: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#6b7280', marginTop: 2 },

  // Source cards
  sourceCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', cursor: 'pointer', background: '#fafafa', transition: 'border-color 0.15s' },
  sourceCardActive: { border: `1.5px solid ${ACC}`, background: `${ACC}06` },
  sourceLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827' },
  sourceDesc: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#6b7280', marginTop: 2 },
  extChip: { fontFamily: 'monospace', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', flexShrink: 0, whiteSpace: 'nowrap' },

  // Dropzone
  dropzone: { border: '2px dashed #d1d5db', borderRadius: 12, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#fafafa', transition: 'all 0.15s', marginBottom: '1.25rem' },
  dropzoneDrag: { borderColor: ACC, background: `${ACC}06` },
  dropzoneDone: { borderColor: ACC, borderStyle: 'solid', background: `${ACC}04` },
  dropIcon: { fontSize: 28, marginBottom: 8 },
  dropText: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 },
  dropHint: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },
  dropFilename: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600, color: ACC, marginBottom: 4 },
  dropMeta: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },

  // Summary
  summaryCard: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', marginBottom: '1rem' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', gap: 12 },
  summaryKey: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#6b7280', fontWeight: 500 },
  summaryVal: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#111827', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' },
  sourceBadge: { padding: '1px 8px', borderRadius: 10, background: `${ACC}15`, color: ACC, fontSize: 11 },
  infoBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#92400e', lineHeight: 1.5 },

  // Buttons
  btnRow: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '0.25rem' },
  btn: { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
  btnGhost: { background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb' },
  btnDanger: { background: '#fee2e2', color: WARN, border: '1px solid #fca5a5' },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' },

  // Page layout
  pageHeader: { marginBottom: '1.5rem' },
  pageTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.25rem' },
  pageSub: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#6b9e8d', margin: 0 },

  // Portfolio cards
  portCard: { background: '#fff', border: `1px solid ${ACC}18`, borderRadius: 14, padding: '1rem 1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  portCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  portName: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: '#0d3d2b', marginBottom: 4 },
  portMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  srcBadge: { fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, letterSpacing: '0.05em' },
  portDate: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },
  statusChip: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, flexShrink: 0, letterSpacing: '0.04em' },
  statusActive: { background: `${ACC}15`, color: ACC },
  statusPending: { background: '#f3f4f6', color: '#9ca3af' },
  portFile: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#6b7280', marginBottom: 10, paddingLeft: 2 },
  portActions: { display: 'flex', justifyContent: 'flex-end' },

  // Empty state
  emptyState: { textAlign: 'center', padding: '3.5rem 1rem', background: '#fff', borderRadius: 16, border: `1px dashed ${ACC}30` },
  emptyIcon: { fontSize: 40, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#0d3d2b', marginBottom: 6 },
  emptySub: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' },

  // DPDP section
  dpdpSection: { borderTop: `1px solid ${ACC}14`, paddingTop: '1.25rem', marginTop: '1rem' },
  dpdpSectionHeader: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, color: ACC, marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' },
  dpdpDot2: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ACC, flexShrink: 0 },
  dpdpText: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: '0.75rem' },
  deleteAllConfirm: { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px' },
}
