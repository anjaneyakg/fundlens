// api/holdings-csv.js
// Vercel Serverless Function
//
// Proxies holdings_latest.csv from the private FundInsight GitHub repo.
// Token is kept server-side — never exposed to the browser.
//
// Used by: CoverageDashboard.jsx → fetch('/api/holdings-csv')
//
// Environment variable required (already in Vercel):
//   VITE_GITHUB_PAT — personal access token with repo scope

export default async function handler(req, res) {
  // CORS — restrict to FundLens origin only
  res.setHeader("Access-Control-Allow-Origin", "https://fundlens-six.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = process.env.VITE_GITHUB_PAT;
  if (!token) {
    return res.status(500).json({ ok: false, error: "GitHub token not configured" });
  }

  const CSV_URL =
    "https://raw.githubusercontent.com/anjaneyakg/FundInsight/main/data/processed/holdings_latest.csv";

  try {
    const upstream = await fetch(CSV_URL, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3.raw",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error: `GitHub returned ${upstream.status}`,
      });
    }

    const csv = await upstream.text();

    // Return as plain text — CoverageDashboard.parseCsv() handles parsing
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    // Cache for 5 minutes — CSV only changes when a new upload is done
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    return res.status(200).send(csv);

  } catch (err) {
    console.error("holdings-csv proxy error:", err);
    return res.status(500).json({ ok: false, error: "Proxy fetch failed: " + err.message });
  }
}
