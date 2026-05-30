// api/admin.js
// Consolidated admin endpoint — actions:
//   ?action=get-users            — list all profiles paginated
//   ?action=set-role             — change a user's role
//   ?action=set-flag             — toggle a feature flag
//   ?action=set-user-tier        — change a user's tier (legacy schema)
//   ?action=notify-registration  — insert admin_notifications (any auth'd user)
//   ?action=approve-advisor      — approve an advisor application (admin only)
//   ?action=reject-advisor       — reject an advisor application (admin only)
//   ?action=get-notifications    — fetch latest admin_notifications (admin only)
//   ?action=mark-notification-read — mark notification(s) read (admin only)
//   ?action=admin-register-advisor — admin-direct advisor registration (admin only)
//
// Table: public.profiles (id TEXT = Firebase UID, email, role, plan_tier)

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORS_ORIGIN   = 'https://fundlens-six.vercel.app';

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

  if (action === 'get-users')              return handleGetUsers(req, res);
  if (action === 'set-role')               return handleSetRole(req, res);
  if (action === 'set-flag')               return handleSetFlag(req, res);
  if (action === 'set-user-tier')          return handleSetUserTier(req, res);
  if (action === 'notify-registration')    return handleNotifyRegistration(req, res);
  if (action === 'approve-advisor')        return handleApproveAdvisor(req, res);
  if (action === 'reject-advisor')         return handleRejectAdvisor(req, res);
  if (action === 'get-notifications')      return handleGetNotifications(req, res);
  if (action === 'mark-notification-read') return handleMarkNotificationRead(req, res);
  if (action === 'admin-register-advisor') return handleAdminRegisterAdvisor(req, res);

  return res.status(400).json({ error: 'Unknown action.' });
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

// Service-role Supabase fetch — bypasses RLS.
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

// Verify caller is admin via profiles table.
async function requireAdmin(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const payload = decodeJwtPayload(authHeader.slice(7));
  console.log('[requireAdmin] payload.sub:', payload?.sub);
  if (!payload?.sub) return null;
  try {
    const url = `profiles?id=eq.${encodeURIComponent(payload.sub)}&select=role`;
    console.log('[requireAdmin] querying:', url);
    const rows = await sb(url, { headers: { Prefer: '' } });
    console.log('[requireAdmin] rows:', JSON.stringify(rows));
    if (rows?.[0]?.role !== 'admin') return null;
    return payload.sub;
  } catch (err) {
    console.error('[requireAdmin] error:', err);
    return null;
  }
}

