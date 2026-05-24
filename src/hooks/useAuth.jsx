// src/hooks/useAuth.jsx
// Firebase Auth + Supabase profile loader.
// Uses onIdTokenChanged (fires on sign-in, sign-out, AND ~1h token refresh)
// so the stored JWT is always current.
// Table: public.profiles (id TEXT = Firebase UID, email, role, plan_tier)

import { useState, useEffect, useRef, createContext, useContext } from 'react'
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '../firebase'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Supabase REST helper ──────────────────────────────────────────────────────
// Always requires apikey (anon key) + Authorization (Firebase JWT).
// Returns parsed JSON on success, null on any error.
async function sbFetch(path, token, options = {}) {
  const { headers: extraHeaders, ...rest } = options
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey:         SUPABASE_ANON,
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('[sbFetch] error:', path, res.status, text)
    return null
  }
  return text ? JSON.parse(text) : null
}

// ── Profile loader (module-level — no stale-closure risk) ────────────────────
// Fetches or creates the user's row in public.profiles.
// Always calls getIdToken() fresh (Firebase auto-refreshes if near expiry).
async function loadProfile(firebaseUser, setRole, setPlanTier) {
  const uid = firebaseUser.uid
  let idToken
  try {
    idToken = await firebaseUser.getIdToken()
  } catch (err) {
    console.error('[useAuth] getIdToken failed during profile load:', err)
    setRole('individual')
    setPlanTier('free')
    return
  }

  try {
    // ── Fetch existing profile row ────────────────────────────────────────────
    const rows = await sbFetch(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=id,email,role,plan_tier`,
      idToken,
    )

    if (rows && rows.length > 0) {
      setRole(rows[0].role || 'individual')
      setPlanTier(rows[0].plan_tier || 'free')
      return
    }

    // ── Row missing — first sign-in — create the profile ─────────────────────
    // Prefer: return=representation so we can read the server-assigned defaults
    const created = await sbFetch('profiles', idToken, {
      method:  'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id:        uid,
        email:     firebaseUser.email,
        role:      'individual',
        plan_tier: 'free',
      }),
    })

    if (created && created.length > 0) {
      setRole(created[0].role || 'individual')
      setPlanTier(created[0].plan_tier || 'free')
      return
    }

    // ── INSERT returned nothing — row may already exist (concurrent login) ────
    // Retry the SELECT
    const retry = await sbFetch(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=id,email,role,plan_tier`,
      idToken,
    )
    if (retry && retry.length > 0) {
      setRole(retry[0].role || 'individual')
      setPlanTier(retry[0].plan_tier || 'free')
    } else {
      console.error('[useAuth] loadProfile: could not fetch or create profile for', uid)
      setRole('individual')
      setPlanTier('free')
    }
  } catch (err) {
    console.error('[useAuth] loadProfile unexpected error:', err)
    setRole('individual')
    setPlanTier('free')
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [token, setToken]       = useState(null)
  const [role, setRole]         = useState(null)
  const [planTier, setPlanTier] = useState(null)
  const [loading, setLoading]   = useState(true)

  // Tracks the uid whose profile has been loaded.
  // Prevents re-fetching the profile on every ~1h token refresh.
  const loadedUidRef = useRef(null)

  useEffect(() => {
    // onIdTokenChanged fires on: sign-in, sign-out, AND every ~1h token refresh.
    // This keeps `token` state current so all downstream Supabase calls always
    // carry a valid (non-expired) Firebase JWT.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Signed out
        setUser(null)
        setToken(null)
        setRole(null)
        setPlanTier(null)
        loadedUidRef.current = null
        setLoading(false)
        return
      }

      try {
        const idToken = await firebaseUser.getIdToken()
        setUser(firebaseUser)
        setToken(idToken)

        // Load profile only once per uid.
        // Token refreshes for the same uid skip the Supabase round-trip.
        if (loadedUidRef.current !== firebaseUser.uid) {
          await loadProfile(firebaseUser, setRole, setPlanTier)
          loadedUidRef.current = firebaseUser.uid
        }
      } catch (err) {
        console.error('[useAuth] onIdTokenChanged handler error:', err)
        setUser(null)
        setToken(null)
        setRole(null)
        setPlanTier(null)
        loadedUidRef.current = null
      }

      setLoading(false)
    })
    return unsubscribe
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────────
  // onIdTokenChanged handles all state updates after sign-in.

  async function signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider)
  }

  async function signOut() {
    await firebaseSignOut(auth)
    // Clear state immediately for instant UI response.
    // onIdTokenChanged will also fire with null and do the same.
    setUser(null)
    setToken(null)
    setRole(null)
    setPlanTier(null)
    loadedUidRef.current = null
  }

  // Force-reload the profile from Supabase (e.g., after an admin changes your role)
  async function refreshRole() {
    if (!user) return
    try {
      loadedUidRef.current = null
      await loadProfile(user, setRole, setPlanTier)
      loadedUidRef.current = user.uid
    } catch (err) {
      console.error('[useAuth] refreshRole error:', err)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      role,
      planTier,
      loading,
      isAuthenticated: !!user,
      accessToken: token,   // alias — some components use accessToken
      signIn,
      signInWithGoogle,
      signOut,
      refreshRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
