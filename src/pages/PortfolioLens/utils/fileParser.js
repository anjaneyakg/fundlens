import * as XLSX from 'xlsx'

// ── Date helpers ─────────────────────────────────────────────────────────────

const MONTHS = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
}

function parseDate(str) {
  if (!str) return null
  const s = String(str).trim()
  const m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,})[- ](\d{4})$/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (mo) return new Date(+m[3], mo - 1, +m[1])
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function excelSerial(n) {
  return new Date(Math.round((n - 25569) * 86400 * 1000))
}

function toYMD(d) {
  if (!d) return null
  const y = d.getFullYear(), mo = d.getMonth() + 1, dd = d.getDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

// ── Number helper ─────────────────────────────────────────────────────────────

function num(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}

// ── Header detection ──────────────────────────────────────────────────────────

function hasAll(row, keys) {
  if (!Array.isArray(row)) return false
  const norm = row.map(h => String(h).trim())
  return keys.every(k => norm.includes(k))
}

// ── Transaction type normalisation ────────────────────────────────────────────

function normType(raw) {
  const s = String(raw ?? '').toLowerCase()
  if (s.includes('switch') && (s.includes(' in') || s.includes('-in')))  return 'SWITCH_IN'
  if (s.includes('switch') && (s.includes(' out') || s.includes('-out'))) return 'SWITCH_OUT'
  if (s.includes('switch')) return 'SWITCH_IN'  // fallback
  if (s.includes('reversal') || s.includes('reverse')) return 'REVERSAL'
  if (s.includes('dividend')) return 'DIVIDEND'
  if (s.includes('redemption') || s.includes('redeem') || s.includes('systematic withdrawal') || s.includes('swp')) return 'REDEMPTION'
  if (s.includes('purchase') || s.includes('sip') || s.includes('invest') || s.includes('lumpsum') || s.includes('lump sum') || s.includes('nfo')) return 'PURCHASE'
  return 'ADMIN'
}

// ── DPDP: SHA-256 folio hash ──────────────────────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function detectAndParse(file) {
  let buf
  try {
    buf = await file.arrayBuffer()
  } catch (e) {
    console.error('fileParser: could not read file', e)
    return { detected: null, error: 'Could not read file. Please try again.' }
  }

  let wb
  try {
    wb = XLSX.read(buf, { type: 'array', cellDates: false })
  } catch (e) {
    console.error('fileParser: XLSX.read failed', e)
    return { detected: null, error: 'Could not parse this file. If it is a genuine .xls (Excel 97) file, please open it in Excel and save as .xlsx, then retry.' }
  }

  const ws   = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const h0 = rows[0]?.map(h => String(h).trim()) ?? []
  const h1 = rows[1]?.map(h => String(h).trim()) ?? []

  if (hasAll(h0, ['MF_NAME', 'INVESTOR_NAME', 'FOLIO_NUMBER'])) return parseCams(rows)
  if (hasAll(h0, ['FundName', 'Account Number', 'SchemeISIN']))   return parseKFin(rows)
  if (hasAll(h1, ['AMC Name', 'SCHEMECODE', 'Unit Balance']))     return parseHoldings(rows, 1)
  if (hasAll(h0, ['AMC Name', 'SCHEMECODE', 'Unit Balance']))     return parseHoldings(rows, 0)

  return {
    detected: null,
    error: `File type not recognised. Headers found: "${h0.slice(0, 5).join(', ')}". Check you selected the correct source type.`,
  }
}

// ── CAMS transaction parser ───────────────────────────────────────────────────

async function parseCams(rows) {
  const hdr  = rows[0].map(h => String(h).trim())
  const col  = k => hdr.indexOf(k)

  const C = {
    mf:    col('MF_NAME'),
    name:  col('INVESTOR_NAME'),
    pan:   col('PAN'),
    folio: col('FOLIO_NUMBER'),
    schm:  col('SCHEME_NAME'),
    date:  col('TRADE_DATE'),
    type:  col('TRANSACTION_TYPE'),
    amt:   col('AMOUNT'),
    units: col('UNITS'),
    nav:   col('PRICE'),
  }

  const transactions = []
  const folioSet     = new Set()
  let   panPresent   = false

  for (let i = 1; i < rows.length; i++) {
    const r      = rows[i]
    const scheme = String(r[C.schm] ?? '').trim()
    const mf     = String(r[C.mf]   ?? '').trim()
    if (!scheme || !mf) continue

    const pan   = String(r[C.pan]   ?? '').trim()
    const folio = String(r[C.folio] ?? '').trim()
    if (pan && pan !== 'N.A.' && pan.length === 10) panPresent = true
    if (folio) folioSet.add(folio)

    const date   = toYMD(parseDate(String(r[C.date] ?? '')))
    const txType = normType(String(r[C.type] ?? ''))
    const units  = Math.abs(num(r[C.units]))
    const nav    = num(r[C.nav])
    const amount = Math.abs(num(r[C.amt]))

    transactions.push({
      scheme_name:   scheme,
      amc:           mf,
      folio,
      investor_name: String(r[C.name] ?? '').trim(),
      isin:          null,
      date,
      type:   txType,
      amount,
      units,
      nav,
    })
  }

  const folioHashes = await Promise.all([...folioSet].map(sha256))
  return { detected: 'CAMS', transactions, meta: { pan_present: panPresent, folio_hashes: folioHashes } }
}

