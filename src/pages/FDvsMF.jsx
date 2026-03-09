import { useState, useMemo } from 'react'

// ─── CII TABLE ──────────────────────────────────────────────────────────────
const CII = {
  2001:100,2002:105,2003:109,2004:113,2005:117,2006:122,2007:129,2008:137,
  2009:148,2010:167,2011:184,2012:200,2013:220,2014:240,2015:254,2016:264,
  2017:272,2018:280,2019:289,2020:301,2021:317,2022:331,2023:348,2024:363,
  2025:376,2026:390,2027:405,2028:421,2029:437,2030:454
}

// ─── FORMATTERS ─────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e7) return (n < 0 ? '-' : '') + '₹' + (abs / 1e7).toFixed(2) + ' Cr'
  if (abs >= 1e5) return (n < 0 ? '-' : '') + '₹' + (abs / 1e5).toFixed(2) + ' L'
  return (n < 0 ? '-₹' : '₹') + abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
const fmtPct = (n, d = 2) => n != null && !isNaN(n) ? (n * 100).toFixed(d) + '%' : '—'
const fmtN = (n, d = 2) => n != null && !isNaN(n) ? n.toFixed(d) : '—'

// ─── TAX SLAB RATES ─────────────────────────────────────────────────────────
const SLAB_RATES = [
  { label: '0% (Nil)', value: 0 },
  { label: '5%', value: 0.05 },
  { label: '10%', value: 0.10 },
  { label: '20%', value: 0.20 },
  { label: '30%', value: 0.30 },
]

// ─── FD CALCULATION ─────────────────────────────────────────────────────────
// Interest taxed as ordinary income each year (TDS deducted annually)
// Compounding frequency: monthly/quarterly/half-yearly/annually
function calcFD({ principal, rate, tenureYears, slabRate, compFreq, isSenior, seniorBonus = 0.005 }) {
  const effectiveRate = rate + (isSenior ? seniorBonus : 0)
  const n = compFreq // periods per year
  const years = tenureYears

  // Year-by-year simulation (tax on interest each year)
  let balance = principal
  const yearRows = []
  let totalInterest = 0, totalTax = 0

  for (let y = 1; y <= years; y++) {
    const openingBalance = balance
    // Interest for the year with intra-year compounding
    const grossInterest = openingBalance * (Math.pow(1 + effectiveRate / n, n) - 1)
    const taxOnInterest = grossInterest * slabRate
    const netInterest = grossInterest - taxOnInterest
    balance = openingBalance + netInterest
    totalInterest += grossInterest
    totalTax += taxOnInterest

    yearRows.push({
      year: y,
      opening: openingBalance,
      grossInterest,
      taxOnInterest,
      netInterest,
      closing: balance,
    })
  }

  const maturityValue = balance
  const postTaxReturns = maturityValue - principal
  const postTaxCAGR = Math.pow(maturityValue / principal, 1 / years) - 1
  const effectiveYield = postTaxReturns / principal / years // simple annualised
  const taxPct = totalInterest > 0 ? totalTax / totalInterest : 0

  return { maturityValue, postTaxReturns, postTaxCAGR, effectiveYield, totalInterest, totalTax, taxPct, yearRows }
}

// ─── DEBT MF CALCULATION ────────────────────────────────────────────────────
// No tax during holding. Tax only at redemption.
// <36m: STCG at slab rate
// ≥36m: LTCG at 12.5% with CII indexation
function calcDebtMF({ principal, cagr, tenureYears, slabRate, ltcgRate = 0.125, startYear, stMonths = 36 }) {
  const maturityValue = principal * Math.pow(1 + cagr, tenureYears)
  const grossGain = maturityValue - principal
  const isLT = tenureYears * 12 >= stMonths

  let taxableGain = 0, tax = 0, gainType = ''

  if (!isLT) {
    taxableGain = grossGain
    tax = taxableGain * slabRate
    gainType = 'STCG'
  } else {
    const buyYear = startYear || new Date().getFullYear()
    const sellYear = buyYear + tenureYears
    const ciiBase = CII[buyYear] || CII[2001]
    const ciiSell = CII[Math.min(sellYear, 2030)] || CII[2030]
    const indexedCost = principal * (ciiSell / ciiBase)
    taxableGain = Math.max(0, maturityValue - indexedCost)
    tax = taxableGain * ltcgRate
    gainType = 'LTCG (Indexed)'
  }

  const postTaxValue = maturityValue - tax
  const postTaxGain = postTaxValue - principal
  const postTaxCAGR = Math.pow(postTaxValue / principal, 1 / tenureYears) - 1
  const taxPct = grossGain > 0 ? tax / grossGain : 0

  // Year-by-year NAV growth (no tax until redemption)
  const yearRows = []
  for (let y = 1; y <= tenureYears; y++) {
    yearRows.push({
      year: y,
      value: principal * Math.pow(1 + cagr, y),
      taxDue: y === tenureYears ? tax : 0,
    })
  }

  return { maturityValue, postTaxValue, postTaxGain, postTaxCAGR, tax, taxableGain, grossGain, gainType, taxPct, yearRows }
}

