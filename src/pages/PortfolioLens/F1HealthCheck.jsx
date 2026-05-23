import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const WARN = '#f59e0b'
const FAIL = '#ef4444'
const INFO = '#6366f1'

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

// ── Category inference from scheme name ──────────────────────────────────────
// Returns: 'liquid' | 'debt' | 'arbitrage' | 'hybrid' | 'elss' | 'equity_passive' | 'equity_sector' | 'equity'

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

function isEquityLike(cat) {
  return ['elss', 'equity_passive', 'equity_sector', 'equity', 'hybrid'].includes(cat)
}

// ── Health rule engine ────────────────────────────────────────────────────────
// Returns array of rule result objects.

function runRules(holdings) {
  const active = holdings.filter(h => h.units > 0)
  if (active.length === 0) return []

  const totalInvested = active.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
  if (totalInvested === 0) return []

  const categorised    = active.map(h => ({ ...h, cat: inferCategory(h.scheme_name) }))
  const equityHoldings = categorised.filter(h => isEquityLike(h.cat))
  const equityInvested = equityHoldings.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
  const liquidHoldings = categorised.filter(h => h.cat === 'liquid')
  const liquidInvested = liquidHoldings.reduce((s, h) => s + (h.invested_amount ?? 0), 0)

  const rules = []

  // ── R1: Direct Plan Adoption ─────────────────────────────────────────────
  const regularHoldings = active.filter(h => h.plan === 'Regular')
  const regularInvested = regularHoldings.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
  const regularPct      = (regularInvested / totalInvested) * 100

  rules.push({
    code: 'R1',
    name: 'Direct Plan Adoption',
    tagline: 'Regular plans charge 0.5–1.5% more in expense ratio every year',
    status: regularPct === 0 ? 'PASS' : regularPct < 30 ? 'WARN' : 'FAIL',
    score:  regularPct === 0 ? 100   : regularPct < 30 ? 60 : 20,
    headline: regularPct === 0
      ? `All ${active.length} holdings in Direct plans ✓`
      : `${regularHoldings.length} holding${regularHoldings.length !== 1 ? 's' : ''} in Regular plan · ${regularPct.toFixed(0)}% of invested value`,
    detail: regularPct === 0
      ? 'Excellent. All your holdings are in Direct plans. Direct plans do not pay distributor commission — saving you 0.5–1.2% per year in total expense ratio (TER). Over 20 years, this difference compounds to a very significant amount.'
      : `${fmtINR(Math.round(regularInvested))} is held in Regular plans. At a conservative 1% higher TER, this costs you approximately ${fmtINR(Math.round(regularInvested * 0.01))} per year in excess charges that go to distributors, not your wealth.`,
    recommendation: regularPct === 0 ? null
      : 'Switch these holdings to the Direct variant of the same fund. Redeem and reinvest in the Direct plan. Note: redemption triggers a capital gains event — account for tax before switching. For ELSS, wait for 3-year lock-in.',
    affectedSchemes: regularHoldings.map(h => h.scheme_name),
  })

  // ── R2: Growth Option Discipline ─────────────────────────────────────────
  const idcwHoldings = active.filter(h => h.option === 'IDCW')
  const idcwInvested = idcwHoldings.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
  const idcwPct      = (idcwInvested / totalInvested) * 100

  rules.push({
    code: 'R2',
    name: 'Growth Option Discipline',
    tagline: 'IDCW (dividend) options distribute gains as taxable income, reducing compounding',
    status: idcwPct === 0 ? 'PASS' : idcwPct < 20 ? 'WARN' : 'FAIL',
    score:  idcwPct === 0 ? 100   : idcwPct < 20 ? 60 : 20,
    headline: idcwPct === 0
      ? 'All holdings in Growth option ✓'
      : `${idcwHoldings.length} IDCW holding${idcwHoldings.length !== 1 ? 's' : ''} · ${idcwPct.toFixed(0)}% of invested value`,
    detail: idcwPct === 0
      ? 'All your holdings are in Growth option. Returns compound inside the fund without interruption. Tax is payable only on redemption — and only on the gain portion, at capital gains rates.'
      : 'IDCW (Income Distribution cum Capital Withdrawal) plans declare dividends periodically. These are taxed at your income tax slab rate — not the lower LTCG/STCG rates. This interrupts compounding and creates repeated taxable events each year.',
    recommendation: idcwPct === 0 ? null
      : 'Switch IDCW holdings to the Growth option of the same fund. This is a taxable redemption event — plan for capital gains. The long-term compounding benefit of Growth over IDCW is very significant.',
    affectedSchemes: idcwHoldings.map(h => h.scheme_name),
  })

  // ── R3: AMC Concentration ────────────────────────────────────────────────
  const amcMap = {}
  for (const h of active) {
    const amc = (h.amc ?? 'Unknown').trim() || 'Unknown'
    amcMap[amc] = (amcMap[amc] ?? 0) + (h.invested_amount ?? 0)
  }
  const amcEntries    = Object.entries(amcMap).sort(([, a], [, b]) => b - a)
  const topAmcName    = amcEntries[0]?.[0] ?? 'Unknown'
  const topAmcAmount  = amcEntries[0]?.[1] ?? 0
  const topAmcPct     = (topAmcAmount / totalInvested) * 100
  const amcCount      = amcEntries.length

  rules.push({
    code: 'R3',
    name: 'AMC Concentration',
    tagline: 'Over-reliance on a single fund house creates operational and regulatory risk',
    status: topAmcPct <= 35 ? 'PASS' : topAmcPct <= 50 ? 'WARN' : 'FAIL',
    score:  topAmcPct <= 35 ? 100   : topAmcPct <= 50 ? 60 : 20,
    headline: `${topAmcName}: ${topAmcPct.toFixed(0)}% of portfolio (${amcCount} fund house${amcCount !== 1 ? 's' : ''} total)`,
    detail: topAmcPct <= 35
      ? `Good AMC diversification. ${topAmcName} is your largest fund house at ${topAmcPct.toFixed(0)}% — within healthy limits. Your portfolio spans ${amcCount} fund houses.`
      : `${topAmcPct.toFixed(0)}% of your invested value (${fmtINR(Math.round(topAmcAmount))}) is with ${topAmcName}. If this fund house faces a SEBI action, NAV restatement, or operational disruption, a large chunk of your portfolio is simultaneously exposed. Fund diversification is not the same as AMC diversification.`,
    recommendation: topAmcPct > 35
      ? `Spread new investments across other fund houses. Target a maximum of 35% with any single AMC. You currently have ${amcCount} AMC${amcCount !== 1 ? 's' : ''} in your portfolio.`
      : null,
    affectedSchemes: active.filter(h => ((h.amc ?? 'Unknown').trim() || 'Unknown') === topAmcName).map(h => h.scheme_name),
  })

  // ── R4: Portfolio Complexity ─────────────────────────────────────────────
  const count = active.length
  let r4status, r4score, r4headline, r4detail, r4rec

  if (count >= 5 && count <= 12) {
    r4status = 'PASS'; r4score = 100
    r4headline = `${count} active schemes — optimal range ✓`
    r4detail = 'Portfolio complexity is in the ideal range (5–12 schemes). Each holding has a meaningful allocation and the portfolio is easy to track, rebalance, and tax-plan. Most well-managed retail portfolios have 6–10 schemes.'
    r4rec = null
  } else if (count > 12 && count <= 20) {
    r4status = 'WARN'; r4score = 60
    r4headline = `${count} active schemes — slightly over-diversified`
    r4detail = `Above 12 schemes, portfolios tend to accumulate significant overlap. Returns converge toward a broad market index while tracking complexity rises. Your ${count} schemes may be working against each other in subtle ways.`
    r4rec = 'Run E4 Overlap Analysis to find redundant scheme pairs. Use E5 Performance Matrix to identify consistent underperformers. Aim to consolidate to 8–12 schemes.'
  } else if (count > 20) {
    r4status = 'FAIL'; r4score = 20
    r4headline = `${count} active schemes — fund soup ⚠`
    r4detail = `With ${count} schemes, you almost certainly have substantial cross-fund overlap. The portfolio is difficult to track, rebalance, and tax-plan. Returns likely mimic a broad index — but at a higher combined expense ratio than a single index fund.`
    r4rec = 'Run E4 Overlap Analysis immediately. Identify and eliminate duplicates. Target 8–12 schemes for a manageable, effective portfolio. Use E5 Performance Matrix to identify consistent laggards.'
  } else if (count >= 3) {
    r4status = 'WARN'; r4score = 60
    r4headline = `${count} active schemes — could benefit from wider diversification`
    r4detail = `A ${count}-scheme portfolio is manageable but may lack diversification across fund categories and AMCs. A well-rounded portfolio usually includes large-cap equity, a mid/small-cap component, and a debt or liquid element.`
    r4rec = 'Consider adding 2–4 schemes across different categories: a broad equity index, a mid/small cap fund, and a short-duration debt fund as a starting minimum.'
  } else {
    r4status = 'FAIL'; r4score = 20
    r4headline = `${count === 1 ? '1 scheme' : `${count} schemes`} — highly concentrated`
    r4detail = `Fewer than 3 active schemes concentrates all your MF wealth in very few fund houses, categories, and strategies. A single scheme-level event (redemption freeze, fund closure, manager change) affects your entire portfolio.`
    r4rec = 'Diversify across at least 5 schemes spanning different categories: large-cap equity (or index), mid-cap, a hybrid or multi-asset fund, and a short-duration debt component.'
  }

  rules.push({
    code: 'R4', name: 'Portfolio Complexity',
    tagline: 'Optimal: 5–12 schemes. Under 5 = concentration risk. Over 12 = fund soup.',
    status: r4status, score: r4score,
    headline: r4headline, detail: r4detail, recommendation: r4rec,
    affectedSchemes: [],
  })

  // ── R5: Short-term Equity Holdings ───────────────────────────────────────
  const equityShortTerm  = equityHoldings.filter(h => h.holding_period_days > 0 && h.holding_period_days < 365)
  const equitySTInvested = equityShortTerm.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
  const equitySTpct      = equityInvested > 0 ? (equitySTInvested / equityInvested) * 100 : 0

  if (equityHoldings.length === 0) {
    rules.push({
      code: 'R5', name: 'Equity Holding Period',
      tagline: 'Short-term equity gains taxed at 20% (STCG). Long-term at 12.5% above ₹1.25L',
      status: 'INFO', score: null,
      headline: 'No equity or hybrid holdings detected',
      detail: 'This rule applies to equity and hybrid funds. No equity-like holdings were detected in this portfolio, so the rule is not applicable.',
      recommendation: null, affectedSchemes: [],
    })
  } else {
    rules.push({
      code: 'R5', name: 'Equity Holding Period',
      tagline: 'Short-term equity gains taxed at 20% (STCG). Long-term at 12.5% above ₹1.25L',
      status: equitySTpct === 0 ? 'PASS' : equitySTpct < 15 ? 'WARN' : 'FAIL',
      score:  equitySTpct === 0 ? 100   : equitySTpct < 15 ? 60 : 20,
      headline: equitySTpct === 0
        ? `All ${equityHoldings.length} equity holding${equityHoldings.length !== 1 ? 's' : ''} > 12 months — LTCG eligible ✓`
        : `${equityShortTerm.length} equity holding${equityShortTerm.length !== 1 ? 's' : ''} under 12 months · ${equitySTpct.toFixed(0)}% of equity invested`,
      detail: equitySTpct === 0
        ? 'All equity holdings have been held for over 12 months and qualify for Long-Term Capital Gains (LTCG) tax treatment: 12.5% on gains above the ₹1.25L annual exemption. Short-term gains (< 12 months) are taxed at 20% (STCG).'
        : `${fmtINR(Math.round(equitySTInvested))} in equity has been held for less than 12 months. Gains on redemption of these holdings will attract 20% Short-Term Capital Gains (STCG) tax. Once held past 12 months, the rate drops to 12.5% above the ₹1.25L annual LTCG exemption.`,
      recommendation: equitySTpct > 0
        ? `Hold these ${equityShortTerm.length} scheme${equityShortTerm.length !== 1 ? 's' : ''} past the 12-month mark before any redemption or switch. Redeeming before LTCG eligibility costs 20% in tax vs 12.5% after — a meaningful difference on large gains.`
        : null,
      affectedSchemes: equityShortTerm.map(h => h.scheme_name),
    })
  }

  // ── R6: LTCG Exemption Utilisation ───────────────────────────────────────
  const equityLongTerm  = equityHoldings.filter(h => h.holding_period_days >= 365)
  const hasCurrentValue = equityLongTerm.some(h => h.current_value != null)
  const ltcgGain        = hasCurrentValue
    ? equityLongTerm.reduce((s, h) => s + Math.max(0, h.unrealised_gain ?? 0), 0)
    : 0

  const LTCG_EXEMPT = 125000
  const ltcgAbove   = Math.max(0, ltcgGain - LTCG_EXEMPT)
  const ltcgTax     = Math.round(ltcgAbove * 0.125)

  if (!hasCurrentValue) {
    rules.push({
      code: 'R6', name: 'LTCG Exemption Utilisation',
      tagline: '₹1.25L LTCG on equity is tax-free every financial year — harvest it annually',
      status: 'INFO', score: null,
      headline: 'Upload CAMS Holdings snapshot to calculate',
      detail: 'Current NAV data is required to compute unrealised gains. Upload a CAMS Current Valuation snapshot in F6 Data Manager. Once added, this rule will calculate your LTCG exposure and flag harvesting opportunities.',
      recommendation: null, affectedSchemes: [],
    })
  } else {
    rules.push({
      code: 'R6', name: 'LTCG Exemption Utilisation',
      tagline: '₹1.25L LTCG on equity is tax-free every financial year — harvest it annually',
      status: ltcgGain <= LTCG_EXEMPT ? 'PASS' : ltcgGain <= 500000 ? 'WARN' : 'FAIL',
      score:  ltcgGain <= LTCG_EXEMPT ? 100 : ltcgGain <= 500000 ? 60 : 20,
      headline: ltcgGain <= LTCG_EXEMPT
        ? `Unrealised equity LTCG: ${fmtINR(Math.round(ltcgGain))} — within ₹1.25L annual exemption ✓`
        : ltcgGain <= 500000
          ? `Unrealised equity LTCG: ${fmtINR(Math.round(ltcgGain))} — consider phased tax harvesting`
          : `Unrealised equity LTCG: ${fmtINR(Math.round(ltcgGain))} — estimated tax ~${fmtINR(ltcgTax)}`,
      detail: ltcgGain <= LTCG_EXEMPT
        ? `Total unrealised long-term equity gains are ${fmtINR(Math.round(ltcgGain))}, within the ₹1.25L annual LTCG exemption. You can "tax-harvest" by redeeming up to ₹1.25L of gains each financial year and immediately reinvesting — this resets your cost basis at zero tax cost.`
        : `Total unrealised LTCG on equity held > 12 months: ${fmtINR(Math.round(ltcgGain))}. The ₹1.25L annual exemption resets each financial year (April–March). Gains above the exemption are taxed at 12.5%. At current levels, your estimated tax liability is ~${fmtINR(ltcgTax)}.`,
      recommendation: ltcgGain > LTCG_EXEMPT
        ? `Plan phased LTCG harvesting across financial years. Each April–March, redeem schemes with up to ₹1.25L in long-term gains and reinvest. This methodically reduces your future tax liability. See E7 Capital Gains for the detailed lot-level breakdown. Consult a tax advisor for personalised planning.`
        : ltcgGain > 50000
          ? `Consider tax-harvesting before 31 March: redeem up to ₹1.25L of LTCG gains and immediately reinvest. This resets your cost basis at no tax cost and reduces future liability.`
          : null,
      affectedSchemes: equityLongTerm.filter(h => (h.unrealised_gain ?? 0) > 0).map(h => h.scheme_name),
    })
  }

  // ── R7: Dormant Folio Cleanup ─────────────────────────────────────────────
  const dormant = active.filter(h => h.units > 0.001 && (h.invested_amount ?? 0) > 0 && (h.invested_amount ?? 0) < 500)

  rules.push({
    code: 'R7', name: 'Dormant Folio Cleanup',
    tagline: 'Residual tiny balances (< ₹500 invested) create noise with no meaningful value',
    status: dormant.length === 0 ? 'PASS' : dormant.length <= 2 ? 'WARN' : 'FAIL',
    score:  dormant.length === 0 ? 100 : dormant.length <= 2 ? 60 : 20,
    headline: dormant.length === 0
      ? 'No dormant folios — portfolio is clean ✓'
      : `${dormant.length} dormant folio${dormant.length !== 1 ? 's' : ''} with negligible balance (< ₹500 each)`,
    detail: dormant.length === 0
      ? 'All your holdings have meaningful investment values. No dormant folio cleanup required.'
      : `${dormant.length} folio${dormant.length !== 1 ? 's have' : ' has'} a very small balance (< ₹500 invested). These are typically residual fractional units left after partial redemptions or rounded SIP amounts. They appear in every statement and tax computation but add no real portfolio value.`,
    recommendation: dormant.length > 0
      ? 'Redeem these holdings via your RTA portal (select "All units"). Once balance reaches zero, request folio closure to keep your portfolio statements clean and reduce annual tax computation noise.'
      : null,
    affectedSchemes: dormant.map(h => h.scheme_name),
  })

  // ── R8: Liquidity Buffer ──────────────────────────────────────────────────
  const liquidPct = (liquidInvested / totalInvested) * 100

  rules.push({
    code: 'R8', name: 'Liquidity Buffer',
    tagline: 'A 3–15% liquid/overnight fund allocation avoids forced equity redemption',
    status: liquidPct >= 3 && liquidPct <= 20 ? 'PASS' : 'WARN',
    score:  liquidPct >= 3 && liquidPct <= 20 ? 100 : 60,
    headline: liquidPct === 0
      ? 'No liquid / overnight fund allocation detected'
      : liquidPct <= 20
        ? `${liquidPct.toFixed(0)}% in liquid / overnight funds (${fmtINR(Math.round(liquidInvested))}) ✓`
        : `${liquidPct.toFixed(0)}% in liquid funds — may be higher than needed`,
    detail: liquidPct === 0
      ? 'No liquid or overnight fund allocation detected. Without a liquidity buffer, any emergency or investment opportunity forces you to redeem equity investments — potentially triggering STCG tax and disrupting long-term compounding.'
      : liquidPct <= 20
        ? `${liquidPct.toFixed(0)}% (${fmtINR(Math.round(liquidInvested))}) in liquid or overnight funds. This is a healthy liquidity buffer for emergencies, opportunistic STP deployments, and near-term goals.`
        : `${liquidPct.toFixed(0)}% in liquid/overnight funds may be more than needed. Excess cash earns FD-equivalent returns and reduces long-term equity compounding potential. Consider deploying the excess via STP into equity.`,
    recommendation: liquidPct === 0
      ? 'Park 3–6 months of living expenses in a liquid or overnight fund. This acts as your emergency buffer and can be deployed into equity via Systematic Transfer Plan (STP) during market corrections.'
      : liquidPct > 20
        ? 'Consider deploying excess liquid fund balance via STP (Systematic Transfer Plan) into equity funds over 6–12 months. This reduces cash drag while managing timing risk.'
        : null,
    affectedSchemes: liquidHoldings.map(h => h.scheme_name),
  })

  return rules
}

