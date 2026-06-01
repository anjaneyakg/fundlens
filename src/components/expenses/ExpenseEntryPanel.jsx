import { useState, useEffect, useRef, useCallback } from 'react'
import { useExpense } from '../../context/ExpenseContext'

const SOURCE_ICONS = {
  credit_card:  '💳',
  bank_account: '🏦',
  cash:         '💵',
  upi_wallet:   '📲',
  third_party:  '🔗',
}

function fmtDateLabel(dateStr) {
  const today     = new Date()
  const d         = new Date(dateStr + 'T00:00:00')
  const diffDays  = Math.round((today.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`
  return dateStr
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const panelStyle = `
  .eep-backdrop {
    position: fixed; inset: 0; z-index: 800;
    background: rgba(0,0,0,0.45);
    transition: opacity 0.25s;
  }
  .eep-panel {
    position: fixed; bottom: 0; left: 50%; z-index: 801;
    transform: translateX(-50%) translateY(100%);
    width: 100%; max-width: 480px;
    background: var(--color-bg, #fff);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 40px rgba(0,0,0,0.18);
    transition: transform 0.3s cubic-bezier(0.32,0.72,0,1);
    display: flex; flex-direction: column;
    max-height: 92vh;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .eep-panel.open { transform: translateX(-50%) translateY(0); }

  .eep-handle {
    width: 40px; height: 4px; background: #e0e0e0; border-radius: 2px;
    margin: 12px auto 0; flex-shrink: 0;
  }
  .eep-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px 8px; flex-shrink: 0;
  }
  .eep-title {
    font-family: 'DM Sans', sans-serif; font-size: 17px; font-weight: 700;
    color: var(--color-text-primary, #111);
  }
  .eep-close {
    width: 30px; height: 30px; border-radius: 50%;
    border: none; background: #f0f0f0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 14px; color: #666;
  }

  .eep-body {
    flex: 1; overflow-y: auto; padding: 0 20px 20px;
  }

  .eep-amount-row {
    display: flex; align-items: center;
    background: #f8f9fa; border-radius: 14px;
    padding: 12px 16px; margin-bottom: 14px;
    border: 2px solid transparent;
    transition: border-color 0.15s;
  }
  .eep-amount-row:focus-within { border-color: var(--color-primary, #1D9E75); }
  .eep-rupee {
    font-family: 'DM Sans', sans-serif; font-size: 28px; font-weight: 700;
    color: var(--color-text-muted, #888); margin-right: 6px;
  }
  .eep-amount-input {
    flex: 1; border: none; background: transparent; outline: none;
    font-family: 'DM Sans', sans-serif; font-size: 28px; font-weight: 700;
    color: var(--color-text-primary, #111);
    width: 100%; min-width: 0;
  }
  .eep-amount-input::placeholder { color: #ccc; }

  .eep-type-row {
    display: flex; background: #f0f0f0; border-radius: 10px;
    padding: 3px; margin-bottom: 14px; gap: 2px;
  }
  .eep-type-btn {
    flex: 1; padding: 8px; border: none; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; background: transparent; color: #666;
    transition: all 0.15s;
  }
  .eep-type-btn.active {
    background: #fff; color: var(--color-primary, #1D9E75);
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  }
  .eep-type-btn.active.income { color: #4CAF50; }
  .eep-type-btn.active.transfer { color: #2196F3; }

  .eep-label {
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    color: var(--color-text-muted, #888); text-transform: uppercase; letter-spacing: 0.06em;
    margin-bottom: 7px;
  }

  .eep-chips {
    display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px;
    scrollbar-width: none;
  }
  .eep-chips::-webkit-scrollbar { display: none; }
  .eep-chip {
    flex-shrink: 0; padding: 6px 12px; border-radius: 20px;
    border: 1.5px solid #e8e8e8; background: #fff;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
    display: flex; align-items: center; gap: 5px;
    color: var(--color-text-primary, #111);
  }
  .eep-chip:hover { border-color: var(--color-primary, #1D9E75); }
  .eep-chip.selected {
    border-color: var(--color-primary, #1D9E75);
    background: rgba(29,158,117,0.08); color: var(--color-primary, #1D9E75);
    font-weight: 600;
  }
  .eep-chip.more { color: var(--color-primary, #1D9E75); font-weight: 600; border-style: dashed; }

  .eep-date-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 14px; border: 1.5px solid #e8e8e8; border-radius: 10px;
    background: #fff; cursor: pointer; margin-bottom: 14px;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--color-text-primary, #111); transition: border-color 0.15s;
  }
  .eep-date-btn:hover { border-color: var(--color-primary, #1D9E75); }
  .eep-date-input {
    border: none; outline: none; font-family: 'DM Sans', sans-serif;
    font-size: 13px; background: transparent; color: var(--color-primary, #1D9E75);
    font-weight: 600; cursor: pointer;
  }

  .eep-note-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 0; border: none; background: transparent;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--color-text-muted, #888); cursor: pointer; margin-bottom: 10px;
  }
  .eep-note-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid #e8e8e8; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; margin-bottom: 14px;
    transition: border-color 0.15s;
  }
  .eep-note-input:focus { border-color: var(--color-primary, #1D9E75); }

  .eep-save-btn {
    width: 100%; padding: 14px; border: none; border-radius: 12px;
    background: var(--color-primary, #1D9E75); color: #fff;
    font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 700;
    cursor: pointer; transition: all 0.15s;
    box-shadow: 0 4px 16px rgba(29,158,117,0.3);
  }
  .eep-save-btn:hover:not(:disabled) { background: var(--color-primary-dark, #16805e); }
  .eep-save-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

  .eep-sheet-backdrop {
    position: fixed; inset: 0; z-index: 900;
    background: rgba(0,0,0,0.5);
  }
  .eep-sheet {
    position: fixed; bottom: 0; left: 50%; z-index: 901;
    transform: translateX(-50%);
    width: 100%; max-width: 480px;
    background: var(--color-bg, #fff);
    border-radius: 20px 20px 0 0;
    padding: 20px 20px 32px;
    max-height: 70vh; overflow-y: auto;
    padding-bottom: env(safe-area-inset-bottom, 32px);
  }
  .eep-sheet-title {
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700;
    margin-bottom: 16px; color: var(--color-text-primary, #111);
  }
  .eep-sheet-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  }
  .eep-sheet-item {
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    padding: 10px 6px; border-radius: 12px; border: 1.5px solid #e8e8e8;
    cursor: pointer; transition: all 0.12s; background: #fff;
  }
  .eep-sheet-item:hover { border-color: var(--color-primary, #1D9E75); }
  .eep-sheet-item.selected {
    border-color: var(--color-primary, #1D9E75);
    background: rgba(29,158,117,0.06);
  }
  .eep-sheet-icon { font-size: 22px; }
  .eep-sheet-name {
    font-family: 'DM Sans', sans-serif; font-size: 10px; text-align: center;
    color: var(--color-text-primary, #111); line-height: 1.2;
  }
  .eep-sheet-add {
    border: 1.5px dashed #ccc; color: var(--color-primary, #1D9E75); font-size: 10px;
    font-weight: 600;
  }

  .eep-saving { opacity: 0.7; pointer-events: none; }
`

const LSKEY_CAT    = 'eep_last_cat'
const LSKEY_SRC    = 'eep_last_src'

export default function ExpenseEntryPanel({ open, onClose }) {
  const { categories, paymentSources, familyMembers, addTransaction } = useExpense()

  const [amount,      setAmount]      = useState('')
  const [txnType,     setTxnType]     = useState('expense')
  const [categoryId,  setCategoryId]  = useState(null)
  const [sourceId,    setSourceId]    = useState(null)
  const [member,      setMember]      = useState('Self')
  const [txnDate,     setTxnDate]     = useState(todayStr())
  const [note,        setNote]        = useState('')
  const [noteOpen,    setNoteOpen]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [catSheet,    setCatSheet]    = useState(false)
  const [srcSheet,    setSrcSheet]    = useState(false)

  const amountRef = useRef(null)
  const dateRef   = useRef(null)

  const activeCategories  = categories.filter(c => c.is_active)
  const activeSources     = paymentSources.filter(s => s.is_active)

  // Compute top-used categories & sources from localStorage recency (simple last-used)
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

  const topCats = sortedCats.slice(0, 6)
  const topSrcs = sortedSrcs.slice(0, 3)
  const hasMoreCats = activeCategories.length > 6
  const hasMoreSrcs = activeSources.length > 3

  // Auto-select last-used on open
  useEffect(() => {
    if (!open) return
    const savedCat = localStorage.getItem(LSKEY_CAT)
    const savedSrc = localStorage.getItem(LSKEY_SRC)
    if (savedCat && activeCategories.find(c => c.id === savedCat)) setCategoryId(savedCat)
    else if (activeCategories.length > 0) setCategoryId(activeCategories[0].id)
    if (savedSrc && activeSources.find(s => s.id === savedSrc)) setSourceId(savedSrc)
    else if (activeSources.length > 0) setSourceId(activeSources[0].id)
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [open])

  function handleClose() {
    setCatSheet(false); setSrcSheet(false)
    onClose()
  }

  function resetForNextEntry() {
    setAmount('')
    setNote('')
    setNoteOpen(false)
    setTxnDate(todayStr())
    // Keep type, category, source, member for fast repeat entry
  }

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) return
    setSaving(true)
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
      resetForNextEntry()
    } catch (err) {
      console.error('ExpenseEntryPanel save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const canSave = parseFloat(amount) > 0 && !saving

  return (
    <>
      <style>{panelStyle}</style>

      {open && <div className="eep-backdrop" onClick={handleClose} />}

      <div className={`eep-panel${open ? ' open' : ''}${saving ? ' eep-saving' : ''}`}>
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
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
            />
          </div>

          {/* Type toggle */}
          <div className="eep-type-row">
            {[['expense','Expense'],['income','Income'],['transfer_in','Transfer In']].map(([val, label]) => (
              <button
                key={val}
                className={`eep-type-btn${txnType === val ? ` active ${val === 'income' ? 'income' : val === 'transfer_in' ? 'transfer' : ''}` : ''}`}
                onClick={() => setTxnType(val)}
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
              <div className="eep-chips" style={{ marginBottom: 14 }}>
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
          <div style={{ marginBottom: 14 }}>
            <label className="eep-date-btn">
              <span>📅</span>
              <span style={{ color: 'var(--color-text-primary, #111)' }}>
                {fmtDateLabel(txnDate)}
              </span>
              <input
                ref={dateRef}
                type="date"
                value={txnDate}
                max={todayStr()}
                onChange={e => setTxnDate(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0 }}
              />
              <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>▾</span>
            </label>
            {txnDate !== todayStr() && (
              <span style={{ marginLeft: 12, fontSize: 12, color: '#888' }}>{txnDate}</span>
            )}
          </div>

          {/* Note */}
          {!noteOpen && (
            <button className="eep-note-toggle" onClick={() => setNoteOpen(true)}>
              <span>＋</span> Add note
            </button>
          )}
          {noteOpen && (
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
          <button className="eep-save-btn" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Category bottom sheet */}
      {catSheet && (
        <>
          <div className="eep-sheet-backdrop" onClick={() => setCatSheet(false)} />
          <div className="eep-sheet">
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
