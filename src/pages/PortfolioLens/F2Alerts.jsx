import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPortfolios } from './utils/portfolioStore'
import useWindowWidth from '../../hooks/useWindowWidth'

const ACC  = '#1D9E75'
const WARN = '#f59e0b'
const FAIL = '#ef4444'
const INFO = '#6366f1'

const ALERTS_KEY = 'fundlens_alerts_v1'
const SCHEMA_VER = '1.0'

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

// Compute live holding days from first_investment_date (more accurate than stored field)
function computeHoldingDays(h) {
  if (h.first_investment_date) {
    const d = new Date(h.first_investment_date)
    if (!isNaN(d.getTime())) return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  }
  return h.holding_period_days ?? 0
}

// Identical regex to F1HealthCheck — keep in sync with any future F1 changes
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

// ── Severity colours ──────────────────────────────────────────────────────────

const SEV_COLOR = { High: FAIL, Medium: WARN, Low: ACC }
const SEV_BG    = { High: '#fee2e2', Medium: '#fef9eb', Low: `${ACC}12` }
const SEV_BORDER= { High: '#fca5a5', Medium: '#fcd34d80', Low: `${ACC}40` }

// ── localStorage — alert snooze state ────────────────────────────────────────

function loadSnoozeMap() {
  try {
    const raw = localStorage.getItem(ALERTS_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    if (!data || data.schema_version !== SCHEMA_VER) return {}
    const map = {}
    for (const a of (data.alerts ?? [])) {
      if (a.id) map[a.id] = { state: a.state, snoozedUntil: a.snoozedUntil ?? null }
    }
    return map
  } catch (e) {
    console.error('F2Alerts: loadSnoozeMap failed', e)
    return {}
  }
}

function persistAlertState(mergedAlerts) {
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify({
      schema_version: SCHEMA_VER,
      lastUpdated:    new Date().toISOString(),
      alerts: mergedAlerts.map(a => ({
        id:           a.id,
        type:         a.type,
        state:        a.state,
        snoozedUntil: a.snoozedUntil ?? null,
      })),
    }))
  } catch (e) {
    console.error('F2Alerts: persistAlertState failed', e)
  }
}

// ── Alert evaluation engine ───────────────────────────────────────────────────
// Pure function — reads portfolio holdings and returns fired alert objects.
// No network calls. No state mutation.