// ── Score calculation ─────────────────────────────────────────────────────────

function computeHealthScore(rules) {
  const scorable = rules.filter(r => r.score !== null)
  if (scorable.length === 0) return null
  return Math.round(scorable.reduce((s, r) => s + r.score, 0) / scorable.length)
}

// ── Score gauge (SVG semicircle) ──────────────────────────────────────────────
// Fills from left → right. Score 0 = empty, 100 = full arc.

function ScoreGauge({ score }) {
  const R            = 56
  const circumference = Math.PI * R   // semicircle arc length ≈ 175.9
  const filled       = (score / 100) * circumference
  const color        = score >= 85 ? ACC : score >= 70 ? '#22c55e' : score >= 50 ? WARN : FAIL
  const label        = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs Attention' : 'Poor'

  return (
    <div style={{ textAlign: 'center', minWidth: 140, flexShrink: 0 }}>
      {/* Arc: centre (70,70), r=56, from (14,70) clockwise to (126,70) = upper semicircle */}
      <svg width={140} height={82} viewBox="0 0 140 80" aria-label={`Portfolio health score ${score} out of 100`}>
        {/* Background arc */}
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none" stroke="#f0f9f6" strokeWidth={12} strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
        {/* Tick marks at 25% intervals */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const angle = Math.PI * (1 - pct)   // 180° → 0° as pct goes 0 → 1
          const cx = 70 + R * Math.cos(angle)
          const cy = 70 - R * Math.sin(angle)
          return <circle key={i} cx={cx} cy={cy} r={2} fill={pct <= score / 100 ? color : '#e5e7eb'} />
        })}
      </svg>
      <div style={{ marginTop: -4, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 38, fontWeight: 800, color, lineHeight: 1 }}>
        {score}
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700, color, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 5 }}>
        {label}
      </div>
    </div>
  )
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  const color = status === 'PASS' ? ACC : status === 'WARN' ? WARN : status === 'FAIL' ? FAIL : INFO
  const label = status === 'PASS' ? 'Pass' : status === 'WARN' ? 'Warn' : status === 'FAIL' ? 'Fail' : 'Info'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
      color, background: color + '14', padding: '2px 8px', borderRadius: 20, flexShrink: 0,
      letterSpacing: '0.04em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Rule card (accordion item) ────────────────────────────────────────────────

