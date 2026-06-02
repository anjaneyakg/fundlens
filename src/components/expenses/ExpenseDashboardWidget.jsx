import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useExpense } from '../../context/ExpenseContext'
import ExpenseEntryPanel from './ExpenseEntryPanel'

const widgetCSS = `
  .edw-wrap {
    background: #ffffff;
    border: 1px solid #e8ecf0;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    font-family: 'DM Sans', sans-serif;
  }
  .edw-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .edw-header-left { display: flex; align-items: center; gap: 10px; }
  .edw-label {
    font-size: 13px; font-weight: 700; color: #374151;
  }
  .edw-month { font-size: 11px; color: #94a3b8; margin-top: 1px; }
  .edw-eye {
    border: none; background: #f1f5f9; cursor: pointer;
    font-size: 14px; color: #64748b;
    padding: 6px; border-radius: 8px; transition: background 0.12s, color 0.12s;
    line-height: 1; display: flex; align-items: center;
  }
  .edw-eye:hover { background: #e2e8f0; color: #1A3C6E; }

  .edw-masked { display: flex; flex-direction: column; gap: 10px; }
  .edw-blur-row { display: flex; align-items: center; gap: 10px; }
  .edw-blur-label { font-size: 12px; color: #cbd5e1; width: 56px; flex-shrink: 0; }
  .edw-blur-bar  { height: 10px; border-radius: 5px; background: #e2e8f0; }
  .edw-blur-amt  { font-size: 12px; color: #e2e8f0; width: 50px; text-align: right; flex-shrink: 0; }

  .edw-spend-row {
    display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px;
  }
  .edw-spend-amt { font-size: 26px; font-weight: 700; color: #1a1a2a; }
  .edw-spend-sub { font-size: 12px; color: #94a3b8; }

  .edw-progress-bg {
    height: 6px; background: #f1f5f9; border-radius: 3px; margin-bottom: 12px;
    overflow: hidden;
  }
  .edw-progress-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.4s ease;
  }
  .edw-dues-note { font-size: 12px; color: #94a3b8; margin-bottom: 14px; }
  .edw-dues-note strong { color: #dc2626; }

  .edw-actions { display: flex; gap: 10px; margin-top: 16px; }
  .edw-log-btn {
    flex: 1; padding: 10px; border: none; border-radius: 10px;
    background: #1A3C6E; color: #ffffff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .edw-log-btn:hover { background: #15306b; }
  .edw-view-link {
    flex: 1; padding: 10px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    text-align: center;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    color: #374151; text-decoration: none;
    transition: border-color 0.15s, color 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .edw-view-link:hover { border-color: #1A3C6E; color: #1A3C6E; }
`

// Fixed widths for masked bars (avoid Math.random re-render churn)
const MASKED_BARS = [
  { label: 'Expenses', flex: '55%' },
  { label: 'Income',   flex: '38%' },
  { label: 'Net',      flex: '46%' },
]

function currentMonthLabel() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

function todayMonthPrefix() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

export default function ExpenseDashboardWidget() {
  const { transactions, categories, recurringItems, loading } = useExpense()
  const [masked,    setMasked]    = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)

  if (loading) {
    return (
      <div
        style={{
          background: '#ffffff', border: '1px solid #e8ecf0', borderRadius: 16,
          padding: 20, minHeight: 120, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'DM Sans', fontSize: 13, color: '#94a3b8',
        }}
      >
        Loading…
      </div>
    )
  }

  const thisMonth   = todayMonthPrefix()
  const monthTxns   = transactions.filter(t => t.txn_date?.startsWith(thisMonth))
  const monthSpent  = monthTxns.filter(t => t.txn_type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const totalBudget = categories.filter(c => c.is_active && c.budget_limit_monthly)
    .reduce((s, c) => s + Number(c.budget_limit_monthly), 0)
  const pct = totalBudget > 0 ? Math.min((monthSpent / totalBudget) * 100, 100) : 0

  const todayISO  = new Date().toISOString().slice(0,10)
  const in30ISO   = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0,10) })()
  const duesCount = recurringItems.filter(r =>
    r.is_active && r.due_date_next && r.due_date_next >= todayISO && r.due_date_next <= in30ISO
  ).length

  const progressColor = pct >= 90 ? '#dc2626' : pct >= 75 ? '#f59e0b' : '#16a34a'

  return (
    <>
      <style>{widgetCSS}</style>
      <div className="edw-wrap">
        <div className="edw-header">
          <div className="edw-header-left">
            <span style={{ fontSize: 20 }}>💸</span>
            <div>
              <div className="edw-label">Expense Manager</div>
              <div className="edw-month">{currentMonthLabel()}</div>
            </div>
          </div>
          <button className="edw-eye" onClick={() => setMasked(m => !m)} title={masked ? 'Show amounts' : 'Hide amounts'}>
            {masked ? '👁' : '🙈'}
          </button>
        </div>

        {masked ? (
          <div className="edw-masked">
            {MASKED_BARS.map(row => (
              <div key={row.label} className="edw-blur-row">
                <span className="edw-blur-label">{row.label}</span>
                <div className="edw-blur-bar" style={{ flex: 1 }}>
                  <div style={{ width: row.flex, height: '100%', background: '#e2e8f0', borderRadius: 5 }} />
                </div>
                <span className="edw-blur-amt">₹ ●●●</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="edw-spend-row">
              <span className="edw-spend-amt">₹{monthSpent.toLocaleString('en-IN')}</span>
              {totalBudget > 0 && (
                <span className="edw-spend-sub">of ₹{totalBudget.toLocaleString('en-IN')} budget</span>
              )}
            </div>
            {totalBudget > 0 && (
              <div className="edw-progress-bg">
                <div
                  className="edw-progress-fill"
                  style={{ width: `${pct}%`, background: progressColor }}
                />
              </div>
            )}
            {duesCount > 0 && (
              <div className="edw-dues-note">
                <strong>{duesCount} due{duesCount > 1 ? 's' : ''}</strong> in the next 30 days
              </div>
            )}
          </div>
        )}

        <div className="edw-actions">
          <button className="edw-log-btn" onClick={() => setPanelOpen(true)}>
            + Log Expense
          </button>
          <NavLink to="/expenses" className="edw-view-link">
            View Details →
          </NavLink>
        </div>
      </div>

      <ExpenseEntryPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}