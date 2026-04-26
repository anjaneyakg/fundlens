// api/admin/set-user-tier.js
// Serverless function — changes a user's tier.
// Called by UserManager.jsx when admin changes a dropdown.
// Uses SUPABASE_SERVICE_KEY (service_role) — never exposed to frontend.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const TIER_IDS = {
  public:   '00000000-0000-0000-0000-000000000001',
  investor: '00000000-0000-0000-0000-000000000002',
  advisor:  '00000000-0000-0000-0000-000000000003',
  alpha:    '00000000-0000-0000-0000-000000000004',
};

const ROLE_IDS = {
  public:   '00000000-0000-0000-0001-000000000001',
  investor: '00000000-0000-0000-0001-000000000002',
  advisor:  '00000000-0000-0000-0001-000000000003',
  alpha:    '00000000-0000-0000-0001-000000000004',
};

const CORS = {
  'Access-Control-Allow-Origin':  'https://fundlens-six.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=minimal',
      ...opts.headers,
    },
    ...opts,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).set(CORS).send('');
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, tier } = req.body || {};
  if (!userId || !TIER_IDS[tier]) {
    return res.status(400).json({ error: 'userId and valid tier required' });
  }

  try {
    // Check if user_roles row exists
    const existing = await sb(`user_roles?user_id=eq.${userId}&select=id`);
    const roleRow = existing.data?.[0];

    if (roleRow) {
      // Update existing row
      const { ok } = await sb(`user_roles?id=eq.${roleRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tier_id: TIER_IDS[tier], role_id: ROLE_IDS[tier] }),
      });
      if (!ok) throw new Error('Failed to update user_roles');
    } else {
      // Insert new row
      const { ok } = await sb('user_roles', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          tier_id: TIER_IDS[tier],
          role_id: ROLE_IDS[tier],
          granted_at: new Date().toISOString(),
        }),
      });
      if (!ok) throw new Error('Failed to insert user_roles');
    }

    return res.status(200).json({ success: true, userId, tier });
  } catch (err) {
    console.error('set-user-tier error:', err);
    return res.status(500).json({ error: err.message });
  }
}
