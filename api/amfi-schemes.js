// api/amfi-schemes.js
// Vercel serverless function — proxies AMFI scheme master server-side.
// Called by CoverageDashboard as /api/amfi-schemes
// No CORS issue because the fetch happens server → AMFI, not browser → AMFI.
//
// Returns JSON:
// {
//   "amcs": {
//     "Axis Mutual Fund": 45,
//     "SBI Mutual Fund": 38,
//     ...
//   }
// }
// Each value = count of unique Direct Growth schemes for that AMC.

const AMFI_SCHEME_MASTER_URL =
  "https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0";

// ── AMC name normalisation (mirrors amfi_normalise.py) ────────────────────────
const AMC_ALIASES = {
  "Aditya Birla Sun Life AMC Limited":      "Aditya Birla Sun Life Mutual Fund",
  "Aditya Birla Sun Life":                  "Aditya Birla Sun Life Mutual Fund",
  "HDFC Asset Management Company Limited":  "HDFC Mutual Fund",
  "HDFC Mutual Fund":                       "HDFC Mutual Fund",
  "SBI Funds Management Limited":           "SBI Mutual Fund",
  "SBI Funds Management":                   "SBI Mutual Fund",
  "UTI Asset Management Company Limited":   "UTI Mutual Fund",
  "UTI Asset Management":                   "UTI Mutual Fund",
  "DSP Investment Managers Private Limited":"DSP Mutual Fund",
  "DSP Investment Managers":               "DSP Mutual Fund",
  "JM Financial Asset Management Limited": "JM Financial Mutual Fund",
  "JM Financial Asset Management":         "JM Financial Mutual Fund",
  "Motilal Oswal Asset Management Company Limited": "Motilal Oswal Mutual Fund",
  "Motilal Oswal Asset Management":        "Motilal Oswal Mutual Fund",
  "Franklin Templeton Asset Management (India) Private Limited": "Franklin Templeton Mutual Fund",
  "Franklin Templeton Asset Management":   "Franklin Templeton Mutual Fund",
  "Templeton India":                       "Franklin Templeton Mutual Fund",
  "PGIM India Asset Management Private Limited": "PGIM India Mutual Fund",
  "PGIM India Asset Management":           "PGIM India Mutual Fund",
  "HSBC Asset Management (India) Private Limited": "HSBC Mutual Fund",
  "HSBC Asset Management":                 "HSBC Mutual Fund",
  "LIC Mutual Fund Asset Management Limited": "LIC Mutual Fund",
  "LIC Mutual Fund Asset Management":      "LIC Mutual Fund",
  "360 ONE Asset Management Limited":      "360 ONE Mutual Fund",
  "360 ONE Asset Management":              "360 ONE Mutual Fund",
  "Angel One Asset Management Limited":    "Angel One Mutual Fund",
  "Angel One Asset Management":            "Angel One Mutual Fund",
  "ICICI Prudential Asset Management Company Limited": "ICICI Prudential Mutual Fund",
  "ICICI Prudential Asset Management":     "ICICI Prudential Mutual Fund",
  "Nippon Life India Asset Management Limited": "Nippon India Mutual Fund",
  "Nippon India":                          "Nippon India Mutual Fund",
  "Kotak Mahindra Asset Management Company Limited": "Kotak Mahindra Mutual Fund",
  "Kotak Mahindra Asset Management":       "Kotak Mahindra Mutual Fund",
  "Trust Asset Management Private Limited": "Trust Mutual Fund",
  "Trust Asset Management":                "Trust Mutual Fund",
  "Shriram Asset Management Co. Limited":  "Shriram Mutual Fund",
  "Shriram Asset Management":              "Shriram Mutual Fund",
  "Taurus Asset Management Company Limited": "Taurus Mutual Fund",
  "Taurus Asset Management":               "Taurus Mutual Fund",
  "Canara Robeco Asset Management Company Limited": "Canara Robeco Mutual Fund",
  "Canara Robeco Asset Management":        "Canara Robeco Mutual Fund",
  "Bandhan AMC Limited":                   "Bandhan Mutual Fund",
  "Mirae Asset Investment Managers (India) Private Limited": "Mirae Asset Mutual Fund",
  "WhiteOak Capital Asset Management Limited": "WhiteOak Capital Mutual Fund",
  "Edelweiss Asset Management Limited":    "Edelweiss Mutual Fund",
  "Helios Capital Asset Management (India) Private Limited": "Helios Mutual Fund",
  "Groww Asset Management Limited":        "Groww Mutual Fund",
  "Navi AMC Limited":                      "Navi Mutual Fund",
  "NJ Asset Management Private Limited":   "NJ Mutual Fund",
  "PPFAS Asset Management Pvt. Ltd.":      "PPFAS Mutual Fund",
  "Quantum Asset Management Company Private Limited": "Quantum Mutual Fund",
  "quant Money Managers Limited":          "quant Mutual Fund",
  "Samco Asset Management Private Limited": "Samco Mutual Fund",
  "Sundaram Asset Management Company Limited": "Sundaram Mutual Fund",
  "Tata Asset Management Private Limited": "Tata Mutual Fund",
  "Union Asset Management Company Private Limited": "Union Mutual Fund",
  "Unifi Asset Management Private Limited": "Unifi Mutual Fund",
  "Baroda BNP Paribas Asset Management India Private Limited": "Baroda BNP Paribas Mutual Fund",
  "Invesco Asset Management (India) Private Limited": "Invesco Mutual Fund",
  "Mahindra Manulife Investment Management Private Limited": "Mahindra Manulife Mutual Fund",
  "ITI Asset Management Limited":          "ITI Mutual Fund",
  "Bajaj Finserv Asset Management Limited": "Bajaj Finserv Mutual Fund",
  "Bank of India Investment Managers Private Limited": "Bank of India Mutual Fund",
  "Axis Asset Management Company Limited": "Axis Mutual Fund",
  "Capitalmind Asset Management Private Limited": "Capitalmind Mutual Fund",
  "Abakkus Asset Manager LLP":             "Abakkus Mutual Fund",
  "Old Bridge Asset Management Private Limited": "Old Bridge Mutual Fund",
  "Jio BlackRock Investment Managers Private Limited": "Jio BlackRock Mutual Fund",
  "Choice International Limited":          "Choice Mutual Fund",
  "The Wealth Company Asset Management Private Limited": "The Wealth Company Mutual Fund",
};