function evaluateAlerts(portfolios) {
  const results = []
  const today   = new Date()

  for (const portfolio of portfolios) {
    const active = (portfolio.holdings ?? []).filter(h => h.units > 0)
    if (active.length === 0) continue

    const totalInvested = active.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
    if (totalInvested === 0) continue

    const cats       = active.map(h => ({ ...h, _days: computeHoldingDays(h), cat: inferCategory(h.scheme_name) }))
    const equityAll  = cats.filter(h => isEquityLike(h.cat))
    const equityLT   = equityAll.filter(h => h._days >= 365)
    const pid8       = portfolio.portfolio_id.slice(0, 8)

    // ── Alert 1: LTCG Window Closing ─────────────────────────────────────────
    // Equity < 12 months but within 30 days of the 12-month mark,
    // AND STCG tax exposure (gain × 20%) exceeds ₹10,000.
    for (const h of equityAll) {
      const days     = h._days
      const daysLeft = 365 - days
      if (daysLeft <= 0 || daysLeft > 30) continue

      const gain         = h.unrealised_gain ?? 0
      const stcgExposure = gain > 0 ? Math.round(gain * 0.20) : 0
      if (stcgExposure < 10000) continue

      const safeId = h.scheme_name.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_')
      results.push({
        id:             `LTCG_WINDOW-${pid8}-${safeId}`,
        type:           'LTCG_WINDOW',
        portfolioId:    portfolio.portfolio_id,
        portfolioName:  portfolio.name,
        title:          'LTCG Window Closing',
        severity:       'High',
        icon:           '⏱',
        detail:         `${h.scheme_name}: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} until LTCG eligibility. Unrealised gain: ${fmtINR(Math.round(gain))}. Redeeming now triggers ≈${fmtINR(stcgExposure)} in STCG tax at 20%. Hold ${daysLeft} more day${daysLeft !== 1 ? 's' : ''} — after that, the rate drops to 12.5% on gains above the ₹1.25L annual exemption.`,
        affectedSchemes: [h.scheme_name],
        firedAt:         today.toISOString(),
      })
    }

    // ── Alert 2: LTCG Harvest Opportunity ────────────────────────────────────
    // Total unrealised LTCG on equity held > 12 months exceeds ₹1.25L.
    const hasNav = equityLT.some(h => h.current_value != null)
    if (hasNav) {
      const totalLtcg = equityLT.reduce((s, h) => s + Math.max(0, h.unrealised_gain ?? 0), 0)
      const EXEMPT    = 125000
      if (totalLtcg > EXEMPT) {
        const taxable = totalLtcg - EXEMPT
        const taxEst  = Math.round(taxable * 0.125)
        results.push({
          id:             `LTCG_HARVEST-${pid8}`,
          type:           'LTCG_HARVEST',
          portfolioId:    portfolio.portfolio_id,
          portfolioName:  portfolio.name,
          title:          'LTCG Harvest Opportunity',
          severity:       totalLtcg > 500000 ? 'High' : 'Medium',
          icon:           '💰',
          detail:         `Total unrealised long-term equity gains: ${fmtINR(Math.round(totalLtcg))}. Above the ₹1.25L annual exemption by ${fmtINR(Math.round(taxable))}. Estimated tax at 12.5%: ≈${fmtINR(taxEst)}. Consider redeeming ₹1.25L of gains before 31 March and immediately reinvesting — this resets cost basis with zero tax, utilising the full annual exemption.`,
          affectedSchemes: equityLT.filter(h => (h.unrealised_gain ?? 0) > 0).map(h => h.scheme_name),
          firedAt:         today.toISOString(),
        })
      }
    }

    // ── Alert 3: Dormant Folio ────────────────────────────────────────────────
    // Holdings with units > 0, invested < ₹500, held for more than 90 days.
    const dormant = cats.filter(h =>
      h.units > 0.001 && (h.invested_amount ?? 0) > 0 &&
      (h.invested_amount ?? 0) < 500 && h._days > 90
    )
    if (dormant.length > 0) {
      results.push({
        id:             `DORMANT_FOLIO-${pid8}`,
        type:           'DORMANT_FOLIO',
        portfolioId:    portfolio.portfolio_id,
        portfolioName:  portfolio.name,
        title:          'Dormant Folio Cleanup',
        severity:       'Low',
        icon:           '🗂',
        detail:         `${dormant.length} folio${dormant.length !== 1 ? 's' : ''} with a balance under ₹500, held for over 90 days. These appear in every statement and tax computation but contribute no meaningful value. Redeeming all units (and requesting folio closure) removes ongoing statement noise.`,
        affectedSchemes: dormant.map(h => h.scheme_name),
        firedAt:         today.toISOString(),
      })
    }

    // ── Alert 4: SIP Due Soon ─────────────────────────────────────────────────
    // Detect monthly SIP pattern: ≥3 purchases with ~28–36 day intervals.
    // Fire if next predicted SIP is within 7 days and last purchase was < 40 days ago.
    for (const h of active) {
      if (!h.transactions || h.transactions.length < 3) continue
      const purchases = h.transactions
        .filter(tx => tx.type === 'PURCHASE' && tx.date)
        .map(tx => new Date(tx.date))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a - b)
      if (purchases.length < 3) continue

      const n    = purchases.length
      const gap1 = (purchases[n-1] - purchases[n-2]) / 86400000
      const gap2 = (purchases[n-2] - purchases[n-3]) / 86400000
      const isMonthly = gap1 >= 25 && gap1 <= 36 && gap2 >= 25 && gap2 <= 36
      if (!isMonthly) continue

      const avgGap       = (gap1 + gap2) / 2
      const lastPurchase = purchases[n-1]
      const nextDate     = new Date(lastPurchase.getTime() + avgGap * 86400000)
      const daysUntil    = Math.ceil((nextDate - today) / 86400000)
      const daysSinceLast= (today - lastPurchase) / 86400000

      if (daysUntil >= 0 && daysUntil <= 7 && daysSinceLast < 40) {
        const safeId = h.scheme_name.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_')
        results.push({
          id:             `SIP_DUE-${pid8}-${safeId}`,
          type:           'SIP_DUE',
          portfolioId:    portfolio.portfolio_id,
          portfolioName:  portfolio.name,
          title:          'SIP Due Soon',
          severity:       'Low',
          icon:           '📅',
          detail:         `${h.scheme_name}: Monthly SIP pattern detected. Predicted next SIP: ${fmtDate(nextDate.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}). Ensure sufficient balance in your linked bank account to avoid SIP failure. This prediction is based on your transaction history.`,
          affectedSchemes: [h.scheme_name],
          firedAt:         today.toISOString(),
        })
      }
    }

    // ── Alert 5: AMC Concentration Risk ──────────────────────────────────────
    // Single fund house > 50% of portfolio invested value.
    const amcMap = {}
    for (const h of active) {
      const amc = (h.amc ?? 'Unknown').trim() || 'Unknown'
      amcMap[amc] = (amcMap[amc] ?? 0) + (h.invested_amount ?? 0)
    }
    const topEntry = Object.entries(amcMap).sort(([, a], [, b]) => b - a)[0]
    if (topEntry) {
      const topPct = (topEntry[1] / totalInvested) * 100
      if (topPct > 50) {
        const safeAmc = topEntry[0].slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_')
        results.push({
          id:             `CONCENTRATION_RISK-${pid8}-${safeAmc}`,
          type:           'CONCENTRATION_RISK',
          portfolioId:    portfolio.portfolio_id,
          portfolioName:  portfolio.name,
          title:          'AMC Concentration Risk',
          severity:       'High',
          icon:           '⚠',
          detail:         `${topEntry[0]} holds ${topPct.toFixed(0)}% of your portfolio (${fmtINR(Math.round(topEntry[1]))}). A SEBI action, redemption freeze, NAV restatement, or operational disruption at this fund house would simultaneously affect a majority of your investments. Diversifying across AMCs is independent of diversifying across individual funds.`,
          affectedSchemes: active
            .filter(h => ((h.amc ?? 'Unknown').trim() || 'Unknown') === topEntry[0])
            .map(h => h.scheme_name),
          firedAt:         today.toISOString(),
        })
      }
    }

    // ── Alert 6: Underperforming Fund ─────────────────────────────────────────
    // Fund's XIRR trails the portfolio average by ≥ 5pp, invested ≥ ₹50K.
    // (Category-average comparison requires external data not available locally.
    //  Portfolio-average XIRR is used as a reasonable local proxy.)
    const scorable = active.filter(h => h.xirr != null && (h.invested_amount ?? 0) >= 10000)
    if (scorable.length >= 3) {
      const avgXirr = scorable.reduce((s, h) => s + h.xirr, 0) / scorable.length
      for (const h of scorable) {
        const gap = avgXirr - h.xirr
        if (gap >= 0.05 && (h.invested_amount ?? 0) >= 50000) {
          const safeId = h.scheme_name.slice(0, 24).replace(/[^a-zA-Z0-9]/g, '_')
          results.push({
            id:             `UNDERPERFORMING-${pid8}-${safeId}`,
            type:           'UNDERPERFORMING',
            portfolioId:    portfolio.portfolio_id,
            portfolioName:  portfolio.name,
            title:          'Underperforming Fund',
            severity:       'Medium',
            icon:           '📉',
            detail:         `${h.scheme_name}: XIRR ${(h.xirr * 100).toFixed(1)}% vs portfolio average ${(avgXirr * 100).toFixed(1)}% — trailing by ${(gap * 100).toFixed(1)}pp. Invested: ${fmtINR(Math.round(h.invested_amount ?? 0))}. Review this scheme in E5 Performance Matrix. Note: comparison is against your portfolio average, not an external category benchmark.`,
            affectedSchemes: [h.scheme_name],
            firedAt:         today.toISOString(),
          })
        }
      }
    }
  }

  return results
}

