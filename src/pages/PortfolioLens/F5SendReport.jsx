/* ─────────────────────────────────────────────────────────────
   F5SendReport.jsx  —  PDF report generator (PL-16, PH3-S2)
   Print via window.print() + @media print CSS visibility trick.
   No server calls. DPDP-safe: PAN/name never included.
   PH3-S2: advisor branding (logo, firm name, colour, font,
           registration numbers, disclaimer) injected into print
           when logged-in user has an advisor_firm_profiles row.
   ───────────────────────────────────────────────────────────── */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import useWindowWidth from '../../hooks/useWindowWidth'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import { createSupabaseClient } from '../../lib/supabaseClient'

/* ── Constants ───────────────────────────────────────────────── */
const PORTFOLIO_KEY = 'fundlens_portfolios'
const PLAN_KEY      = 'fundlens_rebalance_plan_v1'
const LTCG_EXEMPT   = 125000

const SECTION_LIST = [
  { id: 'e1', label: 'Portfolio Summary',   desc: 'Total value, XIRR, top 5 holdings',  required: true  },
  { id: 'e2', label: 'Allocation Overview', desc: 'Category & AMC breakdown',            required: false },
  { id: 'e3', label: 'Holdings Table',      desc: 'All active schemes with XIRR',        required: false },
  { id: 'e7', label: 'Capital Gains',       desc: 'Unrealised LTCG / STCG estimates',    required: false },
  { id: 'f1', label: 'Health Check',        desc: 'Portfolio health score summary',      required: false },
  { id: 'f3', label: 'Rebalance Plan',      desc: 'Last saved plan from F3 Planner',    required: false },
]

const MACROS = ['Equity', 'Hybrid', 'Debt', 'Liquid']
const MACRO_COLORS = { Equity: '#1D9E75', Hybrid: '#3b82f6', Debt: '#f59e0b', Liquid: '#94a3b8' }

/* ── Print CSS builder — brand-colour and brand-font injected ── */
function buildPrintCSS(branding) {
  const colour = (branding?.brand_colour_hex && /^#[0-9A-Fa-f]{6}$/.test(branding.brand_colour_hex))
    ? branding.brand_colour_hex
    : '#111'
  const fontFamily = branding?.brand_font
    ? (branding.brand_font === 'Source Sans Pro'
        ? "'Source Sans 3', Arial, sans-serif"
        : `'${branding.brand_font}', Arial, sans-serif`)
    : "Arial, 'Helvetica Neue', sans-serif"

  return `
@media print {
  body * { visibility: hidden; }
  .f5-print-report, .f5-print-report * { visibility: visible; }
  .f5-print-report {
    position: absolute; left: 0; top: 0;
    width: 100%; padding: 20px 32px;
    font-family: ${fontFamily};
    font-size: 10pt; color: #111; background: white;
    box-shadow: none !important; border: none !important;
  }
  .f5-no-print { display: none !important; }
  .f5-rpt-section { padding-bottom: 14px; margin-bottom: 14px; }
  .f5-rpt-section + .f5-rpt-section { page-break-before: always; }
  .f5-rpt-h2 {
    font-size: 12pt; font-weight: bold;
    border-bottom: 1.5px solid ${colour}; padding-bottom: 5px; margin-bottom: 10px;
    text-transform: uppercase; letter-spacing: 0.04em;
    color: ${colour};
  }
  .f5-rpt-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .f5-rpt-table th {
    text-align: left; padding: 5px 8px;
    border-bottom: 1.5px solid #333; font-size: 9pt; text-transform: uppercase;
  }
  .f5-rpt-table td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  .f5-stat-grid {
    display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 14px;
  }
  .f5-stat-box { border: 1px solid #ddd; padding: 7px 10px; border-radius: 3px; }
  .f5-stat-val { font-size: 13pt; font-weight: bold; line-height: 1.2; color: ${colour}; }
  .f5-stat-lbl { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .f5-rpt-header {
    border-bottom: 2px solid ${colour}; padding-bottom: 10px; margin-bottom: 18px;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .f5-rpt-footer {
    border-top: 1px solid ${colour}; padding-top: 8px; margin-top: 20px;
    font-size: 8pt; color: #888;
  }
  .f5-alloc-bar { height: 8px; display: flex; border-radius: 2px; overflow: hidden; }
  .f5-score-circle {
    width: 64px; height: 64px; border-radius: 50%;
    border: 3px solid ${colour}; display: flex; align-items: center; justify-content: center;
    font-size: 18pt; font-weight: bold; color: ${colour};
  }
  .f5-badge-pass { color: #15803d; font-weight: bold; }
  .f5-badge-warn { color: #b45309; font-weight: bold; }
  .f5-badge-fail { color: #b91c1c; font-weight: bold; }
  @page { margin: 12mm 18mm; size: A4 portrait; }
}
`
}

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt)) return '—'
  const day   = String(dt.getDate()).padStart(2, '0')
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]
  return `${day} ${month} ${dt.getFullYear()}`
}