function normaliseAmc(raw) {
  if (!raw) return "Unknown";
  const s = raw.trim();
  if (AMC_ALIASES[s]) return AMC_ALIASES[s];
  for (const [alias, canonical] of Object.entries(AMC_ALIASES)) {
    if (s.startsWith(alias)) return canonical;
  }
  // Strip common suffixes and return cleaned name
  return s
    .replace(/ (Asset Management|AMC|Investment Managers?|Mutual Fund).*$/i, " Mutual Fund")
    .trim();
}

function isDirectGrowth(navName) {
  const n = (navName || "").toLowerCase();
  const idcwTerms = ["idcw", "dividend payout", "dividend reinvestment", "payout", "reinvestment", "bonus"];
  const isDirect  = n.includes("direct");
  const isGrowth  = !idcwTerms.some(t => n.includes(t));
  return isDirect && isGrowth;
}

// Returns true if scheme is still active (no past closure date).
// AMFI master column layout (0-indexed):
//   0: AMC Code/Name  1: Scheme Code  2: ISIN Div Payout  3: ISIN Div Reinvestment
//   4: Scheme Name    5: NAV Name     6: Dividend         7: Growth
//   8: Bonus          9: Launch Date  10: Closure Date
function isActive(parts) {
  const closureRaw = (parts[10] || "").trim();
  if (!closureRaw || closureRaw === "-" || closureRaw === "N.A.") return true;
  const d = new Date(closureRaw);
  if (isNaN(d.getTime())) return true; // unparseable → assume active
  return d > new Date();               // future date = still active
}

