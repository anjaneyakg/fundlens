import { useState, useEffect, useCallback, useRef } from 'react'

// ─── CII TABLE (Cost Inflation Index — for debt indexation) ────────────────
const CII = {
  2001:100,2002:105,2003:109,2004:113,2005:117,2006:122,2007:129,2008:137,
  2009:148,2010:167,2011:184,2012:200,2013:220,2014:240,2015:254,2016:264,
  2017:272,2018:280,2019:289,2020:301,2021:317,2022:331,2023:348,2024:363,
  2025:376,2026:390,2027:405,2028:421,2029:437,2030:454
}

const LTCG_GRANDFATHER_DATE = new Date('2018-01-31')
const LTCG_GRANDFATHER_APPLY = new Date('2018-04-01')

// ─── XIRR (Newton-Raphson) ─────────────────────────────────────────────────
function xirr(cashflows) {
  if (!cashflows || cashflows.length < 2) return null
  const dates = cashflows.map(c => c.date)
  const amounts = cashflows.map(c => c.amount)
  const t0 = dates[0]
  const years = dates.map(d => (d - t0) / (365.25 * 24 * 3600 * 1000))
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0
    for (let j = 0; j < amounts.length; j++) {
      const f = Math.pow(1 + rate, years[j])
      npv += amounts[j] / f
      dnpv -= years[j] * amounts[j] / (f * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-10) break
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-8) { rate = newRate; break }
    rate = newRate
    if (rate < -0.999) { rate = -0.999; break }
  }
  return isFinite(rate) ? rate : null
}

// ─── TAX CALCULATION ────────────────────────────────────────────────────────
function calcTax({ schemeType, purchaseDate, saleDate, purchaseNAV, saleNAV, units, taxConfig }) {
  const isEquity = schemeType === 'equity'
  const stMonths = taxConfig ? taxConfig.stMonths : (isEquity ? 12 : 36)
  const stRate   = taxConfig ? taxConfig.stRate   : (isEquity ? 0.20 : 0.30)
  const ltRate   = taxConfig ? taxConfig.ltRate   : 0.125
  const holdingMonths = (saleDate - purchaseDate) / (30.44 * 24 * 3600 * 1000)
  const isLT = holdingMonths >= stMonths
  const saleValue = units * saleNAV
  const costBasis = units * purchaseNAV

  let taxableGain = 0, taxPayable = 0, gainType = ''

  if (!isLT) {
    taxableGain = Math.max(0, saleValue - costBasis)
    taxPayable = taxableGain * stRate
    gainType = 'STCG'
  } else {
    // LTCG
    if (isEquity && purchaseDate < LTCG_GRANDFATHER_APPLY) {
      // Grandfathering: cost basis = max(actual cost, Jan 31 2018 NAV)
      // We approximate using purchase NAV here (actual tools fetch hist NAV)
      const grandfatheredCost = Math.max(costBasis, costBasis) // simplified
      taxableGain = Math.max(0, saleValue - grandfatheredCost)
    } else if (!isEquity) {
      // Indexation
      const buyYear = purchaseDate.getFullYear()
      const sellYear = saleDate.getFullYear()
      const ciiBase = CII[buyYear] || CII[2001]
      const ciiSell = CII[sellYear] || CII[2030]
      const indexedCost = costBasis * (ciiSell / ciiBase)
      taxableGain = Math.max(0, saleValue - indexedCost)
    } else {
      taxableGain = Math.max(0, saleValue - costBasis)
    }
    // Equity LTCG exemption ₹1.25L per year (simplified: applied at summary)
    taxPayable = taxableGain * ltRate
    gainType = 'LTCG'
  }
  return { taxPayable, taxableGain, gainType, holdingMonths, isLT }
}

// ─── MAIN SIMULATION ────────────────────────────────────────────────────────
function runSWP({ corpus, purchaseNAV, purchaseDate, swpStartDate, monthlyWithdrawal,
  annualStepUp, assumedReturn, inflationRate, schemeType, tenureMonths, useHistoricalNAV, navHistory, taxConfig }) {

  const monthlyReturn = assumedReturn / 12
  let units = corpus / purchaseNAV
  const rows = []
  const cashflows = [{ date: purchaseDate, amount: -corpus }]
  let totalWithdrawn = 0, totalTax = 0, totalPrincipalRedeemed = 0, totalGain = 0
  let currentWithdrawal = monthlyWithdrawal
  let depletionMonth = null

  const startIdx = Math.round((swpStartDate - purchaseDate) / (30.44 * 24 * 3600 * 1000))

  for (let m = 0; m < tenureMonths; m++) {
    const date = new Date(swpStartDate)
    date.setMonth(date.getMonth() + m)
    const fy = date.getMonth() < 3 ? date.getFullYear() : date.getFullYear() + 1

    // Annual step-up at start of each year
    if (m > 0 && m % 12 === 0) currentWithdrawal *= (1 + annualStepUp)

    // NAV for this month
    let nav
    if (useHistoricalNAV && navHistory) {
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
      nav = navHistory[key] || (rows.length > 0 ? rows[rows.length-1].nav * (1 + monthlyReturn) : purchaseNAV)
    } else {
      nav = m === 0
        ? purchaseNAV * Math.pow(1 + assumedReturn, startIdx / 12)
        : rows[rows.length - 1].nav * (1 + monthlyReturn)
    }

    const openingUnits = units
    const openingValue = openingUnits * nav

    // If corpus < withdrawal, redeem what's left
    const effectiveWithdrawal = Math.min(currentWithdrawal, openingValue)
    if (effectiveWithdrawal <= 0) break

    const redeemedUnits = effectiveWithdrawal / nav
    const closingUnits = openingUnits - redeemedUnits
    units = closingUnits
    const closingValue = closingUnits * nav

    // Tax on this redemption
    const principalRedeemed = redeemedUnits * purchaseNAV
    const gain = effectiveWithdrawal - principalRedeemed
    const { taxPayable, gainType } = calcTax({
      schemeType, purchaseDate, saleDate: date,
      purchaseNAV, saleNAV: nav, units: redeemedUnits, taxConfig
    })

    totalWithdrawn += effectiveWithdrawal
    totalTax += taxPayable
    totalPrincipalRedeemed += principalRedeemed
    totalGain += Math.max(0, gain)

    cashflows.push({ date: new Date(date), amount: effectiveWithdrawal - taxPayable })

    // Inflation-adjusted real value
    const monthsSinceStart = m
    const realValue = effectiveWithdrawal / Math.pow(1 + inflationRate / 12, monthsSinceStart)

    rows.push({
      month: m + 1, date: new Date(date), fy,
      nav: +nav.toFixed(4),
      openingUnits: +openingUnits.toFixed(4),
      redeemedUnits: +redeemedUnits.toFixed(4),
      closingUnits: +closingUnits.toFixed(4),
      openingValue: +openingValue.toFixed(2),
      closingValue: +closingValue.toFixed(2),
      withdrawal: +effectiveWithdrawal.toFixed(2),
      principalRedeemed: +principalRedeemed.toFixed(2),
      gain: +Math.max(0, gain).toFixed(2),
      gainType,
      taxPayable: +taxPayable.toFixed(2),
      netWithdrawal: +(effectiveWithdrawal - taxPayable).toFixed(2),
      realValue: +realValue.toFixed(2),
      cumulativeWithdrawn: +totalWithdrawn.toFixed(2),
    })

    if (closingValue < currentWithdrawal && depletionMonth === null) {
      depletionMonth = m + 2
    }
    if (closingUnits <= 0) break
  }

  // Final corpus
  const finalUnits = units
  const lastNAV = rows.length > 0 ? rows[rows.length - 1].nav : purchaseNAV
  const finalCorpus = finalUnits * lastNAV

  // XIRR: add terminal value
  if (finalCorpus > 0) cashflows.push({ date: rows[rows.length - 1].date, amount: finalCorpus })
  const xirrVal = xirr(cashflows)

  return {
    rows, finalCorpus, totalWithdrawn, totalTax, totalPrincipalRedeemed, totalGain,
    xirrVal, depletionMonth,
    corpusSustained: depletionMonth === null,
    initialUnits: corpus / purchaseNAV,
    lastNAV
  }
}

