// api/v1/auth/login.js
// Vercel serverless function — authenticates a FundLens user.
//
// POST /api/v1/auth/login
// Body: { "email": "user@example.com", "password": "password123" }
//
// On success:
// {
//   "ok": true,
//   "session": {
//     "access_token": "eyJ...",
//     "refresh_token": "...",
//     "expires_in": 3600
//   },
//   "user": {
//     "id": "uuid",
//     "email": "user@example.com"
//   }
// }
//
// On error:
// { "ok": false, "error": "..." }
//
// Notes:
// - Uses Supabase Auth signInWithPassword.
// - Frontend stores access_token in memory (not localStorage) for security.
// - Refresh token handled by Supabase client on frontend.
// - Uses anon key only — service_role key never exposed here.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://fundlens-six.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email and password are required." });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Use a generic message to prevent credential enumeration
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    return res.status(200).json({
      ok: true,
      session: {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in:    data.session.expires_in,
      },
      user: {
        id:    data.user.id,
        email: data.user.email,
      },
    });

  } catch (err) {
    console.error("[login]", err.message);
    return res.status(500).json({ ok: false, error: "Login failed. Please try again." });
  }
}
