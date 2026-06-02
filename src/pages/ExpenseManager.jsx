import { useState, useMemo } from 'react'
import { useExpense } from '../context/ExpenseContext'
import ExpenseEntryPanel from '../components/expenses/ExpenseEntryPanel'
import useWindowWidth from '../hooks/useWindowWidth'

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
  .em-page-title {
    font-size: 22px; font-weight: 700; color: #1a1a2a; flex: 1;
  }
  .em-log-btn {
    padding: 8px 18px; border: none; border-radius: 10px;
    background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .em-log-btn:hover { background: #15306b; }

  /* ── TABS ── */
  .em-tabs {
    display: flex; border-bottom: 2px solid #e8ecf0;
    padding: 0 16px; margin-top: 16px; gap: 0;
    position: sticky; top: 56px; z-index: 100;
    background: #ffffff;
    box-shadow: 0 1px 0 #e8ecf0;
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

  /* ── FILTER BAR ── */
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
  .em-filter-chip.active {
    background: #1A3C6E; color: #ffffff;
    border-color: #1A3C6E; font-weight: 600;
  }

  /* ── BUDGET ALERT BANNER ── */
  .em-budget-banner {
    margin: 0 16px 12px;
    padding: 10px 14px; border-radius: 8px;
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; line-height: 1.4;
  }
  .em-budget-banner.amber {
    background: #fffbeb; border: 1px solid #f59e0b;
    color: #92400e;
  }
  .em-budget-banner.red {
    background: #fef2f2; border: 1px solid #dc2626;
    color: #991b1b;
  }
  .em-budget-banner-icon { font-size: 16px; flex-shrink: 0; }
  .em-budget-banner-text { flex: 1; }
  .em-budget-view-btn {
    border: none; background: transparent; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
    color: inherit; text-decoration: underline; white-space: nowrap;
    padding: 0; flex-shrink: 0;
  }
  .em-budget-dismiss-btn {
    border: none; background: transparent; cursor: pointer;
    font-size: 14px; color: inherit; opacity: 0.6;
    padding: 2px 4px; flex-shrink: 0; line-height: 1;
  }
  .em-budget-dismiss-btn:hover { opacity: 1; }

  /* ── SUMMARY BAR ── */
  .em-summary-bar {
    display: flex; margin: 0 16px 12px;
    background: #ffffff; border-radius: 12px; overflow: hidden;
    border: 1px solid #e8ecf0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .em-summary-item {
    flex: 1; padding: 12px 8px; text-align: center;
    border-right: 1px solid #f1f5f9;
  }
  .em-summary-item:last-child { border-right: none; }
  .em-summary-value { font-size: 15px; font-weight: 700; }
  .em-summary-label {
    font-size: 10px; color: #94a3b8; margin-top: 2px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }

  /* ── TRANSACTION LIST ── */
  .em-txn-list { padding: 0 16px; }
  .em-txn-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 0; border-bottom: 1px solid #f1f5f9;
    cursor: pointer; background: transparent; transition: background 0.1s;
  }
  .em-txn-row:hover { background: #fafbfc; margin: 0 -4px; padding: 12px 4px; border-radius: 8px; }
  .em-txn-row:last-child { border-bottom: none; }
  .em-txn-icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0; background: #f0f4ff;
  }
  .em-txn-centre { flex: 1; min-width: 0; }
  .em-txn-cat   { font-size: 14px; font-weight: 600; color: #1a1a2a; }
  .em-txn-meta  { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .em-txn-right { text-align: right; flex-shrink: 0; }
  .em-txn-amount{ font-size: 15px; font-weight: 700; }
  .em-txn-src   { font-size: 11px; color: #94a3b8; margin-top: 2px; }

  .em-txn-expand {
    padding: 10px 16px 14px 50px;
    background: #f8f9fa; border-radius: 0 0 10px 10px;
    border-bottom: 1px solid #f1f5f9;
  }
  .em-txn-note { font-size: 12px; color: #64748b; margin-bottom: 10px; font-style: italic; }
  .em-txn-del-btn {
    padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; border: none;
    background: #fef2f2; color: #dc2626; font-family: 'DM Sans', sans-serif;
  }
  .em-txn-del-btn:hover { background: #fee2e2; }

  .em-empty {
    text-align: center; padding: 48px 20px;
    color: #94a3b8; font-size: 14px; line-height: 1.6;
  }

  /* ── SETUP TAB ── */
  .em-setup-section {
    margin: 10px 16px;
    background: #ffffff; border: 1px solid #e8ecf0;
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .em-setup-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; cursor: pointer; user-select: none;
    transition: background 0.1s;
  }
  .em-setup-header:hover { background: #fafbfc; }
  .em-setup-header-left { display: flex; align-items: center; gap: 10px; }
  .em-setup-icon  { font-size: 20px; }
  .em-setup-title { font-size: 15px; font-weight: 600; color: #374151; }
  .em-setup-count {
    font-size: 11px; font-weight: 600; color: #1A3C6E;
    background: #f0f4ff; padding: 2px 8px; border-radius: 10px; margin-top: 2px;
    display: inline-block;
  }
  .em-setup-chevron { font-size: 12px; color: #94a3b8; transition: transform 0.2s; }
  .em-setup-chevron.open { transform: rotate(180deg); }
  .em-setup-body { padding: 4px 16px 16px; border-top: 1px solid #f1f5f9; }

  .em-setup-list-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid #f8f9fa;
  }
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
  .em-field-label {
    font-size: 11px; font-weight: 600; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
    font-family: 'DM Sans', sans-serif;
  }
  .em-field-input {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; transition: border-color 0.15s; background: #ffffff;
    color: #1a1a2a;
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
    padding: 10px; border: none; border-radius: 10px;
    background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .em-add-btn:hover:not(:disabled) { background: #15306b; }
  .em-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .em-cancel-btn {
    padding: 10px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    background: #ffffff; color: #374151;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: border-color 0.15s;
  }
  .em-cancel-btn:hover { border-color: #94a3b8; }

  .em-add-trigger {
    margin-top: 12px; width: 100%; padding: 10px;
    border: 1.5px dashed #cbd5e1; border-radius: 10px; background: transparent;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: #1A3C6E; font-weight: 600; cursor: pointer; transition: border-color 0.15s;
  }
  .em-add-trigger:hover { border-color: #1A3C6E; background: #f0f4ff; }

  .em-colour-swatch {
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid rgba(0,0,0,0.08);
  }

  /* Toggle switch */
  .em-toggle-switch { position: relative; width: 36px; height: 20px; flex-shrink: 0; }
  .em-toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .em-toggle-slider {
    position: absolute; cursor: pointer; inset: 0;
    background: #e2e8f0; border-radius: 20px; transition: background 0.2s;
  }
  .em-toggle-slider::before {
    content: ''; position: absolute;
    width: 14px; height: 14px; left: 3px; bottom: 3px;
    background: #fff; border-radius: 50%; transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  input:checked + .em-toggle-slider { background: #1A3C6E; }
  input:checked + .em-toggle-slider::before { transform: translateX(16px); }

  /* ── ANALYTICS STUB ── */
  .em-stub {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 20px; gap: 12px;
  }
  .em-stub-icon  { font-size: 52px; opacity: 0.35; }
  .em-stub-title { font-size: 17px; font-weight: 700; color: #374151; }
  .em-stub-sub   { font-size: 13px; text-align: center; color: #94a3b8; line-height: 1.6; max-width: 280px; }

  /* ── DUES TAB ── */
  .em-dues-list { padding: 12px 16px; }
  .em-due-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px; margin-bottom: 10px;
    border: 1.5px solid #e8ecf0; border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .em-due-row.overdue { border-color: #fca5a5; background: #fff5f5; }
  .em-due-row.urgent  { border-color: #fcd34d; background: #fffdf0; }
  .em-due-row.ok      { border-color: #86efac; background: #f0fdf4; }
  .em-due-left  { flex: 1; min-width: 0; }
  .em-due-name  { font-size: 14px; font-weight: 600; color: #1a1a2a; }
  .em-due-meta  { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .em-due-right { text-align: right; flex-shrink: 0; }
  .em-due-amt   { font-size: 15px; font-weight: 700; color: #1a1a2a; }
  .em-due-badge {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
    margin-top: 4px; display: inline-block;
  }
  .em-due-badge.overdue { background: #fee2e2; color: #991b1b; }
  .em-due-badge.urgent  { background: #fef3c7; color: #92400e; }
  .em-due-badge.ok      { background: #dcfce7; color: #166534; }
  .em-mark-paid-btn {
    padding: 7px 13px; border: none; border-radius: 8px;
    background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: background 0.12s; flex-shrink: 0;
  }
  .em-mark-paid-btn:hover:not(:disabled) { background: #15306b; }
  .em-mark-paid-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 480px) {
    .em-summary-value { font-size: 13px; }
    .em-page-title    { font-size: 19px; }
    .em-txn-amount    { font-size: 14px; }
    .em-form-row      { flex-direction: column; }
    .em-due-row       { flex-wrap: wrap; gap: 8px; }
    .em-mark-paid-btn { width: 100%; }
  }
`

// ── Sub-components ────────────────────────────────────────────────────────────

function TxnRow({ txn, categories, paymentSources, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cat       = categories.find(c => c.id === txn.category_id)
  const src       = paymentSources.find(s => s.id === txn.payment_source_id)
  const isExpense = txn.txn_type === 'expense'
  const isIncome  = txn.txn_type === 'income'

  return (
    <>
      <div className="em-txn-row" onClick={() => setExpanded(e => !e)}>
        <div
          className="em-txn-icon"
          style={{ background: cat ? cat.colour_hex + '22' : '#f0f4ff' }}
        >
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

// ── Section A: Family Members ─────────────────────────────────────────────────

function FamilyMembersSection({ familyMembers }) {
  const [members,  setMembers]  = useState(() =>
    familyMembers.filter(m => m !== 'Self').map((n, i) => ({ id: i, name: n, relationship: '' }))
  )
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
        {members.length === 0 && (
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8, fontFamily: 'DM Sans' }}>
            No family members added yet.
          </div>
        )}
        {members.map(m => (
          <div key={m.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">👤</span>
            <div style={{ flex: 1 }}>
              <div className="em-setup-item-name">{m.name}</div>
              {m.relationship && <div className="em-setup-item-sub">{m.relationship}</div>}
            </div>
            <button className="em-icon-btn danger" onClick={() => setMembers(p => p.filter(x => x.id !== m.id))}>✕</button>
          </div>
        ))}
        {showForm ? (
          <div className="em-add-form">
            <div>
              <div className="em-field-label">Name</div>
              <input className="em-field-input" placeholder="e.g. Priya" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <div className="em-field-label">Relationship</div>
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

// ── Section B: Payment Sources ────────────────────────────────────────────────

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
      const payload = {
        source_name:        form.source_name.trim(),
        source_type:        form.source_type,
        last_four:          form.last_four || null,
        credit_limit:       form.credit_limit ? Number(form.credit_limit) : null,
        billing_cycle_date: form.billing_cycle_date ? Number(form.billing_cycle_date) : null,
        display_order:      paymentSources.length,
      }
      if (editId) { await onUpdate(editId, payload); setEditId(null) }
      else        { await onAdd(payload) }
      resetForm(); setShowForm(false)
    } catch (err) {
      console.error('PaymentSourcesSection save error:', err)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(src) {
    setEditId(src.id)
    setForm({ source_name:src.source_name, source_type:src.source_type,
      last_four:src.last_four||'', credit_limit:src.credit_limit||'', billing_cycle_date:src.billing_cycle_date||'' })
    setShowForm(true)
  }

  const isCC = form.source_type === 'credit_card'

  return (
    <SetupSection icon="💳" title="Payment Sources" count={paymentSources.length}>
      <div style={{ paddingTop: 12 }}>
        {paymentSources.map(src => (
          <div key={src.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">{SOURCE_ICONS[src.source_type]||'💰'}</span>
            <div style={{ flex: 1 }}>
              <div className="em-setup-item-name">{src.source_name}{src.last_four ? ` ···${src.last_four}` : ''}</div>
              <div className="em-setup-item-sub">{SOURCE_TYPE_LABELS[src.source_type]}{src.credit_limit ? ` · ₹${fmtAmt(src.credit_limit)} limit` : ''}</div>
            </div>
            <div className="em-setup-actions">
              <Toggle checked={src.is_active} onChange={v => onUpdate(src.id, { is_active: v })} />
              <button className="em-icon-btn" onClick={() => startEdit(src)}>✏</button>
            </div>
          </div>
        ))}
        {showForm ? (
          <div className="em-add-form">
            <div>
              <div className="em-field-label">Name</div>
              <input className="em-field-input" placeholder="e.g. HDFC Regalia" value={form.source_name}
                onChange={e => setForm(f => ({ ...f, source_name: e.target.value }))} />
            </div>
            <div>
              <div className="em-field-label">Type</div>
              <select className="em-field-select" value={form.source_type}
                onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}>
                {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {(form.source_type === 'credit_card' || form.source_type === 'bank_account') && (
              <div>
                <div className="em-field-label">Last 4 digits (optional)</div>
                <input className="em-field-input" placeholder="1234" maxLength={4} value={form.last_four}
                  onChange={e => setForm(f => ({ ...f, last_four: e.target.value }))} />
              </div>
            )}
            {isCC && (
              <div className="em-form-row">
                <div>
                  <div className="em-field-label">Credit limit (₹)</div>
                  <input className="em-field-input" type="number" placeholder="150000" value={form.credit_limit}
                    onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} />
                </div>
                <div>
                  <div className="em-field-label">Billing date</div>
                  <input className="em-field-input" type="number" min="1" max="31" placeholder="5" value={form.billing_cycle_date}
                    onChange={e => setForm(f => ({ ...f, billing_cycle_date: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleSave} disabled={!form.source_name.trim() || saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Add'}
              </button>
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

// ── Section C: Expense Categories ─────────────────────────────────────────────

function CategoriesSection({ categories, onAdd, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form,     setForm]     = useState({ category_name:'', icon_code:'', colour_hex:'#1A3C6E', budget_limit_monthly:'' })
  const [saving,   setSaving]   = useState(false)

  function resetForm() { setForm({ category_name:'', icon_code:'', colour_hex:'#1A3C6E', budget_limit_monthly:'' }) }

  async function handleSave() {
    if (!form.category_name.trim() || !form.icon_code.trim()) return
    setSaving(true)
    try {
      const payload = {
        category_name:        form.category_name.trim(),
        icon_code:            form.icon_code.trim(),
        colour_hex:           form.colour_hex,
        budget_limit_monthly: form.budget_limit_monthly ? Number(form.budget_limit_monthly) : null,
        display_order:        categories.length,
      }
      if (editId) { await onUpdate(editId, payload); setEditId(null) }
      else        { await onAdd(payload) }
      resetForm(); setShowForm(false)
    } catch (err) {
      console.error('CategoriesSection save error:', err)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(cat) {
    setEditId(cat.id)
    setForm({ category_name:cat.category_name, icon_code:cat.icon_code,
      colour_hex:cat.colour_hex, budget_limit_monthly:cat.budget_limit_monthly||'' })
    setShowForm(true)
  }

  return (
    <SetupSection icon="🏷️" title="Expense Categories" count={categories.length}>
      <div style={{ paddingTop: 12 }}>
        {categories.map(cat => (
          <div key={cat.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">{cat.icon_code}</span>
            <div className="em-colour-swatch" style={{ background: cat.colour_hex }} />
            <div style={{ flex: 1 }}>
              <div className="em-setup-item-name">{cat.category_name}</div>
              {cat.budget_limit_monthly && (
                <div className="em-setup-item-sub">Budget: ₹{fmtAmt(cat.budget_limit_monthly)}/mo</div>
              )}
            </div>
            <div className="em-setup-actions">
              <Toggle checked={cat.is_active} onChange={v => onUpdate(cat.id, { is_active: v })} />
              <button className="em-icon-btn" onClick={() => startEdit(cat)}>✏</button>
            </div>
          </div>
        ))}
        {showForm ? (
          <div className="em-add-form">
            <div className="em-form-row">
              <div>
                <div className="em-field-label">Category name</div>
                <input className="em-field-input" placeholder="e.g. Groceries" value={form.category_name}
                  onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))} />
              </div>
              <div>
                <div className="em-field-label">Icon (emoji)</div>
                <input className="em-field-input" placeholder="🛒" value={form.icon_code}
                  onChange={e => setForm(f => ({ ...f, icon_code: e.target.value }))} />
              </div>
            </div>
            <div className="em-form-row">
              <div>
                <div className="em-field-label">Colour</div>
                <input type="color" value={form.colour_hex}
                  onChange={e => setForm(f => ({ ...f, colour_hex: e.target.value }))}
                  style={{ width:'100%', height:40, border:'none', borderRadius:10, cursor:'pointer', padding:2 }} />
              </div>
              <div>
                <div className="em-field-label">Monthly budget (₹)</div>
                <input className="em-field-input" type="number" placeholder="Optional" value={form.budget_limit_monthly}
                  onChange={e => setForm(f => ({ ...f, budget_limit_monthly: e.target.value }))} />
              </div>
            </div>
            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleSave} disabled={!form.category_name.trim() || !form.icon_code.trim() || saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Add'}
              </button>
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

// ── Section D: Recurring Items ─────────────────────────────────────────────────

function RecurringSection({ recurringItems, categories, paymentSources, onAdd, onUpdate, onDelete }) {
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({
    item_name:'', recurring_type:'subscription', amount:'', frequency:'monthly',
    due_day:'', payment_source_id:'', category_id:'',
    reminder_days_before:2, reminder_enabled:true, auto_log:false, notes:'',
  })
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setForm({ item_name:'', recurring_type:'subscription', amount:'', frequency:'monthly',
      due_day:'', payment_source_id:'', category_id:'',
      reminder_days_before:2, reminder_enabled:true, auto_log:false, notes:'' })
  }

  async function handleSave() {
    if (!form.item_name.trim() || !form.amount) return
    setSaving(true)
    try {
      const payload = {
        item_name:            form.item_name.trim(),
        recurring_type:       form.recurring_type,
        amount:               Number(form.amount),
        frequency:            form.frequency,
        due_day:              (form.frequency === 'monthly' && form.due_day) ? Number(form.due_day) : null,
        payment_source_id:    form.payment_source_id || null,
        category_id:          form.category_id || null,
        reminder_days_before: Number(form.reminder_days_before),
        reminder_enabled:     form.reminder_enabled,
        auto_log:             form.auto_log,
        notes:                form.notes || null,
      }
      await onAdd(payload)
      resetForm(); setShowForm(false)
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
              <div style={{ flex: 1 }}>
                <div className="em-setup-item-name">{r.item_name}</div>
                <div className="em-setup-item-sub">
                  ₹{fmtAmt(r.amount)} · {r.frequency}
                  {r.due_date_next ? ` · next: ${fmtDate(r.due_date_next)}` : ''}
                </div>
              </div>
              <div className="em-setup-actions">
                <Toggle checked={r.reminder_enabled} onChange={v => onUpdate(r.id, { reminder_enabled: v })} />
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
                  onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} />
              </div>
              <div>
                <div className="em-field-label">Type</div>
                <select className="em-field-select" value={form.recurring_type}
                  onChange={e => setForm(f => ({ ...f, recurring_type: e.target.value }))}>
                  <option value="subscription">Subscription</option>
                  <option value="due">Due / Bill</option>
                </select>
              </div>
            </div>
            <div className="em-form-row">
              <div>
                <div className="em-field-label">Amount (₹)</div>
                <input className="em-field-input" type="number" placeholder="999" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <div className="em-field-label">Frequency</div>
                <select className="em-field-select" value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {['daily','weekly','monthly','yearly'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            {form.frequency === 'monthly' && (
              <div>
                <div className="em-field-label">Due day of month</div>
                <input className="em-field-input" type="number" min="1" max="31" placeholder="15" value={form.due_day}
                  onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} />
              </div>
            )}
            <div>
              <div className="em-field-label">Payment source</div>
              <select className="em-field-select" value={form.payment_source_id}
                onChange={e => setForm(f => ({ ...f, payment_source_id: e.target.value }))}>
                <option value="">— Select —</option>
                {paymentSources.filter(s => s.is_active).map(s => (
                  <option key={s.id} value={s.id}>{SOURCE_ICONS[s.source_type]} {s.source_name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="em-field-label">Category</div>
              <select className="em-field-select" value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">— Select —</option>
                {categories.filter(c => c.is_active).map(c => (
                  <option key={c.id} value={c.id}>{c.icon_code} {c.category_name}</option>
                ))}
              </select>
            </div>
            <div style={{ display:'flex', gap:16, alignItems:'center' }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontFamily:'DM Sans', color:'#374151', cursor:'pointer' }}>
                <Toggle checked={form.reminder_enabled} onChange={v => setForm(f => ({ ...f, reminder_enabled: v }))} />
                Remind me
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontFamily:'DM Sans', color:'#374151', cursor:'pointer' }}>
                <Toggle checked={form.auto_log} onChange={v => setForm(f => ({ ...f, auto_log: v }))} />
                Auto-log
              </label>
            </div>
            <div className="em-form-row">
              <button className="em-add-btn" onClick={handleSave} disabled={!form.item_name.trim() || !form.amount || saving}>
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function ExpenseManager() {
  const {
    transactions, categories, paymentSources, recurringItems, familyMembers,
    loading, error, reload,
    addTransaction, deleteTransaction,
    addCategory, updateCategory,
    addPaymentSource, updatePaymentSource,
    addRecurringItem, updateRecurringItem, deleteRecurringItem,
  } = useExpense()

  const [tab,             setTab]             = useState('log')
  const [filterMode,      setFilterMode]      = useState('this')
  const [customStart,     setCustomStart]     = useState('')
  const [customEnd,       setCustomEnd]       = useState(todayStr())
  const [panelOpen,       setPanelOpen]       = useState(false)
  const [markingId,       setMarkingId]       = useState(null)
  const [alertDismissed,  setAlertDismissed]  = useState(false)

  useWindowWidth() // keep for future responsive use

  // Date range for filter
  const dateRange = useMemo(() => {
    if (filterMode === 'this') {
      return { start: monthPrefix(0) + '-01', end: todayStr() }
    }
    if (filterMode === 'last') {
      const p  = monthPrefix(-1)
      const d  = new Date(); d.setMonth(d.getMonth() - 1)
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

  // Budget alerts — always current month, regardless of filter
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

  const overBudget  = budgetAlerts.filter(a => a.pct >= 1)
  const nearBudget  = budgetAlerts.filter(a => a.pct >= 0.75 && a.pct < 1)
  const alertLevel  = overBudget.length > 0 ? 'red' : nearBudget.length > 0 ? 'amber' : null

  // Upcoming dues
  const todayISO  = todayStr()
  const in30ISO   = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0,10) })()
  const upcomingDues = recurringItems
    .filter(r => r.is_active && r.due_date_next && r.due_date_next <= in30ISO)
    .sort((a, b) => (a.due_date_next||'').localeCompare(b.due_date_next||''))

  async function handleMarkPaid(r) {
    setMarkingId(r.id)
    try {
      await addTransaction({
        txn_type:          'expense',
        amount:            r.amount,
        category_id:       r.category_id || null,
        payment_source_id: r.payment_source_id || null,
        family_member:     'Self',
        txn_date:          todayISO,
        notes:             `Auto-logged: ${r.item_name}`,
        recurring_id:      r.id,
      })
    } catch (err) {
      console.error('markPaid error:', err)
    } finally {
      setMarkingId(null)
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
      <div className="em-wrap">

        {/* Page header */}
        <div className="em-page-header">
          <span style={{ fontSize: 26 }}>💸</span>
          <div className="em-page-title">Expense Manager</div>
          <button className="em-log-btn" onClick={() => setPanelOpen(true)}>+ Log</button>
        </div>

        {/* Tabs */}
        <div className="em-tabs">
          {[['log','Log'],['setup','Setup'],['analytics','Analytics'],['dues','Dues']].map(([id, label]) => (
            <button
              key={id}
              className={`em-tab${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
              {id === 'dues' && upcomingDues.length > 0 && (
                <span className="em-tab-badge">{upcomingDues.length}</span>
              )}
              {id === 'log' && alertLevel && (
                <span className="em-tab-badge">{budgetAlerts.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── LOG TAB ──────────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <>
            <div className="em-filter-bar">
              <button className={`em-filter-chip${filterMode === 'this' ? ' active' : ''}`} onClick={() => setFilterMode('this')}>
                {monthLabel(0)}
              </button>
              <button className={`em-filter-chip${filterMode === 'last' ? ' active' : ''}`} onClick={() => setFilterMode('last')}>
                {monthLabel(-1)}
              </button>
              <button className={`em-filter-chip${filterMode === 'custom' ? ' active' : ''}`} onClick={() => setFilterMode('custom')}>
                Custom
              </button>
            </div>

            {filterMode === 'custom' && (
              <div style={{ display:'flex', gap:10, padding:'0 16px 12px', alignItems:'center' }}>
                <input type="date" className="em-field-input" style={{ flex:1 }}
                  value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span style={{ color:'#94a3b8', fontSize:13, fontFamily:'DM Sans' }}>to</span>
                <input type="date" className="em-field-input" style={{ flex:1 }}
                  value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}

            {/* Budget alert banner — Part C */}
            {alertLevel && !alertDismissed && (
              <div className={`em-budget-banner ${alertLevel}`}>
                <span className="em-budget-banner-icon">⚠</span>
                <span className="em-budget-banner-text">
                  {alertLevel === 'red'
                    ? `Budget exceeded — ${overBudget.map(c => c.category_name).join(', ')} ${overBudget.length === 1 ? 'is' : 'are'} over limit`
                    : `Budget alert — ${nearBudget.length} ${nearBudget.length === 1 ? 'category' : 'categories'} near limit this month`
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
                <div className="em-summary-value" style={{ color: summary.net >= 0 ? '#16a34a' : '#dc2626' }}>
                  ₹{fmtAmt(Math.abs(summary.net))}
                </div>
                <div className="em-summary-label">Net</div>
              </div>
            </div>

            <div className="em-txn-list">
              {filtered.length === 0 ? (
                <div className="em-empty">No transactions in this period.<br />Tap + Log to add one.</div>
              ) : (
                filtered.map(txn => (
                  <TxnRow
                    key={txn.id}
                    txn={txn}
                    categories={categories}
                    paymentSources={paymentSources}
                    onDelete={deleteTransaction}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ─── SETUP TAB ────────────────────────────────────────────────────── */}
        {tab === 'setup' && (
          <div style={{ paddingTop: 8 }}>
            <FamilyMembersSection familyMembers={familyMembers} />
            <PaymentSourcesSection paymentSources={paymentSources} transactions={transactions} onAdd={addPaymentSource} onUpdate={updatePaymentSource} />
            <CategoriesSection categories={categories} onAdd={addCategory} onUpdate={updateCategory} />
            <RecurringSection recurringItems={recurringItems} categories={categories} paymentSources={paymentSources} onAdd={addRecurringItem} onUpdate={updateRecurringItem} onDelete={deleteRecurringItem} />
          </div>
        )}

        {/* ─── ANALYTICS TAB (stub) ─────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div className="em-stub">
            <div className="em-stub-icon">👁</div>
            <div className="em-stub-title">Analytics coming soon</div>
            <div className="em-stub-sub">Monthly snapshots, category breakdown, and 12-month projections will be available in the next update.</div>
          </div>
        )}

        {/* ─── DUES TAB ─────────────────────────────────────────────────────── */}
        {tab === 'dues' && (
          <div className="em-dues-list">
            {upcomingDues.length === 0 ? (
              <div className="em-empty">No upcoming dues in the next 30 days.</div>
            ) : (
              upcomingDues.map(r => {
                const days   = daysUntil(r.due_date_next)
                const cat    = categories.find(c => c.id === r.category_id)
                const cls    = days < 0 ? 'overdue' : days <= 3 ? 'urgent' : 'ok'
                const badge  = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`
                return (
                  <div key={r.id} className={`em-due-row ${cls}`}>
                    <div style={{ fontSize:22, width:28, textAlign:'center', flexShrink:0 }}>
                      {cat ? cat.icon_code : '🔄'}
                    </div>
                    <div className="em-due-left">
                      <div className="em-due-name">{r.item_name}</div>
                      <div className="em-due-meta">{fmtDate(r.due_date_next)} · {r.frequency}</div>
                    </div>
                    <div className="em-due-right">
                      <div className="em-due-amt">₹{fmtAmt(r.amount)}</div>
                      <span className={`em-due-badge ${cls}`}>{badge}</span>
                    </div>
                    <button className="em-mark-paid-btn" disabled={markingId === r.id} onClick={() => handleMarkPaid(r)}>
                      {markingId === r.id ? '…' : 'Mark Paid'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

      </div>

      <ExpenseEntryPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
