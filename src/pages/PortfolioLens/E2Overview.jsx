import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Treemap,
} from 'recharts'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC = '#1D9E75'

const CAT_COLORS = {
  Equity:  '#635bff',
  Debt:    '#10b981',
  Hybrid:  '#f59e0b',
  Gold:    '#f97316',
  Liquid:  '#06b6d4',
  Other:   '#9ca3af',
}
const PLAN_COLORS   = { Direct: ACC, Regular: '#c4b5fd' }
const OPTION_COLORS = { Growth: '#635bff', IDCW: '#f59e0b' }
const AMC_PAL = [
  '#635bff','#f43f8e','#f59e0b','#10b981','#06b6d4','#f97316',
  '#8b5cf6','#14b8a6','#84cc16','#3b82f6','#a855f7','#22c55e',
  '#fb923c','#0ea5e9','#d946ef','#f43f5e',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyScheme(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('gold') || n.includes('silver')) return 'Gold'
  if (n.includes('liquid') || n.includes('overnight') || n.includes('money market') || n.includes('cash management')) return 'Liquid'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('multi asset') || n.includes('asset allocation') || n.includes('equity savings') || n.includes('arbitrage')) return 'Hybrid'
  if (
    n.includes('debt') || n.includes('bond') || n.includes('gilt') || n.includes('income') ||
    n.includes('credit risk') || n.includes('ultra short') || n.includes('low duration') ||
    n.includes('medium duration') || n.includes('long duration') || n.includes('dynamic bond') ||
    n.includes('corporate bond') || n.includes('treasury') || n.includes('floater') ||
    n.includes('constant maturity') || n.includes('banking psu')
  ) return 'Debt'
  if (
    n.includes('equity') || n.includes('large cap') || n.includes('mid cap') || n.includes('small cap') ||
    n.includes('large & mid') || n.includes('flexi cap') || n.includes('multi cap') ||
    n.includes('sectoral') || n.includes('thematic') || n.includes('elss') || n.includes('tax saver') ||
    n.includes('nifty') || n.includes('sensex') || n.includes('index') || n.includes('focused') ||
    n.includes('value fund') || n.includes('contra') || n.includes('dividend yield') || n.includes('etf') ||
    n.includes('bluechip') || n.includes('blue chip') || n.includes('aggressive')
  ) return 'Equity'
  return 'Other'
}

function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
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

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${dd} ${mon} ${d.getFullYear()}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, style }) {
  return (
    <div style={{ ...s.card, ...style }}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{title}</span>
        {subtitle && <span style={s.cardSub}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function DonutTip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={s.tip}>
      <div style={s.tipTitle}>{payload[0].name}</div>
      <div style={s.tipVal}>{fmtINR(payload[0].value)}</div>
    </div>
  )
}

function JourneyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const parts = (label || '').split('-')
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dateLabel = parts.length === 2 ? `${MON[+parts[1] - 1]} ${parts[0]}` : label
  return (
    <div style={s.tip}>
      <div style={s.tipTitle}>{dateLabel}</div>
      <div style={{ ...s.tipVal, color: ACC }}>Invested: {fmtINR(payload[0]?.value)}</div>
    </div>
  )
}

function DonutLegend({ data, colors, total }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', justifyContent: 'center', padding: '0.5rem 1rem 0.75rem' }}>
      {data.map(item => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[item.name] || '#9ca3af', flexShrink: 0 }} />
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: '#374151' }}>
            {item.name}
          </span>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#9ca3af' }}>
            {total > 0 ? ((item.value / total) * 100).toFixed(1) + '%' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// Treemap box — recharts cloneElements this with x,y,width,height,name,size props
function AmcBox(props) {
  const { x, y, width, height, name, amcColors } = props
  if (!width || !height || width < 6 || height < 6) return null
  const color    = amcColors?.[name] || '#9ca3af'
  const canLabel = width > 50 && height > 26
  const fs       = Math.min(11, Math.max(8, width / 9))
  const label    = canLabel
    ? (width < 80 ? (name || '').slice(0, 6) + '…' : (name || '').length > 14 ? (name || '').slice(0, 12) + '…' : name)
    : null
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        fill={color} fillOpacity={0.88} rx={3} />
      {label && (
        <text x={x + width / 2} y={y + height / 2}
          textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={fs}
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontWeight={600}>
          {label}
        </text>
      )}
    </g>
  )
}

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

// ── Main component ────────────────────────────────────────────────────────────

