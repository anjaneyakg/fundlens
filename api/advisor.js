// api/advisor.js
// Advisor-specific serverless endpoint — actions:
//   ?action=create-invite       — generate invite link (advisor only)
//   ?action=get-my-clients      — list advisor's client links (advisor only)
//   ?action=accept-invite       — client accepts an invite (any auth'd user)
//   ?action=add-client-direct   — add placeholder client without invite (advisor only)

import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORS_ORIGIN  = 'https://fundlens-six.vercel.app';

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

  if (action === 'create-invite')     return handleCreateInvite(req, res);
  if (action === 'get-my-clients')    return handleGetMyClients(req, res);
  if (action === 'accept-invite')     return handleAcceptInvite(req, res);
  if (action === 'add-client-direct') return handleAddClientDirect(req, res);

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

// Verify any authenticated Firebase user.
function requireAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const payload = decodeJwtPayload(authHeader.slice(7));
  return payload?.sub || null;
}

// Verify caller is advisor or admin.
async function requireAdvisor(authHeader) {
  const uid = requireAuth(authHeader);
  if (!uid) return null;
  try {
    const rows = await sb(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=role`,
      { headers: { Prefer: '' } },
    );
    const role = rows?.[0]?.role;
    if (role !== 'advisor' && role !== 'admin') return null;
    return uid;
  } catch (err) {
    console.error('[advisor] requireAdvisor error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=create-invite
// ─────────────────────────────────────────────────────────────────────────────
async function handleCreateInvite(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const advisorId = await requireAdvisor(req.headers.authorization);
  if (!advisorId) return res.status(403).json({ error: 'Advisor access required' });

  const { client_label, client_email, advisor_notes } = req.body || {};
  if (!client_label?.trim()) return res.status(400).json({ error: 'client_label is required' });

  const now        = new Date();
  const expiresAt  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const inviteToken = randomUUID();
  const inviteUrl  = `https://fundlens.in/accept-invite?token=${inviteToken}`;

  try {
    const created = await sb('advisor_client_links', {
      method:  'POST',
      headers: { Prefer: 'return=representation' },
      body:    JSON.stringify({
        advisor_id:         advisorId,
        client_label:       client_label.trim(),
        advisor_notes:      advisor_notes?.trim() || null,
        invite_token:       inviteToken,
        status:             'invited',
        link_origin:        'advisor_invite',
        invite_sent_at:     now.toISOString(),
        invite_expires_at:  expiresAt,
        can_view_portfolio: true,
        can_view_goals:     true,
        can_view_health:    true,
        can_view_reports:   true,
        can_send_alerts:    true,
        can_send_reports:   true,
      }),
    });

    return res.status(200).json({
      invite_token: inviteToken,
      invite_url:   inviteUrl,
      id:           created?.[0]?.id || null,
    });
  } catch (err) {
    console.error('[advisor?action=create-invite] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=get-my-clients
// ─────────────────────────────────────────────────────────────────────────────
async function handleGetMyClients(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const advisorId = await requireAdvisor(req.headers.authorization);
  if (!advisorId) return res.status(403).json({ error: 'Advisor access required' });

  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));

  try {
    // Fetch client links with embedded profile email (graceful null for unregistered clients).
    let rows;
    try {
      rows = await sb(
        `advisor_client_links?advisor_id=eq.${encodeURIComponent(advisorId)}&order=created_at.desc&limit=${limit}&select=id,advisor_id,client_id,client_label,advisor_notes,status,link_origin,invite_token,invite_sent_at,invite_expires_at,invite_accepted_at,relationship_since,can_view_portfolio,can_view_goals,can_view_health,can_view_reports,created_at,updated_at,profiles!client_id(id,email)`,
        { headers: { Prefer: '' } },
      );
    } catch (joinErr) {
      console.error('[advisor?action=get-my-clients] profile join failed, falling back:', joinErr);
      rows = await sb(
        `advisor_client_links?advisor_id=eq.${encodeURIComponent(advisorId)}&order=created_at.desc&limit=${limit}&select=id,advisor_id,client_id,client_label,advisor_notes,status,link_origin,invite_token,invite_sent_at,invite_expires_at,invite_accepted_at,relationship_since,can_view_portfolio,can_view_goals,can_view_health,can_view_reports,created_at,updated_at`,
        { headers: { Prefer: '' } },
      );
    }

    return res.status(200).json({ clients: rows || [] });
  } catch (err) {
    console.error('[advisor?action=get-my-clients] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=accept-invite
// ─────────────────────────────────────────────────────────────────────────────
async function handleAcceptInvite(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = requireAuth(req.headers.authorization);
  if (!clientId) return res.status(401).json({ error: 'Authentication required' });

  const { invite_token } = req.body || {};
  if (!invite_token?.trim()) return res.status(400).json({ error: 'invite_token is required' });

  try {
    // Find the invite row.
    const rows = await sb(
      `advisor_client_links?invite_token=eq.${encodeURIComponent(invite_token.trim())}&select=id,advisor_id,client_id,status,invite_expires_at,client_label`,
      { headers: { Prefer: '' } },
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'INVITE_NOT_FOUND', message: 'Invite not found.' });
    }

    const row = rows[0];

    // Already accepted (has a client_id set).
    if (row.client_id) {
      if (row.client_id === clientId) {
        return res.status(200).json({ success: true, already_linked: true, advisor_id: row.advisor_id });
      }
      return res.status(409).json({ error: 'ALREADY_ACCEPTED', message: 'This invite link has already been used.' });
    }

    // Check status.
    if (row.status !== 'invited') {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'This invite is no longer active.' });
    }

    // Check expiry.
    if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
      return res.status(400).json({
        error:   'INVITE_EXPIRED',
        message: 'Invite link has expired. Ask your advisor to send a new one.',
      });
    }

    const now      = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    // Update the row.
    await sb(`advisor_client_links?id=eq.${row.id}`, {
      method: 'PATCH',
      body:   JSON.stringify({
        client_id:           clientId,
        status:              'active',
        invite_accepted_at:  now.toISOString(),
        consent_given_at:    now.toISOString(),
        consent_ip:          clientIp,
        consent_user_agent:  userAgent,
        relationship_since:  todayStr,
      }),
    });

    // Insert admin notification (non-fatal).
    try {
      await sb('admin_notifications', {
        method: 'POST',
        body:   JSON.stringify({
          type:     'client_linked',
          message:  `Client accepted advisor invite: ${row.client_label || clientId}`,
          metadata: {
            advisor_id:   row.advisor_id,
            client_id:    clientId,
            client_label: row.client_label,
            link_id:      row.id,
          },
        }),
      });
    } catch (notifErr) {
      console.error('[advisor?action=accept-invite] admin_notifications insert error (non-fatal):', notifErr);
    }

    return res.status(200).json({ success: true, advisor_id: row.advisor_id });
  } catch (err) {
    console.error('[advisor?action=accept-invite] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// action=add-client-direct
// ─────────────────────────────────────────────────────────────────────────────
async function handleAddClientDirect(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const advisorId = await requireAdvisor(req.headers.authorization);
  if (!advisorId) return res.status(403).json({ error: 'Advisor access required' });

  const { client_label, advisor_notes } = req.body || {};
  if (!client_label?.trim()) return res.status(400).json({ error: 'client_label is required' });

  const now      = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  try {
    const created = await sb('advisor_client_links', {
      method:  'POST',
      headers: { Prefer: 'return=representation' },
      body:    JSON.stringify({
        advisor_id:         advisorId,
        client_label:       client_label.trim(),
        advisor_notes:      advisor_notes?.trim() || null,
        status:             'placeholder',
        link_origin:        'advisor_direct',
        relationship_since: todayStr,
        can_view_portfolio: false,
        can_view_goals:     false,
        can_view_health:    false,
        can_view_reports:   false,
        can_send_alerts:    false,
        can_send_reports:   false,
      }),
    });

    return res.status(200).json({ id: created?.[0]?.id || null });
  } catch (err) {
    console.error('[advisor?action=add-client-direct] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
