import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const RED  = '#ef4444'
const FONT = "'Plus Jakarta Sans', sans-serif"
const PAGE_SIZE = 100

// ── TX type metadata ──────────────────────────────────────────────────────────

const TX_META = {
  PURCHASE:   { label: 'Purchase',   short: 'Buy',    color: ACC,       bg: `${ACC}18` },
  SWITCH_IN:  { label: 'Switch In',  short: 'Sw In',  color: '#0891b2', bg: '#e0f2fe'  },
  SWITCH_OUT: { label: 'Switch Out', short: 'Sw Out', color: '#f97316', bg: '#fff7ed'  },
  REDEMPTION: { label: 'Sell',       short: 'Sell',   color: RED,       bg: '#fee2e2'  },
  DIVIDEND:   { label: 'IDCW',       short: 'IDCW',   color: '#7c3aed', bg: '#ede9fe'  },
}

// ── Category classifier ───────────────────────────────────────────────────────

function classifyScheme(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('gold') || n.includes('silver')) return 'Gold'
  if (n.includes('liquid') || n.includes('overnight') || n.includes('money market')) return 'Liquid'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('multi asset') ||
      n.includes('arbitrage') || n.includes('asset alloc') || n.includes('equity savings')) return 'Hybrid'
  if (n.includes('debt') || n.includes('bond') || n.includes('gilt') ||
      n.includes('duration') || n.includes('credit') || n.includes('income') ||
      n.includes('banking & psu') || n.includes('corporate')) return 'Debt'
  if (n.includes('equity') || n.includes('large cap') || n.includes('mid cap') ||
      n.includes('small cap') || n.includes('flexi cap') || n.includes('multi cap') ||
      n.includes('nifty') || n.includes('sensex') || n.includes('index') ||
      n.includes('elss') || n.includes('tax saver') || n.includes('focused') ||
      n.includes('thematic') || n.includes('sectoral') || n.includes('value') ||
      n.includes('contra')) return 'Equity'
  return 'Other'
}

function isEquityLike(cat) { return cat === 'Equity' || cat === 'Hybrid' }

// ── Tax helpers ───────────────────────────────────────────────────────────────

const DEBT_RULE_DATE = '2023-04-01'

function taxCatInfo(category, holdDays, firstDate) {
  if (isEquityLike(category)) {
    return holdDays > 365
      ? { label: 'LTCG', color: '#16a34a', bg: '#dcfce7' }
      : { label: 'STCG', color: '#dc2626', bg: '#fee2e2' }
  }
  const pDate = firstDate ? new Date(firstDate) : null
  if (pDate && pDate < new Date(DEBT_RULE_DATE) && holdDays > 1095) {
    return { label: 'LTCG (Debt)', color: '#7c3aed', bg: '#ede9fe' }
  }
  return { label: 'Slab Rate', color: '#d97706', bg: '#fef3c7' }
}

// ── FY helpers ────────────────────────────────────────────────────────────────

function fyStartYear(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}

function fyLabel(y) {
  return `FY ${y}-${String(y + 1).slice(-2)}`
}

function currentFYStartYear() { return fyStartYear(new Date().toISOString()) }

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sgn = n < 0 ? '-₹' : '₹'
  if (abs >= 1e7) return sgn + (abs / 1e7).toFixed(2) + ' Cr'
  if (abs >= 1e5) return sgn + (abs / 1e5).toFixed(2) + ' L'
  return sgn + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${dd} ${mon} ${d.getFullYear()}`
}

function fmtUnits(n) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

function fmtNav(n) {
  if (n == null || isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function fmtPeriod(days) {
  if (!days) return '—'
  if (days < 30)  return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}yr`
}

// ── Build enriched transaction list ──────────────────────────────────────────
// Replays avg-cost per holding; yields one row per transaction with gain fields
// for redemptions and null gain for purchases / dividends.