export default function E2Overview() {
  const width    = useWindowWidth()
  const navigate = useNavigate()
  const mobile   = width < 768

  const [portfolios] = useState(getPortfolios)
  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)

  const portfolio = useMemo(
    () => portfolios.find(p => p.portfolio_id === selectedId) ?? null,
    [portfolios, selectedId]
  )
  const activeHoldings = useMemo(
    () => (portfolio?.holdings ?? []).filter(h => h.units > 0),
    [portfolio]
  )

  // Category allocation
  const categoryData = useMemo(() => {
    const cats = {}
    for (const h of activeHoldings) {
      const cat = classifyScheme(h.scheme_name)
      cats[cat] = (cats[cat] ?? 0) + h.invested_amount
    }
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [activeHoldings])
  const categoryTotal = categoryData.reduce((s, d) => s + d.value, 0)

  // AMC distribution
  const amcData = useMemo(() => {
    const amcs = {}
    for (const h of activeHoldings) {
      amcs[h.amc] = (amcs[h.amc] ?? 0) + h.invested_amount
    }
    return Object.entries(amcs)
      .map(([name, size]) => ({ name, size: Math.round(size) }))
      .filter(d => d.size > 0)
      .sort((a, b) => b.size - a.size)
  }, [activeHoldings])

  const amcColors = useMemo(() => {
    const map = {}
    amcData.forEach((d, i) => { map[d.name] = AMC_PAL[i % AMC_PAL.length] })
    return map
  }, [amcData])

  // Investment journey — monthly cumulative invested
  const journeyData = useMemo(() => {
    if (!activeHoldings.length) return []
    const monthly = {}
    for (const h of activeHoldings) {
      for (const tx of (h.transactions ?? [])) {
        if (!tx.date || !tx.amount) continue
        if (!['PURCHASE','SWITCH_IN','REDEMPTION','SWITCH_OUT'].includes(tx.type)) continue
        const ym = tx.date.slice(0, 7)
        if (!monthly[ym]) monthly[ym] = 0
        if (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') monthly[ym] += tx.amount
        else monthly[ym] -= tx.amount
      }
    }
    const months = Object.keys(monthly).sort()
    let cum = 0
    return months.map(ym => {
      cum = Math.max(0, cum + monthly[ym])
      return { month: ym, cumulative: Math.round(cum) }
    })
  }, [activeHoldings])

  // x-axis: show Jan of each year for long series
  const journeyTicks = useMemo(() => {
    if (journeyData.length <= 12) return undefined
    const jans = journeyData.filter(d => d.month.endsWith('-01')).map(d => d.month)
    return jans.length > 0 ? jans : undefined
  }, [journeyData])

  // Plan and option splits
  const planData = useMemo(() => {
    const direct  = activeHoldings.filter(h => h.plan === 'Direct').reduce((s, h) => s + h.invested_amount, 0)
    const regular = activeHoldings.filter(h => h.plan === 'Regular').reduce((s, h) => s + h.invested_amount, 0)
    return [
      { name: 'Direct',  value: Math.round(direct)  },
      { name: 'Regular', value: Math.round(regular) },
    ].filter(d => d.value > 0)
  }, [activeHoldings])

  const optionData = useMemo(() => {
    const growth = activeHoldings.filter(h => h.option === 'Growth').reduce((s, h) => s + h.invested_amount, 0)
    const idcw   = activeHoldings.filter(h => h.option === 'IDCW').reduce((s, h) => s + h.invested_amount, 0)
    return [
      { name: 'Growth', value: Math.round(growth) },
      { name: 'IDCW',   value: Math.round(idcw)   },
    ].filter(d => d.value > 0)
  }, [activeHoldings])

  const hasCurrentValue = activeHoldings.some(h => h.current_value != null)

  // ── Empty states ────────────────────────────────────────────────────────────

  if (portfolios.length === 0) {
    return (
      <div style={s.emptyWrap}>
        <div style={s.emptyIcon}>📊</div>
        <h2 style={s.emptyTitle}>No portfolios yet</h2>
        <p style={s.emptySub}>Add your CAMS and KFin statements in the Data Manager to get started.</p>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>Go to Data Manager</button>
      </div>
    )
  }

  if (activeHoldings.length === 0) {
    return (
      <div>
        {portfolios.length > 1 && <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />}
        <div style={s.emptyWrap}>
          <div style={s.emptyIcon}>📋</div>
          <h2 style={s.emptyTitle}>No holdings data</h2>
          <p style={s.emptySub}>{portfolio?.status === 'pending' ? 'Upload your CAMS and KFin files in the Data Manager.' : 'No active holdings found.'}</p>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>Go to Data Manager</button>
        </div>
      </div>
    )
  }

  const twoCol = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }
  const planTotal   = planData.reduce((s, d) => s + d.value, 0)
  const optionTotal = optionData.reduce((s, d) => s + d.value, 0)

  return (
    <div>
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>{portfolio.name} — Visual Overview</h1>
        <p style={s.pageSub}>
          {activeHoldings.length} active schemes · last updated {fmtDate(portfolio.last_updated)}
          {!hasCurrentValue && ' · upload Holdings snapshot for current values'}
        </p>
      </div>

      {/* Row 1: Category donut + AMC treemap */}
      <div style={twoCol}>
        <ChartCard title="Category Allocation" subtitle={fmtINR(categoryTotal) + ' invested'}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryData} cx="50%" cy="50%"
                innerRadius="52%" outerRadius="78%"
                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}
              >
                {categoryData.map(entry => (
                  <Cell key={entry.name} fill={CAT_COLORS[entry.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip content={<DonutTip />} />
            </PieChart>
          </ResponsiveContainer>
          <DonutLegend data={categoryData} colors={CAT_COLORS} total={categoryTotal} />
        </ChartCard>

        <ChartCard title="AMC Distribution" subtitle={`${amcData.length} fund houses · by invested amount`}>
          {amcData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={240}>
              <Treemap
                data={amcData}
                dataKey="size"
                aspectRatio={4 / 3}
                content={<AmcBox amcColors={amcColors} />}
              />
            </ResponsiveContainer>
          ) : (
            <div style={s.noChartData}>
              {amcData.length === 1 ? `Single AMC: ${amcData[0].name}` : 'No AMC data'}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Investment journey */}
      <div style={{ marginBottom: 16 }}>
        <ChartCard title="Investment Journey" subtitle="Cumulative invested over time">
          {journeyData.length < 2 ? (
            <div style={s.noChartData}>Not enough transaction data to plot the journey</div>
          ) : (
            <div style={{ padding: '0.75rem 0.5rem 0.25rem' }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={journeyData} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="journeyFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={ACC} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={ACC} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="month"
                    ticks={journeyTicks}
                    tickFormatter={ym => ym?.slice(0, 4) ?? ''}
                    tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtAxis}
                    tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                  />
                  <Tooltip content={<JourneyTip />} />
                  <Area
                    type="monotone" dataKey="cumulative"
                    stroke={ACC} strokeWidth={2}
                    fill="url(#journeyFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: ACC, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Plan split + Option split */}
      <div style={twoCol}>
        <ChartCard title="Plan Split" subtitle="Direct vs Regular (by invested amount)">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={planData} cx="50%" cy="50%"
                innerRadius="48%" outerRadius="72%"
                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}
              >
                {planData.map(entry => (
                  <Cell key={entry.name} fill={PLAN_COLORS[entry.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip content={<DonutTip />} />
            </PieChart>
          </ResponsiveContainer>
          <DonutLegend data={planData} colors={PLAN_COLORS} total={planTotal} />
        </ChartCard>

        <ChartCard title="Option Split" subtitle="Growth vs IDCW (by invested amount)">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={optionData} cx="50%" cy="50%"
                innerRadius="48%" outerRadius="72%"
                dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}
              >
                {optionData.map(entry => (
                  <Cell key={entry.name} fill={OPTION_COLORS[entry.name] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip content={<DonutTip />} />
            </PieChart>
          </ResponsiveContainer>
          <DonutLegend data={optionData} colors={OPTION_COLORS} total={optionTotal} />
        </ChartCard>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  emptyWrap:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', textAlign: 'center', padding: '2rem' },
  emptyIcon:  { fontSize: 48, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  emptySub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#6b9e8d', lineHeight: 1.6, maxWidth: 360, margin: '0 0 1.5rem' },

  selectorRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' },
  selectorLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#6b7280' },
  selector:      { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827', padding: '6px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', outline: 'none' },

  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.25rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', margin: 0 },

  card:       { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', boxShadow: `0 1px 8px ${ACC}06` },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: `1px solid ${ACC}10` },
  cardTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#0d3d2b' },
  cardSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af' },

  tip:      { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  tipTitle: { fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2 },
  tipVal:   { fontSize: 13, fontWeight: 700, color: '#0d3d2b' },

  noChartData: { textAlign: 'center', padding: '2.5rem 1rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#9ca3af' },

  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
