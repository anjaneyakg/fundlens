// api/set-role.js
// Admin-only endpoint: change a user's role in public.users.
// Uses service_role key — never exposed on the frontend.
// Verifies the caller has role='admin' before making any change.

const SUPABASE_URL   = process.env.SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_ORIGIN = 'https://fundlens-six.vercel.app';
const VALID_ROLES    = ['individual', 'advisor', 'admin'];

const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type':                 'application/json',
};

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing authorization header' });

  const payload = decodeJwtPayload(authHeader.slice(7));
  if (!payload?.sub)
    return res.status(401).json({ error: 'Invalid token' });

  const { targetUserId, newRole } = req.body || {};
  if (!targetUserId || !newRole)
    return res.status(400).json({ error: 'targetUserId and newRole are required' });
  if (!VALID_ROLES.includes(newRole))
    return res.status(400).json({ error: `newRole must be one of: ${VALID_ROLES.join(', ')}` });

  try {
    // Verify caller is admin
    const caller = await sb(`users?id=eq.${encodeURIComponent(payload.sub)}&select=role`, {
      headers: { Prefer: '' },
    });
    if (!caller?.[0] || caller[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    // Apply the role change
    await sb(`users?id=eq.${encodeURIComponent(targetUserId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('set-role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
