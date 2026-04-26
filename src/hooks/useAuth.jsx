import { useState, useEffect, createContext, useContext } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TIER_ORDER = { public: 0, investor: 1, advisor: 2, alpha: 3 };
const SESSION_KEY = 'fundlens_session';

function getStoredSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function storeSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

async function sbFetch(path, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token || SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession);
  const [user, setUser]       = useState(null);
  const [tier, setTier]       = useState('public');
  const [loading, setLoading] = useState(true);

  async function loadProfile(token, userId) {
    try {
      const users = await sbFetch(`users?id=eq.${userId}&select=id,email,full_name`, token);
      const roles = await sbFetch(`user_roles?user_id=eq.${userId}&select=tier_id,tiers(name)`, token);
      setUser(users?.[0] || null);
      setTier(roles?.[0]?.tiers?.name || 'investor');
    } catch (err) {
      console.error('loadProfile error:', err);
      setUser(null);
      setTier('public');
    }
  }

  useEffect(() => {
    const stored = getStoredSession();
    if (stored?.access_token) {
      setSession(stored);
      loadProfile(stored.access_token, stored.user?.id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || 'Sign in failed');
    storeSession(data);
    setSession(data);
    await loadProfile(data.access_token, data.user?.id);
    return data;
  }

  async function signUp(email, password, fullName) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: { full_name: fullName } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || 'Sign up failed');
    return data;
  }

  async function signOut() {
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }
    storeSession(null);
    setSession(null);
    setUser(null);
    setTier('public');
  }

  function canAccess(toolTier) {
    return (TIER_ORDER[tier] || 0) >= (TIER_ORDER[toolTier] || 0);
  }

  return (
    <AuthContext.Provider value={{
      session, user, tier, loading,
      isAuthenticated: !!session?.access_token,
      accessToken: session?.access_token || null,
      signIn, signUp, signOut, canAccess, TIER_ORDER,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
