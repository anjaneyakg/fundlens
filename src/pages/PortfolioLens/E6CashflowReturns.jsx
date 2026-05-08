import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { getPortfolios } from './utils/portfolioStore'
import { summarise, portfolioXirr } from './utils/portfolioEngine'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC    = '#1D9E75'
const RED    = '#ef4444'
const PURPLE = '#8b5cf6'
const FONT   = "'Plus Jakarta Sans', sans-serif"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  const abs  = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(2) + ' Cr'
  if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(2) + ' L'
  return sign + '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtAxis(n) {
  if (!n && n !== 0) return ''
  const abs = Math.abs(n)
  if (abs >= 1e7) return '₹' + (abs / 1e7).toFixed(1) + 'Cr'
  if (abs >= 1e5) return '₹' + (abs / 1e5).toFixed(0) + 'L'
  if (abs >= 1e3) return '₹' + (abs / 1e3).toFixed(0) + 'K'
  return '₹' + abs
}

function fmtXirr(n) {
  if (n == null || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${dd} ${mon} ${d.getFullYear()}`
}

// ── Year-mode helpers ─────────────────────────────────────────────────────────

function getCYKey(dateStr)  { return String(new Date(dateStr).getFullYear()) }
function getFYStartYear(dateStr) {
  const d = new Date(dateStr)
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
}
function getFYKey(dateStr)  { return String(getFYStartYear(dateStr)) }
function fyShortLabel(k)    { return `FY${String(Number(k) + 1).slice(-2)}` }
function fyFullLabel(k)     { return `FY ${k}-${String(Number(k) + 1).slice(-2)}` }

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

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function FlowTip({ active, payload, label, yearMode }) {
  if (!active || !payload?.length) return null
  const display = yearMode === 'FY' ? fyFullLabel(label) : label
  return (
    <div style={s.tip}>
      <div style={s.tipTitle}>{display}</div>
      {payload.map(p => (
        <div key={p.name} style={{ ...s.tipRow, color: p.color }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700, marginLeft: 8 }}>{fmtINR(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Flow chart ────────────────────────────────────────────────────────────────

function FlowChart({ rows, yearMode, mobile }) {
  const chartWidth = Math.max(mobile ? 320 : 480, rows.length * (mobile ? 56 : 72))
  const xLabel = r => yearMode === 'FY' ? fyShortLabel(r.key) : r.key

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <BarChart
        width={chartWidth}
        height={mobile ? 220 : 280}
        data={rows}
        margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
        barCategoryGap="25%"
        barGap={3}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={`${ACC}15`} vertical={false} />
        <XAxis
          dataKey="key"
          tickFormatter={k => yearMode === 'FY' ? fyShortLabel(k) : k}
          tick={{ fontFamily: FONT, fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtAxis}
          tick={{ fontFamily: FONT, fontSize: 10, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<FlowTip yearMode={yearMode} />} />
        <Legend
          wrapperStyle={{ fontFamily: FONT, fontSize: 11 }}
          iconType="square"
          iconSize={8}
        />
        <Bar dataKey="inflow"  name="Invested"  fill={ACC}  radius={[3,3,0,0]} maxBarSize={40} />
        <Bar dataKey="outflow" name="Redeemed"  fill={RED}  radius={[3,3,0,0]} maxBarSize={40} opacity={0.75} />
      </BarChart>
    </div>
  )
}

// ── Year table ────────────────────────────────────────────────────────────────

function YearTable({ rows, yearMode, mobile }) {
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>{yearMode === 'FY' ? 'Financial Year' : 'Year'}</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Invested</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Redeemed</th>
            {!mobile && <th style={{ ...s.th, textAlign: 'right' }}>IDCW</th>}
            <th style={{ ...s.th, textAlign: 'right' }}>Net</th>
            <th style={{ ...s.th, textAlign: 'right' }}>Running Total</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r, i) => {
            const netColor = r.net >= 0 ? ACC : RED
            return (
              <tr key={r.key} style={i % 2 !== 0 ? s.trAlt : {}}>
                <td style={{ ...s.td, fontWeight: 700, color: '#111827' }}>
                  {yearMode === 'FY' ? fyFullLabel(r.key) : r.key}
                </td>
                <td style={{ ...s.tdR, color: ACC }}>
                  {r.inflow > 0 ? fmtINR(r.inflow) : '—'}
                </td>
                <td style={{ ...s.tdR, color: r.outflow > 0 ? RED : '#9ca3af' }}>
                  {r.outflow > 0 ? fmtINR(r.outflow) : '—'}
                </td>
                {!mobile && (
                  <td style={{ ...s.tdR, color: PURPLE }}>
                    {r.dividend > 0 ? fmtINR(r.dividend) : '—'}
                  </td>
                )}
                <td style={{ ...s.tdR, fontWeight: 600, color: netColor }}>
                  {fmtINR(r.net)}
                </td>
                <td style={{ ...s.tdR, fontWeight: 700, color: '#374151' }}>
                  {fmtINR(r.cumNet)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: `${ACC}08`, borderTop: `2px solid ${ACC}20` }}>
            <td style={{ ...s.td, fontWeight: 700, color: '#0d3d2b', fontSize: 12 }}>All time</td>
            <td style={{ ...s.tdR, fontWeight: 700, color: ACC }}>
              {fmtINR(rows.reduce((s, r) => s + r.inflow, 0))}
            </td>
            <td style={{ ...s.tdR, fontWeight: 700, color: RED }}>
              {fmtINR(rows.reduce((s, r) => s + r.outflow, 0))}
            </td>
            {!mobile && (
              <td style={{ ...s.tdR, fontWeight: 700, color: PURPLE }}>
                {fmtINR(rows.reduce((s, r) => s + r.dividend, 0))}
              </td>
            )}
            <td style={{ ...s.tdR, fontWeight: 700, color: '#374151' }}>
              {fmtINR(rows.reduce((s, r) => s + r.net, 0))}
            </td>
            <td style={s.tdR} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function E6CashflowReturns() {
  const width    = useWindowWidth()
  const navigate = useNavigate()
  const mobile   = width < 768

  const [portfolios]  = useState(getPortfolios)
  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)
  const [yearMode, setYearMode]     = useState('FY')

  const portfolio = useMemo(
    () => portfolios.find(p => p.portfolio_id === selectedId) ?? null,
    [portfolios, selectedId]
  )

  const activeHoldings = useMemo(
    () => (portfolio?.holdings ?? []).filter(h => h.units > 0),
    [portfolio]
  )

  // Summary
  const summary = useMemo(() => summarise(activeHoldings), [activeHoldings])
  const xirrVal = useMemo(() => portfolioXirr(activeHoldings), [activeHoldings])

  // All transactions across all holdings
  const allTxns = useMemo(() =>
    activeHoldings.flatMap(h =>
      (h.transactions ?? []).filter(tx => tx.date).map(tx => ({
        ...tx,
        scheme_name: h.scheme_name,
        amc: h.amc,
      }))
    ),
    [activeHoldings]
  )

  // First transaction date (for "investing since")
  const firstDate = useMemo(() => {
    if (!allTxns.length) return null
    return allTxns.reduce((earliest, tx) =>
      tx.date < earliest ? tx.date : earliest,
      allTxns[0].date
    )
  }, [allTxns])

  // Year-wise aggregation
  const yearRows = useMemo(() => {
    const map = {}
    const getKey = yearMode === 'FY' ? getFYKey : getCYKey
    for (const tx of allTxns) {
      const key = getKey(tx.date)
      if (!map[key]) map[key] = { key, inflow: 0, outflow: 0, dividend: 0 }
      if (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') {
        map[key].inflow += tx.amount ?? 0
      } else if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
        map[key].outflow += tx.amount ?? 0
      } else if (tx.type === 'DIVIDEND') {
        map[key].dividend += tx.amount ?? 0
      }
    }
    const rows = Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
    let cumNet = 0
    for (const r of rows) {
      r.net    = r.inflow - r.outflow
      cumNet  += r.net
      r.cumNet = cumNet
    }
    return rows
  }, [allTxns, yearMode])

  const totalInflow   = yearRows.reduce((s, r) => s + r.inflow,   0)
  const totalOutflow  = yearRows.reduce((s, r) => s + r.outflow,  0)
  const totalDividend = yearRows.reduce((s, r) => s + r.dividend, 0)
  const netDeployed   = totalInflow - totalOutflow

  const xirrColor = xirrVal == null ? '#374151' : xirrVal >= 0 ? ACC : RED

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

  return (
    <div>
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Cashflow & Returns</h1>
        <p style={s.pageSub}>
          {portfolio.name}
          {firstDate && ` · Investing since ${fmtDate(firstDate)}`}
          {yearRows.length > 0 && ` · ${yearRows.length} year${yearRows.length > 1 ? 's' : ''} of activity`}
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
          label="Total Invested"
          value={fmtINR(totalInflow)}
        />
        <MetricCard
          label="Total Redeemed"
          value={fmtINR(totalOutflow)}
          valueColor={totalOutflow > 0 ? RED : '#9ca3af'}
        />
        <MetricCard
          label="Current Value"
          value={summary.total_current_value != null ? fmtINR(summary.total_current_value) : '—'}
          sub={summary.total_gain_pct != null
            ? `${summary.total_gain_pct >= 0 ? '+' : ''}${summary.total_gain_pct.toFixed(2)}% overall`
            : 'Upload holdings snapshot'}
          subColor={summary.total_gain_pct != null
            ? (summary.total_gain_pct >= 0 ? ACC : RED)
            : '#9ca3af'}
        />
        <MetricCard
          label="Portfolio XIRR"
          value={fmtXirr(xirrVal)}
          valueColor={xirrColor}
          sub={xirrVal == null ? 'NAV data needed' : 'annualized return'}
          subColor={xirrVal == null ? '#9ca3af' : `${xirrColor}99`}
        />
      </div>

      {/* IDCW received chip — only if any */}
      {totalDividend > 0 && (
        <div style={s.dividendNote}>
          <span style={{ color: PURPLE, fontWeight: 700 }}>{fmtINR(totalDividend)}</span>
          {' '}received as IDCW / dividend payouts (shown in table · not included in XIRR)
        </div>
      )}

      {/* Year-mode toggle + chart section */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Annual Cashflows</span>
          <div style={s.modeToggle}>
            <button
              style={{ ...s.modeBtn, ...(yearMode === 'FY' ? s.modeBtnActive : {}) }}
              onClick={() => setYearMode('FY')}
            >
              Financial Year
            </button>
            <button
              style={{ ...s.modeBtn, ...(yearMode === 'CY' ? s.modeBtnActive : {}) }}
              onClick={() => setYearMode('CY')}
            >
              Calendar Year
            </button>
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
          <FlowChart rows={yearRows} yearMode={yearMode} mobile={mobile} />
        </div>
      </div>

      {/* Year table */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Year-wise Detail</span>
          <span style={{ fontFamily: FONT, fontSize: 11, color: '#9ca3af' }}>
            Most recent first
          </span>
        </div>
        <YearTable rows={yearRows} yearMode={yearMode} mobile={mobile} />
      </div>

      {/* Note about year-end values */}
      <div style={s.disclaimer}>
        <span style={{ marginRight: 6 }}>ℹ</span>
        Year-end portfolio values and per-year CAGR will be available after the NAV history
        backfill completes. XIRR above is your annualized return from first investment to today.
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
  metricSub:   { fontFamily: FONT, fontSize: 12, fontWeight: 600, marginTop: 6 },

  // Dividend note
  dividendNote: { fontFamily: FONT, fontSize: 12, color: '#374151', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 14px', marginBottom: '1rem', lineHeight: 1.6 },

  // Section
  section:       { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: `1px solid ${ACC}10`, flexWrap: 'wrap', gap: 8 },
  sectionTitle:  { fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#0d3d2b' },

  // Mode toggle
  modeToggle:    { display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2, gap: 2 },
  modeBtn:       { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  modeBtnActive: { background: '#fff', color: ACC, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },

  // Table
  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontFamily: FONT },
  th:        { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', background: '#fafafa', borderBottom: `1px solid ${ACC}10` },
  td:        { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle' },
  tdR:       { fontSize: 13, color: '#374151', padding: '9px 14px', borderBottom: '1px solid #f9fafb', verticalAlign: 'middle', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  trAlt:     { background: '#fafffe' },

  // Tooltip
  tip:      { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontFamily: FONT, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 180 },
  tipTitle: { fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 6 },
  tipRow:   { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 },

  // Disclaimer
  disclaimer: { fontFamily: FONT, fontSize: 12, color: '#6b7280', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', lineHeight: 1.6 },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: FONT, fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