function fmtINR(n) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const abs = Math.abs(n)
  let str
  if (abs >= 1e7) str = '₹' + (n / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' Cr'
  else if (abs >= 1e5) str = '₹' + (n / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' L'
  else str = '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  return str
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

function inferCategory(schemeName) {
  const n = (schemeName ?? '').toLowerCase()
  if (/liquid|overnight|money market|ultra short|ultra-short/.test(n))          return 'liquid'
  if (/\bdebt\b|bond|gilt|banking and psu|banking & psu|corporate bond|dynamic bond|short duration|medium duration|long duration|credit risk|floater/.test(n)) return 'debt'
  if (/arbitrage/.test(n))                                                       return 'arbitrage'
  if (/hybrid|balanced advantage|conservative hybrid|equity savings|multi asset|asset allocator/.test(n)) return 'hybrid'
  if (/elss|tax saver|tax saving/.test(n))                                       return 'elss'
  if (/\bindex\b|nifty|sensex|nasdaq|s&p 500|exchange traded|\betf\b/.test(n))  return 'equity_passive'
  if (/\bbanking\b|financial services|\btechnology\b|\btech\b|infrastructure|infra|pharma|healthcare|consumption|energy|\bpsu\b|dividend yield/.test(n)) return 'equity_sector'
  return 'equity'
}

function macroCategory(cat) {
  if (cat === 'liquid' || cat === 'arbitrage') return 'Liquid'
  if (cat === 'debt')                           return 'Debt'
  if (cat === 'hybrid')                         return 'Hybrid'
  return 'Equity'
}

/* ── Data Computers ──────────────────────────────────────────── */
function computeSummary(active) {
  if (!active.length) return null
  const invested = active.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const current  = active.reduce((s, h) => s + (h.current_value   || 0), 0)
  const gain     = current - invested
  const xirrVals = active.map(h => h.xirr).filter(x => x !== null && x !== undefined && !isNaN(x))
  const avgXirr  = xirrVals.length ? xirrVals.reduce((s, x) => s + x, 0) / xirrVals.length : null
  const sorted   = [...active].sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
  const topByVal = sorted.slice(0, 5)
  const amcs     = [...new Set(active.map(h => (h.amc || 'Unknown').trim()).filter(Boolean))]
  return { invested, current, gain, avgXirr, topByVal, schemeCount: active.length, amcs }
}

function computeAlloc(active) {
  if (!active.length) return null
  const total = active.reduce((s, h) => s + (h.current_value || 0), 0)
  if (!total) return null
  const macroTotals = {}
  const amcTotals   = {}
  for (const h of active) {
    const macro = macroCategory(inferCategory(h.scheme_name))
    macroTotals[macro] = (macroTotals[macro] || 0) + (h.current_value || 0)
    const amc = (h.amc || 'Unknown').trim() || 'Unknown'
    amcTotals[amc] = (amcTotals[amc] || 0) + (h.current_value || 0)
  }
  const macroPcts = {}
  for (const m of MACROS) macroPcts[m] = total ? ((macroTotals[m] || 0) / total) * 100 : 0
  const topAMCs = Object.entries(amcTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([amc, val]) => ({ amc, val, pct: (val / total) * 100 }))
  return { macroPcts, topAMCs, total }
}

function computeGains(active) {
  if (!active.length) return null
  let eqLTCG = 0, eqSTCG = 0, otherGain = 0
  for (const h of active) {
    const cat  = inferCategory(h.scheme_name)
    const gain = h.unrealised_gain || 0
    if (gain <= 0) continue
    const isEq = ['equity','elss','equity_passive','equity_sector','hybrid'].includes(cat)
    const days = h.holding_period_days || 0
    if (isEq) {
      if (days >= 365) eqLTCG  += gain
      else              eqSTCG  += gain
    } else {
      otherGain += gain
    }
  }
  const ltcgTaxable = Math.max(0, eqLTCG - LTCG_EXEMPT)
  const ltcgTax     = ltcgTaxable * 0.125
  const stcgTax     = eqSTCG * 0.20
  return { eqLTCG, eqSTCG, otherGain, ltcgTaxable, ltcgTax, stcgTax }
}

function computeHealth(active) {
  if (!active.length) return null
  const totalInvested = active.reduce((s, h) => s + (h.invested_amount || 0), 0)
  if (totalInvested === 0) return null
  const scored = []

  const regularAmt = active.filter(h => h.plan === 'Regular').reduce((s, h) => s + (h.invested_amount || 0), 0)
  const r1pct = (regularAmt / totalInvested) * 100
  scored.push({ code: 'R1', name: 'Direct Plans',    status: r1pct === 0 ? 'PASS' : r1pct < 30 ? 'WARN' : 'FAIL', score: r1pct === 0 ? 100 : r1pct < 30 ? 60 : 20 })

  const idcwAmt = active.filter(h => h.option === 'IDCW').reduce((s, h) => s + (h.invested_amount || 0), 0)
  const r2pct = (idcwAmt / totalInvested) * 100
  scored.push({ code: 'R2', name: 'Growth Option',   status: r2pct === 0 ? 'PASS' : r2pct < 20 ? 'WARN' : 'FAIL', score: r2pct === 0 ? 100 : r2pct < 20 ? 60 : 20 })

  const amcMap = {}
  for (const h of active) { const amc = (h.amc || 'Unknown').trim() || 'Unknown'; amcMap[amc] = (amcMap[amc] || 0) + (h.invested_amount || 0) }
  const topAMCPct = Object.values(amcMap).length > 0 ? (Math.max(...Object.values(amcMap)) / totalInvested) * 100 : 0
  scored.push({ code: 'R3', name: 'AMC Spread',      status: topAMCPct <= 35 ? 'PASS' : topAMCPct <= 50 ? 'WARN' : 'FAIL', score: topAMCPct <= 35 ? 100 : topAMCPct <= 50 ? 60 : 20 })

  const n = active.length
  scored.push({ code: 'R4', name: 'Scheme Count',    status: n >= 5 && n <= 12 ? 'PASS' : n >= 3 ? 'WARN' : 'FAIL', score: n >= 5 && n <= 12 ? 100 : n >= 3 ? 60 : 20 })

  const eqHoldings = active.filter(h => ['equity','elss','equity_passive','equity_sector','hybrid'].includes(inferCategory(h.scheme_name)))
  if (eqHoldings.length > 0) {
    const eqInvested = eqHoldings.reduce((s, h) => s + (h.invested_amount || 0), 0)
    const stAmt = eqHoldings.filter(h => (h.holding_period_days || 0) > 0 && (h.holding_period_days || 0) < 365).reduce((s, h) => s + (h.invested_amount || 0), 0)
    const stPct = eqInvested > 0 ? (stAmt / eqInvested) * 100 : 0
    scored.push({ code: 'R5', name: 'Holding Period', status: stPct === 0 ? 'PASS' : stPct < 15 ? 'WARN' : 'FAIL', score: stPct === 0 ? 100 : stPct < 15 ? 60 : 20 })
  }

  const liqAmt = active.filter(h => inferCategory(h.scheme_name) === 'liquid').reduce((s, h) => s + (h.invested_amount || 0), 0)
  const liqPct = (liqAmt / totalInvested) * 100
  scored.push({ code: 'R8', name: 'Liquid Buffer',   status: liqPct >= 3 && liqPct <= 15 ? 'PASS' : 'WARN', score: liqPct >= 3 && liqPct <= 15 ? 100 : 60 })

  const avgScore = Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
  const pass = scored.filter(r => r.status === 'PASS').length
  const warn = scored.filter(r => r.status === 'WARN').length
  const fail = scored.filter(r => r.status === 'FAIL').length
  return { score: avgScore, rules: scored, pass, warn, fail }
}

function loadSavedPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error('[F5SendReport] Failed to load rebalance plan:', e)
    return null
  }
}