// ─── SAFE WITHDRAWAL RATE FINDER ────────────────────────────────────────────
function findSafeWithdrawalRate({ corpus, purchaseNAV, purchaseDate, swpStartDate,
  annualStepUp, assumedReturn, inflationRate, schemeType, tenureMonths, taxConfig }) {
  let lo = 0.1, hi = 10, safe = null
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const monthlyW = (corpus * mid / 100) / 12
    const res = runSWP({ corpus, purchaseNAV, purchaseDate, swpStartDate,
      monthlyWithdrawal: monthlyW, annualStepUp, assumedReturn,
      inflationRate, schemeType, tenureMonths: tenureMonths * 2, useHistoricalNAV: false, taxConfig })
    if (res.corpusSustained) { safe = mid; lo = mid } else hi = mid
    if (hi - lo < 0.001) break
  }
  return safe
}

// ─── FORMATTERS ────────────────────────────────────────────────────────────
const fmt = n => {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'
  if (Math.abs(n) >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L'
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
const fmtPct = n => n != null ? (n * 100).toFixed(2) + '%' : '—'
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'

// ─── MINI SPARKLINE ────────────────────────────────────────────────────────
function Sparkline({ data, color = '#5b6af0', height = 40 }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const w = 200, h = height
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]}
        r="3" fill={color} />
    </svg>
  )
}

// ─── CORPUS GAUGE ──────────────────────────────────────────────────────────
function CorpusGauge({ pct }) {
  const clamped = Math.max(0, Math.min(1, pct))
  const r = 54, cx = 60, cy = 60
  const circumference = Math.PI * r
  const strokeDash = clamped * circumference
  const color = clamped > 0.6 ? '#22c55e' : clamped > 0.3 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={120} height={70} viewBox="0 0 120 70">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e8e4dc" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${strokeDash} ${circumference}`} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
        {(clamped * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="#8a8070">
        remaining
      </text>
    </svg>
  )
}

// ─── INLINE BAR CHART ──────────────────────────────────────────────────────
function BarChart({ rows }) {
  if (!rows || rows.length === 0) return null
  // Annual summary
  const byFY = {}
  rows.forEach(r => {
    if (!byFY[r.fy]) byFY[r.fy] = { withdrawn: 0, tax: 0, closing: 0 }
    byFY[r.fy].withdrawn += r.withdrawal
    byFY[r.fy].tax += r.taxPayable
    byFY[r.fy].closing = r.closingValue
  })
  const fyKeys = Object.keys(byFY)
  const maxVal = Math.max(...fyKeys.map(k => byFY[k].withdrawn))
  const BAR_MAX = 180

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(fyKeys.length * 52 + 40, 400)} height={200} style={{ display: 'block' }}>
        {fyKeys.map((fy, i) => {
          const x = i * 52 + 20
          const wPct = byFY[fy].withdrawn / maxVal
          const tPct = byFY[fy].tax / maxVal
          const wH = wPct * BAR_MAX
          const tH = tPct * BAR_MAX
          return (
            <g key={fy}>
              <rect x={x} y={180 - wH} width={22} height={wH} rx={3}
                fill="rgba(91,106,240,0.7)" />
              <rect x={x} y={180 - tH} width={22} height={tH} rx={3}
                fill="rgba(239,68,68,0.55)" />
              <text x={x + 11} y={194} textAnchor="middle" fontSize={9} fill="#8a8070">
                FY{String(fy).slice(2)}
              </text>
            </g>
          )
        })}
        {/* Legend */}
        <rect x={20} y={5} width={10} height={8} rx={2} fill="rgba(91,106,240,0.7)" />
        <text x={33} y={13} fontSize={9} fill="#5b6af0">Withdrawn</text>
        <rect x={100} y={5} width={10} height={8} rx={2} fill="rgba(239,68,68,0.55)" />
        <text x={113} y={13} fontSize={9} fill="#ef4444">Tax</text>
      </svg>
    </div>
  )
}

