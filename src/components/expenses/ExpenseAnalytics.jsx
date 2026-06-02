import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell, Label,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Line,
} from 'recharts'
import useWindowWidth from '../../hooks/useWindowWidth'
import Toast from '../common/Toast'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLORS  = ['#1A3C6E','#3b82f6','#10b981','#f59e0b','#ef4444']
const SOURCE_COLORS = {
  credit_card:  '#1A3C6E',
  bank_account: '#3b82f6',
  cash:         '#10b981',
  upi_wallet:   '#f59e0b',
  third_party:  '#94a3b8',
}
const SOURCE_ICONS = {
  credit_card:'💳', bank_account:'🏦', cash:'💵', upi_wallet:'📲', third_party:'🔗',
}
const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3m',   label: 'Last 3 Months' },
  { value: 'last_6m',   label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom',    label: 'Custom Range' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n) { return Number(n).toLocaleString('en-IN') }

function fmtK(n) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
  if (n >= 1000)   return `${Math.round(n / 1000)}K`
  return fmtAmt(n)
}

function fmtAxis(v) {
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `${Math.round(v / 1000)}K`
  return v
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function monthPfx(offset = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function dateRangeFor(period, customStart, customEnd) {
  const today = new Date()
  switch (period) {
    case 'this_month': {
      const p = monthPfx(0)
      return { start: p + '-01', end: todayStr() }
    }
    case 'last_month': {
      const p  = monthPfx(-1)
      const dM = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: p + '-01', end: `${p}-${String(dM.getDate()).padStart(2,'0')}` }
    }
    case 'last_3m': {
      const d = new Date(today); d.setMonth(d.getMonth() - 3, 1)
      return { start: d.toISOString().slice(0,10), end: todayStr() }
    }
    case 'last_6m': {
      const d = new Date(today); d.setMonth(d.getMonth() - 6, 1)
      return { start: d.toISOString().slice(0,10), end: todayStr() }
    }
    case 'this_year':
      return { start: `${today.getFullYear()}-01-01`, end: todayStr() }
    case 'custom':
      return { start: customStart || todayStr(), end: customEnd || todayStr() }
    default:
      return { start: monthPfx(0) + '-01', end: todayStr() }
  }
}

// ── Custom Recharts Tooltip ───────────────────────────────────────────────────

function mkTooltip(masked) {
  return function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background:'#ffffff', border:'1px solid #e8ecf0', borderRadius:8,
        padding:'8px 12px', fontFamily:'DM Sans', fontSize:13,
        boxShadow:'0 2px 8px rgba(0,0,0,0.1)',
      }}>
        {label && <div style={{ fontWeight:700, color:'#374151', marginBottom:4 }}>{label}</div>}
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || p.fill, display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: p.color||p.fill, flexShrink:0, display:'inline-block' }} />
            <span>{p.name}: <strong>{masked ? '₹ ••••' : `₹${fmtAmt(p.value)}`}</strong></span>
          </div>
        ))}
      </div>
    )
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const analyticsCSS = `
  .ea-wrap { padding: 12px 16px 32px; }

  .ea-controls {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
  }
  .ea-period-select {
    padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    background: #ffffff; color: #374151; outline: none; cursor: pointer;
    transition: border-color 0.15s;
  }
  .ea-period-select:focus { border-color: #1A3C6E; }
  .ea-mask-btn {
    padding: 6px 14px; border: 1px solid #1A3C6E; border-radius: 20px;
    background: #ffffff; color: #1A3C6E;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    display: flex; align-items: center; gap: 5px;
  }
  .ea-mask-btn:hover { background: #f0f4ff; }

  .ea-custom-range {
    display: flex; gap: 8px; align-items: center; margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .ea-date-input {
    padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
    background: #ffffff; color: #374151; flex: 1; min-width: 130px;
    transition: border-color 0.15s;
  }
  .ea-date-input:focus { border-color: #1A3C6E; }

  .ea-card {
    background: #ffffff; border: 1px solid #e8ecf0; border-radius: 12px;
    padding: 16px; margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .ea-card-title {
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
    color: #374151; margin-bottom: 14px; display: flex; align-items: center; gap: 7px;
  }

  /* Section C — Summary tiles */
  .ea-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .ea-tile {
    background: #ffffff; border: 1px solid #e8ecf0; border-radius: 12px;
    padding: 14px 10px; text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  }
  .ea-tile-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-family: 'DM Sans', sans-serif; }
  .ea-tile-value { font-size: 17px; font-weight: 700; font-family: 'DM Sans', sans-serif; }
  .ea-tile-count { font-size: 11px; color: #94a3b8; margin-top: 3px; font-family: 'DM Sans', sans-serif; }
  @media (max-width: 400px) {
    .ea-tiles { grid-template-columns: 1fr 1fr; }
    .ea-tile:last-child { grid-column: span 2; }
  }

  /* Section D — Category list */
  .ea-cat-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f8f9fa; }
  .ea-cat-row:last-child { border-bottom: none; }
  .ea-cat-icon { font-size: 18px; width: 26px; text-align: center; flex-shrink: 0; }
  .ea-cat-info { flex: 1; min-width: 0; }
  .ea-cat-name { font-size: 13px; font-weight: 600; color: #1a1a2a; font-family: 'DM Sans', sans-serif; }
  .ea-cat-budget { font-size: 11px; color: #94a3b8; margin-top: 2px; font-family: 'DM Sans', sans-serif; }
  .ea-cat-pbar-bg { height: 5px; background: #f1f5f9; border-radius: 3px; margin-top: 5px; overflow: hidden; }
  .ea-cat-pbar-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }
  .ea-cat-amt { font-size: 13px; font-weight: 700; color: #1a1a2a; text-align: right; flex-shrink: 0; font-family: 'DM Sans', sans-serif; }

  /* Section G — Projection table */
  .ea-proj-table { width: 100%; border-collapse: collapse; font-family: 'DM Sans', sans-serif; font-size: 12px; margin-top: 12px; }
  .ea-proj-table th { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e8ecf0; }
  .ea-proj-table td { padding: 6px 8px; color: #374151; border-bottom: 1px solid #f8f9fa; }
  .ea-proj-table td:not(:first-child) { text-align: right; font-weight: 600; }
  .ea-proj-table tr:last-child td { border-bottom: none; }

  /* Source legend */
  .ea-src-legend { margin-top: 12px; }
  .ea-src-legend-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 0; border-bottom: 1px solid #f8f9fa; font-family: 'DM Sans', sans-serif;
  }
  .ea-src-legend-row:last-child { border-bottom: none; }
  .ea-src-legend-left { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; }
  .ea-src-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .ea-src-legend-right { font-size: 13px; font-weight: 700; color: #1a1a2a; }
  .ea-src-legend-pct { font-size: 11px; color: #94a3b8; margin-left: 4px; }

  /* Donut center label overlay */
  .ea-donut-wrap { position: relative; }
  .ea-donut-center {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    text-align: center; pointer-events: none;
  }
  .ea-donut-total { font-size: 16px; font-weight: 700; color: #1a1a2a; font-family: 'DM Sans', sans-serif; }
  .ea-donut-sub   { font-size: 11px; color: #94a3b8; font-family: 'DM Sans', sans-serif; }

  /* Section H — Subscription Audit */
  .ea-sub-summary {
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: #64748b;
    margin-bottom: 14px; line-height: 1.5;
  }
  .ea-sub-row {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid #f1f5f9;
    font-family: 'DM Sans', sans-serif;
  }
  .ea-sub-row:last-child { border-bottom: none; }
  .ea-sub-icon   { font-size: 20px; flex-shrink: 0; width: 26px; text-align: center; margin-top: 2px; }
  .ea-sub-info   { flex: 1; min-width: 0; }
  .ea-sub-name   { font-size: 14px; font-weight: 600; color: #1a1a2a; }
  .ea-sub-meta   { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .ea-sub-annual { font-size: 11px; color: #64748b; margin-top: 2px; }
  .ea-sub-right  { text-align: right; flex-shrink: 0; }
  .ea-sub-amount { font-size: 14px; font-weight: 700; color: #1A3C6E; }
  .ea-sub-freq   { font-size: 11px; color: #94a3b8; }
  .ea-sub-deactivate {
    margin-top: 4px; padding: 4px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
    background: #ffffff; color: #64748b;
    font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
    cursor: pointer; transition: all 0.12s; white-space: nowrap;
  }
  .ea-sub-deactivate:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; background: #fef2f2; }
  .ea-sub-deactivate:disabled { opacity: 0.5; cursor: not-allowed; }
  .ea-sub-highlight {
    background: #f0f4ff; border: 1px solid #c7d2fe;
    border-radius: 12px; padding: 16px; margin-top: 14px;
  }
  .ea-sub-hl-label { font-size: 12px; color: #64748b; font-family: 'DM Sans', sans-serif; margin-bottom: 6px; }
  .ea-sub-hl-amounts {
    font-size: 17px; font-weight: 700; color: #1A3C6E;
    font-family: 'DM Sans', sans-serif; margin-bottom: 6px;
  }
  .ea-sub-hl-note { font-size: 12px; color: #64748b; font-family: 'DM Sans', sans-serif; }
  @media (max-width: 480px) {
    .ea-sub-row { flex-wrap: wrap; }
    .ea-sub-annual { display: none; }
  }
`

