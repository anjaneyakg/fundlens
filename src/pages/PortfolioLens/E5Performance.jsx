import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const FONT = "'Plus Jakarta Sans', sans-serif"

// ── Performance tiers ─────────────────────────────────────────────────────────

const TIERS = [
  { key: 'stellar',  label: 'Stellar',  icon: '⭐', minXirr:  0.20, color: '#7c3aed', bg: '#ede9fe' },
  { key: 'strong',   label: 'Strong',   icon: '📈', minXirr:  0.12, color: '#16a34a', bg: '#dcfce7' },
  { key: 'average',  label: 'Average',  icon: '〜', minXirr:  0.06, color: '#d97706', bg: '#fef3c7' },
  { key: 'weak',     label: 'Weak',     icon: '📉', minXirr:  0.00, color: '#ea580c', bg: '#ffedd5' },
  { key: 'negative', label: 'Negative', icon: '⚠', minXirr: -Infinity, color: '#dc2626', bg: '#fee2e2' },
]

function tierFor(xirr) {
  if (xirr == null) return null
  for (const t of TIERS) if (xirr >= t.minXirr) return t
  return TIERS[TIERS.length - 1]
}

// ── Category classifier ───────────────────────────────────────────────────────

const CAT_COLORS = {
  Equity: '#1D9E75', Debt: '#3b82f6', Hybrid: '#8b5cf6',
  Gold: '#f59e0b',   Liquid: '#06b6d4', Other: '#9ca3af',
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  return (n < 0 ? '-₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtPct(n, showSign = true) {
  if (n == null || isNaN(n)) return '—'
  return (showSign && n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

function fmtXirr(n) {
  if (n == null || isNaN(n)) return '—'
  return (n * 100).toFixed(2) + '%'
}

function fmtPeriod(days) {
  if (!days || days === 0) return '—'
  if (days < 30)  return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}yr`
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

// ── Tier distribution bar ─────────────────────────────────────────────────────

function TierBar({ holdings }) {
  const withXirr = holdings.filter(h => h.xirr != null)
  if (withXirr.length === 0) return null

  const counts = TIERS.map(t => ({
    ...t,
    count: withXirr.filter(h => tierFor(h.xirr)?.key === t.key).length,
  })).filter(t => t.count > 0)

  const total = withXirr.length

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={s.tierBarRow}>
        {counts.map(t => (
          <div
            key={t.key}
            title={`${t.label}: ${t.count} scheme${t.count > 1 ? 's' : ''}`}
            style={{
              flex: t.count,
              height: 10,
              background: t.color,
              opacity: 0.75,
              borderRadius: 0,
              cursor: 'default',
            }}
          />
        ))}
      </div>
      <div style={s.tierLegendRow}>
        {counts.map(t => (
          <div key={t.key} style={s.tierLegendItem}>
            <span style={{ ...s.tierDot, background: t.color }} />
            <span style={{ ...s.tierLegendLabel, color: t.color }}>
              {t.label} ({t.count})
            </span>
          </div>
        ))}
        {holdings.length > withXirr.length && (
          <div style={s.tierLegendItem}>
            <span style={{ ...s.tierDot, background: '#e5e7eb' }} />
            <span style={{ ...s.tierLegendLabel, color: '#9ca3af' }}>
              No NAV data ({holdings.length - withXirr.length})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Schemes table ─────────────────────────────────────────────────────────────

function SchemesTable({ holdings, mobile, sortBy, onSort }) {
  const withData    = holdings.filter(h => h.xirr != null)
  const withoutData = holdings.filter(h => h.xirr == null)

  const sorted = useMemo(() => {
    return [...withData].sort((a, b) => {
      if (sortBy === 'absret')   return (b.unrealised_gain_pct ?? -Infinity) - (a.unrealised_gain_pct ?? -Infinity)
      if (sortBy === 'invested') return b.invested_amount - a.invested_amount
      return (b.xirr ?? -Infinity) - (a.xirr ?? -Infinity)  // default: xirr
    })
  }, [withData, sortBy])

  function SortBtn({ id, label }) {
    return (
      <button
        style={{
          ...s.sortBtn,
          ...(sortBy === id ? s.sortBtnActive : {}),
        }}
        onClick={() => onSort(id)}
      >
        {label}
      </button>
    )
  }

  const colSpan = mobile ? 3 : 6

  return (
    <div>
      {/* Sort controls */}
      <div style={s.sortRow}>
        <span style={s.sortLabel}>Sort by</span>
        <SortBtn id="xirr"    label="XIRR" />
        <SortBtn id="absret"  label="Abs. Return" />
        <SortBtn id="invested" label="Invested" />
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={{ ...s.th, width: 28 }}>#</th>
              <th style={s.th}>Scheme</th>
              {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Period</th>}
              {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Invested</th>}
              {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Current</th>}
              <th style={{ ...s.th, textAlign: 'right' }}>Abs. Ret.</th>
              <th style={{ ...s.th, textAlign: 'right' }}>XIRR</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => {
              const tier = tierFor(h.xirr)
              const cat  = classifyScheme(h.scheme_name)
              const gc   = (h.unrealised_gain_pct ?? 0) >= 0 ? ACC : '#dc2626'
              return (
                <tr key={`${h.scheme_name}|${h.folio}`} style={i % 2 !== 0 ? s.trAlt : {}}>
                  <td style={{ ...s.td, width: 28, color: '#9ca3af', fontWeight: 700, fontSize: 11 }}>
                    {i + 1}
                  </td>
                  <td style={s.td}>
                    <div style={s.schemeName}>{h.scheme_name}</div>
                    <div style={s.schemeMeta}>
                      <span style={{
                        ...s.chip,
                        background: (CAT_COLORS[cat] ?? '#9ca3af') + '20',
                        color: CAT_COLORS[cat] ?? '#9ca3af',
                      }}>
                        {cat}
                      </span>
                      <span style={{
                        ...s.chip,
                        background: h.plan === 'Direct' ? `${ACC}18` : '#f3f4f6',
                        color:      h.plan === 'Direct' ? ACC : '#6b7280',
                      }}>
                        {h.plan}
                      </span>
                      {tier && (
                        <span style={{ ...s.chip, background: tier.bg, color: tier.color }}>
                          {tier.label}
                        </span>
                      )}
                      <span style={s.amcName}>{h.amc}</span>
                    </div>
                  </td>
                  {!mobile && (
                    <td style={s.tdR}>{fmtPeriod(h.holding_period_days)}</td>
                  )}
                  {!mobile && (
                    <td style={s.tdR}>{fmtINR(h.invested_amount)}</td>
                  )}
                  {!mobile && (
                    <td style={s.tdR}>
                      {h.current_value != null ? fmtINR(h.current_value) : '—'}
                    </td>
                  )}
                  <td style={{ ...s.tdR, color: gc, fontWeight: 600 }}>
                    {fmtPct(h.unrealised_gain_pct)}
                  </td>
                  <td style={{
                    ...s.tdR, fontWeight: 700,
                    color: tier?.color ?? '#374151',
                  }}>
                    {fmtXirr(h.xirr)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Schemes without NAV data */}
      {withoutData.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={s.noDataHeader}>
            No NAV data · {withoutData.length} scheme{withoutData.length > 1 ? 's' : ''} —
            upload a holdings snapshot in Data Manager to see returns
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <tbody>
                {withoutData.map((h, i) => {
                  const cat = classifyScheme(h.scheme_name)
                  return (
                    <tr key={`${h.scheme_name}|${h.folio}`} style={i % 2 !== 0 ? s.trAlt : {}}>
                      <td style={{ ...s.td, width: 28, color: '#9ca3af', fontWeight: 700, fontSize: 11 }}>
                        {sorted.length + i + 1}
                      </td>
                      <td style={s.td}>
                        <div style={s.schemeName}>{h.scheme_name}</div>
                        <div style={s.schemeMeta}>
                          <span style={{
                            ...s.chip,
                            background: (CAT_COLORS[cat] ?? '#9ca3af') + '20',
                            color: CAT_COLORS[cat] ?? '#9ca3af',
                          }}>
                            {cat}
                          </span>
                          <span style={{
                            ...s.chip,
                            background: h.plan === 'Direct' ? `${ACC}18` : '#f3f4f6',
                            color:      h.plan === 'Direct' ? ACC : '#6b7280',
                          }}>
                            {h.plan}
                          </span>
                          <span style={s.amcName}>{h.amc}</span>
                        </div>
                      </td>
                      {!mobile && <td style={s.tdR}>{fmtPeriod(h.holding_period_days)}</td>}
                      {!mobile && <td style={s.tdR}>{fmtINR(h.invested_amount)}</td>}
                      {!mobile && <td style={{ ...s.tdR, color: '#9ca3af' }}>—</td>}
                      <td style={{ ...s.tdR, color: '#9ca3af' }}>—</td>
                      <td style={{ ...s.tdR, color: '#9ca3af' }}>—</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Category table ────────────────────────────────────────────────────────────

function CategoryTable({ rows, mobile }) {
  const maxInvested = Math.max(...rows.map(r => r.invested))

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Category</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Schemes</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Invested</th>}
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Current</th>}
            <th style={{ ...s.th, textAlign: 'right' }}>Abs. Ret.</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Avg XIRR</th>
            {!mobile && <th style={{ ...s.th }}>Weight</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tier = tierFor(r.avgXirr)
            const gc   = (r.absReturn ?? 0) >= 0 ? ACC : '#dc2626'
            return (
              <tr key={r.category} style={i % 2 !== 0 ? s.trAlt : {}}>
                <td style={s.td}>
                  <span style={{
                    fontFamily: FONT, fontSize: 12, fontWeight: 700,
                    color: CAT_COLORS[r.category] ?? '#374151',
                  }}>
                    {r.category}
                  </span>
                </td>
                <td style={{ ...s.tdR, color: '#374151' }}>{r.count}</td>
                {!mobile && <td style={s.tdR}>{fmtINR(r.invested)}</td>}
                {!mobile && <td style={s.tdR}>
                  {r.current > 0 ? fmtINR(r.current) : '—'}
                </td>}
                <td style={{ ...s.tdR, color: gc, fontWeight: 600 }}>
                  {fmtPct(r.absReturn)}
                </td>
                <td style={{ ...s.tdR, fontWeight: 700, color: tier?.color ?? '#9ca3af' }}>
                  {fmtXirr(r.avgXirr)}
                </td>
                {!mobile && (
                  <td style={{ ...s.td, minWidth: 100 }}>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: CAT_COLORS[r.category] ?? '#9ca3af',
                        width: `${(r.invested / maxInvested * 100).toFixed(1)}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
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

// ── AMC table ─────────────────────────────────────────────────────────────────

function AmcTable({ rows, mobile }) {
  const maxInvested = Math.max(...rows.map(r => r.invested))

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>AMC</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Schemes</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Invested</th>}
            <th style={{ ...s.th, textAlign: 'right' }}>Best XIRR</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Avg XIRR</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Worst XIRR</th>}
            {!mobile && <th style={s.th}>Allocation</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const avgTier  = tierFor(r.avgXirr)
            const bestTier = tierFor(r.maxXirr)
            return (
              <tr key={r.amc} style={i % 2 !== 0 ? s.trAlt : {}}>
                <td style={{ ...s.td }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#111827' }}>
                    {r.amc}
                  </span>
                </td>
                <td style={{ ...s.tdR, color: '#374151' }}>{r.count}</td>
                {!mobile && <td style={s.tdR}>{fmtINR(r.invested)}</td>}
                <td style={{ ...s.tdR, fontWeight: 700, color: bestTier?.color ?? '#9ca3af' }}>
                  {fmtXirr(r.maxXirr)}
                </td>
                <td style={{ ...s.tdR, color: avgTier?.color ?? '#9ca3af', fontWeight: 600 }}>
                  {fmtXirr(r.avgXirr)}
                </td>
                {!mobile && (
                  <td style={{ ...s.tdR, color: tierFor(r.minXirr)?.color ?? '#9ca3af' }}>
                    {fmtXirr(r.minXirr)}
                  </td>
                )}
                {!mobile && (
                  <td style={{ ...s.td, minWidth: 100 }}>
                    <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, background: ACC, opacity: 0.6,
                        width: `${(r.invested / maxInvested * 100).toFixed(1)}%`,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function E5Performance() {
  const width    = useWindowWidth()
  const navigate = useNavigate()
  const mobile   = width < 768

  const [portfolios]  = useState(getPortfolios)
  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)
  const [activeTab,  setActiveTab]  = useState('scheme')
  const [sortBy,     setSortBy]     = useState('xirr')

  const portfolio = useMemo(
    () => portfolios.find(p => p.portfolio_id === selectedId) ?? null,
    [portfolios, selectedId]
  )

  const activeHoldings = useMemo(
    () => (portfolio?.holdings ?? []).filter(h => h.units > 0),
    [portfolio]
  )

  // Weighted-average XIRR across schemes with data
  const wtdAvgXirr = useMemo(() => {
    let totalInv = 0, wtdSum = 0
    for (const h of activeHoldings) {
      if (h.xirr == null) continue
      totalInv += h.invested_amount ?? 0
      wtdSum   += (h.invested_amount ?? 0) * h.xirr
    }
    return totalInv > 0 ? wtdSum / totalInv : null
  }, [activeHoldings])

  // By category
  const byCategory = useMemo(() => {
    const map = {}
    for (const h of activeHoldings) {
      const cat = classifyScheme(h.scheme_name)
      if (!map[cat]) map[cat] = { invested: 0, current: 0, xirrs: [], absRets: [] }
      map[cat].invested += h.invested_amount ?? 0
      if (h.current_value != null) map[cat].current += h.current_value
      if (h.xirr != null) map[cat].xirrs.push(h.xirr)
      if (h.unrealised_gain_pct != null) map[cat].absRets.push({
        pct: h.unrealised_gain_pct,
        inv: h.invested_amount ?? 0,
      })
    }
    return Object.entries(map).map(([category, d]) => ({
      category,
      count:    activeHoldings.filter(h => classifyScheme(h.scheme_name) === category).length,
      invested: d.invested,
      current:  d.current,
      avgXirr:  d.xirrs.length > 0
        ? d.xirrs.reduce((s, x) => s + x, 0) / d.xirrs.length
        : null,
      absReturn: d.invested > 0 && d.current > 0
        ? (d.current - d.invested) / d.invested * 100
        : null,
    })).sort((a, b) => b.invested - a.invested)
  }, [activeHoldings])

  // By AMC
  const byAmc = useMemo(() => {
    const map = {}
    for (const h of activeHoldings) {
      const a = h.amc || 'Unknown'
      if (!map[a]) map[a] = { invested: 0, xirrs: [] }
      map[a].invested += h.invested_amount ?? 0
      if (h.xirr != null) map[a].xirrs.push(h.xirr)
    }
    return Object.entries(map).map(([amc, d]) => ({
      amc,
      count:   activeHoldings.filter(h => (h.amc || 'Unknown') === amc).length,
      invested: d.invested,
      avgXirr: d.xirrs.length > 0 ? d.xirrs.reduce((s, x) => s + x, 0) / d.xirrs.length : null,
      maxXirr: d.xirrs.length > 0 ? Math.max(...d.xirrs) : null,
      minXirr: d.xirrs.length > 0 ? Math.min(...d.xirrs) : null,
    })).sort((a, b) => b.invested - a.invested)
  }, [activeHoldings])

  const portfolioTier = tierFor(wtdAvgXirr)

  // ── Empty states ──────────────────────────────────────────────────────────
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

  const TABS = [
    { id: 'scheme',   label: `By Scheme (${activeHoldings.length})` },
    { id: 'category', label: `By Category (${byCategory.length})` },
    { id: 'amc',      label: `By AMC (${byAmc.length})` },
  ]

  return (
    <div>
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={s.pageTitle}>Performance Matrix</h1>
          {portfolioTier && wtdAvgXirr != null && (
            <span style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 8,
              background: portfolioTier.bg, color: portfolioTier.color,
            }}>
              Portfolio avg XIRR {fmtXirr(wtdAvgXirr)}
            </span>
          )}
        </div>
        <p style={s.pageSub}>
          {activeHoldings.length} active scheme{activeHoldings.length !== 1 ? 's' : ''} · {portfolio.name}
        </p>
      </div>

      {/* Tier distribution bar */}
      <TierBar holdings={activeHoldings} />

      {/* Note */}
      <div style={s.disclaimer}>
        <span style={{ marginRight: 6 }}>ℹ</span>
        XIRR is your annualized return since first investment, computed from actual cashflows.
        Comparison against SEBI Tier 1 TRI benchmarks will be added after the NAV history backfill completes.
      </div>

      {/* Section card */}
      <div style={s.section}>
        {/* Tab bar */}
        <div style={s.tabBar}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 0 0.25rem' }}>
          {activeTab === 'scheme' && (
            <SchemesTable
              holdings={activeHoldings}
              mobile={mobile}
              sortBy={sortBy}
              onSort={setSortBy}
            />
          )}
          {activeTab === 'category' && (
            <CategoryTable rows={byCategory} mobile={mobile} />
          )}
          {activeTab === 'amc' && (
            <AmcTable rows={byAmc} mobile={mobile} />
          )}
        </div>
      </div>

      {/* Tier legend */}
      <div style={s.tierKey}>
        {TIERS.map(t => (
          <div key={t.key} style={s.tierKeyItem}>
            <span style={{ ...s.tierDot, background: t.color }} />
            <span style={{ fontFamily: FONT, fontSize: 11, color: '#6b7280' }}>
              <strong style={{ color: t.color }}>{t.label}</strong>
              {t.minXirr === -Infinity
                ? ' < 0%'
                : t.key === 'stellar'
                ? ' > 20%'
                : ` > ${(t.minXirr * 100).toFixed(0)}%`}
            </span>
          </div>
        ))}
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
  pageHeader: { marginBottom: '1rem' },
  pageTitle:  { fontFamily: FONT, fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.25rem' },
  pageSub:    { fontFamily: FONT, fontSize: 13, color: '#6b9e8d', margin: 0 },

  // Tier bar
  tierBarRow:     { display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  tierLegendRow:  { display: 'flex', gap: 12, flexWrap: 'wrap' },
  tierLegendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  tierLegendLabel:{ fontFamily: FONT, fontSize: 11, fontWeight: 600 },
  tierDot:        { width: 8, height: 8, borderRadius: 2, flexShrink: 0 },

  // Disclaimer
  disclaimer: { fontFamily: FONT, fontSize: 12, color: '#6b7280', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', marginBottom: '1rem', lineHeight: 1.6 },

  // Section
  section:  { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },

  // Tab bar
  tabBar:     { display: 'flex', borderBottom: `1px solid ${ACC}12`, overflowX: 'auto' },
  tab:        { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px', whiteSpace: 'nowrap', borderBottom: '2px solid transparent', marginBottom: -1 },
  tabActive:  { color: ACC, borderBottomColor: ACC, background: `${ACC}06` },

  // Sort controls
  sortRow:       { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: `1px solid ${ACC}08` },
  sortLabel:     { fontFamily: FONT, fontSize: 11, color: '#9ca3af', fontWeight: 600 },
  sortBtn:       { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  sortBtnActive: { background: `${ACC}18`, color: ACC },

  // Table
  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th:        { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10` },
  td:        { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  tdR:       { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  trAlt:     { background: '#fafffe' },
  schemeName:{ fontWeight: 600, color: '#111827', marginBottom: 3, lineHeight: 1.3, fontSize: 12 },
  schemeMeta:{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  chip:      { fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' },
  amcName:   { fontSize: 11, color: '#9ca3af' },

  // No-data section header
  noDataHeader: { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '6px 14px', background: '#fafafa', borderTop: `1px solid ${ACC}10`, borderBottom: `1px solid ${ACC}10` },

  // Tier key at bottom
  tierKey:     { display: 'flex', gap: 12, flexWrap: 'wrap', padding: '0 0 0.5rem' },
  tierKeyItem: { display: 'flex', alignItems: 'center', gap: 5 },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: FONT, fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
