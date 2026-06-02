import { useState, useEffect, useRef } from 'react'
import { useExpense } from '../../context/ExpenseContext'
import Toast from '../common/Toast'

const SOURCE_ICONS = {
  credit_card:  '💳',
  bank_account: '🏦',
  cash:         '💵',
  upi_wallet:   '📲',
  third_party:  '🔗',
}

function fmtDateLabel(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d     = new Date(dateStr + 'T00:00:00'); d.setHours(0,0,0,0)
  const diff  = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff <= 7) return `${diff} days ago`
  return dateStr
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const panelCSS = `
  .eep-backdrop {
    position: fixed; inset: 0; z-index: 800;
    background: rgba(0,0,0,0.4);
  }
  .eep-panel {
    position: fixed; bottom: 0; left: 50%; z-index: 801;
    transform: translateX(-50%) translateY(100%);
    width: 100%; max-width: 480px;
    background: #ffffff;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 40px rgba(0,0,0,0.15);
    transition: transform 0.3s cubic-bezier(0.32,0.72,0,1);
    display: flex; flex-direction: column;
    max-height: 85vh;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .eep-panel.open { transform: translateX(-50%) translateY(0); }
  .eep-panel.eep-busy { pointer-events: none; opacity: 0.9; }

  .eep-handle {
    width: 40px; height: 4px; background: #e2e8f0; border-radius: 2px;
    margin: 12px auto 0; flex-shrink: 0;
  }
  .eep-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px 8px; flex-shrink: 0;
  }
  .eep-title {
    font-family: 'DM Sans', sans-serif; font-size: 17px; font-weight: 700;
    color: #1a1a2a;
  }
  .eep-close {
    width: 30px; height: 30px; border-radius: 50%;
    border: none; background: #f1f5f9;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 14px; color: #64748b;
    transition: background 0.12s;
  }
  .eep-close:hover { background: #e2e8f0; }

  .eep-body {
    flex: 1; overflow-y: auto; padding: 4px 20px 20px;
  }

  .eep-amount-row {
    display: flex; align-items: center;
    background: #f8faff;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    padding: 12px 16px; margin-bottom: 16px;
    transition: border-color 0.15s;
  }
  .eep-amount-row:focus-within { border-color: #1A3C6E; }
  .eep-rupee {
    font-family: 'DM Sans', sans-serif; font-size: 32px; font-weight: 700;
    color: #94a3b8; margin-right: 6px; line-height: 1;
  }
  .eep-amount-input {
    flex: 1; border: none; background: transparent; outline: none;
    font-family: 'DM Sans', sans-serif; font-size: 36px; font-weight: 700;
    color: #1a1a2a; width: 100%; min-width: 0; line-height: 1;
  }
  .eep-amount-input::placeholder { color: #cbd5e1; }

  .eep-type-row {
    display: flex; background: #f1f5f9; border-radius: 10px;
    padding: 3px; margin-bottom: 16px; gap: 2px;
  }
  .eep-type-btn {
    flex: 1; padding: 8px 4px; border: none; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; background: transparent; color: #64748b;
    transition: all 0.15s; white-space: nowrap;
  }
  .eep-type-btn.active {
    background: #ffffff; color: #1A3C6E;
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }
  .eep-type-btn.active.type-income   { color: #16a34a; }
  .eep-type-btn.active.type-transfer { color: #2563eb; }

  .eep-label {
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em;
    margin-bottom: 8px;
  }

  .eep-chips {
    display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px;
    scrollbar-width: none;
  }
  .eep-chips::-webkit-scrollbar { display: none; }

  .eep-chip {
    flex-shrink: 0; padding: 7px 13px; border-radius: 20px;
    border: 1.5px solid #e2e8f0; background: #f1f5f9;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
    display: flex; align-items: center; gap: 5px;
    color: #475569;
  }
  .eep-chip:hover { border-color: #1A3C6E; background: #f0f4ff; }
  .eep-chip.selected {
    border-color: #1A3C6E; background: #1A3C6E; color: #ffffff;
    font-weight: 600;
  }
  .eep-chip.more {
    color: #1A3C6E; font-weight: 600;
    border-style: dashed; background: #ffffff;
  }
  .eep-chip.more:hover { background: #f0f4ff; }

  .eep-date-wrap { margin-bottom: 16px; }
  .eep-date-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    background: #f1f5f9; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    color: #1a1a2a; transition: border-color 0.15s;
    position: relative;
  }
  .eep-date-btn:hover { border-color: #1A3C6E; }
  .eep-date-label-rel { color: #1A3C6E; font-weight: 600; }
  .eep-date-label-abs { font-size: 12px; color: #94a3b8; margin-left: 4px; }

  .eep-note-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 0; border: none; background: transparent;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    color: #94a3b8; cursor: pointer; margin-bottom: 10px;
    transition: color 0.12s;
  }
  .eep-note-toggle:hover { color: #1A3C6E; }
  .eep-note-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; margin-bottom: 16px; background: #ffffff; color: #1a1a2a;
    transition: border-color 0.15s;
  }
  .eep-note-input:focus { border-color: #1A3C6E; }

  .eep-save-btn {
    width: 100%; padding: 15px; border: none; border-radius: 12px;
    background: #16a34a; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 700;
    cursor: pointer; transition: background 0.15s, opacity 0.15s;
    box-shadow: 0 4px 16px rgba(22,163,74,0.3);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .eep-save-btn:hover:not(:disabled) { background: #15803d; }
  .eep-save-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
  .eep-save-btn.btn-success { background: #16a34a; }
  .eep-save-btn.btn-error   { background: #dc2626; box-shadow: 0 4px 16px rgba(220,38,38,0.3); }
  .eep-save-btn.btn-loading { background: #16a34a; }

  .eep-spinner {
    width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff; border-radius: 50%;
    animation: eep-spin 0.6s linear infinite;
    flex-shrink: 0;
  }
  @keyframes eep-spin { to { transform: rotate(360deg); } }

  /* Bottom sheet (More categories / sources) */
  .eep-sheet-backdrop {
    position: fixed; inset: 0; z-index: 900;
    background: rgba(0,0,0,0.45);
  }
  .eep-sheet {
    position: fixed; bottom: 0; left: 50%; z-index: 901;
    transform: translateX(-50%);
    width: 100%; max-width: 480px;
    background: #ffffff;
    border-radius: 20px 20px 0 0;
    padding: 20px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0));
    max-height: 70vh; overflow-y: auto;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
  }
  .eep-sheet-handle {
    width: 40px; height: 4px; background: #e2e8f0; border-radius: 2px;
    margin: 0 auto 16px;
  }
  .eep-sheet-title {
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700;
    margin-bottom: 16px; color: #1a1a2a;
  }
  .eep-sheet-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  }
  .eep-sheet-item {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 5px;
    padding: 10px 4px; min-height: 80px;
    border-radius: 12px; border: 1.5px solid #e8ecf0;
    cursor: pointer; transition: all 0.12s; background: #ffffff;
  }
  .eep-sheet-item:hover { border-color: #1A3C6E; background: #f0f4ff; }
  .eep-sheet-item.selected {
    border-color: #1A3C6E; background: #f0f4ff;
  }
  .eep-sheet-icon { font-size: 28px; line-height: 1; }
  .eep-sheet-name {
    font-family: 'DM Sans', sans-serif; font-size: 11px; text-align: center;
    color: #374151; line-height: 1.2;
    word-break: break-word; white-space: normal;
  }
  .eep-sheet-item.selected .eep-sheet-name { color: #1A3C6E; font-weight: 600; }
`

