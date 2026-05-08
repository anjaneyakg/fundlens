// ── XIRR (Newton-Raphson) ─────────────────────────────────────────────────────
// cashflows: [{ amount: number, date: Date }]
// purchase = negative amount (money leaving investor), redemption = positive

function xirr(cashflows) {
  if (!cashflows || cashflows.length < 2) return null

  const t0   = cashflows[0].date.getTime()
  const vals = cashflows.map(cf => cf.amount)
  const yrs  = cashflows.map(cf => (cf.date.getTime() - t0) / (365.25 * 86400 * 1000))

  function npv(r) {
    return vals.reduce((sum, v, i) => sum + v / Math.pow(1 + r, yrs[i]), 0)
  }

  let rate = 0.15
  for (let iter = 0; iter < 300; iter++) {
    const f  = npv(rate)
    const df = (npv(rate + 1e-6) - f) / 1e-6
    if (!isFinite(df) || Math.abs(df) < 1e-14) break
    const next = rate - f / df
    if (!isFinite(next)) break
    if (Math.abs(next - rate) < 1e-9) { rate = next; break }
    rate = Math.max(-0.9999, next)
  }

  return isFinite(rate) ? Math.round(rate * 1e6) / 1e6 : null
}

// ── Main engine ───────────────────────────────────────────────────────────────

/**
 * Build holdings array from parsed transactions + optional holdings snapshot.
 *
 * transactions: output of fileParser.parseCams / parseKFin → .transactions[]
 * snapshots:    output of fileParser.parseHoldings → .snapshots[] (optional)
 *
 * Returns holdings[] matching the localStorage schema.
 */