// ─── CORPUS DECAY CHART ────────────────────────────────────────────────────
function CorpusDecayChart({ rows }) {
  if (!rows || rows.length < 2) return null
  const w = 520, h = 160, pad = { l: 50, r: 20, t: 10, b: 30 }
  const values = rows.map(r => r.closingValue)
  const maxV = Math.max(...values)
  const scaleX = i => pad.l + (i / (rows.length - 1)) * (w - pad.l - pad.r)
  const scaleY = v => pad.t + (1 - v / maxV) * (h - pad.t - pad.b)
  const pts = rows.map((r, i) => `${scaleX(i)},${scaleY(r.closingValue)}`).join(' ')
  // Real value line
  const realPts = rows.map((r, i) => `${scaleX(i)},${scaleY(r.closingValue * 0.85)}`).join(' ')

  // Y axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => ({ p, v: maxV * p }))

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {/* Grid */}
        {yTicks.map(({ p, v }) => (
          <g key={p}>
            <line x1={pad.l} x2={w - pad.r} y1={scaleY(v)} y2={scaleY(v)}
              stroke="#ede8de" strokeWidth="1" strokeDasharray="3,3" />
            <text x={pad.l - 6} y={scaleY(v) + 4} textAnchor="end" fontSize="8" fill="#b0a898">
              {v >= 1e7 ? (v/1e7).toFixed(1)+'Cr' : v >= 1e5 ? (v/1e5).toFixed(0)+'L' : '0'}
            </text>
          </g>
        ))}
        {/* Corpus line */}
        <polyline points={pts} fill="none" stroke="#5b6af0" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* Fill area */}
        <polygon
          points={`${pad.l},${h - pad.b} ${pts} ${w - pad.r},${h - pad.b}`}
          fill="url(#swpGrad)" opacity="0.3" />
        <defs>
          <linearGradient id="swpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b6af0" />
            <stop offset="100%" stopColor="#5b6af0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* X axis labels — every 12 months */}
        {rows.filter((_, i) => i % 12 === 0).map((r, i) => (
          <text key={i} x={scaleX(i * 12)} y={h - 6} textAnchor="middle" fontSize="8" fill="#b0a898">
            Yr {i + 1}
          </text>
        ))}
        {/* Legend */}
        <line x1={pad.l} x2={pad.l + 20} y1={12} y2={12} stroke="#5b6af0" strokeWidth="2.5" />
        <text x={pad.l + 25} y={16} fontSize="9" fill="#5b6af0">Corpus Value</text>
      </svg>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
const DATA_URL = 'https://gist.githubusercontent.com/anjaneyakg/d53e7e3b2e8b9c6a9f2b3e1a7d4c8f0e/raw/fundlens_schemes.json'

