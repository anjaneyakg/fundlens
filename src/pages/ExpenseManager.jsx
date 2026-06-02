import { useState, useMemo } from 'react'
import { useExpense } from '../context/ExpenseContext'
import ExpenseEntryPanel from '../components/expenses/ExpenseEntryPanel'
import ExpenseAnalytics  from '../components/expenses/ExpenseAnalytics'
import Toast             from '../components/common/Toast'
import useWindowWidth    from '../hooks/useWindowWidth'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y.slice(2)}`
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-IN')
}

function todayStr() {
  const d = new Date()
  return dateToDStr(d)
}

// FIX B: always format dates from a Date object using local time — never toISOString()
function dateToDStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function monthLabel(offset = 0) {
  const d = new Date(); d.setMonth(d.getMonth() + offset)
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

function monthPrefix(offset = 0) {
  const d = new Date(); d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d     = new Date(dateStr + 'T00:00:00'); d.setHours(0,0,0,0)
  return Math.round((d - today) / 86400000)
}

function computeNextDue(r) {
  if (!r.due_date_next) return null
  const d = new Date(r.due_date_next + 'T00:00:00')
  switch (r.frequency) {
    case 'daily':   d.setDate(d.getDate() + 1); break
    case 'weekly':  d.setDate(d.getDate() + 7); break
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break
    case 'monthly':
    default:        d.setMonth(d.getMonth() + 1); break
  }
  return dateToDStr(d)
}

// FIX A: compute the first due_date_next from frequency + due_day
// Called on form save and on frequency/due_day change so the date is always pre-filled
function computeInitialDueDate(frequency, dueDay) {
  const today = new Date(); today.setHours(0,0,0,0)
  if (frequency === 'daily') {
    const d = new Date(today); d.setDate(d.getDate() + 1)
    return dateToDStr(d)
  }
  if (frequency === 'weekly') {
    const d = new Date(today); d.setDate(d.getDate() + 7)
    return dateToDStr(d)
  }
  if (frequency === 'yearly') {
    const d = new Date(today); d.setFullYear(d.getFullYear() + 1)
    return dateToDStr(d)
  }
  // monthly
  const bcd = parseInt(dueDay, 10)
  if (bcd >= 1 && bcd <= 31) {
    const dom = today.getDate()
    const d = dom < bcd
      ? new Date(today.getFullYear(), today.getMonth(), bcd)
      : new Date(today.getFullYear(), today.getMonth() + 1, bcd)
    return dateToDStr(d)
  }
  // monthly with no due_day — default to same day next month
  const d = new Date(today); d.setMonth(d.getMonth() + 1)
  return dateToDStr(d)
}

const SOURCE_ICONS = { credit_card:'💳', bank_account:'🏦', cash:'💵', upi_wallet:'📲', third_party:'🔗' }
const SOURCE_TYPE_LABELS = { credit_card:'Credit Card', bank_account:'Bank Account', cash:'Cash', upi_wallet:'UPI / Wallet', third_party:'Third Party' }

// ── Styles ────────────────────────────────────────────────────────────────────

const emCSS = `
  .em-wrap {
    max-width: 640px; margin: 0 auto; padding: 0 0 120px;
    font-family: 'DM Sans', sans-serif;
    background: #f8f9fa; min-height: 100vh;
  }
  .em-page-header {
    padding: 20px 16px 0;
    display: flex; align-items: center; gap: 10px;
    background: #f8f9fa;
  }
  .em-page-title { font-size: 22px; font-weight: 700; color: #1a1a2a; flex: 1; }
  .em-log-btn {
    padding: 8px 18px; border: none; border-radius: 10px;
    background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .em-log-btn:hover { background: #15306b; }

  .em-tabs {
    display: flex; border-bottom: 2px solid #e8ecf0;
    padding: 0 16px; margin-top: 16px; gap: 0;
    position: sticky; top: 56px; z-index: 100;
    background: #ffffff; box-shadow: 0 1px 0 #e8ecf0;
  }
  .em-tab {
    padding: 13px 16px; border: none; background: transparent;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    color: #94a3b8; cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s; white-space: nowrap;
    display: flex; align-items: center; gap: 5px;
  }
  .em-tab:hover { color: #1A3C6E; }
  .em-tab.active { color: #1A3C6E; border-bottom-color: #1A3C6E; font-weight: 700; }
  .em-tab-badge {
    background: #dc2626; color: #ffffff;
    font-size: 10px; font-weight: 700;
    min-width: 16px; height: 16px; border-radius: 8px;
    padding: 0 4px; line-height: 16px; text-align: center;
  }

  /* ── LOG TAB ── */
  .em-filter-bar {
    display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto;
    scrollbar-width: none; background: #f8f9fa;
  }
  .em-filter-bar::-webkit-scrollbar { display: none; }
  .em-filter-chip {
    flex-shrink: 0; padding: 7px 16px; border-radius: 20px;
    border: 1.5px solid #e2e8f0; background: #ffffff;
    font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.12s;
    color: #475569; white-space: nowrap; font-family: 'DM Sans', sans-serif;
  }
  .em-filter-chip:hover { border-color: #1A3C6E; color: #1A3C6E; }
  .em-filter-chip.active { background: #1A3C6E; color: #ffffff; border-color: #1A3C6E; font-weight: 600; }

  .em-budget-banner {
    margin: 0 16px 12px;
    padding: 10px 14px; border-radius: 8px;
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; line-height: 1.4; font-family: 'DM Sans', sans-serif;
  }
  .em-budget-banner.amber { background: #fffbeb; border: 1px solid #f59e0b; color: #92400e; }
  .em-budget-banner.red   { background: #fef2f2; border: 1px solid #dc2626; color: #991b1b; }
  .em-budget-banner-text { flex: 1; }
  .em-budget-view-btn {
    border: none; background: transparent; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
    color: inherit; text-decoration: underline; white-space: nowrap; padding: 0;
  }
  .em-budget-dismiss-btn {
    border: none; background: transparent; cursor: pointer;
    font-size: 14px; color: inherit; opacity: 0.6; padding: 2px 4px; line-height: 1;
  }
  .em-budget-dismiss-btn:hover { opacity: 1; }

  .em-summary-bar {
    display: flex; margin: 0 16px 12px;
    background: #ffffff; border-radius: 12px; overflow: hidden;
    border: 1px solid #e8ecf0; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .em-summary-item { flex: 1; padding: 12px 8px; text-align: center; border-right: 1px solid #f1f5f9; }
  .em-summary-item:last-child { border-right: none; }
  .em-summary-value { font-size: 15px; font-weight: 700; }
  .em-summary-label { font-size: 10px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }

  .em-txn-list { padding: 0 16px; }
  .em-txn-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer;
  }
  .em-txn-row:last-child { border-bottom: none; }
  .em-txn-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0; background: #f0f4ff;
  }
  .em-txn-centre { flex: 1; min-width: 0; }
  .em-txn-cat  { font-size: 14px; font-weight: 600; color: #1a1a2a; }
  .em-txn-meta { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .em-txn-right { text-align: right; flex-shrink: 0; }
  .em-txn-amount { font-size: 15px; font-weight: 700; }
  .em-txn-src { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .em-txn-expand {
    padding: 10px 16px 14px 50px; background: #f8f9fa;
    border-radius: 0 0 10px 10px; border-bottom: 1px solid #f1f5f9;
  }
  .em-txn-note { font-size: 12px; color: #64748b; margin-bottom: 10px; font-style: italic; }
  .em-txn-del-btn {
    padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; border: none;
    background: #fef2f2; color: #dc2626; font-family: 'DM Sans', sans-serif;
  }
  .em-txn-del-btn:hover { background: #fee2e2; }
  .em-empty { text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 14px; line-height: 1.6; }

  /* ── SETUP TAB ── */
  .em-setup-section {
    margin: 10px 16px; background: #ffffff; border: 1px solid #e8ecf0;
    border-radius: 14px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .em-setup-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; cursor: pointer; user-select: none; transition: background 0.1s;
  }
  .em-setup-header:hover { background: #fafbfc; }
  .em-setup-header-left { display: flex; align-items: center; gap: 10px; }
  .em-setup-icon  { font-size: 20px; }
  .em-setup-title { font-size: 15px; font-weight: 600; color: #374151; }
  .em-setup-count { font-size: 11px; font-weight: 600; color: #1A3C6E; background: #f0f4ff; padding: 2px 8px; border-radius: 10px; margin-top: 2px; display: inline-block; }
  .em-setup-chevron { font-size: 12px; color: #94a3b8; transition: transform 0.2s; }
  .em-setup-chevron.open { transform: rotate(180deg); }
  .em-setup-body { padding: 4px 16px 16px; border-top: 1px solid #f1f5f9; }

  .em-setup-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f8f9fa; }
  .em-setup-list-item:last-child { border-bottom: none; }
  .em-setup-item-icon { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
  .em-setup-item-name { flex: 1; font-size: 14px; font-weight: 500; color: #1a1a2a; }
  .em-setup-item-sub  { font-size: 11px; color: #94a3b8; margin-top: 1px; }
  .em-setup-actions   { display: flex; align-items: center; gap: 6px; }
  .em-icon-btn {
    border: none; background: transparent; cursor: pointer;
    font-size: 14px; color: #94a3b8; padding: 5px; border-radius: 6px;
    transition: color 0.12s, background 0.12s; line-height: 1;
  }
  .em-icon-btn:hover        { color: #1A3C6E; background: #f0f4ff; }
  .em-icon-btn.danger:hover { color: #dc2626; background: #fef2f2; }

  .em-add-form {
    margin-top: 12px; padding: 14px; background: #f8f9fa;
    border-radius: 12px; display: flex; flex-direction: column; gap: 10px;
    border: 1px solid #e8ecf0;
  }
  .em-field-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
  .em-field-hint  { font-size: 11px; color: #94a3b8; margin-top: 3px; font-family: 'DM Sans', sans-serif; }
  .em-field-input {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; transition: border-color 0.15s; background: #ffffff; color: #1a1a2a;
  }
  .em-field-input:focus { border-color: #1A3C6E; }
  .em-field-select {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; transition: border-color 0.15s; background: #ffffff;
    color: #1a1a2a; appearance: none; cursor: pointer;
  }
  .em-field-select:focus { border-color: #1A3C6E; }
  .em-form-row { display: flex; gap: 10px; }
  .em-form-row > * { flex: 1; min-width: 0; }
  .em-add-btn {
    padding: 10px; border: none; border-radius: 10px; background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .em-add-btn:hover:not(:disabled) { background: #15306b; }
  .em-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .em-cancel-btn {
    padding: 10px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    background: #ffffff; color: #374151;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .em-cancel-btn:hover { border-color: #94a3b8; }
  .em-add-trigger {
    margin-top: 12px; width: 100%; padding: 10px; border: 1.5px dashed #cbd5e1; border-radius: 10px;
    background: transparent; font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: #1A3C6E; font-weight: 600; cursor: pointer; transition: border-color 0.15s;
  }
  .em-add-trigger:hover { border-color: #1A3C6E; background: #f0f4ff; }
  .em-colour-swatch { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; border: 2px solid rgba(0,0,0,0.08); }
  .em-toggle-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
  .em-toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .em-toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e2e8f0; border-radius: 20px; transition: background 0.2s; }
  .em-toggle-slider::before { content: ''; position: absolute; width: 14px; height: 14px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
  input:checked + .em-toggle-slider { background: #1A3C6E; }
  input:checked + .em-toggle-slider::before { transform: translateX(16px); }

  /* ── DUES TAB ── */
  .em-dues-wrap { padding: 12px 16px; }
  .em-dues-section-hdr {
    font-size: 13px; font-weight: 700; color: #374151;
    margin: 0 0 10px; padding: 0; font-family: 'DM Sans', sans-serif;
    display: flex; align-items: center; gap: 6px;
  }
  .em-dues-section-hdr.overdue-hdr { color: #dc2626; }
  .em-due-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; margin-bottom: 8px;
    border: 1.5px solid #e8ecf0; border-radius: 14px;
    background: #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  }
  .em-due-row.overdue { border-color: #fca5a5; background: #fef2f2; }
  .em-due-row.urgent  { border-color: #fcd34d; background: #fffbeb; }
  .em-due-row.ok      { background: #ffffff; border-color: #e8ecf0; }
  .em-due-icon { font-size: 22px; flex-shrink: 0; width: 28px; text-align: center; }
  .em-due-info { flex: 1; min-width: 0; }
  .em-due-name { font-size: 14px; font-weight: 600; color: #1a1a2a; font-family: 'DM Sans', sans-serif; }
  .em-due-meta { font-size: 11px; color: #94a3b8; margin-top: 2px; font-family: 'DM Sans', sans-serif; }
  .em-due-badge {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
    margin-top: 3px; display: inline-block; font-family: 'DM Sans', sans-serif;
  }
  .em-due-badge.overdue { background: #fee2e2; color: #991b1b; }
  .em-due-badge.urgent  { background: #fef3c7; color: #92400e; }
  .em-due-badge.ok      { background: #f1f5f9; color: #64748b; }
  .em-due-amt { font-size: 15px; font-weight: 700; color: #1a1a2a; font-family: 'DM Sans', sans-serif; flex-shrink: 0; }
  .em-due-actions { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
  .em-due-pay-btn {
    padding: 6px 12px; border: none; border-radius: 8px;
    background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: background 0.12s; white-space: nowrap;
  }
  .em-due-pay-btn:hover:not(:disabled) { background: #15306b; }
  .em-due-pay-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .em-due-snooze-btn {
    padding: 5px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
    background: #ffffff; color: #64748b;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    cursor: pointer; transition: border-color 0.12s; white-space: nowrap;
  }
  .em-due-snooze-btn:hover:not(:disabled) { border-color: #94a3b8; }
  .em-due-snooze-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .em-due-week-label {
    font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;
    letter-spacing: 0.06em; margin: 14px 0 8px; font-family: 'DM Sans', sans-serif;
  }
  .em-dues-empty { text-align: center; padding: 48px 20px; font-family: 'DM Sans', sans-serif; }
  .em-dues-empty-icon  { font-size: 52px; margin-bottom: 12px; }
  .em-dues-empty-title { font-size: 18px; font-weight: 700; color: #374151; margin-bottom: 6px; }
  .em-dues-empty-sub   { font-size: 13px; color: #94a3b8; }

  @media (max-width: 480px) {
    .em-summary-value { font-size: 13px; }
    .em-page-title    { font-size: 19px; }
    .em-txn-amount    { font-size: 14px; }
    .em-form-row      { flex-direction: column; }
    .em-due-row       { flex-wrap: wrap; }
    .em-due-actions   { flex-direction: row; flex-wrap: wrap; width: 100%; }
    .em-due-pay-btn, .em-due-snooze-btn { flex: 1; }
  }
`

// ── Setup sub-components ──────────────────────────────────────────────────────

function TxnRow({ txn, categories, paymentSources, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cat       = categories.find(c => c.id === txn.category_id)
  const src       = paymentSources.find(s => s.id === txn.payment_source_id)
  const isExpense = txn.txn_type === 'expense'
  const isIncome  = txn.txn_type === 'income'

  return (
    <>
      <div className="em-txn-row" onClick={() => setExpanded(e => !e)}>
        <div className="em-txn-icon" style={{ background: cat ? cat.colour_hex + '22' : '#f0f4ff' }}>
          {cat ? cat.icon_code : '💸'}
        </div>
        <div className="em-txn-centre">
          <div className="em-txn-cat">{cat ? cat.category_name : 'Uncategorised'}</div>
          <div className="em-txn-meta">
            {fmtDate(txn.txn_date)}
            {txn.family_member && txn.family_member !== 'Self' ? ` · ${txn.family_member}` : ''}
          </div>
        </div>
        <div className="em-txn-right">
          <div className="em-txn-amount" style={{ color: isExpense ? '#dc2626' : isIncome ? '#16a34a' : '#2563eb' }}>
            {isExpense ? '−' : '+'} ₹{fmtAmt(txn.amount)}
          </div>
          {src && <div className="em-txn-src">{SOURCE_ICONS[src.source_type]} {src.source_name}</div>}
        </div>
      </div>
      {expanded && (
        <div className="em-txn-expand">
          {txn.notes && <div className="em-txn-note">"{txn.notes}"</div>}
          <button className="em-txn-del-btn" onClick={() => onDelete(txn.id)}>Delete</button>
        </div>
      )}
    </>
  )
}

function SetupSection({ icon, title, count, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="em-setup-section">
      <div className="em-setup-header" onClick={() => setOpen(o => !o)}>
        <div className="em-setup-header-left">
          <span className="em-setup-icon">{icon}</span>
          <div>
            <div className="em-setup-title">{title}</div>
            {count != null && <div className="em-setup-count">{count} items</div>}
          </div>
        </div>
        <span className={`em-setup-chevron${open ? ' open' : ''}`}>▼</span>
      </div>
      {open && <div className="em-setup-body">{children}</div>}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <label className="em-toggle-switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="em-toggle-slider" />
    </label>
  )
}

function FamilyMembersSection({ familyMembers }) {
  const [members,  setMembers]  = useState(() => familyMembers.filter(m => m !== 'Self').map((n, i) => ({ id: i, name: n, relationship: '' })))
  const [showForm, setShowForm] = useState(false)
  const [name,     setName]     = useState('')
  const [rel,      setRel]      = useState('Spouse')

  function handleAdd() {
    if (!name.trim()) return
    setMembers(prev => [...prev, { id: Date.now(), name: name.trim(), relationship: rel }])
    setName(''); setRel('Spouse'); setShowForm(false)
  }

  return (
    <SetupSection icon="👨‍👩‍👧" title="Family Members" count={members.length}>
      <div style={{ paddingTop: 12 }}>
        {members.length === 0 && <div style={{ fontSize:13, color:'#94a3b8', marginBottom:8, fontFamily:'DM Sans' }}>No family members added yet.</div>}
        {members.map(m => (
          <div key={m.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">👤</span>
            <div style={{ flex:1 }}>
              <div className="em-setup-item-name">{m.name}</div>
              {m.relationship && <div className="em-setup-item-sub">{m.relationship}</div>}
            </div>
            <button className="em-icon-btn danger" onClick={() => setMembers(p => p.filter(x => x.id !== m.id))}>✕</button>
          </div>
        ))}
        {showForm ? (
          <div className="em-add-form">
            <div><div className="em-field-label">Name</div><input className="em-field-input" placeholder="e.g. Priya" value={name} onChange={e => setName(e.target.value)} /></div>
            <div><div className="em-field-label">Relationship</div>
              <select className="em-field-select" value={rel} onChange={e => setRel(e.target.value)}>
                {['Spouse','Child','Parent','Sibling','Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleAdd} disabled={!name.trim()}>Add</button>
              <button className="em-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="em-add-trigger" onClick={() => setShowForm(true)}>+ Add Family Member</button>
        )}
      </div>
    </SetupSection>
  )
}

function PaymentSourcesSection({ paymentSources, transactions, onAdd, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState({ source_name:'', source_type:'cash', last_four:'', credit_limit:'', billing_cycle_date:'' })
  const [saving,   setSaving]   = useState(false)

  function resetForm() { setForm({ source_name:'', source_type:'cash', last_four:'', credit_limit:'', billing_cycle_date:'' }) }

  async function handleSave() {
    if (!form.source_name.trim()) return
    setSaving(true)
    try {
      const payload = { source_name:form.source_name.trim(), source_type:form.source_type, last_four:form.last_four||null, credit_limit:form.credit_limit?Number(form.credit_limit):null, billing_cycle_date:form.billing_cycle_date?Number(form.billing_cycle_date):null, display_order:paymentSources.length }
      if (editId) { await onUpdate(editId, payload); setEditId(null) } else { await onAdd(payload) }
      resetForm(); setShowForm(false)
    } catch (err) { console.error('PaymentSourcesSection save error:', err) }
    finally { setSaving(false) }
  }

  function startEdit(src) {
    setEditId(src.id)
    setForm({ source_name:src.source_name, source_type:src.source_type, last_four:src.last_four||'', credit_limit:src.credit_limit||'', billing_cycle_date:src.billing_cycle_date||'' })
    setShowForm(true)
  }

  const isCC = form.source_type === 'credit_card'

  return (
    <SetupSection icon="💳" title="Payment Sources" count={paymentSources.length}>
      <div style={{ paddingTop: 12 }}>
        {paymentSources.map(src => (
          <div key={src.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">{SOURCE_ICONS[src.source_type]||'💰'}</span>
            <div style={{ flex:1 }}>
              <div className="em-setup-item-name">{src.source_name}{src.last_four ? ` ···${src.last_four}` : ''}</div>
              <div className="em-setup-item-sub">{SOURCE_TYPE_LABELS[src.source_type]}{src.credit_limit ? ` · ₹${fmtAmt(src.credit_limit)} limit` : ''}</div>
            </div>
            <div className="em-setup-actions">
              <Toggle checked={src.is_active} onChange={v => onUpdate(src.id, { is_active:v })} />
              <button className="em-icon-btn" onClick={() => startEdit(src)}>✏</button>
            </div>
          </div>
        ))}
        {showForm ? (
          <div className="em-add-form">
            <div><div className="em-field-label">Name</div><input className="em-field-input" placeholder="e.g. HDFC Regalia" value={form.source_name} onChange={e => setForm(f => ({ ...f, source_name:e.target.value }))} /></div>
            <div><div className="em-field-label">Type</div>
              <select className="em-field-select" value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type:e.target.value }))}>
                {Object.entries(SOURCE_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {(form.source_type==='credit_card'||form.source_type==='bank_account') && (
              <div><div className="em-field-label">Last 4 digits (optional)</div><input className="em-field-input" placeholder="1234" maxLength={4} value={form.last_four} onChange={e => setForm(f => ({ ...f, last_four:e.target.value }))} /></div>
            )}
            {isCC && (
              <div className="em-form-row">
                <div><div className="em-field-label">Credit limit (₹)</div><input className="em-field-input" type="number" placeholder="150000" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit:e.target.value }))} /></div>
                <div><div className="em-field-label">Billing date</div><input className="em-field-input" type="number" min="1" max="31" placeholder="5" value={form.billing_cycle_date} onChange={e => setForm(f => ({ ...f, billing_cycle_date:e.target.value }))} /></div>
              </div>
            )}
            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleSave} disabled={!form.source_name.trim()||saving}>{saving?'Saving…':editId?'Update':'Add'}</button>
              <button className="em-cancel-btn" onClick={() => { setShowForm(false); setEditId(null); resetForm() }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="em-add-trigger" onClick={() => setShowForm(true)}>+ Add Payment Source</button>
        )}
      </div>
    </SetupSection>
  )
}

function CategoriesSection({ categories, onAdd, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState({ category_name:'', icon_code:'', colour_hex:'#1A3C6E', budget_limit_monthly:'' })
  const [saving,   setSaving]   = useState(false)

  function resetForm() { setForm({ category_name:'', icon_code:'', colour_hex:'#1A3C6E', budget_limit_monthly:'' }) }

  async function handleSave() {
    if (!form.category_name.trim()||!form.icon_code.trim()) return
    setSaving(true)
    try {
      const payload = { category_name:form.category_name.trim(), icon_code:form.icon_code.trim(), colour_hex:form.colour_hex, budget_limit_monthly:form.budget_limit_monthly?Number(form.budget_limit_monthly):null, display_order:categories.length }
      if (editId) { await onUpdate(editId, payload); setEditId(null) } else { await onAdd(payload) }
      resetForm(); setShowForm(false)
    } catch (err) { console.error('CategoriesSection save error:', err) }
    finally { setSaving(false) }
  }

  function startEdit(cat) {
    setEditId(cat.id)
    setForm({ category_name:cat.category_name, icon_code:cat.icon_code, colour_hex:cat.colour_hex, budget_limit_monthly:cat.budget_limit_monthly||'' })
    setShowForm(true)
  }

  return (
    <SetupSection icon="🏷️" title="Expense Categories" count={categories.length}>
      <div style={{ paddingTop: 12 }}>
        {categories.map(cat => (
          <div key={cat.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">{cat.icon_code}</span>
            <div className="em-colour-swatch" style={{ background:cat.colour_hex }} />
            <div style={{ flex:1 }}>
              <div className="em-setup-item-name">{cat.category_name}</div>
              {cat.budget_limit_monthly && <div className="em-setup-item-sub">Budget: ₹{fmtAmt(cat.budget_limit_monthly)}/mo</div>}
            </div>
            <div className="em-setup-actions">
              <Toggle checked={cat.is_active} onChange={v => onUpdate(cat.id, { is_active:v })} />
              <button className="em-icon-btn" onClick={() => startEdit(cat)}>✏</button>
            </div>
          </div>
        ))}
        {showForm ? (
          <div className="em-add-form">
            <div className="em-form-row">
              <div><div className="em-field-label">Category name</div><input className="em-field-input" placeholder="e.g. Groceries" value={form.category_name} onChange={e => setForm(f => ({ ...f, category_name:e.target.value }))} /></div>
              <div><div className="em-field-label">Icon (emoji)</div><input className="em-field-input" placeholder="🛒" value={form.icon_code} onChange={e => setForm(f => ({ ...f, icon_code:e.target.value }))} /></div>
            </div>
            <div className="em-form-row">
              <div><div className="em-field-label">Colour</div><input type="color" value={form.colour_hex} onChange={e => setForm(f => ({ ...f, colour_hex:e.target.value }))} style={{ width:'100%', height:40, border:'none', borderRadius:10, cursor:'pointer', padding:2 }} /></div>
              <div><div className="em-field-label">Monthly budget (₹)</div><input className="em-field-input" type="number" placeholder="Optional" value={form.budget_limit_monthly} onChange={e => setForm(f => ({ ...f, budget_limit_monthly:e.target.value }))} /></div>
            </div>
            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleSave} disabled={!form.category_name.trim()||!form.icon_code.trim()||saving}>{saving?'Saving…':editId?'Update':'Add'}</button>
              <button className="em-cancel-btn" onClick={() => { setShowForm(false); setEditId(null); resetForm() }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="em-add-trigger" onClick={() => setShowForm(true)}>+ Add Category</button>
        )}
      </div>
    </SetupSection>
  )
}

// ── RecurringSection — FIX A applied ─────────────────────────────────────────
// due_date_next is now computed on save AND shown as an editable "First due date" field.

function RecurringSection({ recurringItems, categories, paymentSources, onAdd, onUpdate, onDelete }) {
  const defaultDueDate = computeInitialDueDate('monthly', '')
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({
    item_name:'', recurring_type:'subscription', amount:'', frequency:'monthly',
    due_day:'', payment_source_id:'', category_id:'',
    reminder_days_before:2, reminder_enabled:true, auto_log:false, notes:'',
    due_date_next: defaultDueDate,   // FIX A: always pre-computed
  })
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setForm({
      item_name:'', recurring_type:'subscription', amount:'', frequency:'monthly',
      due_day:'', payment_source_id:'', category_id:'',
      reminder_days_before:2, reminder_enabled:true, auto_log:false, notes:'',
      due_date_next: computeInitialDueDate('monthly', ''),
    })
  }

  // Recompute due_date_next when frequency or due_day changes (unless user has already overridden)
  function handleFrequencyChange(freq) {
    const newDue = computeInitialDueDate(freq, form.due_day)
    setForm(f => ({ ...f, frequency: freq, due_date_next: newDue }))
  }

  function handleDueDayChange(day) {
    const newDue = computeInitialDueDate(form.frequency, day)
    setForm(f => ({ ...f, due_day: day, due_date_next: newDue }))
  }

  async function handleSave() {
    if (!form.item_name.trim() || !form.amount) return
    setSaving(true)
    try {
      // FIX A: always include a computed due_date_next — never null
      const due_date_next = form.due_date_next || computeInitialDueDate(form.frequency, form.due_day)
      const payload = {
        item_name:            form.item_name.trim(),
        recurring_type:       form.recurring_type,
        amount:               Number(form.amount),
        frequency:            form.frequency,
        due_day:              (form.frequency === 'monthly' && form.due_day) ? Number(form.due_day) : null,
        due_date_next,
        payment_source_id:    form.payment_source_id || null,
        category_id:          form.category_id || null,
        reminder_days_before: Number(form.reminder_days_before),
        reminder_enabled:     form.reminder_enabled,
        auto_log:             form.auto_log,
        notes:                form.notes || null,
      }
      await onAdd(payload)
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error('RecurringSection save error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SetupSection icon="🔄" title="Recurring Items" count={recurringItems.length}>
      <div style={{ paddingTop: 12 }}>
        {recurringItems.map(r => {
          const cat = categories.find(c => c.id === r.category_id)
          return (
            <div key={r.id} className="em-setup-list-item">
              <span className="em-setup-item-icon">{cat ? cat.icon_code : '🔄'}</span>
              <div style={{ flex:1 }}>
                <div className="em-setup-item-name">{r.item_name}</div>
                <div className="em-setup-item-sub">
                  ₹{fmtAmt(r.amount)} · {r.frequency}
                  {r.due_date_next ? ` · next: ${fmtDate(r.due_date_next)}` : ' · no date set'}
                </div>
              </div>
              <div className="em-setup-actions">
                <Toggle checked={r.reminder_enabled} onChange={v => onUpdate(r.id, { reminder_enabled:v })} />
                <button className="em-icon-btn danger" onClick={() => onDelete(r.id)}>✕</button>
              </div>
            </div>
          )
        })}

        {showForm ? (
          <div className="em-add-form">
            <div className="em-form-row">
              <div>
                <div className="em-field-label">Name</div>
                <input className="em-field-input" placeholder="e.g. Netflix" value={form.item_name}
                  onChange={e => setForm(f => ({ ...f, item_name:e.target.value }))} />
              </div>
              <div>
                <div className="em-field-label">Type</div>
                <select className="em-field-select" value={form.recurring_type}
                  onChange={e => setForm(f => ({ ...f, recurring_type:e.target.value }))}>
                  <option value="subscription">Subscription</option>
                  <option value="due">Due / Bill</option>
                </select>
              </div>
            </div>

            <div className="em-form-row">
              <div>
                <div className="em-field-label">Amount (₹)</div>
                <input className="em-field-input" type="number" placeholder="999" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount:e.target.value }))} />
              </div>
              <div>
                <div className="em-field-label">Frequency</div>
                <select className="em-field-select" value={form.frequency}
                  onChange={e => handleFrequencyChange(e.target.value)}>
                  {['daily','weekly','monthly','yearly'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {form.frequency === 'monthly' && (
              <div>
                <div className="em-field-label">Due day of month</div>
                <input className="em-field-input" type="number" min="1" max="31" placeholder="e.g. 5 for the 5th"
                  value={form.due_day} onChange={e => handleDueDayChange(e.target.value)} />
              </div>
            )}

            {/* FIX A: First due date — visible, editable, auto-computed */}
            <div>
              <div className="em-field-label">First due date</div>
              <input
                type="date"
                className="em-field-input"
                value={form.due_date_next}
                onChange={e => setForm(f => ({ ...f, due_date_next: e.target.value }))}
              />
              <div className="em-field-hint">Auto-calculated — you can adjust it</div>
            </div>

            <div>
              <div className="em-field-label">Payment source</div>
              <select className="em-field-select" value={form.payment_source_id}
                onChange={e => setForm(f => ({ ...f, payment_source_id:e.target.value }))}>
                <option value="">— Select —</option>
                {paymentSources.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{SOURCE_ICONS[s.source_type]} {s.source_name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="em-field-label">Category</div>
              <select className="em-field-select" value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id:e.target.value }))}>
                <option value="">— Select —</option>
                {categories.filter(c => c.is_active).map(c => (
                  <option key={c.id} value={c.id}>{c.icon_code} {c.category_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontFamily:'DM Sans', color:'#374151', cursor:'pointer' }}>
                <Toggle checked={form.reminder_enabled} onChange={v => setForm(f => ({ ...f, reminder_enabled:v }))} /> Remind me
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontFamily:'DM Sans', color:'#374151', cursor:'pointer' }}>
                <Toggle checked={form.auto_log} onChange={v => setForm(f => ({ ...f, auto_log:v }))} /> Auto-log
              </label>
            </div>

            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleSave}
                disabled={!form.item_name.trim() || !form.amount || !form.due_date_next || saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
              <button className="em-cancel-btn" onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="em-add-trigger" onClick={() => setShowForm(true)}>+ Add Recurring Item</button>
        )}
      </div>
    </SetupSection>
  )
}

// ── DueRow component ──────────────────────────────────────────────────────────

function DueRow({ r, categories, onMarkPaid, onSnooze, processing }) {
  const cat   = categories.find(c => c.id === r.category_id)
  const days  = daysUntil(r.due_date_next)
  const cls   = days < 0 ? 'overdue' : days <= 3 ? 'urgent' : 'ok'
  const badge = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`
  const busy  = processing === r.id

  return (
    <div className={`em-due-row ${cls}`}>
      <div className="em-due-icon">{cat ? cat.icon_code : '🔄'}</div>
      <div className="em-due-info">
        <div className="em-due-name">{r.item_name}</div>
        <div className="em-due-meta">
          {fmtDate(r.due_date_next)} · {r.frequency}
        </div>
        <span className={`em-due-badge ${cls}`}>{badge}</span>
      </div>
      <div className="em-due-amt">₹{fmtAmt(r.amount)}</div>
      <div className="em-due-actions">
        <button className="em-due-pay-btn" disabled={!!processing} onClick={() => onMarkPaid(r)}>
          {busy ? '…' : 'Mark Paid'}
        </button>
        <button className="em-due-snooze-btn" disabled={!!processing} onClick={() => onSnooze(r)}>
          Snooze 3d
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExpenseManager() {
  const {
    transactions, categories, paymentSources, recurringItems, familyMembers,
    loading, error, reload,
    addTransaction, deleteTransaction,
    addCategory, updateCategory,
    addPaymentSource, updatePaymentSource,
    addRecurringItem, updateRecurringItem, deleteRecurringItem,
  } = useExpense()

  const [tab,            setTab]            = useState('log')
  const [filterMode,     setFilterMode]     = useState('this')
  const [customStart,    setCustomStart]    = useState('')
  const [customEnd,      setCustomEnd]      = useState(todayStr())
  const [panelOpen,      setPanelOpen]      = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [dueProcessing,  setDueProcessing]  = useState(null)
  const [toast,          setToast]          = useState(null)

  useWindowWidth()

  // Date range for Log filter
  const dateRange = useMemo(() => {
    if (filterMode === 'this') return { start: monthPrefix(0) + '-01', end: todayStr() }
    if (filterMode === 'last') {
      const p  = monthPrefix(-1)
      const d  = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
      const ld = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()
      return { start: p + '-01', end: `${p}-${String(ld).padStart(2,'0')}` }
    }
    return { start: customStart, end: customEnd }
  }, [filterMode, customStart, customEnd])

  const filtered = useMemo(() => {
    if (!dateRange.start) return transactions
    return transactions.filter(t => t.txn_date >= dateRange.start && t.txn_date <= dateRange.end)
  }, [transactions, dateRange])

  const summary = useMemo(() => {
    let income = 0, expense = 0
    filtered.forEach(t => {
      if (t.txn_type === 'expense') expense += Number(t.amount)
      else if (t.txn_type === 'income') income += Number(t.amount)
    })
    return { income, expense, net: income - expense }
  }, [filtered])

  // Budget alerts — always current month
  const curMonthPrefix = monthPrefix(0)
  const budgetAlerts = useMemo(() => {
    return categories.filter(c => {
      if (!c.is_active || !c.budget_limit_monthly) return false
      const spent = transactions
        .filter(t => t.category_id === c.id && t.txn_type === 'expense' && t.txn_date?.startsWith(curMonthPrefix))
        .reduce((s, t) => s + Number(t.amount), 0)
      return spent >= c.budget_limit_monthly * 0.75
    }).map(c => {
      const spent = transactions
        .filter(t => t.category_id === c.id && t.txn_type === 'expense' && t.txn_date?.startsWith(curMonthPrefix))
        .reduce((s, t) => s + Number(t.amount), 0)
      return { ...c, spent, pct: spent / c.budget_limit_monthly }
    })
  }, [categories, transactions, curMonthPrefix])

  const overBudget = budgetAlerts.filter(a => a.pct >= 1)
  const alertLevel = overBudget.length > 0 ? 'red' : budgetAlerts.length > 0 ? 'amber' : null

  // ── FIX B: Dues — local-time date comparisons, defensive is_active check ──
  const todayD  = new Date(); todayD.setHours(0,0,0,0)
  const in30D   = new Date(todayD); in30D.setDate(in30D.getDate() + 30)
  const todayISO = dateToDStr(todayD)   // local date string, never UTC

  const allDues = recurringItems.filter(r => {
    if (!r.due_date_next) return false          // skip items with no due date
    if (r.is_active === false) return false     // only exclude explicit false; undefined/null → treat as active
    const dueD = new Date(r.due_date_next + 'T00:00:00')  // local time parse
    return dueD <= in30D
  }).sort((a, b) => (a.due_date_next || '').localeCompare(b.due_date_next || ''))

  // FIX D: diagnostic log when items exist but nothing passes the filter
  if (recurringItems.length > 0 && allDues.length === 0) {
    console.log('Dues debug — items exist but none pass filter:', recurringItems.map(i => ({
      name: i.item_name,
      due_date_next: i.due_date_next,
      is_active: i.is_active,
      frequency: i.frequency,
    })))
  }

  const overdueDues  = allDues.filter(r => new Date(r.due_date_next + 'T00:00:00') < todayD)
  const upcomingDues = allDues.filter(r => new Date(r.due_date_next + 'T00:00:00') >= todayD)
  const thisWeekDues = upcomingDues.filter(r => daysUntil(r.due_date_next) <= 7)
  const nextWeekDues = upcomingDues.filter(r => daysUntil(r.due_date_next) > 7 && daysUntil(r.due_date_next) <= 14)
  const laterDues    = upcomingDues.filter(r => daysUntil(r.due_date_next) > 14)
  const totalDueBadge = allDues.length

  // ── Dues handlers ──────────────────────────────────────────────────────────

  async function handleMarkPaid(r) {
    setDueProcessing(r.id)
    try {
      await addTransaction({
        txn_type:          'expense',
        amount:            r.amount,
        category_id:       r.category_id       || null,
        payment_source_id: r.payment_source_id || null,
        family_member:     'Self',
        txn_date:          todayISO,
        notes:             `Paid: ${r.item_name}`,
        recurring_id:      r.id,
      })
      const nextDate = computeNextDue(r)
      if (nextDate) await updateRecurringItem(r.id, { due_date_next: nextDate })
      setToast({ message: `✓ ${r.item_name} marked as paid`, type: 'success' })
    } catch (err) {
      console.error('handleMarkPaid error:', err)
      setToast({ message: 'Failed to mark as paid. Check connection.', type: 'error' })
    } finally {
      setDueProcessing(null)
    }
  }

  async function handleSnooze(r) {
    setDueProcessing(r.id)
    try {
      const d = new Date((r.due_date_next || todayISO) + 'T00:00:00')
      d.setDate(d.getDate() + 3)
      await updateRecurringItem(r.id, { due_date_next: dateToDStr(d) })
      setToast({ message: `Snoozed 3 days — ${r.item_name}`, type: 'success' })
    } catch (err) {
      console.error('handleSnooze error:', err)
      setToast({ message: 'Failed to snooze. Check connection.', type: 'error' })
    } finally {
      setDueProcessing(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', fontFamily:'DM Sans', fontSize:14, color:'#94a3b8' }}>
        Loading Expense Manager…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding:32, fontFamily:'DM Sans', color:'#dc2626', fontSize:14 }}>
        Error: {error} — <button onClick={reload} style={{ color:'#1A3C6E', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Retry</button>
      </div>
    )
  }

  return (
    <>
      <style>{emCSS}</style>

      {toast && (
        <Toast key={toast.message + Date.now()} message={toast.message} type={toast.type} duration={2500} onDismiss={() => setToast(null)} />
      )}

      <div className="em-wrap">

        {/* Page header */}
        <div className="em-page-header">
          <span style={{ fontSize:26 }}>💸</span>
          <div className="em-page-title">Expense Manager</div>
          <button className="em-log-btn" onClick={() => setPanelOpen(true)}>+ Log</button>
        </div>

        {/* Tabs */}
        <div className="em-tabs">
          {[['log','Log'],['setup','Setup'],['analytics','Analytics'],['dues','Dues']].map(([id, label]) => (
            <button key={id} className={`em-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}
              {id === 'dues' && totalDueBadge > 0 && <span className="em-tab-badge">{totalDueBadge}</span>}
              {id === 'log' && alertLevel && <span className="em-tab-badge">{budgetAlerts.length}</span>}
            </button>
          ))}
        </div>

        {/* ─── LOG TAB ──────────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <>
            <div className="em-filter-bar">
              <button className={`em-filter-chip${filterMode==='this'?' active':''}`} onClick={() => setFilterMode('this')}>{monthLabel(0)}</button>
              <button className={`em-filter-chip${filterMode==='last'?' active':''}`} onClick={() => setFilterMode('last')}>{monthLabel(-1)}</button>
              <button className={`em-filter-chip${filterMode==='custom'?' active':''}`} onClick={() => setFilterMode('custom')}>Custom</button>
            </div>

            {filterMode === 'custom' && (
              <div style={{ display:'flex', gap:10, padding:'0 16px 12px', alignItems:'center' }}>
                <input type="date" className="em-field-input" style={{ flex:1 }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span style={{ color:'#94a3b8', fontSize:13, fontFamily:'DM Sans' }}>to</span>
                <input type="date" className="em-field-input" style={{ flex:1 }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}

            {alertLevel && !alertDismissed && (
              <div className={`em-budget-banner ${alertLevel}`}>
                <span style={{ fontSize:16, flexShrink:0 }}>⚠</span>
                <span className="em-budget-banner-text">
                  {alertLevel === 'red'
                    ? `Budget exceeded — ${overBudget.map(c => c.category_name).join(', ')} ${overBudget.length===1?'is':'are'} over limit`
                    : `Budget alert — ${budgetAlerts.length} ${budgetAlerts.length===1?'category':'categories'} near limit this month`
                  }
                </span>
                <button className="em-budget-view-btn" onClick={() => setTab('analytics')}>View →</button>
                <button className="em-budget-dismiss-btn" onClick={() => setAlertDismissed(true)}>✕</button>
              </div>
            )}

            <div className="em-summary-bar">
              <div className="em-summary-item">
                <div className="em-summary-value" style={{ color:'#16a34a' }}>₹{fmtAmt(summary.income)}</div>
                <div className="em-summary-label">Income</div>
              </div>
              <div className="em-summary-item">
                <div className="em-summary-value" style={{ color:'#dc2626' }}>₹{fmtAmt(summary.expense)}</div>
                <div className="em-summary-label">Expense</div>
              </div>
              <div className="em-summary-item">
                <div className="em-summary-value" style={{ color: summary.net>=0?'#16a34a':'#dc2626' }}>₹{fmtAmt(Math.abs(summary.net))}</div>
                <div className="em-summary-label">Net</div>
              </div>
            </div>

            <div className="em-txn-list">
              {filtered.length === 0 ? (
                <div className="em-empty">No transactions in this period.<br />Tap + Log to add one.</div>
              ) : (
                filtered.map(txn => (
                  <TxnRow key={txn.id} txn={txn} categories={categories} paymentSources={paymentSources} onDelete={deleteTransaction} />
                ))
              )}
            </div>
          </>
        )}

        {/* ─── SETUP TAB ────────────────────────────────────────────────────── */}
        {tab === 'setup' && (
          <div style={{ paddingTop:8 }}>
            <FamilyMembersSection familyMembers={familyMembers} />
            <PaymentSourcesSection paymentSources={paymentSources} transactions={transactions} onAdd={addPaymentSource} onUpdate={updatePaymentSource} />
            <CategoriesSection categories={categories} onAdd={addCategory} onUpdate={updateCategory} />
            <RecurringSection recurringItems={recurringItems} categories={categories} paymentSources={paymentSources} onAdd={addRecurringItem} onUpdate={updateRecurringItem} onDelete={deleteRecurringItem} />
          </div>
        )}

        {/* ─── ANALYTICS TAB ────────────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <ExpenseAnalytics
            transactions={transactions}
            categories={categories}
            paymentSources={paymentSources}
            recurringItems={recurringItems}
            addTransaction={addTransaction}
          />
        )}

        {/* ─── DUES TAB ─────────────────────────────────────────────────────── */}
        {tab === 'dues' && (
          <div className="em-dues-wrap">

            {allDues.length === 0 ? (
              <div className="em-dues-empty">
                <div className="em-dues-empty-icon">🎉</div>
                <div className="em-dues-empty-title">All clear!</div>
                <div className="em-dues-empty-sub">No payments due in the next 30 days.</div>
              </div>
            ) : (
              <>
                {overdueDues.length > 0 && (
                  <>
                    <div className="em-dues-section-hdr overdue-hdr">⚠ Overdue</div>
                    {overdueDues.map(r => (
                      <DueRow key={r.id} r={r} categories={categories} onMarkPaid={handleMarkPaid} onSnooze={handleSnooze} processing={dueProcessing} />
                    ))}
                  </>
                )}

                {upcomingDues.length > 0 && (
                  <>
                    <div className="em-dues-section-hdr" style={{ marginTop: overdueDues.length > 0 ? 20 : 0 }}>
                      Upcoming — Next 30 Days
                    </div>

                    {thisWeekDues.length > 0 && (
                      <>
                        <div className="em-due-week-label">This Week</div>
                        {thisWeekDues.map(r => (
                          <DueRow key={r.id} r={r} categories={categories} onMarkPaid={handleMarkPaid} onSnooze={handleSnooze} processing={dueProcessing} />
                        ))}
                      </>
                    )}

                    {nextWeekDues.length > 0 && (
                      <>
                        <div className="em-due-week-label">Next Week</div>
                        {nextWeekDues.map(r => (
                          <DueRow key={r.id} r={r} categories={categories} onMarkPaid={handleMarkPaid} onSnooze={handleSnooze} processing={dueProcessing} />
                        ))}
                      </>
                    )}

                    {laterDues.length > 0 && (
                      <>
                        <div className="em-due-week-label">Later</div>
                        {laterDues.map(r => (
                          <DueRow key={r.id} r={r} categories={categories} onMarkPaid={handleMarkPaid} onSnooze={handleSnooze} processing={dueProcessing} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

      </div>

      <ExpenseEntryPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
