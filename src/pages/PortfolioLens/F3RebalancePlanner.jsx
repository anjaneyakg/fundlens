import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const WARN = '#f59e0b'
const FAIL = '#ef4444'

const MACRO_COLORS = { Equity: '#1D9E75', Hybrid: '#6366f1', Debt: '#f59e0b', Liquid: '#3b82f6' }
const MACRO_ICONS  = { Equity: '📈', Hybrid: '⚖️', Debt: '🏦', Liquid: '💧' }
const MACROS       = ['Equity', 'Hybrid', 'Debt', 'Liquid']
const PLAN_KEY     = 'fundlens_rebalance_plan_v1'
const LTCG_EXEMPT  = 125000

const PRESETS = {
  Conservative: { Equity: 20, Hybrid: 20, Debt: 50, Liquid: 10 },
  Balanced:     { Equity: 50, Hybrid: 15, Debt: 25, Liquid: 10 },
  Aggressive:   { Equity: 75, Hybrid: 10, Debt: 10, Liquid:  5 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd  = String(d.getDate()).padStart(2, '0')
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]
  return `${dd} ${mon} ${d.getFullYear()}`
}

function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
  return (n < 0 ? '-₹' : '₹') + abs
}

function computeHoldingDays(h) {
  if (h.first_investment_date) {
    const d = new Date(h.first_investment_date)
    if (!isNaN(d.getTime())) return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  }
  return h.holding_period_days ?? 0
}

// Identical regex to F1HealthCheck / F2Alerts — keep in sync
function inferCategory(schemeName) {
  const n = (schemeName ?? '').toLowerCase()
  if (/liquid|overnight|money market|ultra short|ultra-short/.test(n))         return 'liquid'
  if (/\bdebt\b|bond|gilt|banking and psu|banking & psu|corporate bond|dynamic bond|short duration|medium duration|long duration|credit risk|floater/.test(n)) return 'debt'
  if (/arbitrage/.test(n))                                                      return 'arbitrage'
  if (/hybrid|balanced advantage|conservative hybrid|equity savings|multi asset|asset allocator/.test(n)) return 'hybrid'
  if (/elss|tax saver|tax saving/.test(n))                                      return 'elss'
  if (/\bindex\b|nifty|sensex|nasdaq|s&p 500|exchange traded|\betf\b/.test(n)) return 'equity_passive'
  if (/\bbanking\b|financial services|\btechnology\b|\btech\b|infrastructure|infra|pharma|healthcare|consumption|energy|\bpsu\b|dividend yield/.test(n)) return 'equity_sector'
  return 'equity'
}

function macroCategory(cat) {
  if (['equity', 'elss', 'equity_passive', 'equity_sector'].includes(cat)) return 'Equity'
  if (cat === 'hybrid')                                                      return 'Hybrid'
  if (['debt', 'arbitrage'].includes(cat))                                   return 'Debt'
  return 'Liquid'  // liquid, overnight, money market, etc.
}

// ── Allocation engine ─────────────────────────────────────────────────────────

function computeAlloc(active, useCurrent) {
  const byMacro = { Equity: 0, Hybrid: 0, Debt: 0, Liquid: 0 }
  const schemes  = { Equity: [], Hybrid: [], Debt: [], Liquid: [] }
  for (const h of active) {
    const macro = macroCategory(inferCategory(h.scheme_name))
    const val   = useCurrent && h.current_value != null ? h.current_value : h.invested_amount
    byMacro[macro] += val
    schemes[macro].push(h)
  }
  const total = Object.values(byMacro).reduce((s, v) => s + v, 0)
  const pcts  = {}
  for (const m of MACROS) pcts[m] = total > 0 ? Math.round((byMacro[m] / total) * 1000) / 10 : 0
  return { byMacro, pcts, total, schemes }
}

// ── Rebalance plan engine ─────────────────────────────────────────────────────
// Tax-efficient lot ordering: LTCG-eligible holdings redeemed first within each category.
// Equity/Hybrid LTCG threshold: 365 days | Debt LTCG threshold: 1095 days (3 years)