// Strips plan/option suffixes to get the base portfolio-level scheme name.
// Mirrors dedupeSchemes() logic in Scheme Explorer / Category Leaderboard.
// e.g. "Kotak Flexi Cap Fund - Direct Plan - Growth" → "Kotak Flexi Cap Fund"
function basePortfolioName(navName) {
  return navName
    .replace(/\s*[-\u2013]\s*(direct|regular)\s*(plan)?\s*/gi, "")
    .replace(/\s*[-\u2013]\s*(growth|idcw|dividend|bonus|payout|reinvestment)\s*/gi, "")
    .replace(/\s*[-\u2013]\s*option\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Parse AMFI scheme master CSV ──────────────────────────────────────────────
// Returns { amcCounts, debugSample }
// amcCounts   — { AMC: N } unique active Direct Growth portfolio-level schemes
// debugSample — first 3 raw scheme lines with column breakdown (debug mode only)
function parseAMFIMaster(text, { debug = false } = {}) {
  const amcCounts    = {};
  const seenNames    = {}; // { amc: Set<baseName> } — dedup by portfolio name
  let currentAmcFull = "";
  const debugSample  = [];
  let schemeLinesSeen = 0;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(",").map(p => p.trim());

    // AMC header line — second field is not numeric
    if (parts.length >= 2 && !parts[1].match(/^\d+$/)) {
      currentAmcFull = parts[0];
      continue;
    }

    // Scheme data line — second field is a numeric scheme code
    if (parts.length >= 6 && parts[1].match(/^\d+$/)) {

      // Capture first 3 scheme lines for column index verification
      if (debug && schemeLinesSeen < 3) {
        debugSample.push({
          raw: rawLine.trim(),
          parsed: {
            "0_amc":              parts[0],
            "1_scheme_code":      parts[1],
            "2_isin_div_payout":  parts[2],
            "3_isin_div_reinvest":parts[3],
            "4_scheme_name":      parts[4],
            "5_nav_name":         parts[5],
            "6_dividend":         parts[6],
            "7_growth":           parts[7],
            "8_bonus":            parts[8],
            "9_launch_date":      parts[9],
            "10_closure_date":    parts[10] || "(empty)",
            "11+":                parts.slice(11).join(" | ") || "(none)",
          }
        });
      }
      schemeLinesSeen++;

      const navName = parts[5] || parts[4] || "";

      // Filter 1: Direct Growth only
      if (!isDirectGrowth(navName)) continue;

      // Filter 2: Active schemes only
      if (!isActive(parts)) continue;

      const amcRaw  = parts[0] || currentAmcFull;
      const amc     = normaliseAmc(amcRaw);

      // Filter 3: Deduplicate by base portfolio name
      const baseName = basePortfolioName(navName);
      if (!seenNames[amc]) seenNames[amc] = new Set();
      if (seenNames[amc].has(baseName)) continue;
      seenNames[amc].add(baseName);

      amcCounts[amc] = (amcCounts[amc] || 0) + 1;
    }
  }

  return { amcCounts, debugSample };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers so browser can call this from Vercel frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // cache 1hr on Vercel CDN

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const response = await fetch(AMFI_SCHEME_MASTER_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FundLens/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`AMFI responded with ${response.status}`);
    }

    const text               = await response.text();
    const debug              = req.query?.debug === "1";
    const { amcCounts, debugSample } = parseAMFIMaster(text, { debug });

    res.status(200).json({
      ok:           true,
      amcs:         amcCounts,
      totalAmcs:    Object.keys(amcCounts).length,
      totalSchemes: Object.values(amcCounts).reduce((s, n) => s + n, 0),
      fetchedAt:    new Date().toISOString(),
      // Only included when ?debug=1 — for column index verification
      ...(debug && { debugSample }),
    });

  } catch (err) {
    console.error("[amfi-schemes]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
