import { useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const WARN = '#ef4444'
const FONT = "'Plus Jakarta Sans', sans-serif"

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  return (n < 0 ? '-' : '') + '₹' + abs
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function fmtXirrPct(n) {
  if (n == null || isNaN(n)) return '—'
  return (n * 100).toFixed(2) + '%'
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
  return n.toLocaleString('en-IN', { maximumFractionDigits: 4 })
}

function fmtNav(n) {
  if (n == null || isNaN(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// ── Category classifier ───────────────────────────────────────────────────────

function classifyScheme(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('gold') || n.includes('silver')) return 'Gold'
  if (n.includes('liquid') || n.includes('overnight') || n.includes('money market')) return 'Liquid'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('multi asset') ||
      n.includes('arbitrage') || n.includes('asset alloc')) return 'Hybrid'
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

// ── Tax badge helper ──────────────────────────────────────────────────────────

function taxBadge(days) {
  if (days > 365) return { label: 'LTCG',      color: '#065f46', bg: '#d1fae5' }
  if (days > 180) return { label: 'Near LTCG', color: '#92400e', bg: '#fef3c7' }
  return              { label: 'STCG',          color: '#991b1b', bg: '#fee2e2' }
}

// ── Transaction type meta ────────────────────────────────────────────────────

const TX_META = {
  PURCHASE:   { label: 'Buy',        color: '#065f46', bg: '#d1fae5' },
  SWITCH_IN:  { label: 'Switch In',  color: '#0369a1', bg: '#dbeafe' },
  SWITCH_OUT: { label: 'Switch Out', color: '#9a3412', bg: '#ffedd5' },
  REDEMPTION: { label: 'Sell',       color: '#991b1b', bg: '#fee2e2' },
  DIVIDEND:   { label: 'Dividend',   color: '#5b21b6', bg: '#ede9fe' },
  REVERSAL:   { label: 'Reversal',   color: '#6b7280', bg: '#f3f4f6' },
}

function txMeta(type) {
  return TX_META[type] ?? { label: type, color: '#6b7280', bg: '#f3f4f6' }
}

// ── Category colors ───────────────────────────────────────────────────────────

const CAT_COLORS = {
  Equity: '#1D9E75', Debt: '#3b82f6', Hybrid: '#8b5cf6',
  Gold: '#f59e0b',   Liquid: '#06b6d4', Other: '#9ca3af',
}
const AMC_PAL = ['#1D9E75','#3b82f6','#8b5cf6','#f59e0b','#06b6d4',
                 '#ec4899','#f97316','#6366f1','#10b981','#ef4444']

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

// ── Transaction history tab ───────────────────────────────────────────────────

function TransactionHistory({ transactions, mobile }) {
  const sorted = [...(transactions ?? [])].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? '')
  )
  if (sorted.length === 0) {
    return <div style={s.noTx}>No transaction history available.</div>
  }
  return (
    <div style={s.txTableWrap}>
      <table style={s.txTable}>
        <thead>
          <tr>
            <th style={s.txTh}>Date</th>
            <th style={s.txTh}>Type</th>
            {!mobile && <th style={{ ...s.txTh, textAlign: 'right' }}>Amount (₹)</th>}
            <th style={{ ...s.txTh, textAlign: 'right' }}>Units</th>
            {!mobile && <th style={{ ...s.txTh, textAlign: 'right' }}>NAV (₹)</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((tx, i) => {
            const m = txMeta(tx.type)
            return (
              <tr key={i} style={i % 2 !== 0 ? { background: '#fafffe' } : {}}>
                <td style={s.txTd}>{fmtDate(tx.date)}</td>
                <td style={s.txTd}>
                  <span style={{
                    fontFamily: FONT, fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 5,
                    background: m.bg, color: m.color, letterSpacing: '0.03em',
                  }}>
                    {m.label}
                  </span>
                </td>
                {!mobile && (
                  <td style={{ ...s.txTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {tx.amount != null
                      ? tx.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                      : '—'}
                  </td>
                )}
                <td style={{ ...s.txTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtUnits(tx.units)}
                </td>
                {!mobile && (
                  <td style={{ ...s.txTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {tx.nav != null ? Number(tx.nav).toFixed(4) : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Holding detail panel ──────────────────────────────────────────────────────

function HoldingDetail({ holding, mobile }) {
  const [tab, setTab] = useState('detail')
  const badge = taxBadge(holding.holding_period_days)

  return (
    <div style={s.expandPanel}>
      <div style={s.expandTabs}>
        <button
          style={{ ...s.expandTab, ...(tab === 'detail' ? s.expandTabActive : {}) }}
          onClick={() => setTab('detail')}
        >
          Details
        </button>
        <button
          style={{ ...s.expandTab, ...(tab === 'tx' ? s.expandTabActive : {}) }}
          onClick={() => setTab('tx')}
        >
          Transactions ({(holding.transactions ?? []).length})
        </button>
      </div>

      {tab === 'detail' && (
        <div style={{
          ...s.detailGrid,
          gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        }}>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Units Held</div>
            <div style={s.detailValue}>{fmtUnits(holding.units)}</div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Avg Cost NAV</div>
            <div style={s.detailValue}>{fmtNav(holding.avg_cost_nav)}</div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Current NAV</div>
            <div style={s.detailValue}>{fmtNav(holding.current_nav)}</div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Unrealised Gain</div>
            <div style={{ ...s.detailValue, color: (holding.unrealised_gain ?? 0) >= 0 ? ACC : WARN }}>
              {holding.unrealised_gain != null ? fmtINR(holding.unrealised_gain) : '—'}
              {holding.unrealised_gain_pct != null && (
                <span style={{ fontSize: 11, marginLeft: 4 }}>
                  ({fmtPct(holding.unrealised_gain_pct)})
                </span>
              )}
            </div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>First Investment</div>
            <div style={s.detailValue}>{fmtDate(holding.first_investment_date)}</div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Days Held</div>
            <div style={{ ...s.detailValue, display: 'flex', alignItems: 'center', gap: 6 }}>
              {holding.holding_period_days}
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                background: badge.bg, color: badge.color, letterSpacing: '0.04em',
              }}>
                {badge.label}
              </span>
            </div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>XIRR</div>
            <div style={{
              ...s.detailValue,
              color: holding.xirr != null ? (holding.xirr >= 0 ? ACC : WARN) : '#374151',
            }}>
              {fmtXirrPct(holding.xirr)}
            </div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Plan / Option</div>
            <div style={s.detailValue}>{holding.plan} · {holding.option}</div>
          </div>
          <div style={s.detailItem}>
            <div style={s.detailLabel}>Folio</div>
            <div style={{ ...s.detailValue, fontSize: 12, color: '#6b7280' }}>{holding.folio ?? '—'}</div>
          </div>
          {holding.isin && (
            <div style={s.detailItem}>
              <div style={s.detailLabel}>ISIN</div>
              <div style={{ ...s.detailValue, fontSize: 12, color: '#6b7280', letterSpacing: '0.05em' }}>
                {holding.isin}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'tx' && (
        <TransactionHistory transactions={holding.transactions} mobile={mobile} />
      )}
    </div>
  )
}

// ── Holdings table ────────────────────────────────────────────────────────────

function HoldingsTable({ holdings, mobile, expandedKeys, onToggle }) {
  if (holdings.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: FONT, fontSize: 13, color: '#9ca3af' }}>
        No holdings match your filters.
      </div>
    )
  }

  const colSpan = mobile ? 5 : 7

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Scheme</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Invested</th>}
            <th style={{ ...s.th, textAlign: 'right' }}>Current</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Gain</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>XIRR</th>}
            <th style={{ ...s.th, textAlign: 'center' }}>Tax</th>
            <th style={{ ...s.th, width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const key    = `${h.scheme_name}|${h.folio}`
            const isOpen = expandedKeys.has(key)
            const gc     = (h.unrealised_gain ?? 0) >= 0 ? ACC : WARN
            const badge  = taxBadge(h.holding_period_days)
            const cat    = classifyScheme(h.scheme_name)

            return (
              <Fragment key={key}>
                <tr
                  style={{
                    ...(i % 2 !== 0 ? s.trAlt : {}),
                    cursor: 'pointer',
                    ...(isOpen ? { background: `${ACC}06`, borderTop: `2px solid ${ACC}20` } : {}),
                  }}
                  onClick={() => onToggle(key)}
                >
                  <td style={s.td}>
                    <div style={s.schemeName}>{h.scheme_name}</div>
                    <div style={s.schemeMeta}>
                      <span style={{
                        ...s.chip,
                        background: h.plan === 'Direct' ? `${ACC}18` : '#f3f4f6',
                        color:      h.plan === 'Direct' ? ACC : '#6b7280',
                      }}>
                        {h.plan}
                      </span>
                      <span style={{ ...s.chip, background: '#f3f4f6', color: '#6b7280' }}>{h.option}</span>
                      <span style={{
                        ...s.chip,
                        background: (CAT_COLORS[cat] ?? '#9ca3af') + '18',
                        color:      CAT_COLORS[cat] ?? '#6b7280',
                      }}>
                        {cat}
                      </span>
                      <span style={s.amcName}>{h.amc}</span>
                    </div>
                  </td>
                  {!mobile && (
                    <td style={s.tdR}>{fmtINR(h.invested_amount)}</td>
                  )}
                  <td style={s.tdR}>
                    {h.current_value != null ? fmtINR(h.current_value) : '—'}
                  </td>
                  <td style={{ ...s.tdR, color: gc, fontWeight: 600 }}>
                    {fmtPct(h.unrealised_gain_pct)}
                  </td>
                  {!mobile && (
                    <td style={{
                      ...s.tdR,
                      color: h.xirr != null ? (h.xirr >= 0 ? ACC : WARN) : '#9ca3af',
                    }}>
                      {fmtXirrPct(h.xirr)}
                    </td>
                  )}
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                      background: badge.bg, color: badge.color, letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', width: 36 }}>
                    <span style={{ color: ACC, fontSize: 11, userSelect: 'none' }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td
                      colSpan={colSpan}
                      style={{ padding: 0, borderBottom: `2px solid ${ACC}18`, background: `${ACC}04` }}
                    >
                      <HoldingDetail holding={h} mobile={mobile} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Exposure bar row ──────────────────────────────────────────────────────────

function ExposureRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div style={s.expRow}>
      <div style={s.expLabel} title={label}>{label}</div>
      <div style={s.expBarWrap}>
        <div style={{ ...s.expBar, width: `${pct.toFixed(1)}%`, background: color ?? ACC }} />
      </div>
      <div style={s.expValue}>{fmtINR(value)}</div>
      <div style={s.expPct}>{pct.toFixed(1)}%</div>
    </div>
  )
}

// ── Exposure summary section ──────────────────────────────────────────────────

function ExposureSummary({ holdings, mobile }) {
  const totalInvested = holdings.reduce((s, h) => s + (h.invested_amount ?? 0), 0)

  const byCat = useMemo(() => {
    const map = {}
    for (const h of holdings) {
      const c = classifyScheme(h.scheme_name)
      map[c] = (map[c] ?? 0) + (h.invested_amount ?? 0)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [holdings])

  const byAmc = useMemo(() => {
    const map = {}
    for (const h of holdings) {
      const a = h.amc || 'Unknown'
      map[a] = (map[a] ?? 0) + (h.invested_amount ?? 0)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [holdings])

  const planMap = useMemo(() => ({
    Direct:  holdings.filter(h => h.plan === 'Direct').reduce((s, h) => s + (h.invested_amount ?? 0), 0),
    Regular: holdings.filter(h => h.plan === 'Regular').reduce((s, h) => s + (h.invested_amount ?? 0), 0),
  }), [holdings])

  const optionMap = useMemo(() => ({
    Growth: holdings.filter(h => h.option === 'Growth').reduce((s, h) => s + (h.invested_amount ?? 0), 0),
    IDCW:   holdings.filter(h => h.option === 'IDCW').reduce((s, h) => s + (h.invested_amount ?? 0), 0),
  }), [holdings])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)',
      gap: 12,
    }}>
      {/* By Category */}
      <div style={s.expSection}>
        <div style={s.expTitle}>By Category</div>
        {byCat.map(([cat, val]) => (
          <ExposureRow
            key={cat} label={cat} value={val} total={totalInvested}
            color={CAT_COLORS[cat] ?? '#9ca3af'}
          />
        ))}
      </div>

      {/* By AMC */}
      <div style={s.expSection}>
        <div style={s.expTitle}>
          By AMC{byAmc.length >= 10 ? ' (top 10)' : ''}
        </div>
        {byAmc.map(([amc, val], i) => (
          <ExposureRow
            key={amc} label={amc} value={val} total={totalInvested}
            color={AMC_PAL[i % AMC_PAL.length]}
          />
        ))}
      </div>

      {/* Plan & Option */}
      <div style={s.expSection}>
        <div style={s.expTitle}>Plan & Option</div>
        <div style={s.expSubTitle}>Plan</div>
        {Object.entries(planMap).map(([k, v]) => (
          <ExposureRow
            key={k} label={k} value={v} total={totalInvested}
            color={k === 'Direct' ? ACC : '#9ca3af'}
          />
        ))}
        <div style={{ ...s.expSubTitle, marginTop: 12 }}>Option</div>
        {Object.entries(optionMap).map(([k, v]) => (
          <ExposureRow
            key={k} label={k} value={v} total={totalInvested}
            color={k === 'Growth' ? '#3b82f6' : '#8b5cf6'}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function E3Holdings() {
  const width    = useWindowWidth()
  const navigate = useNavigate()
  const mobile   = width < 768

  const [portfolios]  = useState(getPortfolios)
  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)

  const portfolio = useMemo(
    () => portfolios.find(p => p.portfolio_id === selectedId) ?? null,
    [portfolios, selectedId]
  )

  const activeHoldings = useMemo(
    () => (portfolio?.holdings ?? []).filter(h => h.units > 0),
    [portfolio]
  )

  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('All')
  const [amcFilter,  setAmcFilter]  = useState('All')
  const [planFilter, setPlanFilter] = useState('All')
  const [expandedKeys, setExpandedKeys] = useState(new Set())

  const onToggle = key => setExpandedKeys(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const categories = useMemo(() => {
    const cats = new Set(activeHoldings.map(h => classifyScheme(h.scheme_name)))
    return ['All', ...['Equity','Debt','Hybrid','Gold','Liquid','Other'].filter(c => cats.has(c))]
  }, [activeHoldings])

  const amcs = useMemo(() => {
    const set = new Set(activeHoldings.map(h => h.amc).filter(Boolean))
    return ['All', ...[...set].sort()]
  }, [activeHoldings])

  const filtered = useMemo(() => {
    let res = activeHoldings
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      res = res.filter(h =>
        h.scheme_name.toLowerCase().includes(q) ||
        (h.amc ?? '').toLowerCase().includes(q)
      )
    }
    if (catFilter !== 'All') res = res.filter(h => classifyScheme(h.scheme_name) === catFilter)
    if (amcFilter !== 'All') res = res.filter(h => h.amc === amcFilter)
    if (planFilter !== 'All') res = res.filter(h => h.plan === planFilter)
    return res
  }, [activeHoldings, search, catFilter, amcFilter, planFilter])

  const hasFilter = search || catFilter !== 'All' || amcFilter !== 'All' || planFilter !== 'All'

  const clearFilters = () => {
    setSearch(''); setCatFilter('All'); setAmcFilter('All'); setPlanFilter('All')
  }

  // ── No portfolios ─────────────────────────────────────────────────────────
  if (portfolios.length === 0) {
    return (
      <div style={s.emptyWrap}>
        <div style={s.emptyIcon}>📊</div>
        <h2 style={s.emptyTitle}>No portfolios yet</h2>
        <p style={s.emptySub}>Add your CAMS or KFin statement in the Data Manager to get started.</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
          Go to Data Manager
        </button>
      </div>
    )
  }

  // ── No holdings ───────────────────────────────────────────────────────────
  if (activeHoldings.length === 0) {
    return (
      <div>
        {portfolios.length > 1 && (
          <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
        )}
        <div style={s.emptyWrap}>
          <div style={s.emptyIcon}>📋</div>
          <h2 style={s.emptyTitle}>No holdings data</h2>
          <p style={s.emptySub}>
            {portfolio?.status === 'pending'
              ? 'Upload your CAMS and KFin files in the Data Manager to load holdings.'
              : 'No active holdings found in this portfolio.'}
          </p>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
            Go to Data Manager
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Holdings & Exposure</h1>
        <p style={s.pageSub}>
          {activeHoldings.length} active scheme{activeHoldings.length !== 1 ? 's' : ''} · {portfolio.name}
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ ...s.filterBar, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
        <input
          style={s.searchInput}
          placeholder="Search scheme or AMC…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={s.filterSelect} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {categories.map(c => (
            <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
          ))}
        </select>
        <select style={s.filterSelect} value={amcFilter} onChange={e => setAmcFilter(e.target.value)}>
          {amcs.map(a => (
            <option key={a} value={a}>{a === 'All' ? 'All AMCs' : a}</option>
          ))}
        </select>
        <select style={s.filterSelect} value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
          <option value="All">All Plans</option>
          <option value="Direct">Direct</option>
          <option value="Regular">Regular</option>
        </select>
        {hasFilter && filtered.length !== activeHoldings.length && (
          <span style={s.filterCount}>{filtered.length} of {activeHoldings.length}</span>
        )}
        {hasFilter && (
          <button style={s.clearBtn} onClick={clearFilters}>Clear</button>
        )}
      </div>

      {/* Holdings table */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>
            {filtered.length} Holding{filtered.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: '#9ca3af' }}>
            Click any row to expand
          </span>
        </div>
        <HoldingsTable
          holdings={filtered}
          mobile={mobile}
          expandedKeys={expandedKeys}
          onToggle={onToggle}
        />
      </div>

      {/* Exposure summary — always shows full portfolio, not filtered */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Exposure Summary</span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: '#9ca3af' }}>
            By invested amount · full portfolio
          </span>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <ExposureSummary holdings={activeHoldings} mobile={mobile} />
        </div>
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

  // Filter bar
  filterBar:   { display: 'flex', gap: 8, marginBottom: '1rem', alignItems: 'center' },
  searchInput: { flex: 1, minWidth: 160, fontFamily: FONT, fontSize: 13, padding: '7px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', outline: 'none', color: '#111827' },
  filterSelect:{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#374151', padding: '7px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', outline: 'none' },
  filterCount: { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: ACC, whiteSpace: 'nowrap' },
  clearBtn:    { fontFamily: FONT, fontSize: 12, fontWeight: 700, color: WARN, background: '#fee2e2', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' },

  // Section container
  section:       { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: `1px solid ${ACC}10` },
  sectionTitle:  { fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#0d3d2b', letterSpacing: '0.01em' },

  // Holdings table
  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th:        { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10` },
  td:        { fontSize: 13, color: '#374151', padding: '10px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  tdR:       { fontSize: 13, color: '#374151', padding: '10px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  trAlt:     { background: '#fafffe' },
  schemeName:{ fontWeight: 600, color: '#111827', marginBottom: 3, lineHeight: 1.3 },
  schemeMeta:{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  chip:      { fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' },
  amcName:   { fontSize: 11, color: '#9ca3af' },

  // Expanded row panel
  expandPanel:     { padding: '0.875rem 1.25rem 1rem' },
  expandTabs:      { display: 'flex', gap: 2, marginBottom: '0.875rem', borderBottom: `1px solid ${ACC}12` },
  expandTab:       { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 14px', borderRadius: '8px 8px 0 0', marginBottom: -1 },
  expandTabActive: { color: ACC, borderBottom: `2px solid ${ACC}`, background: `${ACC}08` },

  // Detail grid
  detailGrid:  { display: 'grid', gap: 8 },
  detailItem:  { background: '#fafffe', borderRadius: 10, padding: '8px 12px', border: `1px solid ${ACC}10` },
  detailLabel: { fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  detailValue: { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: '#111827' },

  // Transaction table
  txTableWrap: { overflowX: 'auto', maxHeight: 300, overflowY: 'auto' },
  txTable:     { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  txTh:        { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 10px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10`, position: 'sticky', top: 0 },
  txTd:        { fontSize: 12, color: '#374151', padding: '7px 10px', borderBottom: '1px solid #f3f4f6' },
  noTx:        { fontFamily: FONT, fontSize: 13, color: '#9ca3af', padding: '1.25rem', textAlign: 'center' },

  // Exposure summary
  expSection:  { background: '#fafffe', borderRadius: 12, border: `1px solid ${ACC}10`, padding: '1rem' },
  expTitle:    { fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#0d3d2b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' },
  expSubTitle: { fontFamily: FONT, fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' },
  expRow:      { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 },
  expLabel:    { fontFamily: FONT, fontSize: 11, color: '#374151', fontWeight: 500, minWidth: 72, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  expBarWrap:  { flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  expBar:      { height: '100%', borderRadius: 3, minWidth: 2, transition: 'width 0.4s ease' },
  expValue:    { fontFamily: FONT, fontSize: 10, color: '#6b7280', minWidth: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  expPct:      { fontFamily: FONT, fontSize: 10, fontWeight: 700, color: '#374151', minWidth: 38, textAlign: 'right' },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: FONT, fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
