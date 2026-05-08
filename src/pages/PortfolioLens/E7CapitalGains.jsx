import { useState, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const RED  = '#ef4444'
const FONT = "'Plus Jakarta Sans', sans-serif"

const LTCG_EXEMPTION   = 125000  // ₹1.25L per FY (post July 23, 2024)
const EQUITY_LTCG_RATE = 0.125   // 12.5%
const EQUITY_STCG_RATE = 0.20    // 20%
const GRANDFATHER_DATE = '2018-01-31'
const DEBT_RULE_DATE   = '2023-04-01'

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

function taxCatInfo(category, holdDays, firstDate) {
  if (isEquityLike(category)) {
    return holdDays > 365
      ? { label: 'LTCG', rate: EQUITY_LTCG_RATE, color: '#16a34a', bg: '#dcfce7', isEquity: true,  isLTCG: true  }
      : { label: 'STCG', rate: EQUITY_STCG_RATE, color: '#dc2626', bg: '#fee2e2', isEquity: true,  isLTCG: false }
  }
  // Debt / Gold / Liquid: old rule for pre-April-2023 purchases held > 3 years
  const pDate = firstDate ? new Date(firstDate) : null
  if (pDate && pDate < new Date(DEBT_RULE_DATE) && holdDays > 1095) {
    return { label: 'LTCG (Debt)', rate: null, color: '#7c3aed', bg: '#ede9fe', isEquity: false, isLTCG: true  }
  }
  return   { label: 'Slab Rate',   rate: null, color: '#d97706', bg: '#fef3c7', isEquity: false, isLTCG: false }
}

function isGrandfathered(firstDate) {
  return firstDate && firstDate <= GRANDFATHER_DATE
}

// ── Financial year helpers ────────────────────────────────────────────────────

function fyStartYear(dateStr) {
  const d = new Date(dateStr)
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}

function fyLabel(startYear) {
  return `FY ${startYear}-${String(startYear + 1).slice(-2)}`
}

function currentFYStartYear() { return fyStartYear(new Date().toISOString()) }

// ── Realised gains computer ───────────────────────────────────────────────────
// Replays avg-cost accounting per holding to extract each redemption event.

function computeRealisedGains(activeHoldings) {
  const events = []
  for (const h of activeHoldings) {
    const txs = [...(h.transactions ?? [])]
      .filter(tx => tx.date && tx.units != null && tx.units > 0)
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

    let runUnits = 0, runCost = 0

    for (const tx of txs) {
      if (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') {
        runUnits += tx.units
        runCost  += tx.amount ?? 0
      } else if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
        if (runUnits <= 0) continue
        const avgCostNav = runCost / runUnits
        const proceeds   = tx.amount ?? (tx.units * (tx.nav ?? avgCostNav))
        const cost       = tx.units * avgCostNav
        const gain       = proceeds - cost

        const firstDate = h.first_investment_date ? new Date(h.first_investment_date) : null
        const saleDate  = new Date(tx.date)
        const holdDays  = firstDate
          ? Math.max(0, Math.floor((saleDate - firstDate) / 86400000))
          : 0

        const category = classifyScheme(h.scheme_name)
        events.push({
          scheme_name:           h.scheme_name,
          amc:                   h.amc,
          date:                  tx.date,
          units:                 tx.units,
          sale_nav:              tx.nav,
          avg_cost_nav:          avgCostNav,
          proceeds,
          cost,
          gain,
          holding_days:          holdDays,
          category,
          first_investment_date: h.first_investment_date,
          event_type:            tx.type === 'SWITCH_OUT' ? 'Switch Out' : 'Redemption',
          fy_start:              fyStartYear(tx.date),
        })

        runCost  = Math.max(0, runCost - cost)
        runUnits = Math.max(0, runUnits - tx.units)
      }
    }
  }
  return events.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

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

function fmtPeriod(days) {
  if (!days) return '—'
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

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, valueColor, sub, subColor, subBold }) {
  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color: valueColor ?? '#0d3d2b' }}>{value}</div>
      {sub && (
        <div style={{
          ...s.metricSub,
          color: subColor ?? '#9ca3af',
          fontWeight: subBold ? 700 : 500,
        }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Unrealised gains table ────────────────────────────────────────────────────

function UnrealisedTable({ holdings, mobile }) {
  const rows = holdings
    .filter(h => h.unrealised_gain != null)
    .sort((a, b) => (b.unrealised_gain ?? 0) - (a.unrealised_gain ?? 0))

  const noData = holdings.filter(h => h.unrealised_gain == null)

  if (rows.length === 0 && noData.length === 0) {
    return <div style={s.noData}>No active holdings found.</div>
  }

  return (
    <div>
      {rows.length > 0 && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Scheme</th>
                {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Invested</th>}
                {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Current</th>}
                <th style={{ ...s.th, textAlign: 'right' }}>Gain / Loss</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Period</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Tax</th>
                {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Est. Tax*</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => {
                const cat      = classifyScheme(h.scheme_name)
                const taxInfo  = taxCatInfo(cat, h.holding_period_days, h.first_investment_date)
                const gc       = (h.unrealised_gain ?? 0) >= 0 ? ACC : RED
                const gfather  = isGrandfathered(h.first_investment_date)

                let estTax = null
                if (taxInfo.isEquity && taxInfo.isLTCG && h.unrealised_gain > 0) {
                  estTax = Math.max(0, h.unrealised_gain - LTCG_EXEMPTION) * EQUITY_LTCG_RATE
                } else if (taxInfo.isEquity && !taxInfo.isLTCG && h.unrealised_gain > 0) {
                  estTax = h.unrealised_gain * EQUITY_STCG_RATE
                }

                return (
                  <tr key={`${h.scheme_name}|${h.folio}`} style={i % 2 !== 0 ? s.trAlt : {}}>
                    <td style={s.td}>
                      <div style={s.schemeName}>{h.scheme_name}</div>
                      <div style={s.schemeMeta}>
                        <span style={{
                          ...s.chip,
                          background: h.plan === 'Direct' ? `${ACC}18` : '#f3f4f6',
                          color: h.plan === 'Direct' ? ACC : '#6b7280',
                        }}>
                          {h.plan}
                        </span>
                        <span style={s.amcName}>{h.amc}</span>
                        {gfather && (
                          <span style={{ ...s.chip, background: '#fef3c7', color: '#92400e' }}>
                            Pre-Jan 2018
                          </span>
                        )}
                      </div>
                    </td>
                    {!mobile && (
                      <td style={s.tdR}>{fmtINR(h.invested_amount)}</td>
                    )}
                    {!mobile && (
                      <td style={s.tdR}>{fmtINR(h.current_value)}</td>
                    )}
                    <td style={{ ...s.tdR, color: gc, fontWeight: 600 }}>
                      {fmtINR(h.unrealised_gain)}
                      {h.unrealised_gain_pct != null && (
                        <div style={{ fontSize: 10, fontWeight: 500, color: `${gc}cc` }}>
                          {h.unrealised_gain_pct >= 0 ? '+' : ''}{h.unrealised_gain_pct.toFixed(1)}%
                        </div>
                      )}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {fmtPeriod(h.holding_period_days)}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <span style={{
                        ...s.chip,
                        background: taxInfo.bg,
                        color: taxInfo.color,
                      }}>
                        {taxInfo.label}
                      </span>
                    </td>
                    {!mobile && (
                      <td style={{ ...s.tdR, color: estTax != null ? '#374151' : '#9ca3af' }}>
                        {estTax != null ? fmtINR(estTax) : '—'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {noData.length > 0 && (
        <div style={s.noDataStrip}>
          {noData.length} scheme{noData.length > 1 ? 's' : ''} have no NAV data — upload a
          holdings snapshot to compute gains.
        </div>
      )}
    </div>
  )
}

// ── Realised gains table ──────────────────────────────────────────────────────

function RealisedTable({ events, mobile }) {
  if (events.length === 0) {
    return (
      <div style={s.noData}>
        No redemption or switch-out transactions found in this period.
      </div>
    )
  }

  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Scheme</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Date</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Proceeds</th>}
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>Cost</th>}
            <th style={{ ...s.th, textAlign: 'right' }}>Gain / Loss</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Period</th>
            <th style={{ ...s.th, textAlign: 'center' }}>Tax</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const taxInfo = taxCatInfo(e.category, e.holding_days, e.first_investment_date)
            const gc      = e.gain >= 0 ? ACC : RED
            const gfather = isGrandfathered(e.first_investment_date)
            return (
              <tr key={i} style={i % 2 !== 0 ? s.trAlt : {}}>
                <td style={s.td}>
                  <div style={s.schemeName}>{e.scheme_name}</div>
                  <div style={s.schemeMeta}>
                    <span style={{ ...s.chip, background: '#f3f4f6', color: '#6b7280' }}>
                      {e.event_type}
                    </span>
                    <span style={s.amcName}>{e.amc}</span>
                    {gfather && (
                      <span style={{ ...s.chip, background: '#fef3c7', color: '#92400e' }}>
                        Pre-Jan 2018
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ ...s.tdR, color: '#374151' }}>{fmtDate(e.date)}</td>
                {!mobile && <td style={s.tdR}>{fmtINR(e.proceeds)}</td>}
                {!mobile && <td style={s.tdR}>{fmtINR(e.cost)}</td>}
                <td style={{ ...s.tdR, color: gc, fontWeight: 600 }}>
                  {fmtINR(e.gain)}
                </td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  {fmtPeriod(e.holding_days)}
                </td>
                <td style={{ ...s.td, textAlign: 'center' }}>
                  <span style={{ ...s.chip, background: taxInfo.bg, color: taxInfo.color }}>
                    {taxInfo.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function E7CapitalGains() {
  const width    = useWindowWidth()
  const navigate = useNavigate()
  const mobile   = width < 768

  const [portfolios]  = useState(getPortfolios)
  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)
  const [activeTab,  setActiveTab]  = useState('unrealised')
  const [fyFilter,   setFyFilter]   = useState(() => String(currentFYStartYear()))

  const portfolio = useMemo(
    () => portfolios.find(p => p.portfolio_id === selectedId) ?? null,
    [portfolios, selectedId]
  )

  const activeHoldings = useMemo(
    () => (portfolio?.holdings ?? []).filter(h => h.units > 0),
    [portfolio]
  )

  // Realised gains from all redemption transactions
  const allRealised = useMemo(
    () => computeRealisedGains(activeHoldings),
    [activeHoldings]
  )

  // FY options for filter
  const fyOptions = useMemo(() => {
    const years = [...new Set(allRealised.map(e => String(e.fy_start)))].sort().reverse()
    return ['all', ...years]
  }, [allRealised])

  // Filtered realised events
  const filteredRealised = useMemo(() => {
    if (fyFilter === 'all') return allRealised
    return allRealised.filter(e => String(e.fy_start) === fyFilter)
  }, [allRealised, fyFilter])

  // ── Unrealised gain summary ────────────────────────────────────────────────
  const unrealisedSummary = useMemo(() => {
    let equityLTCG = 0, equitySTCG = 0, debtSlab = 0, ltcgLoss = 0
    for (const h of activeHoldings) {
      if (h.unrealised_gain == null) continue
      const cat     = classifyScheme(h.scheme_name)
      const taxInfo = taxCatInfo(cat, h.holding_period_days, h.first_investment_date)
      if (taxInfo.isEquity && taxInfo.isLTCG) {
        if (h.unrealised_gain >= 0) equityLTCG += h.unrealised_gain
        else ltcgLoss += Math.abs(h.unrealised_gain)
      } else if (taxInfo.isEquity && !taxInfo.isLTCG) {
        equitySTCG += Math.max(0, h.unrealised_gain)
      } else {
        debtSlab += Math.max(0, h.unrealised_gain)
      }
    }
    const netLTCG    = Math.max(0, equityLTCG - LTCG_EXEMPTION)
    const estLTCGTax = netLTCG * EQUITY_LTCG_RATE
    const estSTCGTax = equitySTCG * EQUITY_STCG_RATE
    return { equityLTCG, equitySTCG, debtSlab, ltcgLoss, netLTCG, estLTCGTax, estSTCGTax }
  }, [activeHoldings])

  // ── Realised gain summary for current FY ──────────────────────────────────
  const currentFYRealised = useMemo(() => {
    const curFY = String(currentFYStartYear())
    const fyEvents = allRealised.filter(e => String(e.fy_start) === curFY)
    let ltcg = 0, stcg = 0, slab = 0
    for (const e of fyEvents) {
      const taxInfo = taxCatInfo(e.category, e.holding_days, e.first_investment_date)
      if (taxInfo.isEquity && taxInfo.isLTCG)       ltcg += e.gain
      else if (taxInfo.isEquity && !taxInfo.isLTCG) stcg += e.gain
      else                                           slab += e.gain
    }
    return { ltcg, stcg, slab, count: fyEvents.length }
  }, [allRealised])

  // Grandfathering count
  const gfCount = useMemo(
    () => activeHoldings.filter(h => isGrandfathered(h.first_investment_date)).length,
    [activeHoldings]
  )

  const TABS = [
    { id: 'unrealised', label: `Unrealised Gains (${activeHoldings.filter(h => h.unrealised_gain != null).length})` },
    { id: 'realised',   label: `Realised Gains (${allRealised.length})` },
  ]

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
            Upload your CAMS and KFin files in the Data Manager to load holdings.
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
        <h1 style={s.pageTitle}>Capital Gains</h1>
        <p style={s.pageSub}>
          {portfolio.name} · {fyLabel(currentFYStartYear())} estimates
        </p>
      </div>

      {/* Summary metric cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: '1.25rem',
      }}>
        <MetricCard
          label="Unrealised LTCG"
          value={fmtINR(unrealisedSummary.equityLTCG)}
          valueColor={unrealisedSummary.equityLTCG > 0 ? '#16a34a' : '#9ca3af'}
          sub={unrealisedSummary.estLTCGTax > 0
            ? `Est. tax: ${fmtINR(unrealisedSummary.estLTCGTax)}`
            : 'Within ₹1.25L exemption'}
          subColor={unrealisedSummary.estLTCGTax > 0 ? '#dc2626' : ACC}
        />
        <MetricCard
          label="Unrealised STCG"
          value={fmtINR(unrealisedSummary.equitySTCG)}
          valueColor={unrealisedSummary.equitySTCG > 0 ? '#dc2626' : '#9ca3af'}
          sub={unrealisedSummary.equitySTCG > 0
            ? `Est. tax: ${fmtINR(unrealisedSummary.estSTCGTax)} @ 20%`
            : 'No STCG gains'}
          subColor={unrealisedSummary.equitySTCG > 0 ? '#dc2626' : '#9ca3af'}
        />
        <MetricCard
          label={`Realised (${fyLabel(currentFYStartYear())})`}
          value={fmtINR(currentFYRealised.ltcg + currentFYRealised.stcg + currentFYRealised.slab)}
          valueColor={
            (currentFYRealised.ltcg + currentFYRealised.stcg + currentFYRealised.slab) >= 0
              ? '#374151' : RED
          }
          sub={currentFYRealised.count > 0
            ? `${currentFYRealised.count} transaction${currentFYRealised.count > 1 ? 's' : ''}`
            : 'No redemptions this FY'}
          subColor="#9ca3af"
        />
        <MetricCard
          label="LTCG Exemption"
          value={fmtINR(Math.max(0, LTCG_EXEMPTION - Math.max(0, currentFYRealised.ltcg)))}
          valueColor={ACC}
          sub="₹1.25L per FY (equity)"
          subColor="#9ca3af"
        />
      </div>

      {/* Grandfathering alert */}
      {gfCount > 0 && (
        <div style={s.gfAlert}>
          <span style={{ fontSize: 16, marginRight: 8 }}>⚠</span>
          <span>
            <strong>{gfCount} holding{gfCount > 1 ? 's' : ''}</strong> with first investment
            before Jan 31, 2018 may be eligible for grandfathering (cost = higher of actual
            cost or NAV on Jan 31, 2018). NAV history data is needed for the exact calculation.
          </span>
        </div>
      )}

      {/* Main tabs */}
      <div style={s.section}>
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

          {/* FY filter — only in realised tab */}
          {activeTab === 'realised' && fyOptions.length > 1 && (
            <div style={{ marginLeft: 'auto', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontFamily: FONT, fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                Period
              </label>
              <select
                style={s.fySelect}
                value={fyFilter}
                onChange={e => setFyFilter(e.target.value)}
              >
                <option value="all">All years</option>
                {fyOptions.filter(o => o !== 'all').map(y => (
                  <option key={y} value={y}>{fyLabel(Number(y))}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          {activeTab === 'unrealised' && (
            <UnrealisedTable holdings={activeHoldings} mobile={mobile} />
          )}
          {activeTab === 'realised' && (
            <RealisedTable events={filteredRealised} mobile={mobile} />
          )}
        </div>
      </div>

      {/* Disclaimers */}
      <div style={s.disclaimer}>
        <div style={s.disclaimerTitle}>Important Notes</div>
        <ul style={s.disclaimerList}>
          <li>Tax estimates are <strong>illustrative only</strong>. Consult a tax advisor for filing.</li>
          <li>Gains use the <strong>average-cost method</strong> (not FIFO). Actual cost per lot may differ.</li>
          <li>Equity LTCG: 12.5% above ₹1.25L; STCG: 20% (rates applicable from July 23, 2024).</li>
          <li>Hybrid funds treated as equity-like. Debt/Gold/Liquid after April 2023: slab rate regardless of holding period.</li>
          <li>LTCG exemption of ₹1.25L is per investor per FY across <em>all</em> equity instruments, not just mutual funds.</li>
          <li>Pre-Jan 2018 grandfathering requires NAV data on Jan 31, 2018 — will be computed after NAV backfill.</li>
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

  // Grandfathering alert
  gfAlert: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 14px', fontFamily: FONT, fontSize: 12, color: '#92400e', lineHeight: 1.6, marginBottom: '1rem' },

  // Section
  section:  { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },

  // Tab bar
  tabBar:    { display: 'flex', alignItems: 'center', borderBottom: `1px solid ${ACC}12` },
  tab:       { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px', whiteSpace: 'nowrap', borderBottom: '2px solid transparent', marginBottom: -1, flexShrink: 0 },
  tabActive: { color: ACC, borderBottomColor: ACC, background: `${ACC}06` },

  // FY select
  fySelect: { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#374151', padding: '4px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', outline: 'none' },

  // Table
  tableWrap:  { overflowX: 'auto' },
  table:      { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th:         { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10` },
  td:         { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  tdR:        { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  trAlt:      { background: '#fafffe' },
  schemeName: { fontWeight: 600, color: '#111827', marginBottom: 3, lineHeight: 1.3, fontSize: 12 },
  schemeMeta: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 2 },
  chip:       { fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase' },
  amcName:    { fontSize: 11, color: '#9ca3af' },

  // No-data messages
  noData:      { fontFamily: FONT, fontSize: 13, color: '#9ca3af', padding: '2rem', textAlign: 'center' },
  noDataStrip: { fontFamily: FONT, fontSize: 11, color: '#9ca3af', fontWeight: 600, padding: '7px 14px', background: '#fafafa', borderTop: `1px solid ${ACC}10` },

  // Disclaimer
  disclaimer:      { background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' },
  disclaimerTitle: { fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' },
  disclaimerList:  { fontFamily: FONT, fontSize: 12, color: '#6b7280', lineHeight: 1.8, margin: 0, paddingLeft: '1.25rem' },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: FONT, fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
