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

  /* Currency selector */
  .eep-fx-rate-row {
    display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 12px; color: #94a3b8;
    flex-wrap: wrap;
  }
  .eep-fx-rate-edit {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .eep-fx-rate-input {
    width: 90px; padding: 4px 8px; border: 1.5px solid #1A3C6E; border-radius: 6px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; color: #1a1a2a;
  }
  .eep-fx-edit-btn {
    padding: 2px 8px; border: 1px solid #e2e8f0; border-radius: 6px;
    background: #ffffff; color: #64748b; font-size: 11px; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: border-color 0.12s;
  }
  .eep-fx-edit-btn:hover { border-color: #1A3C6E; color: #1A3C6E; }
  .eep-fx-confirm-btn {
    padding: 4px 10px; border: none; border-radius: 6px;
    background: #1A3C6E; color: #ffffff; font-size: 12px; font-weight: 700;
    cursor: pointer; font-family: 'DM Sans', sans-serif;
  }
  .eep-fx-preview {
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
    color: #1A3C6E; margin-bottom: 10px;
  }

  /* Toggle switch */
  .eep-toggle-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
  .eep-toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .eep-toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e2e8f0; border-radius: 20px; transition: background 0.2s; }
  .eep-toggle-slider::before { content: ''; position: absolute; width: 14px; height: 14px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
  .eep-toggle-switch input:checked + .eep-toggle-slider { background: #1A3C6E; }
  .eep-toggle-switch input:checked + .eep-toggle-slider::before { transform: translateX(16px); }

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
  const {
    categories, paymentSources, familyMembers, friends,
    addTransaction, addSplits, addFriend,
    currencyPrefs, updateCurrencyRate,
  } = useExpense()

  const [amount,     setAmount]     = useState('')
  const [txnType,    setTxnType]    = useState('expense')
  const [categoryId, setCategoryId] = useState(null)
  const [sourceId,   setSourceId]   = useState(null)
  const [member,     setMember]     = useState('Self')
  const [txnDate,    setTxnDate]    = useState(todayStr())
  const [note,       setNote]       = useState('')
  const [noteOpen,   setNoteOpen]   = useState(false)

  const [saveState,      setSaveState]      = useState('idle')
  const [catSheet,       setCatSheet]       = useState(false)
  const [srcSheet,       setSrcSheet]       = useState(false)
  const [toast,          setToast]          = useState(null)
  const [selectedCurrency, setSelectedCurrency] = useState('INR')
  const [editRate,       setEditRate]       = useState(false)
  const [editRateVal,    setEditRateVal]    = useState('')
  const [savingRate,     setSavingRate]     = useState(false)

  // Split state
  const [splitOn,           setSplitOn]           = useState(false)
  const [splitParticipants, setSplitParticipants] = useState([])
  const [splitMode,         setSplitMode]         = useState('equal')
  const [showAddFriendForm, setShowAddFriendForm] = useState(false)
  const [newFriendName,     setNewFriendName]     = useState('')

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
    setSelectedCurrency('INR')
    setEditRate(false)
    setEditRateVal('')
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
    setSelectedCurrency('INR')
    setEditRate(false)
    setEditRateVal('')
    setSplitOn(false)
    setSplitParticipants([])
    setSplitMode('equal')
    setShowAddFriendForm(false)
    setNewFriendName('')
  }

  // ── Split helpers ─────────────────────────────────────────────────────────

  function toggleParticipant(id, type, name) {
    setSplitParticipants(prev => {
      const exists = prev.find(p => p.id === id)
      if (exists) {
        if (id === 'self') return prev
        const updated = prev.filter(p => p.id !== id)
        if (exists.isPayer && updated.length > 0) {
          return updated.map((p, i) => i === 0 ? { ...p, isPayer: true } : p)
        }
        return updated
      }
      return [...prev, { id, type, name, amount: '', isPayer: false }]
    })
  }

  function movePayer(id) {
    setSplitParticipants(prev => prev.map(p => ({ ...p, isPayer: p.id === id })))
  }

  function setCustomAmount(id, val) {
    setSplitParticipants(prev => prev.map(p => p.id === id ? { ...p, amount: val } : p))
  }

  const totalAmt = parseFloat(amount) || 0

  const splitErr = (() => {
    if (!splitOn) return null
    if (splitParticipants.length < 2) return 'Add at least one person to split with'
    if (!splitParticipants.some(p => p.isPayer)) return 'Select who paid'
    if (splitMode === 'custom' && splitParticipants.length >= 2) {
      const nonLastSum = splitParticipants.slice(0, -1).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
      if (nonLastSum > totalAmt) return 'Amounts exceed total'
    }
    return null
  })()

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const rawAmt = parseFloat(amount)
    if (!rawAmt || rawAmt <= 0 || saveState === 'loading') return
    if (splitOn && splitErr) return
    setSaveState('loading')
    const catName = categories.find(c => c.id === categoryId)?.category_name || 'Expense'

    const isForeign = selectedCurrency !== 'INR'
    const selectedPref = currencyPrefs.find(c => c.currency_code === selectedCurrency)
    const rate = selectedPref?.fx_rate_to_inr || 1
    const amt = isForeign ? Math.round(rawAmt * rate * 100) / 100 : rawAmt

    try {
      const newTxn = await addTransaction({
        txn_type:          txnType,
        amount:            amt,
        category_id:       categoryId || null,
        payment_source_id: sourceId || null,
        family_member:     member || 'Self',
        txn_date:          txnDate,
        notes:             note || null,
        original_amount:   isForeign ? rawAmt : null,
        original_currency: isForeign ? selectedCurrency : null,
        fx_rate_used:      isForeign ? rate : null,
        inr_equivalent:    isForeign ? amt : null,
      })
      if (categoryId) localStorage.setItem(LSKEY_CAT, categoryId)
      if (sourceId)   localStorage.setItem(LSKEY_SRC, sourceId)

      if (splitOn && splitParticipants.length >= 2 && newTxn) {
        let rows
        if (splitMode === 'equal') {
          const share = Math.round((amt / splitParticipants.length) * 100) / 100
          rows = splitParticipants.map(p => ({
            participant_type: p.type,
            participant_name: p.name,
            share_amount:     share,
            is_payer:         p.isPayer,
          }))
        } else {
          const nonLast = splitParticipants.slice(0, -1)
          const lastP   = splitParticipants[splitParticipants.length - 1]
          const nonLastSum = nonLast.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
          const remainder  = Math.round((amt - nonLastSum) * 100) / 100
          rows = [
            ...nonLast.map(p => ({
              participant_type: p.type,
              participant_name: p.name,
              share_amount:     parseFloat(p.amount) || 0,
              is_payer:         p.isPayer,
            })),
            {
              participant_type: lastP.type,
              participant_name: lastP.name,
              share_amount:     remainder,
              is_payer:         lastP.isPayer,
            },
          ]
        }
        try {
          await addSplits(newTxn.id, rows)
        } catch (splitSaveErr) {
          console.error('ExpenseEntryPanel addSplits error:', splitSaveErr)
        }
        setSaveState('success')
        setToast({ message: `✓ ₹${amt.toLocaleString('en-IN')} split among ${splitParticipants.length} people`, type: 'success' })
      } else {
        setSaveState('success')
        setToast({ message: `Saved — ₹${amt.toLocaleString('en-IN')} · ${catName}`, type: 'success' })
      }

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

  const canSave = parseFloat(amount) > 0 && saveState !== 'loading' && saveState !== 'success' && !splitErr

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

  // ── Split panel (inline) ──────────────────────────────────────────────────

  const friendOptions  = friends.filter(f => f.is_active)
  const familyOptions  = familyMembers.filter(m => m !== 'Self')

  function SplitPanel() {
    return (
      <div style={{ marginBottom:16, padding:14, background:'#f8f9fa', borderRadius:12, border:'1px solid #e8ecf0' }}>
        {/* Participant selector */}
        <div className="eep-label" style={{ marginBottom:8 }}>Who was there?</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          {familyOptions.map(m => {
            const id  = `fam-${m}`
            const sel = splitParticipants.some(p => p.id === id)
            return (
              <button key={id}
                style={{ padding:'6px 12px', borderRadius:20, border:'1.5px solid', borderColor: sel?'#1A3C6E':'#e2e8f0', background: sel?'#1A3C6E':'#f1f5f9', color: sel?'#ffffff':'#475569', fontFamily:'DM Sans', fontSize:12, fontWeight:500, cursor:'pointer' }}
                onClick={() => toggleParticipant(id, 'family', m)}
              >{m}</button>
            )
          })}
          {friendOptions.map(f => {
            const sel = splitParticipants.some(p => p.id === f.id)
            return (
              <button key={f.id}
                style={{ padding:'6px 12px', borderRadius:20, border:'1.5px solid', borderColor: sel?'#1A3C6E':'#e2e8f0', background: sel?'#1A3C6E':'#f1f5f9', color: sel?'#ffffff':'#475569', fontFamily:'DM Sans', fontSize:12, fontWeight:500, cursor:'pointer' }}
                onClick={() => toggleParticipant(f.id, 'friend', f.friend_name)}
              >👤 {f.friend_name}{f.nickname ? ` (${f.nickname})` : ''}</button>
            )
          })}
          {!showAddFriendForm && (
            <button
              style={{ padding:'6px 12px', borderRadius:20, border:'1.5px dashed #1A3C6E', background:'#ffffff', color:'#1A3C6E', fontFamily:'DM Sans', fontSize:12, fontWeight:600, cursor:'pointer' }}
              onClick={() => setShowAddFriendForm(true)}
            >+ Add friend</button>
          )}
          {showAddFriendForm && (
            <div style={{ display:'flex', gap:6, alignItems:'center', width:'100%', marginTop:4 }}>
              <input
                style={{ flex:1, padding:'6px 10px', border:'1.5px solid #1A3C6E', borderRadius:8, fontFamily:'DM Sans', fontSize:13, outline:'none', color:'#1a1a2a' }}
                placeholder="Friend's name"
                value={newFriendName}
                onChange={e => setNewFriendName(e.target.value)}
                autoFocus
              />
              <button
                disabled={!newFriendName.trim()}
                onClick={async () => {
                  const name = newFriendName.trim()
                  if (!name) return
                  try {
                    await addFriend(name, null)
                    toggleParticipant(`new-${name}-${Date.now()}`, 'friend', name)
                    setNewFriendName('')
                    setShowAddFriendForm(false)
                  } catch (err) { console.error('ExpenseEntryPanel addFriend error:', err) }
                }}
                style={{ padding:'6px 12px', border:'none', borderRadius:8, background:'#1A3C6E', color:'#ffffff', fontFamily:'DM Sans', fontSize:12, fontWeight:600, cursor:'pointer' }}
              >Add</button>
              <button
                onClick={() => { setShowAddFriendForm(false); setNewFriendName('') }}
                style={{ padding:'6px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, background:'#ffffff', color:'#64748b', fontFamily:'DM Sans', fontSize:12, cursor:'pointer' }}
              >✕</button>
            </div>
          )}
        </div>

        {splitParticipants.length < 2 && (
          <div style={{ fontSize:12, color:'#94a3b8', fontFamily:'DM Sans', marginBottom:4 }}>Tap people above to add them to the split</div>
        )}

        {splitParticipants.length >= 2 && (
          <>
            {/* Mode toggle */}
            <div style={{ display:'flex', background:'#f1f5f9', borderRadius:8, padding:3, marginBottom:12 }}>
              {['equal','custom'].map(m => (
                <button key={m}
                  onClick={() => setSplitMode(m)}
                  style={{ flex:1, padding:'6px', border:'none', borderRadius:6, fontFamily:'DM Sans', fontSize:13, fontWeight:500, cursor:'pointer', background: splitMode===m?'#1A3C6E':'transparent', color: splitMode===m?'#ffffff':'#64748b', transition:'all 0.15s' }}
                >{m === 'equal' ? 'Equal' : 'Custom'}</button>
              ))}
            </div>

            {/* Equal mode rows */}
            {splitMode === 'equal' && (() => {
              const share = totalAmt / splitParticipants.length
              return splitParticipants.map(p => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <span style={{ flex:1, fontFamily:'DM Sans', fontSize:13, color:'#374151' }}>{p.name}</span>
                  <span style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:600, color:'#1a1a2a' }}>₹{share.toLocaleString('en-IN', { maximumFractionDigits:2 })}</span>
                  <button
                    style={{ padding:'3px 10px', border:'none', borderRadius:20, fontFamily:'DM Sans', fontSize:11, fontWeight:600, cursor:'pointer', background: p.isPayer?'#1A3C6E':'#f1f5f9', color: p.isPayer?'#ffffff':'#94a3b8' }}
                    onClick={() => movePayer(p.id)}
                  >Payer</button>
                </div>
              ))
            })()}

            {/* Custom mode rows */}
            {splitMode === 'custom' && (() => {
              const nonLast    = splitParticipants.slice(0, -1)
              const lastP      = splitParticipants[splitParticipants.length - 1]
              const nonLastSum = nonLast.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
              const remainder  = Math.round((totalAmt - nonLastSum) * 100) / 100
              return (
                <>
                  {nonLast.map(p => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                      <span style={{ flex:1, fontFamily:'DM Sans', fontSize:13, color:'#374151' }}>{p.name}</span>
                      <input type="number" inputMode="decimal"
                        style={{ width:80, padding:'5px 8px', border:'1.5px solid #e2e8f0', borderRadius:8, fontFamily:'DM Sans', fontSize:13, outline:'none', textAlign:'right', color:'#1a1a2a' }}
                        value={p.amount} onChange={e => setCustomAmount(p.id, e.target.value)} placeholder="₹"
                      />
                      <button
                        style={{ padding:'3px 10px', border:'none', borderRadius:20, fontFamily:'DM Sans', fontSize:11, fontWeight:600, cursor:'pointer', background: p.isPayer?'#1A3C6E':'#f1f5f9', color: p.isPayer?'#ffffff':'#94a3b8' }}
                        onClick={() => movePayer(p.id)}
                      >Payer</button>
                    </div>
                  ))}
                  {lastP && (
                    <div key={lastP.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
                      <span style={{ flex:1, fontFamily:'DM Sans', fontSize:13, color:'#374151' }}>{lastP.name}</span>
                      <span style={{ width:80, textAlign:'right', fontFamily:'DM Sans', fontSize:13, fontWeight:600, color: remainder < 0 ? '#dc2626' : '#1a1a2a' }}>
                        ₹{remainder.toLocaleString('en-IN', { maximumFractionDigits:2 })}
                      </span>
                      <button
                        style={{ padding:'3px 10px', border:'none', borderRadius:20, fontFamily:'DM Sans', fontSize:11, fontWeight:600, cursor:'pointer', background: lastP.isPayer?'#1A3C6E':'#f1f5f9', color: lastP.isPayer?'#ffffff':'#94a3b8' }}
                        onClick={() => movePayer(lastP.id)}
                      >Payer</button>
                    </div>
                  )}
                </>
              )
            })()}

            {splitErr && (
              <div style={{ marginTop:8, fontSize:12, color:'#dc2626', fontFamily:'DM Sans' }}>{splitErr}</div>
            )}
          </>
        )}
      </div>
    )
  }

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
          {/* Currency chip row */}
          {currencyPrefs.length > 0 && (
            <>
              <div className="eep-label">Currency</div>
              <div className="eep-chips" style={{ marginBottom:12 }}>
                <button
                  className={`eep-chip${selectedCurrency === 'INR' ? ' selected' : ''}`}
                  onClick={() => { setSelectedCurrency('INR'); setEditRate(false) }}
                >
                  ₹ INR
                </button>
                {currencyPrefs.map(cp => (
                  <button
                    key={cp.currency_code}
                    className={`eep-chip${selectedCurrency === cp.currency_code ? ' selected' : ''}`}
                    onClick={() => { setSelectedCurrency(cp.currency_code); setEditRate(false) }}
                  >
                    {cp.currency_symbol} {cp.currency_code}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Amount */}
          <div className="eep-amount-row">
            <span className="eep-rupee">
              {selectedCurrency === 'INR'
                ? '₹'
                : (currencyPrefs.find(c => c.currency_code === selectedCurrency)?.currency_symbol || selectedCurrency)}
            </span>
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

          {/* FX rate row + preview */}
          {selectedCurrency !== 'INR' && currencyPrefs.length > 0 && (() => {
            const pref = currencyPrefs.find(c => c.currency_code === selectedCurrency)
            const rate = pref?.fx_rate_to_inr || 1
            const rawAmt = parseFloat(amount)
            const inrPreview = rawAmt > 0 ? (rawAmt * rate).toLocaleString('en-IN') : null

            async function handleSaveRate() {
              const r = parseFloat(editRateVal)
              if (!r || r <= 0 || !pref) return
              setSavingRate(true)
              try {
                await updateCurrencyRate(pref.id, r)
                setEditRate(false)
                setEditRateVal('')
              } catch (err) {
                console.error('ExpenseEntryPanel handleSaveRate error:', err)
              } finally { setSavingRate(false) }
            }

            return (
              <>
                <div className="eep-fx-rate-row">
                  {editRate ? (
                    <div className="eep-fx-rate-edit">
                      <span>1 {selectedCurrency} = ₹</span>
                      <input
                        className="eep-fx-rate-input"
                        type="number"
                        inputMode="decimal"
                        value={editRateVal}
                        onChange={e => setEditRateVal(e.target.value)}
                        placeholder={String(rate)}
                        autoFocus
                      />
                      <button className="eep-fx-confirm-btn" disabled={savingRate} onClick={handleSaveRate}>
                        {savingRate ? '…' : '✓'}
                      </button>
                      <button className="eep-fx-edit-btn" onClick={() => { setEditRate(false); setEditRateVal('') }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <span>1 {selectedCurrency} = ₹{rate}</span>
                      <button className="eep-fx-edit-btn" onClick={() => { setEditRate(true); setEditRateVal(String(rate)) }}>✏</button>
                    </>
                  )}
                </div>
                <div className="eep-fx-preview">
                  {inrPreview ? `= ₹${inrPreview}` : '= ₹ —'}
                </div>
              </>
            )
          })()}

          {/* Type toggle */}
          <div className="eep-type-row">
            {[['expense','Expense',''],['income','Income','type-income'],['transfer_in','Transfer In','type-transfer']].map(([val, label, cls]) => (
              <button
                key={val}
                className={`eep-type-btn${txnType === val ? ` active ${cls}` : ''}`}
                onClick={() => { setTxnType(val); if (val !== 'expense') { setSplitOn(false); setSplitParticipants([]) } }}
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

          {/* Split toggle — expense only */}
          {txnType === 'expense' && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0 12px', borderTop:'1px solid #f1f5f9', marginTop:4 }}>
              <span style={{ fontFamily:'DM Sans', fontSize:13, fontWeight:500, color:'#374151' }}>Split this expense?</span>
              <label className="eep-toggle-switch">
                <input
                  type="checkbox"
                  checked={splitOn}
                  onChange={e => {
                    const on = e.target.checked
                    setSplitOn(on)
                    if (on) setSplitParticipants([{ id:'self', type:'self', name:'Self', amount:'', isPayer:true }])
                    else { setSplitParticipants([]); setSplitMode('equal'); setShowAddFriendForm(false); setNewFriendName('') }
                  }}
                />
                <span className="eep-toggle-slider" />
              </label>
            </div>
          )}

          {/* Split panel */}
          {txnType === 'expense' && splitOn && <SplitPanel />}

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
