// api/_lib/verifyFirebaseToken.js
// Underscore prefix — Vercel does NOT count this as a serverless function.
//
// Verifies a Firebase ID token (RS256) against Google's public JWKS,
// then confirms profiles.role = 'admin' in Supabase.
// Returns the Firebase UID on success, null on any failure.
// Never throws — all errors are logged and null is returned.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT_ID  = 'fundlens-prod';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
  { cacheMaxAge: 600_000 }, // cache JWKS for 10 minutes
);

export async function verifyAdminToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer:     `https://securetoken.google.com/${PROJECT_ID}`,
      audience:   PROJECT_ID,
      algorithms: ['RS256'],
    }));
  } catch (err) {
    console.error('[verifyAdminToken] JWT verification failed:', err.code ?? err.message);
    return null;
  }

  if (!payload?.sub) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(payload.sub)}&select=role`,
      {
        headers: {
          apikey:         SERVICE_KEY,
          Authorization:  `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer:         '',
        },
      },
    );
    if (!res.ok) {
      console.error('[verifyAdminToken] Supabase error:', res.status);
      return null;
    }
    const rows = await res.json();
    if (rows?.[0]?.role !== 'admin') return null;
    return payload.sub;
  } catch (err) {
    console.error('[verifyAdminToken] Supabase lookup error:', err.message);
    return null;
  }
}