// ── KFin transaction parser ───────────────────────────────────────────────────

async function parseKFin(rows) {
  const hdr = rows[0].map(h => String(h).trim())
  const col = k => hdr.indexOf(k)

  const C = {
    fund:  col('FundName'),
    name:  col('Investor Name'),
    acct:  col('Account Number'),
    schm:  col('Scheme Description'),
    date:  col('Transaction Date'),
    type:  col('Transaction Description'),
    amt:   col('Amount'),
    units: col('Units'),
    nav:   col('NAV'),
    isin:  col('SchemeISIN'),
  }

  const transactions = []
  const folioSet     = new Set()

  for (let i = 1; i < rows.length; i++) {
    const r      = rows[i]
    const scheme = String(r[C.schm] ?? '').trim()
    const fund   = String(r[C.fund] ?? '').trim()
    if (!scheme || !fund) continue

    const folio = String(r[C.acct] ?? '').trim()
    if (folio) folioSet.add(folio)

    const date   = toYMD(parseDate(String(r[C.date] ?? '')))
    const txType = normType(String(r[C.type] ?? ''))
    const units  = Math.abs(num(r[C.units]))
    const nav    = num(r[C.nav])
    const amount = Math.abs(num(r[C.amt]))
    const isin   = String(r[C.isin] ?? '').trim()

    transactions.push({
      scheme_name:   scheme,
      amc:           fund,
      folio,
      investor_name: String(r[C.name] ?? '').trim(),
      isin,
      date,
      type:   txType,
      amount,
      units,
      nav,
    })
  }

  const folioHashes = await Promise.all([...folioSet].map(sha256))
  return { detected: 'KFin', transactions, meta: { pan_present: false, folio_hashes: folioHashes } }
}

// ── CAMS Holdings snapshot parser ─────────────────────────────────────────────

async function parseHoldings(rows, headerRow) {
  const hdr = rows[headerRow].map(h => String(h).trim())
  const col = k => hdr.indexOf(k)

  const C = {
    amc:   col('AMC Name'),
    code:  col('SCHEMECODE'),
    schm:  col('Scheme'),
    folio: col('Folio'),
    units: col('Unit Balance'),
    navd:  col('NAV Date'),
    curr:  col('Current Value(Rs.)'),
    cost:  col('Cost Value(Rs.)'),
  }

  const snapshots = []
  const folioSet  = new Set()

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r      = rows[i]
    const scheme = String(r[C.schm] ?? '').trim()
    const amc    = String(r[C.amc]  ?? '').trim()
    if (!scheme || !amc) continue

    const folio    = String(r[C.folio] ?? '').trim()
    const amfiCode = String(r[C.code]  ?? '').trim()
    const units    = num(r[C.units])
    const currVal  = num(r[C.curr])
    const costVal  = num(r[C.cost])

    const navRaw = r[C.navd]
    let navDate  = null
    if (typeof navRaw === 'number' && navRaw > 40000) {
      navDate = toYMD(excelSerial(navRaw))
    } else if (navRaw) {
      navDate = toYMD(parseDate(String(navRaw)))
    }

    if (folio) folioSet.add(folio)

    snapshots.push({
      amc,
      scheme_name:   scheme,
      amfi_code:     amfiCode,
      folio,
      units,
      nav_date:      navDate,
      current_value: currVal,
      cost_value:    costVal,
      current_nav:   units > 0 ? Math.round((currVal / units) * 10000) / 10000 : 0,
    })
  }

  const folioHashes = await Promise.all([...folioSet].map(sha256))
  return { detected: 'Holdings', snapshots, meta: { pan_present: false, folio_hashes: folioHashes } }
}