/* ── Report header — with advisor branding if available ──────── */
function ReportHeader({ portfolio, generatedAt, branding, firmName }) {
  const colour  = branding?.brand_colour_hex
  const font    = branding?.brand_font
  const logoUrl = branding?.logo_url
  const tagline = branding?.tagline

  const displayFirm = branding?.firm_name || firmName || 'FundLens'
  const fontFamily  = font
    ? (font === 'Source Sans Pro' ? "'Source Sans 3', sans-serif" : `'${font}', sans-serif`)
    : undefined

  return (
    <div className="f5-rpt-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt={displayFirm}
            style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.02em', fontFamily, color: colour || undefined }}>
            {displayFirm}
          </div>
          {tagline && (
            <div style={{ fontSize: 10, color: '#555', marginTop: 2, fontFamily }}>
              {tagline}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#555', marginTop: tagline ? 3 : 2 }}>
            Portfolio Report
          </div>
          {portfolio?.name && (
            <div style={{ fontSize: 11, color: '#333', marginTop: 3 }}>
              Portfolio: <strong>{portfolio.name}</strong>
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 10, color: '#555' }}>
        <div>Generated: {fmtDate(generatedAt)}</div>
        {branding ? (
          <div style={{ marginTop: 4, fontSize: 9, color: '#888' }}>Powered by FundLens</div>
        ) : (
          <div style={{ marginTop: 4 }}>fundlens.in</div>
        )}
      </div>
    </div>
  )
}

/* ── Report footer — with advisor branding if available ──────── */
function ReportFooter({ branding }) {
  if (!branding) {
    return (
      <div className="f5-rpt-footer">
        Generated by FundLens · fundlens.in · Data is indicative only · Not investment advice · All data processed locally
      </div>
    )
  }

  const font = branding.brand_font
  const fontFamily = font
    ? (font === 'Source Sans Pro' ? "'Source Sans 3', sans-serif" : `'${font}', sans-serif`)
    : undefined

  const regNums = (branding.registration_numbers || [])
    .filter(r => r.number)
    .map(r => r.number.trim())
    .join(' · ')

  const contact = [branding.helpdesk_phone, branding.helpdesk_email, branding.website_url]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="f5-rpt-footer" style={{ fontFamily }}>
      {regNums      && <div style={{ marginBottom: 2 }}>{regNums}</div>}
      {branding.disclaimer_text && (
        <div style={{ marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {branding.disclaimer_text}
        </div>
      )}
      {contact      && <div style={{ marginBottom: 3 }}>{contact}</div>}
      <div style={{ marginTop: 4 }}>Powered by FundLens · fundlens.in · Data is indicative only · Not investment advice</div>
    </div>
  )
}

/* ── Report sections (unchanged from PL-16) ─────────────────── */
function SectionE1({ summary }) {
  if (!summary) return null
  const gainColor = summary.gain >= 0 ? '#15803d' : '#b91c1c'
  return (
    <div className="f5-rpt-section">
      <div className="f5-rpt-h2">Portfolio Summary</div>
      <div className="f5-stat-grid">
        <div className="f5-stat-box">
          <div className="f5-stat-val">{fmtINR(summary.current)}</div>
          <div className="f5-stat-lbl">Current Value</div>
        </div>
        <div className="f5-stat-box">
          <div className="f5-stat-val">{fmtINR(summary.invested)}</div>
          <div className="f5-stat-lbl">Amount Invested</div>
        </div>
        <div className="f5-stat-box">
          <div className="f5-stat-val" style={{ color: gainColor }}>{fmtINR(summary.gain)}</div>
          <div className="f5-stat-lbl">Unrealised Gain</div>
        </div>
        <div className="f5-stat-box">
          <div className="f5-stat-val" style={{ color: gainColor }}>
            {summary.avgXirr !== null ? fmtPct(summary.avgXirr) : '—'}
          </div>
          <div className="f5-stat-lbl">Avg XIRR</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>
        {summary.schemeCount} active schemes · {summary.amcs.length} AMC{summary.amcs.length !== 1 ? 's' : ''}
      </div>
      {summary.topByVal.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Top Holdings</div>
          <table className="f5-rpt-table">
            <thead>
              <tr>
                <th>Scheme</th>
                <th style={{ textAlign: 'right' }}>Current Value</th>
                <th style={{ textAlign: 'right' }}>Invested</th>
                <th style={{ textAlign: 'right' }}>XIRR</th>
              </tr>
            </thead>
            <tbody>
              {summary.topByVal.map((h, i) => {
                const xirr = h.xirr !== null && h.xirr !== undefined && !isNaN(h.xirr)
                const xirrColor = xirr ? (h.xirr >= 0 ? '#15803d' : '#b91c1c') : '#555'
                return (
                  <tr key={i}>
                    <td>{h.scheme_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtINR(h.current_value)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtINR(h.invested_amount)}</td>
                    <td style={{ textAlign: 'right', color: xirrColor }}>{xirr ? fmtPct(h.xirr) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function SectionE2({ alloc }) {
  if (!alloc) return null
  return (
    <div className="f5-rpt-section">
      <div className="f5-rpt-h2">Allocation Overview</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Asset Class Mix</div>
        <div className="f5-alloc-bar" style={{ marginBottom: 8 }}>
          {MACROS.map(m => (
            alloc.macroPcts[m] > 0 && (
              <div key={m} style={{ width: alloc.macroPcts[m] + '%', background: MACRO_COLORS[m] }} />
            )
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {MACROS.map(m => (
            alloc.macroPcts[m] > 0 && (
              <span key={m} style={{ fontSize: 10 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: MACRO_COLORS[m], marginRight: 4 }} />
                {m}: <strong>{alloc.macroPcts[m].toFixed(1)}%</strong>
              </span>
            )
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>AMC Breakdown</div>
      <table className="f5-rpt-table">
        <thead><tr><th>AMC</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
        <tbody>
          {alloc.topAMCs.map((a, i) => (
            <tr key={i}>
              <td>{a.amc}</td>
              <td style={{ textAlign: 'right' }}>{fmtINR(a.val)}</td>
              <td style={{ textAlign: 'right' }}>{a.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionE3({ active }) {
  if (!active.length) return null
  const sorted = [...active].sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
  return (
    <div className="f5-rpt-section">
      <div className="f5-rpt-h2">Holdings Table</div>
      <table className="f5-rpt-table">
        <thead>
          <tr>
            <th>Scheme</th><th>AMC</th>
            <th style={{ textAlign: 'right' }}>Invested</th>
            <th style={{ textAlign: 'right' }}>Current</th>
            <th style={{ textAlign: 'right' }}>XIRR</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h, i) => {
            const xirr   = h.xirr !== null && h.xirr !== undefined && !isNaN(h.xirr)
            const xColor = xirr ? (h.xirr >= 0 ? '#15803d' : '#b91c1c') : '#555'
            return (
              <tr key={i}>
                <td style={{ maxWidth: 220, wordBreak: 'break-word' }}>{h.scheme_name || '—'}</td>
                <td style={{ fontSize: '8.5pt', color: '#555' }}>{h.amc || '—'}</td>
                <td style={{ textAlign: 'right' }}>{fmtINR(h.invested_amount)}</td>
                <td style={{ textAlign: 'right' }}>{fmtINR(h.current_value)}</td>
                <td style={{ textAlign: 'right', color: xColor }}>{xirr ? fmtPct(h.xirr) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SectionE7({ gains }) {
  if (!gains) return null
  return (
    <div className="f5-rpt-section">
      <div className="f5-rpt-h2">Capital Gains (Unrealised Estimate)</div>
      <table className="f5-rpt-table">
        <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Gain</th><th style={{ textAlign: 'right' }}>Est. Tax</th></tr></thead>
        <tbody>
          <tr>
            <td>Equity LTCG (≥1 yr)</td>
            <td style={{ textAlign: 'right' }}>{fmtINR(gains.eqLTCG)}</td>
            <td style={{ textAlign: 'right' }}>{fmtINR(gains.ltcgTax)}</td>
          </tr>
          <tr>
            <td>Equity STCG (&lt;1 yr)</td>
            <td style={{ textAlign: 'right' }}>{fmtINR(gains.eqSTCG)}</td>
            <td style={{ textAlign: 'right' }}>{fmtINR(gains.stcgTax)}</td>
          </tr>
          {gains.otherGain > 0 && (
            <tr>
              <td>Debt / Other</td>
              <td style={{ textAlign: 'right' }}>{fmtINR(gains.otherGain)}</td>
              <td style={{ textAlign: 'right', color: '#888' }}>Per slab</td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: '#888', marginTop: 8 }}>
        LTCG exemption ₹1.25 L applied · Taxable LTCG: {fmtINR(gains.ltcgTaxable)} · Rates: LTCG 12.5%, STCG 20% · Indicative only
      </div>
    </div>
  )
}

function SectionF1({ health }) {
  if (!health) return null
  const scoreColor = health.score >= 75 ? '#15803d' : health.score >= 50 ? '#b45309' : '#b91c1c'
  return (
    <div className="f5-rpt-section">
      <div className="f5-rpt-h2">Portfolio Health Check</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
        <div className="f5-score-circle" style={{ borderColor: scoreColor, color: scoreColor }}>
          {health.score}
        </div>
        <div style={{ fontSize: 10 }}>
          <div><span className="f5-badge-pass">● {health.pass} PASS</span></div>
          <div><span className="f5-badge-warn">● {health.warn} WARN</span></div>
          {health.fail > 0 && <div><span className="f5-badge-fail">● {health.fail} FAIL</span></div>}
        </div>
      </div>
      <table className="f5-rpt-table">
        <thead><tr><th>Rule</th><th>Check</th><th style={{ textAlign: 'center' }}>Result</th></tr></thead>
        <tbody>
          {health.rules.map(r => (
            <tr key={r.code}>
              <td style={{ fontSize: '8.5pt', color: '#888' }}>{r.code}</td>
              <td>{r.name}</td>
              <td style={{ textAlign: 'center' }}>
                <span className={r.status === 'PASS' ? 'f5-badge-pass' : r.status === 'WARN' ? 'f5-badge-warn' : 'f5-badge-fail'}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionF3({ plan }) {
  if (!plan) return null
  return (
    <div className="f5-rpt-section">
      <div className="f5-rpt-h2">Rebalance Plan</div>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 10 }}>
        Plan built: {fmtDate(plan.builtAt)}
      </div>
      {plan.redemptions && plan.redemptions.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Redemptions</div>
          <table className="f5-rpt-table" style={{ marginBottom: 14 }}>
            <thead><tr><th>Scheme</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {plan.redemptions.map((r, i) => (
                <tr key={i}>
                  <td>{r.scheme || r.schemeName || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtINR(r.amount || r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {plan.investments && plan.investments.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Investments</div>
          <table className="f5-rpt-table">
            <thead><tr><th>Scheme</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {plan.investments.map((r, i) => (
                <tr key={i}>
                  <td>{r.scheme || r.schemeName || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtINR(r.amount || r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {plan.totalRedeemVal > 0 && (
        <div style={{ fontSize: 10, color: '#555', marginTop: 10 }}>
          Total redemption: {fmtINR(plan.totalRedeemVal)}
          {plan.equityLTCG > 0 && ` · LTCG: ${fmtINR(plan.equityLTCG)}`}
          {plan.ltcgTax > 0    && ` · Est. tax: ${fmtINR(plan.ltcgTax)}`}
        </div>
      )}
    </div>
  )
}

/* ── Main Component ──────────────────────────────────────────── */
export default function F5SendReport() {
  const width    = useWindowWidth()
  const { user, token } = useAuth()
  const { role } = useRole()
  const isMobile = width < 768

  // ── Advisor branding ────────────────────────────────────────
  const [advisorBranding, setAdvisorBranding] = useState(null)

  useEffect(() => {
    if (!user || !token || (role !== 'advisor' && role !== 'admin')) return

    let cancelled = false
    const sb = createSupabaseClient(token)

    sb.from('advisor_firm_profiles')
      .select('firm_name, tagline, logo_url, brand_colour_hex, brand_font, disclaimer_text, registration_numbers, helpdesk_phone, helpdesk_email, website_url')
      .eq('advisor_id', user.uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[F5SendReport] advisor branding fetch error:', error)
          return
        }
        if (!cancelled && data) setAdvisorBranding(data)
      })

    return () => { cancelled = true }
  }, [user, token, role])

  // Inject Google Font link if brand_font is set
  useEffect(() => {
    const font = advisorBranding?.brand_font
    if (!font) return
    const id = `adv-print-font-${font.replace(/\s+/g, '-').toLowerCase()}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    const param = font === 'Source Sans Pro' ? 'Source+Sans+3' : font.replace(/ /g, '+')
    link.href = `https://fonts.googleapis.com/css2?family=${param}:wght@400;600;700&display=swap`
    document.head.appendChild(link)
  }, [advisorBranding?.brand_font])

  /* Load portfolios from localStorage */
  const portfolios = useMemo(() => {
    try {
      const raw = localStorage.getItem(PORTFOLIO_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : [])
    } catch (e) {
      console.error('[F5SendReport] Failed to load portfolios:', e)
      return []
    }
  }, [])

  const [selectedId, setSelectedId] = useState(() => portfolios[0]?.id ?? portfolios[0]?.name ?? null)
  const [enabled, setEnabled]       = useState(new Set(['e1', 'e2', 'e3', 'e7', 'f1', 'f3']))

  const portfolio = useMemo(() => {
    if (!portfolios.length) return null
    if (!selectedId) return portfolios[0]
    return portfolios.find(p => (p.id ?? p.name) === selectedId) ?? portfolios[0]
  }, [portfolios, selectedId])

  const active = useMemo(() => {
    if (!portfolio) return []
    const holdings = portfolio.holdings ?? portfolio.schemes ?? []
    return holdings.filter(h => (h.current_value || 0) > 0 || (h.units || 0) > 0)
  }, [portfolio])

  const summary = useMemo(() => computeSummary(active), [active])
  const alloc   = useMemo(() => computeAlloc(active),   [active])
  const gains   = useMemo(() => computeGains(active),   [active])
  const health  = useMemo(() => computeHealth(active),  [active])
  const f3plan  = useMemo(() => loadSavedPlan(),        [])

  const generatedAt = new Date()

  /* Advisor firm name fallback: localStorage stub (pre-Supabase) */
  const firmNameFallback = useMemo(() => {
    if (role !== 'advisor') return null
    try {
      const raw = localStorage.getItem('fundlens_advisor_profile')
      return raw ? JSON.parse(raw)?.firm_name ?? null : null
    } catch { return null }
  }, [role])

  function toggleSection(id) {
    const sec = SECTION_LIST.find(s => s.id === id)
    if (sec?.required) return
    setEnabled(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handlePrint() {
    window.print()
  }

  function handleEmail() {
    if (!summary) return
    const subject = encodeURIComponent(`Portfolio Report — ${fmtDate(generatedAt)}`)
    const firmLine = advisorBranding?.firm_name || firmNameFallback || 'FundLens'
    const lines = [
      'Portfolio Report Summary',
      '──────────────────────────',
      `Current Value : ${fmtINR(summary.current)}`,
      `Amount Invested: ${fmtINR(summary.invested)}`,
      `Unrealised Gain: ${fmtINR(summary.gain)}`,
      summary.avgXirr !== null ? `Average XIRR   : ${fmtPct(summary.avgXirr)}` : '',
      '',
      health ? `Health Score   : ${health.score}/100 (${health.pass} PASS · ${health.warn} WARN · ${health.fail} FAIL)` : '',
      '',
      `Schemes: ${summary.schemeCount} · AMCs: ${summary.amcs.length}`,
      '',
      '──────────────────────────',
      `Generated by ${firmLine}${firmLine !== 'FundLens' ? ' · Powered by FundLens' : ''}`,
      'fundlens.in · Data is indicative only · Not investment advice',
      'All calculations performed locally on your device.',
    ].filter(l => l !== undefined)
    const body = encodeURIComponent(lines.join('\n'))
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  /* ── Empty state ───────────────────────────────────────────── */
  if (!portfolios.length || !active.length) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 560 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>F5 · Send Report</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
          No portfolio data found. Upload your CAMS / KFin statement to generate a report.
        </p>
        <Link
          to="/portfolio/f6"
          style={{
            display: 'inline-block', padding: '10px 20px', borderRadius: 8,
            background: 'var(--color-primary)', color: '#fff', fontWeight: 600,
            textDecoration: 'none', fontSize: 14,
          }}
        >
          Go to Data Manager (F6)
        </Link>
      </div>
    )
  }

  /* ── Layout ────────────────────────────────────────────────── */
  const containerStyle = { display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 24, padding: isMobile ? 12 : 28, alignItems: 'flex-start' }
  const panelStyle     = { flex: '0 0 260px', background: 'var(--color-surface)', borderRadius: 10, padding: 20, border: '1px solid var(--color-border)' }
  const previewStyle   = { flex: 1, minWidth: 0, background: '#fff', borderRadius: 10, border: '1px solid var(--color-border)', padding: isMobile ? 16 : 28, overflowX: 'auto' }
  const btnPrimary     = { display: 'block', width: '100%', padding: '10px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 10 }
  const btnSecondary   = { display: 'block', width: '100%', padding: '9px 16px', background: 'transparent', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 10 }

  return (
    <>
      {/* Dynamic print CSS — brand colour + font applied */}
      <style>{buildPrintCSS(advisorBranding)}</style>

      <div style={containerStyle}>
        {/* ── Left panel: controls (hidden in print) ── */}
        <div style={panelStyle} className="f5-no-print">
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>F5 · Send Report</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Select sections, preview, download or email.
          </div>

          {portfolios.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Portfolio</div>
              <select
                value={selectedId ?? ''}
                onChange={e => setSelectedId(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 13, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
              >
                {portfolios.map(p => (
                  <option key={p.id ?? p.name} value={p.id ?? p.name}>{p.name || 'Portfolio'}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Sections</div>
          {SECTION_LIST.map(sec => {
            const isOn  = enabled.has(sec.id)
            const isReq = sec.required
            const noData =
              (sec.id === 'f3' && !f3plan) ||
              (sec.id === 'e7' && !gains)   ||
              (sec.id === 'f1' && !health)  ||
              (sec.id === 'e2' && !alloc)
            return (
              <label key={sec.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, cursor: isReq ? 'default' : 'pointer', opacity: noData ? 0.45 : 1 }}>
                <input type="checkbox" checked={isOn} disabled={isReq || noData} onChange={() => toggleSection(sec.id)} style={{ marginTop: 3, accentColor: 'var(--color-primary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {sec.label}
                    {isReq   && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 6 }}>always</span>}
                    {noData && !isReq && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 6 }}>no data</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sec.desc}</div>
                </div>
              </label>
            )
          })}

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, marginTop: 8 }}>
            <button style={btnPrimary} onClick={handlePrint}>↓ Download PDF</button>
            <button style={btnSecondary} onClick={handleEmail} disabled={!summary}>✉ Email Draft</button>
          </div>

          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            All data processed locally · No data leaves your device · DPDP-safe
          </div>
        </div>

        {/* ── Right panel: live preview + print target ── */}
        <div style={previewStyle}>
          <div className="f5-print-report">
            <ReportHeader
              portfolio={portfolio}
              generatedAt={generatedAt}
              branding={advisorBranding}
              firmName={firmNameFallback}
            />
            {enabled.has('e1') && <SectionE1 summary={summary} />}
            {enabled.has('e2') && alloc  && <SectionE2 alloc={alloc} />}
            {enabled.has('e3') && active.length > 0 && <SectionE3 active={active} />}
            {enabled.has('e7') && gains  && <SectionE7 gains={gains} />}
            {enabled.has('f1') && health && <SectionF1 health={health} />}
            {enabled.has('f3') && f3plan && <SectionF3 plan={f3plan} />}
            <ReportFooter branding={advisorBranding} />
          </div>
        </div>
      </div>
    </>
  )
}
