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
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

function monthPrefix(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(dateStr + 'T00:00:00'); d.setHours(0,0,0,0)
  return Math.round((d - today) / 86400000)
}

const SOURCE_ICONS = { credit_card:'💳', bank_account:'🏦', cash:'💵', upi_wallet:'📲', third_party:'🔗' }
const SOURCE_TYPE_LABELS = { credit_card:'Credit Card', bank_account:'Bank Account', cash:'Cash', upi_wallet:'UPI / Wallet', third_party:'Third Party' }

// ── Styles ────────────────────────────────────────────────────────────────────

const emStyles = `
  .em-wrap {
    max-width: 640px; margin: 0 auto; padding: 0 0 100px;
    font-family: 'DM Sans', sans-serif;
  }
  .em-page-header {
    padding: 20px 16px 0;
    display: flex; align-items: center; gap: 10px;
  }
  .em-page-title {
    font-size: 22px; font-weight: 700; color: var(--color-text-primary, #111);
    flex: 1;
  }

  .em-tabs {
    display: flex; border-bottom: 2px solid #f0f0f0;
    padding: 0 16px; margin-top: 16px; gap: 4px;
    position: sticky; top: 56px; z-index: 100;
    background: var(--color-bg, #fff);
  }
  .em-tab {
    padding: 12px 16px; border: none; background: transparent;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    color: var(--color-text-muted, #999); cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -2px;
    transition: all 0.15s; white-space: nowrap;
  }
  .em-tab.active { color: var(--color-primary, #1D9E75); border-bottom-color: var(--color-primary, #1D9E75); font-weight: 600; }

  /* ── LOG TAB ── */
  .em-filter-bar {
    display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto;
    scrollbar-width: none; background: var(--color-bg, #fff);
  }
  .em-filter-bar::-webkit-scrollbar { display: none; }
  .em-filter-chip {
    flex-shrink: 0; padding: 6px 14px; border-radius: 20px;
    border: 1.5px solid #e8e8e8; background: #fff;
    font-size: 13px; cursor: pointer; transition: all 0.12s;
    color: var(--color-text-primary, #111); white-space: nowrap;
  }
  .em-filter-chip.active {
    background: var(--color-primary, #1D9E75); color: #fff;
    border-color: var(--color-primary, #1D9E75); font-weight: 600;
  }

  .em-summary-bar {
    display: flex; gap: 0; margin: 0 16px 12px;
    background: #f8f9fa; border-radius: 12px; overflow: hidden;
  }
  .em-summary-item {
    flex: 1; padding: 12px 8px; text-align: center;
    border-right: 1px solid #ececec;
  }
  .em-summary-item:last-child { border-right: none; }
  .em-summary-value { font-size: 15px; font-weight: 700; }
  .em-summary-label { font-size: 10px; color: #999; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }

  .em-txn-list { padding: 0 16px; }
  .em-txn-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 0; border-bottom: 1px solid #f5f5f5;
    cursor: pointer;
  }
  .em-txn-row:last-child { border-bottom: none; }
  .em-txn-icon {
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
    background: #f5f5f5;
  }
  .em-txn-centre { flex: 1; min-width: 0; }
  .em-txn-cat { font-size: 14px; font-weight: 600; color: var(--color-text-primary, #111); }
  .em-txn-meta { font-size: 11px; color: #aaa; margin-top: 1px; }
  .em-txn-right { text-align: right; flex-shrink: 0; }
  .em-txn-amount { font-size: 15px; font-weight: 700; }
  .em-txn-src { font-size: 11px; color: #aaa; margin-top: 2px; }

  .em-txn-expand {
    padding: 10px 14px 14px 58px;
    background: #fafafa; border-radius: 0 0 12px 12px;
    border-bottom: 1px solid #f0f0f0;
  }
  .em-txn-note { font-size: 12px; color: #666; margin-bottom: 10px; font-style: italic; }
  .em-txn-actions { display: flex; gap: 8px; }
  .em-txn-edit-btn, .em-txn-del-btn {
    padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; border: none;
  }
  .em-txn-edit-btn { background: #f0f0f0; color: var(--color-text-primary, #111); }
  .em-txn-del-btn  { background: #fff0f0; color: #F44336; }
  .em-txn-edit-btn:hover { background: #e0e0e0; }
  .em-txn-del-btn:hover  { background: #ffe0e0; }

  .em-empty {
    text-align: center; padding: 48px 20px;
    color: var(--color-text-muted, #999); font-size: 14px;
  }

  /* ── SETUP TAB ── */
  .em-setup-section {
    margin: 12px 16px; border: 1px solid #f0f0f0; border-radius: 14px; overflow: hidden;
  }
  .em-setup-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; cursor: pointer; user-select: none;
    background: #fff;
  }
  .em-setup-header:hover { background: #fafafa; }
  .em-setup-header-left { display: flex; align-items: center; gap: 10px; }
  .em-setup-icon { font-size: 20px; }
  .em-setup-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary, #111); }
  .em-setup-count { font-size: 11px; color: #aaa; }
  .em-setup-chevron { font-size: 12px; color: #aaa; transition: transform 0.2s; }
  .em-setup-chevron.open { transform: rotate(180deg); }
  .em-setup-body { padding: 0 16px 16px; border-top: 1px solid #f5f5f5; }

  .em-setup-list-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid #f8f8f8;
  }
  .em-setup-list-item:last-child { border-bottom: none; }
  .em-setup-item-icon { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
  .em-setup-item-name { flex: 1; font-size: 14px; color: var(--color-text-primary, #111); }
  .em-setup-item-sub { font-size: 11px; color: #aaa; }
  .em-setup-item-badge {
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    font-weight: 600;
  }
  .em-setup-actions { display: flex; align-items: center; gap: 6px; }
  .em-icon-btn {
    border: none; background: transparent; cursor: pointer;
    font-size: 14px; color: #aaa; padding: 4px; border-radius: 6px;
    transition: color 0.12s, background 0.12s;
  }
  .em-icon-btn:hover { color: var(--color-primary, #1D9E75); background: rgba(29,158,117,0.08); }
  .em-icon-btn.danger:hover { color: #F44336; background: #fff0f0; }

  .em-add-form {
    margin-top: 12px; padding: 14px; background: #f8f9fa;
    border-radius: 12px; display: flex; flex-direction: column; gap: 10px;
  }
  .em-field-label {
    font-size: 11px; font-weight: 600; color: #888;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;
  }
  .em-field-input {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e8e8e8; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; transition: border-color 0.15s; background: #fff;
  }
  .em-field-input:focus { border-color: var(--color-primary, #1D9E75); }
  .em-field-select {
    width: 100%; padding: 9px 12px; border: 1.5px solid #e8e8e8; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    box-sizing: border-box; transition: border-color 0.15s; background: #fff;
    appearance: none; cursor: pointer;
  }
  .em-field-select:focus { border-color: var(--color-primary, #1D9E75); }
  .em-form-row { display: flex; gap: 10px; }
  .em-form-row > * { flex: 1; min-width: 0; }
  .em-add-btn {
    padding: 10px; border: none; border-radius: 10px;
    background: var(--color-primary, #1D9E75); color: #fff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .em-add-btn:hover { background: var(--color-primary-dark, #16805e); }
  .em-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .em-cancel-btn {
    padding: 10px; border: 1.5px solid #e8e8e8; border-radius: 10px;
    background: #fff; color: var(--color-text-primary, #111);
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: border-color 0.15s;
  }
  .em-cancel-btn:hover { border-color: #ccc; }
  .em-add-trigger {
    margin-top: 12px; width: 100%; padding: 10px;
    border: 1.5px dashed #ccc; border-radius: 10px; background: transparent;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    color: var(--color-primary, #1D9E75); font-weight: 600;
    cursor: pointer; transition: border-color 0.15s;
  }
  .em-add-trigger:hover { border-color: var(--color-primary, #1D9E75); }

  .em-colour-swatch {
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid rgba(0,0,0,0.1);
  }
  .em-toggle-switch {
    position: relative; width: 36px; height: 20px; flex-shrink: 0;
  }
  .em-toggle-switch input { opacity: 0; width: 0; height: 0; }
  .em-toggle-slider {
    position: absolute; cursor: pointer; inset: 0;
    background: #e0e0e0; border-radius: 20px; transition: background 0.2s;
  }
  .em-toggle-slider::before {
    content: ''; position: absolute;
    width: 14px; height: 14px; left: 3px; bottom: 3px;
    background: #fff; border-radius: 50%; transition: transform 0.2s;
  }
  input:checked + .em-toggle-slider { background: var(--color-primary, #1D9E75); }
  input:checked + .em-toggle-slider::before { transform: translateX(16px); }

  /* ── ANALYTICS TAB ── */
  .em-stub {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 20px; gap: 12px;
    color: var(--color-text-muted, #999);
  }
  .em-stub-icon { font-size: 48px; opacity: 0.5; }
  .em-stub-title { font-size: 17px; font-weight: 600; color: var(--color-text-secondary, #555); }
  .em-stub-sub { font-size: 13px; text-align: center; }

  /* ── DUES TAB ── */
  .em-dues-list { padding: 12px 16px; }
  .em-due-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px; margin-bottom: 10px;
    border: 1.5px solid #f0f0f0; border-radius: 14px;
    background: #fff;
  }
  .em-due-row.overdue  { border-color: #FFCDD2; background: #FFF9FA; }
  .em-due-row.urgent   { border-color: #FFE0B2; background: #FFFBF5; }
  .em-due-row.ok       { border-color: #C8E6C9; background: #F9FFF9; }
  .em-due-left { flex: 1; min-width: 0; }
  .em-due-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary, #111); }
  .em-due-meta { font-size: 11px; color: #aaa; margin-top: 2px; }
  .em-due-right { text-align: right; flex-shrink: 0; }
  .em-due-amt { font-size: 15px; font-weight: 700; }
  .em-due-badge {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-top: 3px;
    display: inline-block;
  }
  .em-due-badge.overdue { background: #FFCDD2; color: #C62828; }
  .em-due-badge.urgent  { background: #FFE0B2; color: #E65100; }
  .em-due-badge.ok      { background: #C8E6C9; color: #2E7D32; }
  .em-mark-paid-btn {
    padding: 6px 12px; border: none; border-radius: 8px;
    background: var(--color-primary, #1D9E75); color: #fff;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: background 0.12s; flex-shrink: 0;
  }
  .em-mark-paid-btn:hover { background: var(--color-primary-dark, #16805e); }

  @media (max-width: 480px) {
    .em-summary-value { font-size: 13px; }
    .em-page-title { font-size: 19px; }
    .em-txn-amount { font-size: 14px; }
    .em-form-row { flex-direction: column; }
  }
`

