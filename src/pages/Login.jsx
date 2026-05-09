import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ display: 'block' }}>
      <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.3 33.8 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.2 0 6.1 1.2 8.4 3.1l6.1-6.1C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/>
    </svg>
  );
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from || '/';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError]       = useState('');

  async function handleGoogle() {
    setError('');
    setGLoading(true);
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGLoading(false);
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Email sign-in error:', err);
      setError(err.message || 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0fdf8 0%, #f8fafc 60%, #f0f9ff 100%)',
      fontFamily: 'DM Sans, sans-serif',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#1D9E75' }}>
              Fund<span style={{ color: '#0f172a' }}>Lens</span>
            </span>
          </Link>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b' }}>
            Institutional-grade mutual fund analytics
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>

          {/* Google — primary CTA */}
          <div style={{ padding: '32px 32px 0' }}>
            {error && (
              <div style={{
                background: '#fff5f5', border: '1px solid #fca5a5',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 13, color: '#dc2626', marginBottom: 20,
              }}>
                {error}
              </div>
            )}
            <button
              onClick={handleGoogle}
              disabled={gLoading}
              style={{
                width: '100%', height: 52,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                background: gLoading ? '#b7e4d3' : '#1D9E75',
                color: '#fff',
                border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 600,
                fontFamily: 'DM Sans, sans-serif',
                cursor: gLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, transform 0.1s',
                boxShadow: gLoading ? 'none' : '0 2px 12px rgba(29,158,117,0.3)',
              }}
            >
              {!gLoading && <GoogleIcon />}
              {gLoading ? 'Signing in…' : 'Continue with Google'}
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
              New users — your account is created automatically on first sign-in.
            </p>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 32px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
              or sign in with email
            </span>
            <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
          </div>

          {/* Email + Password — secondary */}
          <form onSubmit={handleEmail} style={{ padding: '20px 32px 32px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', height: 42, padding: '0 14px',
                  boxSizing: 'border-box',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  fontSize: 14, fontFamily: 'DM Sans, sans-serif',
                  outline: 'none', color: '#0f172a',
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', height: 42, padding: '0 14px',
                  boxSizing: 'border-box',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  fontSize: 14, fontFamily: 'DM Sans, sans-serif',
                  outline: 'none', color: '#0f172a',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 44,
                background: loading ? '#f8fafc' : '#f8fafc',
                color: loading ? '#94a3b8' : '#1D9E75',
                border: '1.5px solid ' + (loading ? '#e2e8f0' : '#1D9E75'),
                borderRadius: 10,
                fontSize: 15, fontWeight: 600,
                fontFamily: 'DM Sans, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in with email'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          By signing in you agree to our{' '}
          <Link to="/terms" style={{ color: '#1D9E75', textDecoration: 'none' }}>Terms</Link>{' '}
          and{' '}
          <Link to="/privacy" style={{ color: '#1D9E75', textDecoration: 'none' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
