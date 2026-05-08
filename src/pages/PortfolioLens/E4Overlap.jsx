import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const FONT = "'Plus Jakarta Sans', sans-serif"
const MAX_SCHEMES = 25   // heatmap cap

// ── Tag extractor ─────────────────────────────────────────────────────────────
// Infers investment-style tags from scheme name for Jaccard overlap scoring.

function extractTags(schemeName) {
  const n = (schemeName || '').toLowerCase()
  const t = new Set()

  // Asset class
  const isEq = n.includes('equity') || n.includes('elss') || n.includes('tax sav') ||
    n.includes('nifty') || n.includes('sensex') || n.includes('bse') ||
    n.includes('large cap') || n.includes('largecap') || n.includes('mid cap') ||
    n.includes('midcap') || n.includes('small cap') || n.includes('smallcap') ||
    n.includes('multi cap') || n.includes('multicap') || n.includes('flexi cap') ||
    n.includes('flexicap') || n.includes('focused') || n.includes('contra') ||
    n.includes('value') || n.includes('dividend yield') || n.includes('thematic') ||
    n.includes('sectoral') || n.includes('momentum') || n.includes('esg') ||
    n.includes('quality')
  if (isEq) t.add('equity')

  const isDbt = n.includes('debt') || n.includes('bond') || n.includes('gilt') ||
    n.includes('duration') || n.includes('credit risk') || n.includes('income') ||
    n.includes('banking & psu') || n.includes('banking and psu') ||
    n.includes('corporate bond') || n.includes('ultra short') || n.includes('ultrashort') ||
    n.includes('low duration') || n.includes('short term') || n.includes('medium term') ||
    n.includes('long term') || n.includes('floater') || n.includes('floating rate') ||
    n.includes('dynamic bond')
  if (isDbt) t.add('debt')

  if (n.includes('hybrid') || n.includes('balanced') || n.includes('multi asset') ||
      n.includes('asset alloc') || n.includes('equity savings')) t.add('hybrid')
  if (n.includes('arbitrage')) { t.add('arbitrage'); t.add('hybrid') }
  if (n.includes('balanced advantage') || n.includes('dynamic asset')) {
    t.add('balanced_advantage'); t.add('hybrid')
  }

  if (n.includes('gold') || n.includes('silver')) t.add('gold')
  if (n.includes('liquid') || n.includes('overnight') || n.includes('money market')) t.add('liquid')

  // International
  if (n.includes('global') || n.includes('international') || n.includes('overseas') ||
      n.includes('world') || n.includes('us equity') || n.includes('nasdaq') ||
      n.includes('hang seng') || n.includes('s&p 500')) {
    t.add('international'); t.add('equity')
  }

  // Market cap
  if (n.includes('large cap') || n.includes('largecap') || n.includes('top 100') ||
      n.includes('top 50') || n.includes('nifty 50') || n.includes('nifty50') ||
      n.includes('sensex')) t.add('large_cap')
  if (n.includes('mid cap') || n.includes('midcap') ||
      n.includes('nifty midcap') || n.includes('nifty mid cap')) t.add('mid_cap')
  if (n.includes('small cap') || n.includes('smallcap') ||
      n.includes('nifty smallcap') || n.includes('nifty small cap')) t.add('small_cap')
  if (n.includes('micro cap') || n.includes('microcap')) t.add('micro_cap')
  if (n.includes('multi cap') || n.includes('multicap')) t.add('multi_cap')
  if (n.includes('flexi cap') || n.includes('flexicap') ||
      n.includes('dynamic equity')) t.add('flexi_cap')
  if (n.includes('focused')) t.add('focused_equity')

  // Passive / index
  if (n.includes('index') || n.includes(' etf') || n.includes('fund of fund') ||
      n.includes(' fof')) t.add('passive')
  if (n.includes('nifty 50') || n.includes('nifty50')) t.add('nifty50')
  if (n.includes('nifty next 50') || n.includes('nifty next50')) t.add('nifty_next50')
  if (n.includes('nifty 100') || n.includes('nifty100')) t.add('nifty100')
  if (n.includes('nifty midcap 150') || n.includes('nifty midcap 100')) t.add('nifty_midcap')

  // Sector (add equity too)
  if (n.includes('bank') || n.includes('financi') || n.includes('psu bank')) {
    t.add('banking_finance'); t.add('equity')
  }
  if (n.includes('pharma') || n.includes('health') || n.includes('life science')) {
    t.add('healthcare'); t.add('equity')
  }
  if (n.includes('tech') || n.includes('information tech') || n.includes('digital')) {
    t.add('technology'); t.add('equity')
  }
  if (n.includes('infra')) { t.add('infrastructure'); t.add('equity') }
  if (n.includes('fmcg') || n.includes('consumer')) { t.add('consumer'); t.add('equity') }
  if (n.includes('energy') || n.includes('power')) { t.add('energy'); t.add('equity') }
  if (n.includes('mnc') || n.includes('multinational')) { t.add('mnc'); t.add('equity') }

  // Debt sub-types (add debt too)
  if (n.includes('overnight')) { t.add('overnight'); t.add('debt') }
  if (n.includes('ultra short') || n.includes('ultrashort') || n.includes('low duration')) {
    t.add('ultra_short'); t.add('debt')
  }
  if (n.includes('short duration') || n.includes('short term')) {
    t.add('short_duration'); t.add('debt')
  }
  if (n.includes('medium duration') || n.includes('medium term')) {
    t.add('medium_duration'); t.add('debt')
  }
  if (n.includes('long duration') || n.includes('long term')) {
    t.add('long_duration'); t.add('debt')
  }
  if (n.includes('gilt')) { t.add('gilt'); t.add('debt') }
  if (n.includes('credit risk')) { t.add('credit_risk'); t.add('debt') }
  if (n.includes('corporate bond')) { t.add('corporate_bond'); t.add('debt') }
  if (n.includes('banking & psu') || n.includes('banking and psu')) {
    t.add('banking_psu'); t.add('debt')
  }
  if (n.includes('dynamic bond')) { t.add('dynamic_bond'); t.add('debt') }
  if (n.includes('floater') || n.includes('floating rate')) {
    t.add('floating_rate'); t.add('debt')
  }

  // Style
  if (n.includes('elss') || n.includes('tax sav')) t.add('elss')
  if (n.includes('value') && !n.includes('current value') && !n.includes('nav')) {
    t.add('value_style'); t.add('equity')
  }
  if (n.includes('contra')) { t.add('contra'); t.add('equity') }
  if (n.includes('dividend yield')) { t.add('dividend_yield'); t.add('equity') }
  if (n.includes('esg')) { t.add('esg'); t.add('equity') }
  if (n.includes('momentum')) { t.add('momentum'); t.add('equity') }
  if (n.includes('quality')) { t.add('quality'); t.add('equity') }

  if (t.size === 0) t.add('other')
  return t
}