// Verify any authenticated user (non-admin actions).
function requireAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const payload = decodeJwtPayload(authHeader.slice(7));
  return payload?.sub || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// action=get-users
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetUsers(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  try {
    const page   = Math.max(0, parseInt(req.query.page || '0', 10));
    const limit  = 20;
    const offset = page * limit;

    const users = await sb(
      `profiles?select=id,email,role,plan_tier,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
      { headers: { Prefer: '' } },
    );

    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id`, {
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
// action=set-role
// ─────────────────────────────────────────────────────────────────────────────
const VALID_ROLES = ['individual', 'advisor', 'admin'];

async function handleSetRole(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  const { targetUserId, newRole } = req.body || {};
  if (!targetUserId || !newRole)
    return res.status(400).json({ error: 'targetUserId and newRole are required' });
  if (!VALID_ROLES.includes(newRole))
    return res.status(400).json({ error: `newRole must be one of: ${VALID_ROLES.join(', ')}` });

  try {
    await sb(`profiles?id=eq.${encodeURIComponent(targetUserId)}`, {
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
// action=set-flag
// ─────────────────────────────────────────────────────────────────────────────
async function handleSetFlag(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { flagId, enabled } = req.body || {};
  if (!flagId || typeof enabled !== 'boolean')
    return res.status(400).json({ error: 'flagId (uuid) and enabled (boolean) required' });

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
// action=set-user-tier (legacy schema)
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
  if (!userId || !TIER_IDS[tier])
    return res.status(400).json({ error: 'userId and valid tier required' });

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

// ─────────────────────────────────────────────────────────────────────────────
// action=notify-registration
// Called by /register wizard after successful registration.
// Requires any authenticated Firebase user (NOT admin-only).
// Creates admin_notifications + optionally increments promo_code.used_count.
// ─────────────────────────────────────────────────────────────────────────────
const VALID_NOTIF_TYPES = ['new_advisor_application', 'new_investor_registration'];

async function handleNotifyRegistration(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerUid = requireAuth(req.headers.authorization);
  if (!callerUid) return res.status(401).json({ error: 'Authentication required' });

  const { type, message, metadata, promoCode } = req.body || {};

  if (!type || !VALID_NOTIF_TYPES.includes(type))
    return res.status(400).json({ error: 'type must be new_advisor_application or new_investor_registration' });

  try {
    // Insert admin notification (service role bypasses RLS)
    await sb('admin_notifications', {
      method: 'POST',
      body:   JSON.stringify({
        type,
        message:  message || type,
        metadata: metadata || {},
      }),
    });

    // Increment promo code used_count if provided
    if (promoCode) {
      try {
        const code = String(promoCode).trim().toUpperCase();
        const rows = await sb(
          `promo_codes?code=eq.${encodeURIComponent(code)}&select=id,used_count,max_uses`,
          { headers: { Prefer: '' } },
        );
        if (rows && rows.length > 0) {
          const { id, used_count, max_uses } = rows[0];
          if (used_count < max_uses) {
            await sb(`promo_codes?id=eq.${id}`, {
              method: 'PATCH',
              body:   JSON.stringify({ used_count: used_count + 1 }),
            });
          }
        }
      } catch (promoErr) {
        console.error('[admin?action=notify-registration] promo increment error (non-fatal):', promoErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin?action=notify-registration] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=approve-advisor (admin only)
// ─────────────────────────────────────────────────────────────────────────────
async function handleApproveAdvisor(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  const { uid, registration_type } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'uid is required' });

  const planTier = registration_type === 'sebi_ria' ? 'advisor_ria' : 'advisor_mfd';

  try {
    // Update profiles: role=advisor, plan_tier
    await sb(`profiles?id=eq.${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      body:   JSON.stringify({ role: 'advisor', plan_tier: planTier }),
    });

    // Update advisor_profiles: status=approved, approved_at
    await sb(`advisor_profiles?user_id=eq.${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      body:   JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }),
    });

    // Get email for notification message
    const profile = await sb(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=email`,
      { headers: { Prefer: '' } },
    );
    const email = profile?.[0]?.email || uid;

    // Insert admin notification
    await sb('admin_notifications', {
      method: 'POST',
      body:   JSON.stringify({
        type:     'advisor_approved',
        message:  `Advisor approved: ${email}`,
        metadata: { uid, plan_tier: planTier },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin?action=approve-advisor] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=reject-advisor (admin only)
// ─────────────────────────────────────────────────────────────────────────────
async function handleRejectAdvisor(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  const { uid, reason } = req.body || {};
  if (!uid) return res.status(400).json({ error: 'uid is required' });

  try {
    // Update advisor_profiles: status=rejected
    await sb(`advisor_profiles?user_id=eq.${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      body:   JSON.stringify({ status: 'rejected', rejection_reason: reason || null }),
    });

    // Keep profiles.role as 'individual' (no change needed)

    // Get email for notification message
    const profile = await sb(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=email`,
      { headers: { Prefer: '' } },
    );
    const email = profile?.[0]?.email || uid;

    // Insert admin notification
    await sb('admin_notifications', {
      method: 'POST',
      body:   JSON.stringify({
        type:     'advisor_rejected',
        message:  `Advisor rejected: ${email}`,
        metadata: { uid, reason: reason || null },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin?action=reject-advisor] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=get-notifications (admin only)
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetNotifications(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));

  try {
    const rows = await sb(
      `admin_notifications?order=created_at.desc&limit=${limit}&select=id,type,message,read,metadata,created_at`,
      { headers: { Prefer: '' } },
    );
    return res.status(200).json({ notifications: rows || [] });
  } catch (err) {
    console.error('[admin?action=get-notifications] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=mark-notification-read (admin only)
// ─────────────────────────────────────────────────────────────────────────────
async function handleMarkNotificationRead(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  const { id, all } = req.body || {};

  try {
    if (all) {
      await sb('admin_notifications?read=eq.false', {
        method: 'PATCH',
        body:   JSON.stringify({ read: true }),
      });
    } else if (id) {
      await sb(`admin_notifications?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body:   JSON.stringify({ read: true }),
      });
    } else {
      return res.status(400).json({ error: 'id or all:true is required' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin?action=mark-notification-read] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=admin-register-advisor (admin only)
// Registers an advisor directly — no pending state; role set immediately.
// ─────────────────────────────────────────────────────────────────────────────
async function handleAdminRegisterAdvisor(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const callerId = await requireAdmin(req.headers.authorization);
  if (!callerId) return res.status(403).json({ error: 'Admin access required' });

  const {
    uid, email, registration_type,
    arn_number, sebi_ria_number,
    applicant_name, firm_name, phone, city,
  } = req.body || {};

  if (!uid || !email || !registration_type || !applicant_name || !firm_name)
    return res.status(400).json({ error: 'uid, email, registration_type, applicant_name, firm_name are required' });

  // Debarred check
  const entityType  = registration_type === 'sebi_ria' ? 'sebi_ria' : 'arn';
  const entityValue = (registration_type === 'sebi_ria' ? sebi_ria_number : arn_number) || '';

  if (entityValue.trim()) {
    try {
      const debarred = await sb(
        `regulatory_debarred?entity_type=eq.${entityType}&entity_value=eq.${encodeURIComponent(entityValue.trim().toUpperCase())}&select=id`,
        { headers: { Prefer: '' } },
      );
      if (debarred && debarred.length > 0) {
        return res.status(400).json({
          error:   'DEBARRED_MATCH',
          message: 'This registration number appears on the regulatory debarred list.',
        });
      }
    } catch (checkErr) {
      console.error('[admin-register-advisor] debarred check error (continuing):', checkErr);
    }
  }

  const planTier = registration_type === 'sebi_ria' ? 'advisor_ria' : 'advisor_mfd';

  try {
    // Create or update profiles row
    const existing = await sb(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=id`,
      { headers: { Prefer: '' } },
    );
    if (!existing || existing.length === 0) {
      await sb('profiles', {
        method: 'POST',
        body:   JSON.stringify({ id: uid, email, role: 'advisor', plan_tier: planTier }),
      });
    } else {
      await sb(`profiles?id=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body:   JSON.stringify({ role: 'advisor', plan_tier: planTier }),
      });
    }

    // Create or update advisor_profiles row
    const existingAP = await sb(
      `advisor_profiles?user_id=eq.${encodeURIComponent(uid)}&select=user_id`,
      { headers: { Prefer: '' } },
    );
    const apPayload = {
      user_id:               uid,
      registration_type,
      arn_number:            arn_number || null,
      sebi_ria_number:       sebi_ria_number || null,
      applicant_name,
      firm_name,
      phone:                 phone || null,
      city:                  city || null,
      status:                'admin_registered',
      registered_by:         callerId,
      debarred_check_passed: true,
      debarred_check_at:     new Date().toISOString(),
      applied_at:            new Date().toISOString(),
    };

    if (!existingAP || existingAP.length === 0) {
      await sb('advisor_profiles', { method: 'POST', body: JSON.stringify(apPayload) });
    } else {
      await sb(`advisor_profiles?user_id=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body:   JSON.stringify(apPayload),
      });
    }

    // Insert admin notification
    await sb('admin_notifications', {
      method: 'POST',
      body:   JSON.stringify({
        type:     'admin_registered_advisor',
        message:  `Advisor registered by admin: ${email}`,
        metadata: { uid, email, registration_type, registered_by: callerId },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin?action=admin-register-advisor] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