function buildAllTransactions(activeHoldings) {
  const rows = []
  for (const h of activeHoldings) {
    const txs = [...(h.transactions ?? [])]
      .filter(tx => tx.date)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

    const category = classifyScheme(h.scheme_name)
    let runUnits = 0, runCost = 0

    for (const tx of txs) {
      const txUnits  = tx.units  ?? 0
      const txAmount = tx.amount ?? 0
      const fyStart  = fyStartYear(tx.date)

      const base = {
        date:                  tx.date,
        fy_start:              fyStart,
        scheme_name:           h.scheme_name,
        amc:                   h.amc,
        plan:                  h.plan,
        folio:                 h.folio,
        category,
        first_investment_date: h.first_investment_date,
        type:                  tx.type,
        units:                 txUnits,
        nav:                   tx.nav,
      }

      if (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') {
        runUnits += txUnits
        runCost  += txAmount
        rows.push({ ...base, amount: txAmount, gain: null, avg_cost_nav: null, cost: null, holding_days: null, status: 'unrealised' })

      } else if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
        if (txUnits <= 0) continue
        const avgCostNav = runUnits > 0 ? runCost / runUnits : 0
        const proceeds   = txAmount > 0 ? txAmount : (txUnits * (tx.nav ?? avgCostNav))
        const cost       = txUnits * avgCostNav
        const gain       = proceeds - cost

        const firstDate = h.first_investment_date ? new Date(h.first_investment_date) : null
        const saleDate  = new Date(tx.date)
        const holdDays  = firstDate ? Math.max(0, Math.floor((saleDate - firstDate) / 86400000)) : 0

        rows.push({ ...base, amount: proceeds, gain, avg_cost_nav: avgCostNav, cost, holding_days: holdDays, status: 'realised' })

        runCost  = Math.max(0, runCost - cost)
        runUnits = Math.max(0, runUnits - txUnits)

      } else if (tx.type === 'DIVIDEND') {
        rows.push({ ...base, amount: txAmount, gain: null, avg_cost_nav: null, cost: null, holding_days: null, status: 'idcw' })
      }
    }
  }
  return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

// ── Portfolio selector ────────────────────────────────────────────────────────

function PortfolioSelector({ portfolios, selectedId, onChange }) {
  return (
    <div style={s.selectorRow}>
      <label style={s.selectorLabel}>Portfolio</label>
      <select style={s.selector} value={selectedId ?? ''} onChange={e => onChange(e.target.value)}>
        {portfolios.map(p => {
          const count = (p.holdings ?? []).filter(h => h.units > 0).length
          return (
            <option key={p.portfolio_id} value={p.portfolio_id}>
              {p.name}{count > 0 ? ` · ${count} schemes` : ' (no data yet)'}
            </option>
          )
        })}
      </select>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, valueColor, sub, subColor }) {
  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color: valueColor ?? '#0d3d2b' }}>{value}</div>
      {sub && <div style={{ ...s.metricSub, color: subColor ?? '#9ca3af' }}>{sub}</div>}
    </div>
  )
}

// ── Transaction table ─────────────────────────────────────────────────────────