export function buildHoldings(transactions, snapshots = []) {
  // Snapshot lookup: scheme_name + folio → snapshot
  const snapMap = {}
  snapshots.forEach(s => {
    const key = `${s.scheme_name.trim()}|${s.folio.trim()}`
    snapMap[key] = s
  })

  // Group transactions by scheme + folio
  const groups = {}
  for (const tx of transactions) {
    const key = `${tx.scheme_name.trim()}|${tx.folio.trim()}`
    if (!groups[key]) groups[key] = { ref: tx, txs: [] }
    groups[key].txs.push(tx)
  }

  const today    = new Date()
  const holdings = []

  for (const [key, { ref, txs }] of Object.entries(groups)) {
    // Sort chronologically
    txs.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

    let totalUnits     = 0
    let investedAmount = 0   // cost of currently-held units (avg-cost method)

    for (const tx of txs) {
      if (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') {
        totalUnits     += tx.units
        investedAmount += tx.amount
      } else if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
        if (totalUnits > 0) {
          const avgCost  = investedAmount / totalUnits
          investedAmount = Math.max(0, investedAmount - avgCost * tx.units)
        }
        totalUnits = Math.max(0, totalUnits - tx.units)
      }
      // REVERSAL, DIVIDEND, ADMIN: no unit/cost impact in this simplified model
    }

    totalUnits     = Math.round(totalUnits * 1e6)  / 1e6
    investedAmount = Math.round(investedAmount * 100) / 100
    const avgCostNav = totalUnits > 0
      ? Math.round((investedAmount / totalUnits) * 1e4) / 1e4
      : 0

    // First purchase date & holding period
    const firstTx   = txs.find(tx => tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN')
    const firstDate = firstTx?.date ? new Date(firstTx.date) : null
    const holdingDays = firstDate && !isNaN(firstDate.getTime())
      ? Math.max(0, Math.floor((today - firstDate) / 86400000))
      : 0

    // Current value & NAV from holdings snapshot (if provided)
    const snap         = snapMap[key]
    const currentValue = snap?.current_value ?? null
    const currentNav   = snap?.current_nav   ?? null

    const unrealisedGain = currentValue != null
      ? Math.round((currentValue - investedAmount) * 100) / 100
      : null
    const unrealisedGainPct = investedAmount > 0 && currentValue != null
      ? Math.round(((currentValue - investedAmount) / investedAmount) * 10000) / 100
      : null

    // XIRR cashflows
    const cfs = txs
      .filter(tx => tx.date && ['PURCHASE', 'SWITCH_IN', 'REDEMPTION', 'SWITCH_OUT'].includes(tx.type))
      .map(tx => ({
        date:   new Date(tx.date),
        amount: (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') ? -tx.amount : tx.amount,
      }))
      .filter(cf => !isNaN(cf.date.getTime()) && cf.amount !== 0)

    // Add current value as hypothetical terminal inflow
    if (currentValue != null && totalUnits > 0) {
      cfs.push({ date: today, amount: currentValue })
    }

    const xirrVal = cfs.length >= 2 ? xirr(cfs) : null

    // Detect Direct / Regular from scheme name
    const nameLower = ref.scheme_name.toLowerCase()
    const plan   = nameLower.includes('direct') ? 'Direct' : 'Regular'
    const option = nameLower.includes('idcw') || nameLower.includes('dividend') ? 'IDCW' : 'Growth'

    holdings.push({
      scheme_name:          ref.scheme_name,
      amc:                  ref.amc,
      folio:                ref.folio,
      isin:                 ref.isin ?? null,
      plan,
      option,
      units:                totalUnits,
      avg_cost_nav:         avgCostNav,
      invested_amount:      investedAmount,
      current_nav:          currentNav,
      current_value:        currentValue,
      unrealised_gain:      unrealisedGain,
      unrealised_gain_pct:  unrealisedGainPct,
      xirr:                 xirrVal,
      first_investment_date: firstTx?.date ?? null,
      holding_period_days:  holdingDays,
      transactions: txs.map(tx => ({
        date:   tx.date,
        type:   tx.type,
        amount: tx.amount,
        units:  tx.units,
        nav:    tx.nav,
      })),
    })
  }

  // Sort by invested_amount descending (largest holding first)
  holdings.sort((a, b) => b.invested_amount - a.invested_amount)
  return holdings
}

// ── Merge all raw source data into holdings ───────────────────────────────────
// raw = { cams: {transactions, meta, ...}, kfin: {...}, holdings: {snapshots, ...} }

export function mergeRawToHoldings(raw) {
  const transactions = [
    ...(raw?.cams?.transactions     ?? []),
    ...(raw?.kfin?.transactions     ?? []),
  ]
  const snapshots = raw?.holdings?.snapshots ?? []
  return buildHoldings(transactions, snapshots)
}

// ── Portfolio-level XIRR ─────────────────────────────────────────────────────

export function portfolioXirr(holdings) {
  const today = new Date()
  const cfs   = []
  let totalCurrent = 0
  let hasCurrent   = false

  for (const h of holdings) {
    if (!h.transactions) continue
    for (const tx of h.transactions) {
      if (!tx.date) continue
      if (!['PURCHASE', 'SWITCH_IN', 'REDEMPTION', 'SWITCH_OUT'].includes(tx.type)) continue
      const d = new Date(tx.date)
      if (isNaN(d.getTime()) || !tx.amount) continue
      cfs.push({
        date:   d,
        amount: (tx.type === 'PURCHASE' || tx.type === 'SWITCH_IN') ? -tx.amount : tx.amount,
      })
    }
    if (h.current_value != null && h.units > 0) {
      totalCurrent += h.current_value
      hasCurrent    = true
    }
  }

  if (hasCurrent) cfs.push({ date: today, amount: totalCurrent })
  if (cfs.length < 2) return null
  cfs.sort((a, b) => a.date - b.date)
  return xirr(cfs)
}

// ── Portfolio-level summary ───────────────────────────────────────────────────

export function summarise(holdings) {
  const active = holdings.filter(h => h.units > 0)

  const totalInvested     = active.reduce((s, h) => s + (h.invested_amount ?? 0), 0)
  const totalCurrentValue = active.every(h => h.current_value != null)
    ? active.reduce((s, h) => s + h.current_value, 0)
    : null
  const totalGain = totalCurrentValue != null ? totalCurrentValue - totalInvested : null
  const totalGainPct = totalInvested > 0 && totalGain != null
    ? (totalGain / totalInvested) * 100 : null

  return {
    total_invested:      Math.round(totalInvested * 100) / 100,
    total_current_value: totalCurrentValue != null ? Math.round(totalCurrentValue * 100) / 100 : null,
    total_gain:          totalGain != null ? Math.round(totalGain * 100) / 100 : null,
    total_gain_pct:      totalGainPct != null ? Math.round(totalGainPct * 100) / 100 : null,
    scheme_count:        active.length,
    amc_count:           new Set(active.map(h => h.amc)).size,
  }
}