// ── Merge evaluated alerts with stored snooze state ───────────────────────────

function mergeWithSnoozed(evaluated, snoozeMap) {
  const now = new Date()
  return evaluated.map(alert => {
    const stored = snoozeMap[alert.id]
    if (!stored) return { ...alert, state: 'fired', snoozedUntil: null }
    if (stored.state === 'snoozed' && stored.snoozedUntil) {
      const until = new Date(stored.snoozedUntil)
      if (now < until) return { ...alert, state: 'snoozed', snoozedUntil: stored.snoozedUntil }
    }
    return { ...alert, state: 'fired', snoozedUntil: null }
  })
}

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const color  = SEV_COLOR[severity]  ?? ACC
  const bg     = SEV_BG[severity]    ?? `${ACC}12`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
      padding: '2px 9px', borderRadius: 20, flexShrink: 0,
      color, background: bg,
    }}>
      {severity}
    </span>
  )
}

// ── Snooze dropdown ───────────────────────────────────────────────────────────

function SnoozeMenu({ alertId, onSnooze }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        style={{ ...s.actionBtn, ...s.btnGhost }}
        onClick={() => setOpen(o => !o)}
      >
        Snooze ▾
      </button>
      {open && (
        <>
          {/* Invisible backdrop to close on outside click */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setOpen(false)}
          />
          <div style={s.snoozeDropdown}>
            {[
              { label: '7 days',  days: 7  },
              { label: '30 days', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={days}
                style={s.snoozeOption}
                onClick={() => { onSnooze(alertId, days); setOpen(false) }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, onSnooze, onDismiss, onReactivate, showPortfolio }) {
  const color    = SEV_COLOR[alert.severity]  ?? ACC
  const border   = SEV_BORDER[alert.severity] ?? `${ACC}40`
  const isSnoozed = alert.state === 'snoozed'

  return (
    <div style={{
      ...s.alertCard,
      borderLeftColor: color,
      opacity: isSnoozed ? 0.7 : 1,
    }}>
      {/* Header row */}
      <div style={s.alertHeader}>
        <div style={s.alertHeaderLeft}>
          <span style={s.alertIcon}>{alert.icon}</span>
          <div style={s.alertTitleBlock}>
            <div style={s.alertTitle}>{alert.title}</div>
            {showPortfolio && alert.portfolioName && (
              <div style={s.alertMeta}>{alert.portfolioName}</div>
            )}
          </div>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>

      {/* Detail text */}
      <p style={s.alertDetail}>{alert.detail}</p>

      {/* Affected schemes */}
      {alert.affectedSchemes?.length > 0 && (
        <div style={s.schemeList}>
          {alert.affectedSchemes.slice(0, 5).map((name, i) => (
            <span key={i} style={s.schemeChip} title={name}>
              {name.length > 48 ? name.slice(0, 46) + '…' : name}
            </span>
          ))}
          {alert.affectedSchemes.length > 5 && (
            <span style={{ ...s.schemeChip, color: '#9ca3af', borderStyle: 'dashed' }}>
              +{alert.affectedSchemes.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Action row */}
      <div style={s.alertActions}>
        {isSnoozed ? (
          <>
            <span style={s.snoozedLabel}>Snoozed until {fmtDate(alert.snoozedUntil)}</span>
            <button
              style={{ ...s.actionBtn, ...s.btnGhost }}
              onClick={() => onReactivate(alert.id)}
            >
              Re-activate
            </button>
          </>
        ) : (
          <>
            <SnoozeMenu alertId={alert.id} onSnooze={onSnooze} />
            <button
              style={{ ...s.actionBtn, ...s.btnDismiss }}
              onClick={() => onDismiss(alert.id)}
            >
              Dismiss
            </button>
          </>
        )}
      </div>
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
        value={selectedId}
        onChange={e => onChange(e.target.value)}
      >
        <option value="__all__">All portfolios</option>
        {portfolios.map(p => (
          <option key={p.portfolio_id} value={p.portfolio_id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab, navigate }) {
  const allClear = tab !== 'snoozed'
  return (
    <div style={s.emptyWrap}>
      <div style={s.emptyCard}>
        <div style={s.emptyIcon}>{allClear ? '✅' : '💤'}</div>
        <div style={s.emptyTitle}>
          {tab === 'active'  && 'No active alerts'}
          {tab === 'snoozed' && 'No snoozed alerts'}
          {tab === 'all'     && 'No alerts — all checks passed'}
        </div>
        <div style={s.emptySub}>
          {tab === 'active'
            ? 'All 6 portfolio checks passed. Re-check any time after uploading updated statements.'
            : tab === 'snoozed'
              ? 'You have not snoozed any alerts. Snoozed alerts appear here until their re-check date.'
              : 'All 6 checks are clear. Upload CAMS + KFin statements for the most accurate results.'}
        </div>
        {tab !== 'snoozed' && (
          <button style={{ ...s.actionBtn, ...s.btnPrimary, marginTop: '1rem' }} onClick={() => navigate('/portfolio/f6')}>
            Update portfolio data
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main F2Alerts page ────────────────────────────────────────────────────────

export default function F2Alerts() {
  const navigate   = useNavigate()
  const width      = useWindowWidth()
  const mobile     = width < 768

  // Re-check key: incrementing forces re-evaluation
  const [checkKey,   setCheckKey]   = useState(0)
  const [checkedAt,  setCheckedAt]  = useState(() => new Date())
  const [snoozeMap,  setSnoozeMap]  = useState(loadSnoozeMap)
  const [tab,        setTab]        = useState('active')
  const [selectedId, setSelectedId] = useState('__all__')

  const portfolios = useMemo(() => getPortfolios(), [checkKey])
  const evaluated  = useMemo(() => evaluateAlerts(portfolios), [portfolios])
  const allAlerts  = useMemo(() => mergeWithSnoozed(evaluated, snoozeMap), [evaluated, snoozeMap])

  // Filter by selected portfolio
  const portAlerts = useMemo(() =>
    selectedId === '__all__'
      ? allAlerts
      : allAlerts.filter(a => a.portfolioId === selectedId),
    [allAlerts, selectedId]
  )

  // Filter by tab
  const tabAlerts = useMemo(() => {
    if (tab === 'active')  return portAlerts.filter(a => a.state === 'fired')
    if (tab === 'snoozed') return portAlerts.filter(a => a.state === 'snoozed')
    return portAlerts
  }, [portAlerts, tab])

  // ── Actions ───────────────────────────────────────────────────────────────

  function applySnoozeMap(newMap) {
    setSnoozeMap(newMap)
    persistAlertState(mergeWithSnoozed(evaluated, newMap))
  }

  const handleSnooze = (alertId, days) => {
    const until  = new Date(Date.now() + days * 86400000).toISOString()
    applySnoozeMap({ ...snoozeMap, [alertId]: { state: 'snoozed', snoozedUntil: until } })
  }

  const handleDismiss = (alertId) => {
    // Dismiss = snooze for 365 days (effectively until next evaluation cycle)
    const until = new Date(Date.now() + 365 * 86400000).toISOString()
    applySnoozeMap({ ...snoozeMap, [alertId]: { state: 'snoozed', snoozedUntil: until } })
  }

  const handleReactivate = (alertId) => {
    applySnoozeMap({ ...snoozeMap, [alertId]: { state: 'fired', snoozedUntil: null } })
  }

  const handleRecheck = () => {
    setCheckedAt(new Date())
    setCheckKey(k => k + 1)
    // Reset snooze map from localStorage (in case another tab updated it)
    setSnoozeMap(loadSnoozeMap())
  }

  // ── No portfolios ─────────────────────────────────────────────────────────
  if (portfolios.length === 0) {
    return (
      <div style={s.centreWrap}>
        <div style={s.emptyCard}>
          <div style={s.emptyIcon}>📋</div>
          <div style={s.emptyTitle}>No portfolio data yet</div>
          <div style={s.emptySub}>
            Upload CAMS and KFin transaction files in F6 Data Manager to enable portfolio alert monitoring.
          </div>
          <button style={{ ...s.actionBtn, ...s.btnPrimary, marginTop: '1rem' }} onClick={() => navigate('/portfolio/f6')}>
            Go to Data Manager
          </button>
        </div>
      </div>
    )
  }

  const activeCount  = portAlerts.filter(a => a.state === 'fired').length
  const snoozedCount = portAlerts.filter(a => a.state === 'snoozed').length
  const showPortfolio = selectedId === '__all__' && portfolios.length > 1

  return (
    <div>
      {/* Page header */}
      <div style={s.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={s.pageTitle}>F2 Alerts</h1>
            <p style={s.pageSub}>6 checks · watching your portfolio for tax windows, risks, and opportunities</p>
          </div>
          <button style={{ ...s.actionBtn, ...s.btnOutline, flexShrink: 0 }} onClick={handleRecheck}>
            ↻ Re-check
          </button>
        </div>
        <div style={s.checkedAtLine}>
          Last checked {fmtDate(checkedAt.toISOString())} · all analysis runs locally in your browser
        </div>
      </div>

      {/* Portfolio selector — only if multiple portfolios */}
      {portfolios.length > 1 && (
        <PortfolioSelector
          portfolios={portfolios}
          selectedId={selectedId}
          onChange={id => setSelectedId(id)}
        />
      )}

      {/* Summary strip */}
      <div style={{ ...s.summaryStrip, flexDirection: mobile ? 'column' : 'row' }}>
        <div style={s.summaryItem}>
          <span style={{ ...s.summaryNum, color: activeCount > 0 ? FAIL : ACC }}>
            {activeCount}
          </span>
          <span style={s.summaryLabel}>Active alerts</span>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <span style={{ ...s.summaryNum, color: '#6b7280' }}>{snoozedCount}</span>
          <span style={s.summaryLabel}>Snoozed</span>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <span style={{ ...s.summaryNum, color: ACC }}>6</span>
          <span style={s.summaryLabel}>Checks running</span>
        </div>
        {/* Check type legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {[
            { label: 'LTCG Window',     icon: '⏱' },
            { label: 'LTCG Harvest',    icon: '💰' },
            { label: 'Dormant Folio',   icon: '🗂' },
            { label: 'SIP Due',         icon: '📅' },
            { label: 'Concentration',   icon: '⚠' },
            { label: 'Underperforming', icon: '📉' },
          ].map(({ label, icon }) => (
            <span key={label} style={s.legendChip}>
              {icon} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {[
          { key: 'active',  label: `Active ${activeCount > 0 ? `(${activeCount})` : ''}` },
          { key: 'snoozed', label: `Snoozed ${snoozedCount > 0 ? `(${snoozedCount})` : ''}` },
          { key: 'all',     label: `All (${portAlerts.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            style={{ ...s.tabBtn, ...(tab === key ? s.tabBtnActive : {}) }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Alert list or empty state */}
      {tabAlerts.length === 0 ? (
        <EmptyState tab={tab} navigate={navigate} />
      ) : (
        <div style={s.alertList}>
          {tabAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onSnooze={handleSnooze}
              onDismiss={handleDismiss}
              onReactivate={handleReactivate}
              showPortfolio={showPortfolio}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={s.footerNote}>
        <span style={s.footerDot} />
        Alerts are evaluated against locally-stored transaction data. No data is sent to any server.
        LTCG and tax estimates are approximate — consult a tax advisor for personalised advice.
        Re-check after uploading fresh CAMS / KFin statements for accurate results.
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // Centre / empty wrap
  centreWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  emptyCard:  { textAlign: 'center', padding: '2.5rem 3rem', background: '#fff', borderRadius: 20, border: `1px solid ${ACC}22`, boxShadow: `0 4px 24px ${ACC}08`, maxWidth: 420 },
  emptyWrap:  { padding: '3rem 0' },
  emptyIcon:  { fontSize: 40, marginBottom: '1rem' },
  emptyTitle: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: '#0d3d2b', marginBottom: 8 },
  emptySub:   { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', lineHeight: 1.65 },

  // Page header
  pageHeader: { marginBottom: '1.25rem' },
  pageTitle:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0d3d2b', margin: '0 0 0.2rem' },
  pageSub:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#6b9e8d', margin: 0 },
  checkedAtLine: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: '#a7d9ca', marginTop: 6, letterSpacing: '0.01em' },

  // Portfolio selector
  selectorRow:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem', flexWrap: 'wrap' },
  selectorLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0 },
  selector:      { padding: '7px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#fff', cursor: 'pointer', outline: 'none', maxWidth: 300, color: '#111827' },

  // Summary strip
  summaryStrip:  { display: 'flex', alignItems: 'center', gap: 16, background: '#fff', borderRadius: 14, border: `1px solid ${ACC}18`, padding: '1rem 1.25rem', marginBottom: '1rem', boxShadow: `0 2px 10px ${ACC}06`, flexWrap: 'wrap' },
  summaryItem:   { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  summaryNum:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 800, lineHeight: 1 },
  summaryLabel:  { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase' },
  summaryDivider:{ width: 1, height: 32, background: '#f0f0f0', flexShrink: 0 },
  legendChip:    { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 500, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 12 },

  // Tab bar
  tabBar:       { display: 'flex', gap: 4, marginBottom: '1rem' },
  tabBtn:       { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280', transition: 'all 0.15s' },
  tabBtnActive: { background: `${ACC}12`, borderColor: `${ACC}40`, color: ACC },

  // Alert list
  alertList: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' },

  // Alert card
  alertCard: {
    background: '#fff', borderRadius: 14,
    borderLeft: '4px solid', borderTop: '1px solid #f0f0f0',
    borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0',
    padding: '1rem 1.25rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
    transition: 'opacity 0.2s',
  },
  alertHeader:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: '0.6rem' },
  alertHeaderLeft: { display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 },
  alertIcon:       { fontSize: 20, lineHeight: 1.3, flexShrink: 0 },
  alertTitleBlock: { flex: 1, minWidth: 0 },
  alertTitle:      { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: '#0d3d2b', lineHeight: 1.3, marginBottom: 2 },
  alertMeta:       { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', fontWeight: 500 },
  alertDetail:     { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: '#374151', lineHeight: 1.65, margin: '0 0 0.75rem' },

  // Affected scheme chips
  schemeList: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: '0.875rem' },
  schemeChip: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 6, background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  // Action row
  alertActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  snoozedLabel: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#9ca3af', fontStyle: 'italic', flex: 1 },

  // Snooze dropdown
  snoozeDropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0,
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    zIndex: 99, overflow: 'hidden', minWidth: 110,
  },
  snoozeOption: {
    display: 'block', width: '100%', padding: '8px 14px',
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, fontWeight: 600,
    color: '#374151', background: 'none', border: 'none', cursor: 'pointer',
    textAlign: 'left', transition: 'background 0.1s',
  },

  // Buttons
  actionBtn: {
    padding: '6px 14px', borderRadius: 8, fontSize: 12,
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
    cursor: 'pointer', border: 'none', lineHeight: 1, flexShrink: 0,
    transition: 'background 0.12s',
  },
  btnPrimary: { background: ACC, color: '#fff', boxShadow: `0 2px 8px ${ACC}40` },
  btnGhost:   { background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb' },
  btnOutline: { background: 'transparent', color: ACC, border: `1.5px solid ${ACC}50` },
  btnDismiss: { background: '#f9fafb', color: '#9ca3af', border: '1.5px solid #f0f0f0' },

  // Footer
  footerNote: { display: 'flex', alignItems: 'flex-start', gap: 8, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, color: '#b5d4cb', lineHeight: 1.55, paddingTop: '0.75rem', borderTop: `1px solid ${ACC}10` },
  footerDot:  { width: 6, height: 6, borderRadius: '50%', background: `${ACC}80`, flexShrink: 0, marginTop: 3 },
}
