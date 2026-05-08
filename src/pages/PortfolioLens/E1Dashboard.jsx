import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import { summarise, portfolioXirr } from './utils/portfolioEngine'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const WARN = '#ef4444'

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

// ── Portfolio selector ───────────────────────────────────────────────────────

function PortfolioSelector({ portfolios, selectedId, onChange }) {
  return (
    <div style={s.selectorRow}>
      <label style={s.selectorLabel}>Portfolio</label>
      <select
        style={s.selector}
        value={selectedId ?? ''}
        onChange={e => onChange(e.target.value)}
      >
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

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, valueColor, sub, subColor }) {
  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color: valueColor ?? '#0d3d2b' }}>{value}</div>
      {sub && <div style={{ ...s.metricSub, color: subColor ?? '#9ca3af' }}>{sub}</div>}
    </div>
  )
}

// ── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, accent }) {
  return (
    <div style={s.statChip}>
      <span style={{ ...s.statValue, color: accent ?? '#374151' }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  )
}

// ── Holdings table ───────────────────────────────────────────────────────────

function HoldingsTable({ holdings, mobile }) {
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
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => {
            const gc = (h.unrealised_gain ?? 0) >= 0 ? ACC : WARN
            return (
              <tr key={`${h.scheme_name}|${h.folio}`} style={i % 2 !== 0 ? s.trAlt : {}}>
                <td style={s.td}>
                  <div style={s.schemeName}>{h.scheme_name}</div>
                  <div style={s.schemeMeta}>
                    <span style={{
                      ...s.planChip,
                      background: h.plan === 'Direct' ? `${ACC}18` : '#f3f4f6',
                      color:      h.plan === 'Direct' ? ACC : '#6b7280',
                    }}>
                      {h.plan}
                    </span>
                    <span style={s.amcName}>{h.amc}</span>
                  </div>
                </td>
                {!mobile && (
                  <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtINR(h.invested_amount)}
                  </td>
                )}
                <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {h.current_value != null ? fmtINR(h.current_value) : '—'}
                </td>
                <td style={{ ...s.td, textAlign: 'right', color: gc, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {h.unrealised_gain_pct != null ? fmtPct(h.unrealised_gain_pct) : '—'}
                </td>
                {!mobile && (
                  <td style={{ ...s.td, textAlign: 'right', color: gc, fontVariantNumeric: 'tabular-nums' }}>
                    {h.xirr != null ? fmtXirrPct(h.xirr) : '—'}
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

// ── Main component ───────────────────────────────────────────────────────────

export default function E1Dashboard() {
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

  const summary  = useMemo(() => summarise(activeHoldings), [activeHoldings])
  const xirrVal  = useMemo(() => portfolioXirr(activeHoldings), [activeHoldings])

  const topHoldings = useMemo(
    () => [...activeHoldings].sort((a, b) => b.invested_amount - a.invested_amount).slice(0, 8),
    [activeHoldings]
  )

  const planSplit = useMemo(() => ({
    direct:  activeHoldings.filter(h => h.plan === 'Direct').length,
    regular: activeHoldings.filter(h => h.plan === 'Regular').length,
  }), [activeHoldings])

  const ltcgEligible = useMemo(
    () => activeHoldings.filter(h => h.holding_period_days > 365 && (h.unrealised_gain ?? 0) > 0),
    [activeHoldings]
  )

  // ── No portfolios ──────────────────────────────────────────────────────────
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

  // ── Portfolio exists but no parsed data ────────────────────────────────────
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

  const gainColor = (summary.total_gain ?? 0) >= 0 ? ACC : WARN

  return (
    <div>
      {/* Portfolio selector */}
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>{portfolio.name}</h1>
        <p style={s.pageSub}>
          Last updated {fmtDate(portfolio.last_updated)} · {summary.scheme_count} active scheme{summary.scheme_count !== 1 ? 's' : ''} · {summary.amc_count} AMC{summary.amc_count !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Metric cards */}
      <div style={{
        ...s.cardGrid,
        gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        marginBottom: '1.25rem',
      }}>
        <MetricCard
          label="Total Invested"
          value={fmtINR(summary.total_invested)}
        />
        <MetricCard
          label="Current Value"
          value={summary.total_current_value != null ? fmtINR(summary.total_current_value) : '—'}
          sub={summary.total_gain_pct != null ? fmtPct(summary.total_gain_pct) : 'Upload holdings snapshot'}
          subColor={summary.total_gain_pct != null ? (summary.total_gain_pct >= 0 ? ACC : WARN) : '#9ca3af'}
        />
        <MetricCard
          label="Unrealised Gain"
          value={summary.total_gain != null ? fmtINR(summary.total_gain) : '—'}
          valueColor={summary.total_gain != null ? gainColor : '#374151'}
        />
        <MetricCard
          label="Portfolio XIRR"
          value={xirrVal != null ? fmtXirrPct(xirrVal) : '—'}
          valueColor={xirrVal != null ? (xirrVal >= 0 ? ACC : WARN) : '#374151'}
          sub={xirrVal == null ? 'NAV data needed' : null}
        />
      </div>

      {/* Quick stats */}
      <div style={s.statsRow}>
        <StatChip label="Schemes"  value={summary.scheme_count} />
        <StatChip label="AMCs"     value={summary.amc_count} />
        <StatChip label="Direct"   value={planSplit.direct}  accent={ACC} />
        <StatChip label="Regular"  value={planSplit.regular} />
      </div>

      {/* Top holdings */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Top Holdings</span>
          {activeHoldings.length > 8 && (
            <button style={s.sectionLink} onClick={() => navigate('/portfolio/e3')}>
              View all {activeHoldings.length} →
            </button>
          )}
        </div>
        <HoldingsTable holdings={topHoldings} mobile={mobile} />
      </div>

      {/* LTCG harvest hint */}
      {ltcgEligible.length > 0 && (
        <div style={s.ltcgBanner}>
          <span style={s.ltcgIcon}>💡</span>
          <span>
            <strong>{ltcgEligible.length} holding{ltcgEligible.length > 1 ? 's' : ''}</strong>{' '}
            {ltcgEligible.length === 1 ? 'is' : 'are'} eligible for LTCG harvesting
            (held &gt; 1 year · unrealised gain of{' '}
            {fmtINR(ltcgEligible.reduce((sum, h) => sum + (h.unrealised_gain ?? 0), 0))}).{' '}
            <button style={s.ltcgLink} onClick={() => navigate('/portfolio/e7')}>
              Review in Capital Gains →
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
  // Empty states
  emptyWrap:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', textAlign: 'center', padding: '2rem' },
  emptyIcon:  { fontSize: 48, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  emptySub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#6b9e8d', lineHeight: 1.6, maxWidth: 360, margin: '0 0 1.5rem' },

  // Portfolio selector
  selectorRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' },
  selectorLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#6b7280' },
  selector:      { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827', padding: '6px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', outline: 'none' },

  // Page header
  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.25rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', margin: 0 },

  // Metric cards
  cardGrid:    { display: 'grid', gap: 12 },
  metricCard:  { background: '#fff', borderRadius: 14, border: `1px solid ${ACC}18`, padding: '1rem 1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  metricLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  metricValue: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 },
  metricSub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, marginTop: 6 },

  // Stats row
  statsRow:  { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1.5rem' },
  statChip:  { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', border: `1px solid ${ACC}18`, borderRadius: 12, padding: '10px 20px', minWidth: 60, boxShadow: `0 1px 4px ${ACC}06` },
  statValue: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 },

  // Section
  section:       { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: `1px solid ${ACC}10` },
  sectionTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#0d3d2b', letterSpacing: '0.01em' },
  sectionLink:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: ACC, background: 'none', border: 'none', cursor: 'pointer', padding: 0 },

  // Table
  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  th:        { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 16px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10` },
  td:        { fontSize: 13, color: '#374151', padding: '10px 16px', borderBottom: '1px solid #f9fafb', verticalAlign: 'top' },
  trAlt:     { background: '#fafffe' },
  schemeName:{ fontWeight: 600, color: '#111827', marginBottom: 3, lineHeight: 1.3 },
  schemeMeta:{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  planChip:  { fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, letterSpacing: '0.04em', textTransform: 'uppercase' },
  amcName:   { fontSize: 11, color: '#9ca3af' },

  // LTCG banner
  ltcgBanner: { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 16px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#92400e', lineHeight: 1.6, marginBottom: '1rem' },
  ltcgIcon:   { fontSize: 18, flexShrink: 0, marginTop: 1 },
  ltcgLink:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
