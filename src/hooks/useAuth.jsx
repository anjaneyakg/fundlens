import { useState, useEffect, createContext, useContext } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../firebase';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path, token, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('sbFetch error:', path, res.status, text);
    return null;
  }
  return text ? JSON.parse(text) : null;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [token, setToken]       = useState(null);
  const [role, setRole]         = useState(null);
  const [planTier, setPlanTier] = useState(null);
  const [loading, setLoading]   = useState(true);

  async function loadOrCreateProfile(firebaseUser, idToken) {
    const uid = firebaseUser.uid;
    try {
      const rows = await sbFetch(
        `users?id=eq.${encodeURIComponent(uid)}&select=id,email,role,plan_tier`,
        idToken,
      );
      if (rows && rows.length > 0) {
        setRole(rows[0].role || 'individual');
        setPlanTier(rows[0].plan_tier || 'free');
        return;
      }
      // First sign-in — create the row
      await sbFetch('users', idToken, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id:        uid,
          email:     firebaseUser.email,
          role:      'individual',
          plan_tier: 'free',
        }),
      });
      setRole('individual');
      setPlanTier('free');
    } catch (err) {
      console.error('loadOrCreateProfile error:', err);
      setRole('individual');
      setPlanTier('free');
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setUser(firebaseUser);
          setToken(idToken);
          await loadOrCreateProfile(firebaseUser, idToken);
        } catch (err) {
          console.error('Auth state change error:', err);
          setUser(null);
          setToken(null);
          setRole(null);
          setPlanTier(null);
        }
      } else {
        setUser(null);
        setToken(null);
        setRole(null);
        setPlanTier(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await cred.user.getIdToken();
    setToken(idToken);
    return cred;
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const idToken = await cred.user.getIdToken();
    setToken(idToken);
    return cred;
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setToken(null);
    setRole(null);
    setPlanTier(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      role,
      planTier,
      loading,
      isAuthenticated: !!user,
      accessToken: token,
      signIn,
      signInWithGoogle,
      signOut,
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
