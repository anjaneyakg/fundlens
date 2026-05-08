const PORTFOLIOS_KEY = 'fundlens_portfolios'
const CONSENT_KEY    = 'fundlens_pl_consent'
const SCHEMA_VERSION = '1.0'
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
    given: true,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
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

export function savePortfolios(portfolios) {
  localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify({
    schema_version: SCHEMA_VERSION,
    portfolios,
  }))
}

export function addPortfolio(portfolio) {
  const existing = getPortfolios()
  savePortfolios([...existing, portfolio])
}

export function deletePortfolio(portfolioId) {
  savePortfolios(getPortfolios().filter(p => p.portfolio_id !== portfolioId))
}

export function deleteAllData() {
  localStorage.removeItem(PORTFOLIOS_KEY)
  localStorage.removeItem(CONSENT_KEY)
}

// ── Factory ────────────────────────────────────────────────────────────────

export function newPortfolio(name, ownerType, source, uploadInfo = null) {
  const now = new Date().toISOString()
  return {
    portfolio_id:  crypto.randomUUID(),
    name,
    owner_type:    ownerType,    // "individual" | "advisor_client"
    created_at:    now,
    last_updated:  now,
    source,                      // "CAMS" | "KFin" | "Holdings"
    status:        'pending_parse',
    upload:        uploadInfo,   // { filename, size_kb, upload_date }
    pii:           { pan_present: false, folio_hashes: [] },
    holdings:      [],
    review_config: null,
    triggers:      [],
  }
}
