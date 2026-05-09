// api/get-users.js
// Admin-only endpoint: list all users from public.users (paginated).
// Uses service_role key — never exposed on the frontend.
// Verifies the caller has role='admin' in the users table before returning data.

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_ORIGIN = 'https://fundlens-six.vercel.app';

const CORS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing authorization header' });

  const payload = decodeJwtPayload(authHeader.slice(7));
  if (!payload?.sub)
    return res.status(401).json({ error: 'Invalid token' });

  try {
    // Verify caller is admin
    const caller = await sb(`users?id=eq.${encodeURIComponent(payload.sub)}&select=role`);
    if (!caller?.[0] || caller[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    const page  = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit = 20;
    const offset = page * limit;

    const users = await sb(
      `users?select=id,email,role,plan_tier,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
    );

    // Get total count via Prefer: count=exact with Range 0-0
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id`, {
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        Prefer:         'count=exact',
        Range:          '0-0',
      },
    });
    const rangeHeader = countRes.headers.get('content-range') || '';
    const total = parseInt(rangeHeader.split('/')[1] || '0', 10);

    return res.status(200).json({ users: users || [], total, page, limit });
  } catch (err) {
    console.error('get-users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