function RuleCard({ rule, expanded, onToggle }) {
  const statusColor = rule.status === 'PASS' ? ACC : rule.status === 'WARN' ? WARN : rule.status === 'FAIL' ? FAIL : INFO
  const recBg       = rule.status === 'PASS' ? `${ACC}0c` : rule.status === 'WARN' ? '#fef9eb' : rule.status === 'FAIL' ? '#fef2f2' : '#eef2ff'
  const recBorder   = rule.status === 'PASS' ? `${ACC}30` : rule.status === 'WARN' ? '#fcd34d80' : rule.status === 'FAIL' ? '#fca5a580' : '#c7d2fe80'

  return (
    <div style={{
      ...s.ruleCard,
      borderColor: expanded ? statusColor + '35' : '#f0f0f0',
    }}>
      {/* Header row */}
      <button
        style={s.ruleHeader}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span style={{ ...s.ruleCodeChip, background: statusColor + '14', color: statusColor }}>
          {rule.code}
        </span>
        <div style={s.ruleHeaderMid}>
          <div style={s.ruleName}>{rule.name}</div>
          <div style={s.ruleHeadline}>{rule.headline}</div>
        </div>
        <StatusDot status={rule.status} />
        <span style={{ ...s.chevron, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={s.ruleBody}>
          <div style={s.ruleTagline}>{rule.tagline}</div>
          <p style={s.ruleDetail}>{rule.detail}</p>

          {rule.recommendation && (
            <div style={{ ...s.ruleRec, background: recBg, borderColor: recBorder }}>
              <span style={s.ruleRecIcon}>💡</span>
              <span style={s.ruleRecText}>{rule.recommendation}</span>
            </div>
          )}

          {rule.affectedSchemes?.length > 0 && (
            <div style={s.affectedWrap}>
              <div style={s.affectedLabel}>Affected schemes</div>
              <div style={s.affectedList}>
                {rule.affectedSchemes.slice(0, 6).map((name, i) => (
                  <span key={i} style={s.affectedChip} title={name}>
                    {name.length > 50 ? name.slice(0, 48) + '…' : name}
                  </span>
                ))}
                {rule.affectedSchemes.length > 6 && (
                  <span style={{ ...s.affectedChip, color: '#9ca3af', borderStyle: 'dashed' }}>
                    +{rule.affectedSchemes.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Portfolio selector ────────────────────────────────────────────────────────

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
          const n = (p.holdings ?? []).filter(h => h.units > 0).length
          return (
            <option key={p.portfolio_id} value={p.portfolio_id}>
              {p.name}{n > 0 ? ` · ${n} schemes` : ' (no data)'}
            </option>
          )
        })}
      </select>
    </div>
  )
}

// ── Main F1HealthCheck page ───────────────────────────────────────────────────

export default function F1HealthCheck() {
  const navigate   = useNavigate()
  const width      = useWindowWidth()
  const mobile     = width < 768
  const portfolios = useMemo(() => getPortfolios(), [])

  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.portfolio_id ?? null)
  const [expanded,   setExpanded]   = useState(null)   // expanded rule code or null

  const portfolio      = useMemo(() => portfolios.find(p => p.portfolio_id === selectedId) ?? null, [portfolios, selectedId])
  const activeHoldings = useMemo(() => (portfolio?.holdings ?? []).filter(h => h.units > 0), [portfolio])
  const rules          = useMemo(() => runRules(activeHoldings), [activeHoldings])
  const score          = useMemo(() => computeHealthScore(rules), [rules])

  const passCount = rules.filter(r => r.status === 'PASS').length
  const warnCount = rules.filter(r => r.status === 'WARN').length
  const failCount = rules.filter(r => r.status === 'FAIL').length
  const infoCount = rules.filter(r => r.status === 'INFO').length

  // ── No portfolios ──────────────────────────────────────────────────────────
  if (portfolios.length === 0) {
    return (
      <div style={s.centreWrap}>
        <div style={s.emptyCard}>
          <div style={s.emptyIcon}>📋</div>
          <h2 style={s.emptyTitle}>No portfolio data yet</h2>
          <p style={s.emptySub}>
            Upload your CAMS and KFin transaction files in F6 Data Manager to run the 8-rule health check.
          </p>
          <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
            Go to Data Manager
          </button>
        </div>
      </div>
    )
  }

  // ── Portfolio with no active holdings ────────────────────────────────────
  if (activeHoldings.length === 0) {
    return (
      <div>
        {portfolios.length > 1 && (
          <PortfolioSelector portfolios={portfolios} selectedId={selectedId} onChange={id => { setSelectedId(id); setExpanded(null) }} />
        )}
        <div style={s.centreWrap}>
          <div style={s.emptyCard}>
            <div style={s.emptyIcon}>📂</div>
            <h2 style={s.emptyTitle}>No holdings to analyse</h2>
            <p style={s.emptySub}>
              Upload CAMS and/or KFin transaction files in F6 Data Manager to populate this portfolio and run health checks.
            </p>
            <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => navigate('/portfolio/f6')}>
              Upload files
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>F1 Health Check</h1>
        <p style={s.pageSub}>8-rule engine · confidence scoring · all analysis runs in your browser</p>
      </div>

      {/* Portfolio selector — only shown if multiple portfolios */}
      {portfolios.length > 1 && (
        <PortfolioSelector
          portfolios={portfolios}
          selectedId={selectedId}
          onChange={id => { setSelectedId(id); setExpanded(null) }}
        />
      )}

      {/* Score panel */}
      <div style={{ ...s.scorePanel, flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center' }}>
        {score !== null && <ScoreGauge score={score} />}
        <div style={s.scoreSummary}>
          <div style={s.scoreName}>{portfolio?.name}</div>
          <div style={s.scoreChips}>
            {passCount > 0 && (
              <span style={{ ...s.scoreChip, background: `${ACC}14`, color: ACC }}>
                ● {passCount} pass
              </span>
            )}
            {warnCount > 0 && (
              <span style={{ ...s.scoreChip, background: '#fef3c7', color: '#92400e' }}>
                ● {warnCount} warn
              </span>
            )}
            {failCount > 0 && (
              <span style={{ ...s.scoreChip, background: '#fee2e2', color: '#991b1b' }}>
                ● {failCount} fail
              </span>
            )}
            {infoCount > 0 && (
              <span style={{ ...s.scoreChip, background: '#eef2ff', color: '#3730a3' }}>
                ● {infoCount} info
              </span>
            )}
          </div>
          <div style={s.scoreMeta}>
            {activeHoldings.length} active scheme{activeHoldings.length !== 1 ? 's' : ''}
            {portfolio?.raw?.holdings ? ' · with current NAV' : ' · no current NAV (upload Holdings snapshot for LTCG check)'}
          </div>
          <div style={s.scorePrivacy}>
            🔒 No data sent to server — analysis is fully local
          </div>
        </div>
      </div>

      {/* Rule accordion */}
      <div style={s.ruleList}>
        {rules.map(rule => (
          <RuleCard
            key={rule.code}
            rule={rule}
            expanded={expanded === rule.code}
            onToggle={() => setExpanded(prev => prev === rule.code ? null : rule.code)}
          />
        ))}
      </div>

      {/* Footer disclaimer */}
      <div style={s.footerNote}>
        <span style={s.footerDot} />
        Health rules reflect standard MF portfolio best practices for Indian retail investors.
        This is not personalised tax or investment advice.
        Use E7 Capital Gains for detailed lot-level tax computation.
        Checked {fmtDate(new Date().toISOString())} based on uploaded transaction history.
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Centre / empty states
  centreWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh',
  },
  emptyCard: {
    textAlign: 'center', padding: '2.5rem 3rem',
    background: '#fff', borderRadius: 20,
    border: `1px solid ${ACC}22`,
    boxShadow: `0 4px 24px ${ACC}08`,
    maxWidth: 420,
  },
  emptyIcon:  { fontSize: 40, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.5rem' },
  emptySub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', lineHeight: 1.65, margin: '0 0 1.5rem' },

  // Page header
  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.2rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', margin: 0 },

  // Portfolio selector
  selectorRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' },
  selectorLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 },
  selector: {
    padding: '7px 12px', borderRadius: 10,
    border: '1.5px solid #e5e7eb', fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    background: '#fff', cursor: 'pointer', outline: 'none', maxWidth: 340,
    color: '#111827',
  },

  // Score panel
  scorePanel: {
    display: 'flex', gap: '1.5rem',
    background: '#fff', borderRadius: 16,
    border: `1px solid ${ACC}18`, padding: '1.25rem 1.5rem',
    marginBottom: '1.25rem',
    boxShadow: `0 2px 14px ${ACC}08`,
  },
  scoreSummary: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 },
  scoreName:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: '#0d3d2b' },
  scoreChips:   { display: 'flex', flexWrap: 'wrap', gap: 6 },
  scoreChip:    {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 700,
    padding: '3px 10px', borderRadius: 20, letterSpacing: '0.02em',
  },
  scoreMeta:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#6b7280', lineHeight: 1.4 },
  scorePrivacy: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#a7d9ca', letterSpacing: '0.01em' },

  // Rule list
  ruleList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1.5rem' },
  ruleCard: {
    background: '#fff', borderRadius: 14,
    border: '1.5px solid #f0f0f0', overflow: 'hidden',
    transition: 'border-color 0.15s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  ruleHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  ruleCodeChip: {
    fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700,
    padding: '2px 7px', borderRadius: 6, flexShrink: 0,
    letterSpacing: '0.06em', minWidth: 24, textAlign: 'center',
  },
  ruleHeaderMid: { flex: 1, minWidth: 0 },
  ruleName:      { fontSize: 13, fontWeight: 700, color: '#0d3d2b', lineHeight: 1.2, marginBottom: 1 },
  ruleHeadline:  {
    fontSize: 11, color: '#6b7280', fontWeight: 500, lineHeight: 1.3,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: 18, color: '#9ca3af', transition: 'transform 0.18s ease',
    lineHeight: 1, flexShrink: 0, userSelect: 'none',
  },

  // Rule body (expanded)
  ruleBody:    { padding: '0 14px 14px', borderTop: '1px solid #f5f5f5' },
  ruleTagline: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 700,
    color: '#9ca3af', letterSpacing: '0.07em', textTransform: 'uppercase',
    padding: '10px 0 8px',
  },
  ruleDetail:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#374151', lineHeight: 1.7, margin: '0 0 0.875rem' },
  ruleRec:     {
    display: 'flex', alignItems: 'flex-start', gap: 9,
    padding: '10px 12px', borderRadius: 10,
    border: '1px solid', marginBottom: '0.875rem',
  },
  ruleRecIcon: { fontSize: 14, flexShrink: 0, lineHeight: 1.5 },
  ruleRecText: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#374151', lineHeight: 1.6, flex: 1 },

  // Affected schemes list
  affectedWrap:  { marginTop: '0.25rem' },
  affectedLabel: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 9, fontWeight: 700,
    color: '#c0c0c0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
  },
  affectedList: { display: 'flex', flexWrap: 'wrap', gap: 5 },
  affectedChip: {
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 500,
    padding: '3px 9px', borderRadius: 6, background: '#f9fafb', color: '#374151',
    border: '1px solid #e5e7eb', maxWidth: 300, overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  // Footer
  footerNote: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11,
    color: '#b5d4cb', lineHeight: 1.55,
    paddingTop: '0.75rem', borderTop: `1px solid ${ACC}10`,
  },
  footerDot: {
    width: 6, height: 6, borderRadius: '50%', background: ACC + '80',
    flexShrink: 0, marginTop: 3,
  },

  // Buttons
  btn: {
    padding: '9px 22px', borderRadius: 10, fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 600, cursor: 'pointer', border: 'none', lineHeight: 1,
  },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
}
