const PORTFOLIOS_KEY  = 'fundlens_portfolios'
const CONSENT_KEY     = 'fundlens_pl_consent'
const SCHEMA_VERSION  = '2.0'   // bumped: portfolio is now investor-level, not file-level
const CONSENT_VERSION = '1.0'

// ── Consent ────────────────────────────────────────────────────────────────

export function hasConsent() {
  try {
    const c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
    return c?.given === true && c?.version === CONSENT_VERSION
  } catch {
    return false
  }
}

export function saveConsent(checkboxLabels) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify({
    given:     true,
    timestamp: new Date().toISOString(),
    version:   CONSENT_VERSION,
    checkboxes: checkboxLabels,
  }))
}

export function getConsent() {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
  } catch {
    return null
  }
}

// ── Portfolios ─────────────────────────────────────────────────────────────

export function getPortfolios() {
  try {
    const data = JSON.parse(localStorage.getItem(PORTFOLIOS_KEY) || 'null')
    if (!data || data.schema_version !== SCHEMA_VERSION) return []
    return data.portfolios || []
  } catch {
    return []
  }
}

export function getPortfolio(portfolioId) {
  return getPortfolios().find(p => p.portfolio_id === portfolioId) ?? null
}

export function savePortfolios(portfolios) {
  localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify({
    schema_version: SCHEMA_VERSION,
    portfolios,
  }))
}

export function addPortfolio(portfolio) {
  savePortfolios([...getPortfolios(), portfolio])
}

export function deletePortfolio(portfolioId) {
  savePortfolios(getPortfolios().filter(p => p.portfolio_id !== portfolioId))
}

export function updatePortfolio(portfolioId, updates) {
  const portfolios = getPortfolios().map(p =>
    p.portfolio_id === portfolioId
      ? { ...p, ...updates, last_updated: new Date().toISOString() }
      : p
  )
  savePortfolios(portfolios)
}

export function deleteAllData() {
  localStorage.removeItem(PORTFOLIOS_KEY)
  localStorage.removeItem(CONSENT_KEY)
}

// ── Factory ────────────────────────────────────────────────────────────────

const RAW_INIT = { cams: null, kfin: null, holdings: null }

export function newPortfolio(name, ownerType) {
  const now = new Date().toISOString()
  return {
    portfolio_id: crypto.randomUUID(),
    name,
    owner_type:   ownerType,   // "individual" | "advisor_client"
    created_at:   now,
    last_updated: now,
    status:       'pending',   // "pending" | "partial" | "active"
    pii:          { pan_present: false, folio_hashes: [] },
    // raw stores parsed source data per RTA — any slot can be re-uploaded independently
    raw:          { ...RAW_INIT },
    holdings:     [],
  }
}