function buildRebalancePlan(active, targets, useCurrent) {
  if (active.length === 0) {
    return {
      redemptions: [], investments: [],
      equityLTCG: 0, ltcgTaxable: 0, ltcgTax: 0,
      totalSTCG: 0, totalDebtLTCG: 0, totalKnownTax: 0,
      hasSlabTax: false, totalRedeemVal: 0, netProceeds: 0,
      alloc: computeAlloc([], false), targets, useCurrent,
      builtAt: new Date().toISOString(),
    }
  }

  const alloc          = computeAlloc(active, useCurrent)
  const { total, byMacro } = alloc
  if (total === 0) {
    return {
      redemptions: [], investments: [],
      equityLTCG: 0, ltcgTaxable: 0, ltcgTax: 0,
      totalSTCG: 0, totalDebtLTCG: 0, totalKnownTax: 0,
      hasSlabTax: false, totalRedeemVal: 0, netProceeds: 0,
      alloc, targets, useCurrent, builtAt: new Date().toISOString(),
    }
  }

  const redemptions = []
  const investments = []

  for (const macro of MACROS) {
    const current = byMacro[macro]
    const target  = (Number(targets[macro] || 0) / 100) * total
    const diff    = target - current  // positive = buy more, negative = sell down

    if (diff <= -1000) {
      // Over-weight: need to redeem |diff|
      let remaining  = Math.abs(diff)
      // LTCG threshold: equity/hybrid = 365d, debt = 1095d
      const threshold = (macro === 'Equity' || macro === 'Hybrid') ? 365 : 1095

      const candidates = alloc.schemes[macro]
        .filter(h => h.units > 0)
        .map(h => ({ ...h, _days: computeHoldingDays(h) }))
        .sort((a, b) => {
          // LTCG-eligible first; within each group, older first
          const aIsLT = a._days >= threshold
          const bIsLT = b._days >= threshold
          if (aIsLT !== bIsLT) return aIsLT ? -1 : 1
          return b._days - a._days
        })

      for (const h of candidates) {
        if (remaining <= 0) break
        const val = useCurrent && h.current_value != null ? h.current_value : h.invested_amount
        if (val <= 0) continue

        const redeemVal = Math.min(remaining, val)
        const fraction  = redeemVal / val
        const gain      = (h.unrealised_gain ?? 0) * fraction
        const days      = h._days

        let taxType, taxAmt
        if (macro === 'Equity' || macro === 'Hybrid') {
          if (days >= 365) { taxType = 'LTCG';      taxAmt = null }  // aggregated below with exemption
          else             { taxType = 'STCG';      taxAmt = Math.round(Math.max(0, gain) * 0.20) }
        } else {
          if (days >= 1095) { taxType = 'LTCG_debt'; taxAmt = Math.round(Math.max(0, gain) * 0.125) }
          else              { taxType = 'STCG_debt'; taxAmt = null }  // slab rate — can't compute
        }

        // Units to redeem: use current_nav if available, else proportional
        let redeemUnits = null
        if (h.current_nav && h.current_nav > 0) {
          redeemUnits = Math.round((redeemVal / h.current_nav) * 1000) / 1000
        } else if (h.units > 0 && val > 0) {
          redeemUnits = Math.round((fraction * h.units) * 1000) / 1000
        }

        redemptions.push({
          macro,
          scheme_name:      h.scheme_name,
          amc:              h.amc ?? '',
          redeemValue:      Math.round(redeemVal),
          redeemUnits,
          gain:             Math.round(gain),
          holdingDays:      days,
          taxType,
          taxAmt,
          isFullRedemption: fraction >= 0.999,
        })

        remaining -= redeemVal
      }
    } else if (diff >= 1000) {
      // Under-weight: need to invest more
      investments.push({ macro, amount: Math.round(diff) })
    }
  }

  // Aggregate LTCG equity gains and apply ₹1.25L annual exemption
  const equityLTCG  = redemptions
    .filter(r => r.taxType === 'LTCG')
    .reduce((s, r) => s + Math.max(0, r.gain), 0)
  const ltcgTaxable = Math.max(0, equityLTCG - LTCG_EXEMPT)
  const ltcgTax     = Math.round(ltcgTaxable * 0.125)

  const totalSTCG     = redemptions.filter(r => r.taxType === 'STCG').reduce((s, r) => s + (r.taxAmt ?? 0), 0)
  const totalDebtLTCG = redemptions.filter(r => r.taxType === 'LTCG_debt').reduce((s, r) => s + (r.taxAmt ?? 0), 0)
  const totalKnownTax = totalSTCG + ltcgTax + totalDebtLTCG
  const hasSlabTax    = redemptions.some(r => r.taxType === 'STCG_debt')
  const totalRedeemVal= redemptions.reduce((s, r) => s + r.redeemValue, 0)

  return {
    redemptions, investments,
    equityLTCG: Math.round(equityLTCG), ltcgTaxable: Math.round(ltcgTaxable), ltcgTax,
    totalSTCG, totalDebtLTCG, totalKnownTax, hasSlabTax,
    totalRedeemVal: Math.round(totalRedeemVal),
    netProceeds:    Math.round(totalRedeemVal - totalKnownTax),
    alloc, targets, useCurrent,
    builtAt: new Date().toISOString(),
  }
}