// ── Jaccard similarity ────────────────────────────────────────────────────────

function jaccardSim(setA, setB) {
  let inter = 0
  for (const tag of setA) if (setB.has(tag)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

function jaccardColor(j) {
  // 0 → #f1f5f9 (very light), 1 → #1D9E75 (ACC green)
  return `rgb(${lerp(241,29,j)},${lerp(245,158,j)},${lerp(249,117,j)})`
}

function jaccardTextColor(j) { return j >= 0.5 ? '#fff' : '#374151' }

// ── Greedy cluster ordering ───────────────────────────────────────────────────

function greedyOrder(n, matrix) {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i)

  let startIdx = 0
  let maxSum   = -1
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += matrix[i][j]
    if (s > maxSum) { maxSum = s; startIdx = i }
  }

  const visited = new Array(n).fill(false)
  const order   = [startIdx]
  visited[startIdx] = true

  while (order.length < n) {
    const last = order[order.length - 1]
    let best = -1, bestSim = -1
    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[last][j] > bestSim) {
        bestSim = matrix[last][j]; best = j
      }
    }
    if (best === -1) break
    order.push(best)
    visited[best] = true
  }
  return order
}

// ── Category classifier (same as E3) ─────────────────────────────────────────

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

const CAT_COLORS = {
  Equity: '#1D9E75', Debt: '#3b82f6', Hybrid: '#8b5cf6',
  Gold: '#f59e0b',   Liquid: '#06b6d4', Other: '#9ca3af',
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

// ── Heatmap grid ──────────────────────────────────────────────────────────────

const CELL = 28
const LABEL_W = 24

function HeatmapGrid({ schemes, matrix, orderedIdx }) {
  const ordered = orderedIdx.map(i => schemes[i])
  const n = ordered.length

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'inline-block', fontFamily: FONT }}>
        {/* Column number header */}
        <div style={{ display: 'flex', marginLeft: LABEL_W + 4 }}>
          {ordered.map((_, ci) => (
            <div key={ci} style={{
              width: CELL, height: CELL,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#9ca3af',
            }}>
              {orderedIdx[ci] + 1}
            </div>
          ))}
        </div>
        {/* Rows */}
        {ordered.map((_, ri) => {
          const ri_orig = orderedIdx[ri]
          return (
            <div key={ri} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Row number label */}
              <div style={{
                width: LABEL_W, textAlign: 'center',
                fontSize: 9, fontWeight: 700, color: '#9ca3af', flexShrink: 0,
              }}>
                {ri_orig + 1}
              </div>
              <div style={{ width: 4 }} />
              {/* Cells */}
              {ordered.map((_, ci) => {
                const ci_orig = orderedIdx[ci]
                const j = matrix[ri_orig][ci_orig]
                const isDiag = ri_orig === ci_orig
                return (
                  <div
                    key={ci}
                    title={isDiag
                      ? schemes[ri_orig].scheme_name
                      : `${schemes[ri_orig].scheme_name} vs ${schemes[ci_orig].scheme_name}: ${(j * 100).toFixed(0)}% similarity`
                    }
                    style={{
                      width: CELL, height: CELL,
                      background: jaccardColor(j),
                      border: isDiag ? `1.5px solid ${ACC}` : '1px solid #fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700,
                      color: j >= 0.4 ? jaccardTextColor(j) : 'transparent',
                      cursor: 'default',
                      boxSizing: 'border-box',
                    }}
                  >
                    {!isDiag && j >= 0.4 ? Math.round(j * 100) : ''}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Scheme legend ─────────────────────────────────────────────────────────────

function SchemeLegend({ schemes, orderedIdx }) {
  return (
    <div style={s.legend}>
      {orderedIdx.map((origIdx, pos) => {
        const h   = schemes[origIdx]
        const cat = classifyScheme(h.scheme_name)
        return (
          <div key={origIdx} style={s.legendRow}>
            <span style={s.legendNum}>{origIdx + 1}</span>
            <span style={{
              ...s.legendCat,
              background: (CAT_COLORS[cat] ?? '#9ca3af') + '20',
              color:      CAT_COLORS[cat] ?? '#9ca3af',
            }}>
              {cat}
            </span>
            <span style={s.legendName} title={h.scheme_name}>{h.scheme_name}</span>
            <span style={s.legendAmc}>{h.amc}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Ranked pairs ──────────────────────────────────────────────────────────────

const OVERLAP_LEVELS = [
  { label: 'High overlap',     min: 0.65, color: '#dc2626', bg: '#fee2e2', icon: '⚠' },
  { label: 'Moderate overlap', min: 0.35, color: '#d97706', bg: '#fef3c7', icon: '~' },
  { label: 'Low overlap',      min: 0.10, color: '#16a34a', bg: '#dcfce7', icon: '✓' },
]

function overlapLevel(j) {
  if (j >= 0.65) return OVERLAP_LEVELS[0]
  if (j >= 0.35) return OVERLAP_LEVELS[1]
  if (j >= 0.10) return OVERLAP_LEVELS[2]
  return null
}

function RankedPairs({ schemes, pairs }) {
  const meaningful = pairs.filter(p => p.j >= 0.10)
  if (meaningful.length === 0) {
    return (
      <div style={s.noOverlap}>
        <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>✓</span>
        <strong>No significant overlap detected.</strong><br />
        Your holdings cover distinct investment styles — well diversified.
      </div>
    )
  }

  const grouped = [
    { level: OVERLAP_LEVELS[0], items: meaningful.filter(p => p.j >= 0.65) },
    { level: OVERLAP_LEVELS[1], items: meaningful.filter(p => p.j >= 0.35 && p.j < 0.65) },
    { level: OVERLAP_LEVELS[2], items: meaningful.filter(p => p.j >= 0.10 && p.j < 0.35) },
  ].filter(g => g.items.length > 0)

  return (
    <div>
      {grouped.map(({ level, items }) => (
        <div key={level.label} style={{ marginBottom: '1rem' }}>
          <div style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 700, color: level.color,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              background: level.bg, color: level.color,
              borderRadius: 5, padding: '2px 8px',
            }}>
              {level.icon} {level.label}
            </span>
            <span style={{ color: '#9ca3af', fontWeight: 500 }}>({items.length} pair{items.length > 1 ? 's' : ''})</span>
          </div>
          {items.slice(0, 12).map((p, i) => {
            const a = schemes[p.i]
            const b = schemes[p.j_idx]
            return (
              <div key={i} style={s.pairRow}>
                <div style={s.pairSchemes}>
                  <span style={s.pairScheme} title={a.scheme_name}>{a.scheme_name}</span>
                  <span style={s.pairVs}>vs</span>
                  <span style={s.pairScheme} title={b.scheme_name}>{b.scheme_name}</span>
                </div>
                <div style={s.pairBarWrap}>
                  <div style={{
                    ...s.pairBar,
                    width: `${(p.j * 100).toFixed(1)}%`,
                    background: level.color,
                    opacity: 0.6,
                  }} />
                </div>
                <div style={{ ...s.pairPct, color: level.color }}>
                  {Math.round(p.j * 100)}%
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function E4Overlap() {
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

  // Cap at MAX_SCHEMES by invested amount (already sorted by engine)
  const schemes = useMemo(
    () => activeHoldings.slice(0, MAX_SCHEMES),
    [activeHoldings]
  )

  // Build tags and similarity matrix
  const { matrix, orderedIdx, pairs } = useMemo(() => {
    const n = schemes.length
    if (n < 2) return { matrix: [], orderedIdx: [], pairs: [] }

    const tags = schemes.map(h => extractTags(h.scheme_name))

    // N×N similarity matrix
    const mat = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        i === j ? 1 : jaccardSim(tags[i], tags[j])
      )
    )

    // Greedy cluster ordering
    const order = greedyOrder(n, mat)

    // All off-diagonal pairs sorted by similarity desc
    const pairList = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairList.push({ i, j_idx: j, j: mat[i][j] })
      }
    }
    pairList.sort((a, b) => b.j - a.j)

    return { matrix: mat, orderedIdx: order, pairs: pairList }
  }, [schemes])

  // Portfolio-level overlap summary
  const avgOverlap = useMemo(() => {
    if (pairs.length === 0) return null
    const sum = pairs.reduce((s, p) => s + p.j, 0)
    return sum / pairs.length
  }, [pairs])

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

  if (activeHoldings.length < 2) {
    return (
      <div>
        {portfolios.length > 1 && (
          <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
        )}
        <div style={s.emptyWrap}>
          <div style={s.emptyIcon}>🔍</div>
          <h2 style={s.emptyTitle}>
            {activeHoldings.length === 0 ? 'No holdings data' : 'Need at least 2 holdings'}
          </h2>
          <p style={s.emptySub}>
            {activeHoldings.length === 0
              ? 'Upload your CAMS and KFin files in the Data Manager to load holdings.'
              : 'Add more funds to your portfolio to analyse overlap between them.'}
          </p>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
            Go to Data Manager
          </button>
        </div>
      </div>
    )
  }

  const overlapLabel = avgOverlap == null ? null
    : avgOverlap >= 0.50 ? { text: 'High concentration', color: '#dc2626', bg: '#fee2e2' }
    : avgOverlap >= 0.30 ? { text: 'Some overlap',       color: '#d97706', bg: '#fef3c7' }
    :                      { text: 'Well diversified',   color: '#16a34a', bg: '#dcfce7' }

  return (
    <div>
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={setSelectedId} />
      )}

      {/* Page header */}
      <div style={s.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={s.pageTitle}>Overlap Analysis</h1>
          {overlapLabel && (
            <span style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              padding: '3px 10px', borderRadius: 8,
              background: overlapLabel.bg, color: overlapLabel.color,
            }}>
              {overlapLabel.text}
            </span>
          )}
        </div>
        <p style={s.pageSub}>
          {schemes.length} scheme{schemes.length !== 1 ? 's' : ''}
          {activeHoldings.length > MAX_SCHEMES
            ? ` (top ${MAX_SCHEMES} by invested amount shown)`
            : ''} · {portfolio.name}
        </p>
      </div>

      {/* Disclaimer */}
      <div style={s.disclaimer}>
        <span style={{ marginRight: 6 }}>ℹ</span>
        Overlap is estimated from scheme investment style inferred from scheme names —
        not from actual underlying stock holdings. Index funds sharing the same benchmark
        will show near-100% similarity.
      </div>

      {/* Heatmap section — desktop only */}
      {!mobile && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Similarity Matrix</span>
            <span style={s.sectionHint}>Darker = more overlap · hover for detail · ordered by similarity cluster</span>
          </div>
          <div style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <HeatmapGrid schemes={schemes} matrix={matrix} orderedIdx={orderedIdx} />
            <div style={{ flex: 1, minWidth: 200 }}>
              {/* Color scale legend */}
              <div style={s.scaleLegend}>
                <div style={{
                  height: 12, borderRadius: 4, flex: 1,
                  background: `linear-gradient(to right, ${jaccardColor(0)}, ${jaccardColor(0.5)}, ${jaccardColor(1)})`,
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT, fontSize: 9, color: '#9ca3af', marginTop: 3 }}>
                  <span>0% (different)</span>
                  <span>100% (identical)</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${ACC}10`, padding: '0.875rem 1.25rem' }}>
            <SchemeLegend schemes={schemes} orderedIdx={orderedIdx} />
          </div>
        </div>
      )}

      {/* Ranked pairs */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Ranked Overlap Pairs</span>
          <span style={s.sectionHint}>{pairs.filter(p => p.j >= 0.10).length} pair{pairs.filter(p => p.j >= 0.10).length !== 1 ? 's' : ''} with meaningful overlap</span>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <RankedPairs schemes={schemes} pairs={pairs} />
        </div>
      </div>

      {/* Scheme list on mobile */}
      {mobile && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionTitle}>Scheme Index</span>
          </div>
          <div style={{ padding: '0.875rem 1.25rem' }}>
            <SchemeLegend schemes={schemes} orderedIdx={schemes.map((_, i) => i)} />
          </div>
        </div>
      )}
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

  // Disclaimer
  disclaimer: { fontFamily: FONT, fontSize: 12, color: '#6b7280', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', marginBottom: '1rem', lineHeight: 1.6 },

  // Section
  section:       { background: '#fff', borderRadius: 16, border: `1px solid ${ACC}18`, overflow: 'hidden', marginBottom: '1.25rem', boxShadow: `0 1px 8px ${ACC}06` },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.25rem', borderBottom: `1px solid ${ACC}10`, flexWrap: 'wrap', gap: 6 },
  sectionTitle:  { fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#0d3d2b' },
  sectionHint:   { fontFamily: FONT, fontSize: 11, color: '#9ca3af' },

  // Color scale bar
  scaleLegend: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 },

  // Legend
  legend:     { display: 'flex', flexDirection: 'column', gap: 4 },
  legendRow:  { display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT },
  legendNum:  { fontSize: 10, fontWeight: 700, color: '#9ca3af', minWidth: 18, textAlign: 'right' },
  legendCat:  { fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
  legendName: { fontSize: 11, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 },
  legendAmc:  { fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' },

  // Ranked pairs
  noOverlap: { fontFamily: FONT, fontSize: 13, color: '#16a34a', textAlign: 'center', padding: '1.5rem', lineHeight: 1.8 },
  pairRow:   { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  pairSchemes:{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, overflow: 'hidden' },
  pairScheme: { fontFamily: FONT, fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40%' },
  pairVs:     { fontFamily: FONT, fontSize: 10, color: '#9ca3af', flexShrink: 0 },
  pairBarWrap:{ width: 80, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', flexShrink: 0 },
  pairBar:    { height: '100%', borderRadius: 3, minWidth: 2, transition: 'width 0.3s ease' },
  pairPct:    { fontFamily: FONT, fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: 'right', flexShrink: 0 },

  // Buttons
  btn:        { padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: FONT, fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1 },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