// ─── EQUITY MF CALCULATION ──────────────────────────────────────────────────
// <12m: STCG @ 20%
// ≥12m: LTCG @ 12.5% on gains above ₹1.25L exemption
function calcEquityMF({ principal, cagr, tenureYears, ltcgRate = 0.125, stcgRate = 0.20, ltcgExemption = 125000, stMonths = 12 }) {
  const maturityValue = principal * Math.pow(1 + cagr, tenureYears)
  const grossGain = maturityValue - principal
  const isLT = tenureYears * 12 >= stMonths

  let tax = 0, taxableGain = 0, gainType = ''

  if (!isLT) {
    taxableGain = grossGain
    tax = taxableGain * stcgRate
    gainType = 'STCG'
  } else {
    taxableGain = Math.max(0, grossGain - ltcgExemption)
    tax = taxableGain * ltcgRate
    gainType = 'LTCG'
  }

  const postTaxValue = maturityValue - tax
  const postTaxGain = postTaxValue - principal
  const postTaxCAGR = Math.pow(postTaxValue / principal, 1 / tenureYears) - 1
  const taxPct = grossGain > 0 ? tax / grossGain : 0

  const yearRows = []
  for (let y = 1; y <= tenureYears; y++) {
    yearRows.push({
      year: y,
      value: principal * Math.pow(1 + cagr, y),
      taxDue: y === tenureYears ? tax : 0,
    })
  }

  return { maturityValue, postTaxValue, postTaxGain, postTaxCAGR, tax, taxableGain, grossGain, gainType, taxPct, yearRows }
}

// ─── BREAKEVEN FINDER ───────────────────────────────────────────────────────
// At what MF CAGR does post-tax MF value = post-tax FD value?
function findBreakeven({ principal, fdResult, tenureYears, slabRate, mfType, startYear, taxConfig, stMonths }) {
  let lo = 0, hi = 0.50
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const res = mfType === 'equity'
      ? calcEquityMF({ principal, cagr: mid, tenureYears, ltcgRate: taxConfig.ltRate, stcgRate: taxConfig.stRate, ltcgExemption: taxConfig.ltcgExemption, stMonths })
      : calcDebtMF({ principal, cagr: mid, tenureYears, slabRate, ltcgRate: taxConfig.ltRate, startYear, stMonths })
    if (res.postTaxValue > fdResult.maturityValue) hi = mid
    else lo = mid
    if (hi - lo < 0.0001) break
  }
  return (lo + hi) / 2
}

