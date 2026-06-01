import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useExpense } from '../../context/ExpenseContext'
import ExpenseEntryPanel from './ExpenseEntryPanel'

const widgetStyle = `
  .edw-wrap {
    background: var(--color-bg, #fff);
    border: 1px solid var(--color-border, #e8e8e8);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    font-family: 'DM Sans', sans-serif;
  }
  .edw-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 16px;
  }
  .edw-header-left {
    display: flex; align-items: center; gap: 8px;
  }
  .edw-label {
    font-size: 13px; font-weight: 600; color: var(--color-text-secondary, #555);
  }
  .edw-month {
    font-size: 11px; color: var(--color-text-muted, #999);
  }
  .edw-eye {
    border: none; background: transparent; cursor: pointer;
    font-size: 16px; color: var(--color-text-muted, #aaa);
    padding: 4px; border-radius: 6px; transition: color 0.15s;
  }
  .edw-eye:hover { color: var(--color-primary, #1D9E75); }

  .edw-body-masked {
    display: flex; flex-direction: column; gap: 10px;
  }
  .edw-blur-row {
    display: flex; align-items: center; gap: 10px;
  }
  .edw-blur-label { font-size: 12px; color: #bbb; width: 60px; }
  .edw-blur-bar {
    height: 10px; border-radius: 5px; background: #e8e8e8; flex: 1;
  }
  .edw-blur-amt { font-size: 12px; color: #ddd; width: 50px; text-align: right; }

  .edw-body-unmasked {}
  .edw-spend-row {
    display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px;
  }
  .edw-spend-amt {
    font-size: 24px; font-weight: 700; color: var(--color-text-primary, #111);
  }
  .edw-spend-sub {
    font-size: 12px; color: var(--color-text-muted, #999);
  }
  .edw-progress-bg {
    height: 6px; background: #f0f0f0; border-radius: 3px; margin-bottom: 10px;
  }
  .edw-progress-fill {
    height: 100%; border-radius: 3px;
    background: var(--color-primary, #1D9E75);
    transition: width 0.4s;
  }
  .edw-dues-note {
    font-size: 12px; color: var(--color-text-muted, #999); margin-bottom: 14px;
  }
  .edw-dues-note strong { color: #F44336; }

  .edw-actions {
    display: flex; gap: 10px;
  }
  .edw-log-btn {
    flex: 1; padding: 10px; border: none; border-radius: 10px;
    background: var(--color-primary, #1D9E75); color: #fff;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .edw-log-btn:hover { background: var(--color-primary-dark, #16805e); }
  .edw-view-link {
    flex: 1; padding: 10px; border: 1.5px solid var(--color-border, #e8e8e8);
    border-radius: 10px; text-align: center;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--color-text-primary, #111); text-decoration: none;
    transition: border-color 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .edw-view-link:hover { border-color: var(--color-primary, #1D9E75); color: var(--color-primary, #1D9E75); }
`

function currentMonthLabel() {
  return new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export default function ExpenseDashboardWidget() {
  const { transactions, categories, recurringItems, loading } = useExpense()
  const [masked,     setMasked]     = useState(true)
  const [panelOpen,  setPanelOpen]  = useState(false)

  if (loading) {
    return (
      <div className="edw-wrap" style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#999' }}>Loading…</span>
      </div>
    )
  }

  const now       = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

  const monthExpenses = transactions.filter(t =>
    t.txn_type === 'expense' && t.txn_date?.startsWith(thisMonth)
  )
  const monthSpent = monthExpenses.reduce((sum, t) => sum + Number(t.amount), 0)

  // Budget = sum of all active category monthly budgets
  const totalBudget = categories.filter(c => c.is_active && c.budget_limit_monthly)
    .reduce((sum, c) => sum + Number(c.budget_limit_monthly), 0)

  const pct = totalBudget > 0 ? Math.min((monthSpent / totalBudget) * 100, 100) : 0

  // Upcoming dues in next 30 days
  const today30 = new Date(); today30.setDate(today30.getDate() + 30)
  const todayISO = now.toISOString().slice(0,10)
  const upcomingDues = recurringItems.filter(r =>
    r.is_active && r.due_date_next && r.due_date_next >= todayISO && r.due_date_next <= today30.toISOString().slice(0,10)
  )

  return (
    <>
      <style>{widgetStyle}</style>
      <div className="edw-wrap">
        <div className="edw-header">
          <div className="edw-header-left">
            <span style={{ fontSize: 18 }}>💸</span>
            <div>
              <div className="edw-label">Expense Manager</div>
              <div className="edw-month">{currentMonthLabel()}</div>
            </div>
          </div>
          <button className="edw-eye" onClick={() => setMasked(m => !m)} title={masked ? 'Show' : 'Hide'}>
            {masked ? '👁' : '🙈'}
          </button>
        </div>

        {masked ? (
          <div className="edw-body-masked">
            {['Expenses','Income','Net'].map(label => (
              <div key={label} className="edw-blur-row">
                <span className="edw-blur-label">{label}</span>
                <div className="edw-blur-bar" style={{ width: `${40 + Math.random()*40}%` }} />
                <span className="edw-blur-amt">₹ ●●●</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="edw-body-unmasked">
            <div className="edw-spend-row">
              <span className="edw-spend-amt">
                ₹{monthSpent.toLocaleString('en-IN')}
              </span>
              {totalBudget > 0 && (
                <span className="edw-spend-sub">
                  of ₹{totalBudget.toLocaleString('en-IN')} budget
                </span>
              )}
            </div>
            {totalBudget > 0 && (
              <div className="edw-progress-bg">
                <div
                  className="edw-progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 90 ? '#F44336' : pct >= 75 ? '#FF9800' : 'var(--color-primary, #1D9E75)',
                  }}
                />
              </div>
            )}
            {upcomingDues.length > 0 && (
              <div className="edw-dues-note">
                <strong>{upcomingDues.length} due{upcomingDues.length > 1 ? 's' : ''}</strong> in the next 30 days
              </div>
            )}
          </div>
        )}

        <div className="edw-actions" style={{ marginTop: 16 }}>
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
