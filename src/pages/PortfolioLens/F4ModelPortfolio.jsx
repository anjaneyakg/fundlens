import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import { useRole } from '../../hooks/useRole'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const FAIL = '#ef4444'

const MACRO_COLORS = { Equity: '#1D9E75', Hybrid: '#6366f1', Debt: '#f59e0b', Liquid: '#3b82f6' }
const MACROS       = ['Equity', 'Hybrid', 'Debt', 'Liquid']
const MODEL_KEY    = 'fundlens_model_portfolio_v1'
const HANDOFF_KEY  = 'fundlens_rebalance_target_v1'

const RISKS    = ['Conservative', 'Moderate', 'Aggressive']
const HORIZONS = ['Short', 'Medium', 'Long']

const HORIZON_LABEL = { Short: '< 3 Years', Medium: '3–7 Years', Long: '> 7 Years' }
const RISK_COLOR    = { Conservative: '#3b82f6', Moderate: '#1D9E75', Aggressive: '#ef4444' }
const RISK_BG       = { Conservative: '#eff6ff', Moderate: '#f0fdf8', Aggressive: '#fef2f2' }
const RISK_LABEL    = { Conservative: 'Low',     Moderate: 'Moderate', Aggressive: 'High' }

// ── Default 3×3 grid — E=Equity H=Hybrid D=Debt L=Liquid; each sums to 100 ──
const DEFAULTS = {
  Conservative: {
    Short:  {
      alloc:       { Equity: 20, Hybrid: 0, Debt: 60, Liquid: 20 },
      categories:  ['Overnight Fund', 'Money Market Fund', 'Short Duration Fund'],
      returnRange: '5–7% p.a.',
    },
    Medium: {
      alloc:       { Equity: 40, Hybrid: 0, Debt: 40, Liquid: 20 },
      categories:  ['Short Duration Fund', 'Corporate Bond Fund', 'Conservative Hybrid Fund'],
      returnRange: '7–9% p.a.',
    },
    Long: {
      alloc:       { Equity: 60, Hybrid: 0, Debt: 30, Liquid: 10 },
      categories:  ['Index Fund (Nifty 50)', 'ELSS', 'Corporate Bond Fund'],
      returnRange: '10–12% p.a.',
    },
  },
  Moderate: {
    Short:  {
      alloc:       { Equity: 30, Hybrid: 0, Debt: 50, Liquid: 20 },
      categories:  ['Money Market Fund', 'Short Duration Fund', 'Conservative Hybrid Fund'],
      returnRange: '6–8% p.a.',
    },
    Medium: {
      alloc:       { Equity: 55, Hybrid: 0, Debt: 30, Liquid: 15 },
      categories:  ['Index Fund (Nifty 50)', 'Balanced Advantage Fund', 'Corporate Bond Fund'],
      returnRange: '9–11% p.a.',
    },
    Long: {
      alloc:       { Equity: 70, Hybrid: 0, Debt: 20, Liquid: 10 },
      categories:  ['Flexicap Fund', 'Index Fund (Nifty 50)', 'Medium Duration Fund'],
      returnRange: '12–14% p.a.',
    },
  },
  Aggressive: {
    Short:  {
      alloc:       { Equity: 40, Hybrid: 0, Debt: 40, Liquid: 20 },
      categories:  ['Ultra Short Duration Fund', 'Large & Mid Cap Fund', 'Short Duration Fund'],
      returnRange: '7–9% p.a.',
    },
    Medium: {
      alloc:       { Equity: 65, Hybrid: 0, Debt: 25, Liquid: 10 },
      categories:  ['Flexicap Fund', 'Index Fund (Nifty 50)', 'Short Duration Fund'],
      returnRange: '11–13% p.a.',
    },
    Long: {
      alloc:       { Equity: 80, Hybrid: 0, Debt: 15, Liquid: 5 },
      categories:  ['Small Cap Fund', 'Midcap Fund', 'Flexicap Fund', 'Overnight Fund'],
      returnRange: '14–16% p.a.',
    },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${dd} ${mon} ${d.getFullYear()}`
}

// Identical regex to F1/F2/F3 — keep in sync
function inferCategory(schemeName) {
  const n = (schemeName ?? '').toLowerCase()
  if (/liquid|overnight|money market|ultra short|ultra-short/.test(n))         return 'liquid'
  if (/\bdebt\b|bond|gilt|banking and psu|banking & psu|corporate bond|dynamic bond|short duration|medium duration|long duration|credit risk|floater/.test(n)) return 'debt'
  if (/arbitrage/.test(n))                                                      return 'arbitrage'
  if (/hybrid|balanced advantage|conservative hybrid|equity savings|multi asset|asset allocator/.test(n)) return 'hybrid'
  if (/elss|tax saver|tax saving/.test(n))                                      return 'elss'
  if (/\bindex\b|nifty|sensex|nasdaq|s&p 500|exchange traded|\betf\b/.test(n)) return 'equity_passive'
  if (/\bbanking\b|financial services|\btechnology\b|\btech\b|infrastructure|infra|pharma|healthcare|consumption|energy|\bpsu\b|dividend yield/.test(n)) return 'equity_sector'
  return 'equity'
}

function macroCategory(cat) {
  if (['equity', 'elss', 'equity_passive', 'equity_sector'].includes(cat)) return 'Equity'
  if (cat === 'hybrid')                                                      return 'Hybrid'
  if (['debt', 'arbitrage'].includes(cat))                                   return 'Debt'
  return 'Liquid'
}

function computeCurrentPcts(holdings) {
  const active = (holdings ?? []).filter(h => h.units > 0)
  if (!active.length) return null
  const useCurrent = active.some(h => h.current_value != null)
  const byMacro = { Equity: 0, Hybrid: 0, Debt: 0, Liquid: 0 }
  for (const h of active) {
    const macro = macroCategory(inferCategory(h.scheme_name))
    const val   = useCurrent && h.current_value != null ? h.current_value : h.invested_amount
    byMacro[macro] += val
  }
  const total = Object.values(byMacro).reduce((s, v) => s + v, 0)
  if (total === 0) return null
  const pcts = {}
  for (const m of MACROS) pcts[m] = Math.round((byMacro[m] / total) * 1000) / 10
  return pcts
}

// ── localStorage helpers ───────────────────────────────────────────────────────

function loadModel() {
  try {
    const saved = JSON.parse(localStorage.getItem(MODEL_KEY) || 'null')
    if (!saved || saved.version !== '1.0') return null
    return saved
  } catch (e) {
    console.error('F4ModelPortfolio: loadModel failed', e)
    return null
  }
}

function initCells() {
  const saved = loadModel()
  if (saved?.cells) return saved.cells
  const cells = {}
  for (const risk of RISKS)
    for (const horizon of HORIZONS) {
      const d = DEFAULTS[risk][horizon]
      cells[`${risk}_${horizon}`] = {
        alloc:       { ...d.alloc },
        categories:  [...d.categories],
        returnRange: d.returnRange,
      }
    }
  return cells
}

function persistModel(cells, risk, horizon) {
  try {
    localStorage.setItem(MODEL_KEY, JSON.stringify({
      version: '1.0',
      savedAt: new Date().toISOString(),
      cells,
      profile: { risk, horizon },
    }))
  } catch (e) {
    console.error('F4ModelPortfolio: persistModel failed', e)
  }
}

// ── AllocBar — stacked horizontal progress bar ────────────────────────────────

function AllocBar({ alloc, height = 8 }) {
  const total = MACROS.reduce((s, m) => s + (alloc[m] || 0), 0)
  if (total === 0) {
    return <div style={{ height, background: '#f0f0f0', borderRadius: 4 }} />
  }
  return (
    <div style={{ display: 'flex', height, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
      {MACROS.map(m => {
        const w = ((alloc[m] || 0) / total) * 100
        return w >= 1 ? (
          <div key={m}
               style={{ width: `${w}%`, background: MACRO_COLORS[m], flexShrink: 0 }}
               title={`${m}: ${alloc[m]}%`}
          />
        ) : null
      })}
    </div>
  )
}

// ── AllocChips — tiny colour-coded E/D/L badges ───────────────────────────────

function AllocChips({ alloc }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', marginTop: 5 }}>
      {MACROS.filter(m => (alloc[m] || 0) > 0).map(m => (
        <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{
            width: 6, height: 6, borderRadius: 1,
            background: MACRO_COLORS[m], display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 10, fontWeight: 600, color: '#374151',
          }}>
            {m.charAt(0)} {alloc[m]}%
          </span>
        </span>
      ))}
    </div>
  )
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ risk, horizon, cell, onSave, onClose }) {
  const [alloc,       setAlloc]       = useState({ ...cell.alloc })
  const [catInput,    setCatInput]    = useState(cell.categories.join(', '))
  const [returnRange, setReturnRange] = useState(cell.returnRange)

  const allocTotal = MACROS.reduce((s, m) => s + (Number(alloc[m]) || 0), 0)
  const isValid    = Math.abs(allocTotal - 100) < 0.1

  function handleAllocChange(macro, val) {
    setAlloc(prev => ({ ...prev, [macro]: Math.max(0, Math.min(100, Number(val) || 0)) }))
  }

  function handleReset() {
    const d = DEFAULTS[risk][horizon]
    setAlloc({ ...d.alloc })
    setCatInput(d.categories.join(', '))
    setReturnRange(d.returnRange)
  }

  function handleSave() {
    if (!isValid) return
    const parsedCats = catInput.split(',').map(c => c.trim()).filter(Boolean)
    onSave(risk, horizon, {
      alloc:       { ...alloc },
      categories:  parsedCats.length ? parsedCats : [...cell.categories],
      returnRange: returnRange.trim() || cell.returnRange,
    })
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 16, fontWeight: 700, color: '#0d3d2b',
            }}>
              Edit: {risk} · {horizon}-term
            </div>
            <div style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11, color: '#9ca3af', marginTop: 2,
            }}>
              Allocations must sum to exactly 100%
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Allocation inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: '0.875rem' }}>
          {MACROS.map(macro => (
            <div key={macro} style={{ ...s.inputCard, borderColor: MACRO_COLORS[macro] + '40' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: 1, background: MACRO_COLORS[macro], flexShrink: 0 }} />
                <span style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 11, fontWeight: 700, color: '#374151',
                }}>
                  {macro}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  min={0} max={100} step={1}
                  value={alloc[macro]}
                  onChange={e => handleAllocChange(macro, e.target.value)}
                  style={s.numInput}
                />
                <span style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 16, fontWeight: 700, color: '#9ca3af',
                }}>%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Total validation bar */}
        <div style={{
          ...s.totalBar,
          background:   isValid ? '#f0fdf8' : '#fef2f2',
          borderColor:  isValid ? `${ACC}30` : '#fca5a5',
          marginBottom: '1rem',
        }}>
          <span style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 13, fontWeight: 700,
            color: isValid ? ACC : FAIL,
          }}>
            Total: {allocTotal}%
          </span>
          {!isValid && (
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11, color: FAIL, marginLeft: 8,
            }}>
              {allocTotal > 100
                ? `over by ${Math.round(allocTotal - 100)}%`
                : `under by ${Math.round(100 - allocTotal)}%`}
            </span>
          )}
          {isValid && (
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 11, color: ACC, marginLeft: 8,
            }}>✓ Valid</span>
          )}
        </div>

        {/* Allocation preview bar */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 9, fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
          }}>Preview</div>
          <AllocBar alloc={alloc} height={10} />
          <AllocChips alloc={alloc} />
        </div>

        {/* Fund categories */}
        <div style={{ marginBottom: '0.875rem' }}>
          <label style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 11, fontWeight: 700, color: '#374151',
            display: 'block', marginBottom: 5,
          }}>
            Fund categories (comma-separated)
          </label>
          <input
            type="text"
            value={catInput}
            onChange={e => setCatInput(e.target.value)}
            placeholder="e.g. Index Fund, ELSS, Short Duration Fund"
            style={s.textInput}
          />
        </div>

        {/* Expected return range */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 11, fontWeight: 700, color: '#374151',
            display: 'block', marginBottom: 5,
          }}>
            Expected return range
          </label>
          <input
            type="text"
            value={returnRange}
            onChange={e => setReturnRange(e.target.value)}
            placeholder="e.g. 10–12% p.a."
            style={{ ...s.textInput, maxWidth: 200 }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            style={{ ...s.btn, background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}
            onClick={handleReset}
          >
            Reset to default
          </button>
          <button
            style={{ ...s.btn, background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            style={{
              ...s.btn, ...s.btnPrimary,
              ...(!isValid ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }}
            disabled={!isValid}
            onClick={handleSave}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast notification ────────────────────────────────────────────────────────

function Toast({ message, onClose }) {
  return (
    <div style={s.toast}>
      <span style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 12, fontWeight: 600, color: '#fff',
      }}>
        {message}
      </span>
      <button
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.65)', fontSize: 13,
          padding: '0 0 0 8px', lineHeight: 1,
        }}
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  )
}

// ── ModelCard — one cell in the 3×3 grid ─────────────────────────────────────

function ModelCard({ risk, horizon, cell, isSelected, currentPcts, isAdvisor, onEdit, onApply, onSetDefault, onSelect }) {
  return (
    <div
      onClick={() => onSelect(risk, horizon)}
      style={{ ...s.card, ...(isSelected ? s.cardSelected : {}) }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 12, fontWeight: 700, color: '#0d3d2b', lineHeight: 1.3,
          }}>
            {risk}
          </div>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 9, color: '#9ca3af', marginTop: 1,
          }}>
            {HORIZON_LABEL[horizon]}
          </div>
        </div>
        <div style={{
          ...s.riskBadge,
          background: RISK_BG[risk],
          color:      RISK_COLOR[risk],
        }}>
          {RISK_LABEL[risk]}
        </div>
      </div>

      {/* Allocation bar + legend */}
      <AllocBar alloc={cell.alloc} height={7} />
      <AllocChips alloc={cell.alloc} />

      {/* Expected return */}
      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 10, color: '#6b7280', marginTop: 7,
      }}>
        Expected: <strong>{cell.returnRange}</strong>
      </div>

      {/* Fund category chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 7 }}>
        {cell.categories.map((cat, i) => (
          <span key={i} style={s.catChip}>{cat}</span>
        ))}
      </div>

      {/* Gap vs current portfolio — only when selected and portfolio loaded */}
      {isSelected && currentPcts && (
        <div style={{ borderTop: `1px solid ${ACC}18`, paddingTop: 9, marginTop: 10 }}>
          <div style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 9, fontWeight: 700, color: '#9ca3af',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
          }}>
            Current → Model gap
          </div>
          {MACROS.map(m => {
            const cur = currentPcts[m] || 0
            const tgt = cell.alloc[m]  || 0
            if (cur === 0 && tgt === 0) return null
            const gap = tgt - cur
            return (
              <div key={m} style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '2px 0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: MACRO_COLORS[m], flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 10, fontWeight: 600, color: '#374151',
                  }}>
                    {m}
                  </span>
                </div>
                <span style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 10, color: '#9ca3af',
                }}>
                  {cur}% → {tgt}%{' '}
                  <span style={{
                    fontWeight: 700,
                    color: gap > 2 ? ACC : gap < -2 ? FAIL : '#9ca3af',
                  }}>
                    {gap > 0 ? '+' : ''}{gap}%
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Action buttons — stopPropagation so card click doesn't fire */}
      <div
        style={{ display: 'flex', gap: 5, marginTop: 11, flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          style={{ ...s.btnSm, ...s.btnPrimary }}
          onClick={() => onApply(cell.alloc)}
        >
          ⚡ Apply to F3
        </button>
        <button
          style={{ ...s.btnSm, background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}
          onClick={() => onEdit(risk, horizon)}
        >
          ✏️ Edit
        </button>
        {isAdvisor && (
          <button
            style={{ ...s.btnSm, background: '#eff6ff', color: '#1565C0', border: '1px solid #bfdbfe' }}
            onClick={() => onSetDefault(risk, horizon)}
          >
            🏢 Client default
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main F4ModelPortfolio page ────────────────────────────────────────────────

export default function F4ModelPortfolio() {
  const navigate      = useNavigate()
  const width         = useWindowWidth()
  const { isAdvisor } = useRole()
  const isMobile      = width < 640

  // Portfolio data — first portfolio is used for gap comparison
  const portfolios  = useMemo(() => getPortfolios(), [])
  const portfolio   = portfolios[0] ?? null
  const currentPcts = useMemo(() => computeCurrentPcts(portfolio?.holdings ?? []), [portfolio])

  // Model cells + selected profile
  const [cells,         setCells]        = useState(() => initCells())
  const [selectedRisk,  setSelectedRisk] = useState(() => loadModel()?.profile?.risk    ?? 'Moderate')
  const [selHorizon,    setSelHorizon]   = useState(() => loadModel()?.profile?.horizon ?? 'Medium')
  const [editTarget,    setEditTarget]   = useState(null)   // { risk, horizon } | null
  const [toast,         setToast]        = useState(null)
  const [savedAt,       setSavedAt]      = useState(() => loadModel()?.savedAt ?? null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function showToast(msg, ms = 2500) {
    setToast(msg)
    setTimeout(() => setToast(null), ms)
  }

  function handleSelect(risk, horizon) {
    setSelectedRisk(risk)
    setSelHorizon(horizon)
  }

  function handleEditSave(risk, horizon, updates) {
    const key  = `${risk}_${horizon}`
    const next = { ...cells, [key]: { ...cells[key], ...updates } }
    setCells(next)
    persistModel(next, selectedRisk, selHorizon)
    setSavedAt(new Date().toISOString())
    setEditTarget(null)
    showToast('✓ Cell updated and saved')
  }

  function handleApplyToF3(alloc) {
    try {
      localStorage.setItem(HANDOFF_KEY, JSON.stringify(alloc))
    } catch (e) {
      console.error('F4ModelPortfolio: failed to write F3 handoff', e)
    }
    navigate('/portfolio/f3')
  }

  function handleSetDefault(risk, horizon) {
    // Phase 3 stub — will write to advisor_profiles on Supabase
    showToast(`✓ "${risk} · ${horizon}" set as client default (advisor default coming in Phase 3)`, 3500)
  }

  function handleSaveAll() {
    persistModel(cells, selectedRisk, selHorizon)
    setSavedAt(new Date().toISOString())
    showToast('✓ Model portfolio saved to device')
  }

  function handleResetAll() {
    const fresh = {}
    for (const risk of RISKS)
      for (const horizon of HORIZONS) {
        const d = DEFAULTS[risk][horizon]
        fresh[`${risk}_${horizon}`] = {
          alloc:       { ...d.alloc },
          categories:  [...d.categories],
          returnRange: d.returnRange,
        }
      }
    setCells(fresh)
    persistModel(fresh, selectedRisk, selHorizon)
    setSavedAt(new Date().toISOString())
    showToast('✓ All cells reset to defaults')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>F4 Model Portfolio</h1>
        <p style={s.pageSub}>
          Define your target allocation blueprint · 3×3 risk × horizon grid · feed directly into F3 Rebalance Planner
        </p>
      </div>

      {/* Profile selector strip */}
      <div style={{
        ...s.selectorStrip,
        flexDirection: isMobile ? 'column' : 'row',
        alignItems:    isMobile ? 'flex-start' : 'center',
      }}>
        {/* Risk selector */}
        <div style={s.selectorGroup}>
          <span style={s.selectorLabel}>Risk profile</span>
          {isMobile ? (
            <select
              style={s.select}
              value={selectedRisk}
              onChange={e => setSelectedRisk(e.target.value)}
            >
              {RISKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              {RISKS.map(r => (
                <button
                  key={r}
                  style={{ ...s.pill, ...(selectedRisk === r ? { ...s.pillActive, background: RISK_BG[r], color: RISK_COLOR[r], borderColor: RISK_COLOR[r] + '60' } : {}) }}
                  onClick={() => setSelectedRisk(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Horizon selector */}
        <div style={s.selectorGroup}>
          <span style={s.selectorLabel}>Horizon</span>
          {isMobile ? (
            <select
              style={s.select}
              value={selHorizon}
              onChange={e => setSelHorizon(e.target.value)}
            >
              {HORIZONS.map(h => (
                <option key={h} value={h}>{h} ({HORIZON_LABEL[h]})</option>
              ))}
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              {HORIZONS.map(h => (
                <button
                  key={h}
                  style={{ ...s.pill, ...(selHorizon === h ? s.pillActive : {}) }}
                  onClick={() => setSelHorizon(h)}
                >
                  {h}
                  <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>
                    ({HORIZON_LABEL[h]})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save / reset actions */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          marginLeft: isMobile ? 0 : 'auto',
          flexWrap: 'wrap',
          marginTop: isMobile ? '0.5rem' : 0,
        }}>
          <button
            style={{ ...s.btnSm, background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}
            onClick={handleResetAll}
          >
            Reset all
          </button>
          <button
            style={{ ...s.btnSm, ...s.btnPrimary }}
            onClick={handleSaveAll}
          >
            💾 Save model
          </button>
          {savedAt && (
            <span style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 10, color: '#9ca3af',
            }}>
              Saved {fmtDate(savedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Portfolio gap context note */}
      {currentPcts && (
        <div style={s.infoNote}>
          📊 Gap comparison (shown on selected cell) is based on <strong>{portfolio?.name}</strong>.
          {portfolios.length > 1 && ' Using your first portfolio — switch in F6 to update.'}
        </div>
      )}
      {!currentPcts && portfolios.length === 0 && (
        <div style={s.infoNote}>
          💡 Upload your portfolio in{' '}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACC, fontWeight: 700, fontSize: 12, padding: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            onClick={() => navigate('/portfolio/f6')}
          >
            F6 Data Manager
          </button>{' '}
          to see how each model compares to your current allocation.
        </div>
      )}

      {/* ── Desktop 3×3 grid with axis labels ── */}
      {!isMobile && (
        <div style={{ marginTop: '1.25rem' }}>
          {/* Horizon column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(3, 1fr)', gap: 10, marginBottom: 8 }}>
            <div />
            {HORIZONS.map(h => (
              <div key={h} style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 10, fontWeight: 700,
                color: ACC, textAlign: 'center',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {h}
                <span style={{ fontWeight: 500, opacity: 0.65, display: 'block', fontSize: 9 }}>
                  {HORIZON_LABEL[h]}
                </span>
              </div>
            ))}
          </div>

          {/* Risk rows */}
          {RISKS.map(risk => (
            <div key={risk} style={{ display: 'grid', gridTemplateColumns: '110px repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
              {/* Risk row label */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
                <span style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 11, fontWeight: 700,
                  color: RISK_COLOR[risk],
                  background: RISK_BG[risk],
                  padding: '4px 10px', borderRadius: 20,
                  textAlign: 'center', whiteSpace: 'nowrap',
                }}>
                  {risk}
                </span>
              </div>

              {/* Three horizon cards for this risk */}
              {HORIZONS.map(horizon => {
                const key        = `${risk}_${horizon}`
                const cell       = cells[key]
                const isSelected = selectedRisk === risk && selHorizon === horizon
                return (
                  <ModelCard
                    key={key}
                    risk={risk}
                    horizon={horizon}
                    cell={cell}
                    isSelected={isSelected}
                    currentPcts={isSelected ? currentPcts : null}
                    isAdvisor={isAdvisor}
                    onEdit={setEditTarget}
                    onApply={handleApplyToF3}
                    onSetDefault={handleSetDefault}
                    onSelect={handleSelect}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── Mobile: single-column stack ── */}
      {isMobile && (
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RISKS.map(risk =>
            HORIZONS.map(horizon => {
              const key        = `${risk}_${horizon}`
              const cell       = cells[key]
              const isSelected = selectedRisk === risk && selHorizon === horizon
              return (
                <ModelCard
                  key={key}
                  risk={risk}
                  horizon={horizon}
                  cell={cell}
                  isSelected={isSelected}
                  currentPcts={isSelected ? currentPcts : null}
                  isAdvisor={isAdvisor}
                  onEdit={setEditTarget}
                  onApply={handleApplyToF3}
                  onSetDefault={handleSetDefault}
                  onSelect={handleSelect}
                />
              )
            })
          )}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          risk={editTarget.risk}
          horizon={editTarget.horizon}
          cell={cells[`${editTarget.risk}_${editTarget.horizon}`]}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Footer disclaimer */}
      <div style={s.footerNote}>
        <span style={s.footerDot} />
        Model allocations are illustrative targets — not personalised investment advice.
        Expected return ranges are historical approximations and do not guarantee future performance.
        Consult a SEBI-registered investment advisor before making allocation decisions.
        All data processed locally — no portfolio information leaves your device.
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Page header
  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.2rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', margin: 0 },

  // Selector strip
  selectorStrip: {
    display: 'flex', gap: 12, flexWrap: 'wrap',
    padding: '0.875rem 1.1rem',
    background: '#fff', borderRadius: 14,
    border: `1px solid ${ACC}18`,
    boxShadow: `0 2px 8px ${ACC}06`,
    marginBottom: '1rem',
  },
  selectorGroup: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  selectorLabel: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 11, fontWeight: 700, color: '#374151',
    flexShrink: 0, letterSpacing: '0.02em',
  },
  select: {
    padding: '6px 10px', borderRadius: 9, border: '1.5px solid #e5e7eb',
    fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif",
    color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none',
  },
  pill: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600,
    padding: '5px 13px', borderRadius: 20, cursor: 'pointer',
    border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151',
    lineHeight: 1,
  },
  pillActive: {
    background: `${ACC}12`, color: ACC, borderColor: `${ACC}50`,
  },

  // Info note
  infoNote: {
    background: '#f0fdf8', border: `1px solid ${ACC}25`,
    borderRadius: 10, padding: '0.65rem 1rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#1a6b4a', lineHeight: 1.6,
    marginBottom: '0.875rem',
  },

  // Model card
  card: {
    background: '#fff', borderRadius: 14,
    border: '1.5px solid #f0f0f0', padding: '1rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    cursor: 'pointer',
  },
  cardSelected: {
    borderColor: ACC,
    boxShadow:   `0 0 0 2.5px ${ACC}25, 0 4px 20px ${ACC}14`,
    background:  `linear-gradient(160deg, ${ACC}04, #fff 70%)`,
  },

  riskBadge: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 9, fontWeight: 700,
    padding: '2px 8px', borderRadius: 20, letterSpacing: '0.04em', flexShrink: 0,
  },
  catChip: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 9, fontWeight: 600,
    padding: '2px 7px', borderRadius: 4,
    background: '#f3f4f6', color: '#6b7280',
  },

  // Edit modal
  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 700,
    background: 'rgba(15,61,43,0.3)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: '#fff', borderRadius: 20, padding: '1.75rem',
    width: '100%', maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    overflowY: 'auto', maxHeight: '90vh',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 16, color: '#9ca3af', padding: '3px 5px', lineHeight: 1,
  },
  inputCard: {
    background: '#fff', borderRadius: 10, border: '1.5px solid #f0f0f0', padding: '0.75rem',
  },
  numInput: {
    width: 52, padding: '5px 7px', borderRadius: 8,
    border: '1.5px solid #e5e7eb', fontSize: 17, fontWeight: 800,
    fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827',
    textAlign: 'right', outline: 'none', background: '#f9fafb',
  },
  totalBar: {
    display: 'flex', alignItems: 'center',
    padding: '9px 14px', borderRadius: 9, border: '1.5px solid',
  },
  textInput: {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid #e5e7eb', fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827',
    outline: 'none', background: '#f9fafb', boxSizing: 'border-box',
  },

  // Toast
  toast: {
    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 800,
    background: '#0d3d2b', borderRadius: 12, padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },

  // Buttons
  btn: {
    padding: '9px 18px', borderRadius: 10, fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
    cursor: 'pointer', border: 'none', lineHeight: 1,
  },
  btnSm: {
    padding: '6px 11px', borderRadius: 8, fontSize: 11,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
    cursor: 'pointer', border: 'none', lineHeight: 1,
  },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },

  // Footer
  footerNote: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#b5d4cb', lineHeight: 1.55,
    paddingTop: '0.75rem', borderTop: `1px solid ${ACC}10`, marginTop: '1.5rem',
  },
  footerDot: {
    width: 6, height: 6, borderRadius: '50%', background: `${ACC}80`,
    flexShrink: 0, marginTop: 3,
  },
}