// ─── COMPARISON BAR ─────────────────────────────────────────────────────────
function CompBar({ labelA, valA, labelB, valB, labelC, valC, color }) {
  const max = Math.max(valA, valB, valC || 0, 1)
  const bars = [
    { label: labelA, val: valA, col: '#a0522d' },
    { label: labelB, val: valB, col: '#3d6b8a' },
    ...(valC != null ? [{ label: labelC, val: valC, col: '#4a7c5f' }] : []),
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {bars.map(b => (
        <div key={b.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.5px', color: '#7a6a58' }}>{b.label}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: b.col, fontWeight: '600' }}>{fmt(b.val)}</span>
          </div>
          <div style={{ height: '8px', background: '#ede8de', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '8px',
              width: `${(b.val / max) * 100}%`,
              background: b.col,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── YEAR-BY-YEAR CHART ─────────────────────────────────────────────────────
function GrowthChart({ fdRows, debtRows, equityRows, principal }) {
  if (!fdRows?.length) return null
  const years = fdRows.length
  const w = 520, h = 180, pad = { l: 55, r: 20, t: 15, b: 30 }

  const allVals = [
    ...fdRows.map(r => r.closing),
    ...debtRows.map(r => r.value),
    ...(equityRows || []).map(r => r.value),
    principal,
  ]
  const maxV = Math.max(...allVals)
  const minV = Math.min(principal * 0.95, ...allVals)

  const sx = i => pad.l + (i / (years - 1)) * (w - pad.l - pad.r)
  const sy = v => pad.t + (1 - (v - minV) / (maxV - minV)) * (h - pad.t - pad.b)

  const line = (rows, key) => rows.map((r, i) => `${sx(i)},${sy(r[key])}`).join(' ')

  const fdPts    = fdRows.map((r, i) => `${sx(i)},${sy(r.closing)}`).join(' ')
  const debtPts  = debtRows.map((r, i) => `${sx(i)},${sy(r.value)}`).join(' ')
  const eqPts    = equityRows ? equityRows.map((r, i) => `${sx(i)},${sy(r.value)}`).join(' ') : null

  const yTicks = [0, 0.33, 0.66, 1].map(p => minV + p * (maxV - minV))

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="fdGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a0522d" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#a0522d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={sy(v)} y2={sy(v)}
              stroke="#ede8de" strokeWidth="1" strokeDasharray="3,3" />
            <text x={pad.l - 5} y={sy(v) + 3} textAnchor="end" fontSize="8" fill="#b0a090">
              {v >= 1e7 ? (v/1e7).toFixed(1)+'Cr' : v >= 1e5 ? (v/1e5).toFixed(0)+'L' : fmt(v)}
            </text>
          </g>
        ))}
        {/* Principal line */}
        <line x1={pad.l} x2={w - pad.r} y1={sy(principal)} y2={sy(principal)}
          stroke="#c4b49a" strokeWidth="1" strokeDasharray="4,3" />

        {/* FD area fill */}
        <polygon points={`${pad.l},${h - pad.b} ${fdPts} ${w - pad.r},${h - pad.b}`}
          fill="url(#fdGrad)" />

        {/* Lines */}
        <polyline points={fdPts} fill="none" stroke="#a0522d" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={debtPts} fill="none" stroke="#3d6b8a" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3" />
        {eqPts && (
          <polyline points={eqPts} fill="none" stroke="#4a7c5f" strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" strokeDasharray="3,3" />
        )}

        {/* X labels */}
        {fdRows.map((_, i) => (
          <text key={i} x={sx(i)} y={h - 6} textAnchor="middle" fontSize="8" fill="#b0a090">
            Yr{i + 1}
          </text>
        ))}

        {/* Legend */}
        <line x1={pad.l} x2={pad.l+16} y1={10} y2={10} stroke="#a0522d" strokeWidth="2.5" />
        <text x={pad.l+20} y={14} fontSize="9" fill="#a0522d">FD (post-tax)</text>
        <line x1={pad.l+100} x2={pad.l+116} y1={10} y2={10} stroke="#3d6b8a" strokeWidth="2.5" strokeDasharray="5,2" />
        <text x={pad.l+120} y={14} fontSize="9" fill="#3d6b8a">Debt MF</text>
        {eqPts && <>
          <line x1={pad.l+195} x2={pad.l+211} y1={10} y2={10} stroke="#4a7c5f" strokeWidth="2.5" strokeDasharray="3,2" />
          <text x={pad.l+215} y={14} fontSize="9" fill="#4a7c5f">Equity MF</text>
        </>}
        <line x1={pad.l+285} x2={pad.l+301} y1={10} y2={10} stroke="#c4b49a" strokeWidth="1.5" strokeDasharray="4,2" />
        <text x={pad.l+305} y={14} fontSize="9" fill="#b0a090">Principal</text>
      </svg>
    </div>
  )
}

// ─── RESULT CARD ────────────────────────────────────────────────────────────
function ResultCard({ title, accent, items, winner }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '14px',
      border: `1.5px solid ${accent}30`,
      borderTop: `3px solid ${accent}`,
      padding: '18px 20px',
      boxShadow: '0 2px 16px rgba(60,40,20,0.06)',
      position: 'relative',
    }}>
      {winner && (
        <div style={{
          position: 'absolute', top: '-1px', right: '16px',
          background: accent, color: '#fff', fontSize: '9px',
          fontFamily: "'DM Mono', monospace", letterSpacing: '1.5px',
          textTransform: 'uppercase', padding: '3px 10px',
          borderRadius: '0 0 8px 8px',
        }}>★ Winner</div>
      )}
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: accent, marginBottom: '14px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #f5ede4', paddingBottom: '8px' }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#7a6a58' }}>{item.label}</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: '700', color: item.highlight ? accent : '#2c2118' }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function FDvsMF() {

  // ── Core inputs
  const [principal, setPrincipal] = useState(1000000)
  const [tenureYears, setTenureYears] = useState(5)
  const [fdRate, setFdRate] = useState(0.073)
  const [debtCagr, setDebtCagr] = useState(0.075)
  const [equityCagr, setEquityCagr] = useState(0.12)
  const [includeEquity, setIncludeEquity] = useState(true)
  const [isSenior, setIsSenior] = useState(false)
  const [compFreq, setCompFreq] = useState(4) // quarterly
  const startYear = new Date().getFullYear()

  // ── Tax config
  const [taxOpen, setTaxOpen] = useState(false)
  const [slabRate, setSlabRate] = useState(0.30)
  const [taxConfig, setTaxConfig] = useState({
    ltRate: 0.125,
    stRate: 0.20,
    ltcgExemption: 125000,
    equityStMonths: 12,   // months before STCG → LTCG for equity
    debtStMonths: 36,     // months before STCG → LTCG for debt
  })
  const updateTax = (k, v) => setTaxConfig(p => ({ ...p, [k]: v }))

  // ── Calculations
  const fd = useMemo(() => calcFD({
    principal, rate: fdRate, tenureYears,
    slabRate, compFreq, isSenior,
  }), [principal, fdRate, tenureYears, slabRate, compFreq, isSenior])

  const debt = useMemo(() => calcDebtMF({
    principal, cagr: debtCagr, tenureYears,
    slabRate, ltcgRate: taxConfig.ltRate, startYear,
    stMonths: taxConfig.debtStMonths,
  }), [principal, debtCagr, tenureYears, slabRate, taxConfig, startYear])

  const equity = useMemo(() => includeEquity ? calcEquityMF({
    principal, cagr: equityCagr, tenureYears,
    ltcgRate: taxConfig.ltRate, stcgRate: taxConfig.stRate,
    ltcgExemption: taxConfig.ltcgExemption,
    stMonths: taxConfig.equityStMonths,
  }) : null, [principal, equityCagr, tenureYears, taxConfig, includeEquity])

  const debtBreakeven = useMemo(() => findBreakeven({
    principal, fdResult: fd, tenureYears,
    slabRate, mfType: 'debt', startYear, taxConfig,
    stMonths: taxConfig.debtStMonths,
  }), [principal, fd, tenureYears, slabRate, startYear, taxConfig])

  const equityBreakeven = useMemo(() => findBreakeven({
    principal, fdResult: fd, tenureYears,
    slabRate, mfType: 'equity', startYear, taxConfig,
    stMonths: taxConfig.equityStMonths,
  }), [principal, fd, tenureYears, slabRate, startYear, taxConfig])

  // ── Winner logic
  const values = [
    { key: 'fd',     val: fd.maturityValue,         label: 'FD' },
    { key: 'debt',   val: debt.postTaxValue,         label: 'Debt MF' },
    ...(equity ? [{ key: 'equity', val: equity.postTaxValue, label: 'Equity MF' }] : []),
  ]
  const winner = values.reduce((a, b) => a.val > b.val ? a : b)
  const loser  = values.reduce((a, b) => a.val < b.val ? a : b)
  const advantage = winner.val - loser.val

  // ─── Styles
  const S = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f9f4ee 0%, #f2ebe1 50%, #ede4d6 100%)',
      backgroundImage: `
        radial-gradient(ellipse 60% 45% at 100% 0%, rgba(160,82,45,0.07) 0%, transparent 60%),
        radial-gradient(ellipse 40% 50% at 0% 100%, rgba(61,107,138,0.06) 0%, transparent 60%)
      `,
      fontFamily: "'DM Sans', sans-serif",
    },
    header: {
      maxWidth: '1200px', margin: '0 auto',
      padding: '2.5rem 2rem 1.5rem',
      borderBottom: '1px solid rgba(60,40,20,0.08)',
    },
    eyebrow: {
      fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '3px',
      textTransform: 'uppercase', color: '#a0522d', marginBottom: '10px',
      display: 'flex', alignItems: 'center', gap: '10px',
    },
    h1: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '700',
      color: '#2c2118', lineHeight: 1.05, margin: '0 0 8px',
    },
    subtitle: { fontSize: '13px', color: '#7a6a58', lineHeight: 1.6, maxWidth: '480px' },
    body: {
      maxWidth: '1200px', margin: '0 auto',
      display: 'grid', gridTemplateColumns: '320px 1fr',
      gap: '1.5rem', padding: '1.5rem 2rem',
      alignItems: 'start',
    },
    leftPanel: {
      background: '#fff', borderRadius: '16px',
      border: '1px solid rgba(60,40,20,0.08)',
      boxShadow: '0 2px 16px rgba(60,40,20,0.06)',
      padding: '20px', position: 'sticky', top: '72px',
    },
    sectionLabel: {
      fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2.5px',
      textTransform: 'uppercase', color: '#a0522d',
      borderBottom: '1px solid rgba(60,40,20,0.07)',
      paddingBottom: '8px', marginBottom: '14px', marginTop: '4px',
    },
    fieldGroup: { marginBottom: '14px' },
    label: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px',
      textTransform: 'uppercase', color: '#9a8a78', marginBottom: '5px',
    },
    labelVal: { color: '#a0522d', fontWeight: '600' },
    input: {
      width: '100%', padding: '8px 12px',
      background: '#f9f4ee', border: '1px solid rgba(60,40,20,0.1)',
      borderRadius: '8px', color: '#2c2118',
      fontFamily: "'DM Mono', monospace", fontSize: '13px',
      outline: 'none', boxSizing: 'border-box',
      transition: 'border 0.15s, box-shadow 0.15s',
    },
    select: {
      width: '100%', padding: '8px 12px',
      background: '#f9f4ee', border: '1px solid rgba(60,40,20,0.1)',
      borderRadius: '8px', color: '#2c2118',
      fontFamily: "'DM Mono', monospace", fontSize: '12px',
      outline: 'none', boxSizing: 'border-box',
    },
    divider: { height: '1px', background: 'rgba(60,40,20,0.07)', margin: '16px 0' },
    toggle: {
      display: 'flex', background: '#f2ebe1', borderRadius: '10px',
      padding: '3px', gap: '3px', marginBottom: '14px',
    },
    toggleBtn: (active, accent = '#a0522d') => ({
      flex: 1, padding: '7px 0', borderRadius: '8px', border: 'none',
      background: active ? '#fff' : 'transparent',
      color: active ? accent : '#9a8a78', cursor: 'pointer',
      fontFamily: "'DM Mono', monospace", fontSize: '10px',
      letterSpacing: '1px', textTransform: 'uppercase',
      boxShadow: active ? '0 1px 6px rgba(60,40,20,0.1)' : 'none',
      transition: 'all 0.18s',
    }),
  }

  const COMP_FREQS = [
    { label: 'Monthly', value: 12 },
    { label: 'Quarterly', value: 4 },
    { label: 'Half-Yearly', value: 2 },
    { label: 'Annually', value: 1 },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: #a0522d !important; box-shadow: 0 0 0 3px rgba(160,82,45,0.1) !important; }
        .fdmf-grid { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; padding: 1.5rem 2rem; align-items: start; max-width: 1200px; margin: 0 auto; }
        .result-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px; }
        .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        @media (max-width: 900px) {
          .fdmf-grid { grid-template-columns: 1fr !important; padding: 1rem; }
          .result-cards { grid-template-columns: 1fr !important; }
          .kpi-row { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div style={S.page}>

        {/* ── HEADER ── */}
        <div style={S.header}>
          <div style={S.eyebrow}>
            <span>D2 · Fixed Income</span>
            <span style={{ width: '40px', height: '1px', background: 'rgba(160,82,45,0.3)', display: 'inline-block' }} />
          </div>
          <h1 style={S.h1}>FD <em style={{ fontStyle: 'italic', color: '#a0522d' }}>vs</em> Mutual Fund</h1>
          <p style={S.subtitle}>
            Post-tax return comparison — Fixed Deposit against Debt &amp; Equity MF.
            Accounts for annual TDS on FD, CII indexation on Debt MF, and LTCG exemption on Equity MF.
          </p>
        </div>

        <div className="fdmf-grid">

          {/* ── LEFT: Inputs ── */}
          <div style={S.leftPanel}>

            {/* Investment */}
            <div style={S.sectionLabel}>Investment</div>
            <div style={S.fieldGroup}>
              <label style={S.label}>
                <span>Principal (₹)</span>
                <span style={S.labelVal}>{fmt(principal)}</span>
              </label>
              <input style={S.input} type="number" value={principal}
                onChange={e => setPrincipal(+e.target.value)} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}>
                <span>Tenure (Years)</span>
                <span style={S.labelVal}>{tenureYears}Y</span>
              </label>
              <input style={S.input} type="range" min="1" max="20" value={tenureYears}
                onChange={e => setTenureYears(+e.target.value)}
                style={{ width: '100%', accentColor: '#a0522d' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#b0a090', fontFamily: 'monospace', marginTop: '2px' }}>
                <span>1Y</span><span>10Y</span><span>20Y</span>
              </div>
            </div>

            {/* Investor type */}
            <div style={S.toggle}>
              <button style={S.toggleBtn(!isSenior)} onClick={() => setIsSenior(false)}>Regular</button>
              <button style={S.toggleBtn(isSenior)} onClick={() => setIsSenior(true)}>Senior (+0.5%)</button>
            </div>

            <div style={S.divider} />

            {/* FD params */}
            <div style={S.sectionLabel}>Fixed Deposit</div>
            <div style={S.fieldGroup}>
              <label style={S.label}>
                <span>FD Rate (%)</span>
                <span style={S.labelVal}>{((fdRate + (isSenior ? 0.005 : 0)) * 100).toFixed(2)}%{isSenior ? ' (incl. +0.5%)' : ''}</span>
              </label>
              <input style={S.input} type="number" step="0.1" min="1" max="15"
                value={(fdRate * 100).toFixed(2)}
                onChange={e => setFdRate(+e.target.value / 100)} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.label}><span>Compounding</span></label>
              <select style={S.select} value={compFreq}
                onChange={e => setCompFreq(+e.target.value)}>
                {COMP_FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div style={S.divider} />

            {/* MF params */}
            <div style={S.sectionLabel}>Mutual Funds</div>
            <div style={S.fieldGroup}>
              <label style={S.label}>
                <span>Debt MF CAGR (%)</span>
                <span style={S.labelVal}>{(debtCagr * 100).toFixed(1)}%</span>
              </label>
              <input style={S.input} type="number" step="0.1" min="1" max="20"
                value={(debtCagr * 100).toFixed(1)}
                onChange={e => setDebtCagr(+e.target.value / 100)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="checkbox" id="inclEq" checked={includeEquity}
                onChange={e => setIncludeEquity(e.target.checked)}
                style={{ accentColor: '#4a7c5f', width: '14px', height: '14px' }} />
              <label htmlFor="inclEq" style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#4a7c5f', cursor: 'pointer' }}>
                Include Equity MF
              </label>
            </div>
            {includeEquity && (
              <div style={S.fieldGroup}>
                <label style={S.label}>
                  <span>Equity MF CAGR (%)</span>
                  <span style={{ ...S.labelVal, color: '#4a7c5f' }}>{(equityCagr * 100).toFixed(1)}%</span>
                </label>
                <input style={S.input} type="number" step="0.5" min="1" max="40"
                  value={(equityCagr * 100).toFixed(1)}
                  onChange={e => setEquityCagr(+e.target.value / 100)} />
              </div>
            )}

            <div style={S.divider} />

            {/* Tax settings */}
            <div style={{ border: '1px solid rgba(60,40,20,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '4px' }}>
              <button onClick={() => setTaxOpen(o => !o)} style={{
                width: '100%', padding: '10px 14px', background: taxOpen ? '#f9f0e8' : '#fdfaf6',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', fontFamily: "'DM Mono', monospace",
                fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#a0522d',
              }}>
                <span>⚙ Tax Settings</span>
                <span style={{ transform: taxOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
              </button>
              {taxOpen && (
                <div style={{ padding: '14px', borderTop: '1px solid rgba(60,40,20,0.08)', background: '#fdfaf7' }}>
                  <div style={S.fieldGroup}>
                    <label style={S.label}><span>Income Tax Slab (FD + Debt ST)</span></label>
                    <select style={S.select} value={slabRate}
                      onChange={e => setSlabRate(+e.target.value)}>
                      {SLAB_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={S.fieldGroup}>
                      <label style={S.label}><span>Equity STCG (%)</span></label>
                      <input style={S.input} type="number" step="0.5" min="0" max="40"
                        value={(taxConfig.stRate * 100).toFixed(1)}
                        onChange={e => updateTax('stRate', +e.target.value / 100)} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}><span>LTCG Rate (%)</span></label>
                      <input style={S.input} type="number" step="0.5" min="0" max="30"
                        value={(taxConfig.ltRate * 100).toFixed(1)}
                        onChange={e => updateTax('ltRate', +e.target.value / 100)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={S.fieldGroup}>
                      <label style={S.label}><span>Equity ST Period (months)</span></label>
                      <input style={S.input} type="number" min="1" max="36"
                        value={taxConfig.equityStMonths}
                        onChange={e => updateTax('equityStMonths', +e.target.value)} />
                    </div>
                    <div style={S.fieldGroup}>
                      <label style={S.label}><span>Debt ST Period (months)</span></label>
                      <input style={S.input} type="number" min="1" max="60"
                        value={taxConfig.debtStMonths}
                        onChange={e => updateTax('debtStMonths', +e.target.value)} />
                    </div>
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.label}><span>LTCG Exemption (₹)</span></label>
                    <input style={S.input} type="number" step="5000"
                      value={taxConfig.ltcgExemption}
                      onChange={e => updateTax('ltcgExemption', +e.target.value)} />
                    <div style={{ fontSize: '10px', color: '#b0a090', marginTop: '3px', fontFamily: "'DM Sans', sans-serif" }}>
                      Equity LTCG exempt up to this amount per year (current: ₹1.25L)
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px', background: 'rgba(160,82,45,0.06)', borderRadius: '6px', fontSize: '10px', fontFamily: "'DM Mono', monospace", color: '#9a7a60', lineHeight: 1.8 }}>
                    FD: {(slabRate*100).toFixed(0)}% slab on interest (annual)<br/>
                    Debt MF: ST {(slabRate*100).toFixed(0)}% if &lt;{taxConfig.debtStMonths}m · LT {(taxConfig.ltRate*100).toFixed(1)}% + CII if ≥{taxConfig.debtStMonths}m<br/>
                    Equity MF: ST {(taxConfig.stRate*100).toFixed(1)}% if &lt;{taxConfig.equityStMonths}m · LT {(taxConfig.ltRate*100).toFixed(1)}% above ₹{(taxConfig.ltcgExemption/1000).toFixed(0)}K if ≥{taxConfig.equityStMonths}m
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ── RIGHT: Results ── */}
          <div>

            {/* ── WINNER BANNER ── */}
            <div style={{
              background: winner.key === 'fd'
                ? 'linear-gradient(135deg, #6b3a1f, #a0522d)'
                : winner.key === 'debt'
                ? 'linear-gradient(135deg, #1f3d5a, #3d6b8a)'
                : 'linear-gradient(135deg, #1f4a30, #4a7c5f)',
              borderRadius: '14px', padding: '16px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
              boxShadow: '0 4px 20px rgba(60,40,20,0.15)',
            }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                  Best Post-Tax Return
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: '700', color: '#fff' }}>
                  {winner.label} wins
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
                  {fmt(advantage)} more
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                  vs next best · over {tenureYears}Y
                </div>
              </div>
            </div>

            {/* ── 4 KPI CARDS ── */}
            <div className="kpi-row">
              {[
                {
                  label: 'FD Post-Tax CAGR',
                  value: fmtPct(fd.postTaxCAGR),
                  sub: `vs ${fmtPct(fdRate + (isSenior ? 0.005 : 0))} pre-tax`,
                  accent: '#a0522d',
                },
                {
                  label: 'Debt MF Post-Tax CAGR',
                  value: fmtPct(debt.postTaxCAGR),
                  sub: `${debt.gainType} · ${fmtPct(debt.taxPct)} tax drag`,
                  accent: '#3d6b8a',
                },
                ...(equity ? [{
                  label: 'Equity MF Post-Tax CAGR',
                  value: fmtPct(equity.postTaxCAGR),
                  sub: `${equity.gainType} · ${fmtPct(equity.taxPct)} tax drag`,
                  accent: '#4a7c5f',
                }] : []),
                {
                  label: 'Tax Saved (MF vs FD)',
                  value: fmt(fd.totalTax - Math.min(debt.tax, equity?.tax ?? Infinity)),
                  sub: 'best MF vs FD tax',
                  accent: '#7c5a1f',
                },
              ].map(k => (
                <div key={k.label} style={{
                  background: '#fff', borderRadius: '12px', padding: '14px 16px',
                  borderLeft: `3px solid ${k.accent}`,
                  boxShadow: '0 2px 12px rgba(60,40,20,0.06)',
                }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#9a8a78', marginBottom: '6px' }}>
                    {k.label}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: '700', color: k.accent }}>
                    {k.value}
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#b0a090', marginTop: '3px' }}>
                    {k.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* ── RESULT CARDS ── */}
            <div className="result-cards">
              <ResultCard
                title="Fixed Deposit"
                accent="#a0522d"
                winner={winner.key === 'fd'}
                items={[
                  { label: 'Maturity Value', value: fmt(fd.maturityValue), highlight: true },
                  { label: 'Gross Interest', value: fmt(fd.totalInterest) },
                  { label: 'Total Tax (TDS)', value: fmt(fd.totalTax) },
                  { label: 'Tax / Interest', value: fmtPct(fd.taxPct) },
                  { label: 'Post-Tax CAGR', value: fmtPct(fd.postTaxCAGR), highlight: true },
                  { label: 'Effective Yield', value: fmtPct(fd.effectiveYield) },
                ]}
              />
              <ResultCard
                title="Debt Mutual Fund"
                accent="#3d6b8a"
                winner={winner.key === 'debt'}
                items={[
                  { label: 'Maturity Value', value: fmt(debt.maturityValue) },
                  { label: 'Post-Tax Value', value: fmt(debt.postTaxValue), highlight: true },
                  { label: 'Gross Gain', value: fmt(debt.grossGain) },
                  { label: 'Tax Payable', value: fmt(debt.tax) },
                  { label: 'Tax / Gain', value: fmtPct(debt.taxPct) },
                  { label: 'Post-Tax CAGR', value: fmtPct(debt.postTaxCAGR), highlight: true },
                  { label: 'Gain Type', value: debt.gainType },
                ]}
              />
              {equity && (
                <ResultCard
                  title="Equity Mutual Fund"
                  accent="#4a7c5f"
                  winner={winner.key === 'equity'}
                  items={[
                    { label: 'Maturity Value', value: fmt(equity.maturityValue) },
                    { label: 'Post-Tax Value', value: fmt(equity.postTaxValue), highlight: true },
                    { label: 'Gross Gain', value: fmt(equity.grossGain) },
                    { label: 'Tax Payable', value: fmt(equity.tax) },
                    { label: 'Tax / Gain', value: fmtPct(equity.taxPct) },
                    { label: 'Post-Tax CAGR', value: fmtPct(equity.postTaxCAGR), highlight: true },
                    { label: 'LTCG Exemption Used', value: fmt(Math.min(equity.grossGain, taxConfig.ltcgExemption)) },
                  ]}
                />
              )}
            </div>

            {/* ── GROWTH CHART ── */}
            <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(60,40,20,0.06)', border: '1px solid rgba(60,40,20,0.07)' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9a8a78', marginBottom: '14px' }}>
                Corpus Growth — Year by Year (pre-redemption)
              </div>
              <GrowthChart
                fdRows={fd.yearRows}
                debtRows={debt.yearRows}
                equityRows={equity?.yearRows}
                principal={principal}
              />
            </div>

            {/* ── BREAKEVEN ANALYSIS ── */}
            <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(60,40,20,0.06)', border: '1px solid rgba(60,40,20,0.07)' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9a8a78', marginBottom: '16px' }}>
                Breakeven Analysis — MF CAGR needed to match FD post-tax
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(61,107,138,0.06)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(61,107,138,0.15)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#3d6b8a', marginBottom: '8px' }}>
                    Debt MF Breakeven
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: '700', color: '#3d6b8a' }}>
                    {fmtPct(debtBreakeven)}
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#7a8a98', marginTop: '4px' }}>
                    {debtCagr >= debtBreakeven
                      ? `✓ Your ${fmtPct(debtCagr)} assumption beats this`
                      : `✗ Your ${fmtPct(debtCagr)} assumption falls short`}
                  </div>
                </div>
                {includeEquity && (
                  <div style={{ background: 'rgba(74,124,95,0.06)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(74,124,95,0.15)' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#4a7c5f', marginBottom: '8px' }}>
                      Equity MF Breakeven
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: '700', color: '#4a7c5f' }}>
                      {fmtPct(equityBreakeven)}
                    </div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#6a8a78', marginTop: '4px' }}>
                      {equityCagr >= equityBreakeven
                        ? `✓ Your ${fmtPct(equityCagr)} assumption beats this`
                        : `✗ Your ${fmtPct(equityCagr)} assumption falls short`}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(160,82,45,0.05)', borderRadius: '8px', fontSize: '11px', color: '#9a7a60', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                Breakeven = minimum MF CAGR at which post-tax MF value equals post-tax FD maturity value, for the same {tenureYears}-year tenure and {fmt(principal)} principal.
              </div>
            </div>

            {/* ── YEAR-BY-YEAR TABLE ── */}
            <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 12px rgba(60,40,20,0.06)', border: '1px solid rgba(60,40,20,0.07)' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9a8a78', marginBottom: '14px' }}>
                Year-by-Year Comparison
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans', sans-serif", fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['Year', 'FD Balance (post-tax interest)', 'FD Tax (annual)', 'Debt MF Value', 'Debt MF Tax Due', ...(equity ? ['Equity MF Value', 'Equity MF Tax Due'] : [])].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'right', background: '#f5ede4', fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: '#9a7a60', borderBottom: '1px solid rgba(60,40,20,0.1)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fd.yearRows.map((r, i) => (
                      <tr key={r.year} style={{ background: i % 2 === 0 ? '#fdfaf7' : '#fff' }}>
                        <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', fontFamily: "'DM Mono', monospace", color: '#9a7a60' }}>Yr {r.year}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', color: '#a0522d', fontWeight: '600' }}>{fmt(r.closing)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', color: '#c47a3a' }}>{fmt(r.taxOnInterest)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', color: '#3d6b8a', fontWeight: '600' }}>{fmt(debt.yearRows[i]?.value)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', color: '#5a7a9a' }}>{debt.yearRows[i]?.taxDue > 0 ? fmt(debt.yearRows[i].taxDue) : '—'}</td>
                        {equity && <>
                          <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', color: '#4a7c5f', fontWeight: '600' }}>{fmt(equity.yearRows[i]?.value)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #f5ede4', color: '#6a9a7a' }}>{equity.yearRows[i]?.taxDue > 0 ? fmt(equity.yearRows[i].taxDue) : '—'}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(160,82,45,0.04)', borderRadius: '8px', fontSize: '10px', color: '#b0a090', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
              For illustrative purposes only. Debt MF CAGR is assumed constant; actual returns vary. STCG/LTCG thresholds: Equity 12m, Debt 36m. CII used for Debt LTCG indexation. LTCG exemption of ₹1.25L applies to equity only. Consult your tax advisor.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