// ── Main Component ────────────────────────────────────────────────────────────

export default function ExpenseAnalytics({ transactions, categories, paymentSources, recurringItems, updateRecurringItem }) {
  const width = useWindowWidth()

  // Section A — Mask state
  const [masked,      setMasked]      = useState(true)

  // Section B — Period selector
  const [period,      setPeriod]      = useState('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState(todayStr())

  // Section H — Subscription audit state
  const [deactivating,  setDeactivating]  = useState(null)
  const [deactivatedIds,setDeactivatedIds]= useState(new Set())

  // Toast
  const [toast, setToast] = useState(null)

  // ── Derived date range ─────────────────────────────────────────────────────
  const dateRange = useMemo(
    () => dateRangeFor(period, customStart, customEnd),
    [period, customStart, customEnd]
  )

  const filtered = useMemo(() => {
    if (!dateRange.start) return transactions
    return transactions.filter(t => t.txn_date >= dateRange.start && t.txn_date <= dateRange.end)
  }, [transactions, dateRange])

  // ── Section C — Summary ────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let income = 0, expense = 0, incomeTxns = 0, expenseTxns = 0
    filtered.forEach(t => {
      if (t.txn_type === 'expense') { expense += Number(t.amount); expenseTxns++ }
      else if (t.txn_type === 'income') { income += Number(t.amount); incomeTxns++ }
    })
    return { income, expense, incomeTxns, expenseTxns, net: income - expense }
  }, [filtered])

  // ── Section D — Category breakdown ────────────────────────────────────────
  const catBreakdown = useMemo(() => {
    const byId = {}
    filtered.filter(t => t.txn_type === 'expense').forEach(t => {
      const id = t.category_id || '__none__'
      byId[id] = (byId[id] || 0) + Number(t.amount)
    })
    return Object.entries(byId).map(([id, amount]) => {
      const cat = categories.find(c => c.id === id)
      return {
        id, amount,
        name:   cat?.category_name || 'Uncategorised',
        icon:   cat?.icon_code     || '💸',
        colour: cat?.colour_hex    || '#94a3b8',
        budget: cat?.budget_limit_monthly || 0,
      }
    }).sort((a, b) => b.amount - a.amount)
  }, [filtered, categories])

  const donutData = useMemo(() => {
    if (masked) return [{ name: '•', value: 1 }]
    const top5 = catBreakdown.slice(0, 5)
    if (!top5.length) return [{ name: 'No data', value: 1 }]
    return top5.map(c => ({ name: c.name, value: c.amount }))
  }, [masked, catBreakdown])

  // ── Section E — Monthly trend (always last 6 months) ──────────────────────
  const monthlyTrend = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
      const prefix = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const monthTxns = transactions.filter(t => t.txn_date?.startsWith(prefix))
      const income  = monthTxns.filter(t => t.txn_type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const expense = monthTxns.filter(t => t.txn_type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      months.push({ month: d.toLocaleString('en-IN', { month: 'short' }), income, expense })
    }
    return months
  }, [transactions])

  // ── Section F — Payment source split ──────────────────────────────────────
  const sourceSplit = useMemo(() => {
    const byId = {}
    filtered.filter(t => t.txn_type === 'expense' && t.payment_source_id).forEach(t => {
      byId[t.payment_source_id] = (byId[t.payment_source_id] || 0) + Number(t.amount)
    })
    const total = Object.values(byId).reduce((s, v) => s + v, 0)
    return paymentSources
      .filter(s => byId[s.id])
      .map(s => ({
        id: s.id, name: s.source_name, type: s.source_type,
        amount: byId[s.id], pct: total > 0 ? (byId[s.id] / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [filtered, paymentSources])

  const sourcePieData = useMemo(() => {
    if (masked) return [{ name: '•', value: 1 }]
    if (!sourceSplit.length) return [{ name: 'No data', value: 1 }]
    return sourceSplit.map(s => ({ name: s.name, value: s.amount, type: s.type }))
  }, [masked, sourceSplit])

  // ── Section G — 12-month projection ──────────────────────────────────────
  const projectionData = useMemo(() => {
    const d3mStart = new Date(); d3mStart.setDate(1); d3mStart.setMonth(d3mStart.getMonth() - 3)
    const d3mStr   = d3mStart.toISOString().slice(0,8) + '01'
    const last3m   = transactions.filter(t => t.txn_type === 'expense' && t.txn_date >= d3mStr)

    const catTotals = {}
    last3m.forEach(t => {
      catTotals[t.category_id] = (catTotals[t.category_id] || 0) + Number(t.amount)
    })
    const recurCatIds = new Set(recurringItems.filter(r => r.is_active && r.category_id).map(r => r.category_id))
    const variableMonthly = Object.entries(catTotals)
      .filter(([id]) => !recurCatIds.has(id))
      .reduce((sum, [, total]) => sum + total / 3, 0)

    const result = []
    for (let i = 0; i < 12; i++) {
      const fd = new Date(); fd.setDate(1); fd.setMonth(fd.getMonth() + i + 1)
      const fy = fd.getFullYear(), fm = fd.getMonth()

      let committed = 0
      recurringItems.filter(r => r.is_active).forEach(r => {
        if (r.frequency === 'daily')   committed += r.amount * 30
        else if (r.frequency === 'weekly')  committed += r.amount * 4.3
        else if (r.frequency === 'monthly') committed += r.amount
        else if (r.frequency === 'yearly' && r.due_date_next) {
          const dd = new Date(r.due_date_next + 'T00:00:00')
          if (dd.getFullYear() === fy && dd.getMonth() === fm) committed += r.amount
        }
      })

      result.push({
        month:     fd.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        committed: Math.round(committed),
        variable:  Math.round(variableMonthly),
        total:     Math.round(committed + variableMonthly),
      })
    }
    return result
  }, [transactions, recurringItems])

  // ── Section H — Subscription audit ───────────────────────────────────────
  const subscriptions = useMemo(() => {
    return recurringItems
      .filter(r => r.recurring_type === 'subscription' && r.is_active !== false && !deactivatedIds.has(r.id))
      .map(r => {
        const monthly = r.frequency === 'monthly' ? r.amount
          : r.frequency === 'yearly'  ? r.amount / 12
          : r.frequency === 'weekly'  ? r.amount * 4.3
          : r.amount * 30  // daily
        return { ...r, monthly }
      })
      .sort((a, b) => b.monthly - a.monthly)
  }, [recurringItems, deactivatedIds])

  const subscriptionMonthlyTotal = subscriptions.reduce((s, r) => s + r.monthly, 0)
  const subscriptionAnnualTotal  = subscriptionMonthlyTotal * 12

  async function handleDeactivate(r) {
    if (!updateRecurringItem) return
    setDeactivating(r.id)
    try {
      await updateRecurringItem(r.id, { is_active: false })
      setDeactivatedIds(prev => new Set([...prev, r.id]))
      setToast({ message: `${r.item_name} deactivated`, type: 'success' })
    } catch (err) {
      console.error('ExpenseAnalytics handleDeactivate error:', err)
      setToast({ message: 'Failed to deactivate. Check connection.', type: 'error' })
    } finally {
      setDeactivating(null)
    }
  }

  const isMobile = width <= 480

  return (
    <>
      <style>{analyticsCSS}</style>

      {toast && (
        <Toast key={toast.message} message={toast.message} type={toast.type} duration={2500} onDismiss={() => setToast(null)} />
      )}

      <div className="ea-wrap">

        {/* ── Sections A + B: Controls ──────────────────────────────────── */}
        <div className="ea-controls">
          <select
            className="ea-period-select"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button className="ea-mask-btn" onClick={() => setMasked(m => !m)}>
            {masked ? '👁 Show' : '🙈 Hide'}
          </button>
        </div>

        {period === 'custom' && (
          <div className="ea-custom-range">
            <input type="date" className="ea-date-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span style={{ color:'#94a3b8', fontFamily:'DM Sans', fontSize:13 }}>to</span>
            <input type="date" className="ea-date-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        )}

        {/* ── Section C: Summary tiles ────────────────────────────────── */}
        <div className="ea-tiles">
          <div className="ea-tile">
            <div className="ea-tile-label">Income</div>
            <div className="ea-tile-value" style={{ color:'#16a34a' }}>
              {masked ? '₹ ••••' : `₹${fmtAmt(summary.income)}`}
            </div>
            <div className="ea-tile-count">{summary.incomeTxns} txn{summary.incomeTxns !== 1 ? 's' : ''}</div>
          </div>
          <div className="ea-tile">
            <div className="ea-tile-label">Expense</div>
            <div className="ea-tile-value" style={{ color:'#dc2626' }}>
              {masked ? '₹ ••••' : `₹${fmtAmt(summary.expense)}`}
            </div>
            <div className="ea-tile-count">{summary.expenseTxns} txn{summary.expenseTxns !== 1 ? 's' : ''}</div>
          </div>
          <div className="ea-tile">
            <div className="ea-tile-label">Net</div>
            <div className="ea-tile-value" style={{ color: summary.net >= 0 ? '#16a34a' : '#dc2626' }}>
              {masked ? '₹ ••••' : `₹${fmtAmt(Math.abs(summary.net))}`}
            </div>
            <div className="ea-tile-count" style={{ color: summary.net >= 0 ? '#16a34a' : '#dc2626' }}>
              {summary.net >= 0 ? 'Surplus' : 'Deficit'}
            </div>
          </div>
        </div>

        {/* ── Section D: Category breakdown ───────────────────────────── */}
        <div className="ea-card">
          <div className="ea-card-title">🏷️ Category Breakdown</div>

          {/* Donut chart */}
          <div className="ea-donut-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={masked ? '#e2e8f0' : CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                {!masked && <Tooltip content={mkTooltip(masked)} />}
              </PieChart>
            </ResponsiveContainer>
            <div className="ea-donut-center" style={{ top:'50%', left:'50%' }}>
              <div className="ea-donut-total">
                {masked ? '₹ ••••' : `₹${fmtK(summary.expense)}`}
              </div>
              <div className="ea-donut-sub">Total</div>
            </div>
          </div>

          {/* Legend */}
          {!masked && catBreakdown.slice(0,5).map((c, i) => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', fontFamily:'DM Sans', fontSize:12 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:CHART_COLORS[i%CHART_COLORS.length], flexShrink:0 }} />
              <span style={{ flex:1, color:'#374151' }}>{c.name}</span>
              <span style={{ fontWeight:700, color:'#1a1a2a' }}>₹{fmtAmt(c.amount)}</span>
            </div>
          ))}

          {/* Budget utilisation list */}
          {catBreakdown.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', margin:'14px 0 8px', fontFamily:'DM Sans' }}>
                Budget Utilisation
              </div>
              {catBreakdown.map(c => {
                const pct    = c.budget ? Math.min((c.amount / c.budget) * 100, 120) : 0
                const fill   = c.budget ? (c.amount >= c.budget ? '#dc2626' : c.amount >= c.budget * 0.75 ? '#f59e0b' : '#10b981') : '#94a3b8'
                return (
                  <div key={c.id} className="ea-cat-row">
                    <span className="ea-cat-icon">{c.icon}</span>
                    <div className="ea-cat-info">
                      <div className="ea-cat-name">{c.name}</div>
                      {c.budget > 0 ? (
                        <>
                          <div className="ea-cat-budget">
                            {masked ? '₹ ••••' : `₹${fmtAmt(c.amount)}`} / ₹{fmtAmt(c.budget)} ({masked ? '••' : `${Math.round((c.amount/c.budget)*100)}`}%)
                          </div>
                          <div className="ea-cat-pbar-bg">
                            <div className="ea-cat-pbar-fill" style={{ width:`${masked ? 100 : Math.min(pct, 100)}%`, background: masked ? '#e2e8f0' : fill }} />
                          </div>
                        </>
                      ) : (
                        <div className="ea-cat-budget" style={{ color:'#94a3b8' }}>No limit set</div>
                      )}
                    </div>
                    <div className="ea-cat-amt">{masked ? '••••' : `₹${fmtAmt(c.amount)}`}</div>
                  </div>
                )
              })}
            </>
          )}

          {catBreakdown.length === 0 && (
            <div style={{ textAlign:'center', color:'#94a3b8', fontSize:13, fontFamily:'DM Sans', padding:'20px 0' }}>
              No expense data for this period.
            </div>
          )}
        </div>

        {/* ── Section E: Monthly trend (always last 6 months) ─────────── */}
        <div className="ea-card">
          <div className="ea-card-title">📈 Monthly Trend — Last 6 Months</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend} barGap={2} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fontFamily:'DM Sans', fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontFamily:'DM Sans', fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={mkTooltip(masked)} />
              <Legend wrapperStyle={{ fontFamily:'DM Sans', fontSize:12 }} />
              <Bar dataKey="income"  name="Income"  fill={masked ? '#e2e8f0' : '#10b981'} radius={[4,4,0,0]} />
              <Bar dataKey="expense" name="Expense" fill={masked ? '#e2e8f0' : '#dc2626'} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Section F: Payment source split ─────────────────────────── */}
        {sourceSplit.length > 0 && (
          <div className="ea-card">
            <div className="ea-card-title">💳 Payment Source Split</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={sourcePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" stroke="none">
                  {sourcePieData.map((entry, i) => (
                    <Cell key={i} fill={masked ? '#e2e8f0' : (SOURCE_COLORS[entry.type] || CHART_COLORS[i % CHART_COLORS.length])} />
                  ))}
                </Pie>
                {!masked && <Tooltip content={mkTooltip(masked)} />}
              </PieChart>
            </ResponsiveContainer>
            <div className="ea-src-legend">
              {sourceSplit.map(s => (
                <div key={s.id} className="ea-src-legend-row">
                  <div className="ea-src-legend-left">
                    <div className="ea-src-legend-dot" style={{ background: masked ? '#e2e8f0' : (SOURCE_COLORS[s.type] || '#94a3b8') }} />
                    <span>{SOURCE_ICONS[s.type]} {s.name}</span>
                  </div>
                  <div className="ea-src-legend-right">
                    {masked ? '₹ ••••' : `₹${fmtAmt(s.amount)}`}
                    <span className="ea-src-legend-pct">{masked ? '' : `${Math.round(s.pct)}%`}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section G: 12-month cash outflow projection ──────────────── */}
        <div className="ea-card">
          <div className="ea-card-title">📅 12-Month Cash Outflow Projection</div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={projectionData} barGap={0} barCategoryGap="25%">
              <XAxis dataKey="month" tick={{ fontFamily:'DM Sans', fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontFamily:'DM Sans', fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={mkTooltip(masked)} />
              <Legend wrapperStyle={{ fontFamily:'DM Sans', fontSize:12 }} />
              <Bar dataKey="committed" name="Committed"   stackId="a" fill={masked ? '#e2e8f0' : '#1A3C6E'} radius={[0,0,0,0]} />
              <Bar dataKey="variable"  name="Est. Variable" stackId="a" fill={masked ? '#e2e8f0' : '#93c5fd'} radius={[3,3,0,0]} />
              <Line type="monotone" dataKey="total" name="Total" stroke={masked ? '#e2e8f0' : '#dc2626'} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Projection table */}
          <div style={{ overflowX:'auto' }}>
            <table className="ea-proj-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Committed</th>
                  <th>Variable</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {projectionData.map(row => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{masked ? '••••' : `₹${fmtAmt(row.committed)}`}</td>
                    <td>{masked ? '••••' : `₹${fmtAmt(row.variable)}`}</td>
                    <td style={{ color:'#dc2626', fontWeight:700 }}>{masked ? '••••' : `₹${fmtAmt(row.total)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section H: Subscription Audit ───────────────────────────── */}
        {subscriptions.length > 0 && (
          <div className="ea-card">
            <div className="ea-card-title">📱 Subscription Audit</div>
            <div className="ea-sub-summary">
              <strong>{subscriptions.length}</strong> active subscription{subscriptions.length !== 1 ? 's' : ''} ·{' '}
              {masked ? '₹ ••••' : `₹${fmtAmt(Math.round(subscriptionMonthlyTotal))}`}/mo ·{' '}
              {masked ? '₹ ••••' : `₹${fmtAmt(Math.round(subscriptionAnnualTotal))}`}/yr
            </div>

            {subscriptions.map(r => {
              const cat      = categories.find(c => c.id === r.category_id)
              const busy     = deactivating === r.id
              const freqLabel = r.frequency === 'monthly' ? '/mo'
                : r.frequency === 'yearly'  ? '/yr'
                : r.frequency === 'weekly'  ? '/wk'
                : '/day'
              return (
                <div key={r.id} className="ea-sub-row">
                  <span className="ea-sub-icon">{cat ? cat.icon_code : '📱'}</span>
                  <div className="ea-sub-info">
                    <div className="ea-sub-name">{r.item_name}</div>
                    <div className="ea-sub-meta">
                      {r.due_date_next ? `Next: ${r.due_date_next}` : 'No next date'}{cat ? ` · ${cat.category_name}` : ''}
                    </div>
                    <div className="ea-sub-annual">
                      Annual cost: {masked ? '₹ ••••' : `₹${fmtAmt(Math.round(r.monthly * 12))}`}
                    </div>
                  </div>
                  <div className="ea-sub-right">
                    <div className="ea-sub-amount">{masked ? '₹ ••••' : `₹${fmtAmt(r.amount)}`}</div>
                    <div className="ea-sub-freq">{freqLabel}</div>
                    {updateRecurringItem && (
                      <button className="ea-sub-deactivate" disabled={busy} onClick={() => handleDeactivate(r)}>
                        {busy ? '…' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="ea-sub-highlight">
              <div className="ea-sub-hl-label">Total subscription spend</div>
              <div className="ea-sub-hl-amounts">
                {masked ? '₹ ••••' : `₹${fmtAmt(Math.round(subscriptionMonthlyTotal))}`} / month{' '}
                <span style={{ color:'#94a3b8', fontWeight:400, fontSize:14 }}>·</span>{' '}
                {masked ? '₹ ••••' : `₹${fmtAmt(Math.round(subscriptionAnnualTotal))}`} / year
              </div>
              <div className="ea-sub-hl-note">
                That's {masked ? '₹ ••••' : `₹${fmtAmt(Math.round(subscriptionMonthlyTotal))}`} of your monthly budget committed to subscriptions
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
