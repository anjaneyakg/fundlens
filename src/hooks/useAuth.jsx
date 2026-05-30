// src/hooks/useAuth.jsx
// Firebase Auth + Supabase profile loader.
// Uses onIdTokenChanged (fires on sign-in, sign-out, AND ~1h token refresh)
// so the stored JWT is always current.
// Table: public.profiles (id TEXT = Firebase UID, email, role, plan_tier)
//
// profileExists:
//   null  → loading / not yet determined
//   true  → profiles row exists (user is registered)
//   false → no profiles row yet (user must go through /register wizard)
//
// The profiles row is NO LONGER auto-created here. /register is responsible.

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

// ── Profile loader ────────────────────────────────────────────────────────────
// Reads the profiles row. Sets profileExists=true if found, false if not.
// Does NOT create the row — that is /register's job.
async function loadProfile(firebaseUser, setRole, setPlanTier, setProfileExists) {
  const uid = firebaseUser.uid
  let idToken
  try {
    idToken = await firebaseUser.getIdToken()
  } catch (err) {
    console.error('[useAuth] getIdToken failed during profile load:', err)
    setRole(null)
    setPlanTier(null)
    setProfileExists(false)
    return
  }

  try {
    const rows = await sbFetch(
      `profiles?id=eq.${encodeURIComponent(uid)}&select=id,email,role,plan_tier`,
      idToken,
    )

    if (rows && rows.length > 0) {
      setRole(rows[0].role || 'individual')
      setPlanTier(rows[0].plan_tier || 'free')
      setProfileExists(true)
      return
    }

    // Row missing — user needs to complete /register wizard
    setRole(null)
    setPlanTier(null)
    setProfileExists(false)
  } catch (err) {
    console.error('[useAuth] loadProfile unexpected error:', err)
    setRole(null)
    setPlanTier(null)
    setProfileExists(false)
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null)
  const [token,          setToken]          = useState(null)
  const [role,           setRole]           = useState(null)
  const [planTier,       setPlanTier]       = useState(null)
  const [profileExists,  setProfileExists]  = useState(null) // null=loading, true/false
  const [loading,        setLoading]        = useState(true)

  // Prevents re-fetching the profile on every ~1h token refresh for the same uid.
  const loadedUidRef = useRef(null)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setToken(null)
        setRole(null)
        setPlanTier(null)
        setProfileExists(null)
        loadedUidRef.current = null
        setLoading(false)
        return
      }

      try {
        const idToken = await firebaseUser.getIdToken()
        setUser(firebaseUser)
        setToken(idToken)

        // Load profile only once per uid — skip on token refreshes.
        if (loadedUidRef.current !== firebaseUser.uid) {
          await loadProfile(firebaseUser, setRole, setPlanTier, setProfileExists)
          loadedUidRef.current = firebaseUser.uid
        }
      } catch (err) {
        console.error('[useAuth] onIdTokenChanged handler error:', err)
        setUser(null)
        setToken(null)
        setRole(null)
        setPlanTier(null)
        setProfileExists(null)
        loadedUidRef.current = null
      }

      setLoading(false)
    })
    return unsubscribe
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider)
  }

  async function signOut() {
    await firebaseSignOut(auth)
    setUser(null)
    setToken(null)
    setRole(null)
    setPlanTier(null)
    setProfileExists(null)
    loadedUidRef.current = null
  }

  // Force-reload the profile (e.g., after /register wizard creates the row,
  // or after an admin changes a user's role).
  async function refreshRole() {
    if (!user) return
    try {
      loadedUidRef.current = null
      await loadProfile(user, setRole, setPlanTier, setProfileExists)
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
      profileExists,
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