const LSKEY_CAT = 'eep_last_cat'
const LSKEY_SRC = 'eep_last_src'

export default function ExpenseEntryPanel({ open, onClose }) {
  const { categories, paymentSources, familyMembers, addTransaction } = useExpense()

  const [amount,     setAmount]     = useState('')
  const [txnType,    setTxnType]    = useState('expense')
  const [categoryId, setCategoryId] = useState(null)
  const [sourceId,   setSourceId]   = useState(null)
  const [member,     setMember]     = useState('Self')
  const [txnDate,    setTxnDate]    = useState(todayStr())
  const [note,       setNote]       = useState('')
  const [noteOpen,   setNoteOpen]   = useState(false)

  // Save state: 'idle' | 'loading' | 'success' | 'error'
  const [saveState,  setSaveState]  = useState('idle')
  const [catSheet,   setCatSheet]   = useState(false)
  const [srcSheet,   setSrcSheet]   = useState(false)
  const [toast,      setToast]      = useState(null)  // { message, type }

  const amountRef = useRef(null)

  const activeCategories = categories.filter(c => c.is_active)
  const activeSources    = paymentSources.filter(s => s.is_active)

  const lastCatId = localStorage.getItem(LSKEY_CAT)
  const lastSrcId = localStorage.getItem(LSKEY_SRC)

  const sortedCats = [...activeCategories].sort((a, b) => {
    if (a.id === lastCatId) return -1
    if (b.id === lastCatId) return 1
    return 0
  })
  const sortedSrcs = [...activeSources].sort((a, b) => {
    if (a.id === lastSrcId) return -1
    if (b.id === lastSrcId) return 1
    return 0
  })

  const topCats    = sortedCats.slice(0, 6)
  const topSrcs    = sortedSrcs.slice(0, 3)
  const hasMoreCats = activeCategories.length > 6
  const hasMoreSrcs = activeSources.length > 3

  useEffect(() => {
    if (!open) return
    const savedCat = localStorage.getItem(LSKEY_CAT)
    const savedSrc = localStorage.getItem(LSKEY_SRC)
    if (savedCat && activeCategories.find(c => c.id === savedCat)) setCategoryId(savedCat)
    else if (activeCategories.length > 0) setCategoryId(activeCategories[0].id)
    if (savedSrc && activeSources.find(s => s.id === savedSrc)) setSourceId(savedSrc)
    else if (activeSources.length > 0) setSourceId(activeSources[0].id)
    setSaveState('idle')
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [open])

  function handleClose() {
    if (saveState === 'loading') return
    setCatSheet(false)
    setSrcSheet(false)
    onClose()
  }

  function resetForNextEntry() {
    setAmount('')
    setNote('')
    setNoteOpen(false)
    setTxnDate(todayStr())
  }

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || saveState === 'loading') return
    setSaveState('loading')
    const catName = categories.find(c => c.id === categoryId)?.category_name || 'Expense'
    try {
      await addTransaction({
        txn_type:          txnType,
        amount:            amt,
        category_id:       categoryId || null,
        payment_source_id: sourceId || null,
        family_member:     member || 'Self',
        txn_date:          txnDate,
        notes:             note || null,
      })
      if (categoryId) localStorage.setItem(LSKEY_CAT, categoryId)
      if (sourceId)   localStorage.setItem(LSKEY_SRC, sourceId)

      setSaveState('success')
      setToast({ message: `Saved — ₹${amt.toLocaleString('en-IN')} · ${catName}`, type: 'success' })

      // After showing success, close and reset
      setTimeout(() => {
        resetForNextEntry()
        setSaveState('idle')
        onClose()
      }, 1200)
    } catch (err) {
      console.error('ExpenseEntryPanel save error:', err)
      setSaveState('error')
      setToast({ message: 'Failed to save. Check connection.', type: 'error' })
      setTimeout(() => setSaveState('idle'), 2000)
    }
  }

  const canSave = parseFloat(amount) > 0 && saveState !== 'loading' && saveState !== 'success'

  function SaveButtonContent() {
    if (saveState === 'loading') return <><span className="eep-spinner" /> Saving…</>
    if (saveState === 'success') return <>&#10003; Saved!</>
    if (saveState === 'error')   return <>&#10007; Try again</>
    return <>Save</>
  }

  const saveBtnClass = `eep-save-btn${
    saveState === 'success' ? ' btn-success' :
    saveState === 'error'   ? ' btn-error'   :
    saveState === 'loading' ? ' btn-loading'  : ''
  }`

  return (
    <>
      <style>{panelCSS}</style>

      {toast && (
        <Toast
          key={toast.message}
          message={toast.message}
          type={toast.type}
          duration={2500}
          onDismiss={() => setToast(null)}
        />
      )}

      {open && <div className="eep-backdrop" onClick={handleClose} />}

      <div className={`eep-panel${open ? ' open' : ''}${saveState === 'loading' ? ' eep-busy' : ''}`}>
        <div className="eep-handle" />

        <div className="eep-header">
          <span className="eep-title">Log Expense</span>
          <button className="eep-close" onClick={handleClose}>✕</button>
        </div>

        <div className="eep-body">
          {/* Amount */}
          <div className="eep-amount-row">
            <span className="eep-rupee">₹</span>
            <input
              ref={amountRef}
              className="eep-amount-input"
              type="number"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="0"
              value={amount}
              disabled={saveState === 'loading' || saveState === 'success'}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
            />
          </div>

          {/* Type toggle */}
          <div className="eep-type-row">
            {[['expense','Expense',''],['income','Income','type-income'],['transfer_in','Transfer In','type-transfer']].map(([val, label, cls]) => (
              <button
                key={val}
                className={`eep-type-btn${txnType === val ? ` active ${cls}` : ''}`}
                onClick={() => setTxnType(val)}
                disabled={saveState === 'loading' || saveState === 'success'}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Category chips */}
          <div className="eep-label">Category</div>
          <div className="eep-chips">
            {topCats.map(cat => (
              <button
                key={cat.id}
                className={`eep-chip${categoryId === cat.id ? ' selected' : ''}`}
                onClick={() => setCategoryId(cat.id)}
              >
                <span>{cat.icon_code}</span>
                <span>{cat.category_name}</span>
              </button>
            ))}
            {hasMoreCats && (
              <button className="eep-chip more" onClick={() => setCatSheet(true)}>More →</button>
            )}
          </div>

          {/* Payment source chips */}
          <div className="eep-label">Payment Source</div>
          <div className="eep-chips">
            {topSrcs.map(src => (
              <button
                key={src.id}
                className={`eep-chip${sourceId === src.id ? ' selected' : ''}`}
                onClick={() => setSourceId(src.id)}
              >
                <span>{SOURCE_ICONS[src.source_type] || '💰'}</span>
                <span>{src.source_name}{src.last_four ? ` ···${src.last_four}` : ''}</span>
              </button>
            ))}
            {hasMoreSrcs && (
              <button className="eep-chip more" onClick={() => setSrcSheet(true)}>More →</button>
            )}
          </div>

          {/* Family member chips */}
          {familyMembers.length > 1 && (
            <>
              <div className="eep-label">For</div>
              <div className="eep-chips">
                {familyMembers.map(m => (
                  <button
                    key={m}
                    className={`eep-chip${member === m ? ' selected' : ''}`}
                    onClick={() => setMember(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Date */}
          <div className="eep-label">Date</div>
          <div className="eep-date-wrap">
            <label className="eep-date-btn">
              <span>📅</span>
              <span className="eep-date-label-rel">{fmtDateLabel(txnDate)}</span>
              {txnDate !== todayStr() && (
                <span className="eep-date-label-abs">{txnDate}</span>
              )}
              <input
                type="date"
                value={txnDate}
                max={todayStr()}
                onChange={e => setTxnDate(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>▾</span>
            </label>
          </div>

          {/* Note */}
          {!noteOpen ? (
            <button className="eep-note-toggle" onClick={() => setNoteOpen(true)}>
              <span>＋</span> Add note
            </button>
          ) : (
            <input
              className="eep-note-input"
              type="text"
              placeholder="Add a note…"
              value={note}
              onChange={e => setNote(e.target.value)}
              autoFocus
            />
          )}

          {/* Save */}
          <button
            className={saveBtnClass}
            onClick={handleSave}
            disabled={!canSave}
          >
            <SaveButtonContent />
          </button>
        </div>
      </div>

      {/* Category bottom sheet */}
      {catSheet && (
        <>
          <div className="eep-sheet-backdrop" onClick={() => setCatSheet(false)} />
          <div className="eep-sheet">
            <div className="eep-sheet-handle" />
            <div className="eep-sheet-title">Select Category</div>
            <div className="eep-sheet-grid">
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  className={`eep-sheet-item${categoryId === cat.id ? ' selected' : ''}`}
                  onClick={() => { setCategoryId(cat.id); setCatSheet(false) }}
                >
                  <span className="eep-sheet-icon">{cat.icon_code}</span>
                  <span className="eep-sheet-name">{cat.category_name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Source bottom sheet */}
      {srcSheet && (
        <>
          <div className="eep-sheet-backdrop" onClick={() => setSrcSheet(false)} />
          <div className="eep-sheet">
            <div className="eep-sheet-handle" />
            <div className="eep-sheet-title">Select Payment Source</div>
            <div className="eep-sheet-grid">
              {activeSources.map(src => (
                <button
                  key={src.id}
                  className={`eep-sheet-item${sourceId === src.id ? ' selected' : ''}`}
                  onClick={() => { setSourceId(src.id); setSrcSheet(false) }}
                >
                  <span className="eep-sheet-icon">{SOURCE_ICONS[src.source_type] || '💰'}</span>
                  <span className="eep-sheet-name">{src.source_name}{src.last_four ? ` ···${src.last_four}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
