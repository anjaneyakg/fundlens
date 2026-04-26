import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Input({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', height: 42, padding: '0 14px', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#0f172a' }} />
    </div>
  );
}

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/schemes';
  const [tab, setTab]           = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  async function handleLogin(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signIn(email, password); navigate(from, { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSignup(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try { await signUp(email, password, fullName); setSuccess('Account created! Check your email to confirm, then sign in.'); setTab('login'); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const tabStyle = (active) => ({ flex: 1, padding: '10px 0', border: 'none', background: 'none', fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#4338ca' : '#94a3b8', borderBottom: active ? '2px solid #4338ca' : '2px solid transparent', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8', fontFamily: 'DM Sans, sans-serif', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#4338ca' }}>Fund<span style={{ color: '#0f172a' }}>Lens</span></span>
          </Link>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>Institutional-grade MF analytics</p>
        </div>
        <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
            <button style={tabStyle(tab === 'login')}  onClick={() => { setTab('login');  setError(''); setSuccess(''); }}>Sign in</button>
            <button style={tabStyle(tab === 'signup')} onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}>Create account</button>
          </div>
          <div style={{ padding: '28px 28px 24px' }}>
            {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#15803d', marginBottom: 20 }}>{success}</div>}
            {error   && <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#dc2626', marginBottom: 20 }}>{error}</div>}
            {tab === 'login' ? (
              <form onSubmit={handleLogin}>
                <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                <div style={{ marginBottom: 20 }} />
                <button type="submit" disabled={loading} style={{ width: '100%', height: 44, background: loading ? '#a5b4fc' : '#4338ca', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup}>
                <Input label="Full name" type="text" value={fullName} onChange={setFullName} placeholder="Your name" />
                <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 characters" />
                <div style={{ marginBottom: 20 }} />
                <button type="submit" disabled={loading} style={{ width: '100%', height: 44, background: loading ? '#a5b4fc' : '#4338ca', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
