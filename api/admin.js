// api/admin.js
// Consolidated admin endpoint — 4 actions:
//   ?action=get-users     — list all users paginated (was api/get-users.js)
//   ?action=set-role      — change a user's role (was api/set-role.js)
//   ?action=set-flag      — toggle a feature flag (was api/admin/set-flag.js)
//   ?action=set-user-tier — change a user's tier (was api/admin/set-user-tier.js)

const SUPABASE_URL   = process.env.SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const CORS_ORIGIN    = 'https://fundlens-six.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type':                 'application/json',
};

export default async function handler(req, res) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  if (action === 'get-users')      return handleGetUsers(req, res);
  if (action === 'set-role')       return handleSetRole(req, res);
  if (action === 'set-flag')       return handleSetFlag(req, res);
  if (action === 'set-user-tier')  return handleSetUserTier(req, res);

  return res.status(400).json({ error: 'Unknown action. Valid: get-users, set-role, set-flag, set-user-tier' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// action=get-users — list all users from public.users (paginated)
// ─────────────────────────────────────────────────────────────────────────────

async function handleGetUsers(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing authorization header' });

  const payload = decodeJwtPayload(authHeader.slice(7));
  if (!payload?.sub)
    return res.status(401).json({ error: 'Invalid token' });

  try {
    const caller = await sb(`users?id=eq.${encodeURIComponent(payload.sub)}&select=role`, {
      headers: { Prefer: '' },
    });
    if (!caller?.[0] || caller[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    const page   = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit  = 20;
    const offset = page * limit;

    const users = await sb(
      `users?select=id,email,role,plan_tier,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
      { headers: { Prefer: '' } }
    );

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
    console.error('[admin?action=get-users] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=set-role — change a user's role in public.users
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ROLES = ['individual', 'advisor', 'admin'];

async function handleSetRole(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
    const caller = await sb(`users?id=eq.${encodeURIComponent(payload.sub)}&select=role`, {
      headers: { Prefer: '' },
    });
    if (!caller?.[0] || caller[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    await sb(`users?id=eq.${encodeURIComponent(targetUserId)}`, {
      method:  'PATCH',
      headers: { Prefer: 'return=minimal' },
      body:    JSON.stringify({ role: newRole }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin?action=set-role] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=set-flag — toggle a feature_flag enabled/disabled
// ─────────────────────────────────────────────────────────────────────────────

async function handleSetFlag(req, res) {
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
    console.error('[admin?action=set-flag] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=set-user-tier — change a user's tier in user_roles (legacy schema)
// ─────────────────────────────────────────────────────────────────────────────

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

async function handleSetUserTier(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, tier } = req.body || {};
  if (!userId || !TIER_IDS[tier]) {
    return res.status(400).json({ error: 'userId and valid tier required' });
  }

  try {
    const existing = await sb(`user_roles?user_id=eq.${userId}&select=id`, {
      headers: { Prefer: '' },
    });
    const roleRow = existing?.[0];

    if (roleRow) {
      await sb(`user_roles?id=eq.${roleRow.id}`, {
        method:  'PATCH',
        headers: { Prefer: 'return=minimal' },
        body:    JSON.stringify({ tier_id: TIER_IDS[tier], role_id: ROLE_IDS[tier] }),
      });
    } else {
      await sb('user_roles', {
        method:  'POST',
        headers: { Prefer: 'return=minimal' },
        body:    JSON.stringify({
          user_id:    userId,
          tier_id:    TIER_IDS[tier],
          role_id:    ROLE_IDS[tier],
          granted_at: new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json({ success: true, userId, tier });
  } catch (err) {
    console.error('[admin?action=set-user-tier] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