function TransactionTable({ rows, mobile, page, onLoadMore }) {
  const visible = rows.slice(0, page * PAGE_SIZE)
  const hasMore = rows.length > visible.length

  if (rows.length === 0) {
    return <div style={s.noData}>No transactions match the current filters.</div>
  }

  return (
    <div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Date</th>
              <th style={s.th}>Scheme</th>
              <th style={{ ...s.th, textAlign: 'center' }}>Type</th>
              {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Units</th>}
              {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>NAV</th>}
              <th style={{ ...s.th, textAlign: 'right' }}>Amount</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Gain / Loss</th>
              {!mobile && <th style={{ ...s.th, textAlign: 'center' }}>Period</th>}
              {!mobile && <th style={{ ...s.th, textAlign: 'center' }}>Tax</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const meta    = TX_META[row.type] ?? TX_META.PURCHASE
              const gc      = row.gain == null ? '#9ca3af' : row.gain >= 0 ? ACC : RED
              const taxInfo = (row.status === 'realised' && row.gain != null)
                ? taxCatInfo(row.category, row.holding_days, row.first_investment_date)
                : null

              return (
                <tr key={i} style={i % 2 !== 0 ? s.trAlt : {}}>
                  {/* Date */}
                  <td style={{ ...s.td, whiteSpace: 'nowrap', color: '#6b7280', fontSize: 11 }}>
                    {fmtDate(row.date)}
                    {!mobile && (
                      <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 1 }}>
                        {row.fy_start ? fyLabel(row.fy_start) : ''}
                      </div>
                    )}
                  </td>

                  {/* Scheme */}
                  <td style={s.td}>
                    <div style={s.schemeName}>{row.scheme_name}</div>
                    <div style={s.schemeMeta}>
                      <span style={{
                        ...s.chip,
                        background: row.plan === 'Direct' ? `${ACC}18` : '#f3f4f6',
                        color: row.plan === 'Direct' ? ACC : '#6b7280',
                      }}>
                        {row.plan}
                      </span>
                      <span style={s.amcName}>{row.amc}</span>
                    </div>
                  </td>

                  {/* Type chip */}
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={{ ...s.chip, background: meta.bg, color: meta.color }}>
                      {mobile ? meta.short : meta.label}
                    </span>
                  </td>

                  {/* Units */}
                  {!mobile && (
                    <td style={{ ...s.tdR, color: '#6b7280', fontSize: 12 }}>
                      {fmtUnits(row.units)}
                    </td>
                  )}

                  {/* NAV */}
                  {!mobile && (
                    <td style={{ ...s.tdR, color: '#6b7280', fontSize: 12 }}>
                      {fmtNav(row.nav)}
                    </td>
                  )}

                  {/* Amount */}
                  <td style={{ ...s.tdR, fontWeight: 600 }}>
                    {fmtINR(row.amount)}
                  </td>

                  {/* Gain / Loss */}
                  <td style={{ ...s.tdR, color: gc, fontWeight: row.gain != null ? 600 : 400 }}>
                    {row.gain != null
                      ? (row.gain >= 0 ? '+' : '') + fmtINR(row.gain)
                      : <span style={{ color: '#d1d5db' }}>—</span>
                    }
                  </td>

                  {/* Period */}
                  {!mobile && (
                    <td style={{ ...s.td, textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                      {row.holding_days != null ? fmtPeriod(row.holding_days) : '—'}
                    </td>
                  )}

                  {/* Tax badge */}
                  {!mobile && (
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {taxInfo
                        ? <span style={{ ...s.chip, background: taxInfo.bg, color: taxInfo.color }}>{taxInfo.label}</span>
                        : <span style={{ color: '#e5e7eb' }}>—</span>
                      }
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Load more / row count strip */}
      <div style={s.footerStrip}>
        <span style={{ color: '#9ca3af' }}>
          Showing {visible.length} of {rows.length} transaction{rows.length !== 1 ? 's' : ''}
        </span>
        {hasMore && (
          <button style={s.loadMoreBtn} onClick={onLoadMore}>
            Load {Math.min(PAGE_SIZE, rows.length - visible.length)} more
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function E8TransactionReport() {
  const width    = useWindowWidth()
  const navigate = useNavigate()
  const mobile   = width < 768

  const [portfolios]  = useState(getPortfolios)
  const [selectedId,  setSelectedId]  = useState(() => portfolios[0]?.portfolio_id ?? null)
  const [fyFilter,    setFyFilter]    = useState(() => String(currentFYStartYear()))
  const [typeFilter,  setTypeFilter]  = useState('all')
  const [search,      setSearch]      = useState('')
  const [page,        setPage]        = useState(1)

  const portfolio = useMemo(
    () => portfolios.find(p => p.portfolio_id === selectedId) ?? null,
    [portfolios, selectedId]
  )

  const activeHoldings = useMemo(
    () => (portfolio?.holdings ?? []).filter(h => h.units > 0),
    [portfolio]
  )

  // All enriched transactions (sorted newest first)
  const allTxns = useMemo(
    () => buildAllTransactions(activeHoldings),
    [activeHoldings]
  )

  // FY options for filter dropdown
  const fyOptions = useMemo(() => {
    const years = [...new Set(allTxns.map(t => String(t.fy_start)).filter(Boolean))].sort().reverse()
    return years
  }, [allTxns])

  // Portfolio-level summary (over all time, all types)
  const summary = useMemo(() => {
    let totalInvested = 0, totalRedeemed = 0, realisedGain = 0, totalDividend = 0, txCount = 0
    for (const t of allTxns) {
      txCount++
      if (t.type === 'PURCHASE' || t.type === 'SWITCH_IN')     totalInvested  += t.amount ?? 0
      if (t.type === 'REDEMPTION' || t.type === 'SWITCH_OUT')  totalRedeemed  += t.amount ?? 0
      if (t.gain != null)                                       realisedGain   += t.gain
      if (t.type === 'DIVIDEND')                               totalDividend  += t.amount ?? 0
    }
    return { totalInvested, totalRedeemed, realisedGain, totalDividend, txCount }
  }, [allTxns])

  // Filtered transactions
  const filtered = useMemo(() => {
    let rows = allTxns

    if (fyFilter !== 'all') {
      rows = rows.filter(t => String(t.fy_start) === fyFilter)
    }

    if (typeFilter === 'buy') {
      rows = rows.filter(t => t.type === 'PURCHASE' || t.type === 'SWITCH_IN')
    } else if (typeFilter === 'sell') {
      rows = rows.filter(t => t.type === 'REDEMPTION' || t.type === 'SWITCH_OUT')
    } else if (typeFilter === 'dividend') {
      rows = rows.filter(t => t.type === 'DIVIDEND')
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(t =>
        (t.scheme_name ?? '').toLowerCase().includes(q) ||
        (t.amc ?? '').toLowerCase().includes(q)
      )
    }

    return rows
  }, [allTxns, fyFilter, typeFilter, search])

  // Reset pagination when filters change
  const handleFyChange = v => { setFyFilter(v); setPage(1) }
  const handleTypeChange = v => { setTypeFilter(v); setPage(1) }
  const handleSearch = v => { setSearch(v); setPage(1) }

  // ── Empty states ───────────────────────────────────────────────────────────
  if (portfolios.length === 0) {
    return (
      <div style={s.emptyWrap}>
        <div style={s.emptyIcon}>📋</div>
        <h2 style={s.emptyTitle}>No portfolios yet</h2>
        <p style={s.emptySub}>Add your CAMS or KFin statement in the Data Manager to get started.</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
          Go to Data Manager
        </button>
      </div>
    )
  }

  if (activeHoldings.length === 0) {
    return (
      <div>
        {portfolios.length > 1 && (
          <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
        )}
        <div style={s.emptyWrap}>
          <div style={s.emptyIcon}>📋</div>
          <h2 style={s.emptyTitle}>No holdings data</h2>
          <p style={s.emptySub}>Upload your CAMS and KFin files in the Data Manager to load holdings.</p>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
            Go to Data Manager
          </button>
        </div>
      </div>
    )
  }

  const TYPE_PILLS = [
    { id: 'all',      label: 'All' },
    { id: 'buy',      label: 'Purchases' },
    { id: 'sell',     label: 'Sells' },
    { id: 'dividend', label: 'IDCW' },
  ]

  return (
    <div>
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Transaction Report</h1>
        <p style={s.pageSub}>
          {portfolio.name} · {summary.txCount} transactions across all schemes
        </p>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: '1.25rem',
      }}>
        <MetricCard
          label="Total Invested"
          value={fmtINR(summary.totalInvested)}
          valueColor={ACC}
          sub={`Purchases + switch-ins`}
          subColor="#9ca3af"
        />
        <MetricCard
          label="Total Redeemed"
          value={fmtINR(summary.totalRedeemed)}
          valueColor="#374151"
          sub="Redemptions + switch-outs"
          subColor="#9ca3af"
        />
        <MetricCard
          label="Realised Gain"
          value={summary.realisedGain >= 0
            ? `+${fmtINR(summary.realisedGain)}`
            : fmtINR(summary.realisedGain)
          }
          valueColor={summary.realisedGain >= 0 ? ACC : RED}
          sub="Avg-cost basis · all years"
          subColor="#9ca3af"
        />
        <MetricCard
          label="IDCW Received"
          value={fmtINR(summary.totalDividend)}
          valueColor={summary.totalDividend > 0 ? '#7c3aed' : '#9ca3af'}
          sub={summary.totalDividend > 0 ? 'Taxable at slab rate' : 'No dividends'}
          subColor="#9ca3af"
        />
      </div>

      {/* Filter bar */}
      <div style={s.filterBar}>
        {/* FY dropdown */}
        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Period</label>
          <select
            style={s.selector}
            value={fyFilter}
            onChange={e => handleFyChange(e.target.value)}
          >
            <option value="all">All years</option>
            {fyOptions.map(y => (
              <option key={y} value={y}>{fyLabel(Number(y))}</option>
            ))}
          </select>
        </div>

        {/* Type pills */}
        <div style={s.filterGroup}>
          <label style={s.filterLabel}>Type</label>
          <div style={s.pillGroup}>
            {TYPE_PILLS.map(p => (
              <button
                key={p.id}
                style={{
                  ...s.pill,
                  ...(typeFilter === p.id ? s.pillActive : {}),
                }}
                onClick={() => handleTypeChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ ...s.filterGroup, marginLeft: 'auto' }}>
          <input
            style={s.searchInput}
            placeholder="Search scheme or AMC…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Transaction table */}
      <div style={s.section}>
        <TransactionTable
          rows={filtered}
          mobile={mobile}
          page={page}
          onLoadMore={() => setPage(p => p + 1)}
        />
      </div>

      {/* Notes */}
      <div style={s.disclaimer}>
        <div style={s.disclaimerTitle}>Notes</div>
        <ul style={s.disclaimerList}>
          <li>Gain / Loss on sells is computed using the <strong>average-cost method</strong> — not FIFO. Actual per-lot gain may differ.</li>
          <li>Holding period is measured from the <strong>first investment date</strong> in that folio, not the specific lot purchase date.</li>
          <li>Switch-ins are treated as purchases; switch-outs as sells for gain computation.</li>
          <li>IDCW (dividends) received are taxable at your applicable slab rate regardless of fund type.</li>
          <li>Summary cards reflect all-time data; the table respects the period and type filters.</li>
        </ul>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Empty states
  emptyWrap:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', textAlign: 'center', padding: '2rem' },
  emptyIcon:  { fontSize: 48, marginBottom: '1rem' },
  emptyTitle: { fontFamily: FONT, fontSize: 20, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  emptySub:   { fontFamily: FONT, fontSize: 14, color: '#6b9e8d', lineHeight: 1.6, maxWidth: 360, margin: '0 0 1.5rem' },

  // Portfolio selector
  selectorRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' },
  selectorLabel: { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#6b7280' },
  selector:      { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#111827', padding: '6px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', outline: 'none' },

  // Page header
  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: FONT, fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.25rem' },
  pageSub:    { fontFamily: FONT, fontSize: 13, color: '#6b9e8d', margin: 0 },

  // Metric cards
  metricCard:  { background: '#fff', borderRadius: 14, border: `1px solid ${ACC}18`, padding: '1rem 1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  metricLabel: { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  metricValue: { fontFamily: FONT, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 },
  metricSub:   { fontFamily: FONT, fontSize: 11, marginTop: 6 },

  // Filter bar
  filterBar:   { display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1rem', flexWrap: 'wrap' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  filterLabel: { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#9ca3af', whiteSpace: 'nowrap' },

  // Type pills
  pillGroup:  { display: 'flex', gap: 4 },
  pill:       { fontFamily: FONT, fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' },
  pillActive: { background: `${ACC}12`, color: ACC, borderColor: `${ACC}40` },

  // Search input
  searchInput: { fontFamily: FONT, fontSize: 12, padding: '6px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', outline: 'none', color: '#374151', width: 200, background: '#fff' },

  // Section card
  section: { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },

  // Table
  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th:        { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10` },
  td:        { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  tdR:       { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  trAlt:     { background: '#fafffe' },
  schemeName:{ fontWeight: 600, color: '#111827', marginBottom: 3, lineHeight: 1.3, fontSize: 12 },
  schemeMeta:{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  chip:      { fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' },
  amcName:   { fontSize: 11, color: '#9ca3af' },

  // Footer strip
  footerStrip:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#fafafa', borderTop: `1px solid ${ACC}10`, fontFamily: FONT, fontSize: 11 },
  loadMoreBtn:  { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: ACC, background: 'none', border: `1.5px solid ${ACC}40`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer' },

  // No data
  noData: { fontFamily: FONT, fontSize: 13, color: '#9ca3af', padding: '2.5rem', textAlign: 'center' },

  // Disclaimer
  disclaimer:      { background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' },
  disclaimerTitle: { fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' },
  disclaimerList:  { fontFamily: FONT, fontSize: 12, color: '#6b7280', lineHeight: 1.8, margin: 0, paddingLeft: '1.25rem' },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: FONT, fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
