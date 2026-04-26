// api/admin/set-flag.js
// Serverless function — toggles a feature_flag enabled/disabled.
// Called by ToolAccessMatrix.jsx when admin flips a toggle.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  'https://fundlens-six.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).set(CORS).send('');
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { flagId, enabled } = req.body || {};
  if (!flagId || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'flagId (uuid) and enabled (boolean) required' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/feature_flags?id=eq.${flagId}`, {
      method: 'PATCH',
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ enabled }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Supabase error: ${txt}`);
    }

    return res.status(200).json({ success: true, flagId, enabled });
  } catch (err) {
    console.error('set-flag error:', err);
    return res.status(500).json({ error: err.message });
  }
}