// ── Sub-components ────────────────────────────────────────────────────────────

function TxnRow({ txn, categories, paymentSources, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const cat = categories.find(c => c.id === txn.category_id)
  const src = paymentSources.find(s => s.id === txn.payment_source_id)
  const isExpense  = txn.txn_type === 'expense'
  const isIncome   = txn.txn_type === 'income'

  return (
    <>
      <div className="em-txn-row" onClick={() => setExpanded(e => !e)}>
        <div className="em-txn-icon" style={{ background: cat ? cat.colour_hex + '22' : '#f5f5f5' }}>
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
          <div
            className="em-txn-amount"
            style={{ color: isExpense ? '#F44336' : isIncome ? '#4CAF50' : '#2196F3' }}
          >
            {isExpense ? '−' : '+'} ₹{fmtAmt(txn.amount)}
          </div>
          {src && <div className="em-txn-src">{SOURCE_ICONS[src.source_type]} {src.source_name}</div>}
        </div>
      </div>

      {expanded && (
        <div className="em-txn-expand">
          {txn.notes && <div className="em-txn-note">"{txn.notes}"</div>}
          <div className="em-txn-actions">
            <button className="em-txn-del-btn" onClick={() => onDelete(txn.id)}>
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Setup Section wrapper
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

// Toggle switch
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
  const [members,    setMembers]    = useState(() => familyMembers.filter(m => m !== 'Self').map((n, i) => ({ id: i, name: n, relationship: '' })))
  const [showForm,   setShowForm]   = useState(false)
  const [name,       setName]       = useState('')
  const [rel,        setRel]        = useState('Spouse')

  function handleAdd() {
    if (!name.trim()) return
    setMembers(prev => [...prev, { id: Date.now(), name: name.trim(), relationship: rel }])
    setName(''); setRel('Spouse'); setShowForm(false)
  }

  return (
    <SetupSection icon="👨‍👩‍👧" title="Family Members" count={members.length}>
      <div style={{ paddingTop: 12 }}>
        {members.length === 0 && (
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>No family members added yet.</div>
        )}
        {members.map(m => (
          <div key={m.id} className="em-setup-list-item">
            <span className="em-setup-item-icon">👤</span>
            <div style={{ flex: 1 }}>
              <div className="em-setup-item-name">{m.name}</div>
              {m.relationship && <div className="em-setup-item-sub">{m.relationship}</div>}
            </div>
            <div className="em-setup-actions">
              <button className="em-icon-btn danger" onClick={() => setMembers(prev => prev.filter(x => x.id !== m.id))}>✕</button>
            </div>
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
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [form,       setForm]       = useState({ source_name: '', source_type: 'cash', last_four: '', credit_limit: '', billing_cycle_date: '' })
  const [saving,     setSaving]     = useState(false)

  function resetForm() { setForm({ source_name: '', source_type: 'cash', last_four: '', credit_limit: '', billing_cycle_date: '' }) }

  function txnCount(id) { return transactions.filter(t => t.payment_source_id === id).length }

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
      else { await onAdd(payload) }
      resetForm(); setShowForm(false)
    } catch (err) {
      console.error('PaymentSourcesSection save error:', err)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(src) {
    setEditId(src.id)
    setForm({
      source_name:        src.source_name,
      source_type:        src.source_type,
      last_four:          src.last_four || '',
      credit_limit:       src.credit_limit || '',
      billing_cycle_date: src.billing_cycle_date || '',
    })
    setShowForm(true)
  }

  const isCC = form.source_type === 'credit_card'

  return (
    <SetupSection icon="💳" title="Payment Sources" count={paymentSources.length}>
      <div style={{ paddingTop: 12 }}>
        {paymentSources.map(src => {
          const cnt = txnCount(src.id)
          return (
            <div key={src.id} className="em-setup-list-item">
              <span className="em-setup-item-icon">{SOURCE_ICONS[src.source_type] || '💰'}</span>
              <div style={{ flex: 1 }}>
                <div className="em-setup-item-name">{src.source_name}{src.last_four ? ` ···${src.last_four}` : ''}</div>
                <div className="em-setup-item-sub">{SOURCE_TYPE_LABELS[src.source_type]}{src.credit_limit ? ` · ₹${fmtAmt(src.credit_limit)} limit` : ''}</div>
              </div>
              <div className="em-setup-actions">
                <Toggle
                  checked={src.is_active}
                  onChange={v => onUpdate(src.id, { is_active: v })}
                />
                <button className="em-icon-btn" onClick={() => startEdit(src)}>✏</button>
              </div>
            </div>
          )
        })}

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

// ── Section C: Expense Categories ────────────────────────────────────────────

function CategoriesSection({ categories, onAdd, onUpdate }) {
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({ category_name: '', icon_code: '', colour_hex: '#1A3C6E', budget_limit_monthly: '' })
  const [saving,    setSaving]    = useState(false)

  function resetForm() { setForm({ category_name: '', icon_code: '', colour_hex: '#1A3C6E', budget_limit_monthly: '' }) }

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
      else { await onAdd(payload) }
      resetForm(); setShowForm(false)
    } catch (err) {
      console.error('CategoriesSection save error:', err)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(cat) {
    setEditId(cat.id)
    setForm({
      category_name:        cat.category_name,
      icon_code:            cat.icon_code,
      colour_hex:           cat.colour_hex,
      budget_limit_monthly: cat.budget_limit_monthly || '',
    })
    setShowForm(true)
  }

  return (
    <SetupSection icon="🏷️" title="Expense Categories" count={categories.length}>
      <div style={{ paddingTop: 12 }}>
        {categories.map((cat, idx) => (
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
              <Toggle
                checked={cat.is_active}
                onChange={v => onUpdate(cat.id, { is_active: v })}
              />
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
                  style={{ width: '100%', height: 40, border: 'none', borderRadius: 10, cursor: 'pointer', padding: 2 }} />
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

// ── Section D: Recurring Items ────────────────────────────────────────────────

function RecurringSection({ recurringItems, categories, paymentSources, onAdd, onUpdate, onDelete }) {
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({
    item_name: '', recurring_type: 'subscription', amount: '', frequency: 'monthly',
    due_day: '', payment_source_id: '', category_id: '',
    reminder_days_before: 2, reminder_enabled: true, auto_log: false, notes: '',
  })
  const [saving,    setSaving]    = useState(false)

  function resetForm() {
    setForm({ item_name: '', recurring_type: 'subscription', amount: '', frequency: 'monthly',
      due_day: '', payment_source_id: '', category_id: '',
      reminder_days_before: 2, reminder_enabled: true, auto_log: false, notes: '' })
  }

  async function handleSave() {
    if (!form.item_name.trim() || !form.amount) return
    setSaving(true)
    try {
      const dueDayNum = form.frequency === 'monthly' && form.due_day ? Number(form.due_day) : null
      const payload = {
        item_name:            form.item_name.trim(),
        recurring_type:       form.recurring_type,
        amount:               Number(form.amount),
        frequency:            form.frequency,
        due_day:              dueDayNum,
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
          const src = paymentSources.find(s => s.id === r.payment_source_id)
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
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Toggle checked={form.reminder_enabled} onChange={v => setForm(f => ({ ...f, reminder_enabled: v }))} />
                Remind me
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
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

  const [tab,         setTab]         = useState('log')
  const [filterMode,  setFilterMode]  = useState('this')   // 'this' | 'last' | 'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState(todayStr())
  const [panelOpen,   setPanelOpen]   = useState(false)
  const [markingId,   setMarkingId]   = useState(null)

  const width    = useWindowWidth()
  const isMobile = width <= 480

  // Date range for filter
  const dateRange = useMemo(() => {
    if (filterMode === 'this') {
      const p = monthPrefix(0)
      return { start: p + '-01', end: todayStr() }
    }
    if (filterMode === 'last') {
      const p = monthPrefix(-1)
      const d = new Date(); d.setMonth(d.getMonth() - 1)
      const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()
      return { start: p + '-01', end: `${p}-${String(lastDay).padStart(2,'0')}` }
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

  // Upcoming dues in next 30 days
  const todayISO = todayStr()
  const in30Days = new Date(); in30Days.setDate(in30Days.getDate() + 30)
  const in30ISO  = in30Days.toISOString().slice(0,10)
  const upcomingDues = recurringItems.filter(r =>
    r.is_active && r.due_date_next && r.due_date_next <= in30ISO
  ).sort((a, b) => (a.due_date_next || '').localeCompare(b.due_date_next || ''))

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'DM Sans', fontSize: 14, color: '#aaa' }}>
        Loading Expense Manager…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: 'DM Sans', color: '#F44336' }}>
        Error: {error} — <button onClick={reload} style={{ color: 'var(--color-primary)' }}>Retry</button>
      </div>
    )
  }

  return (
    <>
      <style>{emStyles}</style>
      <div className="em-wrap">

        {/* Page header */}
        <div className="em-page-header">
          <span style={{ fontSize: 26 }}>💸</span>
          <div className="em-page-title">Expense Manager</div>
          <button
            onClick={() => setPanelOpen(true)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 10,
              background: 'var(--color-primary, #1D9E75)', color: '#fff',
              fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Log
          </button>
        </div>

        {/* Tabs */}
        <div className="em-tabs">
          {[['log','Log'],['setup','Setup'],['analytics','Analytics'],['dues','Dues']].map(([id, label]) => (
            <button key={id} className={`em-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}
              {id === 'dues' && upcomingDues.length > 0 && (
                <span style={{
                  marginLeft: 5, background: '#F44336', color: '#fff',
                  borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px',
                }}>
                  {upcomingDues.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── LOG TAB ─────────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <>
            <div className="em-filter-bar">
              <button className={`em-filter-chip${filterMode === 'this' ? ' active' : ''}`}
                onClick={() => setFilterMode('this')}>
                {monthLabel(0)}
              </button>
              <button className={`em-filter-chip${filterMode === 'last' ? ' active' : ''}`}
                onClick={() => setFilterMode('last')}>
                {monthLabel(-1)}
              </button>
              <button className={`em-filter-chip${filterMode === 'custom' ? ' active' : ''}`}
                onClick={() => setFilterMode('custom')}>
                Custom
              </button>
            </div>

            {filterMode === 'custom' && (
              <div style={{ display: 'flex', gap: 10, padding: '0 16px 12px', alignItems: 'center' }}>
                <input type="date" className="em-field-input" style={{ flex: 1 }}
                  value={customStart} onChange={e => setCustomStart(e.target.value)} />
                <span style={{ color: '#aaa', fontSize: 13 }}>to</span>
                <input type="date" className="em-field-input" style={{ flex: 1 }}
                  value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            )}

            <div className="em-summary-bar">
              <div className="em-summary-item">
                <div className="em-summary-value" style={{ color: '#4CAF50' }}>₹{fmtAmt(summary.income)}</div>
                <div className="em-summary-label">Income</div>
              </div>
              <div className="em-summary-item">
                <div className="em-summary-value" style={{ color: '#F44336' }}>₹{fmtAmt(summary.expense)}</div>
                <div className="em-summary-label">Expense</div>
              </div>
              <div className="em-summary-item">
                <div className="em-summary-value" style={{ color: summary.net >= 0 ? '#4CAF50' : '#F44336' }}>
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
                    onEdit={() => {}}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* ─── SETUP TAB ───────────────────────────────────────────────────── */}
        {tab === 'setup' && (
          <div style={{ paddingTop: 8 }}>
            <FamilyMembersSection familyMembers={familyMembers} />
            <PaymentSourcesSection
              paymentSources={paymentSources}
              transactions={transactions}
              onAdd={addPaymentSource}
              onUpdate={updatePaymentSource}
            />
            <CategoriesSection
              categories={categories}
              onAdd={addCategory}
              onUpdate={updateCategory}
            />
            <RecurringSection
              recurringItems={recurringItems}
              categories={categories}
              paymentSources={paymentSources}
              onAdd={addRecurringItem}
              onUpdate={updateRecurringItem}
              onDelete={deleteRecurringItem}
            />
          </div>
        )}

        {/* ─── ANALYTICS TAB (stub) ────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div className="em-stub">
            <div className="em-stub-icon">👁</div>
            <div className="em-stub-title">Analytics coming soon</div>
            <div className="em-stub-sub">Monthly snapshots, category breakdown, and 12-month projections will be available in the next update.</div>
          </div>
        )}

        {/* ─── DUES TAB ────────────────────────────────────────────────────── */}
        {tab === 'dues' && (
          <div className="em-dues-list">
            {upcomingDues.length === 0 ? (
              <div className="em-empty">No upcoming dues in the next 30 days.</div>
            ) : (
              upcomingDues.map(r => {
                const days  = daysUntil(r.due_date_next)
                const cat   = categories.find(c => c.id === r.category_id)
                const rowCls = days < 0 ? 'overdue' : days <= 3 ? 'urgent' : 'ok'
                const badgeTxt = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`
                return (
                  <div key={r.id} className={`em-due-row ${rowCls}`}>
                    <div style={{ fontSize: 22, width: 28, textAlign: 'center', flexShrink: 0 }}>
                      {cat ? cat.icon_code : '🔄'}
                    </div>
                    <div className="em-due-left">
                      <div className="em-due-name">{r.item_name}</div>
                      <div className="em-due-meta">{fmtDate(r.due_date_next)} · {r.frequency}</div>
                    </div>
                    <div className="em-due-right">
                      <div className="em-due-amt">₹{fmtAmt(r.amount)}</div>
                      <span className={`em-due-badge ${rowCls}`}>{badgeTxt}</span>
                    </div>
                    <button
                      className="em-mark-paid-btn"
                      disabled={markingId === r.id}
                      onClick={() => handleMarkPaid(r)}
                    >
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
