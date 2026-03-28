// api/v1/auth/logout.js
// Vercel serverless function — invalidates a FundLens user session.
//
// POST /api/v1/auth/logout
// Headers: { "Authorization": "Bearer <access_token>" }
//
// On success:
// { "ok": true, "message": "Logged out successfully." }
//
// On error:
// { "ok": false, "error": "..." }
//
// Notes:
// - Reads access_token from Authorization header.
// - Creates a per-request Supabase client with the user's token.
// - Calls supabase.auth.signOut() to invalidate the session server-side.
// - Uses anon key only — service_role key never exposed here.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://fundlens-six.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  // Extract Bearer token from Authorization header
  const authHeader = req.headers["authorization"] || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!accessToken) {
    return res.status(401).json({ ok: false, error: "Missing authorization token." });
  }

  try {
    // Create a scoped client with the user's token so signOut invalidates their session only
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    );

    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, message: "Logged out successfully." });

  } catch (err) {
    console.error("[logout]", err.message);
    return res.status(500).json({ ok: false, error: "Logout failed. Please try again." });
  }
}
