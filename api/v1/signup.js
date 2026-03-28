// api/v1/auth/signup.js
// Vercel serverless function — creates a new FundLens user.
//
// POST /api/v1/auth/signup
// Body: { "email": "user@example.com", "password": "password123" }
//
// On success (email confirmation required):
// { "ok": true, "message": "Confirmation email sent. Please verify your email." }
//
// On error:
// { "ok": false, "error": "..." }
//
// Notes:
// - Uses Supabase Auth signUp — password hashed by Supabase, never stored here.
// - Email confirmation is ON — user must verify before they can log in.
// - on_auth_user_created trigger syncs new user to public.users automatically.
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

  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters." });
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      // Supabase returns a generic message for existing emails to prevent enumeration
      return res.status(400).json({ ok: false, error: error.message });
    }

    // If identities is empty, email already exists (Supabase silent duplicate behaviour)
    if (data?.user?.identities?.length === 0) {
      return res.status(400).json({ ok: false, error: "An account with this email already exists." });
    }

    return res.status(200).json({
      ok: true,
      message: "Confirmation email sent to " + email + ". Please verify your email to activate your account.",
    });

  } catch (err) {
    console.error("[signup]", err.message);
    return res.status(500).json({ ok: false, error: "Signup failed. Please try again." });
  }
}