export default function SWPCalculator() {
  const [mode, setMode] = useState('projection') // 'projection' | 'historical'

  // ── Projection inputs
  const [corpus, setCorpus] = useState(2500000)
  const [purchaseNAV, setPurchaseNAV] = useState(10)
  const [investDate, setInvestDate] = useState('2025-06-01')
  const [swpStartDelay, setSwpStartDelay] = useState(12) // months after investment
  const [monthlyWithdrawal, setMonthlyWithdrawal] = useState(40000)
  const [annualStepUp, setAnnualStepUp] = useState(0)
  const [assumedReturn, setAssumedReturn] = useState(0.09)
  const [inflationRate, setInflationRate] = useState(0.06)
  const [tenureYears, setTenureYears] = useState(10)
  const [schemeType, setSchemeType] = useState('equity')

  // ── Historical mode
  const [schemes, setSchemes] = useState([])
  const [schemeSearch, setSchemeSearch] = useState('')
  const [filteredSchemes, setFilteredSchemes] = useState([])
  const [selectedScheme, setSelectedScheme] = useState(null)
  const [navHistory, setNavHistory] = useState(null)
  const [navLoading, setNavLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [autoPurchaseNAV, setAutoPurchaseNAV] = useState(null) // auto-populated in historical mode

  // ── Tax config (editable)
  const [taxOpen, setTaxOpen] = useState(false)
  const [taxConfig, setTaxConfig] = useState({
    stMonths: 12,   // short-term holding period threshold (months)
    stRate: 0.20,   // short-term tax rate
    ltRate: 0.125,  // long-term tax rate
  })
  const updateTax = (key, val) => setTaxConfig(prev => ({ ...prev, [key]: val }))

  // ── Results
  const [result, setResult] = useState(null)
  const [safeRate, setSafeRate] = useState(null)
  const [safeLoading, setSafeLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Load schemes
  useEffect(() => {
    fetch(DATA_URL).then(r => r.json()).then(data => {
      setSchemes(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [])

  // Scheme search filter
  useEffect(() => {
    if (!schemeSearch.trim()) { setFilteredSchemes([]); return }
    const q = schemeSearch.toLowerCase()
    setFilteredSchemes(
      schemes.filter(s => s.schemeName?.toLowerCase().includes(q) ||
        s.amcName?.toLowerCase().includes(q)).slice(0, 8)
    )
  }, [schemeSearch, schemes])

  // Fetch NAV history for selected scheme
  useEffect(() => {
    if (!selectedScheme) return
    setNavLoading(true)
    fetch(`https://api.mfapi.in/mf/${selectedScheme.schemeCode}`)
      .then(r => r.json()).then(data => {
        const hist = {}
        ;(data.data || []).forEach(d => {
          const [day, mon, yr] = d.date.split('-')
          const key = `${yr}-${mon}`
          if (!hist[key]) hist[key] = parseFloat(d.nav)
        })
        setNavHistory(hist)
        setNavLoading(false)
      }).catch(() => setNavLoading(false))
  }, [selectedScheme])

  // Auto-populate Purchase NAV from NAV history when investDate changes in historical mode
  useEffect(() => {
    if (mode !== 'historical' || !navHistory) return
    const key = investDate.slice(0, 7) // "YYYY-MM"
    const found = navHistory[key]
    setAutoPurchaseNAV(found ? +found.toFixed(4) : null)
  }, [navHistory, investDate, mode])

  // Compute derived dates
  const purchaseDate = new Date(investDate)
  const swpStartDate = new Date(investDate)
  swpStartDate.setMonth(swpStartDate.getMonth() + swpStartDelay)

  // Effective purchaseNAV: auto in historical mode, manual in projection
  const effectivePurchaseNAV = mode === 'historical' && autoPurchaseNAV ? autoPurchaseNAV : purchaseNAV

  const compute = useCallback(() => {
    const res = runSWP({
      corpus, purchaseNAV: effectivePurchaseNAV, purchaseDate, swpStartDate,
      monthlyWithdrawal, annualStepUp, assumedReturn,
      inflationRate, schemeType,
      tenureMonths: tenureYears * 12,
      useHistoricalNAV: mode === 'historical' && !!navHistory,
      navHistory, taxConfig
    })
    setResult(res)
    setSafeRate(null)
  }, [corpus, effectivePurchaseNAV, investDate, swpStartDelay, monthlyWithdrawal,
      annualStepUp, assumedReturn, inflationRate, schemeType, tenureYears,
      mode, navHistory, taxConfig])

  const findSafe = () => {
    setSafeLoading(true)
    setTimeout(() => {
      const sr = findSafeWithdrawalRate({
        corpus, purchaseNAV: effectivePurchaseNAV, purchaseDate, swpStartDate,
        annualStepUp, assumedReturn, inflationRate, schemeType,
        tenureMonths: tenureYears * 12, taxConfig
      })
      setSafeRate(sr)
      setSafeLoading(false)
    }, 50)
  }

  const pctRemaining = result ? result.finalCorpus / corpus : 0

  // ── Annual summary for tables
  const annualRows = result ? Object.values(
    result.rows.reduce((acc, r) => {
      if (!acc[r.fy]) acc[r.fy] = { fy: r.fy, withdrawn: 0, tax: 0, net: 0, months: 0, closing: 0 }
      acc[r.fy].withdrawn += r.withdrawal
      acc[r.fy].tax += r.taxPayable
      acc[r.fy].net += r.netWithdrawal
      acc[r.fy].months += 1
      acc[r.fy].closing = r.closingValue
      return acc
    }, {})
  ) : []

  // ── Styles
  const S = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f5efe6 0%, #ede7da 40%, #e8dfd2 100%)',
      fontFamily: "'Lora', Georgia, serif",
      padding: '0',
    },
    header: {
      background: 'linear-gradient(135deg, #3d3560 0%, #5b4fa0 60%, #7c6bbf 100%)',
      padding: '2.5rem 2rem 2rem',
      color: '#fff',
    },
    tag: {
      display: 'inline-block', fontSize: '10px', letterSpacing: '2px',
      textTransform: 'uppercase', fontFamily: "'DM Mono', monospace",
      color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '4px', padding: '2px 10px', marginBottom: '12px',
    },
    h1: {
      fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: '700',
      letterSpacing: '-0.5px', margin: '0 0 6px', color: '#fff',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
    },
    subtitle: { fontSize: '13px', color: 'rgba(255,255,255,0.65)', fontFamily: "'DM Sans', sans-serif" },
    modePill: {
      display: 'inline-flex', background: 'rgba(255,255,255,0.12)',
      borderRadius: '20px', padding: '3px', marginTop: '16px', gap: '2px',
    },
    modeBtn: (active) => ({
      padding: '6px 20px', borderRadius: '16px', border: 'none', cursor: 'pointer',
      fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '1px',
      textTransform: 'uppercase', transition: 'all 0.2s',
      background: active ? '#fff' : 'transparent',
      color: active ? '#3d3560' : 'rgba(255,255,255,0.7)',
      fontWeight: active ? '600' : '400',
    }),
    body: { maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' },
    grid: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' },
    panel: {
      background: '#fff', borderRadius: '16px',
      boxShadow: '0 4px 24px rgba(61,53,96,0.08)',
      overflow: 'hidden',
    },
    panelHead: {
      background: 'linear-gradient(135deg, #3d3560, #5b4fa0)',
      padding: '14px 20px',
      fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '2px',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)',
    },
    panelBody: { padding: '20px' },
    fieldGroup: { marginBottom: '16px' },
    label: {
      display: 'block', fontFamily: "'DM Mono', monospace",
      fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
      color: '#8a7faa', marginBottom: '5px',
    },
    input: {
      width: '100%', padding: '9px 12px', border: '1.5px solid #e0daf0',
      borderRadius: '8px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
      color: '#2d2750', background: '#faf9fe', outline: 'none',
      boxSizing: 'border-box', transition: 'border-color 0.15s',
    },
    select: {
      width: '100%', padding: '9px 12px', border: '1.5px solid #e0daf0',
      borderRadius: '8px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
      color: '#2d2750', background: '#faf9fe', outline: 'none',
      boxSizing: 'border-box',
    },
    divider: { height: '1px', background: '#ede8f5', margin: '16px 0' },
    computeBtn: {
      width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
      background: 'linear-gradient(135deg, #3d3560, #5b4fa0)',
      color: '#fff', fontFamily: "'DM Mono', monospace",
      fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase',
      cursor: 'pointer', marginBottom: '10px',
      boxShadow: '0 4px 16px rgba(91,79,160,0.3)',
    },
    safeBtn: {
      width: '100%', padding: '10px', borderRadius: '10px',
      border: '1.5px solid #5b4fa0', background: 'transparent',
      color: '#5b4fa0', fontFamily: "'DM Mono', monospace",
      fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase',
      cursor: 'pointer',
    },
    // Results
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' },
    statCard: (highlight) => ({
      background: highlight ? 'linear-gradient(135deg, #3d3560, #5b4fa0)' : '#f8f6ff',
      borderRadius: '12px', padding: '14px 16px',
      borderLeft: highlight ? 'none' : '3px solid #c4bce8',
    }),
    statLabel: (highlight) => ({
      fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px',
      textTransform: 'uppercase', color: highlight ? 'rgba(255,255,255,0.65)' : '#9991bb',
      marginBottom: '4px',
    }),
    statValue: (highlight) => ({
      fontSize: '1.15rem', fontWeight: '700',
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      color: highlight ? '#fff' : '#2d2750',
    }),
    statSub: (highlight) => ({
      fontSize: '10px', fontFamily: "'DM Sans', sans-serif",
      color: highlight ? 'rgba(255,255,255,0.55)' : '#b0a8d0', marginTop: '2px',
    }),
    tabs: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e8e2f5', paddingBottom: '0' },
    tab: (active) => ({
      padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
      fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '1px',
      textTransform: 'uppercase', color: active ? '#3d3560' : '#b0a8d0',
      borderBottom: active ? '2px solid #3d3560' : '2px solid transparent',
      marginBottom: '-1px', transition: 'all 0.15s',
    }),
    tableWrap: { overflowX: 'auto', fontSize: '12px' },
    table: { width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif" },
    th: {
      padding: '8px 10px', textAlign: 'right', background: '#f0ecfa',
      fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1px',
      textTransform: 'uppercase', color: '#7a6fa0', borderBottom: '1px solid #e0daf0',
      whiteSpace: 'nowrap',
    },
    thL: {
      padding: '8px 10px', textAlign: 'left', background: '#f0ecfa',
      fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1px',
      textTransform: 'uppercase', color: '#7a6fa0', borderBottom: '1px solid #e0daf0',
    },
    td: { padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f0ecfa', color: '#3d3560' },
    tdL: { padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid #f0ecfa', color: '#3d3560' },
    badge: (type) => ({
      display: 'inline-block', padding: '1px 7px', borderRadius: '8px', fontSize: '9px',
      fontFamily: "'DM Mono', monospace", letterSpacing: '0.5px', textTransform: 'uppercase',
      background: type === 'STCG' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
      color: type === 'STCG' ? '#d97706' : '#16a34a',
      border: type === 'STCG' ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(34,197,94,0.2)',
    }),
    alertBox: (type) => ({
      padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
      background: type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      border: `1px solid ${type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
      color: type === 'success' ? '#15803d' : '#dc2626',
      fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
    }),
    safeRateBox: {
      background: 'linear-gradient(135deg, rgba(91,79,160,0.08), rgba(61,53,96,0.04))',
      border: '1.5px solid rgba(91,79,160,0.2)',
      borderRadius: '12px', padding: '16px', marginTop: '12px',
    },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: #5b4fa0 !important; box-shadow: 0 0 0 3px rgba(91,79,160,0.1); }
        .swp-search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff;
          border: 1.5px solid #e0daf0; border-top: none; border-radius: 0 0 8px 8px;
          max-height: 240px; overflow-y: auto; z-index: 50;
          box-shadow: 0 8px 24px rgba(61,53,96,0.12); }
        .swp-scheme-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f5f0ff;
          transition: background 0.1s; }
        .swp-scheme-item:hover { background: #f5f0ff; }
        .swp-scheme-name { font-family: 'DM Sans', sans-serif; font-size: 12px; color: #2d2750; font-weight: 500; }
        .swp-scheme-amc { font-family: 'DM Mono', monospace; font-size: 9px; color: #9991bb; margin-top: 2px; letter-spacing: 0.5px; }
        tr:hover td { background: rgba(91,79,160,0.03); }
        @media (max-width: 768px) {
          .swp-grid { grid-template-columns: 1fr !important; }
          .swp-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .swp-stats > div[style*="span 2"] { grid-column: span 2 !important; }
        }
      `}</style>

      <div style={S.page}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={S.tag}>A3 · SWP Calculator</div>
            <h1 style={S.h1}>Systematic Withdrawal Plan</h1>
            <p style={S.subtitle}>Unit-based redemption simulation · STCG/LTCG tax · Grandfathering · Inflation-adjusted cashflows</p>
            <div style={S.modePill}>
              <button style={S.modeBtn(mode === 'projection')} onClick={() => setMode('projection')}>
                📐 Projection
              </button>
              <button style={S.modeBtn(mode === 'historical')} onClick={() => setMode('historical')}>
                📜 Historical
              </button>
            </div>
          </div>
        </div>

        <div style={S.body}>
          <div style={{ ...S.grid }} className="swp-grid">

            {/* ── LEFT PANEL: Inputs ── */}
            <div>
              <div style={S.panel}>
                <div style={S.panelHead}>
                  {mode === 'projection' ? '⚙ Projection Inputs' : '🔍 Historical Mode'}
                </div>
                <div style={S.panelBody}>

                  {/* Historical scheme search */}
                  {mode === 'historical' && (
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Scheme</label>
                      <div style={{ position: 'relative' }}>
                        <input style={S.input} placeholder="Search scheme name..."
                          value={schemeSearch}
                          onChange={e => { setSchemeSearch(e.target.value); setSearchOpen(true) }}
                          onFocus={() => setSearchOpen(true)} />
                        {searchOpen && filteredSchemes.length > 0 && (
                          <div className="swp-search-dropdown">
                            {filteredSchemes.map(s => (
                              <div key={s.schemeCode} className="swp-scheme-item"
                                onClick={() => {
                                  setSelectedScheme(s)
                                  setSchemeSearch(s.schemeName)
                                  setSearchOpen(false)
                                  setSchemeType(
                                    s.schemeName?.toLowerCase().includes('debt') ||
                                    s.schemeName?.toLowerCase().includes('liquid') ||
                                    s.schemeName?.toLowerCase().includes('bond') ? 'debt' : 'equity'
                                  )
                                }}>
                                <div className="swp-scheme-name">{s.schemeName}</div>
                                <div className="swp-scheme-amc">{s.amcName}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {navLoading && <div style={{ fontSize: '11px', color: '#9991bb', marginTop: '4px' }}>Fetching NAV history...</div>}
                      {selectedScheme && navHistory && !navLoading && (
                        <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                          ✓ NAV history loaded ({Object.keys(navHistory).length} months)
                        </div>
                      )}
                      <div style={S.divider} />
                    </div>
                  )}

                  {/* Corpus */}
                  <div style={S.fieldGroup}>
                    <label style={S.label}>Initial Corpus (₹)</label>
                    <input style={S.input} type="number" value={corpus}
                      onChange={e => setCorpus(+e.target.value)} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>
                        Purchase NAV (₹)
                        {mode === 'historical' && (
                          <span style={{ marginLeft: '6px', fontSize: '9px', color: '#16a34a', fontStyle: 'normal', letterSpacing: 0 }}>
                            {autoPurchaseNAV ? '● auto' : '○ pick date'}
                          </span>
                        )}
                      </label>
                      {mode === 'historical' ? (
                        <div style={{
                          ...S.input, display: 'flex', alignItems: 'center',
                          background: '#f0ecfa', color: autoPurchaseNAV ? '#3d3560' : '#b0a8d0',
                          cursor: 'not-allowed', fontWeight: autoPurchaseNAV ? '600' : '400',
                          border: '1.5px solid #d4cef0',
                        }}>
                          {autoPurchaseNAV ? `₹ ${autoPurchaseNAV}` : 'Auto from scheme + date'}
                        </div>
                      ) : (
                        <input style={S.input} type="number" step="0.01" value={purchaseNAV}
                          onChange={e => setPurchaseNAV(+e.target.value)} />
                      )}
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Investment Date</label>
                      <input style={S.input} type="month"
                        value={investDate.slice(0, 7)}
                        onChange={e => setInvestDate(e.target.value + '-01')} />
                    </div>
                  </div>

                  <div style={S.divider} />

                  {/* SWP details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Monthly SWP (₹)</label>
                      <input style={S.input} type="number" value={monthlyWithdrawal}
                        onChange={e => setMonthlyWithdrawal(+e.target.value)} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>SWP Start (months after invest)</label>
                      <input style={S.input} type="number" min="0" max="120" value={swpStartDelay}
                        onChange={e => setSwpStartDelay(+e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Annual Step-up (%)</label>
                      <input style={S.input} type="number" step="0.5" min="0"
                        value={(annualStepUp * 100).toFixed(1)}
                        onChange={e => setAnnualStepUp(+e.target.value / 100)} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Tenure (Years)</label>
                      <input style={S.input} type="number" min="1" max="30" value={tenureYears}
                        onChange={e => setTenureYears(+e.target.value)} />
                    </div>
                  </div>

                  <div style={S.divider} />

                  {/* Assumptions */}
                  {mode === 'projection' && (
                    <div style={S.fieldGroup}>
                      <label style={S.label}>Assumed Annual Return (%)</label>
                      <input style={S.input} type="number" step="0.5" min="0"
                        value={(assumedReturn * 100).toFixed(1)}
                        onChange={e => setAssumedReturn(+e.target.value / 100)} />
                    </div>
                  )}

                  <div style={S.fieldGroup}>
                    <label style={S.label}>Avg. Inflation Rate (%)</label>
                    <input style={S.input} type="number" step="0.5" min="0"
                      value={(inflationRate * 100).toFixed(1)}
                      onChange={e => setInflationRate(+e.target.value / 100)} />
                  </div>

                  <div style={S.fieldGroup}>
                    <label style={S.label}>Scheme Category</label>
                    <select style={S.select} value={schemeType}
                      onChange={e => setSchemeType(e.target.value)}>
                      <option value="equity">Equity Oriented (STCG: 20%, LTCG: 12.5%, ST period: 12m)</option>
                      <option value="debt">Debt Oriented (STCG: 30%, LTCG: 12.5%+Indexation, ST period: 36m)</option>
                    </select>
                  </div>

                  <div style={S.divider} />

                  {/* Key dates display */}
                  <div style={{ background: '#f5f0ff', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '11px', fontFamily: "'DM Mono', monospace" }}>
                    <div style={{ color: '#9991bb', marginBottom: '4px', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '9px' }}>Key Dates</div>
                    <div style={{ color: '#3d3560' }}>🔵 Invest: <strong>{fmtDate(purchaseDate)}</strong></div>
                    <div style={{ color: '#5b4fa0', marginTop: '3px' }}>🟣 SWP Start: <strong>{fmtDate(swpStartDate)}</strong></div>
                    <div style={{ color: '#7c6bbf', marginTop: '3px' }}>
                      ⚪ Units: <strong>
                        {effectivePurchaseNAV > 0
                          ? (corpus / effectivePurchaseNAV).toLocaleString('en-IN', { maximumFractionDigits: 2 })
                          : '—'}
                      </strong>
                      {mode === 'historical' && autoPurchaseNAV && (
                        <span style={{ marginLeft: '8px', color: '#16a34a', fontSize: '10px' }}>@ ₹{autoPurchaseNAV} NAV</span>
                      )}
                    </div>
                  </div>

                  {/* ── Tax Settings Accordion ── */}
                  <div style={{ border: '1.5px solid #e0daf0', borderRadius: '10px', marginBottom: '16px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setTaxOpen(o => !o)}
                      style={{
                        width: '100%', padding: '10px 14px', background: taxOpen ? '#f0ecfa' : '#faf9fe',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', fontFamily: "'DM Mono', monospace",
                        fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
                        color: '#5b4fa0',
                      }}>
                      <span>⚙ Tax Rate Settings</span>
                      <span style={{ fontSize: '12px', transition: 'transform 0.2s', display: 'inline-block', transform: taxOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>
                    {taxOpen && (
                      <div style={{ padding: '14px', borderTop: '1px solid #e0daf0', background: '#fdfcff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <div>
                            <label style={{ ...S.label, color: '#d97706' }}>ST Rate (%)</label>
                            <input style={S.input} type="number" step="0.5" min="0" max="50"
                              value={(taxConfig.stRate * 100).toFixed(1)}
                              onChange={e => updateTax('stRate', +e.target.value / 100)} />
                          </div>
                          <div>
                            <label style={{ ...S.label, color: '#16a34a' }}>LT Rate (%)</label>
                            <input style={S.input} type="number" step="0.5" min="0" max="50"
                              value={(taxConfig.ltRate * 100).toFixed(1)}
                              onChange={e => updateTax('ltRate', +e.target.value / 100)} />
                          </div>
                        </div>
                        <div>
                          <label style={{ ...S.label }}>ST Period Threshold (months)</label>
                          <input style={S.input} type="number" min="1" max="60"
                            value={taxConfig.stMonths}
                            onChange={e => updateTax('stMonths', +e.target.value)} />
                          <div style={{ fontSize: '10px', color: '#9991bb', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                            Default: 12m (equity) · 36m (debt). Redemptions held longer = LTCG rate.
                          </div>
                        </div>
                        <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(91,79,160,0.06)', borderRadius: '6px', fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#7a6fa0' }}>
                          ST: {(taxConfig.stRate*100).toFixed(1)}% if held &lt; {taxConfig.stMonths}m &nbsp;|&nbsp; LT: {(taxConfig.ltRate*100).toFixed(1)}% if held ≥ {taxConfig.stMonths}m
                        </div>
                      </div>
                    )}
                  </div>

                  <button style={S.computeBtn} onClick={compute}>
                    ▶ Run Simulation
                  </button>
                  <button style={S.safeBtn} onClick={findSafe} disabled={safeLoading}>
                    {safeLoading ? '⏳ Computing...' : '🎯 Find Safe Withdrawal Rate'}
                  </button>

                  {safeRate !== null && (
                    <div style={S.safeRateBox}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#5b4fa0', marginBottom: '6px' }}>Safe Withdrawal Rate</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', fontFamily: "'Cormorant Garamond', serif", color: '#3d3560' }}>
                        {safeRate.toFixed(2)}% p.a.
                      </div>
                      <div style={{ fontSize: '11px', color: '#9991bb', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                        = ₹{((corpus * safeRate / 100) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}/month — corpus survives {tenureYears * 2} years
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL: Results ── */}
            <div>
              {!result ? (
                <div style={{ ...S.panel, padding: '60px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: '#3d3560', fontWeight: '600' }}>
                    Configure your SWP
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#9991bb', marginTop: '8px' }}>
                    Set inputs on the left and click <strong>Run Simulation</strong>
                  </div>
                </div>
              ) : (
                <div style={S.panel}>
                  <div style={S.panelBody}>

                    {/* Sustainability Alert */}
                    <div style={S.alertBox(result.corpusSustained ? 'success' : 'danger')}>
                      {result.corpusSustained
                        ? `✅ Corpus sustains for the full ${tenureYears}-year period. Remaining: ${fmt(result.finalCorpus)}`
                        : `⚠ Corpus depletes around month ${result.depletionMonth}. Consider reducing withdrawal or enabling step-up.`
                      }
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }} className="swp-stats">
                      <div style={{ ...S.statCard(true), gridColumn: 'span 2' }}>
                        <div style={S.statLabel(true)}>Final Corpus</div>
                        <div style={{ ...S.statValue(true), fontSize: '1.4rem' }}>{fmt(result.finalCorpus)}</div>
                        <div style={S.statSub(true)}>{result.rows.length} months simulated · XIRR {fmtPct(result.xirrVal)}</div>
                      </div>
                      <div style={{ ...S.statCard(false), gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CorpusGauge pct={pctRemaining} />
                      </div>
                      <div style={S.statCard(false)}>
                        <div style={S.statLabel(false)}>Total Withdrawn</div>
                        <div style={S.statValue(false)}>{fmt(result.totalWithdrawn)}</div>
                        <div style={S.statSub(false)}>Gross cashflows</div>
                      </div>
                      <div style={S.statCard(false)}>
                        <div style={S.statLabel(false)}>Total Tax Paid</div>
                        <div style={{ ...S.statValue(false), color: '#dc2626' }}>{fmt(result.totalTax)}</div>
                        <div style={S.statSub(false)}>STCG + LTCG</div>
                      </div>
                      <div style={{ ...S.statCard(false), borderLeft: '3px solid #dc2626' }}>
                        <div style={{ ...S.statLabel(false), color: '#dc2626' }}>Tax / Withdrawals</div>
                        <div style={{ ...S.statValue(false), color: '#dc2626' }}>
                          {result.totalWithdrawn > 0
                            ? ((result.totalTax / result.totalWithdrawn) * 100).toFixed(2) + '%'
                            : '—'}
                        </div>
                        <div style={S.statSub(false)}>Tax drag on cashflows</div>
                      </div>
                      <div style={{ ...S.statCard(false), borderLeft: '3px solid #16a34a' }}>
                        <div style={{ ...S.statLabel(false), color: '#16a34a' }}>Net After-Tax</div>
                        <div style={{ ...S.statValue(false), color: '#15803d' }}>{fmt(result.totalWithdrawn - result.totalTax)}</div>
                        <div style={S.statSub(false)}>In-hand cashflows</div>
                      </div>
                    </div>

                    {/* Corpus Decay Chart */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9991bb', marginBottom: '10px' }}>
                        Corpus Decay Over Time
                      </div>
                      <CorpusDecayChart rows={result.rows} />
                    </div>

                    {/* Tabs */}
                    <div style={S.tabs}>
                      {[['overview', 'Annual Summary'], ['monthly', 'Monthly Detail'], ['tax', 'Tax Breakdown']].map(([id, label]) => (
                        <button key={id} style={S.tab(activeTab === id)} onClick={() => setActiveTab(id)}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Annual Summary Tab */}
                    {activeTab === 'overview' && (
                      <div>
                        <BarChart rows={result.rows} />
                        <div style={S.tableWrap}>
                          <table style={S.table}>
                            <thead>
                              <tr>
                                <th style={S.thL}>FY</th>
                                <th style={S.th}>Months</th>
                                <th style={S.th}>Gross Withdrawn</th>
                                <th style={S.th}>Tax Paid</th>
                                <th style={{ ...S.th, color: '#dc2626' }}>Tax %</th>
                                <th style={S.th}>Net In-hand</th>
                                <th style={S.th}>Closing Corpus</th>
                              </tr>
                            </thead>
                            <tbody>
                              {annualRows.map(r => (
                                <tr key={r.fy}>
                                  <td style={S.tdL}><strong>FY {r.fy}-{r.fy + 1}</strong></td>
                                  <td style={S.td}>{r.months}</td>
                                  <td style={S.td}>{fmt(r.withdrawn)}</td>
                                  <td style={{ ...S.td, color: '#dc2626' }}>{fmt(r.tax)}</td>
                                  <td style={{ ...S.td, color: '#dc2626', fontWeight: '600' }}>
                                    {r.withdrawn > 0 ? ((r.tax / r.withdrawn) * 100).toFixed(2) + '%' : '—'}
                                  </td>
                                  <td style={{ ...S.td, color: '#15803d' }}>{fmt(r.net)}</td>
                                  <td style={{ ...S.td, fontWeight: '600' }}>{fmt(r.closing)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Monthly Detail Tab */}
                    {activeTab === 'monthly' && (
                      <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              <th style={S.thL}>Month</th>
                              <th style={S.th}>NAV</th>
                              <th style={S.th}>Units Redeemed</th>
                              <th style={S.th}>Withdrawal</th>
                              <th style={S.th}>Tax</th>
                              <th style={S.th}>Net Payout</th>
                              <th style={S.th}>Real Value</th>
                              <th style={S.th}>Closing Corpus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.rows.slice(0, 120).map(r => (
                              <tr key={r.month}>
                                <td style={S.tdL}>{fmtDate(r.date)}</td>
                                <td style={S.td}>₹{r.nav.toFixed(3)}</td>
                                <td style={S.td}>{r.redeemedUnits.toFixed(2)}</td>
                                <td style={S.td}>{fmt(r.withdrawal)}</td>
                                <td style={{ ...S.td, color: '#dc2626' }}>{r.taxPayable > 0 ? fmt(r.taxPayable) : '—'}</td>
                                <td style={{ ...S.td, color: '#15803d', fontWeight: '500' }}>{fmt(r.netWithdrawal)}</td>
                                <td style={{ ...S.td, color: '#7c6bbf' }}>{fmt(r.realValue)}</td>
                                <td style={{ ...S.td, fontWeight: '600' }}>{fmt(r.closingValue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.rows.length > 120 && (
                          <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: '#9991bb', fontFamily: "'DM Mono', monospace" }}>
                            Showing first 120 of {result.rows.length} months
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tax Breakdown Tab */}
                    {activeTab === 'tax' && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                          {[
                            { label: 'STCG Tax', value: fmt(result.rows.filter(r=>r.gainType==='STCG').reduce((s,r)=>s+r.taxPayable,0)), color: '#d97706' },
                            { label: 'LTCG Tax', value: fmt(result.rows.filter(r=>r.gainType==='LTCG').reduce((s,r)=>s+r.taxPayable,0)), color: '#16a34a' },
                            { label: 'Total Tax', value: fmt(result.totalTax), color: '#dc2626' },
                          ].map(s => (
                            <div key={s.label} style={{ background: '#f8f6ff', borderRadius: '10px', padding: '14px', borderLeft: `3px solid ${s.color}` }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9991bb', marginBottom: '6px' }}>{s.label}</div>
                              <div style={{ fontSize: '1.2rem', fontWeight: '700', fontFamily: "'Cormorant Garamond', serif", color: s.color }}>{s.value}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ background: '#fffbf0', border: '1px solid #f0e0a0', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", color: '#78610a' }}>
                          <strong>Tax rates applied:</strong> STCG {(taxConfig.stRate * 100).toFixed(1)}% (held &lt; {taxConfig.stMonths}m) &nbsp;|&nbsp;
                          LTCG {(taxConfig.ltRate * 100).toFixed(1)}% (held ≥ {taxConfig.stMonths}m)
                          {schemeType === 'debt' ? ' with CII Indexation' : ''}.
                          {purchaseDate < LTCG_GRANDFATHER_APPLY && schemeType === 'equity'
                            ? ' LTCG grandfathering applies (pre-Apr 2018 purchase).'
                            : ''}
                          &nbsp;<span style={{ color: '#5b4fa0', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => setTaxOpen(true)}>Edit rates ↑</span>
                        </div>

                        <div style={S.tableWrap}>
                          <table style={S.table}>
                            <thead>
                              <tr>
                                <th style={S.thL}>Month</th>
                                <th style={S.th}>Gain Type</th>
                                <th style={S.th}>Holding (months)</th>
                                <th style={S.th}>Gain Amount</th>
                                <th style={S.th}>Tax Rate</th>
                                <th style={S.th}>Tax Payable</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.rows.slice(0, 60).map(r => {
                                const holdingM = (new Date(r.date) - purchaseDate) / (30.44 * 24 * 3600 * 1000)
                                const rate = holdingM < taxConfig.stMonths
                                  ? `${(taxConfig.stRate * 100).toFixed(1)}%`
                                  : `${(taxConfig.ltRate * 100).toFixed(1)}%`
                                return (
                                  <tr key={r.month}>
                                    <td style={S.tdL}>{fmtDate(r.date)}</td>
                                    <td style={S.td}><span style={S.badge(r.gainType)}>{r.gainType}</span></td>
                                    <td style={S.td}>{holdingM.toFixed(0)}m</td>
                                    <td style={S.td}>{fmt(r.gain)}</td>
                                    <td style={{ ...S.td, color: '#7c6bbf' }}>{rate}</td>
                                    <td style={{ ...S.td, color: '#dc2626', fontWeight: '500' }}>{r.taxPayable > 0 ? fmt(r.taxPayable) : '—'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Disclaimer */}
                    <div style={{ marginTop: '20px', padding: '10px 14px', background: 'rgba(107,114,176,0.06)', borderRadius: '8px', fontSize: '10px', color: '#9991bb', fontFamily: "'DM Sans', sans-serif" }}>
                      For illustrative purposes only. Actual returns & tax may vary. LTCG exemption of ₹1.25L/year not applied in monthly simulation (apply at filing). Consult your financial advisor.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
