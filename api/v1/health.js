// api/v1/health.js
// Vercel serverless function — FundLens system health check.
// Called by Uptime Robot every 5 mins as /api/v1/health
//
// Returns JSON:
// {
//   "status": "ok" | "stale" | "error",
//   "timestamp": "2026-03-29T...",
//   "pipeline": {
//     "lastUpdated": "2026-03-29",
//     "schemeCount": 16352,
//     "amcCount": 53,
//     "pipelineVersion": "4.2.1",
//     "source": "AMFI Direct"
//   }
// }
//
// status = "stale" if meta.lastUpdated is more than 2 days old.
// status = "error" if the Gist fetch fails entirely.
// Uptime Robot should alert on anything other than HTTP 200 + status "ok"/"stale".

const SCHEMES_GIST_URL =
  "https://gist.githubusercontent.com/anjaneyakg/64368e3f1dfef3f82da8fa9f0f164211/raw/fundlens_schemes.json";

const STALE_THRESHOLD_DAYS = 2;

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate"); // cache 5 mins

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(SCHEMES_GIST_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FundLens/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`Gist fetch failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const meta = data?.meta || {};

    const lastUpdated     = meta.lastUpdated     || null;
    const schemeCount     = meta.schemeCount     || (data?.schemes?.length ?? null);
    const amcCount        = data?.amcs?.length   ?? null;
    const pipelineVersion = meta.pipelineVersion || null;
    const source          = meta.source          || "AMFI Direct";

    // ── Freshness check ───────────────────────────────────────────────────────
    let status = "ok";
    let staleNote = null;

    if (lastUpdated) {
      const updatedDate = new Date(lastUpdated);
      const now         = new Date();
      const diffDays    = (now - updatedDate) / (1000 * 60 * 60 * 24);

      if (diffDays > STALE_THRESHOLD_DAYS) {
        status    = "stale";
        staleNote = `Data last updated ${Math.floor(diffDays)} day(s) ago (${lastUpdated}). Pipeline may have failed.`;
      }
    } else {
      status    = "stale";
      staleNote = "meta.lastUpdated missing from Gist.";
    }

    const body = {
      status,
      timestamp,
      pipeline: {
        lastUpdated,
        schemeCount,
        amcCount,
        pipelineVersion,
        source,
      },
      ...(staleNote && { note: staleNote }),
    };

    res.status(200).json(body);

  } catch (err) {
    console.error("[health]", err.message);
    res.status(200).json({
      status:    "error",
      timestamp,
      error:     err.message,
      pipeline:  null,
    });
  }
}
