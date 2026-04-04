// api/scheme-code-map.js
// Vercel Serverless Function
//
// GET  → fetches data/processed/scheme_code_map.json from FundInsight repo
// POST → saves updated mapping back to GitHub (creates or updates file)
//
// File format: { "AMC Name": { "CODE": "AMFI Scheme Name", ... }, ... }
//
// Environment variable required: VITE_GITHUB_PAT (repo scope)

const REPO      = 'anjaneyakg/FundInsight'
const FILE_PATH = 'data/processed/scheme_code_map.json'
const BRANCH    = 'main'
const API_BASE  = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://fundlens-six.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const token = process.env.VITE_GITHUB_PAT
  if (!token) return res.status(500).json({ ok: false, error: 'GitHub token not configured' })

  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept:        'application/vnd.github.v3+json',
    'User-Agent':  'FundLens/1.0',
  }

  // ── GET — fetch existing mapping ─────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(API_BASE, { headers: ghHeaders })

      // 404 = file doesn't exist yet → return empty mapping
      if (r.status === 404) {
        return res.status(200).json({})
      }
      if (!r.ok) throw new Error(`GitHub GET returned ${r.status}`)

      const meta = await r.json()

      // File may be >1MB — use blob API if needed
      let content
      if (meta.encoding === 'base64') {
        content = Buffer.from(meta.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      } else {
        // Fetch via blob API
        const blobR = await fetch(
          `https://api.github.com/repos/${REPO}/git/blobs/${meta.sha}`,
          { headers: ghHeaders }
        )
        const blob = await blobR.json()
        content = Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      }

      const mapping = JSON.parse(content)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(mapping)

    } catch (err) {
      console.error('scheme-code-map GET error:', err)
      return res.status(500).json({ ok: false, error: err.message })
    }
  }

  // ── POST — save updated mapping ──────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { mapping } = req.body
      if (!mapping || typeof mapping !== 'object') {
        return res.status(400).json({ ok: false, error: 'mapping object required in body' })
      }

      // Sort keys for stable diffs
      const sorted = {}
      for (const amc of Object.keys(mapping).sort()) {
        sorted[amc] = {}
        for (const code of Object.keys(mapping[amc]).sort()) {
          sorted[amc][code] = mapping[amc][code]
        }
      }

      const contentStr    = JSON.stringify(sorted, null, 2)
      const contentBase64 = Buffer.from(contentStr).toString('base64')

      // Get current SHA (needed for update; omit for create)
      let sha
      const existing = await fetch(API_BASE, { headers: ghHeaders })
      if (existing.ok) {
        const meta = await existing.json()
        sha = meta.sha
      } else if (existing.status !== 404) {
        throw new Error(`GitHub SHA fetch returned ${existing.status}`)
      }

      // Count total mappings for commit message
      const totalMapped = Object.values(sorted).reduce(
        (sum, codes) => sum + Object.keys(codes).length, 0
      )
      const amcCount = Object.keys(sorted).length

      const body = {
        message: `scheme mapping: ${totalMapped} codes across ${amcCount} AMCs`,
        content: contentBase64,
        branch:  BRANCH,
        ...(sha ? { sha } : {}),
      }

      const putRes = await fetch(API_BASE, {
        method:  'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!putRes.ok) {
        const errData = await putRes.json()
        throw new Error(errData.message || `GitHub PUT returned ${putRes.status}`)
      }

      return res.status(200).json({
        ok:           true,
        totalMapped,
        amcCount,
        message:      `Saved ${totalMapped} mappings across ${amcCount} AMCs`,
      })

    } catch (err) {
      console.error('scheme-code-map POST error:', err)
      return res.status(500).json({ ok: false, error: err.message })
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