// ── localStorage helpers ───────────────────────────────────────────────────────

function savePlanToStorage(plan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
  } catch (e) {
    console.error('F3RebalancePlanner: savePlanToStorage failed', e)
  }
}

// ── Donut chart (SVG, stroke-dasharray approach) ──────────────────────────────

function DonutChart({ data, size = 120, label }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const R     = size / 2 - 11
  const C     = 2 * Math.PI * R
  const cx    = size / 2
  const cy    = size / 2
  const GAP   = 2.5  // visual gap between segments in px

  if (total === 0) return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f0f0f0" strokeWidth={13} />
      </svg>
      {label && <div style={s.donutLabel}>{label}</div>}
    </div>
  )

  let cumDash = 0
  const segs = data.map(d => {
    const dash  = (d.value / total) * C
    const seg   = { ...d, dashLen: Math.max(0, dash - GAP), offset: -cumDash }
    cumDash += dash
    return seg
  })

  return (
    <div style={{ textAlign: 'center' }}>
      {/* rotate(-90deg) starts arc at 12-o'clock position */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
           style={{ display: 'block', margin: '0 auto', transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f5f5f5" strokeWidth={13} />
        {segs.map(seg => (
          <circle
            key={seg.label}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={13}
            strokeLinecap="butt"
            strokeDasharray={`${seg.dashLen} ${C}`}
            strokeDashoffset={seg.offset}
          />
        ))}
      </svg>
      {label && <div style={s.donutLabel}>{label}</div>}
    </div>
  )
}

// ── Allocation colour legend ───────────────────────────────────────────────────

function AllocLegend({ pcts }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
      {MACROS.map(m => (
        <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: MACRO_COLORS[m], flexShrink: 0 }} />
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: '#374151' }}>
            {m} {pcts[m]}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ['Current', 'Target', 'Plan', 'Summary']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
      {steps.map((label, i) => {
        const num    = i + 1
        const done   = num < step
        const active = num === step
        const isLast = i === steps.length - 1
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? ACC : '#f0f0f0',
                color: done || active ? '#fff' : '#9ca3af',
                fontSize: 11, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                {done ? '✓' : num}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: active ? ACC : done ? '#374151' : '#9ca3af',
              }}>
                {label}
              </div>
            </div>
            {!isLast && (
              <div style={{
                flex: 1, height: 2,
                background: done ? ACC : '#f0f0f0',
                margin: '0 6px', marginBottom: 14,
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Portfolio selector ─────────────────────────────────────────────────────────

function PortfolioSelector({ portfolios, selectedId, onChange }) {
  return (
    <div style={s.selectorRow}>
      <label style={s.selectorLabel}>Portfolio</label>
      <select style={s.selector} value={selectedId ?? ''} onChange={e => onChange(e.target.value)}>
        {portfolios.map(p => (
          <option key={p.portfolio_id} value={p.portfolio_id}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}

// ── Tax type badge ─────────────────────────────────────────────────────────────

function TaxBadge({ taxType, taxAmt }) {
  const cfg = {
    LTCG:      { label: 'LTCG 12.5%', bg: '#f0fdf4', color: ACC  },
    STCG:      { label: 'STCG 20%',   bg: '#fef2f2', color: FAIL },
    LTCG_debt: { label: 'LTCG 12.5%', bg: '#fef9eb', color: WARN },
    STCG_debt: { label: 'STCG (slab)', bg: '#f5f3ff', color: '#7c3aed' },
  }[taxType] ?? { label: taxType, bg: '#f9fafb', color: '#6b7280' }

  return (
    <span style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20, flexShrink: 0,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}{taxAmt != null ? ` ≈${fmtINR(taxAmt)}` : ''}
    </span>
  )
}

// ── Step 1: Current Allocation ─────────────────────────────────────────────────

function Step1CurrentAllocation({ alloc, hasCurrentNav }) {
  const donutData = MACROS.map(m => ({ label: m, value: alloc.byMacro[m], color: MACRO_COLORS[m] }))

  return (
    <div>
      <div style={s.stepTitle}>Your current allocation</div>
      <p style={s.stepSub}>
        {hasCurrentNav
          ? 'Based on current market value from your Holdings snapshot.'
          : 'Based on invested cost amounts — upload a CAMS Holdings snapshot for live market values.'}
      </p>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {/* Donut + legend */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: 130 }}>
          <DonutChart data={donutData} size={130} label="Current" />
          <AllocLegend pcts={alloc.pcts} />
        </div>

        {/* Allocation table */}
        <div style={{ flex: 1, minWidth: 200, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                <th style={s.th}>Category</th>
                <th style={{ ...s.th, textAlign: 'right' }}>{hasCurrentNav ? 'Market value' : 'Invested'}</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Share</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Schemes</th>
              </tr>
            </thead>
            <tbody>
              {MACROS.map(macro => {
                const val   = alloc.byMacro[macro]
                const pct   = alloc.pcts[macro]
                const count = alloc.schemes[macro].filter(h => h.units > 0).length
                return (
                  <tr key={macro} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: MACRO_COLORS[macro], flexShrink: 0 }} />
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {MACRO_ICONS[macro]} {macro}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#374151' }}>
                      {fmtINR(Math.round(val))}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: MACRO_COLORS[macro] }}>
                        {pct}%
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#9ca3af' }}>
                      {count}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid #f0f0f0' }}>
                <td colSpan={1} style={{ ...s.td, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#111827' }}>Total</td>
                <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  {fmtINR(Math.round(alloc.total))}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!hasCurrentNav && (
        <div style={s.infoNote}>
          ℹ️ Upload a CAMS Current Valuation snapshot in F6 Data Manager to use live market values.
          The plan still works with invested amounts as a cost-basis proxy.
        </div>
      )}
    </div>
  )
}

// ── Step 2: Target Allocation ──────────────────────────────────────────────────

function Step2TargetAllocation({ currentAlloc, targets, setTargets }) {
  const targetTotal = MACROS.reduce((s, m) => s + Number(targets[m] || 0), 0)
  const isValid     = Math.abs(targetTotal - 100) < 0.1

  const currentDonutData = MACROS.map(m => ({ label: m, value: currentAlloc.pcts[m], color: MACRO_COLORS[m] }))
  const targetDonutData  = MACROS.map(m => ({ label: m, value: Number(targets[m] || 0), color: MACRO_COLORS[m] }))
  const targetPcts = {}
  for (const m of MACROS) targetPcts[m] = Number(targets[m] || 0)

  return (
    <div>
      <div style={s.stepTitle}>Set your target allocation</div>
      <p style={s.stepSub}>
        Enter your desired allocation percentages — they must total exactly 100%.
        Use a preset to start, then fine-tune as needed.
      </p>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.keys(PRESETS).map(name => (
          <button key={name} style={s.presetBtn} onClick={() => setTargets({ ...PRESETS[name] })}>
            {name}
          </button>
        ))}
      </div>

      {/* Input grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {MACROS.map(macro => (
          <div key={macro} style={{ ...s.inputCard, borderColor: MACRO_COLORS[macro] + '40' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: MACRO_COLORS[macro], flexShrink: 0 }} />
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, color: '#374151' }}>
                {MACRO_ICONS[macro]} {macro}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="number"
                min={0} max={100} step={1}
                value={targets[macro]}
                onChange={e => setTargets(prev => ({
                  ...prev,
                  [macro]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                }))}
                style={s.pctInput}
              />
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 700, color: '#9ca3af' }}>%</span>
            </div>
            <div style={{ marginTop: 5, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#9ca3af' }}>
              Now: {currentAlloc.pcts[macro]}%
            </div>
          </div>
        ))}
      </div>

      {/* Totals validation bar */}
      <div style={{ ...s.totalBar, background: isValid ? `${ACC}10` : '#fef2f2', borderColor: isValid ? `${ACC}30` : '#fca5a5' }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: isValid ? ACC : FAIL }}>
          Total: {targetTotal}%
        </span>
        {!isValid && (
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: FAIL, marginLeft: 10 }}>
            Must equal 100% ({targetTotal > 100 ? `over by ${targetTotal - 100}%` : `under by ${100 - targetTotal}%`})
          </span>
        )}
        {isValid && (
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: ACC, marginLeft: 10 }}>
            ✓ Ready to generate plan
          </span>
        )}
      </div>

      {/* Side-by-side donuts */}
      <div style={{ display: 'flex', gap: '2.5rem', justifyContent: 'center', marginTop: '1.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <DonutChart data={currentDonutData} size={120} label="Current" />
          <AllocLegend pcts={currentAlloc.pcts} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 22, color: '#d1d5db', paddingTop: 40 }}>→</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <DonutChart data={targetDonutData} size={120} label="Target" />
          <AllocLegend pcts={targetPcts} />
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Rebalance Plan ─────────────────────────────────────────────────────

function Step3RebalancePlan({ plan }) {
  const { redemptions, investments, equityLTCG, ltcgTaxable, ltcgTax, hasSlabTax } = plan
  const hasRedemptions = redemptions.length > 0
  const hasInvestments = investments.length > 0

  // Group redemptions by macro category
  const byMacro = {}
  for (const r of redemptions) {
    if (!byMacro[r.macro]) byMacro[r.macro] = []
    byMacro[r.macro].push(r)
  }

  return (
    <div>
      <div style={s.stepTitle}>Your rebalance plan</div>
      <p style={s.stepSub}>
        Holdings are ordered tax-efficiently: LTCG-eligible lots (≥12 months equity / ≥36 months debt) are redeemed before short-term lots to minimise tax.
      </p>

      {!hasRedemptions && !hasInvestments && (
        <div style={s.infoNote}>
          ✅ Your portfolio is already aligned with your target allocation — no significant rebalancing needed.
        </div>
      )}

      {/* Sell side */}
      {hasRedemptions && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={s.sectionTitle}>📤 Schemes to redeem</div>
          {Object.entries(byMacro).map(([macro, items]) => {
            const macroTotal = items.reduce((s, r) => s + r.redeemValue, 0)
            return (
              <div key={macro} style={{ marginBottom: '1rem' }}>
                <div style={s.macroHeader}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: MACRO_COLORS[macro], flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    {MACRO_ICONS[macro]} {macro} — redeem {fmtINR(macroTotal)}
                  </span>
                </div>
                <div style={s.schemeTable}>
                  {items.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        ...s.schemeRow,
                        borderBottom: i < items.length - 1 ? '1px solid #f5f5f5' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 3 }}>
                          {r.scheme_name.length > 62 ? r.scheme_name.slice(0, 60) + '…' : r.scheme_name}
                          {r.isFullRedemption && (
                            <span style={s.fullChip}>Full</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#9ca3af' }}>
                          {r.amc} · {r.holdingDays} days held
                          {r.redeemUnits != null
                            ? ` · ${r.redeemUnits.toLocaleString('en-IN')} units`
                            : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#111827' }}>
                          {fmtINR(r.redeemValue)}
                        </span>
                        <TaxBadge taxType={r.taxType} taxAmt={r.taxAmt} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* LTCG equity note */}
          {equityLTCG > 0 && (
            <div style={{ ...s.infoNote, marginTop: '0.75rem' }}>
              💡 Total equity LTCG being realised: {fmtINR(equityLTCG)}.
              {ltcgTaxable > 0
                ? ` Taxable above ₹1.25L exemption: ${fmtINR(ltcgTaxable)} → estimated tax ≈${fmtINR(ltcgTax)} @ 12.5%.`
                : ` Within the ₹1.25L annual exemption — no LTCG tax.`}
            </div>
          )}
          {hasSlabTax && (
            <div style={{ ...s.infoNote, marginTop: 8 }}>
              ⚠️ Some debt holdings are short-term (&lt;3 years). Those gains are taxed at your income slab rate — consult a tax advisor for the exact amount.
            </div>
          )}
        </div>
      )}

      {/* Buy side */}
      {hasInvestments && (
        <div>
          <div style={s.sectionTitle}>📥 Categories to top up</div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
            Select your preferred schemes in each under-weight category and invest the indicated amount.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {investments.map(inv => (
              <div key={inv.macro} style={s.investCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: MACRO_COLORS[inv.macro], flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    {MACRO_ICONS[inv.macro]} {inv.macro}
                  </span>
                </div>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, fontWeight: 800, color: MACRO_COLORS[inv.macro] }}>
                  {fmtINR(inv.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Summary ────────────────────────────────────────────────────────────

function Step4Summary({ plan, onSave, planSaved, navigate }) {
  const { redemptions, investments, totalRedeemVal, totalKnownTax, netProceeds, hasSlabTax, builtAt } = plan
  const totalInvest = investments.reduce((s, i) => s + i.amount, 0)

  return (
    <div>
      <div style={s.stepTitle}>Rebalance summary</div>
      <p style={s.stepSub}>
        Review your complete plan. Save it to your device for reference when you log in to your RTA portal.
      </p>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {[
          { label: 'To redeem',    value: fmtINR(totalRedeemVal), color: FAIL },
          { label: 'Est. tax',     value: hasSlabTax ? `≈${fmtINR(totalKnownTax)} + slab` : fmtINR(totalKnownTax), color: WARN },
          { label: 'Net proceeds', value: fmtINR(netProceeds),    color: ACC  },
          { label: 'To invest',    value: fmtINR(totalInvest),    color: '#6366f1' },
        ].map(card => (
          <div key={card.label} style={s.summaryCard}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 19, fontWeight: 800, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed redemption table */}
      {redemptions.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={s.sectionTitle}>Redemption list</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={s.th}>Scheme</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Redeem (₹)</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Units</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Tax type</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Est. tax</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f9f9f9' }}>
                    <td style={s.td}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: '#111827', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.scheme_name}
                      </div>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#9ca3af' }}>
                        {r.macro} · {r.holdingDays}d held
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: '#111827' }}>
                      {fmtINR(r.redeemValue)}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#6b7280' }}>
                      {r.redeemUnits != null ? r.redeemUnits.toLocaleString('en-IN') : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <TaxBadge taxType={r.taxType} taxAmt={null} />
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", color: r.taxType === 'STCG' ? FAIL : r.taxType === 'LTCG' ? WARN : r.taxType === 'LTCG_debt' ? WARN : '#7c3aed' }}>
                      {r.taxAmt != null
                        ? fmtINR(r.taxAmt)
                        : r.taxType === 'LTCG'
                          ? '(see below)'
                          : r.taxType === 'STCG_debt'
                            ? 'Slab'
                            : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #f0f0f0', background: '#f9fafb' }}>
                  <td style={{ ...s.td, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: '#111827' }}>Total</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: '#111827' }}>
                    {fmtINR(totalRedeemVal)}
                  </td>
                  <td colSpan={2} />
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: WARN }}>
                    {hasSlabTax ? `≈${fmtINR(totalKnownTax)} + slab` : fmtINR(totalKnownTax)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Plan built timestamp */}
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#9ca3af', marginBottom: '1.25rem' }}>
        Plan built: {fmtDate(builtAt)}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          style={{ ...s.btn, ...s.btnPrimary, ...(planSaved ? { background: '#6b7280', boxShadow: 'none' } : {}) }}
          onClick={onSave}
          disabled={planSaved}
        >
          {planSaved ? '✓ Plan saved' : '💾 Save plan to device'}
        </button>
        <button
          style={{ ...s.btn, background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb' }}
          onClick={() => navigate('/portfolio/f6')}
        >
          Update portfolio data
        </button>
      </div>
    </div>
  )
}

// ── Main F3RebalancePlanner page ───────────────────────────────────────────────

export default function F3RebalancePlanner() {
  const navigate   = useNavigate()
  const width      = useWindowWidth()
  const mobile     = width < 768   // eslint-disable-line no-unused-vars
  const portfolios = useMemo(() => getPortfolios(), [])

  const [step,       setStep]       = useState(1)
  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)
  const [targets,    setTargets]    = useState({ Equity: 50, Hybrid: 15, Debt: 25, Liquid: 10 })
  const [planSaved,  setPlanSaved]  = useState(false)

  const portfolio     = useMemo(() => portfolios.find(p => p.portfolio_id === selectedId) ?? null, [portfolios, selectedId])
  const active        = useMemo(() => (portfolio?.holdings ?? []).filter(h => h.units > 0), [portfolio])
  const hasCurrentNav = useMemo(() => active.some(h => h.current_value != null), [active])
  const alloc         = useMemo(() => computeAlloc(active, hasCurrentNav), [active, hasCurrentNav])

  const targetTotal  = MACROS.reduce((s, m) => s + Number(targets[m] || 0), 0)
  const targetsValid = Math.abs(targetTotal - 100) < 0.1

  // Always build the plan so steps 3 & 4 have it ready instantly
  const plan = useMemo(
    () => buildRebalancePlan(active, targets, hasCurrentNav),
    [active, targets, hasCurrentNav]
  )

  function handleSavePlan() {
    savePlanToStorage(plan)
    setPlanSaved(true)
  }

  function handlePortfolioChange(id) {
    setSelectedId(id)
    setStep(1)
    setPlanSaved(false)
  }

  // ── No portfolios ──────────────────────────────────────────────────────────
  if (portfolios.length === 0) {
    return (
      <div style={s.centreWrap}>
        <div style={s.emptyCard}>
          <div style={s.emptyIcon}>📋</div>
          <h2 style={s.emptyTitle}>No portfolio data yet</h2>
          <p style={s.emptySub}>
            Upload your CAMS and KFin transaction files in F6 Data Manager to use the rebalance planner.
          </p>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
            Go to Data Manager
          </button>
        </div>
      </div>
    )
  }

  // ── Portfolio with no active holdings ──────────────────────────────────────
  if (active.length === 0) {
    return (
      <div>
        {portfolios.length > 1 && (
          <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={handlePortfolioChange} />
        )}
        <div style={s.centreWrap}>
          <div style={s.emptyCard}>
            <div style={s.emptyIcon}>📂</div>
            <h2 style={s.emptyTitle}>No active holdings</h2>
            <p style={s.emptySub}>
              This portfolio has no active holdings. Upload CAMS or KFin transaction files to continue.
            </p>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
              Upload files
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main 4-step wizard ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>F3 Rebalance Planner</h1>
        <p style={s.pageSub}>4-step wizard · tax-aware lot selection · all analysis runs in your browser</p>
      </div>

      {/* Portfolio selector — shown only if multiple */}
      {portfolios.length > 1 && (
        <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={handlePortfolioChange} />
      )}

      {/* Step indicator */}
      <StepIndicator step={step} />

      {/* Step content panel */}
      <div style={s.stepPanel}>
        {step === 1 && (
          <Step1CurrentAllocation alloc={alloc} hasCurrentNav={hasCurrentNav} />
        )}
        {step === 2 && (
          <Step2TargetAllocation currentAlloc={alloc} targets={targets} setTargets={setTargets} />
        )}
        {step === 3 && (
          <Step3RebalancePlan plan={plan} />
        )}
        {step === 4 && (
          <Step4Summary
            plan={plan}
            onSave={handleSavePlan}
            planSaved={planSaved}
            navigate={navigate}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <button
          style={{
            ...s.btn,
            background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb',
            visibility: step === 1 ? 'hidden' : 'visible',
          }}
          onClick={() => setStep(p => p - 1)}
        >
          ← Back
        </button>

        {step < 4 ? (
          <button
            style={{
              ...s.btn, ...s.btnPrimary,
              ...(step === 2 && !targetsValid ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
            }}
            disabled={step === 2 && !targetsValid}
            onClick={() => { if (step === 2 && !targetsValid) return; setStep(p => p + 1) }}
          >
            {step === 3 ? 'View Summary →' : 'Next →'}
          </button>
        ) : (
          <button
            style={{ ...s.btn, background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb' }}
            onClick={() => { setStep(1); setPlanSaved(false) }}
          >
            Start over
          </button>
        )}
      </div>

      {/* Footer disclaimer */}
      <div style={s.footerNote}>
        <span style={s.footerDot} />
        Rebalance recommendations are indicative only. All analysis runs locally — no portfolio data leaves your device.
        Tax estimates apply Indian MF capital gains rules (FY 2024-25 onward): equity STCG 20%, equity LTCG 12.5% above ₹1.25L, debt LTCG 12.5% (post Jul 2024 budget — no indexation).
        Consult a SEBI RIA or tax advisor before executing redemptions.
        Analysed {fmtDate(new Date().toISOString())} · {portfolio?.name}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Empty / centre states
  centreWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  emptyCard:  {
    textAlign: 'center', padding: '2.5rem 3rem',
    background: '#fff', borderRadius: 20,
    border: `1px solid ${ACC}22`, boxShadow: `0 4px 24px ${ACC}08`, maxWidth: 420,
  },
  emptyIcon:  { fontSize: 40, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  emptySub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', lineHeight: 1.65, margin: '0 0 1.5rem' },

  // Page header
  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.2rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', margin: 0 },

  // Portfolio selector
  selectorRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' },
  selectorLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 },
  selector: {
    padding: '7px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif",
    background: '#fff', cursor: 'pointer', outline: 'none', maxWidth: 300, color: '#111827',
  },

  // Step panel
  stepPanel: {
    background: '#fff', borderRadius: 16,
    border: '1px solid #f0f0f0', padding: '1.5rem',
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    marginBottom: '0.5rem',
  },

  // Step content typography
  stepTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#0d3d2b', marginBottom: '0.4rem' },
  stepSub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.25rem' },

  // Section title (within a step)
  sectionTitle: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 700,
    color: '#6b7280', letterSpacing: '0.07em', textTransform: 'uppercase',
    marginBottom: '0.75rem',
  },
  macroHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 6px' },

  // Info note box
  infoNote: {
    background: '#f0fdf8', border: `1px solid ${ACC}30`,
    borderRadius: 10, padding: '0.75rem 1rem',
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#1a6b4a', lineHeight: 1.6,
  },

  // Table primitives
  th: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700,
    color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '8px 10px', textAlign: 'left',
  },
  td: { padding: '9px 10px', verticalAlign: 'top' },

  // Scheme card (Step 3 sell side)
  schemeTable: {
    background: '#fafafa', borderRadius: 12,
    border: '1px solid #f0f0f0', overflow: 'hidden',
  },
  schemeRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, padding: '10px 14px',
  },
  fullChip: {
    display: 'inline-block',
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 9, fontWeight: 700,
    letterSpacing: '0.06em', color: FAIL, background: '#fee2e2',
    padding: '1px 6px', borderRadius: 4, marginLeft: 6, verticalAlign: 'middle',
  },

  // Invest card (Step 3 buy side)
  investCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderRadius: 12,
    background: '#f9fafb', border: '1.5px solid #f0f0f0',
  },

  // Summary stat cards (Step 4)
  summaryCard: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #f0f0f0', padding: '1rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },

  // Step 2 target inputs
  presetBtn: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600,
    padding: '7px 16px', borderRadius: 10,
    border: `1.5px solid ${ACC}40`, background: `${ACC}08`, color: ACC, cursor: 'pointer',
  },
  inputCard: {
    background: '#fff', borderRadius: 12,
    border: '1.5px solid #f0f0f0', padding: '0.875rem 1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  pctInput: {
    width: 58, padding: '6px 8px', borderRadius: 8,
    border: '1.5px solid #e5e7eb', fontSize: 18, fontWeight: 800,
    fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#111827',
    textAlign: 'right', outline: 'none', background: '#f9fafb',
  },
  totalBar: {
    display: 'flex', alignItems: 'center',
    padding: '10px 14px', borderRadius: 10, border: '1.5px solid',
  },

  // Donut label (below SVG)
  donutLabel: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 600,
    color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase',
  },

  // Buttons
  btn: {
    padding: '9px 22px', borderRadius: 10, fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
    cursor: 'pointer', border: 'none', lineHeight: 1,
  },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },

  // Footer
  footerNote: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#b5d4cb', lineHeight: 1.55,
    paddingTop: '0.75rem', borderTop: `1px solid ${ACC}10`, marginTop: '1rem',
  },
  footerDot: {
    width: 6, height: 6, borderRadius: '50%', background: `${ACC}80`,
    flexShrink: 0, marginTop: 3,
  },
}
