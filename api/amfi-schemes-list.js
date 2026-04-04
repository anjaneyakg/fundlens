// api/amfi-schemes-list.js
// Vercel Serverless Function
//
// Returns AMFI scheme names grouped by AMC — used by SchemeMapping.jsx for autocomplete.
// AMC names are normalised using the same AMC_ALIASES as amfi-schemes.js so keys
// match holdings_latest.csv amc_name values exactly.
//
// Response: { byAmc: { "ICICI Prudential Mutual Fund": ["scheme1", ...], ... } }

// ── Same AMC_ALIASES as amfi-schemes.js ──────────────────────────────────────
const AMC_ALIASES = {
  "Aditya Birla Sun Life AMC Limited":      "Aditya Birla Sun Life Mutual Fund",
  "HDFC Asset Management Company Limited":  "HDFC Mutual Fund",
  "SBI Funds Management Limited":           "SBI Mutual Fund",
  "UTI Asset Management Company Limited":   "UTI Mutual Fund",
  "DSP Investment Managers Private Limited":"DSP Mutual Fund",
  "JM Financial Asset Management Limited":  "JM Financial Mutual Fund",
  "Motilal Oswal Asset Management Company Limited": "Motilal Oswal Mutual Fund",
  "Franklin Templeton Asset Management (India) Private Limited": "Franklin Templeton Mutual Fund",
  "PGIM India Asset Management Private Limited": "PGIM India Mutual Fund",
  "HSBC Asset Management (India) Private Limited": "HSBC Mutual Fund",
  "LIC Mutual Fund Asset Management Limited": "LIC Mutual Fund",
  "360 ONE Asset Management Limited":       "360 ONE Mutual Fund",
  "Angel One Asset Management Limited":     "Angel One Mutual Fund",
  "ICICI Prudential Asset Management Company Limited": "ICICI Prudential Mutual Fund",
  "Nippon Life India Asset Management Limited": "Nippon India Mutual Fund",
  "Kotak Mahindra Asset Management Company Limited": "Kotak Mahindra Mutual Fund",
  "Trust Asset Management Private Limited": "Trust Mutual Fund",
  "Shriram Asset Management Co. Limited":   "Shriram Mutual Fund",
  "Taurus Asset Management Company Limited":"Taurus Mutual Fund",
  "Canara Robeco Asset Management Company Limited": "Canara Robeco Mutual Fund",
  "Bandhan AMC Limited":                    "Bandhan Mutual Fund",
  "Mirae Asset Investment Managers (India) Private Limited": "Mirae Asset Mutual Fund",
  "WhiteOak Capital Asset Management Limited": "WhiteOak Capital Mutual Fund",
  "Edelweiss Asset Management Limited":     "Edelweiss Mutual Fund",
  "Helios Capital Asset Management (India) Private Limited": "Helios Mutual Fund",
  "Groww Asset Management Limited":         "Groww Mutual Fund",
  "Navi AMC Limited":                       "Navi Mutual Fund",
  "NJ Asset Management Private Limited":    "NJ Mutual Fund",
  "PPFAS Asset Management Pvt. Ltd.":       "PPFAS Mutual Fund",
  "Quantum Asset Management Company Private Limited": "Quantum Mutual Fund",
  "quant Money Managers Limited":           "quant Mutual Fund",
  "Samco Asset Management Private Limited": "Samco Mutual Fund",
  "Sundaram Asset Management Company Limited": "Sundaram Mutual Fund",
  "Tata Asset Management Private Limited":  "Tata Mutual Fund",
  "Union Asset Management Company Private Limited": "Union Mutual Fund",
  "Unifi Asset Management Private Limited": "Unifi Mutual Fund",
  "Baroda BNP Paribas Asset Management India Private Limited": "Baroda BNP Paribas Mutual Fund",
  "Invesco Asset Management (India) Private Limited": "Invesco India Mutual Fund",
  "Mahindra Manulife Investment Management Private Limited": "Mahindra Manulife Mutual Fund",
  "ITI Asset Management Limited":           "ITI Mutual Fund",
  "Bajaj Finserv Asset Management Limited": "Bajaj Finserv Mutual Fund",
  "Bank of India Investment Managers Private Limited": "Bank of India Mutual Fund",
  "Axis Asset Management Company Limited":  "Axis Mutual Fund",
  "Capitalmind Asset Management Private Limited": "Capitalmind Mutual Fund",
  "Abakkus Asset Manager LLP":              "Abakkus Mutual Fund",
  "Old Bridge Asset Management Private Limited": "Old Bridge Mutual Fund",
  "Jio BlackRock Investment Managers Private Limited": "Jio BlackRock Mutual Fund",
  "The Wealth Company Asset Management Private Limited": "The Wealth Company Mutual Fund",
}

function normaliseAmc(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (AMC_ALIASES[s]) return AMC_ALIASES[s]
  for (const [alias, canonical] of Object.entries(AMC_ALIASES)) {
    if (s.startsWith(alias)) return canonical
  }
  return null  // unmapped AMC — exclude rather than guess
}

const AMFI_URL = 'https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://fundlens-six.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const upstream = await fetch(AMFI_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FundLens/1.0)' }
    })
    if (!upstream.ok) throw new Error(`AMFI returned ${upstream.status}`)

    const text  = await upstream.text()
    const lines = text.trim().split('\n')

    // AMFI CSV columns (confirmed): 0=AMC, 1=Code, 2=Scheme Name, 3=Type, 4=Category, 5=NAV Name
    const header  = lines[0].split(',').map(h => h.trim())
    const amcIdx  = header.findIndex(h => h === 'AMC')
    const nameIdx = header.findIndex(h => h === 'Scheme Name')

    // byAmc: { "ICICI Prudential Mutual Fund": Set<schemeName> }
    const byAmc = {}

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',')
      if (parts.length < 4) continue

      const amcRaw = parts[amcIdx]?.trim()
      const name   = parts[nameIdx]?.trim()
      if (!amcRaw || !name || name.length < 5) continue

      const amc = normaliseAmc(amcRaw)
      if (!amc) continue  // skip AMCs not in our holdings universe

      if (!byAmc[amc]) byAmc[amc] = new Set()
      byAmc[amc].add(name)
    }

    // Convert Sets → sorted arrays
    const result = {}
    for (const [amc, names] of Object.entries(byAmc)) {
      result[amc] = [...names].sort()
    }

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300')
    return res.status(200).json({ ok: true, byAmc: result })

  } catch (err) {
    console.error('amfi-schemes-list error:', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
